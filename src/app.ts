import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from './db/database.js';
import { getInventory } from './domain/inventory.js';
import { ReservationStatus } from './domain/reservation.js';
import { ReservationService } from './services/reservation-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStaticFile(res: http.ServerResponse, fileName: string, contentType: string): void {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: `Archivo estático no encontrado: ${fileName}` });
    return;
  }
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': content.length,
  });
  res.end(content);
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          reject(new Error('El cuerpo de la petición debe ser un objeto JSON válido.'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new Error('Formato JSON inválido en el cuerpo de la petición.'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export function createHttpServer(db: Database, service: ReservationService): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const method = req.method ?? 'GET';
      const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
      const pathname = parsedUrl.pathname;

      // Archivos estáticos del Frontend
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        serveStaticFile(res, 'index.html', 'text/html; charset=utf-8');
        return;
      }

      if (method === 'GET' && pathname === '/styles.css') {
        serveStaticFile(res, 'styles.css', 'text/css; charset=utf-8');
        return;
      }

      if (method === 'GET' && pathname === '/app.js') {
        serveStaticFile(res, 'app.js', 'application/javascript; charset=utf-8');
        return;
      }

      // GET /api/inventory
      if (method === 'GET' && pathname === '/api/inventory') {
        sendJson(res, 200, { units: getInventory() });
        return;
      }

      // GET /api/availability?unitId=...&start=...&end=...
      if (method === 'GET' && pathname === '/api/availability') {
        const unitId = parsedUrl.searchParams.get('unitId') ?? '';
        const start = parsedUrl.searchParams.get('start') ?? parsedUrl.searchParams.get('startTime') ?? '';
        const end = parsedUrl.searchParams.get('end') ?? parsedUrl.searchParams.get('endTime') ?? '';

        if (!unitId || !start || !end) {
          sendJson(res, 400, {
            error: 'Los parámetros de consulta unitId, start y end son obligatorios.',
          });
          return;
        }

        try {
          const result = service.checkAvailability(unitId, start, end);
          sendJson(res, 200, result);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al consultar disponibilidad.';
          sendJson(res, 400, { error: message });
        }
        return;
      }

      // GET /api/reservations
      if (method === 'GET' && pathname === '/api/reservations') {
        const unitId = parsedUrl.searchParams.get('unitId') || undefined;
        const statusParam = parsedUrl.searchParams.get('status') || undefined;

        let status: ReservationStatus | undefined;
        if (statusParam === 'ACTIVE' || statusParam === 'CANCELLED') {
          status = statusParam;
        }

        const reservations = service.listReservations({ unitId, status });
        sendJson(res, 200, { reservations });
        return;
      }

      // POST /api/reservations
      if (method === 'POST' && pathname === '/api/reservations') {
        let body: Record<string, unknown>;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Cuerpo JSON inválido.';
          sendJson(res, 400, { error: message });
          return;
        }

        const unitId = typeof body.unitId === 'string' ? body.unitId : '';
        const requester = typeof body.requester === 'string' ? body.requester : '';
        const startTime =
          typeof body.startTime === 'string'
            ? body.startTime
            : typeof body.start === 'string'
              ? body.start
              : '';
        const endTime =
          typeof body.endTime === 'string'
            ? body.endTime
            : typeof body.end === 'string'
              ? body.end
              : '';

        try {
          const reservation = service.createReservation({
            unitId,
            requester,
            startTime,
            endTime,
          });
          sendJson(res, 201, { reservation });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al crear la reserva.';
          const isConflict =
            message.includes('Superposición') || message.includes('no está disponible');
          sendJson(res, isConflict ? 409 : 400, { error: message });
        }
        return;
      }

      // POST /api/reservations/:id/cancel
      const cancelMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelMatch) {
        const reservationId = decodeURIComponent(cancelMatch[1]);
        try {
          const reservation = service.cancelReservation(reservationId);
          sendJson(res, 200, { reservation });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al cancelar la reserva.';
          if (message.includes('No se encontró')) {
            sendJson(res, 404, { error: message });
          } else if (message.includes('ya se encuentra cancelada')) {
            sendJson(res, 409, { error: message });
          } else {
            sendJson(res, 400, { error: message });
          }
        }
        return;
      }

      // POST /api/admin/reset
      if (method === 'POST' && pathname === '/api/admin/reset') {
        db.exec('DELETE FROM reservations');
        sendJson(res, 200, {
          message: 'Base de datos reiniciada correctamente. Todas las reservas fueron eliminadas.',
        });
        return;
      }

      sendJson(res, 404, { error: `Ruta no encontrada: ${method} ${pathname}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error interno del servidor.';
      sendJson(res, 500, { error: message });
    }
  });
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { Database } from '../src/db/database.js';
import { ReservationService } from '../src/services/reservation-service.js';
import { createHttpServer } from '../src/app.js';

describe('API REST & Frontend Dashboard Integration (TICKET-04)', () => {
  let db: Database;
  let service: ReservationService;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    service = new ReservationService(db);
    server = createHttpServer(db, service);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        db.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it('GET / sirve el HTML del Dashboard de Laboratorio y recursos estáticos (200 OK)', async () => {
    const htmlRes = await fetch(`${baseUrl}/`);
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('content-type')).toContain('text/html');
    const htmlText = await htmlRes.text();
    expect(htmlText).toContain('Coordinación de Laboratorio de Precisión');
    expect(htmlText).toContain('Catálogo de Equipos del Laboratorio');

    const cssRes = await fetch(`${baseUrl}/styles.css`);
    expect(cssRes.status).toBe(200);
    expect(cssRes.headers.get('content-type')).toContain('text/css');

    const jsRes = await fetch(`${baseUrl}/app.js`);
    expect(jsRes.status).toBe(200);
    expect(jsRes.headers.get('content-type')).toContain('application/javascript');
  });

  it('GET /api/inventory devuelve las 5 unidades precargadas del catálogo', async () => {
    const res = await fetch(`${baseUrl}/api/inventory`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { units: Array<{ id: string; name: string }> };
    expect(data.units).toHaveLength(5);
    expect(data.units.map((u) => u.id)).toEqual(['MIC-01', 'MIC-02', 'OSC-01', 'MUL-01', 'FUE-01']);
  });

  it('GET /api/availability consulta disponibilidad libre y ocupada correctamente', async () => {
    // 1. Consulta cuando está libre
    const freeRes = await fetch(
      `${baseUrl}/api/availability?unitId=MIC-01&start=2026-10-27T10:00&end=2026-10-27T11:00`
    );
    expect(freeRes.status).toBe(200);
    const freeData = (await freeRes.json()) as { available: boolean; unitId: string };
    expect(freeData.available).toBe(true);
    expect(freeData.unitId).toBe('MIC-01');

    // 2. Crear reserva activa en ese horario
    await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'MIC-01',
        requester: 'Dra. García',
        startTime: '2026-10-27T10:00',
        endTime: '2026-10-27T11:00',
      }),
    });

    // 3. Consulta cuando está ocupada (solapamiento parcial)
    const busyRes = await fetch(
      `${baseUrl}/api/availability?unitId=MIC-01&start=2026-10-27T10:30&end=2026-10-27T11:30`
    );
    expect(busyRes.status).toBe(200);
    const busyData = (await busyRes.json()) as {
      available: boolean;
      conflictingReservation?: { id: string; requester: string };
    };
    expect(busyData.available).toBe(false);
    expect(busyData.conflictingReservation?.id).toBe('RES-001');
    expect(busyData.conflictingReservation?.requester).toBe('Dra. García');

    // 4. Parámetros faltantes devuelven 400 Bad Request
    const badRes = await fetch(`${baseUrl}/api/availability?unitId=MIC-01`);
    expect(badRes.status).toBe(400);
  });

  it('POST /api/reservations crea reservas válidas (201), rechaza superposición (409), permite consecutivas (201) y rechaza inválidas (400)', async () => {
    // Crear reserva 1 (10:00 a 11:00)
    const res1 = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'OSC-01',
        requester: 'Ing. Marcos',
        startTime: '2026-10-27T10:00',
        endTime: '2026-10-27T11:00',
      }),
    });
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { reservation: { id: string; status: string } };
    expect(body1.reservation.id).toBe('RES-001');
    expect(body1.reservation.status).toBe('ACTIVE');

    // Intentar reserva superpuesta en la misma unidad (10:30 a 11:30) -> 409 Conflict
    const overlapRes = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'OSC-01',
        requester: 'Dr. Solapado',
        startTime: '2026-10-27T10:30',
        endTime: '2026-10-27T11:30',
      }),
    });
    expect(overlapRes.status).toBe(409);
    const overlapBody = (await overlapRes.json()) as { error: string };
    expect(overlapBody.error).toContain('Superposición');

    // Crear reserva consecutiva inmediatamente posterior (11:00 a 12:00) usando alias start/end -> 201 Created
    const consecutiveRes = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'OSC-01',
        requester: 'Lic. Contigua',
        start: '2026-10-27T11:00',
        end: '2026-10-27T12:00',
      }),
    });
    expect(consecutiveRes.status).toBe(201);
    const consecutiveBody = (await consecutiveRes.json()) as { reservation: { id: string } };
    expect(consecutiveBody.reservation.id).toBe('RES-002');

    // Rechazar datos inválidos (unidad inexistente y solicitante vacío) -> 400 Bad Request
    const invalidUnitRes = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'NO-EXISTE',
        requester: 'Dra. García',
        startTime: '2026-10-27T14:00',
        endTime: '2026-10-27T15:00',
      }),
    });
    expect(invalidUnitRes.status).toBe(400);

    const invalidReqRes = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'MIC-01',
        requester: '   ',
        startTime: '2026-10-27T14:00',
        endTime: '2026-10-27T15:00',
      }),
    });
    expect(invalidReqRes.status).toBe(400);
  });

  it('POST /api/reservations/:id/cancel cancela la reserva, conserva el historial como CANCELLED y libera el horario', async () => {
    // 1. Crear reserva inicial
    const createRes = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'MUL-01',
        requester: 'Dra. Sofía',
        startTime: '2026-10-27T09:00',
        endTime: '2026-10-27T10:00',
      }),
    });
    expect(createRes.status).toBe(201);

    // 2. Cancelar reserva RES-001
    const cancelRes = await fetch(`${baseUrl}/api/reservations/RES-001/cancel`, {
      method: 'POST',
    });
    expect(cancelRes.status).toBe(200);
    const cancelData = (await cancelRes.json()) as { reservation: { id: string; status: string } };
    expect(cancelData.reservation.id).toBe('RES-001');
    expect(cancelData.reservation.status).toBe('CANCELLED');

    // 3. Intentar volver a cancelar la misma reserva -> 409 Conflict
    const doubleCancelRes = await fetch(`${baseUrl}/api/reservations/RES-001/cancel`, {
      method: 'POST',
    });
    expect(doubleCancelRes.status).toBe(409);

    // 4. Intentar cancelar una reserva inexistente -> 404 Not Found
    const notFoundRes = await fetch(`${baseUrl}/api/reservations/RES-999/cancel`, {
      method: 'POST',
    });
    expect(notFoundRes.status).toBe(404);

    // 5. Verificar que el horario volvió a estar disponible y se puede reservar nuevamente
    const rebookRes = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'MUL-01',
        requester: 'Dr. Nuevo Turno',
        startTime: '2026-10-27T09:00',
        endTime: '2026-10-27T10:00',
      }),
    });
    expect(rebookRes.status).toBe(201);
    const rebookData = (await rebookRes.json()) as { reservation: { id: string; status: string } };
    expect(rebookData.reservation.id).toBe('RES-002');
    expect(rebookData.reservation.status).toBe('ACTIVE');

    // 6. Verificar listado completo en historial (ambas persisten: RES-001 CANCELLED y RES-002 ACTIVE)
    const listRes = await fetch(`${baseUrl}/api/reservations?unitId=MUL-01`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      reservations: Array<{ id: string; status: string; requester: string }>;
    };
    expect(listData.reservations).toHaveLength(2);
    const res001 = listData.reservations.find((r) => r.id === 'RES-001');
    const res002 = listData.reservations.find((r) => r.id === 'RES-002');
    expect(res001).toMatchObject({ id: 'RES-001', status: 'CANCELLED', requester: 'Dra. Sofía' });
    expect(res002).toMatchObject({ id: 'RES-002', status: 'ACTIVE', requester: 'Dr. Nuevo Turno' });
  });

  it('POST /api/admin/reset limpia todas las reservas de la base de datos', async () => {
    await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: 'FUE-01',
        requester: 'Tester',
        startTime: '2026-10-27T15:00',
        endTime: '2026-10-27T16:00',
      }),
    });

    const resetRes = await fetch(`${baseUrl}/api/admin/reset`, { method: 'POST' });
    expect(resetRes.status).toBe(200);

    const listRes = await fetch(`${baseUrl}/api/reservations`);
    const listData = (await listRes.json()) as { reservations: unknown[] };
    expect(listData.reservations).toHaveLength(0);
  });
});

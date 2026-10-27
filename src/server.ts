import { createDatabase, DEFAULT_DB_PATH } from './db/database.js';
import { ReservationService } from './services/reservation-service.js';
import { createHttpServer } from './app.js';

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;

const db = createDatabase(dbPath);
const service = new ReservationService(db);
const server = createHttpServer(db, service);

server.listen(port, () => {
  console.log(`=========================================================`);
  console.log(`🔬 Sistema de Reservas de Laboratorio iniciado`);
  console.log(`🌐 Dashboard Web Local: http://localhost:${port}`);
  console.log(`💾 Base de datos SQLite: ${dbPath}`);
  console.log(`=========================================================`);
});

function shutdown(signal: string): void {
  console.log(`\nRecibida señal ${signal}. Cerrando servidor y base de datos...`);
  server.close(() => {
    db.close();
    console.log('Servidor detenido correctamente.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

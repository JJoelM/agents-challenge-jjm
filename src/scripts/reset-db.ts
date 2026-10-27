import { createDatabase, DEFAULT_DB_PATH } from '../db/database.js';
import { ReservationService } from '../services/reservation-service.js';

export function resetDatabase(dbPath: string = DEFAULT_DB_PATH): void {
  const db = createDatabase(dbPath);
  try {
    const service = new ReservationService(db);
    service.resetAll();
    console.log(`[db:reset] Base de datos reiniciada exitosamente en: ${dbPath}`);
    console.log('[db:reset] Advertencia: Todas las reservas previas fueron eliminadas. El esquema se encuentra limpio.');
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/scripts/reset-db.ts');
if (isMain) {
  resetDatabase();
}

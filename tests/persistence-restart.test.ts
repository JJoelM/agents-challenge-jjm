import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Database } from '../src/db/database.js';
import { ReservationService } from '../src/services/reservation-service.js';
import { resetDatabase } from '../src/scripts/reset-db.js';

const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test-persistence.db');

function cleanupTestDbFile(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const target = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }
}

describe('TICKET-05: Verificación de Persistencia tras Reinicio y Scripts de Ciclo de Vida', () => {
  beforeEach(() => {
    cleanupTestDbFile();
  });

  afterEach(() => {
    cleanupTestDbFile();
  });

  it('conserva reservas activas, canceladas, disponibilidad y secuencia de IDs tras cerrar y reabrir el archivo SQLite', () => {
    // --- INSTANCIA 1 (Ejecución inicial antes del apagado) ---
    const dbInstance1 = new Database(TEST_DB_PATH);
    const serviceInstance1 = new ReservationService(dbInstance1);

    const res1 = serviceInstance1.createReservation({
      unitId: 'MIC-01',
      requester: 'Dra. Clara Méndez',
      startTime: '2026-11-10T09:00',
      endTime: '2026-11-10T10:00',
    });

    const res2 = serviceInstance1.createReservation({
      unitId: 'OSC-01',
      requester: 'Ing. Tomás Vega',
      startTime: '2026-11-10T10:00',
      endTime: '2026-11-10T12:00',
    });

    expect(res1.id).toBe('RES-001');
    expect(res2.id).toBe('RES-002');

    // Cancelar RES-001 y dejar RES-002 activa
    serviceInstance1.cancelReservation('RES-001');

    // Cerrar completamente la conexión (simulando detención del proceso/servidor)
    dbInstance1.close();

    // --- INSTANCIA 2 (Simulando reinicio de la aplicación sobre el mismo archivo en disco) ---
    const dbInstance2 = new Database(TEST_DB_PATH);
    const serviceInstance2 = new ReservationService(dbInstance2);

    try {
      const persistedList = serviceInstance2.listReservations();
      expect(persistedList).toHaveLength(2);

      const recoveredRes1 = serviceInstance2.getReservationById('RES-001');
      expect(recoveredRes1).not.toBeNull();
      expect(recoveredRes1?.unitId).toBe('MIC-01');
      expect(recoveredRes1?.requester).toBe('Dra. Clara Méndez');
      expect(recoveredRes1?.startTime).toBe('2026-11-10T09:00');
      expect(recoveredRes1?.endTime).toBe('2026-11-10T10:00');
      expect(recoveredRes1?.status).toBe('CANCELLED');
      expect(recoveredRes1?.createdAt).toBe(res1.createdAt);

      const recoveredRes2 = serviceInstance2.getReservationById('RES-002');
      expect(recoveredRes2).not.toBeNull();
      expect(recoveredRes2?.unitId).toBe('OSC-01');
      expect(recoveredRes2?.requester).toBe('Ing. Tomás Vega');
      expect(recoveredRes2?.startTime).toBe('2026-11-10T10:00');
      expect(recoveredRes2?.endTime).toBe('2026-11-10T12:00');
      expect(recoveredRes2?.status).toBe('ACTIVE');
      expect(recoveredRes2?.createdAt).toBe(res2.createdAt);

      // El horario de RES-001 (cancelada) debe seguir libre
      const availRes1Slot = serviceInstance2.checkAvailability('MIC-01', '2026-11-10T09:00', '2026-11-10T10:00');
      expect(availRes1Slot.available).toBe(true);

      // El horario de RES-002 (activa) debe seguir bloqueado
      const availRes2Slot = serviceInstance2.checkAvailability('OSC-01', '2026-11-10T10:30', '2026-11-10T11:30');
      expect(availRes2Slot.available).toBe(false);
      expect(availRes2Slot.conflictingReservation?.id).toBe('RES-002');

      // Crear una nueva reserva tras el reinicio debe continuar la secuencia en RES-003
      const res3 = serviceInstance2.createReservation({
        unitId: 'MIC-01',
        requester: 'Lic. Paula Ríos',
        startTime: '2026-11-10T09:00',
        endTime: '2026-11-10T10:00',
      });
      expect(res3.id).toBe('RES-003');
      expect(res3.status).toBe('ACTIVE');
    } finally {
      dbInstance2.close();
    }
  });

  it('permite purgar y reiniciar el estado mediante resetDatabase / resetAll dejando la base limpia', () => {
    const db1 = new Database(TEST_DB_PATH);
    const service1 = new ReservationService(db1);

    service1.createReservation({
      unitId: 'FUE-01',
      requester: 'Solicitante Temporal',
      startTime: '2026-11-12T08:00',
      endTime: '2026-11-12T09:00',
    });
    expect(service1.listReservations()).toHaveLength(1);
    db1.close();

    // Ejecutar el script de reseteo sobre la base en disco
    resetDatabase(TEST_DB_PATH);

    const db2 = new Database(TEST_DB_PATH);
    const service2 = new ReservationService(db2);
    try {
      expect(service2.listReservations()).toHaveLength(0);
      const afterReset = service2.createReservation({
        unitId: 'FUE-01',
        requester: 'Nuevo Solicitante',
        startTime: '2026-11-12T08:00',
        endTime: '2026-11-12T09:00',
      });
      expect(afterReset.id).toBe('RES-001');
    } finally {
      db2.close();
    }
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../src/db/database.js';
import { ReservationService } from '../src/services/reservation-service.js';

describe('TICKET-03: Cancelación de Reservas y Liberación de Horarios', () => {
  let db: Database;
  let service: ReservationService;

  beforeEach(() => {
    db = new Database(':memory:');
    service = new ReservationService(db);
  });

  it('cambia el estado a CANCELLED y preserva intactos todos los datos históricos de la reserva', () => {
    const created = service.createReservation({
      unitId: 'MIC-01',
      requester: 'Dra. Valeria Luna',
      startTime: '2026-10-27T10:00',
      endTime: '2026-10-27T11:00',
    });

    const cancelled = service.cancelReservation(created.id);

    expect(cancelled.id).toBe('RES-001');
    expect(cancelled.unitId).toBe(created.unitId);
    expect(cancelled.requester).toBe(created.requester);
    expect(cancelled.startTime).toBe(created.startTime);
    expect(cancelled.endTime).toBe(created.endTime);
    expect(cancelled.createdAt).toBe(created.createdAt);
    expect(cancelled.status).toBe('CANCELLED');

    // Verificar que el registro persiste en el historial de la base de datos
    const fromDb = service.getReservationById('RES-001');
    expect(fromDb).not.toBeNull();
    expect(fromDb?.status).toBe('CANCELLED');
    expect(fromDb?.requester).toBe('Dra. Valeria Luna');
    expect(fromDb?.createdAt).toBe(created.createdAt);

    const history = service.listReservations({ status: 'CANCELLED' });
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('RES-001');
  });

  it('libera efectivamente el intervalo tras cancelar, permitiendo una nueva reserva RES-002 en el mismo horario', () => {
    // 1. Crear RES-001 en MIC-01 de 10:00 a 11:00
    const res1 = service.createReservation({
      unitId: 'MIC-01',
      requester: 'Ing. Roberto Sosa',
      startTime: '2026-10-27T10:00',
      endTime: '2026-10-27T11:00',
    });
    expect(res1.id).toBe('RES-001');

    // Confirmar que inicialmente está bloqueado
    expect(service.checkAvailability('MIC-01', '2026-10-27T10:00', '2026-10-27T11:00').available).toBe(false);

    // 2. Cancelar RES-001
    service.cancelReservation('RES-001');

    // 3. Verificar que checkAvailability reporta available: true inmediatamente
    const availabilityAfterCancel = service.checkAvailability('MIC-01', '2026-10-27T10:00', '2026-10-27T11:00');
    expect(availabilityAfterCancel.available).toBe(true);
    expect(availabilityAfterCancel.conflictingReservation).toBeUndefined();

    // 4. Crear nueva reserva RES-002 exactamente en el mismo horario liberado (10:00 a 11:00)
    const res2 = service.createReservation({
      unitId: 'MIC-01',
      requester: 'Dra. Elena Torres',
      startTime: '2026-10-27T10:00',
      endTime: '2026-10-27T11:00',
    });
    expect(res2.id).toBe('RES-002');
    expect(res2.status).toBe('ACTIVE');

    // 5. Ambas reservas coexisten en el historial (RES-001 CANCELLED y RES-002 ACTIVE)
    const allReservations = service.listReservations({ unitId: 'MIC-01' });
    expect(allReservations).toHaveLength(2);
    expect(allReservations.find((r) => r.id === 'RES-001')?.status).toBe('CANCELLED');
    expect(allReservations.find((r) => r.id === 'RES-002')?.status).toBe('ACTIVE');
  });

  it('rechaza cancelar una reserva con ID inexistente o vacío', () => {
    expect(() => service.cancelReservation('RES-999')).toThrow(/No se encontró ninguna reserva/i);
    expect(() => service.cancelReservation('')).toThrow(/identificador de la reserva no puede estar vacío/i);
    expect(() => service.cancelReservation('   ')).toThrow(/identificador de la reserva no puede estar vacío/i);
  });

  it('rechaza volver a cancelar una reserva que ya se encuentra en estado CANCELLED', () => {
    service.createReservation({
      unitId: 'OSC-01',
      requester: 'Dr. Marcos Paz',
      startTime: '2026-10-27T08:00',
      endTime: '2026-10-27T09:00',
    });

    service.cancelReservation('RES-001');

    expect(() => service.cancelReservation('RES-001')).toThrow(/ya se encuentra cancelada/i);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../src/db/database.js';
import { ReservationService } from '../src/services/reservation-service.js';

describe('TICKET-02: Creación de Reservas y Motor de Superposiciones', () => {
  let db: Database;
  let service: ReservationService;

  beforeEach(() => {
    db = new Database(':memory:');
    service = new ReservationService(db);
  });

  describe('Creación válida y generador de IDs secuenciales', () => {
    it('debe crear reservas válidas asignando IDs correlativos RES-001, RES-002 y estado ACTIVE', () => {
      const res1 = service.createReservation({
        unitId: 'MIC-01',
        requester: 'Dra. Ana García',
        startTime: '2026-10-27T10:00',
        endTime: '2026-10-27T11:00',
      });

      expect(res1.id).toBe('RES-001');
      expect(res1.unitId).toBe('MIC-01');
      expect(res1.requester).toBe('Dra. Ana García');
      expect(res1.startTime).toBe('2026-10-27T10:00');
      expect(res1.endTime).toBe('2026-10-27T11:00');
      expect(res1.status).toBe('ACTIVE');
      expect(res1.createdAt).toBeDefined();

      const res2 = service.createReservation({
        unitId: 'OSC-01',
        requester: '  Ing. Carlos López  ',
        startTime: '2026-10-27T14:00',
        endTime: '2026-10-27T15:30',
      });

      expect(res2.id).toBe('RES-002');
      expect(res2.requester).toBe('Ing. Carlos López'); // normalizado con trim
      expect(res2.status).toBe('ACTIVE');

      const all = service.listReservations();
      expect(all).toHaveLength(2);
      expect(service.getReservationById('RES-001')?.id).toBe('RES-001');
      expect(service.getReservationById('RES-002')?.id).toBe('RES-002');
    });
  });

  describe('Caso explícito de la consigna (MIC-01 y MIC-02)', () => {
    it('con MIC-01 reservado de 10:00 a 11:00: rechaza 10:30-11:30, permite 11:00-12:00 consecutivo y permite MIC-02 de 10:00-11:00', () => {
      // 1. Reserva inicial en MIC-01 de 10:00 a 11:00
      const baseRes = service.createReservation({
        unitId: 'MIC-01',
        requester: 'Dr. Martín Pérez',
        startTime: '2026-10-27T10:00',
        endTime: '2026-10-27T11:00',
      });
      expect(baseRes.id).toBe('RES-001');

      // 2. Rechazar superposición en MIC-01 de 10:30 a 11:30
      const checkOverlap = service.checkAvailability('MIC-01', '2026-10-27T10:30', '2026-10-27T11:30');
      expect(checkOverlap.available).toBe(false);
      expect(checkOverlap.conflictingReservation?.id).toBe('RES-001');

      expect(() => {
        service.createReservation({
          unitId: 'MIC-01',
          requester: 'Lic. Sofía Gómez',
          startTime: '2026-10-27T10:30',
          endTime: '2026-10-27T11:30',
        });
      }).toThrow(/Superposición con la reserva activa RES-001/i);

      // 3. Permitir turno consecutivo contiguo en MIC-01 de 11:00 a 12:00 (fin == inicio)
      const checkAdjacent = service.checkAvailability('MIC-01', '2026-10-27T11:00', '2026-10-27T12:00');
      expect(checkAdjacent.available).toBe(true);

      const adjacentRes = service.createReservation({
        unitId: 'MIC-01',
        requester: 'Lic. Sofía Gómez',
        startTime: '2026-10-27T11:00',
        endTime: '2026-10-27T12:00',
      });
      expect(adjacentRes.id).toBe('RES-002');
      expect(adjacentRes.status).toBe('ACTIVE');

      // 4. Permitir reserva simultánea en otra unidad física (MIC-02) de 10:00 a 11:00
      const checkOtherUnit = service.checkAvailability('MIC-02', '2026-10-27T10:00', '2026-10-27T11:00');
      expect(checkOtherUnit.available).toBe(true);

      const parallelRes = service.createReservation({
        unitId: 'MIC-02',
        requester: 'Becario Lucas Díaz',
        startTime: '2026-10-27T10:00',
        endTime: '2026-10-27T11:00',
      });
      expect(parallelRes.id).toBe('RES-003');
      expect(parallelRes.unitId).toBe('MIC-02');
    });
  });

  describe('Motor de superposiciones: todas las variantes en la misma unidad activa', () => {
    beforeEach(() => {
      // Reserva base en OSC-01 de 10:00 a 12:00
      service.createReservation({
        unitId: 'OSC-01',
        requester: 'Investigador Base',
        startTime: '2026-10-27T10:00',
        endTime: '2026-10-27T12:00',
      });
    });

    it('rechaza superposición exacta (10:00 a 12:00)', () => {
      expect(() =>
        service.createReservation({
          unitId: 'OSC-01',
          requester: 'Usuario A',
          startTime: '2026-10-27T10:00',
          endTime: '2026-10-27T12:00',
        })
      ).toThrow(/Superposición/i);
    });

    it('rechaza superposición parcial por izquierda (09:00 a 10:30)', () => {
      expect(() =>
        service.createReservation({
          unitId: 'OSC-01',
          requester: 'Usuario B',
          startTime: '2026-10-27T09:00',
          endTime: '2026-10-27T10:30',
        })
      ).toThrow(/Superposición/i);
    });

    it('rechaza superposición parcial por derecha (11:30 a 13:00)', () => {
      expect(() =>
        service.createReservation({
          unitId: 'OSC-01',
          requester: 'Usuario C',
          startTime: '2026-10-27T11:30',
          endTime: '2026-10-27T13:00',
        })
      ).toThrow(/Superposición/i);
    });

    it('rechaza intervalo completamente contenido dentro de la reserva activa (10:30 a 11:30)', () => {
      expect(() =>
        service.createReservation({
          unitId: 'OSC-01',
          requester: 'Usuario D',
          startTime: '2026-10-27T10:30',
          endTime: '2026-10-27T11:30',
        })
      ).toThrow(/Superposición/i);
    });

    it('rechaza intervalo envolvente que cubre toda la reserva activa (09:00 a 13:00)', () => {
      expect(() =>
        service.createReservation({
          unitId: 'OSC-01',
          requester: 'Usuario E',
          startTime: '2026-10-27T09:00',
          endTime: '2026-10-27T13:00',
        })
      ).toThrow(/Superposición/i);
    });

    it('permite reserva contigua anterior (09:00 a 10:00) y contigua posterior (12:00 a 13:00)', () => {
      const before = service.createReservation({
        unitId: 'OSC-01',
        requester: 'Usuario Previo',
        startTime: '2026-10-27T09:00',
        endTime: '2026-10-27T10:00',
      });
      const after = service.createReservation({
        unitId: 'OSC-01',
        requester: 'Usuario Posterior',
        startTime: '2026-10-27T12:00',
        endTime: '2026-10-27T13:00',
      });

      expect(before.status).toBe('ACTIVE');
      expect(after.status).toBe('ACTIVE');
    });
  });

  describe('Rechazo de entradas inválidas', () => {
    it('rechaza una unidad inexistente en el catálogo (XYZ-99)', () => {
      expect(() =>
        service.createReservation({
          unitId: 'XYZ-99',
          requester: 'Dra. García',
          startTime: '2026-10-27T10:00',
          endTime: '2026-10-27T11:00',
        })
      ).toThrow(/no existe en el inventario/i);
    });

    it('rechaza solicitante vacío ("") o compuesto solo por espacios ("   ")', () => {
      expect(() =>
        service.createReservation({
          unitId: 'MUL-01',
          requester: '',
          startTime: '2026-10-27T10:00',
          endTime: '2026-10-27T11:00',
        })
      ).toThrow(/solicitante no puede estar vacío/i);

      expect(() =>
        service.createReservation({
          unitId: 'MUL-01',
          requester: '     ',
          startTime: '2026-10-27T10:00',
          endTime: '2026-10-27T11:00',
        })
      ).toThrow(/solicitante no puede estar vacío/i);
    });

    it('rechaza intervalos donde inicio >= fin', () => {
      expect(() =>
        service.createReservation({
          unitId: 'FUE-01',
          requester: 'Dra. García',
          startTime: '2026-10-27T12:00',
          endTime: '2026-10-27T11:00',
        })
      ).toThrow(/estrictamente anterior/i);

      expect(() =>
        service.createReservation({
          unitId: 'FUE-01',
          requester: 'Dra. García',
          startTime: '2026-10-27T12:00',
          endTime: '2026-10-27T12:00',
        })
      ).toThrow(/estrictamente anterior/i);
    });

    it('rechaza fechas malformadas o calendario inexistente ("2026-02-30T10:00", "fecha-invalida", "12345")', () => {
      expect(() =>
        service.createReservation({
          unitId: 'MIC-01',
          requester: 'Dra. García',
          startTime: '2026-02-30T10:00',
          endTime: '2026-02-30T11:00',
        })
      ).toThrow(/formato ISO/i);

      expect(() =>
        service.createReservation({
          unitId: 'MIC-01',
          requester: 'Dra. García',
          startTime: 'fecha-invalida',
          endTime: '2026-10-27T11:00',
        })
      ).toThrow(/formato ISO/i);

      expect(() =>
        service.createReservation({
          unitId: 'MIC-01',
          requester: 'Dra. García',
          startTime: '12345',
          endTime: '2026-10-27T11:00',
        })
      ).toThrow(/formato ISO/i);
    });

    it('rechaza reservas con duración menor a 15 minutos', () => {
      expect(() =>
        service.createReservation({
          unitId: 'MIC-01',
          requester: 'Dra. García',
          startTime: '2026-10-27T10:00',
          endTime: '2026-10-27T10:14',
        })
      ).toThrow(/duración mínima/i);
    });

    it('rechaza reservas con duración mayor a 24 horas', () => {
      expect(() =>
        service.createReservation({
          unitId: 'MIC-01',
          requester: 'Dra. García',
          startTime: '2026-10-27T10:00',
          endTime: '2026-10-28T10:01',
        })
      ).toThrow(/duración máxima/i);
    });
  });
});

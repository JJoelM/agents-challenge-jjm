import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../src/db/database.js';
import { ReservationService } from '../src/services/reservation-service.js';
import { getInventory, isKnownUnit, getUnitById } from '../src/domain/inventory.js';

describe('TICKET-01: Catálogo de Inventario y Consulta de Disponibilidad', () => {
  let db: Database;
  let service: ReservationService;

  beforeEach(() => {
    db = new Database(':memory:');
    service = new ReservationService(db);
  });

  describe('Inventario Precargado', () => {
    it('debe contener exactamente las 5 unidades físicas especificadas en la consigna', () => {
      const inventory = getInventory();
      expect(inventory).toHaveLength(5);

      const ids = inventory.map((u) => u.id);
      expect(ids).toEqual(['MIC-01', 'MIC-02', 'OSC-01', 'MUL-01', 'FUE-01']);
    });

    it('debe validar correctamente si una unidad existe o no', () => {
      expect(isKnownUnit('MIC-01')).toBe(true);
      expect(isKnownUnit('OSC-01')).toBe(true);
      expect(isKnownUnit('DESCONOCIDO-99')).toBe(false);
      expect(isKnownUnit('')).toBe(false);
    });

    it('debe recuperar la información descriptiva de una unidad conocida', () => {
      const unit = getUnitById('MIC-01');
      expect(unit).toBeDefined();
      expect(unit?.name).toBe('Microscopio digital');
    });
  });

  describe('Consulta de Disponibilidad Inicial', () => {
    it('debe reportar disponibilidad libre cuando no existen reservas para el intervalo', () => {
      const res = service.checkAvailability('MIC-01', '2026-11-01T10:00', '2026-11-01T11:00');
      expect(res.available).toBe(true);
      expect(res.unitId).toBe('MIC-01');
      expect(res.conflictingReservation).toBeUndefined();
    });

    it('debe rechazar la consulta si la unidad no existe en el catálogo', () => {
      expect(() => {
        service.checkAvailability('UNKNOWN-01', '2026-11-01T10:00', '2026-11-01T11:00');
      }).toThrow(/no existe en el inventario/i);
    });

    it('debe rechazar la consulta si la fecha de inicio no es estrictamente anterior al fin', () => {
      expect(() => {
        service.checkAvailability('MIC-01', '2026-11-01T11:00', '2026-11-01T10:00');
      }).toThrow(/estrictamente anterior/i);

      expect(() => {
        service.checkAvailability('MIC-01', '2026-11-01T10:00', '2026-11-01T10:00');
      }).toThrow(/estrictamente anterior/i);
    });

    it('debe rechazar la consulta si la duración es menor a 15 minutos', () => {
      expect(() => {
        service.checkAvailability('MIC-01', '2026-11-01T10:00', '2026-11-01T10:10');
      }).toThrow(/duración mínima/i);
    });
  });
});

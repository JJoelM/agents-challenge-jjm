import { Database } from '../db/database.js';
import { isKnownUnit } from '../domain/inventory.js';
import {
  Reservation,
  ReservationStatus,
  CreateReservationDTO,
  validateInterval,
  validateRequester,
  doIntervalsOverlap,
} from '../domain/reservation.js';

interface RawReservationRow {
  id: string;
  unit_id: string;
  requester: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

function mapRowToReservation(row: RawReservationRow): Reservation {
  return {
    id: row.id,
    unitId: row.unit_id,
    requester: row.requester,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status as ReservationStatus,
    createdAt: row.created_at,
  };
}

export interface AvailabilityResult {
  available: boolean;
  unitId: string;
  startTime: string;
  endTime: string;
  reason?: string;
  conflictingReservation?: Reservation;
}

export class ReservationService {
  constructor(private db: Database) {}

  public checkAvailability(unitId: string, startTime: string, endTime: string): AvailabilityResult {
    if (!isKnownUnit(unitId)) {
      throw new Error(`La unidad '${unitId}' no existe en el inventario del laboratorio.`);
    }

    validateInterval(startTime, endTime);

    const stmt = this.db.getRawDb().prepare(`
      SELECT * FROM reservations
      WHERE unit_id = ? AND status = 'ACTIVE'
    `);
    const rows = stmt.all(unitId) as unknown as RawReservationRow[];

    for (const row of rows) {
      if (doIntervalsOverlap(startTime, endTime, row.start_time, row.end_time)) {
        const conflicting = mapRowToReservation(row);
        return {
          available: false,
          unitId,
          startTime,
          endTime,
          reason: `Superposición con la reserva activa ${conflicting.id} (${conflicting.startTime} a ${conflicting.endTime}).`,
          conflictingReservation: conflicting,
        };
      }
    }

    return {
      available: true,
      unitId,
      startTime,
      endTime,
    };
  }

  public createReservation(dto: CreateReservationDTO): Reservation {
    const { unitId, startTime, endTime } = dto;

    if (!isKnownUnit(unitId)) {
      throw new Error(`La unidad '${unitId}' no existe en el inventario del laboratorio.`);
    }

    const requester = validateRequester(dto.requester);
    validateInterval(startTime, endTime);

    const availability = this.checkAvailability(unitId, startTime, endTime);
    if (!availability.available) {
      throw new Error(availability.reason ?? 'El intervalo no está disponible para esta unidad.');
    }

    const nextId = this.generateNextId();
    const createdAt = new Date().toISOString();

    const insertStmt = this.db.getRawDb().prepare(`
      INSERT INTO reservations (id, unit_id, requester, start_time, end_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    `);

    insertStmt.run(nextId, unitId, requester, startTime, endTime, createdAt);

    return {
      id: nextId,
      unitId,
      requester,
      startTime,
      endTime,
      status: 'ACTIVE',
      createdAt,
    };
  }

  public cancelReservation(reservationId: string): Reservation {
    const findStmt = this.db.getRawDb().prepare(`
      SELECT * FROM reservations WHERE id = ?
    `);
    const row = findStmt.get(reservationId) as unknown as RawReservationRow | undefined;

    if (!row) {
      throw new Error(`No se encontró ninguna reserva con el identificador '${reservationId}'.`);
    }

    if (row.status === 'CANCELLED') {
      throw new Error(`La reserva '${reservationId}' ya se encuentra cancelada.`);
    }

    const updateStmt = this.db.getRawDb().prepare(`
      UPDATE reservations SET status = 'CANCELLED' WHERE id = ?
    `);
    updateStmt.run(reservationId);

    return {
      id: row.id,
      unitId: row.unit_id,
      requester: row.requester,
      startTime: row.start_time,
      endTime: row.end_time,
      status: 'CANCELLED',
      createdAt: row.created_at,
    };
  }

  public listReservations(filters?: { unitId?: string; status?: ReservationStatus }): Reservation[] {
    let sql = 'SELECT * FROM reservations';
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters?.unitId) {
      conditions.push('unit_id = ?');
      params.push(filters.unitId);
    }

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY start_time ASC';

    const stmt = this.db.getRawDb().prepare(sql);
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as unknown as RawReservationRow[];

    return rows.map(mapRowToReservation);
  }

  public getReservationById(id: string): Reservation | null {
    const stmt = this.db.getRawDb().prepare('SELECT * FROM reservations WHERE id = ?');
    const row = stmt.get(id) as unknown as RawReservationRow | undefined;
    return row ? mapRowToReservation(row) : null;
  }

  private generateNextId(): string {
    const stmt = this.db.getRawDb().prepare(`
      SELECT COUNT(*) as count FROM reservations
    `);
    const result = stmt.get() as unknown as { count: number };
    const count = result?.count ?? 0;
    const nextNumber = count + 1;
    return `RES-${String(nextNumber).padStart(3, '0')}`;
  }
}

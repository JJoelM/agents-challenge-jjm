export type ReservationStatus = 'ACTIVE' | 'CANCELLED';

export interface Reservation {
  id: string;
  unitId: string;
  requester: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  status: ReservationStatus;
  createdAt: string; // ISO 8601
}

export interface CreateReservationDTO {
  unitId: string;
  requester: string;
  startTime: string;
  endTime: string;
}

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_HOURS = 24;

const ISO_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

export function parseAndValidateIsoDate(isoString: string, fieldName: string): Date {
  if (!isoString || typeof isoString !== 'string') {
    throw new Error(`El campo '${fieldName}' debe ser una cadena de fecha válida.`);
  }

  const trimmed = isoString.trim();
  const match = ISO_DATE_TIME_REGEX.exec(trimmed);
  if (!match) {
    throw new Error(`El campo '${fieldName}' (${isoString}) no es una fecha válida en formato ISO.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] !== undefined ? Number(match[6]) : 0;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw new Error(`El campo '${fieldName}' (${isoString}) no es una fecha válida en formato ISO.`);
  }

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new Error(
      `El campo '${fieldName}' (${isoString}) no es una fecha válida en formato ISO (fecha calendario inexistente).`
    );
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new Error(`El campo '${fieldName}' (${isoString}) no es una fecha válida en formato ISO.`);
  }

  return date;
}

export function validateInterval(startTime: string, endTime: string): { start: Date; end: Date } {
  const start = parseAndValidateIsoDate(startTime, 'inicio');
  const end = parseAndValidateIsoDate(endTime, 'fin');

  const startMs = start.getTime();
  const endMs = end.getTime();

  if (startMs >= endMs) {
    throw new Error(`La fecha de inicio (${startTime}) debe ser estrictamente anterior a la fecha de fin (${endTime}).`);
  }

  const durationMinutes = (endMs - startMs) / (1000 * 60);

  if (durationMinutes < MIN_DURATION_MINUTES) {
    throw new Error(`La duración mínima de una reserva es de ${MIN_DURATION_MINUTES} minutos.`);
  }

  if (durationMinutes > MAX_DURATION_HOURS * 60) {
    throw new Error(`La duración máxima de una reserva es de ${MAX_DURATION_HOURS} horas.`);
  }

  return { start, end };
}

/**
 * Dos intervalos semiabiertos [startA, endA) y [startB, endB) colisionan si y solo si:
 * startA < endB && endA > startB.
 * Límites consecutivos contiguos (endA === startB) NO colisionan.
 */
export function doIntervalsOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date
): boolean {
  const tStartA = typeof startA === 'string' ? new Date(startA).getTime() : startA.getTime();
  const tEndA = typeof endA === 'string' ? new Date(endA).getTime() : endA.getTime();
  const tStartB = typeof startB === 'string' ? new Date(startB).getTime() : startB.getTime();
  const tEndB = typeof endB === 'string' ? new Date(endB).getTime() : endB.getTime();

  return tStartA < tEndB && tEndA > tStartB;
}

export function validateRequester(requester: string): string {
  if (typeof requester !== 'string' || requester.trim().length === 0) {
    throw new Error('El solicitante no puede estar vacío ni compuesto únicamente por espacios en blanco.');
  }
  return requester.trim();
}

# 03: Cancelación de Reservas y Liberación de Horarios

**What to build:**
Operación de cancelación de reservas existentes. Cambia el estado a `CANCELLED`, preserva todos los datos históricos (ID, solicitante, equipo, fechas, timestamp de creación) en SQLite y libera de inmediato el intervalo para que vuelva a estar disponible para nuevas reservas.

**Blocked by:** 02: Creación de Reservas y Motor de Superposiciones

**Status:** ready-for-agent

- [ ] Operación de cancelación por ID de reserva con validación de existencia.
- [ ] Validación de estado: no permitir cancelar una reserva ya cancelada.
- [ ] Preservación intacta del registro histórico en SQLite (cambio exclusivo de estado a `CANCELLED`).
- [ ] Liberación instantánea del intervalo en el cálculo de disponibilidad.
- [ ] Pruebas automatizadas del ciclo de vida: crear -> cancelar -> verificar disponibilidad -> nueva reserva sobre el intervalo liberado.

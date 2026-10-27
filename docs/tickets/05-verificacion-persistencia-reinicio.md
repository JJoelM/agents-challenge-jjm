# 05: Verificación de Persistencia tras Reinicio y Scripts de Ciclo de Vida

**What to build:**
Comprobación de la durabilidad de los datos en SQLite ante detenciones y reinicios del sistema, tanto mediante prueba automatizada como mediante procedimiento manual reproducible. Script de reseteo limpio (`npm run db:reset`).

**Blocked by:** 03: Cancelación de Reservas y Liberación de Horarios

**Status:** completed

- [x] Script de inicialización y reseteo limpio de la base de datos (`npm run db:reset`).
- [x] Prueba automatizada de persistencia: inserción de reservas activas y canceladas -> cierre y reinicio de base de datos/instancia -> verificación de recuperación íntegra de estados e identificadores.
- [x] Guía paso a paso reproducible con comandos y resultados esperados/observados para comprobación manual humana.

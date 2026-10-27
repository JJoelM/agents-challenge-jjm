# 01: Setup del Proyecto, Catálogo de Inventario y Consulta de Disponibilidad

**What to build:**
Configuración inicial del entorno TypeScript/Node.js con Vitest y SQLite embebido. Definición del catálogo inmutable de inventario (`MIC-01`, `MIC-02`, `OSC-01`, `MUL-01`, `FUE-01`), servicio de consulta de disponibilidad por unidad e intervalo temporal $[inicio, fin)$, y pruebas unitarias automatizadas iniciales.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Configurar `package.json`, `tsconfig.json` y `vitest.config.ts`.
- [x] Implementar catálogo inmutable con los 5 equipos de laboratorio precargados.
- [x] Implementar inicialización de base de datos SQLite y tabla `reservations`.
- [x] Implementar servicio o función de consulta de disponibilidad por unidad e intervalo.
- [x] Implementar pruebas unitarias que verifiquen el inventario precargado y la disponibilidad en ausencia de reservas.

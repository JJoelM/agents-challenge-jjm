---
tags:
  - memory/decision
  - adr
title: "ADR-003: Persistencia SQLite Embebida"
status: accepted
date: 2026-10-27
---

# [[adr-003-sqlite|ADR-003: Persistencia SQLite Embebida]]

- **Estado:** Aceptado
- **Decisión:** Utilizar el motor SQLite nativo de Node.js (`node:sqlite` / `DatabaseSync`) persistiendo en `data/reservations.db` para ejecución normal y en `:memory:` o archivo temporal para suites de pruebas.
- **Motivo:** Asegura persistencia transaccional ACID en disco tras detener y reiniciar la aplicación, sin requerir motores externos (Docker/PostgreSQL) ni compilación de binarios nativos de C++ (`node-gyp`).
- **Consecuencias:** Se provee `npm run db:reset` (`src/scripts/reset-db.ts`) para limpiar explícitamente las reservas cuando se desee reiniciar los datos a cero.

Relacionado con: [[adrs]], [[index]].

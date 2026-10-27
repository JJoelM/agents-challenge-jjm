---
tags:
  - memory/decision
  - adr
title: "ADR-001: Stack TypeScript y Vitest"
status: accepted
date: 2026-10-27
---

# [[adr-001-stack|ADR-001: Stack TypeScript y Vitest]]

- **Estado:** Aceptado
- **Decisión:** Implementar el sistema en TypeScript (ES2022 / NodeNext) sobre Node.js LTS (v24) con `tsx` para ejecución directa y `vitest` para pruebas unitarias y de integración.
- **Motivo:** Garantiza seguridad de tipos en el modelo de dominio, cero fricción de compilación y ejecución determinista de pruebas en menos de 2 segundos.
- **Consecuencias:** Dependencias acotadas exclusivamente a `devDependencies` (`typescript`, `vitest`, `tsx`, `@types/node`). Cero dependencias de terceros en producción.

Relacionado con: [[adrs]], [[index]].

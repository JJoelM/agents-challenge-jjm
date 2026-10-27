---
tags:
  - memory/decision
  - adr
title: "ADR-005: Formato de Identificador Secuencial RES-xxx"
status: accepted
date: 2026-10-27
---

# [[adr-005-id-format|ADR-005: Formato de Identificador Secuencial RES-xxx]]

- **Estado:** Aceptado
- **Decisión:** Asignar identificadores correlativos legibles con formato `RES-001`, `RES-002`, `RES-003`, calculados de forma monótona creciente sobre el estado persistido en SQLite.
- **Motivo:** Facilita la trazabilidad visual en la interfaz web, en los logs de auditoría y en las aserciones de pruebas frente a UUIDs aleatorios.

Relacionado con: [[adrs]], [[domain-model]].

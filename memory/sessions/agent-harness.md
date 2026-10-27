---
tags:
  - memory/session
  - harness
title: "Configuración del Harness Gentle AI"
created: 2026-10-27
---

# [[agent-harness|Configuración del Harness Gentle AI]]

## Entorno y Modelo
- **Harness:** Google Antigravity Agent Harness + Configuración **Gentle AI** (`AGENTS.md`).
- **Modelos utilizados:**
  - Fase 1 (Setup, Grilling, Especificación y TICKET-01): Gemini 3.8 Flash (Medium).
  - Fase 2 (Orquestación de Subagentes y Desarrollo TICKET-02 a TICKET-06): Gemini 4 Argon (Medium).
- **Skills integradas:** 38 skills de `mattpocock/skills` en `.agents/skills` (ignoradas en Git mediante `.gitignore`).

## Adaptaciones Específicas Comprobables
1. **Validación estricta de fechas ISO 8601 sin rollover silencioso:** Implementada en `src/domain/reservation.ts` (`parseAndValidateIsoDate`) para impedir que fechas inexistentes como `2026-02-30T10:00` sean aceptadas por el motor `Date` de JavaScript.
2. **Carga de `node:sqlite` compatible con Vite/Vitest:** Uso de `createRequire(import.meta.url)('node:sqlite')` en `src/db/database.ts` para resolver el módulo nativo de Node.js v24 dentro del transformador SSR de Vitest sin dependencias externas.
3. **Intervalos semiabiertos $[inicio, fin)$ para turnos consecutivos:** Verificados mediante la invariante `startA < endB && endA > startB`.

Relacionado con: [[session-2026-10-27-01]], [[adrs]].

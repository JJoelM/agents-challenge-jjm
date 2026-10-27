---
tags:
  - decisions
  - architecture
title: "Decisiones de Arquitectura (ADRs)"
created: 2026-10-27
---

# [[adrs|Decisiones de Arquitectura]]

1. **[[adr-001-stack|ADR-001 - Lenguaje & Stack]]**: TypeScript + Node.js LTS + Vitest.
2. **[[adr-002-web-ui|ADR-002 - Interfaz]]**: Servidor local con API REST y Dashboard Web estático responsivo (HTML5/CSS/JS).
3. **[[adr-003-sqlite|ADR-003 - Persistencia]]**: SQLite embebido (`data/reservations.db`) con soporte ACID y supervivencia a reinicios.
4. **[[adr-004-time-policy|ADR-004 - Tiempos y Fechas]]**: Formato ISO 8601, hora local, duración de 15 min a 24 hs, determinismo para testing.
5. **[[adr-005-id-format|ADR-005 - Identificadores]]**: Códigos secuenciales legibles `RES-001`, `RES-002`.

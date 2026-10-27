---
tags:
  - memory/decision
  - adr
title: "ADR-004: Políticas de Fechas y Límites Temporales"
status: accepted
date: 2026-10-27
---

# [[adr-004-time-policy|ADR-004: Políticas de Fechas y Límites Temporales]]

- **Estado:** Aceptado
- **Decisión:**
  - Formato requerido: ISO 8601 (`YYYY-MM-DDTHH:mm` o con segundos/zona).
  - Zona horaria: Hora local del entorno de ejecución cuando no se especifica offset explícito.
  - Fechas pasadas: Permitidas para garantizar que los casos de prueba con fechas fijas (`2026-11-01`, etc.) sean 100% deterministas e independientes del reloj del día en que se evalúe el repositorio.
  - Límites de duración: Mínimo 15 minutos, máximo 24 horas continuas por reserva.
  - Validación de calendario: Verificación estricta contra desbordamiento silencioso de fechas inexistentes (ej. `2026-02-30`).
- **Motivo:** Evitar tests frágiles dependientes de `Date.now()` y garantizar coherencia cronológica.

Relacionado con: [[adrs]], [[domain-model]].

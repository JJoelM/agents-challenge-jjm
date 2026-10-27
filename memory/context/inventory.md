---
tags:
  - memory/context
  - inventory
title: "Inventario Precargado del Laboratorio"
created: 2026-10-27
---

# [[inventory|Inventario Precargado]]

El catálogo de unidades físicas está precargado en `src/domain/inventory.ts` y es de solo lectura:

| ID de Unidad | Equipo | Descripción |
| :--- | :--- | :--- |
| `MIC-01` | Microscopio digital | Microscopio digital - Unidad 1 |
| `MIC-02` | Microscopio digital | Microscopio digital - Unidad 2 |
| `OSC-01` | Osciloscopio | Osciloscopio digital de laboratorio |
| `MUL-01` | Multímetro | Multímetro de precisión |
| `FUE-01` | Fuente de alimentación | Fuente de alimentación regulable |

Cada ID identifica una unidad física distinta; `MIC-01` y `MIC-02` pueden reservarse simultáneamente en el mismo horario.

Relacionado con: [[domain-model]], [[project-context]].

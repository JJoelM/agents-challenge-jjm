---
tags:
  - memory/context
  - domain
title: "Modelo de Dominio y Glosario"
created: 2026-10-27
---

# [[domain-model|Modelo de Dominio]]

## Glosario Canónico (Ubiquitous Language)

- **[[inventory|EquipmentUnit (Unidad de Equipo)]]**: Unidad física individual del laboratorio identificada por un código inmutable (`MIC-01`, `MIC-02`, `OSC-01`, `MUL-01`, `FUE-01`).
- **TimeInterval (Intervalo Temporal)**: Rango semiabierto $[inicio, fin)$ expresado en formato ISO 8601 (`YYYY-MM-DDTHH:mm`). Cumple $inicio < fin$ y duración en $[15\text{ min}, 24\text{ h}]$.
- **Requester (Solicitante)**: Cadena no vacía (`trim().length > 0`) que identifica al solicitante ficticio de una reserva.
- **Reservation (Reserva)**: Entidad persistida con identificador correlativo (`RES-001`, `RES-002`, ...) que vincula una `EquipmentUnit`, un `Requester` y un `TimeInterval`.
- **ReservationStatus (Estado de Reserva)**:
  - `ACTIVE`: Ocupa el intervalo temporal de la unidad física e impide superposiciones.
  - `CANCELLED`: Libera el intervalo temporal de la unidad física pero conserva intacto su registro histórico e identificador.

## Regla de Superposición (Overlap) y Límites Consecutivos
Dos intervalos $[I_1, F_1)$ y $[I_2, F_2)$ se superponen si y solo si:
$$I_1 < F_2 \land F_1 > I_2$$
Cuando $F_1 = I_2$ (por ejemplo `10:00–11:00` y `11:00–12:00`), la condición $F_1 > I_2$ es falsa, permitiendo turnos consecutivos sin bloqueo.

Relacionado con: [[project-context]], [[adrs]].

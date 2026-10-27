# 02: Creación de Reservas y Motor de Superposiciones

**What to build:**
Flujo de creación de reservas persistidas en SQLite con identificador correlativo (`RES-001`, `RES-002`, ...). Validaciones estrictas de solicitante (no vacío ni espacios en blanco), formato de fechas ISO, duración entre 15 min y 24 h, y detección determinista de superposición para la misma unidad activa. Permitir turnos consecutivos contiguos e intervalos simultáneos en unidades distintas.

**Blocked by:** 01: Setup del Proyecto, Catálogo de Inventario y Consulta de Disponibilidad

**Status:** ready-for-agent

- [ ] Generador determinista de identificadores correlativos legibles `RES-001`.
- [ ] Validación de unidad existente en el inventario precargado.
- [ ] Validación de solicitante ficticio no vacío (`trim().length > 0`).
- [ ] Validación temporal: $inicio < fin$, duración mínima 15 min, máxima 24 horas.
- [ ] Detección y rechazo de solapamiento en reservas activas de la misma unidad.
- [ ] Permitir límites consecutivos adyacentes ($T_2.inicio == T_1.fin$).
- [ ] Permitir reservas simultáneas en unidades diferentes en la misma franja.
- [ ] Pruebas automatizadas completas de creación exitosa, rechazo de solapamiento y entradas inválidas.

# 04: Interfaz Web Local Liviana (Dashboard de Laboratorio)

**What to build:**
Servidor local en Node.js que expone la API REST JSON y sirve un frontend web responsivo y amigable (HTML5/CSS/JS) en `http://localhost:3000`. Permite visualizar el catálogo de equipos, consultar disponibilidad en tiempo real, agendar nuevas reservas mediante formulario con validaciones y feedback de error, y listar el historial de reservas con acción directa para cancelar reservas activas.

**Blocked by:** 03: Cancelación de Reservas y Liberación de Horarios

**Status:** completed

- [x] Endpoints REST en backend Node.js (`/api/inventory`, `/api/availability`, `/api/reservations`, `/api/reservations/:id/cancel`).
- [x] Frontend HTML5/CSS/JS moderno, limpio y reactivo servido estáticamente.
- [x] Panel de consulta de disponibilidad interactiva por fecha y equipo.
- [x] Formulario de creación de reservas con manejo visual de errores y confirmación.
- [x] Tabla/Lista histórica de reservas (activas y canceladas con etiquetas visuales y botón de cancelación inmediata).
- [x] Pruebas automatizadas de integración de los endpoints REST.

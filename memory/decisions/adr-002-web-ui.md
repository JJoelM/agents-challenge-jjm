---
tags:
  - memory/decision
  - adr
title: "ADR-002: Interfaz Web Liviana y API REST"
status: accepted
date: 2026-10-27
---

# [[adr-002-web-ui|ADR-002: Interfaz Web Liviana y API REST]]

- **Estado:** Aceptado
- **Decisión:** Exponer un servidor HTTP nativo (`node:http`) en `http://localhost:3000` que sirve endpoints JSON REST (`/api/inventory`, `/api/availability`, `/api/reservations`, `/api/reservations/:id/cancel`, `/api/admin/reset`) junto con un dashboard estático en HTML5, CSS y JS Vanilla (`src/public/`).
- **Motivo:** Satisface la preferencia del usuario por una interfaz visual tipo app web liviana sin introducir frameworks pesados de frontend ni pasos de empaquetado complejos.
- **Consecuencias:** Permite verificación tanto programática (vía `fetch` en pruebas de integración) como interactiva desde el navegador local.

Relacionado con: [[adrs]], [[index]].

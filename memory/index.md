---
tags:
  - moc
  - memory
title: "Sistema de Memoria del Proyecto - Laboratorio"
updated: 2026-10-27
---

# 🧠 Sistema de Memoria Local (Obsidian Vault)

Bienvenido al sistema de memoria del proyecto **Sistema de Reservas con Agentes**.
Este vault almacena el conocimiento persistente, decisiones arquitectónicas, modelos de dominio y trazabilidad de sesiones para los agentes de IA y los desarrolladores humanos.

## 🗺️ Mapa de Contenidos (MOC)

### 1. Contexto y Dominio
- [[project-context|Contexto del Proyecto]]: Objetivos, alcance y restricciones de `challenge-agents.pdf`.
- [[domain-model|Modelo de Dominio]]: Glosario de términos (`Reserva`, `Disponibilidad`, `Unidad de Equipo`, `Solicitante`).
- [[inventory|Inventario Precargado]]: Catálogo inmutable de unidades físicas de laboratorio.

### 2. Decisiones Arquitectónicas (ADRs)
- [[adr-001-stack|ADR-001: Stack TypeScript y Vitest]]
- [[adr-002-web-ui|ADR-002: Interfaz Web Liviana y API REST]]
- [[adr-003-sqlite|ADR-003: Persistencia SQLite Embebida]]
- [[adr-004-time-policy|ADR-004: Políticas de Fechas y Límites Temporales]]
- [[adr-005-id-format|ADR-005: Formato de Identificador Secuencial RES-xxx]]

### 3. Bitácora de Sesiones y Agentes
- [[session-2026-10-27-01|Sesión 01: Setup, Grilling y Definición]]
- [[agent-harness|Configuración del Harness Gentle AI]]: Directivas, permisos y límites.

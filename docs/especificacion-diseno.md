# Especificación de Requisitos, Modelo de Dominio y Decisiones de Diseño
**Proyecto:** Sistema de Reservas para Laboratorio con Agentes  
**Documento Consolidado:** `docs/especificacion-diseno.md`  
**Fuente Base:** `challenge-agents.pdf`  
**Fecha de Definición:** Octubre 2026  

---

## 1. Contexto y Necesidad de Negocio

La coordinación de un laboratorio gestiona el préstamo de equipos de precisión utilizando actualmente medios informales (mensajes de chat) y una planilla de cálculo manual. Esta dinámica provoca inconsistencias operativas frecuentes:
1. **Colisiones y superposiciones horarias:** Confirmación de una misma unidad física a diferentes solicitantes para horarios que se intersectan.
2. **Bloqueos residuales por cancelación:** Cuando una reserva se cancela informalmente, el espacio temporal sigue figurando ocupado o bloqueado.
3. **Pérdida de trazabilidad e histórico:** Imposibilidad de consultar el historial fidedigno de quién solicitó qué equipo, qué turnos se liberaron y los motivos de baja.

### 1.1 Objetivo del Sistema
Construir una solución local, verificable, autónoma y determinista que permita:
- Consultar disponibilidad por unidad e intervalo temporal.
- Registrar reservas asociadas a solicitantes ficticios identificables.
- Cancelar reservas liberando inmediatamente el intervalo sin perder el registro ni su identificador histórico.
- Persistir todas las reservas y estados de forma durable ante apagados o reinicios del servidor.
- Proveer una interfaz web local amigable y liviana, respaldada por pruebas automatizadas exhaustivas.

---

## 2. Inventario Precargado (Catálogo Fijo)

El laboratorio cuenta con un conjunto fijo de unidades físicas. Cada identificador representa un equipo físico único e independiente. El inventario es de solo lectura (no requiere operaciones de administración o modificación):

| ID de Unidad | Tipo de Equipo | Cantidad / Rol |
| :--- | :--- | :--- |
| `MIC-01` | Microscopio digital | Unidad física 1 |
| `MIC-02` | Microscopio digital | Unidad física 2 |
| `OSC-01` | Osciloscopio | Unidad física 1 |
| `MUL-01` | Multímetro | Unidad física 1 |
| `FUE-01` | Fuente de alimentación | Unidad física 1 |

---

## 3. Modelo de Dominio (Domain Model & Glosario)

### 3.1 Entidades y Conceptos de Dominio
- **Unidad de Equipo (`EquipmentUnit`):** Recurso físico identifiado por su código de inventario (`MIC-01` ... `FUE-01`).
- **Intervalo Temporal (`TimeInterval`):** Par ordenado de instantes `[inicio, fin)` que define el período solicitado. El intervalo es semiabierto por la derecha.
- **Solicitante (`Requester`):** Nombre o identificador de la persona ficticia que solicita la reserva. No puede ser una cadena vacía ni estar compuesta únicamente por espacios en blanco.
- **Reserva (`Reservation`):** Registro de asignación exclusiva de una unidad de equipo a un solicitante dentro de un intervalo temporal específico.
  - Atributos: `id`, `unit_id`, `requester`, `start_time`, `end_time`, `status`, `created_at`.
- **Estado de Reserva (`ReservationStatus`):**
  - `ACTIVE` (Activa): La reserva está confirmada y bloquea el intervalo de la unidad.
  - `CANCELLED` (Cancelada): La reserva fue dada de baja. Libera el intervalo temporal para nuevas reservas, pero conserva íntegramente todos sus datos históricos.
- **Disponibilidad (`Availability`):** Estado de una unidad en un intervalo dado donde no existen reservas en estado `ACTIVE` que se superpongan con dicho intervalo.

### 3.2 Invariantes y Reglas de Negocio
1. **Unicidad de unidad por reserva:** Cada reserva involucra exactamente una sola unidad física de equipo.
2. **Existencia en catálogo:** Toda reserva debe referenciar una unidad válida del inventario precargado.
3. **Validación de solicitante:** El solicitante no puede ser nulo, vacío ni contener únicamente caracteres de espacio (`trim(solicitante).length > 0`).
4. **Coherencia temporal:** Las fechas de inicio y fin deben ser válidas, con `inicio < fin`.
5. **Duración y límites:** Duración mínima de 15 minutos y máxima de 24 horas continuas.
6. **Detección de superposición (Overlap):**
   - Dos reservas para una misma unidad con intervalos $[I_1, F_1)$ y $[I_2, F_2)$ colisionan si y solo si:  
     $$\max(I_1, I_2) < \min(F_1, F_2)$$
     (Equivalente a: $I_1 < F_2 \land F_1 > I_2$).
   - Se debe rechazar toda reserva activa que colisione con otra reserva activa preexistente para la misma unidad.
7. **Adyacencia consecutiva permitida:**
   - Si una reserva termina a las `11:00`, otra reserva de la misma unidad puede comenzar a las `11:00` ($I_2 = F_1$). No existe conflicto en los límites exactos.
8. **Independencia entre unidades distintas:**
   - Unidades diferentes (`MIC-01` y `MIC-02`) pueden reservarse simultáneamente para el mismo intervalo sin interferencia.
9. **Efecto de la cancelación:**
   - Al cancelar una reserva, su estado pasa a `CANCELLED`.
   - Se libera el intervalo para nuevas reservas.
   - El registro **no se elimina** de la base de datos y conserva su ID y fecha de creación.

---

## 4. Registro de Decisiones de Arquitectura (ADR)

### ADR-001: Lenguaje de Programación y Entorno de Ejecución
- **Decisión:** Implementar la solución en **TypeScript** sobre **Node.js LTS (v24 / v22)**, utilizando **Vitest** como motor de pruebas unitarias y de integración.
- **Motivo:** Garantiza tipado estricto en los modelos de dominio, validaciones en tiempo de compilación y compatibilidad con las herramientas del ecosistema.
- **Consecuencias:** Configuración ligera con `package.json`, `tsx` para ejecución directa sin pasos de transpilación pesados y pruebas automáticas rápidas y declarativas.

### ADR-002: Tipo de Interfaz de Usuario
- **Decisión:** Interfaz web local liviana servida por Node.js (HTTP / Express) en `http://localhost:3000`, acompañada de endpoints REST estructurados en JSON.
- **Motivo:** Proporciona una experiencia visual amigable ("tipo app web") para consulta de disponibilidad, creación de reservas y cancelación en un click, cumpliendo a la vez con la restricción de reproducibilidad sin servicios externos complejos.
- **Consecuencias:** La aplicación se inicia con un único comando (`npm start` o `npm run dev`) y abre una interfaz responsiva en el navegador local.

### ADR-003: Persistencia de Datos
- **Decisión:** Base de datos relacional embebida **SQLite** (`data/reservations.db`), utilizando el módulo nativo `node:sqlite` de Node.js (o cliente ligero sin dependencias binarias pesadas).
- **Motivo:** Asegura persistencia confiable, soporte de transacciones ACID y consultas deterministas, garantizando que los datos sobrevivan a reinicios sin necesidad de instalar bases de datos cliente-servidor (PostgreSQL, MySQL o Docker).
- **Consecuencias:** Se dispondrá de un comando de reinicio/purga (`npm run db:reset`) para dejar la base en estado inicial cuando sea necesario para pruebas limpias.

### ADR-004: Políticas de Fechas, Zona Horaria y Límites
- **Decisión:** 
  - Formato de fecha y hora: ISO 8601 extendido (`YYYY-MM-DDTHH:mm`).
  - Zona horaria: Local del sistema de ejecución.
  - Fechas pasadas: Se admiten fechas en cualquier punto temporal sintácticamente válido para permitir que los datasets de pruebas automatizadas sean 100% deterministas e independientes del reloj del sistema.
  - Duración: Mínimo 15 minutos, máximo 24 horas por reserva.
- **Motivo:** Robustez y determinismo en suites de test de integración.
- **Consecuencias:** Las validaciones de negocio aplicarán estas reglas de forma uniforme tanto en la API como en la UI.

### ADR-005: Formato de Identificador de Reserva
- **Decisión:** Identificador alfanumérico secuencial y legible (`RES-001`, `RES-002`, ...).
- **Motivo:** Facilita la legibilidad para el usuario en la interfaz web, en reportes y en las aserciones de pruebas automatizadas, en comparación con UUIDs extensos.
- **Consecuencias:** La base de datos mantendrá una secuencia o autoincremento para generar el código correlativo de manera determinista.

---

## 5. Diseño de Datos y Esquema SQLite

### Tabla: `reservations`
```sql
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,                       -- Ej: 'RES-001'
  unit_id TEXT NOT NULL,                     -- Ej: 'MIC-01'
  requester TEXT NOT NULL,                   -- Ej: 'Dra. García'
  start_time TEXT NOT NULL,                  -- ISO 8601 string: '2026-10-27T10:00'
  end_time TEXT NOT NULL,                    -- ISO 8601 string: '2026-10-27T11:00'
  status TEXT NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE' | 'CANCELLED'
  created_at TEXT NOT NULL                   -- ISO 8601 string
);

CREATE INDEX IF NOT EXISTS idx_reservations_unit_status ON reservations (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_interval ON reservations (start_time, end_time);
```

---

## 6. Endpoints de la API Local

| Método | Endpoint | Descripción | Body / Parámetros |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/inventory` | Obtiene el catálogo precargado de equipos | Ninguno |
| `GET` | `/api/availability` | Consulta disponibilidad de una unidad en un intervalo | Query: `unitId`, `start`, `end` |
| `GET` | `/api/reservations` | Lista todas las reservas (activas y canceladas) | Query opcional: `unitId`, `status` |
| `POST` | `/api/reservations` | Crea una nueva reserva si no hay superposición | JSON: `{ unitId, requester, start, end }` |
| `POST` | `/api/reservations/:id/cancel` | Cancela una reserva existente y libera el horario | Parámetro URL: `id` |
| `POST` | `/api/admin/reset` | Reinicia la base de datos a su estado inicial limpio | Ninguno (solo para testing/reinicio) |

---

## 7. Plan de Verificación y Pruebas Automatizadas

De acuerdo a los requisitos del desafío, se implementará una suite de pruebas con **Vitest**:

1. **Test 1 - Creación válida:** Creación exitosa de una reserva con datos válidos; verificación del estado `ACTIVE`.
2. **Test 2 - Rechazo de superposición idéntica y parcial:** Rechazo de reservas que solapan total o parcialmente un intervalo activo para la misma unidad.
3. **Test 3 - Límites consecutivos contiguos:** Creación permitida de una reserva $[11:00, 12:00)$ inmediatamente posterior a $[10:00, 11:00)$ para la misma unidad.
4. **Test 4 - Unidades distintas simultáneas:** Creación permitida de reservas para el mismo intervalo horario en unidades diferentes (`MIC-01` y `MIC-02`).
5. **Test 5 - Validación de entradas inválidas:** 
   - Unidad desconocida (ej. `XYZ-99`).
   - Solicitante vacío o de puros espacios (`"   "`).
   - Cronología invertida (`inicio >= fin`).
   - Duración inferior a 15 minutos.
6. **Test 6 - Cancelación y liberación:** Cancelar una reserva activa, verificar que pasa a `CANCELLED`, que sus datos persisten y que el intervalo queda inmediatamente disponible para una nueva reserva.
7. **Test 7 - Persistencia tras reinicio:** 
   - Crear reservas activas y canceladas.
   - Cerrar la conexión a la base de datos / simular reinicio de la aplicación.
   - Reabrir y verificar que todas las reservas activas y canceladas conservan exactamente sus estados y datos.

---

## 8. Registro de Preparación del Agente y Episodios de Delegación

### 8.1 Harness y Configuración del Agente
- **Entorno / Harness:** Google Antigravity Coding Agent Harness gobernado por el **Harness de Gentle AI** ([`AGENTS.md`](../AGENTS.md)).
- **Identificadores de Modelos:**
  - `Gemini 3.8 Flash (Medium)`: Fase inicial (instalación de skills, sesiones de `/grill-me`, `/grill-with-docs`, especificación, bóveda Obsidian, `/to-tickets` y scaffolding `TICKET-01`).
  - `Gemini 4 Argon (Medium)`: Fase de orquestación multi-agente e implementación TDD (`TICKET-02` a `TICKET-06`).
- **Herramientas permitidas:** Edición y lectura de archivos de workspace, terminal PowerShell local (`run_command`), interacción guiada con el usuario y delegación en subagentes (`domain-tdd-agent`, `web-fullstack-agent`, `docs-memory-agent`).
- **Contexto suministrado:** Consigna oficial `challenge-agents.pdf`, `AGENTS.md`, `memory/index.md` y repositorio local.
- **Exclusiones:** Sin acceso a servicios pagos externos, sin credenciales ni datos personales reales; directorio `.agents/` y `skills-lock.json` excluidos en `.gitignore`.

### 8.2 Episodios Reales de Delegación

#### Episodio 1: Especificación, Modelo de Dominio y Desglose en Tickets (`/grill-me`, `/grill-with-docs`, `/to-tickets`)
- **Objetivo y requisito:** Extraer requisitos de `challenge-agents.pdf`, definir glosario del dominio, resolver disyuntivas técnicas (ADRs 001–005), configurar `.gitignore` y desglosar en tickets incrementales.
- **Contexto suministrado e instrucción:** Conexión con skills `grill-me`, `grill-with-docs` y `to-tickets` sobre `challenge-agents.pdf`; solicitud de consolidar especificación, bóveda Obsidian y plan de tickets.
- **Acción/resultado del agente:** Instaló el catálogo de skills de `mattpocock/skills`, configuró `.gitignore` ignorando `.agents/` y `skills-lock.json`, formuló preguntas interactivas paso a paso para resolver las disyuntivas arquitectónicas, redactó `docs/especificacion-diseno.md`, inicializó `memory/` y creó los 6 tickets en `docs/tickets/`.
- **Decisión humana:** Aprobación de las decisiones: TypeScript/Node.js + Vitest, SQLite embebido (`node:sqlite`), interfaz web local liviana, fechas ISO libres de reloj actual para determinismo de pruebas y formato secuencial `RES-xxx`.
- **Evidencia verificable:** [`docs/especificacion-diseno.md`](especificacion-diseno.md), [`docs/tickets/index.md`](tickets/index.md), [`AGENTS.md`](../AGENTS.md) y [`.gitignore`](../.gitignore).

#### Episodio 2: Delegación en `domain-tdd-agent` para Reglas de Dominio, Superposiciones, Cancelación y Persistencia (`TICKET-02`, `TICKET-03`, `TICKET-05`)
- **Objetivo y requisito:** Implementar bajo TDD estricto las validaciones de dominio, la lógica de intervalos semiabiertos $[inicio, fin)$, la creación/cancelación en `ReservationService` sobre SQLite y la prueba de persistencia tras cerrar y reabrir la base de datos.
- **Contexto suministrado e instrucción:** Especificación de dominio (`docs/especificacion-diseno.md`), `src/domain/*`, `src/db/database.ts` e instrucción de implementar `src/services/reservation-service.ts`, `src/scripts/reset-db.ts` y las suites `tests/reservation-creation.test.ts`, `tests/reservation-cancellation.test.ts` y `tests/persistence-restart.test.ts` sin ejecutar comandos git.
- **Acción/resultado del agente:** Implementó `ReservationService`, agregó validación estricta de fechas calendario inexistentes (`2026-02-30`) en `src/domain/reservation.ts`, el script `src/scripts/reset-db.ts` y 20 tests automatizados en Vitest.
- **Decisión humana / del arquitecto:** Se aceptó la implementación y se aplicó un refinamiento en `src/services/reservation-service.ts` para normalizar con `.trim()` las cadenas `startTime` y `endTime` antes de persistirlas en SQLite, evitando que espacios periféricos queden grabados en disco.
- **Evidencia verificable:** [`src/domain/reservation.ts`](../src/domain/reservation.ts), [`src/services/reservation-service.ts`](../src/services/reservation-service.ts), [`tests/reservation-creation.test.ts`](../tests/reservation-creation.test.ts), [`tests/reservation-cancellation.test.ts`](../tests/reservation-cancellation.test.ts) y [`tests/persistence-restart.test.ts`](../tests/persistence-restart.test.ts).

#### Episodio 3: Delegación en `web-fullstack-agent` para Servidor HTTP REST e Interfaz Web Local (`TICKET-04`)
- **Objetivo y requisito:** Construir el servidor HTTP nativo (`src/app.ts` y `src/server.ts`), exponer los endpoints REST de inventario, disponibilidad, reservas, cancelación y reinicio, crear la UI web en `src/public/` y verificar mediante pruebas de integración HTTP (`tests/api-server.test.ts`).
- **Contexto suministrado e instrucción:** Tabla de endpoints de la Sección 6 de `docs/especificacion-diseno.md` y contrato de `ReservationService`.
- **Acción/resultado del agente:** Implementó `src/app.ts`, `src/server.ts`, `src/public/index.html`, `src/public/styles.css`, `src/public/app.js` y 6 tests de integración HTTP en `tests/api-server.test.ts`.
- **Decisión humana / del arquitecto:** Se aceptó la solución validando que `POST /api/reservations` y `GET /api/availability` admitan tanto `{ startTime, endTime }` como el alias `{ start, end }`, garantizando compatibilidad total entre la especificación inicial, la UI y los clientes HTTP.
- **Evidencia verificable:** [`src/app.ts`](../src/app.ts), [`src/server.ts`](../src/server.ts), [`src/public/index.html`](../src/public/index.html) y [`tests/api-server.test.ts`](../tests/api-server.test.ts).

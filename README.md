# Sistema de Reservas para Equipamiento de Laboratorio

Sistema local, determinista y autónomo para la gestión de reservas de unidades físicas de laboratorio (`MIC-01`, `MIC-02`, `OSC-01`, `MUL-01`, `FUE-01`), desarrollado aplicando **Organic-Driven / Spec-Driven Development (ODD/SDD)** y **Test-Driven Development (TDD)** bajo el **Harness de Gentle AI** ([`AGENTS.md`](AGENTS.md)).

---

## 1. Especificación breve

### 1.1 Problema y contexto de negocio
La coordinación de un laboratorio gestionaba los préstamos de equipamiento de precisión mediante mensajes informales y una planilla manual, provocando tres fallas operativas críticas:
1. **Superposiciones horarias:** Asignación accidental de la misma unidad física a distintos investigadores en horarios superpuestos.
2. **Bloqueos residuales tras cancelación:** Al darse de baja una reserva de forma informal, el turno seguía figurando bloqueado o se perdía visibilidad de su disponibilidad real.
3. **Falta de trazabilidad histórica:** Eliminación o sobrescritura de registros que impedía auditar qué reservas existieron, quién las solicitó y cuáles fueron canceladas.

Este sistema resuelve el problema proporcionando validación estricta de intervalos temporales, control de disponibilidad por unidad física individual, cancelación con liberación inmediata del horario conservando el historial íntegro, y persistencia durable en disco mediante SQLite.

### 1.2 Alcance y fuera de alcance
- **Dentro del alcance:**
  - Catálogo fijo e inmutable de 5 unidades físicas precargadas (`MIC-01`, `MIC-02`, `OSC-01`, `MUL-01`, `FUE-01`).
  - Consulta de disponibilidad por unidad e intervalo temporal $[inicio, fin)$.
  - Creación de reservas asociadas a un solicitante, una unidad y un intervalo de tiempo válido.
  - Detección y rechazo de superposiciones horarias sobre la misma unidad física.
  - Cancelación de reservas activas liberando el intervalo para futuras reservas sin borrar el registro histórico (`status = 'CANCELLED'`).
  - Persistencia local en archivo SQLite (`data/reservations.db`) resistente a paradas y reinicios del proceso.
  - Interfaz Web Local liviana (`http://localhost:3000`) y API HTTP REST JSON.
  - Suite automatizada de pruebas unitarias, de integración y de persistencia tras reinicio.
- **Fuera de alcance (por diseño y consigna):**
  - Autenticación de usuarios, roles, permisos o sesiones.
  - Alta, baja o modificación dinámica del catálogo de equipos de laboratorio.
  - Notificaciones por correo electrónico, mensajería externa o pasarelas de pago.
  - Reservas recurrentes automáticas o reservas multi-unidad en una sola transacción.

### 1.3 Requisitos verificables, reglas de negocio y supuestos
1. **Unicidad de unidad por reserva:** Cada reserva se asocia exactamente a una unidad existente en el catálogo precargado (`MIC-01`, `MIC-02`, `OSC-01`, `MUL-01`, `FUE-01`). Cualquier código fuera del catálogo es rechazado.
2. **Validación de solicitante:** El campo `requester` es obligatorio, no puede ser vacío ni contener únicamente espacios en blanco (`trim().length > 0`), y se normaliza recortando espacios extremos.
3. **Semántica de intervalo semiabierto $[inicio, fin)$:**
   - Todo intervalo se interpreta como cerrado al inicio y abierto al final: $[I, F)$.
   - Dos intervalos $[I_1, F_1)$ y $[I_2, F_2)$ para la misma unidad **se superponen** si y solo si:
     $$I_1 < F_2 \land F_1 > I_2$$
   - **Límites consecutivos permitidos:** Si una reserva finaliza exactamente cuando comienza la siguiente ($F_1 = I_2$, por ejemplo `10:00–11:00` y `11:00–12:00`), **no hay superposición** y ambas reservas son válidas.
4. **Independencia entre unidades físicas:** Las reservas sobre unidades distintas (ej. `MIC-01` y `MIC-02`) son completamente independientes y pueden compartir el mismo horario sin conflicto.
5. **Política de fechas, formato y límites de duración (Supuestos explícitos):**
   - **Formato:** Cadenas ISO 8601 (`YYYY-MM-DDTHH:mm`), interpretadas en la zona horaria local del entorno de ejecución.
   - **Validación estricta de calendario:** Se rechazan fechas calendario inexistentes (como `2026-02-30T10:00`) evitando el desbordamiento silencioso (*rollover*) nativo de `Date` en JavaScript.
   - **Orden temporal y duración:** Debe cumplirse estrictamente `inicio < fin`, con una **duración mínima de 15 minutos** y una **duración máxima de 24 horas**.
   - **Admisión de cualquier fecha válida (pasada o futura):** Para garantizar que las suites de pruebas automatizadas y las demostraciones sean **100% deterministas y reproducibles** sin depender del reloj del sistema en el día de evaluación, se permite registrar reservas en cualquier fecha calendario válida.
6. **Cancelación no destructiva:**
   - Solo pueden cancelarse reservas existentes en estado `ACTIVE`. Intentar cancelar una reserva inexistente o ya `CANCELLED` produce un error explícito.
   - Al cancelar, el estado cambia a `CANCELLED`, el horario queda inmediatamente libre para nuevas reservas en esa misma unidad, y el registro original se conserva en la base de datos y en los listados históricos.

### 1.4 Criterios de aceptación verificables
| ID | Criterio de aceptación | Verificación automatizada |
| :--- | :--- | :--- |
| **CA-01** | Carga el inventario fijo de 5 unidades (`MIC-01` a `FUE-01`) y rechaza unidades desconocidas (`XYZ-99`). | [`tests/inventory-and-availability.test.ts`](tests/inventory-and-availability.test.ts) |
| **CA-02** | Crea una reserva válida asignando ID secuencial (`RES-001`) y estado `ACTIVE`. | [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts) |
| **CA-03** | Rechaza superposiciones totales, parciales o envolventes sobre la misma unidad activa. | [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts) |
| **CA-04** | Permite reservas con límites consecutivos contiguos (`10:00–11:00` y `11:00–12:00`) en la misma unidad. | [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts) |
| **CA-05** | Permite reservas simultáneas en el mismo horario sobre unidades distintas (`MIC-01` y `MIC-02`). | [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts) |
| **CA-06** | Rechaza solicitantes vacíos, fechas inválidas (`2026-02-30`), `inicio >= fin` y duraciones fuera de `[15m, 24h]`. | [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts) |
| **CA-07** | Cancela una reserva activa liberando el horario para una nueva reserva y preserva el registro `CANCELLED`. | [`tests/reservation-cancellation.test.ts`](tests/reservation-cancellation.test.ts) |
| **CA-08** | Conserva reservas activas y canceladas tras cerrar la base de datos/servidor y volver a iniciar. | [`tests/persistence-restart.test.ts`](tests/persistence-restart.test.ts) |
| **CA-09** | Expone interfaz web local y API REST funcional para todas las operaciones requeridas. | [`tests/api-server.test.ts`](tests/api-server.test.ts) |

---

## 2. Solución

### 2.1 Estructura del repositorio
```text
.
├── AGENTS.md                         # Directivas del Harness de Gentle AI (ODD, TDD, ramas y memoria)
├── README.md                         # Documentación principal y trazabilidad de evaluación
├── challenge-agents.pdf              # Consigna oficial del desafío
├── package.json                      # Scripts y dependencias de desarrollo (TypeScript, Vitest, tsx)
├── tsconfig.json                     # Configuración de TypeScript estricto (NodeNext / ES2022)
├── docs/
│   ├── especificacion-diseno.md      # Especificación consolidada, modelo de dominio y ADRs
│   ├── progreso.md                   # Bitácora de avance de hitos del proyecto
│   └── tickets/                      # Desglose incremental en 6 rebanadas verticales (TICKET-01 a 06)
├── memory/                           # Bóveda local de Obsidian (MOC, contexto, ADRs, sesiones)
├── src/
│   ├── index.ts                      # Punto de entrada programático (exporta dominio, DB, servicio y app)
│   ├── server.ts                     # Servidor HTTP ejecutable en http://localhost:3000
│   ├── app.ts                        # Enrutador HTTP nativo (API REST + archivos estáticos)
│   ├── domain/
│   │   ├── inventory.ts              # Catálogo inmutable de las 5 unidades de laboratorio
│   │   └── reservation.ts            # Entidades, validaciones ISO/calendario y lógica de overlap
│   ├── db/
│   │   └── database.ts               # Wrapper sobre node:sqlite con inicialización automática de esquema
│   ├── services/
│   │   └── reservation-service.ts    # Casos de uso: disponibilidad, creación, cancelación, listado y reset
│   ├── public/                       # Interfaz Web Local (index.html, styles.css, app.js)
│   └── scripts/
│       └── reset-db.ts               # Script CLI para purgar y reiniciar data/reservations.db
└── tests/                            # 5 suites automatizadas con 33 tests en Vitest
    ├── inventory-and-availability.test.ts
    ├── reservation-creation.test.ts
    ├── reservation-cancellation.test.ts
    ├── api-server.test.ts
    └── persistence-restart.test.ts
```

### 2.2 Decisiones técnicas, requisitos previos y versiones
- **Lenguaje y Runtime:** TypeScript `^5.7.2` ejecutado sobre **Node.js `v24.14.0`** (compatible con Node.js `>= 22.5.0`, que incluye el módulo nativo `node:sqlite`).
- **Cero dependencias externas de producción:** El servidor HTTP utiliza `node:http` nativo, la persistencia utiliza `node:sqlite` (`DatabaseSync`) nativo y el frontend está construido en HTML5, CSS3 y JavaScript Vanilla. Esto elimina fallos de compilación nativa (`node-gyp`) y garantiza portabilidad inmediata.
- **Motor de pruebas y ejecución:** **Vitest `^5.0.5`** para pruebas automatizadas y **tsx `^4.19.2`** para ejecución directa de TypeScript.

### 2.3 Instalación, carga inicial, persistencia y reinicio de datos

1. **Instalación de dependencias:**
   ```bash
   npm install
   ```
2. **Carga inicial del inventario:**
   No requiere ejecutar seeds manuales. Al iniciar el servicio o el servidor, el catálogo fijo de 5 unidades (`MIC-01`, `MIC-02`, `OSC-01`, `MUL-01`, `FUE-01`) se carga automáticamente en memoria de solo lectura desde [`src/domain/inventory.ts`](src/domain/inventory.ts), y la tabla `reservations` junto con sus índices se crean automáticamente en SQLite (`CREATE TABLE IF NOT EXISTS`).
3. **Ubicación de los datos persistidos:**
   Por defecto, todas las reservas se almacenan en el archivo local:
   ```text
   data/reservations.db
   ```
   *(Puede personalizarse mediante la variable de entorno `DB_PATH`).*
4. **Reinicio de datos a estado limpio:**
   Para vaciar todas las reservas y devolver la base de datos a su estado inicial limpio, ejecute:
   ```bash
   npm run db:reset
   ```
   *(Alternativamente, con el servidor en marcha, puede enviarse `POST http://localhost:3000/api/admin/reset` o pulsar el botón **"Reiniciar BD"** en la interfaz web).*
   > **⚠️ Advertencia sobre pérdida de datos:** Ejecutar `npm run db:reset` o `POST /api/admin/reset` **elimina de forma permanente todas las reservas activas y canceladas** almacenadas previamente en `data/reservations.db`. El inventario fijo de unidades permanece intacto.

### 2.4 Comandos para ejecutar la aplicación y las pruebas
- **Ejecutar todas las pruebas automatizadas:**
  ```bash
  npm test
  ```
- **Verificar tipos estáticos con TypeScript:**
  ```bash
  npx tsc --noEmit
  ```
- **Iniciar el servidor y la interfaz web local:**
  ```bash
  npm start
  ```
  *(O `npm run dev` en modo recarga automática).* Una vez iniciado, abrir **`http://localhost:3000`** en el navegador.

### 2.5 Ejemplo concreto de entrada y salida (API REST)

#### A) Crear una reserva válida (`POST /api/reservations`)
- **Entrada:**
  ```json
  {
    "unitId": "MIC-01",
    "requester": "Dra. Ana Gómez",
    "startTime": "2026-11-10T10:00",
    "endTime": "2026-11-10T11:00"
  }
  ```
- **Salida (`201 Created`):**
  ```json
  {
    "reservation": {
      "id": "RES-001",
      "unitId": "MIC-01",
      "requester": "Dra. Ana Gómez",
      "startTime": "2026-11-10T10:00",
      "endTime": "2026-11-10T11:00",
      "status": "ACTIVE",
      "createdAt": "2026-10-27T20:15:00.000Z"
    }
  }
  ```

#### B) Rechazo por superposición horaria (`POST /api/reservations`)
- **Entrada (solapa de `10:30` a `11:30` en `MIC-01`):**
  ```json
  {
    "unitId": "MIC-01",
    "requester": "Dr. Carlos Ruiz",
    "startTime": "2026-11-10T10:30",
    "endTime": "2026-11-10T11:30"
  }
  ```
- **Salida (`409 Conflict`):**
  ```json
  {
    "error": "Superposición con la reserva activa RES-001 (2026-11-10T10:00 a 2026-11-10T11:00)."
  }
  ```

#### C) Reserva consecutiva en límite exacto (`POST /api/reservations`)
- **Entrada (comienza a las `11:00`, justo cuando termina `RES-001`):**
  ```json
  {
    "unitId": "MIC-01",
    "requester": "Dr. Carlos Ruiz",
    "startTime": "2026-11-10T11:00",
    "endTime": "2026-11-10T12:00"
  }
  ```
- **Salida (`201 Created`):** Se crea exitosamente `RES-002` con `status: "ACTIVE"`.

#### D) Consultar disponibilidad (`GET /api/availability?unitId=MIC-01&start=2026-11-10T10:00&end=2026-11-10T11:00`)
- **Salida (`200 OK`):**
  ```json
  {
    "available": false,
    "unitId": "MIC-01",
    "startTime": "2026-11-10T10:00",
    "endTime": "2026-11-10T11:00",
    "reason": "Superposición con la reserva activa RES-001 (2026-11-10T10:00 a 2026-11-10T11:00).",
    "conflictingReservation": {
      "id": "RES-001",
      "unitId": "MIC-01",
      "requester": "Dra. Ana Gómez",
      "startTime": "2026-11-10T10:00",
      "endTime": "2026-11-10T11:00",
      "status": "ACTIVE",
      "createdAt": "2026-10-27T20:15:00.000Z"
    }
  }
  ```

#### E) Cancelar una reserva y conservar historial (`POST /api/reservations/RES-001/cancel`)
- **Salida (`200 OK`):**
  ```json
  {
    "reservation": {
      "id": "RES-001",
      "unitId": "MIC-01",
      "requester": "Dra. Ana Gómez",
      "startTime": "2026-11-10T10:00",
      "endTime": "2026-11-10T11:00",
      "status": "CANCELLED",
      "createdAt": "2026-10-27T20:15:00.000Z"
    }
  }
  ```

### 2.6 Verificación reproducible de persistencia tras detener y reiniciar
La persistencia ante parada y reinicio puede comprobarse de dos maneras:

1. **Verificación automatizada en suite de pruebas:**
   El archivo [`tests/persistence-restart.test.ts`](tests/persistence-restart.test.ts) crea un archivo físico SQLite temporal en disco, instancia `Database` y `ReservationService`, registra reservas (`RES-001` activa y `RES-002` posteriormente cancelada), invoca `db1.close()` para cerrar completamente la conexión simulando el apagado del proceso, abre una nueva instancia `db2 = createDatabase(tempDbPath)` con un nuevo `ReservationService(db2)` y verifica que:
   - `RES-001` sigue `ACTIVE` y rechaza superposiciones.
   - `RES-002` sigue presente en el historial con estado `CANCELLED` y su intervalo está disponible.
   - Una nueva reserva posterior recibe el identificador correlativo `RES-003`.

2. **Verificación manual paso a paso:**
   ```bash
   # Paso 1: Reiniciar la base de datos a un estado limpio
   npm run db:reset

   # Paso 2: Iniciar el servidor en una terminal
   npm start

   # Paso 3: En otra terminal, crear RES-001 (MIC-01) y RES-002 (OSC-01) y cancelar RES-002
   curl -X POST http://localhost:3000/api/reservations \
     -H "Content-Type: application/json" \
     -d '{"unitId":"MIC-01","requester":"Dra. Ana Gómez","startTime":"2026-11-10T10:00","endTime":"2026-11-10T11:00"}'

   curl -X POST http://localhost:3000/api/reservations \
     -H "Content-Type: application/json" \
     -d '{"unitId":"OSC-01","requester":"Lab. Biofísica","startTime":"2026-11-10T14:00","endTime":"2026-11-10T16:00"}'

   curl -X POST http://localhost:3000/api/reservations/RES-002/cancel

   # Paso 4: Detener el servidor (Ctrl+C en la primera terminal) y volver a iniciarlo
   npm start

   # Paso 5: Consultar todas las reservas tras el reinicio
   curl http://localhost:3000/api/reservations
   ```
   **Resultado esperado y comprobado:** El endpoint `GET /api/reservations` tras el reinicio devuelve intactas tanto `RES-001` (`status: "ACTIVE"`) como `RES-002` (`status: "CANCELLED"`), leyendo los datos desde `data/reservations.db`.

### 2.7 Distinción entre lo informado por agentes y las comprobaciones realmente ejecutadas
Siguiendo las buenas prácticas de ingeniería asistida por agentes, ningún resultado reportado por un subagente se dio por válido sin antes ejecutar las comprobaciones reales en la terminal del entorno local:

| Comprobación | Reportado por Subagentes | Ejecutado y Verificado Realmente en Entorno Local |
| :--- | :--- | :--- |
| **Entorno Node.js** | Compatible con `node:sqlite` | Ejecutado `node -v` -> **`v24.14.0`** (Windows PowerShell) |
| **Chequeo de tipos TypeScript** | Sin errores de compilación | Ejecutado `npx tsc --noEmit` -> **Exit Code 0 (0 errores)** |
| **Suite de pruebas Vitest** | Suites unitarias, API y persistencia en verde | Ejecutado `npm test` (`vitest run v5.0.5`) -> **5 Test Files passed (5), 33 Tests passed (33), 0 failed** |
| **Script de reinicio de BD** | Reinicia `data/reservations.db` | Ejecutado `npm run db:reset` -> Base `data/reservations.db` inicializada y limpia con 0 reservas |

### 2.8 Pendientes y limitaciones conocidas
- **Concurrencia multi-proceso:** Al emplear SQLite embebido con operaciones síncronas (`DatabaseSync`), la solución está diseñada para un único proceso servidor local; no está pensada para despliegues distribuidos multi-nodo.
- **Zona horaria única:** Las fechas ISO sin sufijo de zona se evalúan en la hora local del servidor donde corre Node.js.
- **Sin autenticación real:** Los solicitantes se ingresan como texto libre según lo indicado en la consigna (datos ficticios).

---

## 3. Preparación del agente

### 3.1 Entorno / Harness y Modelos utilizados
- **Harness de ejecución:** **Google Antigravity Coding Agent Harness**, gobernado por las reglas de arquitectura y operación definidas en [`AGENTS.md`](AGENTS.md) (**Gentle AI Agent Harness**).
- **Modelos utilizados:**
  1. **`Gemini 3.8 Flash (Medium)`:** Utilizado en la etapa fundacional para la instalación del catálogo de skills, la entrevista interactiva de requisitos (`/grill-me` y `/grill-with-docs`), la redacción de [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md), el diseño de [`AGENTS.md`](AGENTS.md), la creación de la bóveda de memoria Obsidian ([`memory/index.md`](memory/index.md)), el desglose de tickets (`/to-tickets`) y el scaffolding inicial (`TICKET-01`).
  2. **`Gemini 4 Argon (Medium)`:** Utilizado como arquitecto orquestador y modelo de los subagentes especializados (`domain-tdd-agent`, `web-fullstack-agent`, `docs-memory-agent`) para completar la implementación TDD, la interfaz web, las pruebas de persistencia y la documentación trazable (`TICKET-02` a `TICKET-06`).

### 3.2 Instrucciones, configuraciones y skills utilizadas
- **Directivas de [`AGENTS.md`](AGENTS.md):** Estableció los principios de *Simplicidad Radical* (cero dependencias innecesarias), *Rebanadas Verticales (Tracer Bullets)*, *Determinismo y Verificabilidad* (`npm test` obligatorio antes de cerrar cualquier tarea) y *Memoria Continua* en `memory/`.
- **Skills utilizadas (`mattpocock/skills`):** Se instalaron las skills en `.agents/skills/` y se excluyeron deliberadamente del repositorio entregable en [`.gitignore`](.gitignore) (`/.agents/` y `/skills-lock.json`) para no contaminar el árbol de código con herramientas locales del asistente. Las skills clave aplicadas fueron:
  - **`grilling` (`/grill-me` y `/grill-with-docs`):** Cuestionamiento sistemático de la consigna `challenge-agents.pdf` para despejar ambigüedades (stack, UI, persistencia, política de fechas y formato de IDs) antes de escribir código.
  - **`domain-modeling`:** Construcción del glosario de dominio (`EquipmentUnit`, `TimeInterval`, `Requester`, `Reservation`, `ReservationStatus`) y los 5 ADRs en [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md).
  - **`tdd`:** Ciclo estricto *Red-Green-Refactor* en los 5 archivos de pruebas de [`tests/`](tests/).
  - **Desglose en tickets (`/to-tickets`):** Partición del trabajo en 6 tickets incrementales alojados en [`docs/tickets/`](docs/tickets/).

### 3.3 Contexto suministrado y exclusiones
- **Contexto suministrado:** El documento oficial [`challenge-agents.pdf`](challenge-agents.pdf), las respuestas del usuario durante la sesión de *grilling*, el archivo [`AGENTS.md`](AGENTS.md), la especificación [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md) y el índice de memoria [`memory/index.md`](memory/index.md).
- **Exclusiones explícitas:**
  - Ningún secreto, token, clave de API ni dato personal real fue suministrado ni almacenado (todos los ejemplos y pruebas usan nombres ficticios como `"Dra. Ana Gómez"` o `"Lab. Biofísica"`).
  - Se excluyeron del control de versiones (`git`) los directorios `.agents/`, `skills-lock.json`, `node_modules/`, `dist/` y los archivos binarios de base de datos (`data/*.db`), como puede verificarse en [`.gitignore`](.gitignore).

### 3.4 Herramientas, permisos y controles humanos
- **Herramientas habilitadas:** Lectura y edición de archivos dentro del workspace, ejecución de comandos en terminal PowerShell local (`run_command`), preguntas interactivas al usuario y delegación en subagentes mediante `spawn_agent` / `send_message`.
- **Controles y barreras humanas aplicadas:**
  1. **Aprobación humana de ADRs:** Antes de generar código, el usuario revisó y eligió explícitamente las opciones de los 5 ADRs durante la sesión de *grilling*.
  2. **Aprobación del plan de tickets:** El desglose de [`docs/tickets/index.md`](docs/tickets/index.md) fue validado antes de iniciar la ejecución multi-agente.
  3. **Restricción de operaciones Git en subagentes:** Los subagentes tuvieron prohibido ejecutar comandos `git` (`commit`, `branch`, `merge`, `push`) para evitar conflictos de concurrencia en el árbol de trabajo; solo el agente orquestador principal verificó las pruebas y consolidó los cambios.

### 3.5 Adaptaciones específicas comprobables en el repositorio
1. **Lógica de intervalos semiabiertos $[inicio, fin)$ para admitir reservas consecutivas:** En [`src/domain/reservation.ts`](src/domain/reservation.ts) (función `doIntervalsOverlap`, líneas 107–119), se codificó la condición `tStartA < tEndB && tEndA > tStartB` para que los límites exactos contiguos (`10:00–11:00` y `11:00–12:00`) no generen falsos positivos de colisión.
2. **Validación anti-rollover de fechas calendario en ISO 8601:** En [`src/domain/reservation.ts`](src/domain/reservation.ts) (función `parseAndValidateIsoDate`, líneas 59–68), se añadió una verificación explícita contra `Date.UTC(year, month - 1, day)` porque `new Date("2026-02-30T10:00")` en JavaScript desborda silenciosamente al 2 de marzo en lugar de fallar.
3. **Puente de carga `createRequire` para `node:sqlite` bajo ESM y Vitest:** En [`src/db/database.ts`](src/db/database.ts) (líneas 1–6), se implementó `const require = createRequire(import.meta.url); const { DatabaseSync } = require('node:sqlite');` para garantizar que el módulo nativo `node:sqlite` de Node.js v24 se resuelva sin errores tanto en ejecución directa (`tsx`) como dentro del bundler de pruebas de Vitest.
4. **Bóveda de memoria persistente en Obsidian y bitácora de progreso:** Se estructuró [`memory/index.md`](memory/index.md) junto con sus notas enlazadas y [`docs/progreso.md`](docs/progreso.md) para preservar el contexto entre sesiones y subagentes.

---

## 4. Registro de decisiones y delegación

### 4.1 Resumen de decisiones técnicas y de diseño significativas (ADRs)

| ADR | Decisión adoptada | Alternativas descartadas | Motivo y consecuencias |
| :--- | :--- | :--- | :--- |
| **ADR-001** ([`memory/decisions/adr-001-stack.md`](memory/decisions/adr-001-stack.md)) | **TypeScript + Node.js LTS + Vitest** | Python/FastAPI, Go, JS sin tipos | Tipado estricto en el modelo de dominio, rapidez de ejecución con `tsx` y aserciones expresivas en Vitest sin pasos pesados de compilación. |
| **ADR-002** ([`memory/decisions/adr-002-web-ui.md`](memory/decisions/adr-002-web-ui.md)) | **Servidor HTTP nativo + Dashboard Web Vanilla** | Solo CLI, SPA pesada con React/Next.js | Permite evaluar el sistema visualmente desde cualquier navegador en `http://localhost:3000` o vía `curl`/tests sin instalar frameworks frontend ni bundlers. |
| **ADR-003** ([`memory/decisions/adr-003-sqlite.md`](memory/decisions/adr-003-sqlite.md)) | **SQLite embebido vía `node:sqlite` (`data/reservations.db`)** | PostgreSQL en Docker, archivo JSON plano, `better-sqlite3` (C++ addon) | Garantiza persistencia ACID real en disco sin requerir servidores externos ni compiladores C++ (`node-gyp`) en la máquina evaluadora. |
| **ADR-004** ([`memory/decisions/adr-004-time-policy.md`](memory/decisions/adr-004-time-policy.md)) | **Fechas ISO 8601 libres de reloj actual y duración `[15m, 24h]`** | Bloquear fechas pasadas según `Date.now()` | Si se bloquearan fechas pasadas respecto al reloj real, los tests con fechas fijas fallarían en el futuro. Admitir cualquier fecha calendario válida asegura tests 100% deterministas. |
| **ADR-005** ([`memory/decisions/adr-005-id-format.md`](memory/decisions/adr-005-id-format.md)) | **IDs secuenciales legibles (`RES-001`, `RES-002`)** | UUID v4 aleatorios | Mejora la legibilidad en la interfaz web, facilita la cancelación manual y permite aserciones deterministas en las pruebas. |

---

### 4.2 Tres episodios reales de delegación

#### Episodio 1: Relevamiento interactivo de requisitos, Modelo de Dominio y Desglose en Tickets
- **Objetivo y requisito abordado:** Analizar la consigna [`challenge-agents.pdf`](challenge-agents.pdf), despejar todos los puntos abiertos (stack, persistencia, política temporal, interfaz y formato de IDs), documentar el modelo de dominio y dividir la construcción en tickets incrementales verificables.
- **Contexto suministrado y extracto de la instrucción:**
  Se proporcionó el archivo `challenge-agents.pdf` y se invocaron las skills `/grill-me`, `/grill-with-docs` y `/to-tickets`:
  > *"Usa las skills de grill-me y grill-with-docs para hacerme preguntas respecto al documento challenge-agents.pdf... Documenta todas las respuestas y decisiones en un archivo markdown bien estructurado y prepara el desglose en tickets."*
- **Acción o resultado del agente:**
  El agente (`Gemini 3.8 Flash`) instaló el catálogo de skills en `.agents/skills`, configuró [`.gitignore`](.gitignore) para excluir `.agents/` y `skills-lock.json`, formuló una serie estructurada de preguntas con opciones cerradas y recomendaciones técnicas, consolidó el documento [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md) con 5 ADRs, creó la bóveda de memoria en [`memory/index.md`](memory/index.md) y generó los 6 tickets en [`docs/tickets/`](docs/tickets/).
- **Decisión humana de aceptar/corregir y motivo:**
  El humano **aceptó** el modelo de dominio propuesto y seleccionó explícitamente las opciones recomendadas en cada ADR (TypeScript + Vitest, Web UI local + API REST, SQLite embebido, fechas ISO libres de reloj para determinismo de tests e identificadores `RES-001`), ordenando además documentar el Harness de Gentle AI en [`AGENTS.md`](AGENTS.md) para regir a todos los subagentes posteriores.
- **Evidencia verificable en el repositorio:**
  - Especificación y ADRs: [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md)
  - Índice y notas de tickets: [`docs/tickets/index.md`](docs/tickets/index.md) (`TICKET-01` a `TICKET-06`)
  - Reglas de operación y exclusiones: [`AGENTS.md`](AGENTS.md) y [`.gitignore`](.gitignore)

---

#### Episodio 2: Delegación en `domain-tdd-agent` para lógica de dominio, servicio de reservas y persistencia tras reinicio (`TICKET-02`, `TICKET-03` y `TICKET-05`)
- **Objetivo y requisito abordado:** Implementar bajo TDD estricto las validaciones de dominio (inventario, solicitante, fechas ISO, duración `[15m, 24h]`, intervalos semiabiertos), el servicio `ReservationService` sobre SQLite (disponibilidad, creación, rechazo de superposiciones, límites consecutivos, unidades distintas y cancelación conservando historial) y la prueba de persistencia tras cerrar y reabrir la base de datos.
- **Contexto suministrado y extracto de la instrucción:**
  Se suministraron [`AGENTS.md`](AGENTS.md), [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md), [`src/domain/inventory.ts`](src/domain/inventory.ts), [`src/domain/reservation.ts`](src/domain/reservation.ts) y [`src/db/database.ts`](src/db/database.ts), delegando en el subagente especializado con la siguiente instrucción:
  > *"Tu tarea es completar la implementación y verificación TDD de los Tickets 02, 03 y 05 trabajando sobre src/domain/reservation.ts, src/services/reservation-service.ts, src/scripts/reset-db.ts y las suites tests/reservation-creation.test.ts, tests/reservation-cancellation.test.ts y tests/persistence-restart.test.ts. No ejecutes comandos git."*
- **Acción o resultado del agente:**
  El subagente implementó [`src/services/reservation-service.ts`](src/services/reservation-service.ts), reforzó [`src/domain/reservation.ts`](src/domain/reservation.ts) con validación anti-rollover de fechas calendario (`2026-02-30`), creó [`src/scripts/reset-db.ts`](src/scripts/reset-db.ts) y escribió 20 pruebas automatizadas distribuidas en [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts), [`tests/reservation-cancellation.test.ts`](tests/reservation-cancellation.test.ts) y [`tests/persistence-restart.test.ts`](tests/persistence-restart.test.ts).
- **Decisión humana / del arquitecto de aceptar y refinar con motivo:**
  Al revisar el código entregado por el subagente en [`src/services/reservation-service.ts`](src/services/reservation-service.ts), se aceptó la lógica de negocio y la validación anti-rollover, pero se **aplicó una corrección/refinamiento** en `checkAvailability` y `createReservation` (líneas 52–53 y 92–93 de [`src/services/reservation-service.ts`](src/services/reservation-service.ts)) para normalizar (`startTime.trim()`, `endTime.trim()`) las cadenas de fecha antes de persistirlas en SQLite. **Motivo:** aunque `parseAndValidateIsoDate` recortaba espacios al validar, el DTO original sin `trim()` se guardaba en la base de datos, lo que podía introducir espacios accidentales en el campo `start_time` o `end_time` persistido.
- **Evidencia verificable en el repositorio:**
  - Código de dominio y servicio: [`src/domain/reservation.ts`](src/domain/reservation.ts) y [`src/services/reservation-service.ts`](src/services/reservation-service.ts)
  - Pruebas de validación, negocio y persistencia: [`tests/reservation-creation.test.ts`](tests/reservation-creation.test.ts), [`tests/reservation-cancellation.test.ts`](tests/reservation-cancellation.test.ts) y [`tests/persistence-restart.test.ts`](tests/persistence-restart.test.ts)

---

#### Episodio 3: Delegación en `web-fullstack-agent` para API HTTP REST e Interfaz Web Local (`TICKET-04`)
- **Objetivo y requisito abordado:** Construir el servidor HTTP local sin frameworks externos (`node:http`), exponer los 6 endpoints REST (`/api/inventory`, `/api/availability`, `/api/reservations`, `POST /api/reservations`, `POST /api/reservations/:id/cancel`, `POST /api/admin/reset`), desarrollar el Dashboard Web Local en `src/public/` y verificar todo el flujo mediante pruebas de integración HTTP (`tests/api-server.test.ts`).
- **Contexto suministrado y extracto de la instrucción:**
  Se suministró la especificación de endpoints de [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md) (Sección 6) y la interfaz de [`src/services/reservation-service.ts`](src/services/reservation-service.ts):
  > *"Implementa TICKET-04: src/app.ts, src/server.ts, los archivos del frontend en src/public/ (index.html, styles.css, app.js) y las pruebas de integración HTTP en tests/api-server.test.ts cubriendo creación (201), superposición (409), entradas inválidas (400), disponibilidad (200) y cancelación (200/404)."*
- **Acción o resultado del agente:**
  El subagente construyó [`src/app.ts`](src/app.ts), [`src/server.ts`](src/server.ts), la interfaz interactiva en [`src/public/index.html`](src/public/index.html), [`src/public/styles.css`](src/public/styles.css) y [`src/public/app.js`](src/public/app.js), y creó [`tests/api-server.test.ts`](tests/api-server.test.ts) con 6 pruebas de integración levantando el servidor en un puerto efímero (`port = 0`).
- **Decisión humana / del arquitecto de aceptar con motivo:**
  Se **aceptó** la implementación verificando un detalle clave de interoperabilidad: en [`docs/especificacion-diseno.md`](docs/especificacion-diseno.md) el ejemplo de endpoint mencionaba `{ start, end }` mientras que el DTO de dominio utilizaba `{ startTime, endTime }`. Se validó y mantuvo la adaptación en [`src/app.ts`](src/app.ts) (líneas 94–95 y 142–153) para que tanto `GET /api/availability` como `POST /api/reservations` acepten indistintamente `{ startTime, endTime }` o `{ start, end }`, evitando errores de contrato entre clientes REST, pruebas y frontend.
- **Evidencia verificable en el repositorio:**
  - Servidor y enrutador HTTP: [`src/app.ts`](src/app.ts) y [`src/server.ts`](src/server.ts)
  - Interfaz Web Local: [`src/public/index.html`](src/public/index.html), [`src/public/styles.css`](src/public/styles.css) y [`src/public/app.js`](src/public/app.js)
  - Pruebas de integración HTTP: [`tests/api-server.test.ts`](tests/api-server.test.ts)

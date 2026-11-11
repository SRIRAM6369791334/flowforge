# 05 — API Documentation

> **Scope**: Complete API reference for all 14 Next.js App Router route handlers under `src/app/api/**` in **FlowForge** (`C:\Users\srira\.gemini\antigravity\scratch\flowforge`).
> **Runtime**: Next.js 16 App Router (`next/server` `NextResponse`). No authentication middleware is enforced (local studio autonomy).

---

## Endpoint Summary Table

| # | Route Path | Source File | HTTP Methods | `maxDuration` | Primary Store / Service |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/api/workflows` | `src/app/api/workflows/route.ts` | `GET`, `POST` | Default | `workflows` (`src/lib/store.ts`) |
| 2 | `/api/workflows/[id]` | `src/app/api/workflows/[id]/route.ts` | `GET`, `PUT`, `DELETE` | Default | `workflows` (`src/lib/store.ts`), `syncSchedules` (`src/lib/scheduler.ts`) |
| 3 | `/api/workflows/[id]/run` | `src/app/api/workflows/[id]/run/route.ts` | `POST` | `300s` (`L5`) | `enqueueWorkflowRun` (`src/lib/queue.ts`) |
| 4 | `/api/workflows/[id]/live` | `src/app/api/workflows/[id]/live/route.ts` | `GET` | Default | `executions` (`src/lib/store.ts`) |
| 5 | `/api/workflows/run-parallel` | `src/app/api/workflows/run-parallel/route.ts` | `POST` | `300s` (`L5`) | `enqueueWorkflowRun` (`src/lib/queue.ts`) |
| 6 | `/api/executions` | `src/app/api/executions/route.ts` | `GET`, `DELETE` | Default | `executions` (`src/lib/store.ts`) |
| 7 | `/api/queue` | `src/app/api/queue/route.ts` | `GET`, `POST` | `300s` (`L13`) | `src/lib/queue.ts` (`getQueueState`, `setQueueConfig`, `enqueueWorkflowRun`, `enqueueBurstRuns`, `clearFinishedJobs`) |
| 8 | `/api/telegram` | `src/app/api/telegram/route.ts` | `GET`, `POST` | Default | `src/lib/telegramPoller.ts` (`getTelegramStatus`, `startTelegramListener`, `stopTelegramListener`, `triggerTelegramWorkflows`) |
| 9 | `/api/forms/submit` | `src/app/api/forms/submit/route.ts` | `POST` | `300s` (`L5`) | `dbTables.insert` (`src/lib/store.ts`), `runWorkflow` (`src/lib/engine.ts`) |
| 10 | `/api/db` | `src/app/api/db/route.ts` | `GET`, `POST`, `DELETE` | Default | `dbTables` (`src/lib/store.ts`) |
| 11 | `/api/secrets` | `src/app/api/secrets/route.ts` | `GET`, `POST`, `DELETE` | Default | `secrets` (`src/lib/store.ts`) |
| 12 | `/api/ai-builder` | `src/app/api/ai-builder/route.ts` | `POST` | Default | Gemini `v1beta` REST API + `fallbackSynthesize` + `workflows.create` |
| 13 | `/api/webhook/[...path]` | `src/app/api/webhook/[...path]/route.ts` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `300s` (`L5`) | `workflows.list` (`src/lib/store.ts`), `enqueueWorkflowRun` (`src/lib/queue.ts`) |
| 14 | `/api/events` | `src/app/api/events/route.ts` | `GET` | Default | `workflowBus` (`src/lib/events.ts`) |

---

## 1. `/api/workflows`

- **Source File**: `src/app/api/workflows/route.ts` (`L1-L11`)

### `GET /api/workflows` (`L4-L6`)
- **Purpose**: Lists all persisted workflows sorted by `updatedAt` descending.
- **URL Parameters / Query Strings**: None.
- **Request Body**: None.
- **Data Transformations**: Calls `workflows.list()` (`src/lib/store.ts` `L121`), which reads `data/db.json` (seeding the 4 `STARTER_WORKFLOWS` from `src/lib/templates.ts` if missing) and sorts by `b.updatedAt.localeCompare(a.updatedAt)`.
- **Response Payload (`200 OK`)**: `Workflow[]`
  ```json
  [
    {
      "id": "wf-parallel-multi-website",
      "name": "🌐 Parallel 5-Website Live Monitor → DB + Gemini AI + Telegram + Gmail",
      "active": true,
      "nodes": [
        {
          "id": "pw-trigger",
          "type": "manual_trigger",
          "name": "Start Parallel Audit",
          "position": { "x": 60, "y": 220 },
          "params": { "sample": "{\n  \"batchName\": \"Multi-Site Health & Content Audit\",\n  \"initiatedBy\": \"Sriram\"\n}" }
        }
      ],
      "edges": [
        { "id": "pwe1", "source": "pw-trigger", "target": "pw-web" }
      ],
      "createdAt": "2026-11-11T06:25:00.000Z",
      "updatedAt": "2026-11-11T06:25:00.000Z"
    }
  ]
  ```
- **Error Propagation**: `read()` in `src/lib/store.ts` (`L102-L104`) catches file parse errors and returns `[]`.

### `POST /api/workflows` (`L8-L10`)
- **Purpose**: Creates a new workflow with a default `manual_trigger` node.
- **Request Body**:
  ```json
  { "name": "My New Workflow" }
  ```
- **Data Transformations**:
  - Parses JSON safely via `await req.json().catch(() => ({}))` (`L9`).
  - Trims `name` and defaults to `"Untitled workflow"` (`L10`).
  - Calls `workflows.create(name)` (`src/lib/store.ts` `L123-L139`), which generates `id: crypto.randomUUID()`, `active: false`, a single `manual_trigger` node at `{ x: 80, y: 200 }`, and `edges: []`.
- **Response Payload (`201 Created`)**: `Workflow` object.
- **Error Propagation**: Invalid JSON body is caught and falls back to `"Untitled workflow"`.

---

## 2. `/api/workflows/[id]`

- **Source File**: `src/app/api/workflows/[id]/route.ts` (`L1-L31`)
- **Route Context**: `{ params: Promise<{ id: string }> }` (`L6`)

### `GET /api/workflows/[id]` (`L8-L11`)
- **Purpose**: Retrieves a single workflow by its `id`.
- **URL Parameters**: `id` (path parameter).
- **Response Payload**:
  - `200 OK`: `Workflow`
  - `404 Not Found`: `{ "error": "Not found" }` (`L10`)

### `PUT /api/workflows/[id]` (`L13-L25`)
- **Purpose**: Updates a workflow's `name`, `active` state, `nodes`, and/or `edges`, and synchronizes cron schedules.
- **URL Parameters**: `id` (path parameter).
- **Request Body**: `Partial<Workflow>`
  ```json
  {
    "name": "Updated Workflow Title",
    "active": true,
    "nodes": [ ... ],
    "edges": [ ... ]
  }
  ```
- **Data Transformations**:
  - Extracts `{ name, active, nodes, edges }` from `await req.json()` (`L14-L15`) and passes defined fields to `workflows.update(id, patch)` (`L16-L21`), which updates `updatedAt = new Date().toISOString()` (`src/lib/store.ts` `L144`).
  - Calls `syncSchedules()` (`src/lib/scheduler.ts` `L72-L88`) at `L23` to re-register active `schedule_trigger` cron jobs.
- **Response Payload**:
  - `200 OK`: Updated `Workflow` object (`L24`).
  - `404 Not Found`: `{ "error": "Not found" }` (`L22`).
- **Error Propagation**: Uncaught JSON parse error if request body is malformed JSON.

### `DELETE /api/workflows/[id]` (`L27-L31`)
- **Purpose**: Deletes a workflow and all of its historical executions, then updates cron schedules.
- **URL Parameters**: `id` (path parameter).
- **Data Transformations**:
  - Calls `workflows.remove(id)` (`src/lib/store.ts` `L147-L151`), which filters out both `db.workflows` (`w.id !== id`) and `db.executions` (`e.workflowId !== id`).
  - Calls `syncSchedules()` (`L29`).
- **Response Payload (`200 OK`)**: `{ "ok": true }` (`L30`).

---

## 3. `/api/workflows/[id]/run`

- **Source File**: `src/app/api/workflows/[id]/run/route.ts` (`L1-L23`)
- **Max Duration**: `export const maxDuration = 300;` (`L5`)

### `POST /api/workflows/[id]/run` (`L7-L23`)
- **Purpose**: Enqueues a synchronous manual workflow execution into the worker pool and returns the completed `Execution` trace.
- **URL Parameters**: `id` (workflow ID).
- **Request Body** (optional JSON, defaults to `{}` via `.catch(() => ({}))` at `L10`):
  ```json
  {
    "triggerNodeId": "pw-trigger",
    "priority": 5,
    "triggerData": { "customKey": "value" }
  }
  ```
- **Data Transformations**:
  - Looks up workflow via `workflows.get(id)` (`L8`).
  - Calls `enqueueWorkflowRun(wf, { mode: "manual", triggerNodeId, triggerData, priority: priority ?? 5, waitForCompletion: true })` (`L15-L21`).
  - Inside `enqueueWorkflowRun` → `pumpQueue` → `runWorkflow`, topological waves are computed via `planParallelWaves`, expressions are evaluated via `resolveParams`, nodes execute in parallel per wave, and the resulting `Execution` is saved to `data/db.json`.
- **Response Payload**:
  - `200 OK`: `Execution` object (`result!.execution` `L22`):
    ```json
    {
      "id": "exec-uuid",
      "workflowId": "wf-parallel-multi-website",
      "workflowName": "🌐 Parallel 5-Website Live Monitor...",
      "mode": "manual",
      "status": "success",
      "startedAt": "2026-11-11T10:00:00.000Z",
      "finishedAt": "2026-11-11T10:00:01.250Z",
      "nodes": {
        "pw-trigger": {
          "status": "success",
          "startedAt": "2026-11-11T10:00:00.001Z",
          "durationMs": 2,
          "attempts": 1,
          "wave": 0,
          "input": [],
          "output": [{ "json": { "batchName": "Multi-Site Health & Content Audit", "initiatedBy": "Sriram" } }]
        }
      }
    }
    ```
  - `404 Not Found`: `{ "error": "Not found" }` (`L9`).
- **Error Propagation**: Workflow node failures do **not** throw HTTP 500; `runWorkflow` catches node errors (`src/lib/engine.ts` `L250-L253`), sets `execution.status = "error"` and `execution.error = err.message`, and returns HTTP `200` with the failed `Execution` object so the UI can highlight the failed node on the canvas.

---

## 4. `/api/workflows/[id]/live`

- **Source File**: `src/app/api/workflows/[id]/live/route.ts` (`L1-L19`)

### `GET /api/workflows/[id]/live` (`L4-L19`)
- **Purpose**: Lightweight polling endpoint called every `1000ms` by `FlowForgeStudio` (`src/app/page.tsx` `L323`) to synchronize live or newly finished executions onto the canvas.
- **URL Parameters**: `id` (workflow ID).
- **Data Transformations**:
  - Calls `executions.list(id)` (`L9`) and grabs `latestSummary = list[0]` (`L10`).
  - If `latestSummary` exists, calls `executions.get(latestSummary.id)` (`L14`) and computes `running: full?.status === "running"` (`L17`).
- **Response Payload (`200 OK`)**:
  - When no executions exist for workflow `id` (`L11-L13`):
    ```json
    { "execution": null, "running": false }
    ```
  - When an execution exists (`L15-L18`):
    ```json
    {
      "execution": { "id": "...", "status": "running", "nodes": { ... } },
      "running": true
    }
    ```
- **Error Propagation**: Always returns `200 OK`.

---

## 5. `/api/workflows/run-parallel`

- **Source File**: `src/app/api/workflows/run-parallel/route.ts` (`L1-L42`)
- **Max Duration**: `export const maxDuration = 300;` (`L5`)

### `POST /api/workflows/run-parallel` (`L7-L42`)
- **Purpose**: Enqueues multiple workflows simultaneously into the worker pool via `Promise.all` (`mode: "parallel_batch"`) and returns all executions and queue jobs along with total parallel wall-clock time.
- **Request Body** (optional JSON, defaults to `{}` via `.catch(() => ({}))` at `L8`):
  ```json
  {
    "workflowIds": ["wf-parallel-multi-website", "wf-demo-api-pipeline"],
    "triggerData": { "batchSource": "ui" },
    "priority": 3
  }
  ```
- **Data Transformations**:
  - Filters `workflows.list()` by `body.workflowIds` if non-empty, or falls back to all `w.active` workflows (`L14-L18`).
  - Calls `Promise.all(targets.map((wf) => enqueueWorkflowRun(wf, { mode: "parallel_batch", triggerData: body.triggerData, priority: body.priority ?? 3, waitForCompletion: true })))` (`L25-L34`).
  - Computes `parallelWallTimeMs = Math.round(performance.now() - t0)` (`L24`, `L38`).
- **Response Payload**:
  - `200 OK` (`L36-L41`):
    ```json
    {
      "totalWorkflows": 2,
      "parallelWallTimeMs": 640,
      "executions": [ /* Execution[] */ ],
      "jobs": [ /* QueueJob[] */ ]
    }
    ```
  - `400 Bad Request` (`L20-L22`):
    ```json
    { "error": "No workflows selected or active" }
    ```

---

## 6. `/api/executions`

- **Source File**: `src/app/api/executions/route.ts` (`L1-L25`)

### `GET /api/executions` (`L4-L19`)
- **Purpose**: Retrieves either a single full `Execution` (with all node input/output payloads) or a lightweight list of execution summaries.
- **Query Parameters**:
  - `id` (optional): Specific execution ID (`?id=<execId>`).
  - `workflowId` (optional): Filter list by workflow ID (`?workflowId=<wfId>`).
  - `limit` (optional): Maximum number of summaries to return (default `100` `L12`).
- **Data Transformations**:
  - If `id` is present (`L7-L10`), returns `executions.get(id)` directly.
  - Otherwise (`L11-L18`), slices `executions.list(workflowId)` to `limit` and strips heavy `nodes` objects via destructuring `({ nodes, ...rest }) => ({ ...rest, nodeCount: Object.keys(nodes).length })`.
- **Response Payload**:
  - `200 OK` (when `?id=` is provided): Full `Execution` object.
  - `404 Not Found` (when `?id=` is not found): `{ "error": "Not found" }` (`L9`).
  - `200 OK` (list view): `Array<Omit<Execution, "nodes"> & { nodeCount: number }>`.

### `DELETE /api/executions` (`L21-L25`)
- **Purpose**: Clears execution history (globally or for a specific workflow).
- **Query Parameters**:
  - `workflowId` (optional): `?workflowId=<wfId>` (`L22`).
- **Data Transformations**: Calls `executions.clear(workflowId)` (`src/lib/store.ts` `L171-L174`).
- **Response Payload (`200 OK`)**: `{ "ok": true }` (`L24`).

---

## 7. `/api/queue`

- **Source File**: `src/app/api/queue/route.ts` (`L1-L119`)
- **Max Duration**: `export const maxDuration = 300;` (`L13`)

### `GET /api/queue` (`L15-L17`)
- **Purpose**: Returns the current state, worker slot allocations, KPI statistics, and job history of the `globalThis.__ffQueue` worker pool.
- **Response Payload (`200 OK`)**: `QueueState` (`src/lib/queue.ts` `L43-L51`):
  ```json
  {
    "mode": "parallel_pool",
    "concurrency": 6,
    "effectiveConcurrency": 6,
    "activeWorkers": 0,
    "workers": [
      { "id": 1, "workerId": 1, "status": "idle" }
    ],
    "stats": {
      "queued": 0,
      "running": 0,
      "completed": 10,
      "failed": 0,
      "avgWaitMs": 12,
      "avgRunMs": 310,
      "throughputPerMin": 10
    },
    "jobs": [ /* QueueJob[] */ ]
  }
  ```

### `POST /api/queue` (`L19-L119`)
- **Purpose**: Performs one of 4 queue management/execution actions based on `body.action` (defaults to `"config"` at `L34`):

#### Action 1: `"config"` (`L36-L42`)
- **Request Body**: `{ "action": "config", "mode": "parallel_pool" | "sequential_fifo", "concurrency": 8 }`
- **Behavior**: Calls `setQueueConfig({ mode, concurrency })` (`src/lib/queue.ts` `L369-L382`), which clamps `concurrency` between `1` and `20` and calls `pumpQueue()`.
- **Response (`200 OK`)**: `{ "ok": true, ...state, "state": state }`.

#### Action 2: `"clear"` (`L44-L47`)
- **Request Body**: `{ "action": "clear" }`
- **Behavior**: Calls `clearFinishedJobs()` (`src/lib/queue.ts` `L384-L390`) to remove `completed` and `failed` jobs.
- **Response (`200 OK`)**: `{ "ok": true, ...state, "state": state }`.

#### Action 3: `"enqueue"` (`L49-L75`)
- **Request Body**:
  ```json
  {
    "action": "enqueue",
    "workflowId": "wf-demo-api-pipeline",
    "priority": 10,
    "wait": false,
    "jobMode": "manual",
    "triggerData": {}
  }
  ```
- **Behavior**: Resolves `wf` by `body.workflowId`, falling back to `"wf-demo-api-pipeline"` or `all[0]` (`L51-L54`). Calls `enqueueWorkflowRun(wf, { mode: body.jobMode ?? "manual", priority: Number(body.priority ?? 1), waitForCompletion: body.wait !== false, triggerData: body.triggerData })` (`L60-L65`).
- **Response**:
  - `200 OK`: `{ "ok": true, "job": QueueJob, "execution": Execution | undefined, ...state, "state": state }`
  - `404 Not Found`: `{ "error": "Workflow not found" }` (`L57`)

#### Action 4: `"burst"` (`L77-L116`)
- **Request Body**:
  ```json
  {
    "action": "burst",
    "burstCount": 10,
    "workflowIds": ["wf-parallel-multi-website", "wf-demo-api-pipeline"],
    "countPerWorkflow": 1,
    "triggerData": {}
  }
  ```
- **Behavior**:
  - Resolves target workflows from `body.workflowIds`, falling back to `"wf-demo-api-pipeline"`, active workflows, or `all[0]` (`L79-L88`).
  - Clamps `burstCount` to `1..40` (default `8` `L94`) and builds `burstWorkflows` by cycling through `targets` (`L95-L98`).
  - Calls `enqueueBurstRuns(burstWorkflows, countPerWf, body.triggerData)` (`L104`).
- **Response**:
  - `200 OK`: `{ "ok": true, ...state, "batchId": "...", "burstJobs": QueueJob[], "parallelWallTimeMs": 450, "totalJobs": 10, "state": state }`
  - `400 Bad Request`: `{ "error": "No workflows available for burst run" }` (`L90`)

#### Unknown Action (`L118`)
- **Response (`400 Bad Request`)**: `{ "error": "Unknown queue action \"...\"" }`

---

## 8. `/api/telegram`

- **Source File**: `src/app/api/telegram/route.ts` (`L1-L38`)

### `GET /api/telegram` (`L10-L16`)
- **Purpose**: Returns current Telegram bot listener status and recent message logs; automatically starts the background listener if `status.listening` is `false`.
- **Data Transformations**: Calls `getTelegramStatus()` (`L11`); if `!status.listening`, calls and returns `startTelegramListener()` (`L13`).
- **Response Payload (`200 OK`)**:
  ```json
  {
    "listening": true,
    "bot": { "username": "MyFlowForgeBot", "firstName": "FlowForge" },
    "logs": [
      {
        "id": "log-uuid",
        "from": "Sriram",
        "chatId": "1979386706",
        "text": "Vanakkam Bot!",
        "receivedAt": "2026-11-11T10:05:00.000Z",
        "workflowName": "💬 2-Way Telegram Bot Listener...",
        "executionId": "exec-uuid",
        "status": "success"
      }
    ]
  }
  ```

### `POST /api/telegram` (`L18-L38`)
- **Purpose**: Controls the Telegram listener (`"start"` / `"stop"`) or simulates an incoming Telegram message (`"simulate"`).
- **Request Body**:
  ```json
  {
    "action": "start" | "stop" | "simulate",
    "text": "Vanakkam Bot! Check parallel websites & give AI status summary",
    "fromName": "Sriram"
  }
  ```
- **Data Transformations**:
  - If `body.action === "stop"` (`L25-L27`), calls `stopTelegramListener()`.
  - If `body.action === "simulate"` (`L28-L36`), reads `TELEGRAM_CHAT_ID` from `secrets.map()` (defaulting to `"1979386706"` `L32`) and awaits `triggerTelegramWorkflows({ text, chatId, fromName })` (`L30-L34`).
  - Otherwise (`L37`), calls `startTelegramListener()`.
- **Response Payload (`200 OK`)**:
  - For `"start"` / `"stop"`: `TelegramStatus` object.
  - For `"simulate"` (`L35`): `{ "status": TelegramStatus, "triggered": TelegramLogEntry }`.

---

## 9. `/api/forms/submit`

- **Source File**: `src/app/api/forms/submit/route.ts` (`L1-L69`)
- **Max Duration**: `export const maxDuration = 300;` (`L5`)

### `POST /api/forms/submit` (`L7-L69`)
- **Purpose**: Processes public mini-app form submissions, saves them to the corresponding database table, dynamically overrides workflow parameters (`urls` or `prompt`), and runs the matched workflow (`mode: "form"`).
- **Request Body**:
  ```json
  {
    "formSlug": "parallel-websites" | "lead-capture" | "order-checkout" | "ask-ai",
    "payload": {
      "urls": "https://news.ycombinator.com\nhttps://example.com",
      "name": "Sriram",
      "email": "sriramsri1234321@gmail.com",
      "phone": "919876543210",
      "amount": 499,
      "prompt": "Give me 3 automation ideas"
    }
  }
  ```
- **Data Transformations**:
  1. Maps `formSlug` to target table via `tableMap` (`L17-L22`: `"parallel-websites"` → `"website_monitors"`, `"lead-capture"` → `"leads"`, `"order-checkout"` → `"orders"`, `"ask-ai"` → `"ai_logs"`) and inserts a `DbRecord` via `dbTables.insert()` (`L23-L26`).
  2. Selects `targetWf` (`L29-L36`): searches for a workflow with a `form_trigger` matching `slug`, falling back to `wf-parallel-multi-website` (for `"parallel-websites"`), `wf-live-ai-telegram-gmail`, or `all[0]`.
  3. Clones `targetWf` via `structuredClone(targetWf)` and overrides `n.params.urls` on `parallel_web` nodes (`L42-L48`) or `n.params.prompt` on `gemini` nodes (`L49-L56`).
  4. Executes `runWorkflow(targetWf, { mode: "form", triggerData: { formSlug: slug, recordId: savedRecord.id, ...payload } })` (`L58-L61`).
- **Response Payload**:
  - `200 OK` (`L63-L68`):
    ```json
    {
      "ok": true,
      "savedRecord": { "id": "rec_12345678", "table": "website_monitors", "data": { ... }, "createdAt": "..." },
      "execution": { /* Execution */ },
      "output": [ /* lastOutput items .json */ ]
    }
    ```
  - `404 Not Found` (`L37-L39`): `{ "error": "No workflow available" }`.

---

## 10. `/api/db`

- **Source File**: `src/app/api/db/route.ts` (`L1-L25`)

### `GET /api/db` (`L4-L12`)
- **Purpose**: Lists all database tables with row counts and retrieves records for a table.
- **Query Parameters**:
  - `table` (optional): Table name to filter records (e.g., `?table=website_monitors`).
  - `limit` (optional): Max records to return (default `100` `L7`).
- **Response Payload (`200 OK`)**:
  ```json
  {
    "tables": [
      { "name": "website_monitors", "count": 4 },
      { "name": "leads", "count": 1 },
      { "name": "orders", "count": 0 },
      { "name": "ai_logs", "count": 2 }
    ],
    "records": [
      {
        "id": "rec_a1b2c3d4",
        "table": "website_monitors",
        "data": { ... },
        "createdAt": "2026-11-11T10:00:00.000Z"
      }
    ]
  }
  ```

### `POST /api/db` (`L14-L19`)
- **Purpose**: Inserts a new JSON record into a specified database table.
- **Request Body**: `{ "table": "leads", "data": { "name": "Sriram" } }`
- **Response Payload**:
  - `201 Created`: `DbRecord` object (`L18`).
  - `400 Bad Request`: `{ "error": "table required" }` (`L16`).

### `DELETE /api/db` (`L21-L25`)
- **Purpose**: Clears records from a specific `?table=` or all tables if omitted.
- **Query Parameters**: `table` (optional).
- **Response Payload (`200 OK`)**: `{ "ok": true }` (`L24`).

---

## 11. `/api/secrets`

- **Source File**: `src/app/api/secrets/route.ts` (`L1-L22`)

### `GET /api/secrets` (`L6-L8`)
- **Purpose**: Returns all stored secret keys with masked value previews (never exposing raw secret values over `GET`).
- **Data Transformations**: Masks each secret value via `mask(v)` (`L4`): `v.length <= 6 ? "•".repeat(v.length) : "${v.slice(0, 3)}••••••••${v.slice(-3)}"`.
- **Response Payload (`200 OK`)**:
  ```json
  [
    {
      "key": "GEMINI_API_KEY",
      "preview": "AIz••••••••abc",
      "updatedAt": "2026-11-11T06:00:00.000Z"
    }
  ]
  ```

### `POST /api/secrets` (`L10-L16`)
- **Purpose**: Creates or updates a secret in `data/db.json`.
- **Request Body**: `{ "key": "GEMINI_API_KEY", "value": "<secret-value>" }`
- **Data Transformations**: Normalizes `key` via `(key ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")` (`L12`) and calls `secrets.set(k, value)` (`L14`).
- **Response Payload**:
  - `200 OK`: `{ "ok": true, "key": "GEMINI_API_KEY" }` (`L15`)
  - `400 Bad Request`: `{ "error": "key and value required" }` (`L13`)

### `DELETE /api/secrets` (`L18-L22`)
- **Purpose**: Deletes a secret key from `data/db.json` (note: keys present in external `.env` files will re-sync on next `read()` via `mergeSecrets` in `src/lib/store.ts` `L61-L69`).
- **Query Parameters**: `key` (`?key=SLACK_WEBHOOK_URL`).
- **Response Payload (`200 OK`)**: `{ "ok": true }` (`L21`).

---

## 12. `/api/ai-builder`

- **Source File**: `src/app/api/ai-builder/route.ts` (`L1-L285`)

### `POST /api/ai-builder` (`L206-L285`)
- **Purpose**: Generates a complete, auto-aligned multi-node `Workflow` from a natural-language English or Tanglish prompt and saves it to `data/db.json`.
- **Request Body**:
  ```json
  {
    "prompt": "Check 5 websites in parallel, analyze with Gemini AI, save to DB, and alert Telegram & Gmail"
  }
  ```
- **Data Transformations**:
  1. Validates `prompt?.trim()` (`L208-L210`).
  2. Looks up `GEMINI_API_KEY` from `secrets.map()` or `process.env.GEMINI_API_KEY` (`L212-L213`).
  3. **LLM Path (`L215-L276`)**: Iterates over `["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]`, calling `POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` with `SYSTEM_PROMPT` (`L6-L42`), `responseMimeType: "application/json"`, and `AbortSignal.timeout(12_000)`. Validates returned nodes against `NODE_MAP`, merges `defaultParams(n.type)` with `n.params`, filters edges to valid node IDs, and arranges nodes into topological columns via `layoutGraph(validNodes, validEdges)` (`L45-L69`, `L266`).
  4. **Heuristic Fallback Path (`L278-L284`)**: If `GEMINI_API_KEY` is absent or all LLM calls fail, runs `fallbackSynthesize(prompt)` (`L71-L204`) to construct a workflow from keyword rules and lays it out via `layoutGraph`.
  5. Persists the workflow with `active: true` via `workflows.create()` (`L264`, `L279`).
- **Response Payload**:
  - `201 Created`: Newly created `Workflow` object (`L269`, `L284`).
  - `400 Bad Request`: `{ "error": "Prompt is required" }` (`L209`).

---

## 13. `/api/webhook/[...path]`

- **Source File**: `src/app/api/webhook/[...path]/route.ts` (`L1-L77`)
- **Max Duration**: `export const maxDuration = 300;` (`L5`)
- **Exported Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` (all mapped to `handle` at `L77`).

### `ALL /api/webhook/[...path]` (`L7-L75`)
- **Purpose**: Dynamic catch-all webhook receiver that matches incoming HTTP requests against active workflows containing a `webhook_trigger` node.
- **URL Parameters**: `path` (`string[]` catch-all segments joined via `.join("/")` at `L8`).
- **Query Parameters & Headers**: Extracted into `triggerData.query` (`Object.fromEntries(url.searchParams)`) and `triggerData.headers` (`Object.fromEntries(req.headers)`) (`L41-L42`).
- **Request Body**:
  - Read as raw text via `await req.text()` for non-`GET`/`HEAD` requests (`L29`).
  - Parsed as JSON if valid (`L32`), or as `application/x-www-form-urlencoded` (`Object.fromEntries(new URLSearchParams(rawBody))` `L34-L36`), or kept as raw string. Both `body` and `rawBody` (used by `razorpay` `verify` HMAC check) are passed in `triggerData` (`L38-L46`).
- **Data Transformations**:
  - Searches `workflows.list().filter((w) => w.active)` for a `webhook_trigger` node whose normalized `params.path` equals `hookPath` and whose `params.method` is `"ANY"` or equals `req.method` (`L11-L19`).
  - **Synchronous Mode (`match.node.params.respond === "lastNode"` `L48-L61`)**: Calls `enqueueWorkflowRun(match.wf, { mode: "webhook", triggerNodeId: match.node.id, triggerData, priority: 4, waitForCompletion: true })` and returns `lastOutput` JSON (`data.length === 1 ? data[0] : data`).
  - **Asynchronous Queue Mode (default `"immediately"` `L63-L74`)**: Calls `enqueueWorkflowRun(..., { priority: 4, waitForCompletion: false })` and immediately returns `202 Accepted`.
- **Response Payload**:
  - `202 Accepted` (when `respond === "immediately"` `L71-L74`):
    ```json
    {
      "ok": true,
      "message": "Workflow queued in worker pool",
      "jobId": "job_1_a1b2c3",
      "status": "running"
    }
    ```
  - `200 OK` (when `respond === "lastNode"` `L60`): Last node's output item(s) JSON.
  - `404 Not Found` (`L21-L26`): `{ "error": "No active workflow listens on <METHOD> /api/webhook/<hookPath>" }`.
  - `500 Internal Server Error` (`L56-L58`, when `respond === "lastNode"` fails): `{ "error": "<execution.error>" }`.

---

## 14. `/api/events`

- **Source File**: `src/app/api/events/route.ts` (`L1-L72`)

### `GET /api/events` (`L4-L72`)
- **Purpose**: Broadcasts real-time workflow execution events (`start`, `progress`, `complete`, `error`) from `workflowBus` (`src/lib/events.ts`) via Server-Sent Events (SSE) or JSON polling fallback.
- **Query Parameters**:
  - `mode` (optional): Pass `?mode=poll` (`L8`) to receive a JSON snapshot of recent events instead of opening an SSE stream.
- **Response Payloads**:
  - **Polling Mode (`?mode=poll`, `200 OK` `L8-L13`)**:
    ```json
    {
      "events": [ /* up to 50 recent WorkflowEvent objects */ ],
      "timestamp": "2026-11-11T10:00:00.000Z"
    }
    ```
  - **SSE Stream Mode (default, `200 OK` with `Content-Type: text/event-stream; charset=utf-8` `L17-L71`)**:
    1. Immediately emits `event: connected` handshake (`L20-L27`).
    2. Replays the last 5 recent events in chronological order as `event: workflow\ndata: <WorkflowEvent JSON>\n\n` (`L30-L33`).
    3. Subscribes to `workflowBus.subscribe()` and streams live `event: workflow` frames (`L35-L41`).
    4. Emits `: ping\n\n` keep-alive comments every `15000ms` (`L44-L51`) and cleans up listeners on `req.signal` abort (`L53-L61`).

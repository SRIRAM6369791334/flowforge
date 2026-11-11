# FlowForge — Stage 1.5: Verified API Map & Route Specifications

> **Scope**: 100% verified specification of all **14 Next.js App Router API Route Handlers** under `src/app/api/**`.  
> **Framework**: Next.js 16.4.6 (`next/server` `NextResponse`, `NextRequest`).  
> **Security Baseline**: Unauthenticated local studio runtime (no session/bearer checks).  
> **Verification Status**: `STATICALLY VERIFIED` across all 14 routes; `RUNTIME VERIFIED` on core operational routes.

---

## 1. Route Inventory Summary Table

| # | Route Path | Source File | HTTP Methods | `maxDuration` | Primary Service | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/api/workflows` | `src/app/api/workflows/route.ts:1-11` | `GET`, `POST` | Default | `workflows` (`store.ts`) | `STATICALLY VERIFIED` |
| 2 | `/api/workflows/[id]` | `src/app/api/workflows/[id]/route.ts:1-31` | `GET`, `PUT`, `DELETE` | Default | `workflows` & `scheduler.ts` | `STATICALLY VERIFIED` |
| 3 | `/api/workflows/[id]/run` | `src/app/api/workflows/[id]/run/route.ts:1-26` | `POST` | `300s` | `enqueueWorkflowRun` (`queue.ts`) | `RUNTIME VERIFIED` |
| 4 | `/api/workflows/[id]/live` | `src/app/api/workflows/[id]/live/route.ts:1-25` | `GET` | Default | `executions` (`store.ts`) | `RUNTIME VERIFIED` |
| 5 | `/api/workflows/run-parallel` | `src/app/api/workflows/run-parallel/route.ts:1-32` | `POST` | `300s` | `enqueueWorkflowRun` (`queue.ts`) | `RUNTIME VERIFIED` |
| 6 | `/api/executions` | `src/app/api/executions/route.ts:1-22` | `GET`, `DELETE` | Default | `executions` (`store.ts`) | `STATICALLY VERIFIED` |
| 7 | `/api/queue` | `src/app/api/queue/route.ts:1-74` | `GET`, `POST` | `300s` | `queue.ts` worker pool | `STATICALLY VERIFIED` |
| 8 | `/api/telegram` | `src/app/api/telegram/route.ts:1-49` | `GET`, `POST` | Default | `telegramPoller.ts` | `RUNTIME VERIFIED` |
| 9 | `/api/forms/submit` | `src/app/api/forms/submit/route.ts:1-44` | `POST` | `300s` | `dbTables` & `engine.ts` | `STATICALLY VERIFIED` |
| 10 | `/api/db` | `src/app/api/db/route.ts:1-36` | `GET`, `POST`, `DELETE` | Default | `dbTables` (`store.ts`) | `STATICALLY VERIFIED` |
| 11 | `/api/secrets` | `src/app/api/secrets/route.ts:1-32` | `GET`, `POST`, `DELETE` | Default | `secrets` (`store.ts`) | `STATICALLY VERIFIED` |
| 12 | `/api/ai-builder` | `src/app/api/ai-builder/route.ts:1-285` | `POST` | Default | Gemini API & DAG Auto-Layout | `RUNTIME VERIFIED` |
| 13 | `/api/webhook/[...path]` | `src/app/api/webhook/[...path]/route.ts:1-77` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `300s` | Dynamic Webhook Receiver | `STATICALLY VERIFIED` |
| 14 | `/api/events` | `src/app/api/events/route.ts:1-72` | `GET` | Default | `workflowBus` (SSE & Polling) | `STATICALLY VERIFIED` |

---

## 2. In-Depth Endpoint Specifications

### 1. `/api/workflows`
- **File**: `src/app/api/workflows/route.ts`
- **`GET`**: Returns all workflows in `data/db.json` sorted by `updatedAt` descending. Returns `200 OK` with `Workflow[]`.
- **`POST`**: Creates a new workflow with single `manual_trigger` node and empty edges. Request body: `{ "name": string }`. Returns `201 Created` with `Workflow`.

### 2. `/api/workflows/[id]`
- **File**: `src/app/api/workflows/[id]/route.ts`
- **`GET`**: Returns workflow by ID or `404 Not Found`.
- **`PUT`**: Updates workflow parameters, nodes, edges, active state; triggers `syncSchedules(workflows.list())` to reschedule cron jobs. Returns `200 OK` with updated `Workflow`.
- **`DELETE`**: Deletes workflow from `db.json` and unschedules cron tasks. Returns `200 OK` `{ "ok": true }`.

### 3. `/api/workflows/[id]/run`
- **File**: `src/app/api/workflows/[id]/run/route.ts` (`maxDuration = 300`)
- **`POST`**: Enqueues manual execution.
  - Body: `{ "triggerNodeId"?: string, "triggerData"?: Record<string, unknown> }`.
  - Dispatches `enqueueWorkflowRun(wf, { mode: "manual", priority: 2, waitForCompletion: true })`.
  - Returns `200 OK` with completed `Execution` object or `500 Internal Server Error`.

### 4. `/api/workflows/[id]/live`
- **File**: `src/app/api/workflows/[id]/live/route.ts`
- **`GET`**: Polls active execution state for a workflow. Returns `200 OK` `{ "running": boolean, "execution": Execution | null }`.

### 5. `/api/workflows/run-parallel`
- **File**: `src/app/api/workflows/run-parallel/route.ts` (`maxDuration = 300`)
- **`POST`**: Executes batch workflows concurrently using `Promise.all`. Body: `{ "workflowIds": string[] }`. Returns `200 OK` `{ "results": Execution[] }`.

### 6. `/api/executions`
- **File**: `src/app/api/executions/route.ts`
- **`GET`**: Returns execution history, optionally filtered by `?workflowId=<ID>` or `?id=<EXEC_ID>`.
- **`DELETE`**: Clears execution history from `data/db.json`. Returns `200 OK` `{ "ok": true }`.

### 7. `/api/queue`
- **File**: `src/app/api/queue/route.ts` (`maxDuration = 300`)
- **`GET`**: Returns queue state `{ state, config, activeWorkers, queuedJobs, completedJobs }`.
- **`POST`**: Supports queue actions:
  - `"config"`: Updates `concurrency` (1-20) or `mode` (`"fifo"` / `"priority"`).
  - `"burst"`: Injects 5 to 50 synthetic test runs to stress test the worker pool.
  - `"clear"`: Purges completed job records from memory.

### 8. `/api/telegram`
- **File**: `src/app/api/telegram/route.ts`
- **`GET`**: Returns poller status `{ running, botTokenSet, lastPollTime, activeWorkflowsListening }`.
- **`POST`**: Actions:
  - `"start"`: Spawns recursive long-poller.
  - `"stop"`: Aborts long-poller loop.
  - `"simulate"`: Tests bot logic with a synthetic incoming message `{ "text": string, "chatId": number }`.

### 9. `/api/forms/submit`
- **File**: `src/app/api/forms/submit/route.ts` (`maxDuration = 300`)
- **`POST`**: Ingests public form submissions. Saves to `dbTables.insert("form_submissions", data)` and triggers matching workflows with `form_trigger`. Returns `200 OK` `{ "ok": true, "message": submitMessage }`.

### 10. `/api/db`
- **File**: `src/app/api/db/route.ts`
- **`GET`**: Lists tables or queries records with `?table=<NAME>&limit=<NUM>`.
- **`POST`**: Inserts a record `{ "table": string, "data": Record<string, unknown> }`.
- **`DELETE`**: Clears all records from specified table `?table=<NAME>`.

### 11. `/api/secrets`
- **File**: `src/app/api/secrets/route.ts`
- **`GET`**: Returns secrets list (values masked: `sk-***`). Auto-syncs from `D:\My n8n\.env`.
- **`POST`**: Adds or updates secret `{ "key": string, "value": string }`.
- **`DELETE`**: Removes secret key `?key=<KEY>`.

### 12. `/api/ai-builder`
- **File**: `src/app/api/ai-builder/route.ts`
- **`POST`**: Generates a laid-out workflow from natural language prompt.
  - Tries Gemini API (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`).
  - Falls back to `fallbackSynthesize()` if no key or error occurs.
  - Applies topological auto-layout (`layoutGraph()`).
  - Persists workflow and returns `201 Created` with `Workflow`.

### 13. `/api/webhook/[...path]`
- **File**: `src/app/api/webhook/[...path]/route.ts` (`maxDuration = 300`)
- **`ALL` (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)**: Dynamic catch-all webhook endpoint.
  - Matches active workflows listening on normalized path and HTTP method.
  - If `respond === "lastNode"`, executes synchronously and returns downstream output JSON.
  - If `respond === "immediately"`, queues job and returns `202 Accepted` immediately.

### 14. `/api/events`
- **File**: `src/app/api/events/route.ts`
- **`GET`**:
  - If `?mode=poll`: Returns JSON snapshot of recent events.
  - Default: Opens continuous Server-Sent Events (SSE) stream (`text/event-stream`), emitting initial handshake, replaying recent events, and streaming live `workflowBus` execution frames.

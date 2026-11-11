# 12 — Known Technical Limitations & Risks

> **Stage 1 Discovery Artifact** · **Project**: FlowForge (`C:\Users\srira\.gemini\antigravity\scratch\flowforge`)  
> **Scope**: Evidence-backed architectural, concurrency, security, persistence, and execution limitations discovered in the source code, with exact file paths and line numbers.

---

## 1. Persistence & Concurrency Limitations (`src/lib/store.ts`)

### 1.1 Synchronous Full-File JSON Read/Write on Every Operation
- **Evidence**: `src/lib/store.ts:71-117` (`read()`, `write()`, `mutate()`).
- **Mechanism**: Every read or write operation calls `fs.readFileSync(DB_FILE, "utf8")` (`line 83`) and `fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8")` (`line 109`) on the entire `data/db.json` file (~827 KB currently).
- **Impact**:
  1. **Event Loop Blocking**: Because `readFileSync`, `writeFileSync`, and `JSON.stringify`/`JSON.parse` run synchronously on the main Node.js thread, every `executions.save(execution)` call (invoked at workflow start `engine.ts:95`, after *every* topological wave `engine.ts:237`, and on completion `engine.ts:255`) blocks the Node.js event loop.
  2. **Secret File Re-Parsing on Every Read**: `read()` calls `mergeSecrets(db.secrets ?? [])` (`store.ts:93`), which calls `loadEnvSecrets()` (`store.ts:62`), which synchronously checks and reads up to 4 `.env` files (`EXTERNAL_ENV_FILES`, `store.ts:8-13, 24-47`) on *every single store read* (including `workflows.list()`, `executions.list()`, `secrets.map()`, and `dbTables.list()`).
  3. **Multi-Process Race Conditions / Lost Updates**: There is no file locking, atomic rename (`writeFileSync` writes directly to `DB_FILE` without a `.tmp` swap), or transactional isolation. If multiple OS processes or serverless workers write concurrently, `db.json` can suffer torn writes or lost updates.

### 1.2 Hard-Coded External Path Dependency (`D:\My n8n\.env`)
- **Evidence**: `src/lib/store.ts:8-13`.
- **Mechanism**: `EXTERNAL_ENV_FILES` hardcodes Windows drive paths `"D:\\My n8n\\.env"` and `"D:\\My n8n\\.env.local"`.
- **Impact**:
  1. Non-portable across machines or containers where `D:\My n8n` does not exist (though `fs.existsSync(filePath)` at `line 25` prevents crashes).
  2. **Undeletable `.env` Secrets**: In `mergeSecrets()` (`store.ts:61-69`), `envSecrets` are loaded first into `byKey`. If a user deletes a secret via `DELETE /api/secrets?key=...` (`store.ts:188-191`), the very next `read()` call re-imports that secret from `D:\My n8n\.env` or `.env.local` and writes it back to `data/db.json` (`store.ts:93, 100`).

### 1.3 Un-deletable Starter Workflows
- **Evidence**: `src/lib/store.ts:85-92`.
- **Mechanism**: During `read()`, any workflow in `STARTER_WORKFLOWS` whose `id` is not present in `db.workflows` is automatically re-inserted (`existingWf.unshift(structuredClone(tmpl))`).
- **Impact**: If a user deletes one of the 4 starter workflows via `DELETE /api/workflows/[id]` (`store.ts:147-151`), the next `read()` immediately resurrects it from `STARTER_WORKFLOWS`.

---

## 2. Security & Sandbox Boundaries

### 2.1 Zero Authentication or RBAC on All API Routes
- **Evidence**: All 13 route handlers under `src/app/api/**` (`workflows`, `executions`, `secrets`, `db`, `queue`, `telegram`, `forms/submit`, `webhook/[...path]`, `ai-builder`, `events`).
- **Impact**:
  - Any unauthenticated caller with network access to port 3000 can list/modify/delete workflows, overwrite secrets (`POST /api/secrets`), clear database tables (`DELETE /api/db`), or trigger arbitrary workflow executions.
  - Incoming webhooks (`/api/webhook/[...path]`, `src/app/api/webhook/[...path]/route.ts:7-77`) do not enforce built-in authentication headers or tokens at the route level (signature verification is only available if the workflow explicitly chains a `razorpay` node with `operation: "verify"` at `src/lib/executors.ts:582-590`).

### 2.2 Arbitrary OS Command Execution & Unrestricted File System Access
- **Evidence**:
  - `exec` node (`src/lib/executors.ts:673-690`): Executes `execP(s(p.command), { cwd: s(p.cwd) || process.cwd(), ... })` via `node:child_process`.
  - `read_file` / `write_file` nodes (`src/lib/executors.ts:649-672`): Resolves paths via `path.resolve(s(p.path))` (`lines 653, 666`) with no directory chroot/jail restriction.
- **Impact**: Combined with unauthenticated API routes, any client that can create/update and run a workflow can read/write arbitrary files on the host OS or execute arbitrary shell commands under the Node.js user account.

### 2.3 `node:vm` Sandbox Escape & Async Timeout Limitations
- **Evidence**:
  - Expression evaluator (`src/lib/expressions.ts:15-47`): `vm.runInNewContext("(${code})", sandbox, { timeout: 1000 })` (`line 43`).
  - `code` node executor (`src/lib/executors.ts:323-350`): `await vm.runInNewContext(script, sandbox, { timeout: 5000 })` (`line 344`).
- **Impact**:
  1. **Not a Security Sandbox**: Node.js documentation explicitly notes that `node:vm` is not a security mechanism against untrusted code; furthermore, `sandbox` in `executors.ts:326-342` exposes host globals including `$secrets: rc.secrets` (all raw plaintext secrets), `fetch`, `Buffer`, `crypto`, and `console`.
  2. **Async Timeout Limitation in `vm.runInNewContext`**: The `{ timeout: 5000 }` option in `vm.runInNewContext` only bounds synchronous CPU execution until the async IIFE `(async () => { ... })()` returns its initial `Promise`. An `await new Promise(() => {})` or slow `await fetch(...)` inside the `code` node will not be terminated by `vm`'s 5000ms synchronous timeout.

### 2.4 Plaintext Secrets on Disk & In-Context Exposure
- **Evidence**: `src/lib/store.ts:58, 109`, `src/lib/engine.ts:111, 157`, `src/lib/executors.ts:330`.
- **Impact**:
  - While `GET /api/secrets` masks values in the UI (`src/app/api/secrets/route.ts:4`), `data/db.json` stores all synced `.env` and vault secrets in plaintext (`store.ts:58, 109`).
  - Every node expression (`{{ JSON.stringify($secrets) }}`) or `code` node (`$secrets`) has read access to the entire `secrets.map()` dictionary.

---

## 3. Workflow Engine & DAG Execution Limitations (`src/lib/engine.ts` & `src/lib/executors.ts`)

### 3.1 Strict Acyclic Graph (No Graph Loops)
- **Evidence**: `planParallelWaves()` in `src/lib/engine.ts:44-83`.
- **Mechanism**: Computes topological waves using Kahn's in-degree algorithm (`lines 57-77`). If `visited !== reachable.size` (`line 79`), throws `new Error("Workflow contains a cycle — loops are not supported")` (`line 80`).
- **Impact**: Workflows cannot contain feedback loops or cyclic retry edges on the canvas (iteration must be performed within a single wave via `split_out` item fan-out or inside a `code` node).

### 3.2 Diamond / Branch Skip Semantics in Topological Waves
- **Evidence**: `src/lib/engine.ts:44-83` and `134-142`.
- **Mechanism**: `planParallelWaves()` plans waves statically from all structurally reachable edges before execution begins (`lines 45-56`), regardless of whether an `if` node will take the `"true"` or `"false"` handle at runtime. During wave execution, if a node is not the trigger and `input.length === 0` (`line 139`), it is marked `status: "skipped"` (`line 140`).
- **Impact**: This works cleanly for divergent branches, and if a downstream `merge` node receives items from at least one active branch (`input.length > 0`), it runs once the wave completes. However, `planParallelWaves` sets `indeg` based on *all* reachable edges (`line 58`), which assumes a strict DAG without cyclic dependencies.

### 3.3 Sequential Item Iteration Inside `"each"` Mode Executors
- **Evidence**: `src/lib/engine.ts:167-179`.
- **Mechanism**: Although nodes within the same topological wave run in parallel via `Promise.all(wave.map(...))` (`line 126`), inside a single node whose executor has `mode: "each"`, multiple input items are processed sequentially via `for (const item of input) { ... await executor.run(params, item, rc); }` (`lines 169-171`).
- **Impact**: If `split_out` emits 50 items into an `http_request` node, those 50 HTTP requests execute sequentially one-by-one rather than concurrently (unlike `parallel_web`, which uses `Promise.all` internally across its URL list at `executors.ts:191`).

### 3.4 Unused `concurrency` Parameter on `parallel_web` Node
- **Evidence**: `src/lib/nodes.ts:141-145` vs. `src/lib/executors.ts:165-280`.
- **Mechanism**: `NODE_DEFS` defines a `concurrency` number field (`default: 10`) on `parallel_web` (`nodes.ts:141-145`), and `templates.ts:29` sets `concurrency: 10`. However, `EXECUTORS.parallel_web` (`executors.ts:191`) runs `await Promise.all(urlList.map(...))` across all URLs at once without reading `p.concurrency` to chunk or semaphore-limit the requests.

### 3.5 Node Output Lookup Keyed by `node.name` (Collision Risk)
- **Evidence**: `src/lib/engine.ts:184, 211`.
- **Mechanism**: `rc.nodeOutputs[node.name] = { json: all[0]?.json ?? {}, items: all }`.
- **Impact**: Downstream expressions like `{{ $node["Node Name"].json }}` reference nodes by display `name` rather than `id`. If two nodes in a workflow are given the same display name, the later node overwrites `rc.nodeOutputs[node.name]`.

### 3.6 Silent Fallback in `gemini` Executor Masks Upstream API Failures
- **Evidence**: `src/lib/executors.ts:432-440`.
- **Mechanism**: If all 4 Gemini candidate models throw an error (e.g., invalid API key, network outage, or 503 overload), the `catch` block inside the loop swallows the error (`lines 428-430`) and returns a synthetic object with `model: "gemini-adaptive-fallback"` and `isLive: true` (`lines 434-440`).
- **Impact**: Because it never throws, node-level `retryCount` and `continueOnError` (`engine.ts:149-234`) are never triggered for `gemini` nodes, and the execution is marked `"success"` even when the live Gemini API call failed.

---

## 4. In-Memory Runtime State Limitations (`queue.ts`, `scheduler.ts`, `telegramPoller.ts`, `events.ts`)

| Subsystem | Global State Variable | Limitation & Restart Behavior |
| :--- | :--- | :--- |
| **Worker Pool & Job Queue** (`src/lib/queue.ts:70-88`) | `globalThis.__ffQueue` | Queue configuration (`mode`, `concurrency` default `6`), `activeSlots`, and `entries` (capped at `MAX_JOB_HISTORY = 120`, `line 75`) live solely in RAM. Restarting the Next.js server resets `concurrency` to `6`, `mode` to `"parallel_pool"`, and drops any `queued` or `running` jobs. |
| **UI Concurrency Slider vs. API Cap** (`src/components/QueueDashboard.tsx:225, 315` vs. `src/lib/queue.ts:91, 378`) | `effectiveConcurrency` | Backend `queue.ts:91, 378` allows `concurrency` up to `20`, whereas `QueueDashboard.tsx:225, 315` caps the range slider `max={16}` and clamps `effectiveConcurrency` to `Math.min(16, ...)`. |
| **Cron Scheduler** (`src/lib/scheduler.ts:10-14, 40-69`) | `globalThis.__ffCronJobs`, `__ffCronTimer`, `__ffLastMinute` | `matchesCron()` (`lines 40-51`) evaluates `d.getMinutes()`, `d.getHours()`, etc. using the host OS local clock, **ignoring** the `timezone` field configured on `schedule_trigger` (`src/lib/nodes.ts:71`). Furthermore, `scheduler.ts:64` calls `runWorkflow(...)` directly rather than `enqueueWorkflowRun(...)`, bypassing the worker pool telemetry in `queue.ts`. |
| **Telegram Long-Poller** (`src/lib/telegramPoller.ts:15-21, 44-65`) | `globalThis.__ffTgOffset`, `__ffTgLogs` |1. `triggerTelegramWorkflows()` (`lines 48-50`) only triggers **at most one** workflow (`candidates[0]`), even if multiple active workflows have `telegram_trigger` nodes.<br>2. If *no* workflow with `telegram_trigger` is active, `candidates[0] ?? workflows.list().find(...)` (`lines 48-50`) still triggers an **inactive (Draft)** workflow.<br>3. Calls `runWorkflow()` directly (`line 56`) rather than `enqueueWorkflowRun()`, bypassing the queue dashboard.<br>4. Cannot run across multiple server instances simultaneously with the same `TELEGRAM_BOT_TOKEN` (`getUpdates` conflict HTTP 409). |
| **Event Bus (SSE)** (`src/lib/events.ts:19-48`) | `globalThis.__ffEventBus` | Retains `recentEvents` (max 50) in memory (`lines 21, 32`). Note that `src/app/page.tsx:317-359` currently polls `GET /api/workflows/[id]/live` every 1000ms rather than subscribing to `/api/events` via `EventSource`. |

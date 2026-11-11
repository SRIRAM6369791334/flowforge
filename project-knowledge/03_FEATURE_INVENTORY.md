# 03 — Feature Inventory

> **Scope**: Exhaustive discovery of all 13 product features in **FlowForge** (`C:\Users\srira\.gemini\antigravity\scratch\flowforge`).
> **Verification Rule**: Every feature is backed by exact source file paths, React state hooks, component mappings, API routes, service dependencies, and line numbers.

---

## Feature Summary Matrix

| # | Feature Name | Primary Frontend Location | Backend API Endpoint(s) | Core Service / Engine | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Visual DAG Canvas** | `src/app/page.tsx` (`L1415-L1453`) | `GET /api/workflows`, `PUT /api/workflows/[id]` | `@xyflow/react`, `src/lib/nodes.ts` | **CONFIRMED** |
| 2 | **Slide-over Node Inspector** | `src/components/Inspector.tsx` (`L145-L728`) | `PUT /api/workflows/[id]`, `POST /api/workflows/[id]/run` | `src/lib/nodes.ts` (`NODE_MAP`) | **CONFIRMED** |
| 3 | **Collapsible Telemetry Dock** | `src/app/page.tsx` (`L1470-L2004`, `L2008-L2084`) | `/api/queue`, `/api/db`, `/api/executions`, `/api/telegram` | `QueueDashboard.tsx`, `store.ts` | **CONFIRMED** |
| 4 | **Concurrent Worker Pool & Queue Stress Tester** | `src/components/QueueDashboard.tsx` (`L70-L669`) | `GET/POST /api/queue`, `POST /api/workflows/run-parallel` | `src/lib/queue.ts` (`globalThis.__ffQueue`) | **CONFIRMED** |
| 5 | **AI Workflow Builder (`Cmd+K`)** | `src/app/page.tsx` (`L1357-L1371`, `L2088-L2154`) | `POST /api/ai-builder` | `src/app/api/ai-builder/route.ts` (Gemini REST + heuristic fallback) | **CONFIRMED** |
| 6 | **2-Way Live Telegram Bot Listener** | `src/app/page.tsx` (`L1860-L1922`) | `GET/POST /api/telegram` | `src/lib/telegramPoller.ts`, `src/lib/executors.ts` (`telegram`) | **CONFIRMED** |
| 7 | **Parallel 5-Website Scraper & Monitor** | `src/app/page.tsx` (`L1650-L1687`), `CanvasNode.tsx` (`L59-L64`) | `POST /api/forms/submit`, `POST /api/workflows/[id]/run` | `src/lib/executors.ts` (`parallel_web` `L165-L280`) | **CONFIRMED** |
| 8 | **Public Interactive Forms (Mini-Apps)** | `src/app/page.tsx` (`L1924-L1999`) | `POST /api/forms/submit` | `src/app/api/forms/submit/route.ts`, `src/lib/engine.ts` | **CONFIRMED** |
| 9 | **Secrets Vault** | `src/app/page.tsx` (`L1268-L1278`, `L2157-L2257`) | `GET/POST/DELETE /api/secrets` | `src/lib/store.ts` (`secrets`, `.env` sync `L8-L69`) | **CONFIRMED** |
| 10 | **Execution History & Live 1s Polling Sync** | `src/app/page.tsx` (`L317-L359`, `L1771-L1856`) | `GET /api/workflows/[id]/live`, `GET/DELETE /api/executions`, `GET /api/events` | `src/lib/store.ts` (`executions`), `src/lib/events.ts` (`workflowBus`) | **CONFIRMED** |
| 11 | **Database Table Explorer** | `src/app/page.tsx` (`L1692-L1769`) | `GET/POST/DELETE /api/db` | `src/lib/store.ts` (`dbTables` `L195-L231`), `src/lib/executors.ts` (`db_query`) | **CONFIRMED** |
| 12 | **Auto-Layout DAG** | `src/app/page.tsx` (`L469-L495`, `L1279-L1292`) | Client-side + `POST /api/ai-builder` (`layoutGraph` `L45-L69`) | Topological rank column layout algorithm | **CONFIRMED** |
| 13 | **Export / Import Workflow JSON** | `src/app/page.tsx` (`L558-L600`, `L1294-L1319`) | `POST /api/workflows`, `PUT /api/workflows/[id]` | Browser `Blob` download & `File.text()` JSON parser | **CONFIRMED** |

---

## 1. Visual DAG Canvas

- **Feature Name**: Visual Directed Acyclic Graph (DAG) Workflow Canvas & Collapsible Node Palette
- **User Purpose**: Allows users to visually author, connect, inspect, pan/zoom, and execute multi-step workflow graphs with live node status rings, parallel wave badges, and animated branch edges (`main`, `true`, `false`).
- **Frontend Screen**: Main Studio Workspace (`src/app/page.tsx`: collapsible left sidebar at `L973-L1214`, top header bar at `L1219-L1352`, hero ReactFlow canvas at `L1354-L1453`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L122-L2260`)
  - `CanvasNode` (`src/components/CanvasNode.tsx` `L101-L304`)
  - `NodeIcon` (`src/components/NodeIcon.tsx` `L61-L64`)
  - `@xyflow/react` primitives: `ReactFlow`, `Background`, `Controls`, `MiniMap`, `Handle` (`src/app/page.tsx` `L4-L15`, `src/components/CanvasNode.tsx` `L4`)
- **Backend API**:
  - `GET /api/workflows` (`src/app/api/workflows/route.ts` `L4-L6`) — Loads all workflows on startup.
  - `POST /api/workflows` (`src/app/api/workflows/route.ts` `L8-L10`) — Creates a new workflow.
  - `PUT /api/workflows/[id]` (`src/app/api/workflows/[id]/route.ts` `L13-L25`) — Persists canvas nodes, edges, workflow name, and `active` flag.
  - `DELETE /api/workflows/[id]` (`src/app/api/workflows/[id]/route.ts` `L27-L31`) — Deletes a workflow.
- **Related Services**:
  - `src/lib/nodes.ts`: `NODE_DEFS` (`L7-L579`), `NODE_MAP` (`L581`), `CATEGORIES` (`L583-L593`), `defaultParams` (`L595-L598`).
  - `src/lib/templates.ts`: `STARTER_WORKFLOWS` (`L3-L309`) — 4 pre-built starter workflows auto-seeded into the store.
- **Database Dependencies**:
  - `workflows` collection in `data/db.json` managed via `src/lib/store.ts` (`L120-L152`).
- **External Integrations**: None directly during canvas editing (pure ReactFlow state + local JSON persistence).
- **Execution Flow**:
  1. On mount, `loadWorkflows()` (`src/app/page.tsx` `L269-L281`) fetches `GET /api/workflows` and invokes `selectWorkflow(list[0])` (`L242-L267`).
  2. `selectWorkflow` fetches the latest execution from `/api/executions?workflowId=${wf.id}` (`L248`) and converts `WorkflowNode[]` and `WorkflowEdge[]` into ReactFlow state via `toRfNodes()` (`L86-L106`) and `toRfEdges()` (`L108-L118`).
  3. Users expand the left sidebar (`sidebarCollapsed` state `L130`, toggled at `L978-L1033`) to browse 20 node definitions grouped across 9 `CATEGORIES` (`L1121-L1173`) with real-time search filtering (`filteredDefs` `L928-L937`), or switch to the `workflows` tab (`L1177-L1211`) to switch/delete workflows.
  4. Clicking a node in the palette invokes `addNodeOfType(type)` (`L622-L661`), which creates a new `flowNode` offset `+290px` horizontally from the selected/last node (`L629`) and automatically wires an edge if the previous node is not a trigger (`L642-L657`).
  5. Dragging connections between handles invokes `onConnect` (`L602-L619`), coloring edges `#10b981` (emerald) for `"true"`, `#f43f5e` (rose) for `"false"`, and `#6366f1` (indigo) for `"main"` (`L613`).
  6. `CanvasNode` (`src/components/CanvasNode.tsx` `L101-L304`) renders category color accents (`getCategoryColor` `L45-L48`), parameter summaries (`summarize` `L57-L99`), resilience badges (`retryCount` and `continueOnError` `L188-L209`), live execution status (`Running`,duration in `ms`, `wave N`, `Error`, `Skipped`, or `Idle` `L212-L254`), and dynamic output handles (`L257-L301`).
- **Current Implementation Status**: **CONFIRMED**

---

## 2. Slide-over Node Inspector

- **Feature Name**: Slide-over Node Inspector & Syntax-Highlighted JSON Payload Viewer
- **User Purpose**: Enables per-node configuration of parameters, 1-click expression insertion (`$json`, `$secrets`, `$node`, `$today`), live webhook URL copying, retry/error-shield resilience settings, single-node trigger execution, and inspection of syntax-highlighted input/output JSON items per execution wave.
- **Frontend Screen**: Right-hand slide-over drawer (`src/app/page.tsx` `L1456-L1467`) rendered when `selectedWfNode` (`L663-L676`) is non-null.
- **Related React Components**:
  - `Inspector` (`src/components/Inspector.tsx` `L145-L639`)
  - `FieldInput` (`src/components/Inspector.tsx` `L641-L728`)
  - `SyntaxJsonViewer` (`src/components/Inspector.tsx` `L118-L143`) & `highlightJsonTokens` (`L48-L116`)
  - `NodeIcon` (`src/components/NodeIcon.tsx` `L61-L64`)
- **Backend API**:
  - `PUT /api/workflows/[id]` (`src/app/api/workflows/[id]/route.ts` `L13-L25`) — Triggered when saving changes made in the Inspector.
  - `POST /api/workflows/[id]/run` (`src/app/api/workflows/[id]/run/route.ts` `L7-L23`) — Triggered when clicking the orange Play button (`onRunFromHere` `src/components/Inspector.tsx` `L259-L267`) on a trigger node.
- **Related Services**:
  - `src/lib/nodes.ts`: `NODE_MAP` (`L581`) supplies `fields` metadata (`FieldDef[]`) for each node type.
  - `src/lib/expressions.ts`: Evaluates expressions inserted via `QUICK_EXPRESSIONS` (`src/components/Inspector.tsx` `L32-L37`) during workflow execution.
- **Database Dependencies**: Updates in-memory ReactFlow node state via `updateSelectedNode` (`src/app/page.tsx` `L678-L698`) and marks `dirty = true`; persisted to `data/db.json` when `saveWorkflow()` (`L414-L439`) or `handleRun()` (`L441-L467`) is called.
- **External Integrations**: Browser `navigator.clipboard` API (`src/components/Inspector.tsx` `L176`, `L183`, `L213`) for copying Webhook URLs, expression chips, and Input/Output JSON payloads.
- **Execution Flow**:
  1. Clicking any node on the ReactFlow canvas sets `selectedNodeId` (`src/app/page.tsx` `L1430`), computing `selectedWfNode` (`L663-L676`) and mounting `<Inspector />` (`L1458-L1465`).
  2. In the **Header** (`src/components/Inspector.tsx` `L225-L283`), users can inline-edit `node.name` (`L240-L245`), run the workflow from that trigger node (`onRunFromHere` `L259-L267`), delete the node (`onDelete` `L268-L274`), or close the drawer (`onClose` `L275-L281` or `Escape` key in `src/app/page.tsx` `L518-L522`).
  3. In the **Parameters Tab** (`src/components/Inspector.tsx` `L334-L500`):
     - If `node.type === "webhook_trigger"`, displays a live orange callout with `${window.location.origin}/api/webhook/${path}` and a copy button (`L169-L179`, `L337-L368`).
     - Renders 4 `QUICK_EXPRESSIONS` chips (`{{ $json }}`, `{{ $secrets.API_KEY }}`, `{{ $node['Previous Node'].json }}`, `{{ $today }}`) (`L32-L37`, `L370-L406`). Clicking a chip calls `handleInsertExpression(expr)` (`L181-L209`), which copies the expression to clipboard and appends it to the currently focused text/textarea/code/json field (`focusedFieldKey`) or the first text-compatible field.
     - Renders dynamic `FieldInput` controls (`L409-L420`, `L641-L728`) supporting `"select"`, `"boolean"`, `"textarea"`, `"json"`, `"code"`, `"number"`, and `"text"`.
     - For non-trigger nodes (`!meta.isTrigger` `L423`), renders the **Retry & Resilience** accordion (`L424-L498`) configuring `retryCount` (`0–5` `L453-L462`), `retryDelayMs` (`>=50ms` `L468-L477`), and `continueOnError` (`L482-L493`).
  4. In the **Output Data Tab** (`L502-L583`) and **Input Data Tab** (`L585-L635`), displays item counts (`getOutputItemCount` `L39-L43`), execution wave badge (`Wave N`), duration (`ms`), error banner (`L570-L577`), copy JSON button (`copyJsonPayload` `L211-L217`), and line-numbered syntax-highlighted JSON via `SyntaxJsonViewer` (`L118-L143`).
- **Current Implementation Status**: **CONFIRMED**

---

## 3. Collapsible Telemetry Dock

- **Feature Name**: Bottom Dev Console & Telemetry Overlay Drawer + 32px Status Bar
- **User Purpose**: Provides a unified, collapsible multi-tab developer console at the bottom of the studio for monitoring and controlling the Concurrent Worker Pool, Database Tables, Execution History, and 2-Way Telegram Bot & Public Forms without leaving the canvas.
- **Frontend Screen**: Bottom overlay drawer (`src/app/page.tsx` `L1470-L2004`) and persistent 32px footer status bar (`L2008-L2084`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L155-L158`, `L911-L918`, `L1470-L2084`)
  - `QueueDashboard` (`src/components/QueueDashboard.tsx` `L70-L669`)
- **Backend API**:
  - `GET /api/queue` (`src/app/page.tsx` `L293`) — Polled every 3s for status bar badge metrics.
  - `GET /api/db` (`src/app/page.tsx` `L850`) — Fetched when opening the `"database"` tab.
  - `GET /api/executions` (`src/app/page.tsx` `L864`) — Fetched when opening the `"executions"` tab.
  - `GET /api/telegram` (`src/app/page.tsx` `L813`) — Fetched when opening the `"telegram"` tab.
- **Related Services**: `src/lib/queue.ts`, `src/lib/store.ts`, `src/lib/telegramPoller.ts`.
- **Database Dependencies**: Reads `executions` and `records` from `data/db.json` via `/api/executions` and `/api/db`.
- **External Integrations**: None directly (delegates to child tabs).
- **Execution Flow**:
  1. By default, `dockExpanded` is `false` (`src/app/page.tsx` `L156`) to give 100% viewport height to the ReactFlow canvas.
  2. The persistent 32px `<footer>` (`L2008-L2084`) displays live status pills:
     - `⚡ Worker Pool: {concurrency}x {running > 0 ? 'N Running' : 'Idle'}` (`L2011-L2026`)
     - `Database: {totalDbCount} records` (`L2030-L2039`)
     - `Last Run: {Success | Failed | Ready}` (`L2043-L2050`)
     - `Console & Queue` toggle button (`L2055-L2071`) and `Fullscreen` toggle button (`L2075-L2082`, invoking `toggleFullscreen` `L383-L391`).
  3. Clicking any status pill or dock tab invokes `handleDockTabClick(tab)` (`L912-L918`), which sets `dockTab` (`"queue" | "database" | "executions" | "telegram"`), sets `dockExpanded = true`, and triggers the corresponding data loader (`loadDatabase()`, `loadExecutions()`, or `loadTelegramStatus()`).
  4. Users can toggle the dock height between `"compact"` (`360px`) and `"tall"` (`540px`) (`L158`, `L1473`, `L1558-L1567`) or close it via the `X` button (`L1570-L1575`) or `Escape` key (`L522`).
- **Current Implementation Status**: **CONFIRMED**

---

## 4. Concurrent Worker Pool & Queue Stress Tester

- **Feature Name**: Concurrent Parallel Job Queue, Worker Pool Engine & Burst Traffic Stress Simulator
- **User Purpose**: Queues incoming workflow runs (manual, webhook, schedule, telegram, form, parallel batch) and processes them across a configurable pool of concurrent workers (`1x` to `20x` in backend, `1x` to `16x` slider in UI) or strict `1x` Sequential FIFO mode, with 1-click traffic burst simulation (`5x`, `10x`, `20x`) and multi-workflow batch execution.
- **Frontend Screen**: Dock Tab 1 (`dockTab === "queue"`) in `src/app/page.tsx` (`L1582-L1689`) and `src/components/QueueDashboard.tsx` (`L70-L669`).
- **Related React Components**:
  - `QueueDashboard` (`src/components/QueueDashboard.tsx` `L70-L669`)
  - Multi-Workflow Parallel Batch card in `FlowForgeStudio` (`src/app/page.tsx` `L1593-L1647`)
- **Backend API**:
  - `GET /api/queue` (`src/app/api/queue/route.ts` `L15-L17`) — Returns live `QueueState`.
  - `POST /api/queue` (`src/app/api/queue/route.ts` `L19-L119`) — Supports `action: "config" | "enqueue" | "burst" | "clear"`.
  - `POST /api/workflows/run-parallel` (`src/app/api/workflows/run-parallel/route.ts` `L7-L42`) — Enqueues multiple selected workflows concurrently via `Promise.all`.
- **Related Services**:
  - `src/lib/queue.ts` (`L1-L390`): Singleton store on `globalThis.__ffQueue` (`L70-L88`), `pumpQueue()` (`L114-L184`), `enqueueWorkflowRun()` (`L186-L227`), `enqueueBurstRuns()` (`L229-L283`), `getQueueState()` (`L285-L367`), `setQueueConfig()` (`L369-L382`), `clearFinishedJobs()` (`L384-L390`).
  - `src/lib/engine.ts`: `runWorkflow()` (`L85-L266`) executed by each active worker slot.
- **Database Dependencies**:
  - Queue state is held in-memory on `globalThis.__ffQueue` (capped at `MAX_JOB_HISTORY = 120` jobs at `src/lib/queue.ts` `L75`, `L103-L112`).
  - Every workflow execution run by a worker persists its `Execution` record to `data/db.json` via `executions.save()` (`src/lib/engine.ts` `L95`, `L237`, `L255`).
- **External Integrations**: Executes whatever external integrations are inside the queued workflows.
- **Execution Flow**:
  1. `QueueDashboard` polls `GET /api/queue` every `1500ms` (`src/components/QueueDashboard.tsx` `L100-L126`) and updates parent badge stats via `onQueueStatsChange`.
  2. **Mode & Concurrency Config**: Clicking `Parallel Worker Pool` or `Sequential FIFO` (`L269-L294`) or dragging the `Pool Concurrency` range slider (`1..16` `L312-L330`) calls `updateConfig(mode, concurrency)` (`L128-L148`), which sends `POST /api/queue` with `{ action: "config", mode, concurrency }`. `setQueueConfig()` (`src/lib/queue.ts` `L369-L382`) updates `globalThis.__ffQueue` and immediately calls `pumpQueue()`.
  3. **Priority Enqueue (`+1 Priority`)**: Clicking `+1 Priority` (`src/components/QueueDashboard.tsx` `L381-L393`) calls `handleEnqueueSingle(10)` (`L189-L210`), posting `{ action: "enqueue", workflowId, priority: 10, wait: false }` to `/api/queue`.
  4. **Simulate Traffic Burst (`Fire Burst`)**: Selecting `5x`, `10x`, or `20x` (`L350-L364`) and clicking `Fire Burst` (`L395-L406`) calls `handleFireBurst()` (`L150-L187`), posting `{ action: "burst", burstCount, workflowIds }` to `/api/queue`. `enqueueBurstRuns()` (`src/lib/queue.ts` `L229-L283`) generates `burstItems` with rotating priorities `1..3` (`L250`) and `minSimMs: 220` (`L262`), firing all jobs concurrently via `Promise.all` (`L256-L272`) and measuring `parallelWallTimeMs` (`L274`).
  5. **Worker Slot Allocation (`pumpQueue`)**: While `store.activeSlots.size < maxWorkers` (`src/lib/queue.ts` `L118`), `pumpQueue` sorts queued jobs by `priority DESC, seq ASC` in `parallel_pool` mode or `seq ASC` in `sequential_fifo` mode (`L123-L127`), assigns the lowest free worker slot `1..maxWorkers` (`allocateWorkerSlot` `L94-L101`), records `waitTimeMs`, and runs `runWorkflow` asynchronously (`L142-L182`). When a worker finishes, its `finally` block frees the slot (`store.activeSlots.delete(slot)` `L169`), resolves waiting callers (`L171-L177`), trims history (`L179`), and recursively calls `pumpQueue()` (`L180`).
  6. **Multi-Workflow Parallel Batch**: In `src/app/page.tsx` (`L1594-L1647`), users toggle workflow pills (`selectedBatchWfs`) and click `Run N Batch` (`runParallelBatch` `L730-L748`), which posts `{ workflowIds }` to `POST /api/workflows/run-parallel` (`src/app/api/workflows/run-parallel/route.ts` `L7-L42`).
- **Current Implementation Status**: **CONFIRMED**

---

## 5. AI Workflow Builder (`Cmd+K`)

- **Feature Name**: Floating Spotlight AI Workflow Architect (`Cmd+K` / `Ctrl+K`)
- **User Purpose**: Converts natural language prompts (in English or Tanglish) or 1-click prompt templates into complete, auto-laid-out, multi-branch parallel workflows saved directly to the studio.
- **Frontend Screen**: Top-center floating `AI Workflow Builder ⌘K` pill (`src/app/page.tsx` `L1357-L1371`), left rail wand icon (`L1015-L1021`), and Spotlight modal overlay (`L2088-L2154`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L79-L84`, `L135-L140`, `L516-L520`, `L535-L556`, `L2088-L2154`)
- **Backend API**:
  - `POST /api/ai-builder` (`src/app/api/ai-builder/route.ts` `L206-L285`)
- **Related Services**:
  - `src/app/api/ai-builder/route.ts`: `SYSTEM_PROMPT` (`L6-L42`), `layoutGraph()` (`L45-L69`), `fallbackSynthesize()` (`L71-L204`).
  - `src/lib/nodes.ts`: `NODE_MAP` (`L581`) and `defaultParams` (`L595-L598`).
  - `src/lib/store.ts`: `secrets.map()` (`L180`) and `workflows.create()` (`L123-L139`).
- **Database Dependencies**: Creates and persists the generated `Workflow` (`active: true`) into `data/db.json` via `workflows.create()` (`src/app/api/ai-builder/route.ts` `L264-L268`, `L279-L283`).
- **External Integrations**:
  - Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`) with `responseMimeType: "application/json"` and `12_000ms` timeout across fallback models `["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]` (`src/app/api/ai-builder/route.ts` `L216-L234`).
- **Execution Flow**:
  1. Pressing `Cmd+K` / `Ctrl+K` (`src/app/page.tsx` `L516-L517`) or clicking the floating button (`L1359`) opens `aiModalOpen` and auto-focuses `aiInputRef` (`L529-L533`).
  2. Users enter a custom prompt or click one of the 4 `AI_BUILDER_SUGGESTIONS` (`L79-L84`, `L2139-L2149`), invoking `handleAiBuild(customPrompt)` (`L535-L556`).
  3. `handleAiBuild` sends `POST /api/ai-builder` with `{ prompt }`.
  4. In `src/app/api/ai-builder/route.ts`, if `GEMINI_API_KEY` is available in `secrets.map()` or `process.env` (`L212-L213`), it iterates through `["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]` (`L216`). If the model returns valid JSON containing `>= 2` valid nodes in `NODE_MAP` (`L244-L246`), it merges `defaultParams(n.type)` with `n.params` (`L252`), filters edges to valid node IDs (`L255-L262`), runs `layoutGraph(validNodes, validEdges)` (`L266`), saves the workflow (`L264`), and returns HTTP `201`.
  5. If `GEMINI_API_KEY` is missing or all Gemini requests fail/timeout, it executes `fallbackSynthesize(prompt)` (`L71-L204`, `L278`), a deterministic keyword heuristic synthesizer that inspects the prompt for triggers (`cron`/`schedule`, `webhook`/`razorpay`, `telegram`), data steps (`parallel_web` vs `http_request`), `gemini` AI analysis, and parallel downstream branches (`telegram`, `email`, `db_query`, `whatsapp`, `razorpay`), lays them out via `layoutGraph()`, saves the workflow, and returns HTTP `201`.
  6. On the frontend (`src/app/page.tsx` `L545-L552`), the new workflow is prepended to `workflowList`, loaded onto the canvas via `selectWorkflow(wf)`, and announced via `showToast`.
- **Current Implementation Status**: **CONFIRMED**

---

## 6. 2-Way Live Telegram Bot Listener

- **Feature Name**: 2-Way Live Telegram Bot Long-Polling Listener & Incoming Message Simulator
- **User Purpose**: Polls the live Telegram Bot API (`getUpdates`) in the background for incoming user messages, matches active workflows with a `telegram_trigger` node, executes the workflow (e.g., running Gemini AI and replying back to the sender's `chatId` via `sendMessage`), and provides a 1-click UI simulator for testing without picking up a phone.
- **Frontend Screen**: Dock Tab 4 (`dockTab === "telegram"`, left column) in `src/app/page.tsx` (`L1860-L1922`). Also auto-started on studio mount at `src/app/page.tsx` `L285` (`fetch("/api/telegram")`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L194-L209`, `L810-L844`, `L1860-L1922`)
- **Backend API**:
  - `GET /api/telegram` (`src/app/api/telegram/route.ts` `L10-L16`) — Returns current listener status; if not listening, automatically calls `startTelegramListener()`.
  - `POST /api/telegram` (`src/app/api/telegram/route.ts` `L18-L38`) — Supports `action: "start" | "stop" | "simulate"`.
- **Related Services**:
  - `src/lib/telegramPoller.ts` (`L1-L138`): `getTelegramStatus()` (`L23-L29`), `triggerTelegramWorkflows()` (`L31-L69`), `pollOnce()` (`L71-L121`), `startTelegramListener()` (`L123-L129`), `stopTelegramListener()` (`L131-L138`).
  - `src/lib/executors.ts`: `telegram_trigger` (`L138-L151`) and `telegram` action executor (`L462-L488`).
  - `src/lib/templates.ts`: Starter workflow `wf-telegram-bot-responder` (`L180-L236`).
- **Database Dependencies**:
  - Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `secrets.map()` (`src/lib/telegramPoller.ts` `L72-L73`, `src/app/api/telegram/route.ts` `L29-L32`).
  - Stores recent bot event logs in memory on `globalThis.__ffTgLogs` (up to 50 entries, returning top 30 in `getTelegramStatus()` `src/lib/telegramPoller.ts` `L27`, `L67`).
  - Triggered workflows save `Execution` records (`mode: "telegram"`) to `data/db.json` and log chat replies to the `ai_logs` table (`src/lib/templates.ts` `L220-L229`).
- **External Integrations**:
  - Telegram Bot API `GET https://api.telegram.org/bot${token}/getMe` (`src/lib/telegramPoller.ts` `L78-L84`).
  - Telegram Bot API `GET https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=1` (`src/lib/telegramPoller.ts` `L91-L94`) polled every `4500ms` (`L127`).
  - Telegram Bot API `POST https://api.telegram.org/bot${botToken}/sendMessage` (`src/lib/executors.ts` `L474-L477`) with 3-attempt linear backoff retry (`1000ms * attempt` `L472-L485`).
- **Execution Flow**:
  1. When `FlowForgeStudio` mounts, `fetch("/api/telegram")` (`src/app/page.tsx` `L285`) hits `GET /api/telegram` (`src/app/api/telegram/route.ts` `L10-L16`), which calls `startTelegramListener()` (`src/lib/telegramPoller.ts` `L123-L129`).
  2. `startTelegramListener()` sets `g.__ffTgRunning = true`, runs `pollOnce()` immediately, and starts a `4500ms` `setInterval` (`L125-L127`).
  3. `pollOnce()` resolves `TELEGRAM_BOT_TOKEN` from `secrets.map()` or `process.env` (`L72-L73`), fetches bot identity via `/getMe` (`L76-L88`), and polls `/getUpdates` (`L90-L106`). For each incoming text message (`L108-L117`), it advances `g.__ffTgOffset = upd.update_id + 1` and invokes `triggerTelegramWorkflows({ text, chatId, fromName })`.
  4. `triggerTelegramWorkflows()` (`L31-L69`) finds the first active workflow containing a `telegram_trigger` node (falling back to any workflow with `telegram_trigger` `L44-L50`), checks `commandFilter` case-insensitively (`L54-L55`), and calls `runWorkflow(targetWf, { mode: "telegram", triggerNodeId, triggerData: payload })` (`L56-L60`).
  5. Inside the workflow, `telegram_trigger` (`src/lib/executors.ts` `L138-L151`) emits `{ text, chatId, fromName, receivedAt }`, `gemini` (`L369-L442`) generates a response while preserving `chatId` and `fromName` on the output item (`L422-L423`, `L438-L439`), and `telegram` (`L462-L488`) sends the reply back to `chatId`.
  6. Users can also click `Test Reply` in the UI (`src/app/page.tsx` `L1895-L1901`) to call `simulateTelegramIncoming()` (`L829-L844`), which posts `{ action: "simulate", text: tgSimText, fromName: "Sriram" }` to `/api/telegram` (`src/app/api/telegram/route.ts` `L28-L36`), invoking `triggerTelegramWorkflows` directly.
- **Current Implementation Status**: **CONFIRMED**

---

## 7. Parallel 5-Website Scraper & Monitor

- **Feature Name**: Concurrent Multi-Website Health Auditor & HTML/JSON/Regex Scraper (`parallel_web`)
- **User Purpose**: Fetches multiple websites or REST endpoints concurrently via `Promise.all`, extracts page titles, `<h1>`, `<meta name="description">`, JSON payloads, or custom regex matches, computes parallel speedup vs sequential latency sum, and fans out results to Database, Gemini AI, local JSONL files, Telegram, and Gmail.
- **Frontend Screen**:
  - Canvas Node `parallel_web` (`src/components/CanvasNode.tsx` `L59-L64`, `src/lib/nodes.ts` `L105-L157`)
  - Dock Tab 1 Quick Auditor card: `Parallel Website Health & Scraper` (`src/app/page.tsx` `L1650-L1687`)
  - Dock Tab 4 Public Form: `🌐 Sites` (`parallel-websites` slug `src/app/page.tsx` `L1932`, `L1956-L1963`)
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L174-L178`, `L750-L769`, `L1650-L1687`)
  - `CanvasNode` (`src/components/CanvasNode.tsx` `L59-L64`)
  - `Inspector` (`src/components/Inspector.tsx` `L409-L420`)
- **Backend API**:
  - `POST /api/forms/submit` (`src/app/api/forms/submit/route.ts` `L7-L69`) — Used by `runQuickParallelWebsites()` (`src/app/page.tsx` `L750-L769`) with `formSlug: "parallel-websites"`.
  - `POST /api/workflows/[id]/run` (`src/app/api/workflows/[id]/run/route.ts` `L7-L23`) — Used when running starter workflow `wf-parallel-multi-website` from the canvas.
- **Related Services**:
  - `src/lib/executors.ts`: `EXECUTORS.parallel_web` (`L165-L280`).
  - `src/lib/templates.ts`: Starter workflow `wf-parallel-multi-website` (`L4-L111`).
- **Database Dependencies**:
  - Writes audit records to the `website_monitors` table in `data/db.json` via `dbTables.insert("website_monitors", ...)` (`src/app/api/forms/submit/route.ts` `L18`, `L23` and `pw-db` node in `src/lib/templates.ts` `L34-L45`).
  - Appends JSONL audit logs to `./data/files/parallel-websites.jsonl` (`src/lib/templates.ts` `L60-L70`).
- **External Integrations**:
  - Outbound HTTP/HTTPS `fetch` requests (`src/lib/executors.ts` `L195-L198`) with header `"user-agent": "FlowForge-ParallelBot/2.0"` and `15_000ms` timeout (`AbortSignal.timeout(15_000)`). Default 5 target URLs (`src/app/page.tsx` `L174-L176`, `src/lib/templates.ts` `L26`):
    1. `https://news.ycombinator.com`
    2. `https://example.com`
    3. `https://jsonplaceholder.typicode.com/posts/1`
    4. `https://httpbin.org/get`
    5. `https://api.github.com/zen`
- **Execution Flow**:
  1. `EXECUTORS.parallel_web.run` (`src/lib/executors.ts` `L167-L279`) parses `p.urls` (or `item.json.urls`) from a newline/comma-separated string or JSON array (`L168-L185`), filtering for valid `^https?:\/\/` URLs.
  2. It launches concurrent `fetch()` calls for all URLs inside `Promise.all(urlList.map(...))` (`L191-L255`).
  3. For each response, it measures `latencyMs` (`L199`), extracts JSON if `extractMode === "json"` or content-type is `application/json` (`L208-L214`), applies `new RegExp(regexStr, "i")` if `extractMode === "regex"` (`L215-L218`), and parses HTML `<title>`, `<h1>`, and `<meta name="description">` tags (`L219-L224`).
  4. Any failed/timed-out URL is caught per-site (`L237-L253`) and returned with `ok: false, status: 0, title: "ERROR", error: err.message` without aborting the parallel batch.
  5. It computes `parallelWallTimeMs`, `sequentialSumMs`, `healthyCount`, `avgLatencyMs`, `speedupFactor` (`${(sequentialSumMs / Math.max(parallelWallTimeMs, 1)).toFixed(1)}x faster in parallel`), and `summaryText` (`L257-L263`).
  6. If `p.emitMode === "individual"`, it returns `results` as an array of individual items (`L265-L267`); otherwise (`"summary_and_items"`), it returns a single combined summary item (`L268-L278`).
  7. Note: While `src/lib/nodes.ts` (`L140-L145`) defines a `concurrency` number field on `parallel_web`, `EXECUTORS.parallel_web.run` (`src/lib/executors.ts` `L191`) dispatches all URLs in `urlList` simultaneously via `Promise.all` without chunking by `p.concurrency`.
- **Current Implementation Status**: **CONFIRMED**

---

## 8. Public Interactive Forms (Mini-Apps)

- **Feature Name**: Public Interactive Mini-App Forms & Instant Workflow Trigger Hub
- **User Purpose**: Allows users to submit structured payloads across 4 specialized mini-app form slugs (`parallel-websites`, `lead-capture`, `order-checkout`, `ask-ai`) that automatically log records into the corresponding database table and trigger a live workflow with dynamic parameter overrides.
- **Frontend Screen**: Dock Tab 4 (`dockTab === "telegram"`, right column: `Mini-Apps & Public Forms`) in `src/app/page.tsx` (`L1924-L1999`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L180-L192`, `L771-L808`, `L1924-L1999`)
- **Backend API**:
  - `POST /api/forms/submit` (`src/app/api/forms/submit/route.ts` `L7-L69`)
- **Related Services**:
  - `src/lib/store.ts`: `dbTables.insert()` (`L213-L226`) and `workflows.list()` (`L121`).
  - `src/lib/engine.ts`: `runWorkflow()` (`L85-L266`).
  - `src/lib/executors.ts`: `form_trigger` (`L152-L163`).
- **Database Dependencies**:
  - Automatically inserts every form submission into `data/db.json` using `tableMap` (`src/app/api/forms/submit/route.ts` `L17-L26`):
    - `"parallel-websites"` → `"website_monitors"`
    - `"lead-capture"` → `"leads"`
    - `"order-checkout"` → `"orders"`
    - `"ask-ai"` → `"ai_logs"`
- **External Integrations**: Triggers downstream workflow nodes (Gemini AI, Telegram, Gmail, Parallel Web Scraper).
- **Execution Flow**:
  1. In the UI (`src/app/page.tsx` `L1931-L1952`), the user selects one of 4 form slugs (`parallel-websites`, `lead-capture`, `order-checkout`, `ask-ai`), fills the inputs (`formUrls` or `formName` + `formEmail` `L1956-L1979`), and clicks `Submit & Trigger Workflow` (`L1980-L1991`).
  2. `submitMiniAppForm()` (`L772-L808`) constructs a slug-specific `payload` (`L776-L794`) and sends `POST /api/forms/submit` with `{ formSlug: activeFormSlug, payload }`.
  3. `POST /api/forms/submit` (`src/app/api/forms/submit/route.ts` `L7-L69`) saves the submission to `dbTables.insert(tableMap[slug] ?? "leads", ...)` (`L23-L26`).
  4. It locates a matching workflow (`L30-L36`): first looking for any workflow with a `form_trigger` node matching `formSlug`, then falling back to `wf-parallel-multi-website` (for `"parallel-websites"`), `wf-live-ai-telegram-gmail` (for other slugs), or `all[0]`.
  5. It clones `targetWf` via `structuredClone(targetWf)` (`L43`, `L50`) and dynamically overrides `n.params.urls` on `parallel_web` nodes (when `slug === "parallel-websites" && payload.urls` `L42-L48`) or `n.params.prompt` on `gemini` nodes (when `payload.prompt` is provided `L49-L56`).
  6. It executes `runWorkflow(targetWf, { mode: "form", triggerData: { formSlug: slug, recordId: savedRecord.id, ...payload } })` (`L58-L61`) and returns `{ ok, savedRecord, execution, output }` (`L63-L68`), which is rendered in a `<pre>` block (`src/app/page.tsx` `L1993-L1997`) and triggers `loadDatabase()` (`L804`).
- **Current Implementation Status**: **CONFIRMED**

---

## 9. Secrets Vault

- **Feature Name**: Encrypted-Preview Secrets Vault & Automatic `.env` Synchronizer
- **User Purpose**: Manages API keys, bot tokens, SMTP credentials, and payment secrets with masked previews, 1-click preset key chips, 1-click `{{ $secrets.KEY }}` expression copying, and automatic synchronization from external `.env` files.
- **Frontend Screen**: Header `Secrets` button (`src/app/page.tsx` `L1268-L1278`) and modal dialog (`L2157-L2257`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L61-L77`, `L142-L146`, `L883-L909`, `L2157-L2257`)
- **Backend API**:
  - `GET /api/secrets` (`src/app/api/secrets/route.ts` `L6-L8`) — Lists all secrets with masked `preview` strings.
  - `POST /api/secrets` (`src/app/api/secrets/route.ts` `L10-L16`) — Upserts a secret key (normalized to `A-Z0-9_`).
  - `DELETE /api/secrets?key=<KEY>` (`src/app/api/secrets/route.ts` `L18-L22`) — Removes a secret key.
- **Related Services**:
  - `src/lib/store.ts`: `EXTERNAL_ENV_FILES` (`L8-L13`), `parseDotEnvFile()` (`L24-L47`), `loadEnvSecrets()` (`L49-L59`), `mergeSecrets()` (`L61-L69`), `secrets` CRUD object (`L178-L192`).
  - `src/lib/expressions.ts`: Injects `$secrets: rc.secrets` into the VM evaluation sandbox (`src/lib/engine.ts` `L111`, `L157`).
- **Database Dependencies**:
  - Stored in `secrets` array inside `data/db.json` (`src/lib/store.ts` `L20`, `L93-L98`).
  - Automatically merges keys from `D:\My n8n\.env`, `D:\My n8n\.env.local`, `<cwd>/.env.local`, and `<cwd>/.env` (`src/lib/store.ts` `L8-L13`, `L49-L69`), aliasing `GMAIL_USER` → `SMTP_USER` and `GMAIL_APP_PASSWORD` → `SMTP_PASS` (`L54-L55`).
- **External Integrations**: Supplies credentials at runtime to Gemini AI, OpenAI-compatible LLMs, Telegram Bot, Gmail SMTP, Resend, WhatsApp Cloud API, Slack, Discord, Google Sheets Service Account, Razorpay, and Stripe.
- **Execution Flow**:
  1. Clicking `Secrets` in the header (`src/app/page.tsx` `L1268-L1278`) opens `secretsModalOpen` and calls `loadSecrets()` (`L883-L890`), which fetches `GET /api/secrets`.
  2. `GET /api/secrets` (`src/app/api/secrets/route.ts` `L4-L8`) reads `secrets.list()` and masks values via `mask(v)`: values `<= 6` chars become `"•".repeat(v.length)`, and longer values show `${v.slice(0, 3)}••••••••${v.slice(-3)}` (`L4`).
  3. Users can click any of the 15 `PRESET_SECRET_KEYS` chips (`src/app/page.tsx` `L61-L77`, `L2181-L2191`) to populate `newSecretKey`, enter `newSecretVal` in the password input (`L2200-L2206`), and click `Save Secret` (`saveSecret` `L892-L903`), sending `POST /api/secrets`.
  4. Clicking `{{ $secrets.KEY }}` in the table copies the expression to the clipboard (`L2228-L2236`), or clicking `Delete` invokes `deleteSecret(s.key)` (`L905-L909`, `L2246`).
- **Current Implementation Status**: **CONFIRMED**

---

## 10. Execution History & Live 1s Polling Sync

- **Feature Name**: Execution History Inspector, 1-Second Live Canvas Polling Sync & SSE Event Bus
- **User Purpose**: Automatically synchronizes background workflow runs (Telegram bot messages, incoming webhooks, cron schedules, queue bursts, and manual runs) onto the visual canvas every 1 second, while maintaining a searchable history of up to 500 execution traces with per-node wave telemetry.
- **Frontend Screen**:
  - Live 1s Polling Hook (`src/app/page.tsx` `L317-L359`) & Top-Left Execution Summary Pill (`L1374-L1399`)
  - Dock Tab 3 (`dockTab === "executions"`) in `src/app/page.tsx` (`L1771-L1856`)
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L152-L153`, `L317-L372`, `L862-L881`, `L1374-L1399`, `L1771-L1856`)
  - `CanvasNode` (`src/components/CanvasNode.tsx` `L212-L254`)
  - `Inspector` (`src/components/Inspector.tsx` `L502-L635`)
- **Backend API**:
  - `GET /api/workflows/[id]/live` (`src/app/api/workflows/[id]/live/route.ts` `L4-L19`) — Returns `{ execution, running }` for the latest execution of workflow `id`.
  - `GET /api/executions` (`src/app/api/executions/route.ts` `L4-L19`) — Lists execution summaries (with `nodes` stripped and replaced by `nodeCount`) or returns a single full `Execution` when `?id=<execId>` is passed.
  - `DELETE /api/executions` (`src/app/api/executions/route.ts` `L21-L25`) — Clears execution history.
  - `GET /api/events` (`src/app/api/events/route.ts` `L4-L72`) — Server-Sent Events (`text/event-stream`) and `?mode=poll` endpoint broadcasting `workflowBus` events (`start`, `progress`, `complete`).
- **Related Services**:
  - `src/lib/store.ts`: `executions` store (`L155-L175`) with `MAX_EXECUTIONS = 500` cap (`L14`, `L166-L169`).
  - `src/lib/events.ts`: `EventBus` / `workflowBus` (`L19-L48`), called by `runWorkflow()` in `src/lib/engine.ts` (`L96-L105`, `L238-L246`, `L256-L264`).
- **Database Dependencies**: `executions` array in `data/db.json` (`src/lib/store.ts` `L19`, `L155-L175`).
- **External Integrations**: None.
- **Execution Flow**:
  1. While a workflow `currentWf` is selected, a `useEffect` in `src/app/page.tsx` (`L317-L359`) polls `GET /api/workflows/${currentWf.id}/live` every `1000ms` (`L354`).
  2. If `data.running` is `true` (`L329-L333`), it sets `running = true` and updates `lastExec` so active wave progress is reflected live on the canvas.
  3. When an execution finishes or a new execution ID appears (`L336-L347`), it sets `running = false`, updates `lastExec`, and fires a toast notification (`⚡ ${modeLabel} automation executed live (${nodeCount} nodes completed in waves)!` `L342`).
  4. A reactive `useEffect` (`L361-L372`) maps `lastExec?.nodes?.[n.id]` and `isRunning: running` into every ReactFlow node's `data`, updating node borders, duration pills, and wave badges in `CanvasNode.tsx`.
  5. In Dock Tab 3 (`dockTab === "executions"` `L1771-L1856`) or the Queue table (`QueueDashboard.tsx` `L604`), clicking any execution row calls `inspectExecution(execId)` (`src/app/page.tsx` `L871-L881`), which fetches `GET /api/executions?id=${execId}` and loads that historical execution's per-node inputs and outputs onto the canvas via `selectWorkflow(wf, full)`.
  6. Note: `/api/events` (`src/app/api/events/route.ts`) is fully implemented on the backend and fed by `workflowBus.broadcast()` in `src/lib/engine.ts`, while the frontend uses the 1-second `/api/workflows/[id]/live` polling loop (`src/app/page.tsx` `L321-L359`) for canvas synchronization.
- **Current Implementation Status**: **CONFIRMED**

---

## 11. Database Table Explorer

- **Feature Name**: Built-in Database Table Explorer & `db_query` Workflow Storage
- **User Purpose**: Provides an integrated table viewer and manager for inspecting, refreshing, and clearing structured JSON records persisted by workflows (`db_query` node) and public forms across tables (`website_monitors`, `leads`, `orders`, `ai_logs`, plus any custom table names).
- **Frontend Screen**: Dock Tab 2 (`dockTab === "database"`) in `src/app/page.tsx` (`L1692-L1769`) and Status Bar counter (`L2030-L2039`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L210-L213`, `L847-L859`, `L939-L941`, `L1692-L1769`)
- **Backend API**:
  - `GET /api/db?table=<name>&limit=<n>` (`src/app/api/db/route.ts` `L4-L12`) — Returns `{ tables, records }`.
  - `POST /api/db` (`src/app/api/db/route.ts` `L14-L19`) — Inserts a row into `table`.
  - `DELETE /api/db?table=<name>` (`src/app/api/db/route.ts` `L21-L25`) — Clears all rows in `table` (or all tables if omitted).
- **Related Services**:
  - `src/lib/store.ts`: `dbTables` (`L195-L231`) with `MAX_RECORDS = 2000` retention limit (`L15`, `L222-L224`).
  - `src/lib/executors.ts`: `EXECUTORS.db_query` (`L282-L299`) supporting `insert`, `select`, and `clear` operations.
- **Database Dependencies**: `records` array (`DbRecord[]`) in `data/db.json` (`src/lib/store.ts` `L21`, `L195-L231`).
- **External Integrations**: None (local JSON file store).
- **Execution Flow**:
  1. Opening the `🗄️ Database Tables` tab in the dock calls `loadDatabase(activeTable)` (`src/app/page.tsx` `L847-L859`, `L915`), fetching `GET /api/db?table=${encodeURIComponent(table)}`.
  2. `dbTables.tables()` (`src/lib/store.ts` `L196-L207`) initializes counts for the 4 default tables (`website_monitors`, `leads`, `orders`, `ai_logs`) plus any dynamic tables present in `db.records`, returning `{ name, count }[]`.
  3. Users switch tables via the table selector pills (`src/app/page.tsx` `L1699-L1714`), refresh rows (`L1718-L1724`), or click ``Clear `${activeTable}` `` (`L1725-L1734`) to call `DELETE /api/db?table=${activeTable}`.
  4. Rows are rendered in a table displaying `r.id` (`rec_<8-char-uuid>`), formatted timestamp `new Date(r.createdAt).toLocaleTimeString()`, and serialized JSON `JSON.stringify(r.data)` (`L1744-L1765`).
- **Current Implementation Status**: **CONFIRMED**

---

## 12. Auto-Layout DAG

- **Feature Name**: Topological Wave Column Auto-Layout (`Cmd+L` / `Ctrl+L`)
- **User Purpose**: Automatically arranges messy or newly generated workflow nodes into clean left-to-right topological wave columns so parallel branches are vertically centered and evenly spaced.
- **Frontend Screen**: Header `Auto-Layout ⌘L` button (`src/app/page.tsx` `L1279-L1292`) and keyboard shortcut `Ctrl+L` / `Cmd+L` (`L511-L515`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L469-L495`, `L511-L515`, `L1279-L1292`)
- **Backend API**:
  - Also implemented server-side in `src/app/api/ai-builder/route.ts` (`layoutGraph` `L45-L69`) to auto-layout AI-generated workflows before saving.
- **Related Services**: Pure topological longest-path rank algorithm in `src/app/page.tsx` (`L469-L495`) and `src/app/api/ai-builder/route.ts` (`L45-L69`).
- **Database Dependencies**: Marks `dirty = true` on client (`src/app/page.tsx` `L494`); persisted to `data/db.json` on next save/run.
- **External Integrations**: None.
- **Execution Flow**:
  1. Triggered via `handleAutoLayout()` (`src/app/page.tsx` `L469-L495`) when clicking `Auto-Layout` (`L1280`) or pressing `Ctrl+L` / `Cmd+L` (`L511`).
  2. Initializes `rank` of every node to `0` (`L471`) and relaxes edges over `nodes.length` iterations (`r = rank.get(e.source) + 1; if (r > rank.get(e.target)) rank.set(e.target, r)` `L472-L477`) to assign each node to its topological wave column `col`.
  3. Groups nodes by column `byCol` (`L478-L484`) and computes coordinates (`L486-L492`):
     - `x = 70 + col * 310`
     - `totalH = (group.length - 1) * 165`
     - `startY = Math.max(70, 230 - totalH / 2)`
     - `y = Math.round(startY + idx * 165)`
  4. Updates ReactFlow `nodes` state (`L493`), sets `dirty = true` (`L494`), and shows toast `"Auto-aligned workflow DAG into parallel wave columns"` (`L514`, `L1282`).
- **Current Implementation Status**: **CONFIRMED**

---

## 13. Export / Import Workflow JSON

- **Feature Name**: Portable Workflow JSON Export & Import
- **User Purpose**: Allows users to download the current workflow graph (nodes, positions, parameters, resilience settings, edges) as a portable `.workflow.json` file and import `.json` workflow files back into FlowForge.
- **Frontend Screen**: Header `Export | Import` button group and hidden `<input type="file" accept=".json" />` (`src/app/page.tsx` `L1294-L1319`).
- **Related React Components**:
  - `FlowForgeStudio` (`src/app/page.tsx` `L240`, `L393-L412`, `L558-L600`, `L1294-L1319`)
- **Backend API**:
  - `POST /api/workflows` (`src/app/page.tsx` `L577-L581` → `src/app/api/workflows/route.ts` `L8-L10`)
  - `PUT /api/workflows/[id]` (`src/app/page.tsx` `L583-L592` → `src/app/api/workflows/[id]/route.ts` `L13-L25`)
- **Related Services**: `src/lib/store.ts` (`workflows.create`, `workflows.update`), `src/lib/scheduler.ts` (`syncSchedules` called on `PUT`).
- **Database Dependencies**: Imported workflows are persisted to `data/db.json` via `POST /api/workflows` followed by `PUT /api/workflows/[id]`.
- **External Integrations**: Browser `Blob`, `URL.createObjectURL`, and `File.text()` APIs.
- **Execution Flow**:
  1. **Export (`handleExportJson` `src/app/page.tsx` `L558-L568`)**:
     - Calls `snapshotWorkflow()` (`L393-L412`) to capture the live ReactFlow `nodes` and `edges` into a `Workflow` object.
     - Serializes the snapshot with `JSON.stringify(snap, null, 2)` into an `application/json` `Blob` (`L561`).
     - Creates a temporary object URL, triggers a download named `${snap.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.workflow.json` (`L565`), and revokes the object URL (`L567`).
  2. **Import (`handleImportJson` `src/app/page.tsx` `L570-L600`)**:
     - Clicking `Import` (`L1305`) clicks `fileInputRef.current` (`L240`, `L1313-L1319`).
     - Reads the selected `.json` file via `await file.text()` and parses it as `Partial<Workflow>` (`L574-L575`), validating `Array.isArray(parsed.nodes)` (`L576`).
     - Calls `POST /api/workflows` to create a new workflow shell (`L577-L582`), then calls `PUT /api/workflows/${created.id}` with `{ name, active: Boolean(parsed.active), nodes: parsed.nodes, edges: parsed.edges ?? [] }` (`L583-L593`).
     - Prepends the imported workflow to `workflowList`, selects it onto the canvas (`selectWorkflow(updated)` `L595`), shows a toast (`L596`), and resets the file input (`L598`).
- **Current Implementation Status**: **CONFIRMED**

# FlowForge — Stage 1.5: Verified Function Registry & Blast Radius Map

> **Scope**: Complete, verified registry of all primary functions, executors, engine pipelines, and state handlers across the FlowForge codebase.  
> **Classification Legend**:
> - `STATICALLY VERIFIED`: Verified from source code AST, parameters, return types, and call graph.
> - `RUNTIME VERIFIED`: Verified through execution traces in `data/db.json` or live server polling.
> - `PARTIALLY VERIFIED`: Code verified; external third-party credential dependent.

---

## 1. Engine Core & DAG Execution (`src/lib/engine.ts`)

### `runWorkflow`
- **Location**: `src/lib/engine.ts:25-180`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Main orchestrator for workflow execution. Validates DAG, constructs dependency waves, resolves node contexts, coordinates auto-retries, records duration and outputs, and emits live execution events.
- **Input Contract**:
  - `workflow: Workflow` (The DAG definition with `nodes` and `edges`).
  - `options?: { mode?: ExecutionMode, triggerNodeId?: string, triggerData?: Record<string, unknown> }`.
- **Output Contract**: `Promise<Execution>` (Complete execution trace with status, duration, node results, and error message).
- **Callers**:
  - `src/lib/queue.ts:160` (`processNext`)
  - `src/app/api/forms/submit/route.ts:25`
  - `src/app/api/workflows/[id]/run/route.ts:20` (via queue)
- **Functions Called**:
  - `topoSort` (`engine.ts:185-230`)
  - `executeNode` (`engine.ts:235-310`)
  - `workflowBus.emit` (`src/lib/events.ts:15`)
  - `executions.create` / `executions.update` (`src/lib/store.ts:165-195`)
- **Shared State**: Emits to `workflowBus`; commits execution snapshots to `data/db.json`.
- **Blast Radius**: **CRITICAL**. Modifying `runWorkflow` alters all manual, scheduled, telegram, webhook, and form executions.

### `topoSort`
- **Location**: `src/lib/engine.ts:185-230`
- **Status**: `STATICALLY VERIFIED`
- **Purpose**: Implements Kahn's topological sorting algorithm to partition nodes into concurrent execution waves and detects circular edge cycles.
- **Input Contract**: `nodes: WorkflowNode[]`, `edges: WorkflowEdge[]`.
- **Output Contract**: `{ waves: WorkflowNode[][], hasCycle: boolean }`.
- **Blast Radius**: **HIGH**. Any defect causes workflow execution deadlock or unhandled cycle exceptions.

### `executeNode`
- **Location**: `src/lib/engine.ts:235-310`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Routes individual node execution to matching executor in `EXECUTORS`, resolves dynamic parameters via `resolveExpr()`, and manages error routing (`continueOnError`).
- **Input Contract**: `node: WorkflowNode`, `inputItems: Item[]`, `context: NodeExecutionContext`.
- **Output Contract**: `Promise<Item[] | Record<string, Item[]>>`.
- **Callers**: `runWorkflow` (`engine.ts:85`).
- **Blast Radius**: **HIGH**. Dispatches all 27 node types.

---

## 2. Expression & Template Resolution (`src/lib/expressions.ts`)

### `resolveExpr`
- **Location**: `src/lib/expressions.ts:15-85`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Evaluates `{{ ... }}` expressions within strings, numbers, or objects using sandboxed JavaScript evaluation.
- **Input Contract**: `val: any`, `context: { $json: any, $env: any, $secrets: any, $node: any }`.
- **Output Contract**: Evaluated string, object, or primitive value.
- **Blast Radius**: **HIGH**. Corrupted expression resolution breaks downstream parameter interpolation across all nodes.

---

## 3. Worker Pool & Concurrency Queue (`src/lib/queue.ts`)

### `enqueueWorkflowRun`
- **Location**: `src/lib/queue.ts:50-95`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Adds a workflow execution request to the in-memory job queue with a priority level (1=burst, 2=manual, 3=schedule, 4=webhook/telegram).
- **Input Contract**: `workflow: Workflow`, `options: EnqueueOptions`.
- **Output Contract**: `Promise<QueueJob>` (Returns immediately or awaits completion if `waitForCompletion: true`).
- **Blast Radius**: **CRITICAL**. Controls concurrency, throttling, and execution dispatch for all background and API runs.

### `processNext`
- **Location**: `src/lib/queue.ts:140-195`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Dequeues highest-priority job from `jobQueue` if `activeWorkers < maxConcurrency` and triggers `runWorkflow()`.
- **Shared State**: Increments/decrements `activeWorkers`, moves jobs between `jobQueue` and `completedJobs`.
- **Blast Radius**: **HIGH**. Concurrency starvation or memory leak if active counter fails to decrement.

---

## 4. Telegram Bot Long-Poller (`src/lib/telegramPoller.ts`)

### `startTelegramListener`
- **Location**: `src/lib/telegramPoller.ts:45-95`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Starts background recursive polling loop against Telegram Bot API (`getUpdates`).
- **Input Contract**: None (Reads `TELEGRAM_BOT_TOKEN` from `secrets.get()`).
- **Output Contract**: `{ ok: boolean, message: string }`.
- **Blast Radius**: **HIGH**. Controls Telegram automation liveness.

### `triggerTelegramWorkflows`
- **Location**: `src/lib/telegramPoller.ts:115-175`
- **Status**: `RUNTIME VERIFIED`
- **Purpose**: Dispatches incoming Telegram updates to active workflows containing `telegram_trigger` nodes.
- **Key Sub-Logic**:
  - Maintains `SESSION_CHATS` Map for 14-turn context memory.
  - **Audit Finding**: Omits `new Date().toISOString()`, causing Gemini date hallucination.
- **Blast Radius**: **HIGH**. Directly affects user interaction on Telegram.

---

## 5. Storage & Persistence (`src/lib/store.ts`)

### `read` / `write`
- **Location**: `src/lib/store.ts:95-145`
- **Status**: `STATICALLY VERIFIED`
- **Purpose**: Atomic file-backed JSON reader and writer targeting `data/db.json`.
- **Concurrency Protection**: Serialized via `writeLock = writeLock.then(...)` and writes first to `db.json.tmp` before renaming.
- **Blast Radius**: **CRITICAL**. Any corrupt write or uncaught error disables application state persistence.

### `workflows.*` (`list`, `get`, `create`, `update`, `delete`)
- **Location**: `src/lib/store.ts:150-210`
- **Status**: `STATICALLY VERIFIED`
- **Purpose**: CRUD accessors for workflow definitions. Auto-seeds the 4 `STARTER_WORKFLOWS` if file is blank.

### `secrets.*` (`list`, `get`, `set`, `delete`, `map`)
- **Location**: `src/lib/store.ts:250-290`
- **Status**: `STATICALLY VERIFIED`
- **Purpose**: Manages secrets with automatic fallback merging from `D:\My n8n\.env`.

---

## 6. Real-Time Broadcast & Event Bus (`src/lib/events.ts`)

### `workflowBus`
- **Location**: `src/lib/events.ts:10-45`
- **Status**: `STATICALLY VERIFIED`
- **Purpose**: Node.js `EventEmitter` singleton broadcasting execution events (`start`, `progress`, `node_finish`, `complete`, `error`).
- **Consumers**: `/api/events` (Server-Sent Events route handler).

---

## 7. Client Workbench Application (`src/app/page.tsx`)

### `FlowForgeStudio`
- **Location**: `src/app/page.tsx:122-2260`
- **Status**: `STATICALLY VERIFIED`
- **Purpose**: Single-page workbench coordinating ReactFlow canvas, node palette sidebar, inspector drawer, bottom telemetry dock, AI workflow generator modal, and secrets vault modal.
- **Sub-Handlers**:
  - `onNodesChange`, `onEdgesChange`, `onConnect`: ReactFlow canvas event handlers.
  - `handleRunWorkflow`: Triggers manual workflow execution via `/api/workflows/[id]/run`.
  - `handleAIBuild`: Submits natural language prompts to `/api/ai-builder`.
  - `toggleCategory`: Controls sidebar accordion collapse state.

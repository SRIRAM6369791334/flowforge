# FlowForge — Stage 2: Workflow Reliability & Execution Engine Audit

> **Scope**: Detailed reliability audit of the DAG topological scheduler, concurrent worker pool, execution state persistence, background triggers, and UI synchronization.  
> **Source Files**: `src/lib/engine.ts:1-315`, `src/lib/queue.ts:1-210`, `src/lib/scheduler.ts:1-75`, `src/lib/telegramPoller.ts:1-185`, `src/app/page.tsx:210-250`.

---

## 1. Engine Lifecycle & Execution Architecture

FlowForge uses a wave-based DAG execution model:
1. Workflows are partitioned into topological dependency waves using Kahn's algorithm (`topoSort()`).
2. Nodes within a wave execute concurrently via `Promise.allSettled()`.
3. Output items are collected and merged into downstream context arrays.
4. Execution results are committed to `data/db.json` and emitted via `workflowBus`.

---

## 2. Core Reliability Defect Analysis

### 2.1 DEF-WF-01: Canvas Live Execution Feedback Gap
- **Location**: `src/app/page.tsx:210-245` & `CanvasNode.tsx:45-80`
- **Severity**: **CRITICAL**
- **Problem**: When an external event (Telegram message, incoming webhook, cron trigger) executes a workflow, the open browser canvas at `http://localhost:3000` remains completely static. Nodes do not glow, show wave duration badges, or show success checkmarks.
- **Root Cause**:
  - In `page.tsx`, node badges only update when `activeExecutionId` is non-null.
  - `activeExecutionId` is only set when the user manually clicks "Execute Workflow" on the desktop browser.
  - While background triggers execute properly and emit events over `/api/events`, the client component has no event listener that links background execution IDs to the current canvas view.
- **Remediation**:
  In `page.tsx`, subscribe to `/api/events` via `EventSource`. When an event with `type: "workflow_start"` arrives where `event.workflowId === currentWorkflow.id`, automatically set `activeExecutionId = event.executionId`. This provides real-time visual feedback for all trigger sources.

---

### 2.2 DEF-WF-02: Volatile In-Memory Job Queue
- **Location**: `src/lib/queue.ts:40-42`
- **Severity**: **HIGH**
- **Problem**:
  ```typescript
  const jobQueue: QueueJob[] = [];
  const completedJobs: QueueJob[] = [];
  ```
  The job queue exists solely in the Node.js process heap.
- **Impact**: If the server restarts while 10 jobs are queued (e.g. from an incoming webhook burst), all 10 jobs are permanently lost without recovery or logging.
- **Remediation**: Persist pending jobs to an atomic file `data/queue.json` on enqueue and dequeue, or reload uncompleted jobs on startup.

---

### 2.3 DEF-WF-03: Worker Slot Starvation Risk
- **Location**: `src/lib/queue.ts:145-185`
- **Severity**: **LOW**
- **Problem**: The worker pool regulates concurrency using an integer counter `activeWorkers`. If a node executor hangs indefinitely (e.g. due to an un-timeouted HTTP call or hanging child process in `exec`), `activeWorkers` is never decremented.
- **Impact**: Eventually, `activeWorkers` reaches `maxConcurrency` (default 5), permanently deadlocking the queue from processing any further workflows.
- **Remediation**: Wrap every worker dispatch in a hard ceiling timeout (`maxJobDurationMs = 300_000ms`), ensuring `activeWorkers--` is always invoked in a `finally` block.

---

## 3. DAG Deadlock & Cycle Handling Audit
- **Verification**: `engine.ts:185-230` implements Kahn's algorithm correctly.
- If a user accidentally connects a cycle (e.g. `Node A -> Node B -> Node A`), `engine.ts` detects that the number of scheduled nodes is less than total nodes and throws:
  `Workflow contains a cycle or circular dependency`.
- **Finding**: Cycle detection is statically verified and robust.

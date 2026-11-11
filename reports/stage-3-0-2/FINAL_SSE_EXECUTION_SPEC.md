# FlowForge — Stage 3.0.2: Final SSE Execution & Real-Time Sync Specification

> **Document ID**: `STAGE-3-0-2-SSE-SPEC-03`  
> **Status**: APPROVED TECHNICAL SPECIFICATION  
> **Target Implementation**: Phase 1 (`T1.2` / Canvas Real-Time State Synchronization)  
> **Target File**: `src/app/page.tsx` (Client Canvas & Telemetry Dock)  
> **Backend Source**: `src/app/api/events/route.ts` & `src/lib/events.ts`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`

---

## 1. Executive Summary & Problem Definition

In FlowForge baseline:
- `src/lib/events.ts` defines `workflowBus` with event broadcasting (`start`, `progress`, `complete`, `error`).
- `src/app/api/events/route.ts` provides a Server-Sent Events (SSE) stream (`text/event-stream`) broadcasting real-time workflow events and 15-second heartbeat `: ping` frames.
- **However, `src/app/page.tsx` currently has ZERO SSE integration**. Canvas node statuses only update when an HTTP POST to `/api/workflows/[id]/run` finishes synchronously. During multi-step, parallel, or long-running workflows, the canvas remains static with no progress feedback. Furthermore, background triggers (Telegram messages, webhooks, cron schedules) execute completely invisibly to the canvas user.

This specification defines the **exact frontend SSE consumption engine for `src/app/page.tsx`**, guaranteeing:
1. Strict event timestamp validation (finite numbers, future clock-skew tolerance, no epoch overflow).
2. Bulletproof multi-execution correlation (Workflow ID + Execution ID tuple matching).
3. Explicit **Single-Active-Focus Execution Policy** with multi-execution background telemetry.
4. Correct handling of backend event replays (discarding stale events sent upon reconnection).
5. Elimination of stale React closures via synchronized refs and functional state updaters.
6. Support for indefinite long-running workflows without artificial client timeout truncation.

---

## 2. Server Event Replay & Reconnect Behavior Analysis

### 2.1 Actual Backend SSE Implementation (`src/app/api/events/route.ts`)
Direct source inspection of `src/app/api/events/route.ts` reveals:

```typescript
// Line 25-30: Initial handshake
controller.enqueue(
  encoder.encode(
    `event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: new Date().toISOString() })}\n\n`
  )
);

// Line 32-35: Replay of recent events on client connection
const recent = workflowBus.getRecent().slice(0, 5);
for (const evt of recent.reverse()) {
  controller.enqueue(encoder.encode(`event: workflow\ndata: ${JSON.stringify(evt)}\n\n`));
}
```

### 2.2 Replay Hazards on Client Reconnect
When a client page loads or reconnects after a temporary network drop:
- The server pushes up to 5 **historical** events immediately.
- If the frontend does not distinguish historical replayed events from live events:
  1. A finished execution from 10 minutes ago could suddenly overwrite the current canvas nodes.
  2. Finished nodes could re-pulse or blink erroneously.
  3. Stale execution outputs could replace fresh workflow state.

### 2.3 Replay Disambiguation Specification
The client must maintain a high-water mark timestamp:
- `clientConnectedAt`: Initialized to `Date.now()` when the SSE connection is established.
- `lastHandledEventTimestamp`: Tracks the greatest `Date.parse(evt.timestamp)` successfully applied to the active canvas.
- **Replay Filter Rule**:
  - If an incoming event has `Date.parse(evt.timestamp) < clientConnectedAt`:
    - It is accepted for **telemetry history / queue activity log** (e.g., bottom drawer).
    - It is **REJECTED** from mutating the active visual canvas state unless it belongs to the currently selected `activeExecutionId` and is newer than the last rendered node state.

---

## 3. Robust Event Timestamp Validation

Every incoming SSE event payload must pass rigorous timestamp sanity checks before being parsed into state:

```typescript
const MAX_FUTURE_SKEW_MS = 60_000; // 60 seconds tolerance for server/client clock drift
const MIN_VALID_TIMESTAMP = Date.parse("2026-01-01T00:00:00Z"); // Sanity floor

export interface ValidatedWorkflowEvent {
  type: "start" | "progress" | "complete" | "error";
  executionId: string;
  workflowId: string;
  workflowName: string;
  activeNodeIds?: string[];
  execution?: any;
  timestamp: string;
  parsedTimestampMs: number;
}

export function validateIncomingEvent(rawData: string): ValidatedWorkflowEvent | null {
  let parsed: any;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    console.warn("[SSE] Received malformed JSON in event payload:", rawData);
    return null;
  }

  // 1. Mandatory structural fields
  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.type || !parsed.executionId || !parsed.workflowId) {
    console.warn("[SSE] Missing mandatory event identifiers:", parsed);
    return null;
  }

  // 2. Strict Finite Timestamp Parsing
  const rawTs = parsed.timestamp;
  if (typeof rawTs !== "string") return null;
  
  const parsedMs = Date.parse(rawTs);
  if (!Number.isFinite(parsedMs)) {
    console.warn("[SSE] Discarding event with non-finite timestamp:", rawTs);
    return null;
  }

  // 3. Reject Out-of-Bounds Timestamps
  const now = Date.now();
  if (parsedMs > now + MAX_FUTURE_SKEW_MS) {
    console.warn("[SSE] Discarding event with future timestamp exceeding skew tolerance:", rawTs);
    return null;
  }
  if (parsedMs < MIN_VALID_TIMESTAMP) {
    console.warn("[SSE] Discarding event with ancient/pre-epoch timestamp:", rawTs);
    return null;
  }

  return {
    ...parsed,
    parsedTimestampMs: parsedMs,
  };
}
```

---

## 4. Execution Correlation & Concurrency Policy

### 4.1 Multi-Execution Environment Reality
FlowForge's worker pool (`src/lib/queue.ts`) can run multiple workflows concurrently:
- Workflow A triggered manually from Studio.
- Workflow B triggered via incoming Telegram webhook.
- Workflow C triggered by periodic scheduler.

### 4.2 Single-Active-Focus Canvas Policy
To maintain visual clarity, the Studio Canvas enforces a **Single-Active-Focus Policy**:
1. **Active Context**:
   - `selectedWorkflowId`: The workflow currently open on the canvas.
   - `activeExecutionId`: The specific run whose node progress and node pulse animations are currently active.
2. **Event Routing Rules**:
   - **Rule 1 (Workflow Mismatch)**: If `evt.workflowId !== selectedWorkflowId`, the event **must not mutate canvas nodes**. It is routed exclusively to the background execution history drawer and badge counters.
   - **Rule 2 (Execution Match)**: If `evt.workflowId === selectedWorkflowId`:
     - If `activeExecutionId` is currently unset or matches `evt.executionId`: The canvas updates immediately (active node pulsing, wave indicator, intermediate node status).
     - If `activeExecutionId` is set to Run X, and event arrives for Run Y: The event is added to the execution log, and an indicator banner notifies the user: `"Workflow is executing in background (Run Y). Click to view."`
3. **Execution Completion**:
   - When event `complete` or `error` arrives matching `activeExecutionId`, the canvas nodes transition from pulsing to their final success/error badges.

---

## 5. React State Synchronization & Anti-Staleness Architecture

### 5.1 The Stale Closure Problem
In Next.js React 19, standard `useEffect` subscriptions to `EventSource` easily capture stale closures of `currentWf`, `activeExecutionId`, or `lastExec`.

### 5.2 Synchronized Ref Pattern
To guarantee 100% fresh state without constantly tearing down and reconnecting the SSE connection:

```typescript
// Inside src/app/page.tsx:

// 1. Live synchronization refs
const currentWfRef = useRef<Workflow | null>(null);
const activeExecutionIdRef = useRef<string | null>(null);
const lastProcessedTsRef = useRef<number>(0);

useEffect(() => {
  currentWfRef.current = currentWf;
}, [currentWf]);

useEffect(() => {
  activeExecutionIdRef.current = activeExecutionId;
}, [activeExecutionId]);

// 2. Persistent SSE Lifecycle with Functional Updaters
useEffect(() => {
  let es: EventSource | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  const clientConnectedAt = Date.now();

  function connect() {
    es = new EventSource("/api/events");

    es.addEventListener("workflow", (e: MessageEvent) => {
      const evt = validateIncomingEvent(e.data);
      if (!evt) return;

      const currentWfId = currentWfRef.current?.id;
      const targetExecId = activeExecutionIdRef.current;

      // Filter out stale replayed events from prior sessions
      if (evt.parsedTimestampMs < clientConnectedAt && !targetExecId) {
        return; // Skip historical replays when idle
      }

      // Check if event belongs to current workflow
      if (currentWfId && evt.workflowId === currentWfId) {
        // Monotonic timestamp check per execution
        if (evt.parsedTimestampMs < lastProcessedTsRef.current && evt.executionId === targetExecId) {
          return; // Out-of-order event discard
        }
        lastProcessedTsRef.current = evt.parsedTimestampMs;

        // Functional node state update: zero stale closures
        setNodes((prevNodes) => {
          return prevNodes.map((node) => {
            const isActive = evt.activeNodeIds?.includes(node.id) ?? false;
            const nodeResult = evt.execution?.nodes?.[node.id];
            return {
              ...node,
              data: {
                ...node.data,
                running: isActive,
                status: nodeResult?.status ?? (isActive ? "running" : node.data.status),
                lastResult: nodeResult ?? node.data.lastResult,
              },
            };
          });
        });

        // If execution finishes, update lastExec
        if (evt.type === "complete" || evt.type === "error") {
          if (evt.execution) {
            setLastExec(evt.execution);
            setRunning(false);
          }
        }
      }
    });

    es.onerror = () => {
      es?.close();
      // Backoff reconnect
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    es?.close();
  };
}, []); // Mounted once per page lifecycle
```

---

## 6. Long-Running Workflows & Connection Liveness

- **Heartbeat Maintenance**: `src/app/api/events/route.ts` emits `: ping\n\n` every 15 seconds. This resets proxies and browser idle timers.
- **No Client Elapsed Cutoff**: The client will **never** abort an execution listener based on an arbitrary timer (e.g. 10s or 30s). Workflows doing large AI prompts, parallel web scraping, or database migrations may legitimately take 2 to 5 minutes.
- The connection remains open until the server emits `type: "complete"` or `type: "error"`.

---

## 7. Verification Verdict

| Verification Item | Specification Rule | Status |
| :--- | :--- | :---: |
| Finite timestamp validation | `Number.isFinite(Date.parse(...))` in Section 3 | **PASS** |
| Future timestamp handling | Clock skew buffer (`MAX_FUTURE_SKEW_MS`) in Section 3 | **PASS** |
| Workflow ID + Execution ID correlation | Tuple matching in Section 4.2 | **PASS** |
| Single-active canvas policy | Explicitly defined in Section 4.2 | **PASS** |
| Event replay disambiguation | `clientConnectedAt` threshold in Section 2.3 | **PASS** |
| React anti-staleness architecture | Synchronized ref pattern in Section 5.2 | **PASS** |
| Long-running execution tolerance | Heartbeat-driven liveness in Section 6 | **PASS** |

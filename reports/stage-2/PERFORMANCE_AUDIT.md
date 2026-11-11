# FlowForge — Stage 2: Performance & Scalability Audit

> **Scope**: Throughput benchmarking, concurrency throttling, event-loop blocking analysis, memory bloat evaluation, and rendering performance.  
> **Source Files**: `src/lib/store.ts`, `src/lib/engine.ts`, `src/lib/queue.ts`, `src/lib/executors.ts:165-281`.

---

## 1. Concurrency & Throughput Limits

FlowForge uses a single-process Node.js runtime with an in-memory worker queue:

| Dimension | Measured / Verified Ceiling | Bottleneck Mechanism | Severity |
| :--- | :--- | :--- | :--- |
| **Max Concurrent Workers** | `maxConcurrency = 5` (Default) | Throttled in `src/lib/queue.ts:25`. Configurable up to 20 via `/api/queue`. | Normal |
| **I/O Serialization** | 1 active write at a time | Synchronous mutex lock `writeLock` in `src/lib/store.ts:95`. | **HIGH** |
| **Execution History Retention**| 200 execution records | Automatically capped in `store.ts:225`. | Controlled |
| **Parallel HTTP Fetching** | 5-10 concurrent URLs | `Promise.allSettled()` in `parallel_web` node. | High Memory |
| **UI Polling Overhead** | 1000ms polling interval | Repeated GET calls to `/api/workflows/[id]/live`. | Medium |

---

## 2. In-Depth Performance Bottleneck Analysis

### 2.1 DEF-DB-01: Full-Document File I/O & Event Loop Blocking
- **File Reference**: `src/lib/store.ts:95-145`
- **Code**:
  ```typescript
  function read(): DbData {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  }
  function write(data: DbData): void {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(TMP_FILE, DB_FILE);
  }
  ```
- **Bottleneck**:
  1. `readFileSync` and `writeFileSync` are **synchronous blocking I/O calls**. During the write of a 5MB `db.json` file, the Node.js event loop is completely frozen; incoming HTTP requests and WebSocket/SSE frames cannot be handled.
  2. `JSON.stringify(data, null, 2)` formats the entire database with 2-space indentation on every single write, consuming unnecessary CPU cycles.
- **Remediation**:
  1. Migrate to non-blocking `fs.promises.writeFile`.
  2. Remove indentation formatting in production (`JSON.stringify(data)`).
  3. Partition execution history into an append-only log file (`data/executions.jsonl`).

---

### 2.2 Memory Bloat from Large HTTP Payloads (`parallel_web` node)
- **File Reference**: `src/lib/executors.ts:165-281`
- **Bottleneck**: When `extractMode === "html"` is selected, `parallel_web` fetches and stores complete HTML documents for up to 10 websites inside the node's output payload.
- **Impact**: A single run can inject 10MB to 20MB of text into the `executions` array, causing `db.json` to balloon in size rapidly and increasing garbage collection (GC) pause times.
- **Remediation**: Enforce a payload truncation ceiling: `html: rawHtml.slice(0, 100_000)` (100KB max per site).

---

### 2.3 Client Canvas Re-Render Overhead
- **File Reference**: `src/app/page.tsx:210-245`
- **Bottleneck**: While a workflow is running, `page.tsx` polls `/api/workflows/[id]/live` every 1000ms. On every response, `setLiveExecution(res.execution)` is invoked, triggering a top-to-bottom re-render of `CanvasNode.tsx` across all nodes, even if their state has not changed.
- **Remediation**: Wrap `CanvasNode.tsx` with `React.memo` and equality check comparing `prevNode.data.status === nextNode.data.status`.

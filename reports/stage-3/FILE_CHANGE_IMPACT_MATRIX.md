# FlowForge — Stage 3.0: File Change Impact Matrix & Dependency Blast Radius

> **Scope**: Strict pre-authorization inventory of all files proposed for modification across the 5 implementation phases, including cross-module dependency analysis and regression prevention controls.

---

## 1. Master File Modification Inventory

| File Path | Current LOC | Target Implementation Phase | Associated Tasks & Defects | Cross-Module Dependencies | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/lib/executors.ts` | 691 LOC | Phase 1 & Phase 2 | `T1.1`, `T1.3`, `T1.4`, `T2.2`, `T2.3`, `T2.4`, `T2.5`, `T2.6` | `engine.ts`, `nodes.ts` | **HIGH** |
| `src/app/page.tsx` | 2,260 LOC | Phase 1 & Phase 4 | `T1.2`, `T4.1`, `T4.2`, `T4.4` | `CanvasNode.tsx`, `/api/events` | **HIGH** |
| `src/middleware.ts` | 0 (New) | Phase 1 | `T1.5` (`DEF-SEC-03`) | All 14 API Route Handlers | **MEDIUM** |
| `src/app/api/ai-builder/route.ts` | 285 LOC | Phase 2 | `T2.1` (`DEF-AI-02`) | Gemini API, `nodes.ts` | **LOW** |
| `src/lib/store.ts` | 295 LOC | Phase 3 | `T3.1`, `T3.4` (`DEF-DB-01`, `DEF-DB-02`) | All store consumers, `db.json` | **HIGH** |
| `src/lib/queue.ts` | 390 LOC | Phase 3 | `T3.2`, `T3.3` (`DEF-WF-02`, `DEF-WF-03`) | `engine.ts`, `/api/queue` | **MEDIUM** |
| `src/components/CanvasNode.tsx` | 134 LOC | Phase 4 | `T4.2` (`DEF-UI-02`) | `page.tsx`, ReactFlow | **MEDIUM** |
| `src/components/Inspector.tsx` | 225 LOC | Phase 4 | `T4.3` (`DEF-UI-03`) | `page.tsx`, `types.ts` | **LOW** |
| `tests/engine.test.mjs` | 0 (New) | Phase 5 | `T5.1` (`DEF-QA-01`) | `engine.ts`, `expressions.ts` | **MINIMAL** |

---

## 2. In-Depth Cross-Module Impact Analysis

### 2.1 `src/lib/executors.ts` (Phase 1 & 2)
- **Role**: Contains execution logic for all 27 registered node types.
- **Proposed Changes**:
  1. `gemini` executor (lines 369-410): Ensure dynamic real-world timestamp injection is consistently evaluated on every call (`T1.1`). Add 3-attempt exponential retry on HTTP 429 (`T2.2`).
  2. `exec` executor (lines 673-690): Add `FLOWFORGE_ENABLE_EXEC` check (`T1.3`).
  3. `read_file` & `write_file` executors (lines 649-672): Enforce `data/files/` jail path check (`T1.4`).
  4. `email` executor (lines 536-556): Cache `nodemailer` transporter instances (`T2.3`).
  5. `if` executor (lines 319-322): Parse numbers when comparing (`T2.4`).
  6. `split_out` executor (lines 351-358): Gracefully return empty array if field is absent rather than crashing (`T2.5`).
- **Dependent Modules**: `src/lib/engine.ts` dispatches to these executors.
- **Regression Prevention**: Node input/output interfaces (`Item[] -> Item[]`) must remain strictly unchanged.

---

### 2.2 `src/app/page.tsx` (Phase 1 & 4)
- **Role**: Monolithic client page containing top action bar, sidebar, ReactFlow canvas, and dock.
- **Proposed Changes**:
  1. (Phase 1) Add SSE `EventSource` listener to `/api/events` to auto-bind `activeExecutionId` on background triggers (`T1.2`).
  2. (Phase 4) Refactor top action bar into grouped icon buttons with tooltips to eliminate horizontal overlap (`T4.1`).
  3. (Phase 4) Apply Emerald design tokens (obsidian `#070a0e`, emerald `#10b981`, glowing bezier lines) (`T4.2`).
  4. (Phase 4) Add collapsible 3-state dock toggle with `⌘J` shortcut (`T4.4`).
- **Dependent Modules**: ReactFlow canvas, `CanvasNode.tsx`, `Inspector.tsx`, `QueueDashboard.tsx`.
- **Regression Prevention**: Do not alter existing React state variable names or API submission handlers.

---

### 2.3 `src/lib/store.ts` (Phase 3)
- **Role**: Local file store and write-lock mutex for `data/db.json`.
- **Proposed Changes**:
  1. Replace blocking `fs.readFileSync` and `fs.writeFileSync` with asynchronous non-blocking file streaming (`T3.1`).
  2. Ensure `.tmp` atomic file renaming is preserved.
- **Dependent Modules**: All API route handlers and executors calling `store.*`.
- **Regression Prevention**: Maintain identical synchronous/asynchronous signature parity so existing callers do not fail.

---

## 3. Strict Pre-Modification Verification Checklist
- [x] Full Git baseline commit created (`821529c`).
- [x] Offline zip backup verified (`flowforge_pre_stage3_backup.zip`).
- [x] No unauthorized files will be touched during Phase 1.
- [x] Only 2 files (`executors.ts`, `page.tsx`) and 1 new file (`middleware.ts`) slated for Phase 1.

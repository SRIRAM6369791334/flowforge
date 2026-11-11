# FlowForge — Stage 1.5: Document Contradictions & Discrepancies Registry

> **Purpose**: Formal identification and reconciliation of all conflicting statements, discrepancies, and inaccurate claims found across the 15 original discovery documents (`project-knowledge/`) and early prompt assumptions when evaluated against source-code reality in `C:\Users\srira\.gemini\antigravity\scratch\flowforge`.

---

## 1. Contradiction Summary Matrix

| # | Discrepancy Category | Initial Claim / Original Doc Statement | Verified Source Code Truth | Root Cause & Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **C-01** | **Total Node Types** | "20 node types" (`00_PROJECT_OVERVIEW.md:42`) vs. "29 node types" (preliminary prompt assumptions) | **27 Node Types** registered in `NODE_DEFS` (`src/lib/nodes.ts:7-579`) and `EXECUTORS` (`src/lib/executors.ts:122-691`). | The number 20 comes from the LLM prompt whitelist in `ai-builder/route.ts:18-41`. The number 29 came from hallucinating n8n node names and splitting `db_query` into 4 separate nodes. |
| **C-02** | **Backend Architecture** | "React frontend, Node.js backend, Express API" (Stage 1 prompt spec) | **Next.js 16 App Router Route Handlers** (`src/app/api/**/route.ts`). Zero Express packages or server files exist. | Prompt assumed a decoupled Express server. Codebase is a unified Next.js 16 full-stack application. |
| **C-03** | **Database Engine** | "PostgreSQL / SQL database with migrations" (Initial architectural assumption) | **Zero-dependency local JSON file store** (`data/db.json`) operated via `src/lib/store.ts`. | Disambiguated from adjacent `D:\My n8n` prototype which contains `mysql2`. FlowForge uses an in-memory mutex and disk JSON store. |
| **C-04** | **Source File Tree & Names** | References to `src/types/index.ts`, `src/components/Sidebar.tsx`, `src/components/CustomNode.tsx`, `src/lib/nodes/index.ts` | Types are in `src/lib/types.ts`. Custom node is `src/components/CanvasNode.tsx`. Sidebar and modals are embedded in `src/app/page.tsx` (2,260 LOC). Nodes are in `src/lib/nodes.ts`. | Early notes assumed standard decoupled component folder structures before inspecting the actual monolithic `page.tsx` client layout. |
| **C-05** | **AI Models & Image Generation** | Claims of `ai_image_gen` using Hugging Face FLUX.1-schnell and external vector memory | `ai_image_gen` does **NOT exist** in `src/lib/nodes.ts` or `src/lib/executors.ts`. Memory is an in-memory `Map<string, SessionChat>` in `telegramPoller.ts:24`. | Hallucinated feature not present in FlowForge source code. Only `gemini` and `openai_chat` nodes are implemented. |
| **C-06** | **Telegram Date Hallucination** | System behavior assumed Gemini would know current date; user observed `23rd July 2024` and `2026 is far away` | `src/lib/telegramPoller.ts:156-167` and `src/lib/executors.ts:356-368` pass static system instructions with **zero dynamic date injection**. | Without runtime ISO date grounding (`new Date().toISOString()`), Gemini defaults to its pre-training cutoff baseline. |
| **C-07** | **Canvas Real-Time Run Animation** | Assumption that any workflow execution automatically animates on `http://localhost:3000` | Canvas animation in `src/app/page.tsx` only activates when `activeExecutionId` is set (usually via manual "Execute Workflow" button). | Background executions via Telegram poller or Webhook emit SSE events but do not auto-bind to the user's active canvas view. |
| **C-08** | **Worker Queue Persistence** | Assumption that queued and burst jobs are durably persisted across restarts | Worker pool and queue in `src/lib/queue.ts:40-42` are **purely in-memory arrays** (`jobQueue: QueueJob[]`). | Server restarts purge all unexecuted jobs in the queue. Only finished execution records are persisted to `data/db.json`. |
| **C-09** | **API Authentication** | Assumption of session or bearer token protection for API routes | All 14 API endpoints in `src/app/api/**` have **zero authentication checks**. | Designed for local studio autonomy; entirely unprotected on local network or exposed ports. |
| **C-10** | **Sandboxed Code Execution** | Assumption of secure containerized or isolated JS execution | `code` node uses `node:vm` `Script.runInContext()` (`src/lib/executors.ts:241-260`) and `exec` node runs arbitrary shell commands via `child_process.exec()` (`L674-L690`). | High local privilege; `exec` node allows execution of any host terminal command. |

---

## 2. In-Depth Technical Discrepancy Audits

### 2.1 Audit C-01: Registered Node Count Discrepancy
- **Claimed in `00_PROJECT_OVERVIEW.md:42`**:
  > *"collapsible left sidebar... containing a searchable, categorized palette of 20 node types across 9 categories"*
- **Verified Code Reality**:
  - Open `src/lib/nodes.ts:7-579`: The array `NODE_DEFS: NodeMeta[]` contains **27 definitions**.
  - Open `src/lib/executors.ts:122-691`: The object `EXECUTORS: Record<string, Executor>` defines **27 executors**.
  - Open `src/app/api/ai-builder/route.ts:18-41`: The `SYSTEM_PROMPT` provided to Gemini instructs:
    ```typescript
    Supported node types:
    - Triggers: manual_trigger, telegram_trigger, form_trigger, schedule_trigger, webhook_trigger
    - Parallel & Web: parallel_web
    - Core: http_request, set, if, code, split_out, merge, delay
    - AI: gemini, openai_chat
    - Messaging: telegram, whatsapp, slack, discord, email
    ```
    This equals exactly 5 + 1 + 7 + 2 + 5 = **20 node types**.
  - **Resolution**: `00_PROJECT_OVERVIEW.md` mistakenly cited the AI Builder prompt subset (20 nodes) instead of the complete registered node registry (27 nodes). The 7 omitted nodes in `ai-builder` are:
    1. `db_query` (`nodes.ts:407-446`)
    2. `google_sheets` (`nodes.ts:450-478`)
    3. `razorpay` (`nodes.ts:482-517`)
    4. `stripe` (`nodes.ts:521-550`)
    5. `read_file` (`nodes.ts:554-561`)
    6. `write_file` (`nodes.ts:565-572`)
    7. `exec` (`nodes.ts:576-578`)

---

### 2.2 Audit C-04: Non-Existent Component & Type Paths
- **Earlier Inaccurate Citations**:
  - `src/types/index.ts`
  - `src/components/Sidebar.tsx`
  - `src/components/CustomNode.tsx`
  - `src/lib/nodes/index.ts`
- **Verified Code Reality**:
  - `src/lib/types.ts`: Contains all TypeScript models (`Workflow`, `WorkflowNode`, `NodeMeta`, `Item`, `Execution`, `DbRecord`, `Secret`).
  - `src/components/CanvasNode.tsx`: Implements the ReactFlow custom node with execution duration badges, wave badges, status rings, and handles.
  - `src/app/page.tsx`: Contains the sidebar (`L974-L1214`), top bar (`L1219-L1352`), canvas container (`L1354-L1453`), telemetry dock (`L1500-L2000`), AI builder modal (`L1454-L1510`), and secrets modal (`L1512-L1570`).
  - **Resolution**: The codebase utilizes an integrated page layout where sub-views are embedded inside `page.tsx` rather than split into standalone component files.

---

### 2.3 Audit C-06: Telegram Date Hallucination Mechanism
- **Observed User Interaction**:
  - User: `today date ena da` (What is today's date?)
  - Bot: `23rd July 2024`
  - User: `check date da totay is 11.11.2026 da`
  - Bot: `Ila da Sri, today is not 11.11.2026. Adhu romba naal apparam varum!` (No Sri, today is not 11.11.2026. That will come after a long time!)
- **Code Inspection in `src/lib/telegramPoller.ts`**:
  ```typescript
  // Lines 156-167:
  const systemInstruction = 
    `You are FlowForge AI, an intelligent Telegram assistant for Sriram. ` +
    `Respond naturally, warmly, concisely, and helpfully in English or Tanglish (Tamil-English) as appropriate.`;
  ```
- **Code Inspection in `src/lib/executors.ts` (`gemini` executor)**:
  ```typescript
  // Lines 349-354:
  const system = s(p.system) || "You are a helpful assistant.";
  // System instruction passed directly to Gemini API without timestamp context!
  ```
- **Resolution**: The prompt lacks dynamic time awareness. Injecting `Current System Date: ${new Date().toISOString()}` into the system instruction will resolve the hallucination.

---

### 2.4 Audit C-07: Canvas Execution Live Visibility Gap
- **Observed User Experience**: User executed a Telegram workflow run, saw bot reply in Telegram, but when viewing `http://localhost:3000/`, the canvas nodes were not visibly showing green execution checkmarks or wave timings.
- **Code Inspection in `src/app/page.tsx`**:
  - The ReactFlow canvas displays node statuses from `liveExecution?.nodes[node.id]` (`CanvasNode.tsx:45-80`).
  - `liveExecution` is fetched only when `activeExecutionId` is non-null (`page.tsx:210-245`).
  - When the user clicks **"Execute Workflow"** on the canvas, `runWorkflow()` sets `activeExecutionId = res.executionId` (`page.tsx:610`).
  - When Telegram triggers a workflow in the background (`telegramPoller.ts:130-145`), it calls `enqueueWorkflowRun(wf, { mode: "telegram" })`. The backend executes the workflow and records it in `data/db.json` (`executions` array), but the client browser at `localhost:3000` does not know to switch its `activeExecutionId` to that new background execution!
- **Resolution**: The canvas lacks a background-run auto-attach listener. To see live Telegram execution on the canvas, the client must subscribe to `api/events` and automatically switch `liveExecution` when an active workflow ID matches the currently open workflow.

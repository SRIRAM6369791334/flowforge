# FlowForge — Stage 1.5: Unresolved Questions & Architectural Decisions

> **Purpose**: Catalog of strategic architectural decisions, UX trade-offs, and design questions that require explicit developer clarification before proceeding to Stage 2 (Defect Analysis & UI/UX Enhancement).

---

## 1. Core Architectural Decision Points

### Question 1: Background Execution Canvas Auto-Binding
- **Current Behavior**: When a workflow is triggered in the background (e.g. by an incoming Telegram message or external webhook), the backend executes it, logs the execution to `data/db.json`, and streams events via SSE. However, the client canvas on `http://localhost:3000/` only shows live green checkmarks if the user manually triggered the run via the "Execute Workflow" button.
- **Decision Options**:
  - **Option A (Recommended)**: Auto-bind open canvas to live background runs. If the currently open workflow ID matches the background execution's workflow ID, automatically animate the node execution waves in real-time.
  - **Option B (Dock Only)**: Keep the canvas static to avoid disrupting user editing; show a toast notification and flash the bottom "Execution History" tab with the new run.

---

### Question 2: Temporal Grounding for AI Prompts (Date Hallucination Fix)
- **Current Behavior**: When the user asked for the current date, Gemini replied `23rd July 2024` and stated `2026 is far in the future`.
- **Decision Options**:
  - **Option A (Recommended)**: Automatically inject dynamic system time and timezone (`Current Date: ${new Date().toISOString()}`) into the system instruction for all AI nodes (`gemini`, `openai_chat`) and the Telegram bot poller (`telegramPoller.ts`).
  - **Option B (User-Configured)**: Provide a toggle in the node parameters: `Include Live Timestamp: boolean`.

---

### Question 3: AI Workflow Builder Node Whitelist Expansion
- **Current Behavior**: `src/app/api/ai-builder/route.ts:18-41` only whitelists **20 node types** for AI generation, omitting `db_query`, `google_sheets`, `razorpay`, `stripe`, `read_file`, `write_file`, and `exec`.
- **Decision Options**:
  - **Option A (Recommended)**: Expand the `SYSTEM_PROMPT` in `ai-builder` to include all **27 registered node types**, allowing Gemini to generate database, Google Sheets, payment, and system automation workflows from natural language.
  - **Option B**: Maintain the 20-node subset to prevent hallucinated complex payment/system flows.

---

### Question 4: Database Storage Strategy
- **Current Behavior**: State is stored in a single atomic file `data/db.json` (with starter seeding from `templates.ts` and secret sync from `D:\My n8n\.env`).
- **Decision Options**:
  - **Option A (Recommended for Local Studio)**: Retain the atomic `data/db.json` store. It requires zero configuration, zero external service installation, and supports fast file-backed backups.
  - **Option B**: Migrate to embedded SQLite (`better-sqlite3`) for multi-process concurrent access and relational querying.

---

### Question 5: Worker Pool Queue Durability Across Server Restarts
- **Current Behavior**: Active jobs in `src/lib/queue.ts` reside in memory (`jobQueue: QueueJob[]`). If `next dev` is stopped or restarted, any pending jobs in the queue are lost.
- **Decision Options**:
  - **Option A**: Keep queue in-memory for maximum speed and simplicity in local development.
  - **Option B**: Persist pending queue jobs to disk (`data/queue.json`) on shutdown and reload them on server startup.

---

### Question 6: UI / UX Modernization Priorities for Stage 2
- **Feedback Received**: The user previously noted that the canvas UI felt "clumsy", the color palette lacked contrast and polish, and user experience could be significantly improved.
- **Proposed Enhancement Focus Areas**:
  1. **Canvas Aesthetics**: Modern neo-brutalist / high-precision dark theme with glowing bezier connectors, distinct category accent colors, and animated status pulses.
  2. **Inspector Redesign**: Structured property panels with tabbed schema navigation, JSON previewers, and inline test triggers.
  3. **Sidebar & Dock Polish**: Smoother transitions, search keyboard navigation, and refined telemetry metrics.

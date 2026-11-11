# 01 — Repository Inventory

> **Inspection Status:** `CONFIRMED`  
> **Repository Root:** `C:\Users\srira\.gemini\antigravity\scratch\flowforge`  
> **Total Tracked Source & Config Files:** 41 files (excluding `node_modules/`, `.next/`, and `project-knowledge/`).

---

## 1. Directory Tree Structure (`CONFIRMED`)

```text
C:\Users\srira\.gemini\antigravity\scratch\flowforge\
├── .env.local                                   # Local environment variables (3,221 B — synced with D:\My n8n\.env; DO NOT EXPOSE VALUES)
├── .gitignore                                   # Git ignore patterns (41 lines, 480 B)
├── AGENTS.md                                    # Next.js 16 agent rules notice (9 lines, 679 B)
├── eslint.config.mjs                            # ESLint 9 flat config with next/core-web-vitals & typescript (18 lines, 465 B)
├── next-env.d.ts                                # Auto-generated Next.js TypeScript references (7 lines, 288 B)
├── next.config.ts                               # Next.js 16 config: cacheComponents, partialPrefetching, @tailwindcss/turbopack (17 lines, 318 B)
├── package.json                                 # Project manifest & dependencies (30 lines, 667 B)
├── package-lock.json                            # npm lockfile (6,938 lines, 241,179 B)
├── README.md                                    # Default create-next-app README (36 lines, 1,450 B)
├── tsconfig.json                                # TypeScript 5 bundler config with @/* -> ./src/* path alias (34 lines, 670 B)
├── tsconfig.tsbuildinfo                         # Incremental TypeScript build cache (138,842 B)
│
├── data/                                        # Local runtime persistence directory
│   ├── db.json                                  # Primary JSON database: workflows, executions, secrets, records (22,962 lines, 827,204 B)
│   └── files/                                   # Output directory for Read File / Write File nodes
│       ├── parallel-websites.jsonl              # Appended JSONL audit logs from wf-parallel-multi-website (7 lines, 13,694 B)
│       └── top-users.jsonl                      # Appended JSONL enriched user logs from wf-demo-api-pipeline (24 lines, 4,680 B)
│
├── public/                                      # Static SVG assets (create-next-app defaults)
│   ├── file.svg                                 # (391 B)
│   ├── globe.svg                                # (1,035 B)
│   ├── next.svg                                 # (1,375 B)
│   ├── vercel.svg                               # (128 B)
│   └── window.svg                               # (385 B)
│
└── src/                                         # Application source code (29 TypeScript/TSX/CSS files)
    ├── instrumentation.ts                       # Next.js server startup hook: starts Cron scheduler & Telegram listener (8 lines, 277 B)
    │
    ├── app/                                     # Next.js 16 App Router UI & API routes
    │   ├── favicon.ico                          # App icon (15,086 B)
    │   ├── globals.css                          # Tailwind v4 theme, custom scrollbars, studio animations, React Flow overrides (228 lines, 5,661 B)
    │   ├── layout.tsx                           # Root HTML layout, Geist & Geist_Mono fonts, dark mode class (32 lines, 822 B)
    │   ├── page.tsx                             # FlowForgeStudio main client application (2,260 lines, 99,115 B)
    │   │
    │   └── api/                                 # Backend REST & SSE Route Handlers (14 endpoints)
    │       ├── ai-builder/
    │       │   └── route.ts                     # POST: Natural language -> DAG workflow generator (Gemini + heuristic fallback) (285 lines, 11,537 B)
    │       ├── db/
    │       │   └── route.ts                     # GET / POST / DELETE: Local database tables & records CRUD (25 lines, 911 B)
    │       ├── events/
    │       │   └── route.ts                     # GET: Server-Sent Events (SSE) stream & ?mode=poll recent workflow events (72 lines, 1,986 B)
    │       ├── executions/
    │       │   └── route.ts                     # GET / DELETE: Execution history list, single execution lookup, clear (25 lines, 913 B)
    │       ├── forms/
    │       │   └── submit/
    │       │       └── route.ts                 # POST: Mini-App / Public Form submission -> DB insert + workflow run (69 lines, 2,175 B)
    │       ├── queue/
    │       │   └── route.ts                     # GET / POST: Worker pool state, config, single enqueue, burst stress test, clear (119 lines, 3,520 B)
    │       ├── secrets/
    │       │   └── route.ts                     # GET / POST / DELETE: Secrets Vault CRUD with masked value previews (22 lines, 928 B)
    │       ├── telegram/
    │       │   └── route.ts                     # GET / POST: Telegram long-polling listener start/stop/status & message simulator (38 lines, 1,140 B)
    │       ├── webhook/
    │       │   └── [...path]/
    │       │       └── route.ts                 # GET/POST/PUT/PATCH/DELETE: Dynamic catch-all webhook trigger router (77 lines, 2,477 B)
    │       └── workflows/
    │           ├── route.ts                     # GET / POST: List all workflows, create new workflow (11 lines, 388 B)
    │           ├── run-parallel/
    │           │   └── route.ts                 # POST: Execute multiple workflows concurrently via queue worker pool (42 lines, 1,199 B)
    │           └── [id]/
    │               ├── route.ts                 # GET / PUT / DELETE: Get, update, or delete workflow + re-sync cron schedules (31 lines, 1,119 B)
    │               ├── live/
    │               │   └── route.ts             # GET: Poll latest execution & running status for a specific workflow (19 lines, 536 B)
    │               └── run/
    │                   └── route.ts             # POST: Enqueue & await manual workflow run (priority 5) (23 lines, 799 B)
    │
    ├── components/                              # Reusable Studio React Client Components (4 files)
    │   ├── CanvasNode.tsx                       # Custom @xyflow/react node card with live status, wave badge, & branch handles (304 lines, 11,606 B)
    │   ├── Inspector.tsx                        # Right slide-over drawer: Parameters, Output/Input JSON viewer, Retry settings (728 lines, 30,900 B)
    │   ├── NodeIcon.tsx                         # Dynamic Lucide icon resolver for 26 icon names + Box fallback (64 lines, 931 B)
    │   └── QueueDashboard.tsx                   # Worker Pool & Concurrent Queue control center and telemetry table (669 lines, 28,036 B)
    │
    └── lib/                                     # Core Backend & Shared Domain Library (11 files)
        ├── engine.ts                            # Topological wave planner (planParallelWaves) & DAG runner (runWorkflow) (288 lines, 9,791 B)
        ├── events.ts                            # Global singleton EventBus (__ffEventBus) for workflow lifecycle events (48 lines, 1,158 B)
        ├── executors.ts                         # Runtime implementations for all 20 node types (691 lines, 25,777 B)
        ├── expressions.ts                       # Sandboxed {{ expr }} evaluator via node:vm (resolveString, resolveParams) (102 lines, 3,232 B)
        ├── nodes.ts                             # Client-safe catalogue of 20 node definitions (NODE_DEFS, NODE_MAP) (598 lines, 21,196 B)
        ├── queue.ts                             # Global singleton Worker Pool & Priority Queue (__ffQueue) (390 lines, 11,629 B)
        ├── scheduler.ts                         # Global 5-field Cron parser & 15s background ticker (__ffCronTimer) (88 lines, 2,894 B)
        ├── store.ts                             # Synchronous JSON file store (workflows, executions, secrets, dbTables) (231 lines, 7,545 B)
        ├── telegramPoller.ts                    # Global Telegram Bot getUpdates poller (__ffTgTimer) & workflow trigger (138 lines, 3,914 B)
        ├── templates.ts                         # 4 pre-built starter workflows (STARTER_WORKFLOWS) (309 lines, 10,074 B)
        └── types.ts                             # Core TypeScript interfaces (Workflow, Execution, NodeMeta, Secret, DbRecord) (103 lines, 2,298 B)
```

---

## 2. Detailed Inventory by Architectural Layer (`CONFIRMED`)

### 2.1 Root Configuration & Boot Files

| File Path | Lines | Size (Bytes) | Role & Key Details |
| :--- | :---: | :---: | :--- |
| `package.json` | 30 | 667 | Defines scripts (`dev`, `build`, `start`, `lint`), 7 runtime dependencies (`@xyflow/react`, `lucide-react`, `next`, `nodemailer`, `react`, `react-dom`, `@types/nodemailer`), and 8 devDependencies. |
| `tsconfig.json` | 34 | 670 | Configures strict TypeScript (`ES2017`, `bundler` module resolution, `react-jsx`) and maps `@/*` to `./src/*`. |
| `next.config.ts` | 17 | 318 | Enables `cacheComponents: true`, `partialPrefetching: true`, and configures `@tailwindcss/turbopack` loader for `*.css`. |
| `eslint.config.mjs` | 18 | 465 | Flat ESLint config spreading `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. |
| `next-env.d.ts` | 7 | 288 | Standard Next.js route/image type reference file. |
| `.gitignore` | 41 | 480 | Ignores `/node_modules`, `/.next/`, `/out/`, `/build`, `.env*`, `*.tsbuildinfo`. Note: `data/` is not ignored. |
| `AGENTS.md` | 9 | 679 | Auto-generated Next.js 16 notice pointing agents to `node_modules/next/dist/docs/`. |
| `README.md` | 36 | 1,450 | Default `create-next-app` boilerplate README. |
| `src/instrumentation.ts` | 8 | 277 | Next.js instrumentation hook; when `process.env.NEXT_RUNTIME === "nodejs"`, dynamically imports and invokes `syncSchedules()` and `startTelegramListener()`. |

### 2.2 Frontend Entry Points & Styling (`src/app/`)

| File Path | Lines | Size (Bytes) | Role & Key Details |
| :--- | :---: | :---: | :--- |
| `src/app/layout.tsx` | 32 | 822 | Root Server Component layout; loads Google Fonts `Geist` (`--font-geist-sans`) and `Geist_Mono` (`--font-geist-mono`), sets metadata title `"FlowForge — Workflow Automation"`, and applies `dark` class to `<html>`. |
| `src/app/globals.css` | 228 | 5,661 | Imports `tailwindcss`; defines CSS variables (`--background: #0c0d14`, `--foreground: #f4f4f5`, `--accent: #6366f1`), keyframe animations (`ambientBreath`, `pulseGlow`, `floatIn`, `slideInRight`, `flowDash`), utility classes (`.glass-card`, `.machined-card`, `.canvas-dot-grid`, `.input`, `.btn*`), and custom `.react-flow*` overrides. |
| `src/app/page.tsx` | 2,260 | 99,115 | Client component (`FlowForgeStudio`) hosting the entire single-page studio: top header, collapsible 48px/260px left sidebar (Nodes palette & Workflows list), `@xyflow/react` canvas, floating `Cmd+K` AI Builder modal, Secrets Vault modal, slide-over `Inspector`, 4-tab bottom telemetry dock (`QueueDashboard`, Database Tables, Execution History, Telegram & Public Forms), and 32px footer status bar. |

### 2.3 Frontend Studio Components (`src/components/`)

| File Path | Lines | Size (Bytes) | Exports | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `src/components/CanvasNode.tsx` | 304 | 11,606 | `CanvasNode`, `CanvasNodeData` | Memoized custom React Flow node component (`flowNode`). Renders 240px card with category color bar, icon badge, `summarize()` parameter preview, retry/shield badges, status footer (`Running`, duration `ms`, `wave N`, `Error`, `Skipped`, `Idle`), and dynamic output handles (`main` or `true`/`false`). |
| `src/components/Inspector.tsx` | 728 | 30,900 | `Inspector` | Right-side 360px slide-over drawer for the selected node. Provides inline node renaming, trigger play button, delete button, Webhook URL copy box, Quick Expression insertion chips, typed `FieldInput` controls, Retry & Resilience accordion, and `SyntaxJsonViewer` for Output/Input inspection. |
| `src/components/NodeIcon.tsx` | 64 | 931 | `NodeIcon` | Maps 26 Lucide icon names (`Bot`, `Clock`, `Code`, `CreditCard`, `Database`, `FileInput`, `FileOutput`, `FileSpreadsheet`, `GitBranch`, `Globe`, `Hash`, `IndianRupee`, `Layers`, `Mail`, `Merge`, `MessageCircle`, `MessagesSquare`, `MousePointerClick`, `PenLine`, `Send`, `Sheet`, `Sparkles`, `Split`, `Terminal`, `Timer`, `Webhook`) to components with `Box` fallback. |
| `src/components/QueueDashboard.tsx` | 669 | 28,036 | `QueueDashboard`, `QueueJobView`, `QueueStateView`, `QueueDashboardProps` | Polls `/api/queue` every 1,500ms. Provides mode toggle (`parallel_pool` vs `sequential_fifo`), pool concurrency slider (`1x..16x`), burst traffic simulator (`5x`, `10x`, `20x`), `+1 Priority` job button, 5 KPI cards, visual worker slot grid (`Worker #1..#N`), and 50-row live job telemetry table. |

### 2.4 Backend API Route Handlers (`src/app/api/`)

| Route Endpoint | File Path | Lines | HTTP Methods | `maxDuration` | Purpose |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `/api/workflows` | `src/app/api/workflows/route.ts` | 11 | `GET`, `POST` | Default | List all workflows sorted by `updatedAt` desc, or create a new workflow. |
| `/api/workflows/[id]` | `src/app/api/workflows/[id]/route.ts` | 31 | `GET`, `PUT`, `DELETE` | Default | Fetch, update (`name`, `active`, `nodes`, `edges`), or delete a workflow; calls `syncSchedules()` on `PUT` and `DELETE`. |
| `/api/workflows/[id]/run` | `src/app/api/workflows/[id]/run/route.ts` | 23 | `POST` | `300s` | Enqueues a manual workflow execution via `enqueueWorkflowRun` (`priority: 5`, `waitForCompletion: true`) and returns `result.execution`. |
| `/api/workflows/[id]/live` | `src/app/api/workflows/[id]/live/route.ts` | 19 | `GET` | Default | Returns `{ execution, running }` for the latest execution of workflow `id` (polled every 1s by `page.tsx`). |
| `/api/workflows/run-parallel` | `src/app/api/workflows/run-parallel/route.ts` | 42 | `POST` | `300s` | Runs multiple selected (or all active) workflows concurrently via `Promise.all` over `enqueueWorkflowRun` (`mode: "parallel_batch"`, `priority: 3`). |
| `/api/queue` | `src/app/api/queue/route.ts` | 119 | `GET`, `POST` | `300s` | `GET` returns `getQueueState()`. `POST` handles `action: "config" \| "clear" \| "enqueue" \| "burst"`. |
| `/api/executions` | `src/app/api/executions/route.ts` | 25 | `GET`, `DELETE` | Default | `GET ?id=` returns full `Execution` with node I/O; `GET ?workflowId=&limit=` returns summary list (`nodeCount` instead of `nodes`); `DELETE` clears history. |
| `/api/events` | `src/app/api/events/route.ts` | 72 | `GET` | Default | Streams `WorkflowEvent` payloads via Server-Sent Events (`text/event-stream` with 15s `: ping` heartbeat) or returns recent 50 events when `?mode=poll`. |
| `/api/ai-builder` | `src/app/api/ai-builder/route.ts` | 285 | `POST` | Default | Generates a new active workflow from `{ prompt }` using Gemini (`gemini-2.5-flash` / `lite` / `2.0-flash`) or `fallbackSynthesize()`, applies `layoutGraph()`, and saves to store. |
| `/api/telegram` | `src/app/api/telegram/route.ts` | 38 | `GET`, `POST` | Default | `GET` returns (and auto-starts) Telegram listener status; `POST` supports `action: "start" \| "stop" \| "simulate"`. |
| `/api/forms/submit` | `src/app/api/forms/submit/route.ts` | 69 | `POST` | `300s` | Inserts form payload into `dbTables` (`website_monitors`, `leads`, `orders`, `ai_logs`), overrides `urls` or `prompt` on a cloned target workflow if applicable, and runs it in `mode: "form"`. |
| `/api/db` | `src/app/api/db/route.ts` | 25 | `GET`, `POST`, `DELETE` | Default | Lists table counts and rows (`GET`), inserts a record (`POST`), or clears a table (`DELETE`). |
| `/api/secrets` | `src/app/api/secrets/route.ts` | 22 | `GET`, `POST`, `DELETE` | Default | Lists secrets with masked previews (`GET`), upserts a normalized uppercase key (`POST`), or deletes a key (`DELETE`). |
| `/api/webhook/[...path]` | `src/app/api/webhook/[...path]/route.ts` | 77 | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `300s` | Matches active workflow `webhook_trigger` nodes by `path` and `method`; enqueues run (`priority: 4`) and responds either `202 Accepted` (`respond: "immediately"`) or `200 OK` with last node output (`respond: "lastNode"`). |

### 2.5 Core Domain & Execution Services (`src/lib/`)

| File Path | Lines | Size (Bytes) | Key Exports | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `src/lib/types.ts` | 103 | 2,298 | `Item`, `FieldType`, `FieldDef`, `NodeCategory`, `NodeMeta`, `WorkflowNode`, `WorkflowEdge`, `Workflow`, `RunStatus`, `NodeRunResult`, `Execution`, `Secret`, `DbRecord` | Central TypeScript data contracts shared across UI and backend. |
| `src/lib/nodes.ts` | 598 | 21,196 | `NODE_DEFS`, `NODE_MAP`, `CATEGORIES`, `defaultParams` | Client-safe metadata and field schemas for all 20 node types across 9 categories. |
| `src/lib/executors.ts` | 691 | 25,777 | `EXECUTORS`, `Executor`, `EachResult`, `RunCtx` | Server-side execution handlers for all 20 node types plus helpers (`request`, `compare`, `googleAccessToken`, `stripeForm`). |
| `src/lib/engine.ts` | 288 | 9,791 | `runWorkflow`, `runWorkflowsInParallel`, `RunOptions`, `RunResult` | Picks trigger node, plans topological waves (`planParallelWaves`), executes nodes per wave via `Promise.all`, handles retries and `continueOnError`, persists executions, and broadcasts `workflowBus` events. |
| `src/lib/expressions.ts` | 102 | 3,232 | `resolveString`, `resolveParams`, `getPath`, `ExprContext` | Evaluates `{{ ... }}` mustache expressions in a `node:vm` context with `$json`, `$input`, `$node`, `$secrets`, `$execution`, and IST date/time helpers. |
| `src/lib/queue.ts` | 390 | 11,629 | `enqueueWorkflowRun`, `enqueueBurstRuns`, `getQueueState`, `setQueueConfig`, `clearFinishedJobs`, `QueueJob`, `QueueState`, `QueueMode` | Global singleton (`globalThis.__ffQueue`) concurrent worker pool and priority/FIFO job queue. |
| `src/lib/store.ts` | 231 | 7,545 | `workflows`, `executions`, `secrets`, `dbTables` | Synchronous JSON persistence (`data/db.json`), starter workflow seeding, and external `.env` secret merging (`D:\My n8n\.env` + local `.env*`). |
| `src/lib/events.ts` | 48 | 1,158 | `workflowBus`, `WorkflowEvent`, `WorkflowEventType` | Global singleton (`globalThis.__ffEventBus`) pub/sub event bus retaining the 50 most recent workflow events. |
| `src/lib/scheduler.ts` | 88 | 2,894 | `syncSchedules`, `validateCron` | Global singleton (`globalThis.__ffCronTimer`) 15s interval ticker evaluating 5-field cron expressions for active `schedule_trigger` workflows. |
| `src/lib/telegramPoller.ts` | 138 | 3,914 | `getTelegramStatus`, `startTelegramListener`, `stopTelegramListener`, `triggerTelegramWorkflows`, `TelegramLogEntry` | Global singleton (`globalThis.__ffTgTimer`) 4.5s Telegram `getUpdates` poller that dispatches incoming messages to `telegram_trigger` workflows. |
| `src/lib/templates.ts` | 309 | 10,074 | `STARTER_WORKFLOWS` | Defines the 4 default workflows automatically seeded into `data/db.json`. |

### 2.6 Data & Runtime Storage Files (`data/`)

| File Path | Lines | Size (Bytes) | Purpose |
| :--- | :---: | :---: | :--- |
| `data/db.json` | 22,962 | 827,204 | Primary JSON store holding `workflows[]`, `executions[]` (capped at `MAX_EXECUTIONS = 500`), `secrets[]`, and `records[]` (capped at `MAX_RECORDS = 2000`). |
| `data/files/parallel-websites.jsonl` | 7 | 13,694 | Appended JSONL output written by the `Write Audit Log (Parallel 3)` node (`pw-file`) in `wf-parallel-multi-website`. |
| `data/files/top-users.jsonl` | 24 | 4,680 | Appended JSONL output written by the `Save Top Users Log` node (`n-write`) in `wf-demo-api-pipeline`. |

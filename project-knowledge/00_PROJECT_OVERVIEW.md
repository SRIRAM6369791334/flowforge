# 00 — Project Overview: FlowForge (v2.4)

> **Inspection Status:** `CONFIRMED` (100% source verification across all 33 TypeScript/React source files, 8 configuration files, and runtime data artifacts).  
> **Primary Repository Root:** `C:\Users\srira\.gemini\antigravity\scratch\flowforge`  
> **Coexisting Prototype Root:** `D:\My n8n` (FlowCraft v0.1.0)

---

## 1. Executive Summary

**FlowForge** (displayed in the studio UI header as **FlowForge v2.4** at `src/app/page.tsx:981, 1046-1049`, and `version: "0.1.0"` in `package.json:3`) is a self-hosted, visual DAG (Directed Acyclic Graph) workflow automation studio and concurrent execution engine built on **Next.js 16.4.6 (App Router)**, **React 19.3.0**, **@xyflow/react 12.12.1**, **TypeScript 5**, and **Tailwind CSS v4.3.3** (`package.json:11-29`).

Inspired by platforms such as n8n, Make, and Linear's dark-mode workspace aesthetic, FlowForge enables users to visually author, schedule, trigger, and inspect multi-step workflows that combine:
- **5 Trigger Mechanisms:** Manual runs, 5-field Cron schedules, catch-all HTTP Webhooks (`/api/webhook/[...path]`), live 2-way Telegram Bot long-polling (`getUpdates`), and Public Mini-App Forms.
- **Topological Parallel Wave Execution:** Reachable DAG nodes are grouped into topological waves via Kahn's in-degree algorithm (`planParallelWaves` in `src/lib/engine.ts:44-83`) and executed concurrently within each wave via `Promise.all` (`src/lib/engine.ts:126-236`).
- **Concurrent Worker Pool & Priority Queue Engine:** An in-memory worker pool (`globalThis.__ffQueue` in `src/lib/queue.ts:70-88`) supporting `parallel_pool` mode (configurable `1` to `20` concurrent workers, default `6`) and strict `sequential_fifo` mode (`1` worker), priority scheduling, traffic burst stress testing (`enqueueBurstRuns`), and real-time slot telemetry.
- **AI Orchestration & Natural Language Workflow Synthesis:** Google Gemini REST (`v1beta` `generateContent`) with a 4-model automatic fallback cascade (`gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` → `gemini-flash-latest` → adaptive live summary fallback in `src/lib/executors.ts:373-440`), OpenAI-compatible `/chat/completions` (`src/lib/executors.ts:443-460`), and a `Cmd+K` AI Workflow Builder (`/api/ai-builder/route.ts:1-285`) that converts English or Tanglish prompts into auto-laid-out multi-branch workflows.
- **Omnichannel Integrations & Local System Access:** Telegram Bot API, Gmail SMTP (via `nodemailer`) & Resend API, WhatsApp Cloud API (`v21.0`), Slack & Discord webhooks, Google Sheets v4 API (RS256 Service Account JWT), Razorpay & Stripe payment APIs, local JSON database tables (`website_monitors`, `leads`, `orders`, `ai_logs`), sandboxed JavaScript execution (`node:vm`), local filesystem read/write (`node:fs/promises`), and shell command execution (`node:child_process`).

---

## 2. Prompt Terminology vs. Actual Codebase Reality (`CONFIRMED`)

The discovery request references a hypothetical system ("FlowPilot AI" with an Express/FastAPI backend and PostgreSQL/MongoDB). Below is the verified mapping to the actual **FlowForge** repository:

| Concept / Layer | Prompt Example | Actual FlowForge Implementation (`CONFIRMED`) | Evidence (File & Lines) |
| :--- | :--- | :--- | :--- |
| **Product Name** | FlowPilot AI | **FlowForge** (`flowforge` in `package.json`, `FlowForge — Workflow Automation` in metadata, `FlowForge v2.4` in UI) | `package.json:2`, `src/app/layout.tsx:16`, `src/app/page.tsx:1046-1049` |
| **Frontend Framework** | React / Next.js | **Next.js 16.4.6** App Router + **React 19.3.0** + **@xyflow/react 12.12.1** | `package.json:13-18`, `src/app/page.tsx:1-16` |
| **Backend Server** | Express / FastAPI / NestJS | **Next.js App Router Route Handlers** (`src/app/api/**/route.ts`) + `src/instrumentation.ts` startup hook | `src/instrumentation.ts:1-8`, `src/app/api/**` (14 route files) |
| **Workflow Engine** | Custom / BullMQ | **Custom Topological Wave Engine** (`src/lib/engine.ts`) + **In-Memory Concurrent Worker Pool** (`src/lib/queue.ts`) | `src/lib/engine.ts:44-288`, `src/lib/queue.ts:114-283` |
| **Database / Storage** | PostgreSQL / Prisma / MongoDB | **File-backed JSON Store** (`data/db.json`) + **JSONL File Logs** (`data/files/*.jsonl`) | `src/lib/store.ts:6-231`, `data/db.json` |
| **Secret Management** | `.env` / Vault | **Secrets Vault** persisted in `data/db.json` and auto-synced on every read from `D:\My n8n\.env`, `D:\My n8n\.env.local`, `.env.local`, and `.env` | `src/lib/store.ts:8-69`, `src/app/api/secrets/route.ts:1-22` |
| **Real-Time Telemetry** | WebSockets / Socket.io | **1-Second Live HTTP Polling** (`/api/workflows/[id]/live`, `/api/queue`) + **Server-Sent Events (SSE) Bus** (`/api/events` & `src/lib/events.ts`) | `src/app/page.tsx:289-359`, `src/lib/events.ts:1-48`, `src/app/api/events/route.ts:1-72` |

---

## 3. Core Platform Capabilities (`CONFIRMED`)

1. **Interactive React Flow DAG Studio (`src/app/page.tsx`, `src/components/CanvasNode.tsx`):**
   - Full-viewport dark studio canvas (`#090a0f` / `#0c0d14`) with custom 240px `CanvasNode` cards displaying category color pills, live parameter summaries, retry/continue-on-error badges, execution wave badges (`wave 1`, `wave 2`), millisecond duration pills, and true/false branching handles (`src/components/CanvasNode.tsx:101-304`).
   - Collapsible left sidebar (48px icon rail expanding to a 260px drawer) containing a searchable, categorized palette of **20 node types across 9 categories** and the saved workflow list (`src/app/page.tsx:974-1214`).
   - Topological left-to-right **Auto-Layout (`⌘L` / `Ctrl+L`)** that ranks nodes by longest path from triggers and spaces them into 310px horizontal wave columns (`src/app/page.tsx:469-495`, `src/app/api/ai-builder/route.ts:45-69`).
   - Workflow JSON **Export & Import** (`handleExportJson` / `handleImportJson` in `src/app/page.tsx:558-600`).

2. **Slide-Over Node Inspector (`src/components/Inspector.tsx`):**
   - 360px right-hand drawer with 3 tabs: **Parameters**, **Output Data**, and **Input Data** (`src/components/Inspector.tsx:145-639`).
   - Features 1-click **Quick Expression Chips** (`{{ $json }}`, `{{ $secrets.API_KEY }}`, `{{ $node['Previous Node'].json }}`, `{{ $today }}`), live Webhook URL copy callout, per-node **Retry & Resilience** settings (`retryCount` 0–5, `retryDelayMs`, `continueOnError`), trigger "Run from here" button, and a custom regex-tokenized `SyntaxJsonViewer` (`src/components/Inspector.tsx:48-143`).

3. **Topological Wave DAG Engine & Sandboxed Expressions (`src/lib/engine.ts`, `src/lib/expressions.ts`):**
   - Evaluates `{{ ... }}` expressions inside a `node:vm` sandbox (`timeout: 1000ms`) with access to `$json`, `$input`, `$node`, `$secrets`, `$execution`, `$now`, `$today`, `$todayDate` (IST), and `$todayTime` (IST) (`src/lib/expressions.ts:15-47`).
   - Detects cycles via Kahn's algorithm and executes independent branches in parallel waves via `Promise.all` (`src/lib/engine.ts:44-83, 126`).

4. **Concurrent Worker Pool & Traffic Burst Stress Tester (`src/lib/queue.ts`, `src/components/QueueDashboard.tsx`):**
   - Manages job execution across `1..20` worker slots (`parallel_pool` with priority + FIFO tie-breaking, or `sequential_fifo` single-worker mode) (`src/lib/queue.ts:114-184`).
   - Includes a live dashboard in the bottom telemetry dock to switch modes, drag concurrency (`1x..16x`), enqueue priority jobs, or fire `5x`, `10x`, or `20x` simultaneous burst runs (`src/components/QueueDashboard.tsx:70-669`).

5. **AI Workflow Builder (`Cmd+K`) & Multi-Model Gemini Executor (`src/app/api/ai-builder/route.ts`, `src/lib/executors.ts`):**
   - Synthesizes complete workflows from natural language using Gemini (`responseMimeType: "application/json"`) with a deterministic keyword heuristic fallback (`fallbackSynthesize` in `src/app/api/ai-builder/route.ts:71-204`).
   - Injects real-world IST date/time and user context (`Sriram`, `Asia/Kolkata`, `2026`) into Gemini node prompts (`src/lib/executors.ts:377-393`).

6. **Background Daemons: 2-Way Telegram Poller & Cron Scheduler (`src/instrumentation.ts`, `src/lib/telegramPoller.ts`, `src/lib/scheduler.ts`):**
   - Auto-started on Next.js Node.js runtime boot via `register()` in `src/instrumentation.ts:1-8`.
   - `telegramPoller.ts` polls `getUpdates` every `4500ms` and triggers active `telegram_trigger` workflows (`src/lib/telegramPoller.ts:71-129`).
   - `scheduler.ts` ticks every `15,000ms` (deduplicated per minute) and runs active `schedule_trigger` workflows matching 5-field cron expressions (`src/lib/scheduler.ts:53-88`).

7. **Starter Workflows Seeded Out-of-the-Box (`src/lib/templates.ts`):**
   - `wf-parallel-multi-website`: **🌐 Parallel 5-Website Live Monitor → DB + Gemini AI + Telegram + Gmail** (7 nodes, 6 edges).
   - `wf-live-ai-telegram-gmail`: **⚡ Live: Gemini AI → Telegram Bot + Gmail Dispatch (Active Keys)** (4 nodes, 3 edges).
   - `wf-telegram-bot-responder`: **💬 2-Way Telegram Bot Listener → Parallel Web Check + Gemini AI Reply** (4 nodes, 3 edges).
   - `wf-demo-api-pipeline`: **🚀 Live Demo: API Fetch → IF Filter → JS Transform → File Log** (5 nodes, 4 edges).

---

## 4. Technology Stack Summary (`CONFIRMED`)

| Layer | Technology | Version | Evidence |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (Next.js Node runtime) | `@types/node: ^20` | `package.json:22`, `src/instrumentation.ts:2` |
| **Web Framework** | Next.js (App Router + Turbopack CSS loader) | `16.4.6` | `package.json:15`, `next.config.ts:3-15` |
| **UI Library** | React & React DOM | `19.3.0` | `package.json:17-18` |
| **Graph / Canvas Engine** | `@xyflow/react` (React Flow v12) | `^12.12.1` | `package.json:13`, `src/app/page.tsx:4-16` |
| **Iconography** | `lucide-react` | `^1.71.0` | `package.json:14`, `src/components/NodeIcon.tsx:1-30` |
| **Styling** | Tailwind CSS v4 + `@tailwindcss/turbopack` | `4.3.3` | `package.json:21, 27`, `src/app/globals.css:1` |
| **Typography** | `Geist` & `Geist_Mono` (`next/font/google`) | Next.js built-in | `src/app/layout.tsx:2-13` |
| **SMTP Client** | `nodemailer` | `^10.3.1` (`@types/nodemailer: ^8.0.2`) | `package.json:12, 16`, `src/lib/executors.ts:7, 541-553` |
| **Language & Linting** | TypeScript + ESLint 9 (`eslint-config-next`) | `^5` / `^9` | `package.json:25-28`, `tsconfig.json:1-34`, `eslint.config.mjs:1-18` |
| **Node Built-ins Used** | `node:fs`, `node:fs/promises`, `node:path`, `node:crypto`, `node:vm`, `node:child_process`, `node:util` | Node.js Core | `src/lib/store.ts:1-2`, `src/lib/executors.ts:1-6`, `src/lib/expressions.ts:1` |

---

## 5. Relationship Between `flowforge` and `D:\My n8n` (`CONFIRMED`)

FlowForge (`C:\Users\srira\.gemini\antigravity\scratch\flowforge`) coexists with an earlier prototype located at `D:\My n8n` (named `flowcraft` in `D:\My n8n\package.json:2`).

### 5.1 Live Credential Synchronization (`src/lib/store.ts:8-69`)
FlowForge directly reads and merges environment secrets from `D:\My n8n` on every database read via `EXTERNAL_ENV_FILES` in `src/lib/store.ts:8-13`:
```ts
const EXTERNAL_ENV_FILES = [
  "D:\\My n8n\\.env",
  "D:\\My n8n\\.env.local",
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
];
```
- `loadEnvSecrets()` (`src/lib/store.ts:49-59`) parses each file in order (so local `.env.local`/`.env` override `D:\My n8n\.env` if keys collide, while user-saved vault values in `data/db.json` take highest precedence in `mergeSecrets()` at `src/lib/store.ts:61-69`).
- It also normalizes Gmail credentials (`GMAIL_USER` → `SMTP_USER` and `GMAIL_APP_PASSWORD` → `SMTP_PASS` at `src/lib/store.ts:54-55`).
- In fact, `C:\Users\srira\.gemini\antigravity\scratch\flowforge\.env.local` (3,221 bytes, last modified `01-11-2026 18:39:18`) is an exact byte-for-byte copy of `D:\My n8n\.env` (3,221 bytes, last modified `01-11-2026 18:39:18`).

### 5.2 Architectural Comparison: `D:\My n8n` (FlowCraft) vs. `scratch\flowforge` (FlowForge)

| Dimension | `D:\My n8n` (`flowcraft` Prototype) | `C:\Users\srira\.gemini\antigravity\scratch\flowforge` (`flowforge` Active App) |
| :--- | :--- | :--- |
| **Package Name & Version** | `flowcraft` (`0.1.0`), Next.js `16.4.3`, `pnpm` | `flowforge` (`0.1.0` / UI `v2.4`), Next.js `16.4.6`, `npm` |
| **Canvas Implementation** | Custom DOM/SVG canvas (`InfiniteCanvas.tsx`, `WireRenderer.tsx`, `NodeCard.tsx`) | `@xyflow/react` v12 (`ReactFlow`, `CanvasNode.tsx`, `MiniMap`, `Controls`) |
| **Persistence Layer** | SQLite (`data/flowcraft.sqlite` via `src/server/db/database.ts`) + `mysql2` dependency | Self-contained JSON store (`data/db.json` via `src/lib/store.ts`) + `data/files/*.jsonl` |
| **Execution Architecture** | `src/server/engine/serverRunner.ts` + client `src/utils/executor.ts` + per-service routes (`/api/run/gemini`, `/api/run/email`, etc.) | Unified topological wave engine (`src/lib/engine.ts`) + 20 modular executors (`src/lib/executors.ts`) + Concurrent Worker Pool (`src/lib/queue.ts`) |
| **Public Forms** | Separate Next.js pages under `src/app/form/{ecommerce,jobs,leads,news,summarize}/page.tsx` | Unified interactive Mini-App Form tester in the studio dock + `/api/forms/submit` endpoint |
| **Active Status** | Earlier prototype (last modified Nov 1–6, 2026); supplies shared `.env` credentials | Active primary workspace (last modified Nov 11, 2026) |

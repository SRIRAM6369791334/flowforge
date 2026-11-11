# 13 — Understanding Gaps, Discrepancies & Developer Clarification Questions

> **Stage 1 Discovery Artifact** · **Project**: FlowForge (`C:\Users\srira\.gemini\antigravity\scratch\flowforge`)  
> **Scope**: Reconciliation between external prompt assumptions and the actual codebase on disk, multi-repository disambiguation (`flowforge` vs. `D:\My n8n`), unverified external credentials, and structured clarification questions prior to Stage 2.

---

## 1. Prompt Assumptions vs. Actual Repository Reality

Every statement in the discovery prompt was cross-checked against the actual files in `C:\Users\srira\.gemini\antigravity\scratch\flowforge`:

| Dimension | Prompt / External Assumption | Actual Repository Reality (Verified on Disk) | Evidence |
| :--- | :--- | :--- | :--- |
| **Project Identity** | Referred to generically in prompt templates as `"FlowPilot AI"` or `"n8n clone"` | Named **`FlowForge`** (`"name": "flowforge"` in `package.json:2`, branded `FlowForge v2.4` in `src/app/page.tsx:1046-1049`). A separate prototype at `D:\My n8n` is named **`flowcraft`** (`D:\My n8n\package.json:2`). | `package.json:2`, `src/app/page.tsx:1046`, `D:\My n8n\package.json:2` |
| **Backend Framework** | Assumed a standalone `"Express API"` / separate backend server | Built on **Next.js 16.4.6 App Router** (`src/app/api/**/route.ts`) running in the same Node.js process as the React 19 Studio UI. Background services (`scheduler.ts`, `telegramPoller.ts`) bootstrap via Next.js `src/instrumentation.ts:1-8`. | `package.json:15`, `src/instrumentation.ts:1-8` |
| **Database Layer** | Assumed SQL / MySQL / Prisma or external Redis queue | Active `flowforge` app uses a **zero-dependency file-backed JSON store** (`data/db.json`) managed by `src/lib/store.ts` and an **in-memory worker pool** managed by `src/lib/queue.ts`. (Although `.env` contains `MYSQL_*` and `REDIS_URL` keys synced from `D:\My n8n\.env`, they are unused in `flowforge`.) | `src/lib/store.ts:6-22`, `src/lib/queue.ts:77-88` |
| **Frontend Routing** | Assumed multi-page routes (e.g., standalone `/forms/[slug]` pages) | `flowforge` is a **Single-Page Studio Application** (`src/app/page.tsx`, 2,260 lines). Public Mini-App forms are tested inline inside the Bottom Telemetry Dock (`src/app/page.tsx:1925-1999`) via `POST /api/forms/submit` (`src/app/api/forms/submit/route.ts`). Standalone `/form/*` pages exist only in the separate `D:\My n8n\src\app\form\*` prototype. | `src/app/page.tsx:1925-1999`, `D:\My n8n\src\app\form\page.tsx` |
| **Email Ethereal Fallback** | Assumed an Ethereal test-account fallback in `executors.ts` | `flowforge`'s `email` executor (`src/lib/executors.ts:522-555`) supports live **Gmail SMTP** (`nodemailer` on port 465) and **Resend REST API** (`https://api.resend.com/emails`). The Ethereal fallback existed in `D:\My n8n\src\app\api\run\email\route.ts`, not in `flowforge`. | `src/lib/executors.ts:522-555` |

---

## 2. Two-Repository Disambiguation (`flowforge` vs. `D:\My n8n`)

Because `src/lib/store.ts:9-10` explicitly reads `D:\My n8n\.env` and `D:\My n8n\.env.local`, it is critical to distinguish the two projects on the host machine:

1. **`C:\Users\srira\.gemini\antigravity\scratch\flowforge` (Active Target Workspace)**:
   - Next.js `16.4.6` + `@xyflow/react` `^12.12.1`.
   - 22 node types across 9 categories (`src/lib/nodes.ts:7-579`), topological wave parallel execution engine (`src/lib/engine.ts`), priority worker pool (`src/lib/queue.ts`), AI Workflow Builder (`src/app/api/ai-builder/route.ts`), 2-way Telegram long-poller (`src/lib/telegramPoller.ts`), and JSON persistence (`data/db.json`).
2. **`D:\My n8n` (Earlier Prototype `"flowcraft"`)**:
   - Next.js `16.4.3` + custom canvas (`src/components/canvas/InfiniteCanvas.tsx`), SQLite/MySQL persistence (`D:\My n8n\data\flowcraft.sqlite`, `D:\My n8n\src\server\db\database.ts`), and standalone `/form/*` routes (`D:\My n8n\src\app\form\...`).
   - Serves as the shared `.env` credential source for `flowforge` via `EXTERNAL_ENV_FILES` (`src/lib/store.ts:8-13`).

---

## 3. Unverified External Integrations & Runtime Paths

While the code paths for all 22 node types were 100% statically inspected and verified, the following external integrations have **not** been live-exercised with real third-party credentials in `data/db.json`:

| Integration / Node Type | Code Verification Status | Live Credential Status in `.env` / `data/db.json` | What Remains Unverified Live |
| :--- | :--- | :--- | :--- |
| **Google Gemini (`gemini`), Telegram (`telegram`, `telegram_trigger`), Gmail (`email`), Resend (`email`), Parallel Web (`parallel_web`)** | 100% Verified | Keys present & active in `.env` and `data/db.json` | Verified live in historical executions (`data/db.json` has 70 runs; `data/files/parallel-websites.jsonl` has 7 runs). |
| **OpenAI-Compatible LLM (`openai_chat`)** | 100% Verified (`executors.ts:443-460`) | `OPENAI_API_KEY` is blank in `.env`; `OLLAMA_BASE_URL` is set to `http://localhost:11434` | Live response from a running local Ollama instance or OpenAI API key. |
| **WhatsApp Cloud API (`whatsapp`)** | 100% Verified (`executors.ts:489-505`) | `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` are not configured in `data/db.json` | Live Meta Graph API v21.0 message dispatch. |
| **Slack (`slack`) & Discord (`discord`)** | 100% Verified (`executors.ts:506-521`) | `SLACK_WEBHOOK_URL` and `DISCORD_WEBHOOK_URL` are blank/unconfigured | Live webhook delivery to Slack/Discord channels. |
| **Google Sheets (`google_sheets`)** | 100% Verified (`executors.ts:91-110, 557-577`) | `GOOGLE_SERVICE_ACCOUNT` is not configured in `data/db.json` | Live RS256 JWT token exchange against `oauth2.googleapis.com` and Sheets v4 append/read. |
| **Razorpay (`razorpay`) & Stripe (`stripe`)** | 100% Verified (`executors.ts:579-647`) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `STRIPE_SECRET_KEY` are not configured in `data/db.json` | Live order/payment-link creation and checkout session generation against Razorpay/Stripe sandboxes. |

---

## 4. Structured Questions for Developer Clarification (Before Stage 2)

Before planning or executing any Stage 2 code enhancements, the following architectural and product questions should be clarified with the developer:

### Q1. Persistence Target: Keep `data/db.json` or Migrate to SQLite / MySQL?
- **Context**: `D:\My n8n\.env` contains `DB_TYPE`, `MYSQL_*`, and `REDIS_URL`, and `D:\My n8n` has a `flowcraft.sqlite` file, whereas `flowforge` currently uses `data/db.json` via synchronous `fs.readFileSync`/`fs.writeFileSync` (`src/lib/store.ts:71-117`).
- **Question**: Should FlowForge remain on the zero-dependency `data/db.json` store (potentially refactored to async atomic writes with in-memory caching), or do you want to migrate persistence to SQLite / MySQL?

### Q2. Queue Routing Consistency for Background Triggers
- **Context**: Manual runs (`POST /api/workflows/[id]/run`), parallel batch runs (`POST /api/workflows/run-parallel`), and webhooks (`POST /api/webhook/[...path]`) route through `enqueueWorkflowRun()` in `src/lib/queue.ts`, whereas Telegram messages (`src/lib/telegramPoller.ts:56`), Cron schedules (`src/lib/scheduler.ts:64`), and Form submissions (`src/app/api/forms/submit/route.ts:58`) call `runWorkflow()` directly, bypassing the Worker Pool Queue dashboard.
- **Question**: Should **all** workflow triggers (including Telegram, Cron schedules, and Public Forms) be routed through `enqueueWorkflowRun()` so every execution is governed by worker pool concurrency limits and visible in the Live Job Telemetry table?

### Q3. Gemini Error Handling vs. Adaptive Fallback (`src/lib/executors.ts:432-440`)
- **Context**: Currently, if all Gemini models fail or hit quota/503 errors, `executors.ts:434-440` returns a synthetic fallback message (`model: "gemini-adaptive-fallback"`) with `status: "success"`. This keeps demos running smoothly but prevents node-level retries (`retryCount`) or error alerting from firing.
- **Question**: Do you want to keep the always-succeeds adaptive fallback for demo reliability, or make it configurable (e.g., a node boolean toggle `"Fallback on API Quota/503"` vs. throwing an error so `retryCount` / `continueOnError` can handle it)?

### Q4. Public Form Standalone Pages (`/forms/[slug]`)
- **Context**: Currently, Public Forms (`parallel-websites`, `lead-capture`, `order-checkout`, `ask-ai`) are triggered from the embedded tester inside the Studio's Bottom Telemetry Dock (`src/app/page.tsx:1925-1999`) via `POST /api/forms/submit`.
- **Question**: Would you like dedicated shareable public routes (e.g., `src/app/forms/[slug]/page.tsx`) in `flowforge` so external users can open and submit those mini-apps outside the Studio UI?

### Q5. Starter Workflow & `.env` Secret Deletion Behavior (`src/lib/store.ts:61-101`)
- **Context**: Because `read()` automatically re-seeds missing `STARTER_WORKFLOWS` (`lines 87-91`) and re-merges `EXTERNAL_ENV_FILES` (`line 93`), deleting a starter workflow or an `.env`-synced secret in the UI causes it to reappear on the next read.
- **Question**: Should starter workflows only be seeded when `data/db.json` is first created (or via an explicit `"Reset Starter Templates"` button), and should UI secret deletions/overrides take permanent precedence over `.env` files?

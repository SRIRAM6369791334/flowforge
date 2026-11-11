# FlowForge — Stage 2: Comprehensive Defect Registry

> **Scope**: Exhaustive inventory of all confirmed defects, architectural flaws, vulnerabilities, and reliability gaps identified during the Stage 2 Technical Audit.  
> **Source Snapshot**: FlowForge v2.4 (`flowforge@0.1.0`).  
> **Total Logged Defects**: 28 Confirmed Findings.

---

## 1. Defect Master Summary Table

| Defect ID | Severity | Category | Target File & Line | Summary Title |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-AI-01** | **CRITICAL** | AI Systems | `src/lib/telegramPoller.ts:156`, `src/lib/executors.ts:369` | Gemini Date Hallucination via Missing Runtime Timestamp Context |
| **DEF-WF-01** | **CRITICAL** | Workflow Engine | `src/app/page.tsx:210-245`, `CanvasNode.tsx:45-80` | Canvas Live Execution Feedback Gap on Background / Telegram Triggers |
| **DEF-SEC-01** | **CRITICAL** | Security | `src/lib/executors.ts:673-690` (`exec` node) | Unrestricted Arbitrary Shell Command Execution via `child_process.exec` |
| **DEF-SEC-02** | **HIGH** | Security | `src/lib/executors.ts:649-672` (`read_file`, `write_file`) | Unrestricted Path Traversal & Arbitrary File System Write |
| **DEF-SEC-03** | **HIGH** | Security | `src/app/api/**/route.ts` (All 14 Routes) | Complete Absence of Authentication & Authorization Controls |
| **DEF-AI-02** | **HIGH** | AI Systems | `src/app/api/ai-builder/route.ts:18-41` | AI Builder Whitelist Mismatch (20 whitelisted vs. 27 registered nodes) |
| **DEF-DB-01** | **HIGH** | Database | `src/lib/store.ts:95-145` | Blocking Synchronous Full-Document Parse & Serialized File I/O |
| **DEF-WF-02** | **HIGH** | Workflow Engine | `src/lib/queue.ts:40-42` | Volatile In-Memory Job Queue State Lost on Server Restart |
| **DEF-UI-01** | **HIGH** | UI/UX | `src/app/page.tsx:1219-1352` | Top Action Bar Button Collision & Layout Clutter on Standard Viewports |
| **DEF-UI-02** | **HIGH** | UI/UX | `src/app/page.tsx:1354-1453`, `CanvasNode.tsx:25-90` | Clumsy Dark Theme Aesthetics, Low Contrast, & Missing Animated Execution Glow |
| **DEF-NET-01** | **MEDIUM** | Integrations | `src/lib/executors.ts:536-545` (`email` node) | SMTP Connection Reconstruction on Every Item Execution (`mode: "each"`) |
| **DEF-CORE-01**| **MEDIUM** | Core Engine | `src/lib/executors.ts:319-322` (`if` node) | Coercion Failure in Numerical & Comparison Operators |
| **DEF-CORE-02**| **MEDIUM** | Core Engine | `src/lib/executors.ts:351-358` (`split_out` node) | Silent Output Dropping on Unresolved or Primitive Array Paths |
| **DEF-CORE-03**| **MEDIUM** | Core Engine | `src/lib/executors.ts:323-350` (`code` node) | Prototype Pollution Sandbox Escape Vector in `node:vm` Context |
| **DEF-NET-02** | **MEDIUM** | Integrations | `src/lib/executors.ts:165-281` (`parallel_web`) | Protocolless URL Parsing Failure & Static 8s Concurrency Timeout |
| **DEF-AI-03**  | **MEDIUM** | AI Systems | `src/lib/telegramPoller.ts:24-35` | Volatile In-Memory Session Memory Wiped on Server Restart |
| **DEF-AI-04**  | **MEDIUM** | AI Systems | `src/lib/executors.ts:369-442` (`gemini` node) | Missing Exponential Backoff Retry on HTTP 429 Quota Exhaustion |
| **DEF-DB-02**  | **MEDIUM** | Database | `src/lib/store.ts:220-240` | Process-Local Mutex Fails to Prevent Concurrency Conflicts Across Multi-Process Next.js |
| **DEF-SEC-04** | **LOW** | Security | `data/db.json` (`secrets` dictionary) | Cleartext Storage of API Secrets on Local Filesystem |
| **DEF-SEC-05** | **LOW** | Security | `src/app/api/webhook/[...path]/route.ts:8` | Unsanitized Webhook Catch-All Path Subsegment Merging |
| **DEF-SEC-06** | **LOW** | Security | `src/app/api/events/route.ts:4-72` | Unrestricted SSE Stream Broadcast Exposing Execution Data to Any Origin |
| **DEF-WF-03** | **LOW** | Workflow Engine | `src/lib/queue.ts:145-185` | Worker Slot Starvation Risk from Unhandled Hanging Network Calls |
| **DEF-UI-03**  | **LOW** | UI/UX | `src/components/Inspector.tsx:85-160` | Inconvenient JSON Parameter Editing in Small Single-Line Inputs |
| **DEF-UI-04**  | **LOW** | UI/UX | `src/app/page.tsx:1500-1650` | Bottom Telemetry Dock Lacks Minimized State on Low-Resolution Displays |
| **DEF-QA-01**  | **LOW** | Testing & QA | `package.json:6-12` | 0% Automated Test Suite Coverage Across Engine & Node Handlers |
| **DEF-QA-02**  | **INFORMATIONAL** | Testing & QA | Root Directory | Missing Continuous Integration (CI) Quality Gates |
| **DEF-DOC-01** | **INFORMATIONAL** | Documentation | `project-knowledge/00_PROJECT_OVERVIEW.md` | Outdated Node Count (20 nodes vs 27 registered in code) |
| **DEF-DOC-02** | **INFORMATIONAL** | Documentation | Preliminary Discovery Notes | Erroneous Assumptions of Express Backend & PostgreSQL Server |

---

## 2. In-Depth Defect Profiles for Critical & High Findings

### DEF-AI-01: Gemini Date Hallucination via Missing Runtime Timestamp Context
- **Severity**: **CRITICAL**
- **Category**: AI Subsystem / Prompt Engineering
- **File**: [`src/lib/telegramPoller.ts:156-167`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/lib/telegramPoller.ts#L156-L167) & [`src/lib/executors.ts:369-375`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/lib/executors.ts#L369-L375)
- **Observed Behavior**: In live user testing on November 11, 2026, user asked *"today date ena da"*. Bot replied: *"23rd July 2024"*. When user prompted *"check date da totay is 11.11.2026 da"*, bot replied: *"Ila da Sri, today is not 11.11.2026. Adhu romba naal apparam varum!"*.
- **Expected Behavior**: Bot must know current live date, time, and timezone accurately (`2026-11-11`).
- **Root Cause**: Neither `telegramPoller.ts` nor the `gemini` executor injects the current host ISO timestamp into the system instructions or prompt context. Gemini defaults to its pre-training cutoff baseline.
- **Impact**: Severe user distrust, wrong date scheduling, and incorrect date calculations in business workflows.
- **Remediation**: In `telegramPoller.ts` and `executors.ts:369`, dynamically prepend:
  `Current Date & Time: ${new Date().toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})` to the system instruction string.
- **Regression Risk**: Low.
- **Validation Test**: Send synthetic message to `/api/telegram` asking for current year, verify returned string matches `2026`.

---

### DEF-WF-01: Canvas Live Execution Feedback Gap on External Triggers
- **Severity**: **CRITICAL**
- **Category**: Workflow Engine / UI Synchronization
- **File**: [`src/app/page.tsx:210-245`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/app/page.tsx#L210-L245) & [`src/components/CanvasNode.tsx:45-80`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/components/CanvasNode.tsx#L45-L80)
- **Observed Behavior**: When a workflow is triggered by an incoming Telegram message or Webhook, it runs and completes in the backend, but the open studio canvas at `http://localhost:3000/` shows no visual wave execution, progress rings, or completion badges.
- **Expected Behavior**: The open canvas should visibly illuminate nodes, showing active pulsing wave states and elapsed milliseconds in real-time as background jobs run.
- **Root Cause**: `src/app/page.tsx` only updates node visual status for `activeExecutionId`. `activeExecutionId` is set strictly inside `handleRunWorkflow()` when the user clicks "Execute Workflow" manually. Background triggers generate new execution IDs that stream over `/api/events`, but `page.tsx` does not auto-bind to the background execution ID.
- **Impact**: User cannot observe or debug automation execution live while testing on mobile devices.
- **Remediation**: In `src/app/page.tsx`, listen to SSE `workflow_start` events. If `event.workflowId === currentWorkflow.id`, automatically set `activeExecutionId = event.executionId`, auto-attaching the canvas to the live execution wave.
- **Regression Risk**: Medium (must ensure canvas editing is not unexpectedly locked while user is actively designing).
- **Validation Test**: Simulate Telegram message via `/api/telegram` and observe canvas nodes automatically transitioning to green success badges with wave durations.

---

### DEF-SEC-01: Unrestricted Arbitrary Shell Command Execution via `child_process.exec`
- **Severity**: **CRITICAL**
- **Category**: Application Security / Remote Code Execution (RCE)
- **File**: [`src/lib/executors.ts:673-690`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/lib/executors.ts#L673-L690) (`exec` node)
- **Observed Behavior**: The `exec` node accepts any shell string in `command` and executes it directly via Node's `child_process.exec()`.
- **Expected Behavior**: Command execution must be sandboxed, disabled by default, or restricted to an approved binary whitelist.
- **Root Cause**: Complete absence of command validation, sandboxing, or permission gating.
- **Impact**: Full host compromise. An unauthenticated API caller or untrusted webhook payload can execute arbitrary malware or wipe files.
- **Remediation**: Introduce a server-level configuration switch (`ENABLE_SYSTEM_EXEC=false` by default). Restrict executable paths and reject shell metacharacters (`&`, `|`, `;`, `` ` ``, `$`).
- **Regression Risk**: Low (only impacts workflows intentionally running host terminal commands).
- **Validation Test**: Attempt to run `whoami` when `ENABLE_SYSTEM_EXEC=false` and verify execution is denied.

---

### DEF-SEC-02: Unrestricted Path Traversal & Arbitrary File System Write
- **Severity**: **HIGH**
- **Category**: Application Security / Path Traversal
- **File**: [`src/lib/executors.ts:649-672`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/lib/executors.ts#L649-L672) (`read_file`, `write_file`)
- **Observed Behavior**: `read_file` and `write_file` accept arbitrary relative or absolute paths (e.g. `../../../../etc/passwd` or `C:\Windows\System32\drivers\etc\hosts`) and read/write directly.
- **Expected Behavior**: File operations must be strictly jailed to the project's `data/files/` root directory.
- **Root Cause**: `path.resolve(s(p.path))` is called without validating that the resolved path starts with the allowed sandbox root (`path.resolve("./data/files")`).
- **Impact**: Arbitrary file read/write, host system corruption, credential theft.
- **Remediation**: Enforce `safeResolve(baseDir, userPath)` asserting `resolvedPath.startsWith(allowedBaseDir)`.
- **Regression Risk**: Low.
- **Validation Test**: Pass `../../package.json` to `write_file` and verify `Path traversal outside sandbox denied` exception.

---

### DEF-SEC-03: Complete Absence of Authentication & Authorization Controls
- **Severity**: **HIGH**
- **Category**: Security / Access Control
- **File**: All 14 routes in `src/app/api/**/route.ts`
- **Observed Behavior**: Every endpoint (`/api/workflows`, `/api/queue`, `/api/secrets`, `/api/db`) can be invoked by any HTTP client with zero credentials.
- **Expected Behavior**: Sensitive endpoints (secrets, workflow deletion, queue management) should require a bearer token or local studio authorization cookie.
- **Root Cause**: No authentication middleware or route guards were implemented.
- **Impact**: Open exposure if bound to `0.0.0.0` or hosted on a public server.
- **Remediation**: Implement a Next.js `middleware.ts` verifying `STUDIO_API_KEY` header for external requests.
- **Regression Risk**: Medium (must ensure internal Studio UI passes token seamlessly).

---

### DEF-AI-02: AI Builder Whitelist Mismatch (20 whitelisted vs. 27 registered nodes)
- **Severity**: **HIGH**
- **Category**: AI Subsystems
- **File**: [`src/app/api/ai-builder/route.ts:18-41`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/app/api/ai-builder/route.ts#L18-L41)
- **Observed Behavior**: Gemini's `SYSTEM_PROMPT` in AI Builder only lists 20 node types. Nodes `db_query`, `google_sheets`, `razorpay`, `stripe`, `read_file`, `write_file`, and `exec` are omitted.
- **Expected Behavior**: AI Workflow Builder should be capable of generating workflows using all registered capabilities of FlowForge.
- **Root Cause**: Hardcoded whitelist in system prompt was not updated when remaining 7 node types were added to `nodes.ts` and `executors.ts`.
- **Impact**: Prompts like *"Save incoming leads to database table and append to Google Sheets"* fail to synthesize `db_query` or `google_sheets` nodes, falling back to heuristic approximations.
- **Remediation**: Update `SYSTEM_PROMPT` in `ai-builder/route.ts` to include all 27 nodes and their parameter schemas.
- **Regression Risk**: Low.

---

### DEF-DB-01: Blocking Synchronous Full-Document Parse & Serialized File I/O
- **Severity**: **HIGH**
- **Category**: Database / Scalability
- **File**: [`src/lib/store.ts:95-145`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/lib/store.ts#L95-L145)
- **Observed Behavior**: Every read or write synchronously executes `fs.readFileSync` and `JSON.parse` / `JSON.stringify` on the entire `data/db.json` document.
- **Expected Behavior**: High-frequency execution logs should not block workflow reads or trigger synchronous JSON re-serialization of all historical executions.
- **Root Cause**: Monolithic document store design.
- **Impact**: High CPU latency spikes and event-loop lag during concurrent bursts.
- **Remediation**: Split storage into distinct files: `data/workflows.json`, `data/executions.json`, and `data/secrets.json`, or adopt embedded SQLite.
- **Regression Risk**: High (requires updating storage access layer).

---

### DEF-UI-01: Top Action Bar Button Collision & Layout Clutter on Standard Viewports
- **Severity**: **HIGH**
- **Category**: UI/UX
- **File**: [`src/app/page.tsx:1219-1352`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/app/page.tsx#L1219-L1352)
- **Observed Behavior**: As visible in user's canvas screenshot, buttons in the top header ("Auto-Parallel W Layout", "Telegram Bot Listener", "Secrets Vault", "Active" toggle) collide and overlap horizontally on screens smaller than 1600px width.
- **Expected Behavior**: Top header controls must feature responsive wrapping, icon button collapses, or an overflow dropdown.
- **Root Cause**: Absolute/fixed padding and rigid `flex` containers without `flex-shrink` or responsive breakpoints.
- **Impact**: Cluttered, unprofessional UI; difficult button clicking.
- **Remediation**: Modernize header using responsive flexbox with icon tooltips and group utility menus.

---

### DEF-UI-02: Clumsy Dark Theme Aesthetics, Low Contrast, & Missing Animated Execution Glow
- **Severity**: **HIGH**
- **Category**: UI/UX
- **File**: [`src/app/page.tsx:1354-1453`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/app/page.tsx#L1354-L1453) & [`src/components/CanvasNode.tsx:25-90`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/src/components/CanvasNode.tsx#L25-L90)
- **Observed Behavior**: Dark theme feels murky (`bg-[#0b0f17]`), node borders have poor contrast, handle dots are misaligned, and executing nodes lack visual polish.
- **Expected Behavior**: Premium **Emerald High-Precision Studio** aesthetic (as shown in user's reference mockup), with glowing emerald `#10b981` active wave borders, high-contrast dark slate canvas `#070a0e`, crisp monospace metadata, and subtle grid dots.
- **Root Cause**: Ad-hoc inline CSS classes with inconsistent color palette.
- **Remediation**: Adopt unified Emerald Design System tokens in Tailwind v4.

# FlowForge — Stage 2: Prioritized Implementation Roadmap

> **Scope**: Phased technical execution plan mapping all 28 audited defects and architectural enhancements into structured, prioritized engineering milestones.  
> **Strict Operational Boundary**: Implementation Roadmap only. Zero code modifications executed in Stage 2.

---

## 1. Roadmap Phasing Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FLOWFORGE REMEDIATION ROADMAP                        │
├────────────────────┬───────────────────────────────────────────────────┤
│ PHASE 1: STABILITY │ • DEF-AI-01 (Live Date Grounding)                 │
│ & CRITICAL FIXES   │ • DEF-WF-01 (Live Canvas SSE Synchronization)     │
│                    │ • DEF-SEC-01 & DEF-SEC-02 (Security Sandbox Jail) │
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 2: AI &      │ • DEF-AI-02 (27-Node AI Builder Whitelist)        │
│ INTEGRATIONS       │ • DEF-AI-04 (Gemini 429 Exponential Backoff)      │
│                    │ • DEF-NET-01 (SMTP Connection Pool)               │
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 3: RELIABLE  │ • DEF-DB-01 (Non-Blocking File Storage)           │
│ PERSISTENCE        │ • DEF-WF-02 (Durable Disk Queue Persistence)      │
│                    │ • DEF-WF-03 (Worker Starvation Hard Timeout)      │
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 4: UI/UX     │ • DEF-UI-01 (Header Responsive Layout Overhaul)   │
│ EMERALD REDESIGN   │ • DEF-UI-02 (Emerald Canvas & Glowing Connectors) │
│                    │ • DEF-UI-03 & DEF-UI-04 (Inspector & Dock Polish) │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Stability & Critical Security Hardening (P0 — Immediate)

### Task T1.1: Runtime Temporal Grounding Injection
- **Defect ID**: `DEF-AI-01`
- **Priority**: **P0 (Critical)**
- **Affected Modules**: `src/lib/telegramPoller.ts`, `src/lib/executors.ts` (`gemini` node)
- **Dependencies**: None.
- **Complexity**: Low.
- **Risk Level**: Minimal.
- **Acceptance Criteria**: Prepend live ISO timestamp and host timezone to all Gemini system instructions. Verify bot states `2026` when queried for the current year.

### Task T1.2: Canvas Live Execution SSE Auto-Binding
- **Defect ID**: `DEF-WF-01`
- **Priority**: **P0 (Critical)**
- **Affected Modules**: `src/app/page.tsx`, `src/components/CanvasNode.tsx`
- **Dependencies**: T1.1.
- **Complexity**: Medium.
- **Risk Level**: Low.
- **Acceptance Criteria**: When a workflow is triggered via Telegram, Webhook, or Schedule, the client canvas automatically sets `activeExecutionId` and visually lights up running and completed nodes in real-time.

### Task T1.3: Host Shell Command Execution Kill-Switch
- **Defect ID**: `DEF-SEC-01`
- **Priority**: **P0 (Critical)**
- **Affected Modules**: `src/lib/executors.ts` (`exec` node)
- **Dependencies**: None.
- **Complexity**: Low.
- **Risk Level**: Low.
- **Acceptance Criteria**: Require `FLOWFORGE_ENABLE_EXEC=true` environment variable to run shell commands; safely reject by default.

### Task T1.4: Filesystem Path Traversal Jail
- **Defect ID**: `DEF-SEC-02`
- **Priority**: **P0 (Critical)**
- **Affected Modules**: `src/lib/executors.ts` (`read_file`, `write_file`)
- **Dependencies**: None.
- **Complexity**: Low.
- **Risk Level**: Low.
- **Acceptance Criteria**: Assert target paths reside strictly inside `data/files/`; reject any path traversal attempts.

---

## 3. Phase 2: AI Subsystems & Core Engine Expansion (P1 — High)

### Task T2.1: Expand AI Workflow Builder to All 27 Registered Nodes
- **Defect ID**: `DEF-AI-02`
- **Priority**: **P1 (High)**
- **Affected Modules**: `src/app/api/ai-builder/route.ts`
- **Dependencies**: Phase 1.
- **Complexity**: Medium.
- **Risk Level**: Low.
- **Acceptance Criteria**: Update `SYSTEM_PROMPT` in `ai-builder` with schemas for `db_query`, `google_sheets`, `razorpay`, `stripe`, `read_file`, `write_file`, and `exec`. Test natural language generation of database logging workflows.

### Task T2.2: Gemini API Exponential Backoff & Jitter
- **Defect ID**: `DEF-AI-04`
- **Priority**: **P1 (High)**
- **Affected Modules**: `src/lib/executors.ts` (`gemini` node)
- **Dependencies**: None.
- **Complexity**: Low.
- **Risk Level**: Low.
- **Acceptance Criteria**: Catch HTTP 429 status and retry up to 3 times with exponential backoff (1s, 2s, 4s + jitter).

### Task T2.3: SMTP Connection Pooling
- **Defect ID**: `DEF-NET-01`
- **Priority**: **P1 (High)**
- **Affected Modules**: `src/lib/executors.ts` (`email` node)
- **Dependencies**: None.
- **Complexity**: Low.
- **Risk Level**: Low.
- **Acceptance Criteria**: Cache `nodemailer` transporter instances keyed by `host:port:user` to avoid socket exhaustion during batch email dispatches.

---

## 4. Phase 3: Reliable Persistence & Concurrency (P2 — Medium)

### Task T3.1: Non-Blocking File I/O & Document Partitioning
- **Defect ID**: `DEF-DB-01`
- **Priority**: **P2 (Medium)**
- **Affected Modules**: `src/lib/store.ts`
- **Dependencies**: Phase 2.
- **Complexity**: High.
- **Risk Level**: Medium.
- **Acceptance Criteria**: Migrate from blocking `fs.readFileSync` to non-blocking asynchronous file operations; separate high-frequency executions into `data/executions.jsonl`.

### Task T3.2: Durable Queue Persistence
- **Defect ID**: `DEF-WF-02`
- **Priority**: **P2 (Medium)**
- **Affected Modules**: `src/lib/queue.ts`
- **Dependencies**: None.
- **Complexity**: Medium.
- **Risk Level**: Low.
- **Acceptance Criteria**: Persist queued jobs to `data/queue.json` so unexecuted background jobs survive server restarts.

---

## 5. Phase 4: UI/UX Modernization — Emerald Design System (P3)

### Task T4.1: Responsive Top Action Bar Overhaul
- **Defect ID**: `DEF-UI-01`
- **Priority**: **P3 (UI Polish)**
- **Affected Modules**: `src/app/page.tsx`
- **Dependencies**: Phase 1.
- **Complexity**: Medium.
- **Risk Level**: Low.
- **Acceptance Criteria**: Refactor top action bar with icon groups, tooltips, and responsive breakpoints; completely eliminate button overlap on 1080p and laptop screens.

### Task T4.2: Emerald High-Precision Studio Canvas Theme
- **Defect ID**: `DEF-UI-02`
- **Priority**: **P3 (UI Polish)**
- **Affected Modules**: `src/app/page.tsx`, `src/components/CanvasNode.tsx`
- **Dependencies**: Phase 1.
- **Complexity**: High.
- **Risk Level**: Low.
- **Acceptance Criteria**: Implement obsidian canvas `#070a0e`, emerald wave glow `#10b981`, animated pulsing SVG edge connectors, and chamfered custom node cards matching the approved visual mockups.

### Task T4.3: Inspector Multi-Line JSON Editor & Dock Collapse
- **Defect ID**: `DEF-UI-03`, `DEF-UI-04`
- **Priority**: **P3 (UI Polish)**
- **Affected Modules**: `src/components/Inspector.tsx`, `src/app/page.tsx`
- **Dependencies**: None.
- **Complexity**: Medium.
- **Risk Level**: Low.
- **Acceptance Criteria**: Add formatted multi-line code editor for JSON parameters; provide 3-state toggle (`Collapsed`, `Compact`, `Expanded`) for the bottom dock with `⌘J` shortcut.

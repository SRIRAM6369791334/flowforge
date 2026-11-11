# FlowForge — Stage 2.1: Complete Defect-to-Roadmap Traceability Matrix

> **Scope**: 100% end-to-end traceability mapping every single one of the **28 audited defects** to explicit engineering remediation tasks, closing the coverage gap in `IMPLEMENTATION_ROADMAP.md`.

---

## 1. Traceability Summary Matrix (28 Defects → 18 Tasks)

| Defect ID | Severity | Phase | Task ID | Task Title & Affected Source File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-AI-01** | **CRITICAL** | Phase 1 | `T1.1` | Inject dynamic ISO timestamp into Gemini system prompts (`src/lib/executors.ts:376`) | **Mapped** (Stage 2) |
| **DEF-WF-01** | **CRITICAL** | Phase 1 | `T1.2` | Implement SSE canvas auto-attachment on background runs (`src/app/page.tsx:210`) | **Mapped** (Stage 2) |
| **DEF-SEC-01**| **CRITICAL** | Phase 1 | `T1.3` | Implement `ENABLE_HOST_EXECUTION` kill-switch for `exec` node (`executors.ts:673`) | **Mapped** (Stage 2) |
| **DEF-SEC-02**| **HIGH** | Phase 1 | `T1.4` | Jail `read_file` and `write_file` to `data/files/` root (`executors.ts:649`) | **Mapped** (Stage 2) |
| **DEF-SEC-03**| **HIGH** | Phase 1 | `T1.5` | Add optional Next.js API key middleware for route security (`src/middleware.ts`) | **Newly Added** (Stage 2.1) |
| **DEF-AI-02** | **HIGH** | Phase 2 | `T2.1` | Expand AI Builder whitelist to all 27 registered node types (`ai-builder/route.ts:18`) | **Mapped** (Stage 2) |
| **DEF-AI-04** | **MEDIUM** | Phase 2 | `T2.2` | Implement 3-attempt exponential backoff retry on Gemini HTTP 429 (`executors.ts:394`)| **Mapped** (Stage 2) |
| **DEF-NET-01**| **MEDIUM** | Phase 2 | `T2.3` | Implement SMTP transporter connection caching pool (`executors.ts:536`) | **Mapped** (Stage 2) |
| **DEF-CORE-01**| **MEDIUM** | Phase 2 | `T2.4` | Enforce numeric parsing in `if` node comparison operators (`executors.ts:319`) | **Newly Added** (Stage 2.1) |
| **DEF-CORE-02**| **MEDIUM** | Phase 2 | `T2.5` | Add safe non-array handling with graceful warning in `split_out` (`executors.ts:351`)| **Newly Added** (Stage 2.1) |
| **DEF-NET-02**| **MEDIUM** | Phase 2 | `T2.6` | Add automatic `https://` prefixing & configurable timeout in `parallel_web` (`L165`) | **Newly Added** (Stage 2.1) |
| **DEF-DB-01** | **HIGH** | Phase 3 | `T3.1` | Replace synchronous blocking I/O with non-blocking async file streams (`store.ts:95`)| **Mapped** (Stage 2) |
| **DEF-WF-02** | **HIGH** | Phase 3 | `T3.2` | Persist uncompleted queue jobs to `data/queue.json` (`src/lib/queue.ts:78`) | **Mapped** (Stage 2) |
| **DEF-WF-03** | **LOW** | Phase 3 | `T3.3` | Implement hard job execution timeout ceiling to prevent worker starvation (`queue.ts`)| **Mapped** (Stage 2) |
| **DEF-DB-02** | **MEDIUM** | Phase 3 | `T3.4` | Document single-process file mutex constraints & provide SQLite migration path | **Newly Added** (Stage 2.1) |
| **DEF-AI-03** | **MEDIUM** | Phase 3 | `T3.5` | Implement persistent conversation session history in `data/sessions.json` | **Newly Added** (Stage 2.1) |
| **DEF-SEC-04**| **LOW** | Phase 3 | `T3.6` | Document filesystem permission hardening for `data/db.json` secrets | **Newly Added** (Stage 2.1) |
| **DEF-SEC-05**| **LOW** | Phase 3 | `T3.7` | Sanitize dynamic webhook path segments against directory traversal (`route.ts:8`) | **Newly Added** (Stage 2.1) |
| **DEF-SEC-06**| **LOW** | Phase 3 | `T3.8` | Restrict Server-Sent Events `/api/events` to local studio origin | **Newly Added** (Stage 2.1) |
| **DEF-CORE-03**| **MEDIUM** | Phase 3 | `T3.9` | Harden `code` node sandbox context by freezing prototypes (`executors.ts:323`) | **Newly Added** (Stage 2.1) |
| **DEF-UI-01** | **HIGH** | Phase 4 | `T4.1` | Overhaul top action bar with responsive grouping and icon tooltips (`page.tsx:1219`)| **Mapped** (Stage 2) |
| **DEF-UI-02** | **HIGH** | Phase 4 | `T4.2` | Transform canvas to **Emerald High-Precision Studio** aesthetic (`CanvasNode.tsx`) | **Mapped** (Stage 2) |
| **DEF-UI-03** | **LOW** | Phase 4 | `T4.3` | Implement formatted multi-line code editor for JSON params (`Inspector.tsx:85`) | **Mapped** (Stage 2) |
| **DEF-UI-04** | **LOW** | Phase 4 | `T4.4` | Implement collapsible 3-state bottom telemetry dock (`page.tsx:1500`) with `⌘J` | **Mapped** (Stage 2) |
| **DEF-QA-01** | **LOW** | Phase 5 | `T5.1` | Setup Node.js native test runner (`node:test`) covering DAG topoSort & expressions | **Newly Added** (Stage 2.1) |
| **DEF-QA-02** | **INFO** | Phase 5 | `T5.2` | Configure GitHub Actions CI workflow script (`.github/workflows/ci.yml`) | **Newly Added** (Stage 2.1) |
| **DEF-DOC-01**| **INFO** | Phase 5 | `T5.3` | Update `project-knowledge/` to reflect accurate 27 node count | **Newly Added** (Stage 2.1) |
| **DEF-DOC-02**| **INFO** | Phase 5 | `T5.4` | Update all architectural diagrams to Next.js App Router & atomic JSON store | **Newly Added** (Stage 2.1) |

---

## 2. Reconciled Phasing Schedule

All 28 defects are now 100% accounted for across 5 sequential implementation phases:
1. **Phase 1: Stability & Security Hardening (P0 — 5 Tasks)**: Focuses on the user-reported Telegram date hallucination, the live canvas execution visual gap, and core RCE/path safety gating.
2. **Phase 2: AI Subsystems & Integration Refinement (P1 — 6 Tasks)**: Expands AI Builder to 27 nodes, adds Gemini 429 exponential backoff, fixes SMTP connection caching, and hardens `if`/`split_out`/`parallel_web` edge cases.
3. **Phase 3: Persistence, Queue Durability & VM Hardening (P2 — 9 Tasks)**: Eliminates blocking synchronous file I/O, persists queue state to disk, hardens `node:vm` context, and sanitizes webhook paths.
4. **Phase 4: Emerald Design System & UI/UX Transformation (P3 — 4 Tasks)**: Solves top action bar collisions, transforms the canvas into the Emerald High-Precision dark aesthetic, improves Inspector ergonomics, and adds collapsible telemetry docking.
5. **Phase 5: Automated Testing, CI/CD & Documentation Polish (P4 — 4 Tasks)**: Implements automated unit testing, sets up CI quality gates, and aligns all documentation with verified source truth.

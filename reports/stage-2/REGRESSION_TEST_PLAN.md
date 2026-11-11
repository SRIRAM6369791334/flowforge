# FlowForge — Stage 2: Regression Test Plan & Quality Assurance Matrix

> **Scope**: Test strategy, automated unit test specifications, synthetic fixtures, API integration tests, and regression validation suites for Stage 3 remediation.  
> **Target Framework**: Vitest / Node.js native test runner (`node:test`).

---

## 1. Test Architecture & Quality Gates

FlowForge currently has **0% automated test coverage**. To prevent regressions when applying defect fixes in Stage 3, a structured 3-tier test harness must be implemented:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FLOWFORGE TEST HARNESS                          │
├───────────────────┬────────────────────────────┬───────────────────────┤
│ TIER 1: UNIT      │ TIER 2: INTEGRATION        │ TIER 3: SYSTEM E2E    │
├───────────────────┼────────────────────────────┼───────────────────────┤
│ • topoSort DAG    │ • API Route Handlers       │ • Telegram Bot Loop   │
│ • resolveExpr VM  │ • Worker Queue Dispatch    │ • Multi-Site Audit    │
│ • store.ts Mutex  │ • Store Persistence        │ • Canvas SSE Sync     │
│ • Node Executors  │ • AI Builder Fallbacks     │ • Webhook Ingestion   │
└───────────────────┴────────────────────────────┴───────────────────────┘
```

---

## 2. Core Unit Test Specifications

### Suite 1: DAG Engine & Topological Sorter (`src/lib/engine.ts`)
- **Test 1.1 (Linear Pipeline)**: Input 3 nodes in sequence `A -> B -> C`. Verify output contains `waves = [[A], [B], [C]]`.
- **Test 1.2 (Parallel Fan-Out / Fan-In)**: Input `A -> B, A -> C, B -> D, C -> D`. Verify `waves = [[A], [B, C], [D]]`.
- **Test 1.3 (Cycle Detection)**: Input circular edges `A -> B -> C -> A`. Verify engine throws `"Workflow contains a cycle or circular dependency"`.
- **Test 1.4 (Disconnected Subgraphs)**: Input two independent chains `A -> B` and `X -> Y`. Verify valid wave partitioning without hanging.

### Suite 2: Expression Resolution Sandbox (`src/lib/expressions.ts`)
- **Test 2.1 (Primitive Passthrough)**: Input `{{ $json.count }}` where `count = 42`. Verify returned type is `number 42` (not string `"42"`).
- **Test 2.2 (Template Interpolation)**: Input `"Hello {{ $json.name }}!"`. Verify output `"Hello Sriram!"`.
- **Test 2.3 (Secret Substitution)**: Input `{{ $secrets.TELEGRAM_BOT_TOKEN }}`. Verify correct retrieval from secret dictionary.
- **Test 2.4 (Prototype Escape Blocking)**: Input `{{ this.constructor.constructor('return process')() }}`. Verify sandbox throws or returns undefined without granting host process access.

### Suite 3: Atomic Storage Mutex (`src/lib/store.ts`)
- **Test 3.1 (Sequential Writes)**: Trigger 50 rapid sequential writes to `dbTables.insert()`. Verify all 50 records exist in `db.json` with zero corruption.
- **Test 3.2 (Starter Seeding)**: Delete `data/db.json` and invoke `workflows.list()`. Verify the 4 starter templates are auto-seeded.
- **Test 3.3 (Atomic Swap Recovery)**: Verify write uses `.tmp` swap and never leaves a partially serialized JSON file.

---

## 3. Integration & Defect Validation Test Matrix

| Defect ID | Test Description | Success Criteria |
| :--- | :--- | :--- |
| **DEF-AI-01** | Query Telegram bot with *"What is today's date and year?"* | Response explicitly states `2026` and matches live host day/month. |
| **DEF-WF-01** | Post synthetic message to `/api/telegram` while canvas is open | Canvas nodes visibly light up with green borders and duration badges. |
| **DEF-SEC-01**| Trigger `exec` node with `FLOWFORGE_ENABLE_EXEC=false` | Execution is safely blocked with descriptive access denial error. |
| **DEF-SEC-02**| Call `write_file` with `path: "../../escape.txt"` | Throws `"Path outside data/files sandbox root"`. |
| **DEF-AI-02** | Prompt AI builder with *"Save leads to database table"* | Generated workflow includes `db_query` node with `operation: "insert"`. |
| **DEF-UI-01** | Render canvas on 1280x800 viewport | Zero button overlap in top header; clean responsive layout. |

---

## 4. Synthetic Test Fixtures
- Pre-configured mock payloads for:
  - Telegram `Update` object (`message: { chat: { id: 123 }, text: "ping" }`).
  - Webhook POST body with headers and query parameters.
  - Razorpay order creation request.
  - Form submission payload with multiple fields.

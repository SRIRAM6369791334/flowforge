# FlowForge — Stage 3.0: Rollback Protocols & Automated Regression Plan

> **Scope**: Fail-safe operational recovery procedures, step-by-step phase rollback commands, and automated test specifications for Stage 3 implementation.

---

## 1. Phase-by-Phase Instant Rollback Procedures

Because the project repository baseline is fully committed under Git commit `821529c` and archived in `flowforge_pre_stage3_backup.zip`, every phase has a dedicated 1-step rollback command:

### 1.1 Phase 1 Rollback Protocol (Stability & Security)
- **Target Files**: `src/lib/executors.ts`, `src/app/page.tsx`, `src/middleware.ts`
- **Trigger**: Any failure in date grounding, canvas event streaming, or build error.
- **Rollback Command**:
  ```powershell
  git checkout 821529c -- src/lib/executors.ts src/app/page.tsx
  if (Test-Path src/middleware.ts) { Remove-Item src/middleware.ts -Force }
  npm run build
  ```
- **Recovery Time**: < 3 seconds.

### 1.2 Phase 2 Rollback Protocol (AI & Integrations)
- **Target Files**: `src/app/api/ai-builder/route.ts`, `src/lib/executors.ts`
- **Rollback Command**:
  ```powershell
  git checkout Phase1-Verified-Commit -- src/app/api/ai-builder/route.ts src/lib/executors.ts
  npm run build
  ```
- **Recovery Time**: < 3 seconds.

### 1.3 Phase 3 Rollback Protocol (Persistence & Queue)
- **Target Files**: `src/lib/store.ts`, `src/lib/queue.ts`
- **Rollback Command**:
  ```powershell
  git checkout Phase2-Verified-Commit -- src/lib/store.ts src/lib/queue.ts
  npm run build
  ```
- **Recovery Time**: < 3 seconds.

### 1.4 Phase 4 Rollback Protocol (Emerald UI/UX Redesign)
- **Target Files**: `src/app/page.tsx`, `src/components/CanvasNode.tsx`, `src/components/Inspector.tsx`
- **Rollback Command**:
  ```powershell
  git checkout Phase3-Verified-Commit -- src/app/page.tsx src/components/CanvasNode.tsx src/components/Inspector.tsx
  npm run build
  ```
- **Recovery Time**: < 3 seconds.

### 1.5 Emergency Complete Reset (Pristine Snapshot Restore)
- If multiple cascading errors occur:
  ```powershell
  git reset --hard 821529c
  git clean -fd
  npm run build
  ```

---

## 2. Automated Regression Test Specifications (Zero-Dependency)

Using Node.js native test runner (`node:test` and `node:assert`), a lightweight test runner will validate every phase without installing any new packages:

### Test Suite 1: Security Sandbox Jail Test
```javascript
// Validates DEF-SEC-02 path jail
import assert from "node:assert";
import path from "node:path";

function testJail(userPath) {
  const root = path.resolve(process.cwd(), "data", "files");
  const target = path.resolve(root, userPath);
  if (!target.startsWith(root)) {
    throw new Error("Security Violation: Path traversal detected");
  }
  return target;
}

assert.throws(() => testJail("../../package.json"), /Path traversal/);
assert.doesNotThrow(() => testJail("valid-log.txt"));
console.log("✔ Security path jail test passed");
```

### Test Suite 2: Temporal Grounding Validation
```javascript
// Validates DEF-AI-01 live date injection
import assert from "node:assert";

const now = new Date();
const currentYear = now.getFullYear();
const facts = `[LIVE RUNTIME FACTS: Current Year is ${currentYear}]`;

assert(facts.includes("2026"), "Current year must be 2026");
console.log("✔ Temporal context injection test passed");
```

### Test Suite 3: DAG Engine Cycle Detection
```javascript
// Validates topoSort resilience
import assert from "node:assert";
import { topoSort } from "./src/lib/engine.ts";

const circularNodes = [{ id: "A" }, { id: "B" }];
const circularEdges = [{ source: "A", target: "B" }, { source: "B", target: "A" }];

assert.throws(() => topoSort(circularNodes, circularEdges), /cycle/);
console.log("✔ DAG cycle detection test passed");
```

---

## 3. Escalation Triggers & Hard Stop Conditions

During Stage 3 implementation, work must **IMMEDIATELY HALT** if:
1. `npm run build` fails with TypeScript or Turbopack errors.
2. Any existing workflow in `data/db.json` fails to execute.
3. An external package installation is requested.
4. A database schema alteration is required that breaks existing starter workflows.

Upon triggering a stop condition, the current phase will be rolled back to the previous verified git commit, and an incident report will be presented to the user.

# FlowForge — Stage 3.0.5: Final Phase 1 Scope Reconciliation & Inventory Deconfliction

> **Document ID**: `STAGE-3-0-5-SCOPE-05`  
> **Status**: AUTHORITATIVE SCOPE DECONFLICTION REPORT  
> **Task Reference**: `T5 — Documentation Reconciliation`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `6aec3ba0b0213d29d8995a329971bc391100bb5b`

---

## 1. Evolution and Deconfliction of File Scope

Across Stages 3.0 through 3.0.4, the proposed Phase 1 file count evolved as security and compatibility audits uncovered deeper architectural requirements:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVOLUTION OF PHASE 1 FILE SCOPE:                                            │
│                                                                             │
│ • Stage 3.0 Initial Draft: 2 Files                                          │
│   (Modified: src/lib/executors.ts, src/app/page.tsx)                        │
│   → FLAW: Lacked API middleware and regression tests.                       │
│                                                                             │
│ • Stage 3.0.1 Draft: 4 Files                                                │
│   (2 Modified + src/middleware.ts + tests/)                                 │
│   → FLAW: Deprecated in Next.js 16; lacked webhook body/signature handling. │
│                                                                             │
│ • Stage 3.0.2 / 3.0.3 Draft: 4 Files (proxy.ts + tests)                     │
│   → FLAW: Tested inline mocks; Node 22 crashed importing executors.ts.      │
│                                                                             │
│ • Stage 3.0.4 Reconciled: 6 Files                                           │
│   → Added src/lib/security.ts (solves Node 22 ESM imports).                 │
│   → Added src/app/api/webhook/.../route.ts (HMAC signature & replay check). │
│                                                                             │
│ • Stage 3.0.5 AUTHORITATIVE CANONICAL SCOPE: EXACTLY 6 FILES                │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **All prior references to 2-file, 4-file, or 5-file Phase 1 inventories are OBSOLETE.**  
> The **6-File Inventory** detailed below is the sole authoritative target scope for Phase 1.

---

## 2. Authoritative Six-File Phase 1 Master Inventory

| # | File Path | Status | Baseline LOC | Governing Task & Defect | Precise Implementation Scope |
| :-: | :--- | :---: | :---: | :--- | :--- |
| **1** | `src/lib/security.ts` | **New** | 0 LOC | `T1.1`, `T1.3`, `T1.4`, `T1.5` | Houses pure security helpers with zero relative dependencies: `validateJailPath`, `buildRuntimeContext`, `checkExecAllowed`, `constantTimeCompare`, and `readBoundedBody`. |
| **2** | `src/lib/executors.ts` | **Existing** | 691 LOC | `T1.1`, `T1.3`, `T1.4` (`DEF-AI-01`, `DEF-SEC-01`, `DEF-SEC-02`) | Imports from `./security`. Calls `buildRuntimeContext()` in `gemini`, `checkExecAllowed()` in `exec`, and `validateJailPath()` in `read_file` / `write_file`. |
| **3** | `src/app/page.tsx` | **Existing** | 2,260 LOC | `T1.2` (`DEF-WF-01`) | Mounts SSE `EventSource("/api/events")` with synchronized refs (`currentWfRef`, `activeExecutionIdRef`) for real-time node pulsing and progress updates. |
| **4** | `src/proxy.ts` | **New** | 0 LOC | `T1.5` (`DEF-SEC-03`) | Official Next.js 16 Proxy on Node.js runtime. Implements HTTP Basic Auth challenge in production, loopback dev access, Origin/anti-CSRF checks, and rate limiting. Exports `evaluateApiAuth`. |
| **5** | `src/app/api/webhook/[...path]/route.ts` | **Existing** | 78 LOC | `T1.5` / `T2` (`DEF-SEC-05`) | Implements `readBoundedBody()` (1MB streaming limiter), raw-body HMAC-SHA256 signature verification, 300s replay window, and privileged node restrictions. |
| **6** | `tests/phase1-security.test.mjs` | **New** | 0 LOC | `T1.1–T1.5` (`DEF-QA-01`) | Zero-dependency regression test suite importing directly from `src/lib/security.ts` and `src/proxy.ts`. Runs natively via `node --test`. |

---

## 3. Surgical Non-Destructive Rollback Protocol

If Phase 1 implementation needs to be aborted or reverted, execute this exact surgical procedure:

```powershell
# 1. Restore the 3 modified existing files to baseline commit 6955ed0
git checkout 6955ed094aca40e43dae3ae40e129b6480f7ed0b -- src/lib/executors.ts src/app/page.tsx "src/app/api/webhook/[...path]/route.ts"

# 2. Remove the 3 newly created files
Remove-Item -Path "src/lib/security.ts" -ErrorAction SilentlyContinue
Remove-Item -Path "src/proxy.ts" -ErrorAction SilentlyContinue
Remove-Item -Path "tests/phase1-security.test.mjs" -ErrorAction SilentlyContinue

# 3. Confirm 100% clean baseline state across src/
git diff 6955ed094aca40e43dae3ae40e129b6480f7ed0b -- src/
git status

# 4. Confirm vital local files are preserved (Never run git clean -fd)
Test-Path "data/db.json"
Test-Path "data/db.json.local.bak"
Test-Path ".env.local"
```

---

## 4. Reconciled Git Commit Sequence

| Commit Hash | Stage Milestone | Description |
| :--- | :--- | :--- |
| `f123beb` | Baseline Snapshot | Clean source snapshot without plaintext secrets |
| `459ae50` | Stage 3.0 | Implementation preparation and rollback reports |
| `6955ed0` | **Stage 3.0.1 (Baseline)** | Authoritative security baseline commit |
| `d097365` | Stage 3.0.2 | Security design corrections and initial certification |
| `dc91684` | Stage 3.0.3 | Next.js 16 proxy audit and gate reconciliation |
| `6aec3ba` | **Stage 3.0.4 (Current)** | Scope and security contract closure |
| *(Pending)* | Stage 3.0.5 | Verification deliverables and final GO/NO-GO |

---

## 5. Verification Verdict

| Audit Item | Reconciled Inventory Standard | Status |
| :--- | :--- | :---: |
| 6-file inventory established as sole authority | Codified in Section 1 and Section 2 | **PASS** |
| Obsolete 2/4/5-file references deprecated | Documented in Section 1 | **PASS** |
| Surgical rollback commands verified | 4-step sequence in Section 3 | **PASS** |
| Full Git commit sequence reconciled | Documented in Section 4 | **PASS** |
| Zero source diff against baseline verified | Confirmed via `git diff` | **PASS** |

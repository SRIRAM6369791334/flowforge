# FlowForge — Stage 3.0.4: Final Phase 1 File Inventory & Rollback Specification

> **Document ID**: `STAGE-3-0-4-INVENTORY-05`  
> **Status**: AUTHORITATIVE FILE SCOPE SPECIFICATION  
> **Target Phase**: Stage 3.1 (Phase 1: Stability & Security Hardening)  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `dc91684784a867f08b350616b3f7177651a2491a`

---

## 1. Authoritative Reconciled Target File Inventory

To achieve complete security closure in Phase 1 (including dynamic date grounding, canvas real-time sync, host execution killswitch, cross-platform filesystem jail, fail-closed Next.js 16 proxy, webhook HMAC verification, and zero-dependency regression testing), the authoritative Phase 1 scope encompasses **exactly 6 files**:

```
Phase 1 Scope: 6 Files
├── Existing Files Modified (3)
│   ├── src/lib/executors.ts               (691 LOC)
│   ├── src/app/page.tsx                  (2,260 LOC)
│   └── src/app/api/webhook/[...path]/route.ts (78 LOC)
└── New Files Created (3)
    ├── src/lib/security.ts                (Security core helpers)
    ├── src/proxy.ts                       (Next.js 16 API Proxy)
    └── tests/phase1-security.test.mjs     (Zero-dependency test suite)
```

---

## 2. Detailed File-by-File Responsibility Matrix

| # | File Path | File Status | Current LOC | Target Tasks | Scope of Modification | Cross-Module Dependencies |
| :-: | :--- | :---: | :---: | :---: | :--- | :--- |
| **1** | `src/lib/security.ts` | **New** | 0 LOC | `T1.1`, `T1.3`, `T1.4`, `T1.5` | Houses pure, zero-dependency security helpers: `validateJailPath`, `buildRuntimeContext`, `checkExecAllowed`, and `constantTimeCompare`. Imports only `node:path`, `node:fs/promises`, `node:crypto`. | Imported by `executors.ts`, `proxy.ts`, `route.ts`, and test suite. |
| **2** | `src/lib/executors.ts` | **Existing** | 691 LOC | `T1.1`, `T1.3`, `T1.4` | • **L369–395**: Injects dynamic `buildRuntimeContext()` into `gemini` executor.<br>• **L649–672**: Calls `validateJailPath()` in `read_file` & `write_file`.<br>• **L673–690**: Calls `checkExecAllowed()` in `exec` node. | Invoked by `engine.ts` (signatures remain unchanged). |
| **3** | `src/app/page.tsx` | **Existing** | 2,260 LOC | `T1.2` | • Mounts `EventSource("/api/events")` listener with synchronized refs (`currentWfRef`, `activeExecutionIdRef`) for real-time node pulsing and progress updates. | Consumes `/api/events` SSE stream. |
| **4** | `src/proxy.ts` | **New** | 0 LOC | `T1.5` | Next.js 16 Proxy running on Node.js runtime. Enforces fail-closed production authentication, Basic Auth/API Key challenge, Origin/anti-CSRF checks, 1MB streaming body limit, and rate limiting. | Intercepts `/api/:path*`. |
| **5** | `src/app/api/webhook/[...path]/route.ts` | **Existing** | 78 LOC | `T1.5` / `T2` | • Enforces raw-body HMAC-SHA256 signature verification when `node.params.secret` is set.<br>• Enforces 300s timestamp replay window.<br>• Restricts unauthenticated webhooks from invoking privileged downstream nodes. | Enqueues to `queue.ts`. |
| **6** | `tests/phase1-security.test.mjs` | **New** | 0 LOC | `T1.1–T1.5` | Zero-dependency test suite importing directly from `src/lib/security.ts` and `src/proxy.ts`. Runs natively via `node --test`. | Tests production exports directly. |

---

## 3. Surgical Non-Destructive Rollback Procedures

### 3.1 Prohibited Operations
> [!CAUTION]
> **NEVER run `git clean -fd`.**  
> Running `git clean -fd` would permanently destroy untracked runtime state, including `data/db.json` (active workflows), `data/db.json.local.bak` (local secrets), and `.env.local`.

### 3.2 Granular Phase 1 Rollback Protocol

If Phase 1 implementation needs to be completely undone at any point:

```powershell
# 1. Restore the 3 modified existing files to baseline commit 6955ed0
git checkout 6955ed094aca40e43dae3ae40e129b6480f7ed0b -- src/lib/executors.ts src/app/page.tsx "src/app/api/webhook/[...path]/route.ts"

# 2. Remove the 3 newly created files
Remove-Item -Path "src/lib/security.ts" -ErrorAction SilentlyContinue
Remove-Item -Path "src/proxy.ts" -ErrorAction SilentlyContinue
Remove-Item -Path "tests/phase1-security.test.mjs" -ErrorAction SilentlyContinue

# 3. Verify working copy is 100% clean
git diff 6955ed094aca40e43dae3ae40e129b6480f7ed0b -- src/
git status

# 4. Verify local untracked data files remain intact
Test-Path "data/db.json"
Test-Path "data/db.json.local.bak"
Test-Path ".env.local"
```

---

## 4. Verification Verdict

| Audit Item | Reconciled Inventory Standard | Status |
| :--- | :--- | :---: |
| Scope expansion documented | Added `security.ts` and `webhook/.../route.ts` | **PASS** |
| 6-file Phase 1 inventory finalized | Tabulated in Section 1 and Section 2 | **PASS** |
| Surgical rollback commands documented | 4-step procedure in Section 3.2 | **PASS** |
| Preservation of local data guaranteed | Prohibition of `git clean -fd` in Section 3.1 | **PASS** |

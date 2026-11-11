# FlowForge — Stage 3.0.2: Final File Scope & Non-Destructive Rollback Governance

> **Document ID**: `STAGE-3-0-2-ROLLBACK-05`  
> **Status**: APPROVED TECHNICAL SPECIFICATION  
> **Target Scope**: Authoritative Reconciliation of Phase 1 Targets & Recovery Procedures  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`

---

## 1. Resolution of the "Two-Existing-Files vs Four-Target-Files" Discrepancy

### 1.1 The Contradiction Identified
Across earlier Stage 3.0 and Stage 3.0.1 drafts, an ambiguity existed where some sections described Phase 1 as touching:
- *"Two existing files"* (`src/lib/executors.ts` and `src/app/page.tsx`), while other tables cited:
- *"Four target files"* (adding `src/middleware.ts` and either `src/lib/telegramPoller.ts`, `src/lib/engine.ts`, or a test file).

### 1.2 Authoritative Source-Evidence Reconciliation
Direct source code inspection reveals:
1. `src/lib/telegramPoller.ts` does **not** need to be modified in Phase 1. Task `T1.1` (Dynamic Date Grounding) is implemented entirely inside `src/lib/executors.ts` (lines 369–395) where the `gemini` executor formats the runtime date context. `telegramPoller.ts` simply passes raw update payloads to the workflow trigger.
2. `src/lib/engine.ts` dispatches to executors and does not require changes for Phase 1 security guardrails.
3. In Phase 1:
   - **Existing Modified Files**: Exactly **2** files in `src/`.
   - **New Created Application Files**: Exactly **1** file (`src/middleware.ts`).
   - **New Created Test Suite Files**: Exactly **1** file (`tests/phase1-security.test.mjs`).

**Total Target Files for Phase 1 = Exactly 4 Files (2 Modified Existing + 2 Newly Created).**

---

## 2. Authoritative Phase 1 Target File Inventory

| # | File Path | File Status | Current LOC | Target Tasks | Exact Modification Scope | Cross-Module Impact |
| :-: | :--- | :---: | :---: | :---: | :--- | :--- |
| **1** | `src/lib/executors.ts` | **Existing** | 691 LOC | `T1.1`, `T1.3`, `T1.4` | • **L369–395**: Dynamic ISO & `getFullYear()` date grounding without static strings.<br>• **L649–672**: Cross-platform filesystem jail on `read_file` & `write_file`.<br>• **L673–690**: `FLOWFORGE_ENABLE_EXEC` default-deny kill-switch. | Low; `engine.ts` calls unchanged signatures. |
| **2** | `src/app/page.tsx` | **Existing** | 2,260 LOC | `T1.2` | • **L210–250**: Add SSE `EventSource` connection to `/api/events` with synchronized refs and timestamp validation. | Self-contained client UI state. |
| **3** | `src/middleware.ts` | **New** | 0 LOC | `T1.5` | • Intercepts `/api/:path*`. Enforces fail-closed authentication in production, Origin validation for Studio, and constant-time API key verification. | Protects all 14 API routes. |
| **4** | `tests/phase1-security.test.mjs` | **New** | 0 LOC | `T1.1`–`T1.5` | • Zero-dependency automated regression test suite executing natively via `node --test`. | Isolated verification harness. |

---

## 3. Strict Non-Destructive Rollback Procedures

### 3.1 Prohibited Operations
> [!CAUTION]
> **NEVER execute `git clean -fd` or destructive checkout sweeps.**  
> Running `git clean -fd` would permanently delete:
> - `data/db.json` (Local database state and active workflows)
> - `data/db.json.local.bak` (Emergency credential backup)
> - `.env.local` (Local environment variables and development secrets)
> - User-created artifacts, mock data, and scratch exploration files.

### 3.2 Granular Phase 1 Rollback Protocol

If any step of Phase 1 fails testing or requires immediate abortion, execute the following surgical rollback:

#### Step 1: Revert Modified Existing Files to Exact Baseline
```powershell
# Restore src/lib/executors.ts and src/app/page.tsx to pristine baseline commit
git checkout 6955ed094aca40e43dae3ae40e129b6480f7ed0b -- src/lib/executors.ts src/app/page.tsx
```

#### Step 2: Remove Newly Created Phase 1 Files
```powershell
# Remove only the files created during Phase 1
Remove-Item -Path "src/middleware.ts" -ErrorAction SilentlyContinue
Remove-Item -Path "tests/phase1-security.test.mjs" -ErrorAction SilentlyContinue
```

#### Step 3: Verify Restoration Integrity
```powershell
# Verify that git status confirms a 100% clean working copy against baseline
git diff 6955ed094aca40e43dae3ae40e129b6480f7ed0b -- src/
git status
```
*Expected Output*: `0 differences across src/`, `working tree clean`.

#### Step 4: Verify Untracked File Preservation
```powershell
# Ensure vital local configuration and database files remain intact
Test-Path "data/db.json"
Test-Path "data/db.json.local.bak"
Test-Path ".env.local"
```
*Expected Output*: `True`, `True`, `True`.

---

## 4. Master Baseline Verification

- **Authoritative Baseline Commit Hash**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`
- **Git Branch**: `main` (synchronized with `origin/main` at `https://github.com/SRIRAM6369791334/flowforge.git`)
- **Offline Compressed Backup**: `C:\Users\srira\.gemini\antigravity\scratch\flowforge_pre_stage3_backup.zip` (483,106 bytes) verified intact.
- **Application Source Code Status**: 100% pristine. `0` lines modified since baseline initialization.

---

## 5. Verification Verdict

| Verification Item | Evidence | Status |
| :--- | :--- | :---: |
| "2 existing vs 4 target files" resolved | Clarified in Section 1.2 and Section 2 | **PASS** |
| Authoritative target inventory documented | Tabulated in Section 2 | **PASS** |
| Non-destructive rollback defined | Surgical commands in Section 3.2 | **PASS** |
| Prohibition of `git clean -fd` enforced | Explicitly governed in Section 3.1 | **PASS** |
| Baseline commit hash recorded | `6955ed094aca40e43dae3ae40e129b6480f7ed0b` | **PASS** |

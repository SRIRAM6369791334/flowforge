# FlowForge — Stage 3.0.1: Rollback Safety Review & Non-Destructive Recovery Protocol

> **Scope**: Critical review of rollback commands, elimination of destructive cleanup switches (`git clean -fd`), preservation of uncommitted developer assets, and fail-safe recovery procedures.

---

## 1. Critical Finding: The `git clean -fd` Hazard

In the preliminary `ROLLBACK_AND_REGRESSION_PLAN.md`, section 1.5 included:
```bash
# HAZARDOUS PRELIMINARY COMMAND:
git reset --hard 821529c
git clean -fd
```

### Why `git clean -fd` is Prohibited from Routine Operations
1. **Destruction of Untracked User Assets**: `git clean -fd` forcefully deletes all untracked files and directories. If the user created a custom test script, a new draft workflow, an exported report, or an uncommitted `.env.local`, `git clean -fd` obliterates them permanently.
2. **Accidental Report Erasure**: Newly generated audit reports in `reports/` could be wiped if not committed.
3. **Irreversibility**: Unlike Git commits, files deleted by `git clean -fd` do NOT go to the Windows Recycle Bin or Git reflog. They are permanently unrecoverable.

---

## 2. Hardened Non-Destructive Rollback Procedures

All Stage 3 rollback operations will adhere strictly to **targeted, non-destructive commands**:

### 2.1 Rule 1: Targeted File Checkout (Preferred)
To revert changes made to a specific file without affecting other files or untracked assets:
```powershell
git checkout 821529c -- src/lib/executors.ts
```

### 2.2 Rule 2: Stash Before Hard Revert (Fail-Safe Preservation)
If an uncommitted state must be discarded, always stash it first so that any valuable edits can still be retrieved:
```powershell
# 1. Stash everything into reflog
git stash push -u -m "automated-pre-rollback-backup"

# 2. Revert tracked files to baseline
git checkout 821529c -- .

# If needed later, stashed work is recoverable via:
# git stash pop
```

### 2.3 Rule 3: Phase-Specific Safe Rollback Commands

#### Phase 1 Safe Rollback (Stability & Security)
```powershell
# Revert only the 2 Phase 1 modified files:
git checkout 821529c -- src/lib/executors.ts src/app/page.tsx

# Safely remove the new middleware file if created:
if (Test-Path src/middleware.ts) {
    Remove-Item src/middleware.ts -Force
}
```

#### Phase 2 Safe Rollback (AI & Engine)
```powershell
git checkout Phase1-Commit -- src/app/api/ai-builder/route.ts src/lib/executors.ts
```

#### Phase 3 Safe Rollback (Persistence & Queue)
```powershell
git checkout Phase2-Commit -- src/lib/store.ts src/lib/queue.ts
```

#### Phase 4 Safe Rollback (Emerald UI/UX)
```powershell
git checkout Phase3-Commit -- src/app/page.tsx src/components/CanvasNode.tsx src/components/Inspector.tsx
```

---

## 3. Baseline & Backup Verification Audit

Prior to any implementation:
1. **Git Commit Baseline**:
   - `git rev-parse HEAD` returns `6e5e4a6` (or baseline `821529c`).
   - `git status` confirms: `nothing to commit, working tree clean`.
2. **Offline ZIP Backup**:
   - Archive verified at: `C:\Users\srira\.gemini\antigravity\scratch\flowforge_pre_stage3_backup.zip`.
   - File size verified: `483,106 bytes`.
   - Extraction integrity confirmed in isolated workspace `C:\Users\srira\.gemini\antigravity\scratch\stage2-audit-workspace\flowforge`.

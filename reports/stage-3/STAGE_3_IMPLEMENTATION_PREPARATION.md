# FlowForge — Stage 3.0: Implementation Preparation & Execution Governance

> **Auditor Role**: Principal Software Architect & Lead Security Engineer  
> **Target Baseline**: FlowForge v2.4 (`flowforge@0.1.0`) at `C:\Users\srira\.gemini\antigravity\scratch\flowforge`  
> **Git Baseline Commit**: `821529c baseline: Stage 3.0 pristine source baseline snapshot`  
> **Source Backup Archive**: `C:\Users\srira\.gemini\antigravity\scratch\flowforge_pre_stage3_backup.zip` (483,106 bytes)  
> **Status**: **STAGE 3.0 PREPARATION COMPLETED (READ-ONLY)**. Application code remains 100% pristine.

---

## 1. Governance Charter & Operational Boundaries

Per the conditional Stage 3 approval instructions:
1. **Zero Code Changes in Stage 3.0**: This preparation stage verifies baseline snapshots, formulates impact matrices, and details rollback protocols. No application code has been or will be modified until explicit Stage 3.1 authorization is given.
2. **Security-First Phasing**: All Remote Code Execution (RCE), arbitrary file write/traversal, and API authentication controls are prioritized in **Phase 1** before any UI/UX or styling modifications are attempted.
3. **No Unnecessary Packages**: Zero third-party runtime bloat. All security guards, path sanitization, temporal grounding, and test harnesses leverage existing Node.js core modules (`node:path`, `node:crypto`, `node:test`) and existing packages.
4. **Phase-by-Phase Gates**: Each implementation phase must be separately validated with automated test runs before unlocking the subsequent phase.

---

## 2. Source Baseline & Recovery Certification

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STAGE 3.0 RECOVERABILITY AUDIT                       │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Git Repository Baseline     │ Initialized & Committed (821529c)     │
│ 2. Offline ZIP Snapshot        │ flowforge_pre_stage3_backup.zip       │
│ 3. Isolated Audit Workspace    │ stage2-audit-workspace/flowforge      │
│ 4. Stage 2 & 2.1 Reports       │ 100% Preserved & Committed            │
│ 5. Working Tree Status         │ Clean (0 uncommitted changes)         │
└────────────────────────────────┴───────────────────────────────────────┘
```

- Any failed modification during Stage 3 can be instantly rolled back using `git checkout -- <file>` or `git reset --hard 821529c`.

---

## 3. Prioritized Phasing Structure (Security-First)

```
┌────────────────────────────────────────────────────────────────────────┐
│                  SECURITY-FIRST IMPLEMENTATION PHASING                 │
├────────────────────┬───────────────────────────────────────────────────┤
│ PHASE 1: STABILITY │ • Task T1.1: Live ISO Date Grounding (DEF-AI-01)  │
│ & CRITICAL SECURITY│ • Task T1.2: Canvas SSE Live Auto-Binding (DEF-WF-1)│
│ (P0 — Immediate)   │ • Task T1.3: Host Shell RCE Kill-Switch (DEF-SEC-1)│
│                    │ • Task T1.4: Filesystem Path Jail (DEF-SEC-02)    │
│                    │ • Task T1.5: Next.js API Key Guard (DEF-SEC-03)   │
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 2: AI &      │ • Task T2.1: 27-Node AI Builder Whitelist         │
│ ENGINE HARDENING   │ • Task T2.2: Gemini 429 Exponential Backoff       │
│ (P1 — High)        │ • Task T2.3: SMTP Transporter Connection Pool     │
│                    │ • Tasks T2.4–T2.6: If/Split_out/Parallel_web Fixes│
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 3: DURABLE   │ • Task T3.1: Non-Blocking Async File Storage      │
│ PERSISTENCE        │ • Task T3.2: Disk-Backed Queue Persistence        │
│ (P2 — Medium)      │ • Tasks T3.3–T3.9: Queue Timeout, VM Prototype Fix│
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 4: EMERALD   │ • Task T4.1: Responsive Action Bar (No Collisions)│
│ UI/UX REDESIGN     │ • Task T4.2: Emerald Obsidian Canvas & Glowing SVG│
│ (P3 — Visual)      │ • Tasks T4.3–T4.4: Inspector Code Editor & Dock ⌘J│
├────────────────────┼───────────────────────────────────────────────────┤
│ PHASE 5: AUTOMATED │ • Task T5.1: Native Unit Test Suite (`node:test`) │
│ TESTING & QA (P4)  │ • Tasks T5.2–T5.4: CI Pipeline & Knowledge Polish │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 4. Execution Rules & Verification Protocol
1. **Target File Isolation**: In each phase, only files explicitly listed in [`FILE_CHANGE_IMPACT_MATRIX.md`](file:///C:/Users/srira/.gemini/antigravity/scratch/flowforge/reports/stage-3/FILE_CHANGE_IMPACT_MATRIX.md) may be modified.
2. **Automated Verification**: Immediately following each file edit, relevant unit/regression test commands must be run via PowerShell to confirm fix efficacy and zero regression.
3. **Change Logging**: Each edit must be committed with a descriptive git message (e.g. `fix(security): jail file node paths to data/files (DEF-SEC-02)`).

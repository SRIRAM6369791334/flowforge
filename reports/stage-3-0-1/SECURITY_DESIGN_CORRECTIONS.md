# FlowForge — Stage 3.0.1: Security Design Corrections & Blueprint Hardening

> **Document Version**: 1.0.0 — Pre-Implementation Security Review  
> **Auditor Role**: Principal Application Security Architect & Senior Next.js Engineer  
> **Status**: **READ-ONLY REVIEW COMPLETED**. Zero application source files modified.

---

## 1. Executive Summary & Purpose of Stage 3.0.1

Before authorizing Stage 3.1 code implementation, an independent security review was conducted on the Stage 3.0 blueprints (`SECURITY_FIRST_EXECUTION_PLAN.md`, `FILE_CHANGE_IMPACT_MATRIX.md`, and `ROLLBACK_AND_REGRESSION_PLAN.md`).

This review identified **4 subtle design vulnerabilities and operational hazards** in the preliminary Stage 3.0 blueprints:
1. **Flawed String-Prefix Path Containment (`.startsWith()`)**: Vulnerable to prefix-collision directory escapes (e.g. `data/files-private`).
2. **Hardcoded Year in AI Temporal Grounding**: Blueprint hardcoded `Current Year is 2026`, which is an anti-pattern that creates future temporal drift.
3. **Overly Permissive / Header-Spoofable API Middleware**: Naive `X-Forwarded-For` checks could allow remote bypass of local studio authentication.
4. **Destructive Routine Rollback (`git clean -fd`)**: Routine use of `git clean -fd` risked erasing untracked user files and test assets.

This document formally specifies the corrected, hardened blueprints to be used during Stage 3.1.

---

## 2. Reconciled Security Corrections Matrix

| Subsystem | Preliminary Blueprint Flaw | Corrected Hardened Blueprint | Security Benefit |
| :--- | :--- | :--- | :--- |
| **Filesystem Jail** (`read_file`, `write_file`) | `resolved.startsWith(root)` string check | Canonical `fs.realpathSync` + `path.relative()` non-escape validation + Windows reserved name filter | Eliminates prefix collisions (`files-leak`), symlink escapes, and Windows device name DoS |
| **Host Shell Execution** (`exec` node) | Environment flag without process tree kill | Strict default-deny (`FLOWFORGE_ENABLE_EXEC="true"`), sanitized environment, process tree cleanup | Prevents zombie background processes and credential leakage |
| **API Authentication** (All 14 Routes) | Naive IP check via `X-Forwarded-For` | Route-by-route policy: Studio Session Token + `Sec-Fetch-Site: same-origin` check; public webhook exemptions | Prevents header spoofing, DNS rebinding, and CSRF from external websites |
| **Temporal AI Grounding** (`gemini` node) | Hardcoded `Year is 2026` string | Fully dynamic `now.getFullYear()`, `now.toISOString()`, and `Asia/Kolkata` timezone injection | Eliminates temporal drift and prevents date hallucination indefinitely |
| **Canvas SSE Sync** (`page.tsx`) | Direct state binding without event dedup | `useRef` workflow tracking, event timestamp filtering, and `es.close()` lifecycle cleanup | Eliminates event replay loops, stale state race conditions, and connection storms |
| **Rollback Safety** | Included `git clean -fd` | Targeted `git checkout <commit> -- <file>` with `git stash` preservation | Guarantees zero accidental data loss of user files or untracked scripts |

---

## 3. Corrected Implementation Specifications

### 3.1 Corrected Path Jail Architecture
The preliminary `jailPath` implementation used:
```typescript
// INSECURE PRELIMINARY CODE:
if (!resolved.startsWith(root)) { throw new Error(...); }
```
If `root` is `/app/data/files`, an input of `../files-backup/secret.txt` resolves to `/app/data/files-backup/secret.txt`, which satisfies `.startsWith("/app/data/files")`!

**The Corrected Production Implementation**:
```typescript
import path from "node:path";
import fs from "node:fs";

export function safeJailPath(userPath: string): string {
  if (!userPath || typeof userPath !== "string") {
    throw new Error("Invalid file path parameter");
  }
  if (/[\0\x01-\x1f]/.test(userPath)) {
    throw new Error("Malicious path rejected: contains control characters or null bytes");
  }

  const root = path.resolve(process.cwd(), "data", "files");
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  const canonicalRoot = fs.realpathSync(root);
  const resolved = path.resolve(canonicalRoot, userPath);

  // 1. Path-relative boundary verification
  const rel = path.relative(canonicalRoot, resolved);
  if (path.isAbsolute(rel) || rel.startsWith("..") || rel === "..") {
    throw new Error(`Path traversal violation: "${userPath}" escapes jail boundary`);
  }

  // 2. Symlink resolution check for existing files
  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    const relReal = path.relative(canonicalRoot, realTarget);
    if (path.isAbsolute(relReal) || relReal.startsWith("..") || relReal === "..") {
      throw new Error(`Symlink escape violation: target points outside jail boundary`);
    }
  } else {
    // Check nearest existing ancestor directory
    let ancestor = path.dirname(resolved);
    while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) {
      ancestor = path.dirname(ancestor);
    }
    if (fs.existsSync(ancestor)) {
      const realAncestor = fs.realpathSync(ancestor);
      const relAncestor = path.relative(canonicalRoot, realAncestor);
      if (path.isAbsolute(relAncestor) || relAncestor.startsWith("..") || relAncestor === "..") {
        throw new Error(`Ancestor symlink escape violation: parent directory points outside jail`);
      }
    }
  }

  // 3. Windows Reserved Device Filter
  const baseName = path.basename(resolved).toUpperCase();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(baseName)) {
    throw new Error(`Access violation: Windows reserved device name "${baseName}"`);
  }

  return resolved;
}
```

---

### 3.2 Corrected Dynamic AI Temporal Grounding
**The Corrected Production Implementation**:
```typescript
const now = new Date();
const isoString = now.toISOString();
const currentYear = now.getFullYear();
const kolkataDate = now.toLocaleDateString("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const kolkataTime = now.toLocaleTimeString("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
});

const runtimeContext = 
  `[SYSTEM RUNTIME CONTEXT]\n` +
  `Current ISO Timestamp: ${isoString}\n` +
  `Current Date: ${kolkataDate}\n` +
  `Current Time: ${kolkataTime} IST (Asia/Kolkata)\n` +
  `Current Year: ${currentYear}\n` +
  `Rule: Always answer date, time, and year questions using this real-time metadata. Do not default to past training cutoff years.\n` +
  `----------------------------------------`;
```

---

### 3.3 Corrected Canvas SSE Auto-Binding (`src/app/page.tsx`)
```typescript
// Use ref to avoid recreating EventSource when activeWorkflowId changes
const activeWorkflowRef = useRef(activeWorkflowId);
useEffect(() => {
  activeWorkflowRef.current = activeWorkflowId;
}, [activeWorkflowId]);

useEffect(() => {
  const es = new EventSource("/api/events");
  
  es.addEventListener("workflow", (e) => {
    try {
      const payload = JSON.parse(e.data);
      // Ignore historical replayed events older than connection time
      if (!payload.time || Date.now() - new Date(payload.time).getTime() > 30_000) {
        return;
      }
      
      if (payload.type === "workflow_start" && payload.workflowId === activeWorkflowRef.current) {
        setActiveExecutionId(payload.executionId);
        setIsRunning(true);
      } else if (payload.type === "workflow_finish" && payload.workflowId === activeWorkflowRef.current) {
        setIsRunning(false);
      }
    } catch { /* ignore parse errors */ }
  });

  return () => {
    es.close();
  };
}, []); // Empty dependency array: stable singleton SSE connection
```

# FlowForge — Stage 1.5: Verified Security Findings & Threat Audit

> **Scope**: Independent security assessment of API authentication boundaries, execution sandboxing, credential storage, and command injection risks.  
> **Source Files**: `src/app/api/**/route.ts`, `src/lib/executors.ts`, `src/lib/expressions.ts`, `src/lib/store.ts`.  
> **Classification**: Independent Technical Audit.

---

## 1. Security Posture Summary Matrix

| Risk ID | Vulnerability Category | Severity (Public) | Severity (Local Studio) | Code Location | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Zero API Authentication | **HIGH** | **LOW** | All 14 route handlers in `src/app/api/**` | `CONFIRMED` |
| **SEC-02** | Arbitrary Shell Execution | **CRITICAL** | **MEDIUM** | `src/lib/executors.ts:673-690` (`exec` node) | `CONFIRMED` |
| **SEC-03** | Incomplete JS VM Sandbox | **HIGH** | **LOW** | `src/lib/executors.ts:323-350` & `expressions.ts:18` | `CONFIRMED` |
| **SEC-04** | Plaintext Secret Storage | **MEDIUM** | **LOW** | `data/db.json` (`secrets` dictionary) | `CONFIRMED` |
| **SEC-05** | Unvalidated Webhook Ingestion | **MEDIUM** | **LOW** | `src/app/api/webhook/[...path]/route.ts` | `CONFIRMED` |
| **SEC-06** | Open SSE Broadcast Stream | **MEDIUM** | **LOW** | `src/app/api/events/route.ts` | `CONFIRMED` |

---

## 2. In-Depth Technical Security Findings

### SEC-01: Zero API Authentication & Authorization
- **Location**: `src/app/api/**/route.ts`
- **Description**: None of the 14 Route Handlers check for `Authorization` headers, session cookies, or CSRF tokens. Any client on `localhost` (or on the local area network if bound to `0.0.0.0`) can:
  - Create, edit, or delete any workflow (`/api/workflows`).
  - Trigger immediate workflow execution (`/api/workflows/[id]/run`).
  - Read, write, or delete database tables (`/api/db`).
  - View masked secrets or overwrite secrets with arbitrary values (`/api/secrets`).
- **Architectural Context**: FlowForge is designed as a single-user local developer workbench. This zero-friction model is optimal for rapid local prototyping but must be protected with basic auth or reverse proxy if deployed to a public server.

### SEC-02: Arbitrary Shell Execution (`exec` node)
- **Location**: `src/lib/executors.ts:673-690`
- **Description**: The `exec` node accepts a `command` parameter and passes it directly to `node:child_process` `exec()`:
  ```typescript
  const { stdout, stderr } = await execAsync(s(p.command), {
    cwd: p.cwd ? s(p.cwd) : undefined,
    timeout: (Number(p.timeout) || 60) * 1000,
  });
  ```
- **Risk**: Any workflow containing an `exec` node can execute arbitrary bash, cmd, or PowerShell commands with the full privileges of the host user running `next dev`. If an attacker can inject dynamic parameters into an `exec` node via an unauthenticated webhook, remote code execution (RCE) is trivial.

### SEC-03: `node:vm` Sandbox Escape Potential
- **Location**: `src/lib/executors.ts:323-350` (`code` node) & `src/lib/expressions.ts:18-35`
- **Description**: Sandboxed JavaScript execution is implemented via Node.js core `node:vm` `Script.runInContext()`.
- **Risk**: As explicitly documented by the official Node.js security team, `node:vm` is **not a security sandbox**. Code executed inside `vm.createContext()` can break out into the host process through prototype inheritance:
  ```javascript
  this.constructor.constructor('return process')().exit();
  ```
  While acceptable for trusted single-user workflows, it does not isolate untrusted multi-tenant scripts.

### SEC-04: Plaintext Storage of Secrets
- **Location**: `C:\Users\srira\.gemini\antigravity\scratch\flowforge\data\db.json`
- **Description**: API keys for Gemini, Telegram, OpenAI, Resend, and Razorpay are saved as plaintext strings in `data/db.json` and read from `D:\My n8n\.env`.
- **Mitigation**: Access is restricted by filesystem permissions on the local machine. API responses (`GET /api/secrets`) mask values as `sk-***`.

---

## 3. Recommended Hardening Guidelines for Stage 2
1. **API Protection**: If exposing outside localhost, introduce optional API key authentication via Next.js middleware.
2. **Exec Node Restriction**: Introduce a safety toggle in `data/db.json` (e.g. `allowHostCommandExecution: false` by default).
3. **Webhook HMAC Enforcement**: Enforce signature checks on payment and external webhooks (already implemented for Razorpay in `executors.ts:610-622`).

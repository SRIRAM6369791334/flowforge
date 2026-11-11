# FlowForge — Stage 2: Security & Threat Assessment Audit

> **Scope**: Application security review, attack surface analysis, sandbox evaluation, injection vectors, and secret handling.  
> **Source Files**: All 14 routes under `src/app/api/**/route.ts`, `src/lib/executors.ts`, `src/lib/expressions.ts`, `src/lib/store.ts`.  
> **Audit Standard**: OWASP Top 10 API Security Risks & Node.js Security Best Practices.

---

## 1. Threat Modeling & Vulnerability Matrix

| Vulnerability ID | Vulnerability Category | Severity | CVSS v3.1 Base | Code Location | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-SEC-01** | Remote Code Execution (RCE) | **CRITICAL** | **9.8** | `src/lib/executors.ts:673-690` (`exec` node) | Confirmed |
| **DEF-SEC-02** | Path Traversal / Arbitrary File Write | **HIGH** | **8.5** | `src/lib/executors.ts:649-672` (`read_file`, `write_file`) | Confirmed |
| **DEF-SEC-03** | Broken Object Level Authorization / Missing Auth | **HIGH** | **7.5** | All 14 Route Handlers in `src/app/api/**` | Confirmed |
| **DEF-CORE-03**| Sandbox Escape via Prototype Chain | **MEDIUM** | **6.5** | `src/lib/executors.ts:323-350` (`code` node) | Confirmed |
| **DEF-SEC-04** | Plaintext Credential Exposure on Disk | **LOW** | **4.2** | `data/db.json` (`secrets` key-value store) | Confirmed |
| **DEF-SEC-05** | Unvalidated Webhook Subsegment Ingestion | **LOW** | **3.8** | `src/app/api/webhook/[...path]/route.ts:8` | Confirmed |
| **DEF-SEC-06** | Open SSE Broadcast Stream | **LOW** | **3.5** | `src/app/api/events/route.ts:4-72` | Confirmed |

---

## 2. In-Depth Vulnerability Analysis

### 2.1 DEF-SEC-01: Remote Code Execution via `exec` Node
- **Vulnerability**: The `exec` node accepts an arbitrary shell string in `command` and executes it directly via Node's `child_process.exec()` without sandboxing or command whitelisting.
- **Code Reference**:
  ```typescript
  // src/lib/executors.ts:674-685:
  const { stdout, stderr } = await execAsync(s(p.command), {
    cwd: p.cwd ? s(p.cwd) : undefined,
    timeout: (Number(p.timeout) || 60) * 1000,
  });
  ```
- **Exploitation Scenario**: An attacker who can trigger a webhook or submit a public form with payload `{{ "calc.exe" }}` or malicious PowerShell commands can execute arbitrary code on the server host with the permissions of the user running `next dev`.
- **Remediation**:
  1. Add an environment kill-switch: `ENABLE_HOST_EXECUTION = process.env.FLOWFORGE_ENABLE_EXEC === "true"`.
  2. If disabled, `exec` node immediately throws: *"Host shell execution is disabled in this environment"*.
  3. Disallow dynamic variable interpolation in executable binary names.

---

### 2.2 DEF-SEC-02: Path Traversal & Arbitrary File Overwrite
- **Vulnerability**: `read_file` and `write_file` resolve user-supplied file paths using `path.resolve(s(p.path))` without boundary checks.
- **Code Reference**:
  ```typescript
  // src/lib/executors.ts:651, 664:
  const pth = path.resolve(s(p.path));
  await fs.writeFile(pth, content, ...);
  ```
- **Exploitation Scenario**: Passing `path: "../../../package.json"` or `path: "C:\\Windows\\System32\\drivers\\etc\\hosts"` allows overwriting core project or OS files.
- **Remediation**:
  Assert path jail confinement:
  ```typescript
  const ALLOWED_ROOT = path.resolve(process.cwd(), "data", "files");
  const targetPath = path.resolve(ALLOWED_ROOT, s(p.path));
  if (!targetPath.startsWith(ALLOWED_ROOT)) {
    throw new Error("Access Denied: Path outside data/files sandbox root");
  }
  ```

---

### 2.3 DEF-SEC-03: Zero API Authentication
- **Vulnerability**: All 14 API route handlers under `src/app/api/**` accept requests from any IP address or caller without authentication headers.
- **Remediation**:
  Implement a Next.js middleware `src/middleware.ts` that enforces an API key header (`x-flowforge-key`) for non-local or public requests, while allowing local studio origin requests.

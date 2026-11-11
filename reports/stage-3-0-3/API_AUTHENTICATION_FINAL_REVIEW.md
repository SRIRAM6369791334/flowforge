# FlowForge — Stage 3.0.3: API Authentication & Authorization In-Depth Security Review

> **Document ID**: `STAGE-3-0-3-API-03`  
> **Status**: APPROVED SECURITY ARCHITECTURE REPORT  
> **Target File**: `src/proxy.ts` (Phase 1 `T1.5` / `DEF-SEC-03`)  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Current Commit**: `d097365445ea64e7fe65839b2ae8ae842245b736`

---

## 1. Executive Summary & Security Boundary Definition

A critical architectural distinction must be established between:
1. **Browser Cross-Origin Protection (Anti-CSRF)**: Protecting a browser session from malicious cross-origin scripts (`evil.com`) executing unauthorized requests against a local FlowForge instance.
2. **Client Authentication**: Cryptographically verifying the identity and authorization of the entity making the HTTP request (whether a human user in a browser or an automated programmatic script).

---

## 2. Browser-Origin Validation vs True Client Authentication

### 2.1 The Vulnerability of Relying on `x-flowforge-studio` Alone
In earlier drafts, it was suggested that a request carrying `Origin: http://localhost:3000` and `x-flowforge-studio: 1` could be automatically trusted as a local Studio user.

**Critical Threat Analysis**:
- The HTTP `Origin` header and custom headers like `x-flowforge-studio: 1` are **enforced by web browsers, NOT by the network or operating system**.
- Any attacker script, malware, Python script, or local executable running on the machine (or on the local LAN) can send:
  ```http
  POST /api/secrets HTTP/1.1
  Host: localhost:3000
  Origin: http://localhost:3000
  x-flowforge-studio: 1
  ```
- If FlowForge relied solely on `Origin` and `x-flowforge-studio`, any local non-browser process could manipulate workflows, exfiltrate API keys, or trigger execution without authentication.

### 2.2 Security Classification of Headers
- **`Origin` & `Sec-Fetch-Site`**: **Anti-CSRF & CORS controls only**. They guarantee that a web browser user visiting an external website cannot be tricked into making cross-site requests to FlowForge.
- **`x-flowforge-studio: 1`**: **Custom header defense-in-depth indicator**. Prevents simple HTML form POSTs from other origins, but provides zero identity verification.
- **Actual Client Authentication**: Must rely on cryptographic credentials:
  - For Programmatic API Clients: `FLOWFORGE_API_KEY` (via `Authorization: Bearer` or `x-api-key`).
  - For Browser Studio Clients: In Production, a cryptographically signed, HttpOnly session cookie generated upon authenticated login. In Development, restricted strictly to local loopback IPs (`127.0.0.1`, `::1`).

---

## 3. Trusted Local Studio Boundary & Programmatic Key Policy

### 3.1 Production Environment (`NODE_ENV === "production"`)
1. **Mandatory API Key Configuration**:
   - `FLOWFORGE_API_KEY` must be configured with at least 32 characters of entropy.
   - If missing or empty, Next.js Proxy **fails closed immediately**, returning HTTP `500 Internal Server Error`:
     ```json
     { "error": "Security Configuration Error: FLOWFORGE_API_KEY must be configured in production" }
     ```
2. **Programmatic Access**:
   - Must provide `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`.
   - Rejection status: `401 Unauthorized`.
3. **Studio Browser Access**:
   - Requires valid session cookie or local administrative token.
   - Non-authenticated browser requests are redirected to a setup/login prompt.

### 3.2 Development Environment (`NODE_ENV !== "production"`)
1. **Loopback Studio UX Convenience**:
   - If `FLOWFORGE_API_KEY` is not set, browser requests originating from loopback (`localhost`, `127.0.0.1`, `[::1]`) are permitted with a response header:
     `x-flowforge-dev-warning: Running in unauthenticated development mode on loopback`
2. **Network / LAN Protection in Dev**:
   - Any request arriving from a non-loopback IP (e.g. `192.168.x.x`, `10.x.x.x`, or public IP) **STRICTLY REQUIRES** `FLOWFORGE_API_KEY`, even in development mode! This prevents unauthorized access across the local office or home Wi-Fi network.

---

## 4. True Constant-Time Token Verification (No Length Leaks)

### 4.1 The Length-Leak Flaw in Standard `timingSafeEqual`
Standard `crypto.timingSafeEqual(bufA, bufB)` throws an exception if `bufA.length !== bufB.length`.

A common insecure workaround is:
```typescript
if (bufA.length !== bufB.length) return false; // VULNERABILITY: Execution time reveals token length!
return crypto.timingSafeEqual(bufA, bufB);
```

### 4.2 Constant-Time Fixed-Digest Hash Comparison Algorithm
To guarantee true constant-time execution regardless of input length, both tokens are hashed to SHA-256 before comparison. Because SHA-256 digests are **always exactly 32 bytes**, `timingSafeEqual` executes without length exceptions and without timing discrepancies:

```typescript
import crypto from "node:crypto";

export function constantTimeCompare(provided: string, expected: string): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }

  // Pre-hash both inputs to SHA-256 digests (fixed 32-byte Buffers)
  const hashProvided = crypto.createHash("sha256").update(provided, "utf8").digest();
  const hashExpected = crypto.createHash("sha256").update(expected, "utf8").digest();

  // Timing is strictly constant: exactly 32 bytes compared on every call
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}
```

---

## 5. Audit of All 14 Routes & Path Normalization Against Traversal Bypasses

### 5.1 Route Inventory & Access Classification
All 14 routes verified in `src/app/api/`:

| Route Path | Allowed Methods | Classification | Authentication Rule |
| :--- | :--- | :--- | :--- |
| `/api/webhook/[...path]` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | **Public Webhook** | Path verification + optional HMAC signature |
| `/api/forms/submit` | `POST` **ONLY** | **Public Form** | Disallow GET/PUT/DELETE (`405 Method Not Allowed`) |
| `/api/ai-builder` | `POST` | **Protected** | API Key or Studio Session |
| `/api/db` | `GET`, `POST`, `DELETE` | **Protected** | API Key or Studio Session |
| `/api/events` | `GET` | **Protected** | API Key or Studio Session |
| `/api/executions` | `GET`, `DELETE` | **Protected** | API Key or Studio Session |
| `/api/queue` | `GET`, `POST` | **Protected** | API Key or Studio Session |
| `/api/secrets` | `GET`, `POST`, `DELETE` | **CRITICAL PROTECTED** | Master API Key or Authenticated Admin Session |
| `/api/telegram` | `GET`, `POST` | **Protected** | API Key or Studio Session |
| `/api/workflows` | `GET`, `POST` | **Protected** | API Key or Studio Session |
| `/api/workflows/run-parallel` | `POST` | **Protected** | API Key or Studio Session |
| `/api/workflows/[id]` | `GET`, `PUT`, `DELETE` | **Protected** | API Key or Studio Session |
| `/api/workflows/[id]/live` | `GET` | **Protected** | API Key or Studio Session |
| `/api/workflows/[id]/run` | `POST` | **Protected** | API Key or Studio Session |

### 5.2 Anti-Traversal Route Normalization
To prevent bypasses using URL encoding or relative path navigation:
```typescript
import path from "node:path";

export function normalizeAndMatchRoute(rawPathname: string): {
  isPublicWebhook: boolean;
  isPublicForm: boolean;
  normalizedPath: string;
} {
  // Decode percent-encoding and normalize using POSIX path rules
  const decoded = decodeURIComponent(rawPathname);
  const normalized = path.posix.normalize(decoded);

  const isPublicWebhook = normalized.startsWith("/api/webhook/") && normalized.length > "/api/webhook/".length;
  const isPublicForm = normalized === "/api/forms/submit";

  return { isPublicWebhook, isPublicForm, normalizedPath: normalized };
}
```

---

## 6. Verification Verdict

| Verification Item | Specification Invariant | Status |
| :--- | :--- | :---: |
| Origin vs Authentication separation | Documented in Section 2 | **PASS** |
| Localhost vs LAN boundary in dev | Documented in Section 3.2 | **PASS** |
| True constant-time token comparison | SHA-256 pre-hash algorithm in Section 4.2 | **PASS** |
| Production fail-closed configuration | Documented in Section 3.1 | **PASS** |
| 14 routes categorized & anti-traversal normalization | Documented in Section 5 | **PASS** |

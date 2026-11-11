# FlowForge — Stage 3.0.3: Webhook Security, Payload Integrity & Abuse Prevention

> **Document ID**: `STAGE-3-0-3-WEBHOOK-04`  
> **Status**: APPROVED SECURITY ARCHITECTURE REPORT  
> **Target Route**: `src/app/api/webhook/[...path]/route.ts`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Current Commit**: `d097365445ea64e7fe65839b2ae8ae842245b736`

---

## 1. Executive Summary & Baseline Vulnerability Analysis

Direct inspection of `src/app/api/webhook/[...path]/route.ts` reveals four primary security deficiencies in the baseline implementation:

1. **Unbounded Payload Ingestion (DoS / OOM Risk)**:
   - Line 25: `const rawBody = method === "GET" || method === "HEAD" ? "" : await req.text();`
   - Next.js streams the entire body into memory without inspecting `Content-Length` or imposing a byte limit. An attacker can stream a 500MB payload, exhausting Node.js heap space and crashing the server.
2. **Missing Cryptographic Signature Enforcement**:
   - The route handler currently matches active workflows by path and method alone. If a webhook node defines a secret, no verification logic is executed in the baseline.
3. **Equating Path Entropy with Authentication**:
   - Webhook URLs (e.g. `/api/webhook/abc-123-uuid`) are treated as implicitly authorized. In reality, URLs appear in HTTP server logs, browser histories, proxy caches, and `Referer` headers. Path entropy provides zero payload integrity or authenticity.
4. **Absence of Rate Limiting & Replay Protection**:
   - An attacker can replay legitimate webhook payloads indefinitely, or flood the endpoint to exhaust worker queue memory.

---

## 2. Mandatory Signature Behavior When Secrets Exist

When a workflow's `webhook_trigger` node defines a `secret` parameter (or references a secret in store):

### 2.1 Supported Signature Formats
1. **GitHub / Gitea (`x-hub-signature-256`)**:
   - Header value: `sha256=<hex_digest>`
   - Algorithm: HMAC-SHA256 of raw body bytes using webhook secret.
2. **Stripe (`stripe-signature`)**:
   - Header value: `t=<timestamp>,v1=<hex_digest>`
   - Algorithm: HMAC-SHA256 of `${timestamp}.${rawBody}` using secret.
3. **Generic Webhook Signature (`x-signature-256`, `x-signature`, `x-flowforge-signature`)**:
   - Header value: `<hex_digest>` or `sha256=<hex_digest>`

### 2.2 Mandatory Rejection Policy
- If `node.params.secret` is configured:
  - If the signature header is **missing**: **Reject with HTTP 401 Unauthorized** (`{"error": "Missing required webhook signature header"}`).
  - If the signature header is **invalid**: **Reject with HTTP 401 Unauthorized** (`{"error": "Invalid webhook signature"}`).
  - Verification uses constant-time comparison via `constantTimeCompare` (pre-hashed SHA-256).

---

## 3. Safe Governance When Webhook Secrets Are Absent

### 3.1 The Myth of "Secret URLs"
Treating a random path as an authentication secret is an anti-pattern:
- URLs are transmitted in cleartext over networks where TLS terminates early (reverse proxies, CDNs).
- URLs are routinely logged by routers, gateways, and load balancers.
- A path secret provides zero integrity: an attacker can alter JSON values in transit without invalidating the URL.

### 3.2 Security Policy for Unsigned Webhooks
When a workflow does not configure a webhook secret:
1. **Explicit Studio Warning**:
   - The FlowForge Inspector displays a visual warning:
     `⚠️ Unauthenticated Webhook: Any client knowing this URL can trigger execution with arbitrary payloads.`
2. **Privilege Restriction**:
   - Unauthenticated webhooks **cannot** trigger workflows containing privileged execution nodes (`exec`, arbitrary `write_file`, or direct database drop/delete operations) unless an explicit flag `node.params.allowUnauthenticatedPrivilegedExecution = true` is toggled.
3. **Mandatory High-Entropy Path**:
   - Webhooks without signatures must use UUIDv4 or high-entropy paths (minimum 32 random characters). Generic names like `/api/webhook/test` or `/api/webhook/contact` are prohibited.

---

## 4. Abuse Prevention, Rate Limiting & Request-Size Limits

### 4.1 Strict Payload Size Limits
Before reading the request body:
```typescript
const MAX_WEBHOOK_BODY_BYTES = 1 * 1024 * 1024; // 1 MB limit

export async function readBoundedBody(req: Request): Promise<{ ok: boolean; bodyText: string; error?: string }> {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return { ok: false, bodyText: "", error: "Payload Too Large: Maximum allowed webhook body is 1MB" };
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: true, bodyText: "" };

  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.length;
    if (receivedBytes > MAX_WEBHOOK_BODY_BYTES) {
      reader.cancel();
      return { ok: false, bodyText: "", error: "Payload Too Large: Stream exceeded 1MB" };
    }
    chunks.push(value);
  }

  const fullBuffer = Buffer.concat(chunks);
  return { ok: true, bodyText: fullBuffer.toString("utf8") };
}
```
If size is exceeded: Returns HTTP `413 Payload Too Large`.

### 4.2 Replay Protection (Timestamp Windows)
- For webhooks with timestamp headers (e.g. `x-webhook-timestamp` or Stripe `t=`):
  - Extract timestamp $T_{req}$.
  - Verify: $|T_{now} - T_{req}| \le 300\text{ seconds}$ (5-minute tolerance window).
  - Any request outside the 5-minute window is rejected with HTTP `400 Bad Request` (`"Webhook timestamp outside tolerance window"`).

### 4.3 In-Memory Rate Limiting
- To protect the queue worker pool against flood attacks:
  - Sliding-window rate limiter tracks requests per IP and per webhook path.
  - Limit: **60 requests per minute per path per IP**.
  - Burst threshold exceeded: Returns HTTP `429 Too Many Requests` with `Retry-After: 60`.

---

## 5. Verification Verdict

| Verification Item | Implementation Rule | Status |
| :--- | :--- | :---: |
| Mandatory signature enforcement | Section 2.2 | **PASS** |
| URL entropy disclaimers & privilege gates | Section 3.2 | **PASS** |
| 1MB payload size limit (`413`) | Section 4.1 | **PASS** |
| 5-minute replay tolerance window | Section 4.2 | **PASS** |
| Rate limiting per IP/path (`429`) | Section 4.3 | **PASS** |

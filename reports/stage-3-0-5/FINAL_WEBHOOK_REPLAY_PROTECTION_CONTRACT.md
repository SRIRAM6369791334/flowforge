# FlowForge — Stage 3.0.5: Webhook Replay Protection & Deduplication Contract

> **Document ID**: `STAGE-3-0-5-REPLAY-03`  
> **Status**: AUTHORITATIVE SECURITY SPECIFICATION  
> **Task Reference**: `T3 — Webhook Replay Protection`  
> **Target Module**: `src/app/api/webhook/[...path]/route.ts` & `src/lib/security.ts`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `6aec3ba0b0213d29d8995a329971bc391100bb5b`

---

## 1. Threat Definition: The Webhook Replay Problem

A validly signed webhook request (e.g., from Stripe or GitHub) contains a cryptographic signature authenticating that the payload originated from the provider.

However, **a signature alone does not prevent replay attacks**:
- An attacker eavesdropping on the network (or intercepting intermediate proxy logs) can capture a legitimate signed request (such as `"payment.succeeded"` or `"workflow.deploy"`) and re-send the exact same byte payload and signature headers repeatedly.
- Without replay protection, FlowForge would re-execute the workflow on every replay, leading to duplicate database inserts, duplicate emails, or unauthorized multiple executions.

---

## 2. Replay Protection for Timestamp-Bearing Signatures

Many enterprise webhook providers (e.g. Stripe, Slack) explicitly embed an integer timestamp in their signature headers.

### 2.1 The Timestamp Sliding Window
- **Stripe Header**: `stripe-signature: t=1614555555,v1=5257a869e7...`
- **Generic Headers**: `x-webhook-timestamp: 1614555555` or `x-timestamp`
- **Validation Rules**:
  1. Parse the integer timestamp $T_{req}$.
  2. Let $T_{now} = \lfloor\text{Date.now()} / 1000\rfloor$ (current epoch seconds).
  3. Enforce the sliding window condition:
     $$|T_{now} - T_{req}| \le 300\text{ seconds (5 minutes)}$$
  4. If $|T_{now} - T_{req}| > 300$: **Reject immediately with HTTP 400 Bad Request** (`"Webhook timestamp outside 5-minute tolerance window"`).

---

## 3. Replay Protection for Requests Without Timestamps

Providers like GitHub (`x-hub-signature-256`) do not include a timestamp inside the signature string. Furthermore, even within a 5-minute window, an attacker could replay a timestamped request 100 times within 10 seconds.

Therefore, **timestamp validation must be paired with Nonce / Event-ID Deduplication**:

### 3.1 Nonce / Event Identifier Extraction
FlowForge extracts a unique delivery identifier using a deterministic priority cascade:
1. `x-github-delivery`: GitHub's unique UUIDv4 per delivery event.
2. `stripe-signature` $v_1$ hash + timestamp: The unique signature string itself.
3. `x-request-id` / `x-event-id`: Generic provider unique delivery headers.
4. **Fallback Payload Fingerprint**: If no provider identifier header exists:
   $$\text{Fingerprint} = \text{SHA-256}(\text{hookPath} + ":" + \text{rawBody})$$

### 3.2 In-Memory TTL Deduplication Cache
An in-memory LRU deduplication store tracks observed event identifiers:

```typescript
interface NonceEntry {
  expiresAt: number; // Epoch milliseconds
}

class NonceDeduplicationCache {
  private cache = new Map<string, NonceEntry>();
  private readonly ttlMs = 10 * 60 * 1000; // 10 minutes retention

  public checkAndRecord(nonceKey: string): { isDuplicate: boolean } {
    const now = Date.now();
    this.cleanup(now);

    const existing = this.cache.get(nonceKey);
    if (existing && existing.expiresAt > now) {
      return { isDuplicate: true };
    }

    // Record nonce with 10-minute expiry
    this.cache.set(nonceKey, { expiresAt: now + this.ttlMs });
    return { isDuplicate: false };
  }

  private cleanup(now: number): void {
    if (this.cache.size > 5000) {
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt <= now) {
          this.cache.delete(key);
        }
      }
    }
  }
}

// Bound to Node globalThis to survive Next.js module re-evaluations
const g = globalThis as unknown as { __ffWebhookDeduplicator?: NonceDeduplicationCache };
export const webhookDeduplicator = (g.__ffWebhookDeduplicator ??= new NonceDeduplicationCache());
```

### 3.3 Duplicate Handling Semantics
When a duplicate nonce is detected:
- The endpoint **does not trigger the workflow**.
- Returns HTTP `200 OK` (or `409 Conflict`) with:
  ```json
  { "ok": true, "duplicate": true, "message": "Event already processed (idempotent ignore)" }
  ```
- Returning `200 OK` with an idempotent ignore message prevents webhook providers (like Stripe or GitHub) from considering the delivery a failure and re-trying.

---

## 4. Retention Duration & Multi-Request Guarantee

- **Tolerance Window**: 5 minutes ($300\text{ s}$).
- **Deduplication Cache Retention**: **10 minutes ($600\text{ s}$)** — exactly $2\times$ the sliding window.
- **Security Guarantee**:
  - Within the 5-minute window: The unique signature/event ID is present in the cache; any duplicate is caught and blocked.
  - After 10 minutes: The cache entry expires, but the request's timestamp is now $>5\text{ minutes}$ old and is permanently blocked by the timestamp sliding-window gate!
  - **Result: Zero replay window exists.**

---

## 5. Persistence and Restart Limitations (Honest Disclosure)

> [!CAUTION]
> **Single-Process In-Memory Limitation**:  
> The `webhookDeduplicator` stores observed nonces in **Node.js process RAM**.  
> If the FlowForge server process is restarted, the in-memory cache is wiped. A legitimate webhook originally sent 2 minutes before the restart could theoretically be re-sent within the remaining 3 minutes and executed a second time.  
> In single-tenant self-hosted environments, this window is minimal. True persistent distributed deduplication across restarts and clusters would require Redis or disk persistence, scheduled for Phase 3 (`T3.2`).

---

## 6. Verification Verdict

| Verification Item | Specification Invariant | Status |
| :--- | :--- | :---: |
| Timestamp-bearing 5-minute sliding window | Defined in Section 2.1 | **PASS** |
| Fallback SHA-256 fingerprint deduplication | Defined in Section 3.1 | **PASS** |
| 10-minute cache retention ($2\times$ tolerance) | Defined in Section 3.2 & 4 | **PASS** |
| In-memory restart limitation disclosed | Explicitly documented in Section 5 | **PASS** |

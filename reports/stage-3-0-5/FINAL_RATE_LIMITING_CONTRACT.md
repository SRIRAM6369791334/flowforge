# FlowForge — Stage 3.0.5: Rate-Limit Reliability & Client IP Extraction Contract

> **Document ID**: `STAGE-3-0-5-RATELIMIT-04`  
> **Status**: AUTHORITATIVE TECHNICAL SPECIFICATION  
> **Task Reference**: `T4 — Rate-Limit Reliability`  
> **Target Module**: `src/proxy.ts` (Next.js 16 Proxy)  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `6aec3ba0b0213d29d8995a329971bc391100bb5b`

---

## 1. Threat Analysis: The Header-Spoofing Vulnerability

A naive per-IP rate limiter simply reads:
```typescript
const clientIp = req.headers.get("x-forwarded-for") || "unknown"; // VULNERABILITY!
```

### 1.1 How Header-Spoofing Defeats Rate Limiting
- Any external client can transmit arbitrary `X-Forwarded-For` headers with randomly generated IP addresses:
  ```http
  POST /api/webhook/github HTTP/1.1
  Host: flowforge.domain.com
  X-Forwarded-For: 1.2.3.4
  ```
- If the server naively splits by comma and takes the leftmost IP, the attacker rotates `X-Forwarded-For` on every request. Each request is assigned a fresh rate-limit bucket, **completely bypassing rate limits and flooding the server**.
- Furthermore, an attacker can spoof someone else's IP to induce a denial-of-service against legitimate users.

---

## 2. Hardened Client IP Extraction Rules

FlowForge enforces strict, tamper-resistant IP extraction governed by explicit environment configuration:

### 2.1 Configuration Modes
1. **Direct Host / Unproxied Mode (Default)**:
   - When FlowForge runs directly exposed (e.g. `localhost`, or direct port exposure without reverse proxy):
   - **`X-Forwarded-For` is completely untrusted and IGNORED**.
   - Client IP is taken strictly from the underlying TCP connection or normalized to `127.0.0.1`.
2. **Designated Trusted Reverse Proxy Mode**:
   - Enabled via: `FLOWFORGE_TRUST_PROXY="true"`
   - `FLOWFORGE_TRUSTED_HOPS`: Integer count of trusted proxies (default `1`).
   - The IP address is parsed from `X-Forwarded-For` **from right to left**, skipping exactly the number of trusted proxy hops.
3. **Cloudflare Integration**:
   - `cf-connecting-ip` is evaluated **only** when `FLOWFORGE_TRUST_CLOUDFLARE="true"`.

### 2.2 Concrete Extraction Algorithm

```typescript
export function extractClientIp(req: Request): string {
  const isTrustProxy = process.env.FLOWFORGE_TRUST_PROXY === "true";
  const isCloudflare = process.env.FLOWFORGE_TRUST_CLOUDFLARE === "true";

  // 1. Cloudflare header (if explicitly trusted)
  if (isCloudflare) {
    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp && isValidIp(cfIp.trim())) {
      return cfIp.trim();
    }
  }

  // 2. Trusted Proxy chain resolution
  if (isTrustProxy) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      // Split IPs by comma, trim whitespace
      const ips = xff.split(",").map((s) => s.trim()).filter(Boolean);
      const hops = Math.max(1, parseInt(process.env.FLOWFORGE_TRUSTED_HOPS || "1", 10));
      
      // Select the IP placed by the outermost trusted proxy (hops from the right)
      if (ips.length >= hops) {
        const clientIp = ips[ips.length - hops];
        if (isValidIp(clientIp)) {
          return clientIp;
        }
      }
    }
  }

  // 3. Fallback: Disallow untrusted header spoofing
  // Return loopback for local development or connection identifier
  return "127.0.0.1";
}

function isValidIp(ip: string): boolean {
  // Validates standard IPv4 or IPv6 format
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip);
}
```

---

## 3. Sliding-Window In-Memory Rate Limiter Architecture

Rate limiting is applied at the Next.js 16 Proxy layer (`src/proxy.ts`):

```typescript
interface RateBucket {
  tokens: number;
  lastRefill: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, RateBucket>();
  private readonly maxTokens = 60; // Max 60 requests
  private readonly refillRatePerSec = 1; // Refills 1 token per second (60/min)

  public consume(key: string): { allowed: boolean; remaining: number; retryAfterSec?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      // Token bucket refill logic
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsedSec * this.refillRatePerSec);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const retryAfterSec = Math.ceil((1 - bucket.tokens) / this.refillRatePerSec);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
}

const g = globalThis as unknown as { __ffRateLimiter?: InMemoryRateLimiter };
export const proxyRateLimiter = (g.__ffRateLimiter ??= new InMemoryRateLimiter());
```

---

## 4. Single-Process In-Memory Limitations (Honest Disclosure)

> [!CAUTION]
> **Strict Operational Boundaries**:
> 1. **Single-Process Constraint**: The `proxyRateLimiter` operates strictly in **Node.js process RAM**.
> 2. **Multi-Process / Cluster Mode**: If Next.js is run in multi-worker cluster mode, each worker process maintains its own isolated memory bucket. An attacker could send $60 \times N$ requests where $N$ is the worker count.
> 3. **Restart Reset**: Process restart instantly clears all buckets.
> 4. **No Distributed Claim**: FlowForge **does NOT claim distributed rate limiting**. Distributed rate limiting across serverless instances or multi-server clusters requires a centralized Redis/KV store, scheduled for Phase 3 (`T3.2`).

---

## 5. Verification Verdict

| Verification Item | Specification Invariant | Status |
| :--- | :--- | :---: |
| Forwarded-header spoofing neutralized | Untrusted XFF ignored by default in Section 2.1 | **PASS** |
| Trusted proxy hop count algorithm | Right-to-left resolution in Section 2.2 | **PASS** |
| Token-bucket sliding-window implementation | Defined in Section 3 | **PASS** |
| Single-process & restart limits disclosed | Explicitly documented in Section 4 | **PASS** |
| Prohibition of false "distributed" claims | Codified in Section 4 | **PASS** |

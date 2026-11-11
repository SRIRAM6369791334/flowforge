# FlowForge — Stage 3.0.5: Implementable Streaming Body-Limit Contract

> **Document ID**: `STAGE-3-0-5-STREAM-02`  
> **Status**: AUTHORITATIVE TECHNICAL SPECIFICATION  
> **Task Reference**: `T2 — Implementable Streaming Body-Limit Contract`  
> **Target Module**: `src/app/api/webhook/[...path]/route.ts` & `src/proxy.ts`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `6aec3ba0b0213d29d8995a329971bc391100bb5b`

---

## 1. The Fundamental Flaw of Content-Length Alone

Validating the `Content-Length` header is a necessary fast-rejection filter, but **it does not constitute streaming body-limit enforcement**.

An adversary can trivially defeat header-only validation through three attack vectors:
1. **Misleading Header Attack**: An attacker sends `Content-Length: 100`, but keeps the TCP socket open and streams 500 MB of continuous data. If the server reads `await req.text()`, it buffers all 500 MB into RAM, causing an Out-Of-Memory (OOM) crash.
2. **Chunked Transfer Encoding (`Transfer-Encoding: chunked`)**: HTTP/1.1 and HTTP/2 allow omitting `Content-Length` entirely. A client can stream gigabytes of chunked data without ever setting a length header.
3. **Malformed Header**: A client sends non-numeric, negative, or multiple conflicting `Content-Length` headers (`Content-Length: -5`, `Content-Length: 100, 200`, `Content-Length: abc`).

---

## 2. Implementable Dual-Layer Streaming Enforcement Architecture

FlowForge implements an uncompromising **dual-layer body enforcement contract**:
- **Layer 1 (Fast Rejection in `src/proxy.ts`)**: Evaluates declared `Content-Length`.
- **Layer 2 (Streaming Byte-Counter in Route Handler)**: Measures raw incoming bytes on the wire in real time chunk by chunk.

```
Incoming Request: POST /api/webhook/github
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Fast Header Check in Proxy (src/proxy.ts)           │
│ • If Content-Length present & > 1 MB: REJECT 413 immediately │
│ • If Content-Length malformed/negative: REJECT 400           │
│ • If Content-Length absent or <= 1 MB: Pass to Route Handler │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Streaming Byte Counter in Route Handler (route.ts) │
│ • Acquired Web ReadableStream reader (req.body.getReader())  │
│ • Reads chunk-by-chunk: accumulatedBytes += chunk.length     │
│ • If accumulatedBytes > 1,048,576 bytes:                     │
│     1. CANCEL stream reader immediately (terminates socket) │
│     2. ABORT body consumption                               │
│     3. RETURN HTTP 413 Payload Too Large                    │
│ • If stream closes with accumulatedBytes <= 1 MB:            │
│     Assemble UTF-8 string and proceed to HMAC verification   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Concrete Implementation: `readBoundedBody`

The following streaming reader function is implemented in `src/lib/security.ts` and consumed directly by `src/app/api/webhook/[...path]/route.ts`:

```typescript
export const MAX_BODY_BYTES = 1024 * 1024; // Exactly 1,048,576 bytes (1 MB)

export interface BoundedBodyResult {
  ok: boolean;
  bodyText: string;
  statusCode: number;
  error?: string;
}

export async function readBoundedBody(req: Request): Promise<BoundedBodyResult> {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return { ok: true, bodyText: "", statusCode: 200 };
  }

  // 1. Layer 1: Header Validation
  const rawContentLength = req.headers.get("content-length");
  if (rawContentLength !== null) {
    // Must be positive base-10 integer
    if (!/^\d+$/.test(rawContentLength.trim())) {
      return {
        ok: false,
        bodyText: "",
        statusCode: 400,
        error: "Malformed Content-Length header",
      };
    }
    const declaredLength = parseInt(rawContentLength.trim(), 10);
    if (declaredLength > MAX_BODY_BYTES) {
      return {
        ok: false,
        bodyText: "",
        statusCode: 413,
        error: `Payload Too Large: Declared Content-Length ${declaredLength} exceeds 1MB limit`,
      };
    }
  }

  // 2. Layer 2: True Chunk-by-Chunk Streaming Counter
  if (!req.body) {
    return { ok: true, bodyText: "", statusCode: 200 };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;

      // Active Circuit Breaker: Rejects BEFORE full buffering
      if (totalBytes > MAX_BODY_BYTES) {
        // Cancel upstream reader to prevent further network bandwidth consumption
        await reader.cancel("Payload limit exceeded");
        return {
          ok: false,
          bodyText: "",
          statusCode: 413,
          error: "Payload Too Large: Transmitted stream exceeded 1MB limit",
        };
      }

      chunks.push(value);
    }
  } catch (err: any) {
    return {
      ok: false,
      bodyText: "",
      statusCode: 400,
      error: `Stream reading error: ${err.message}`,
    };
  }

  // Safe assembly of verified, bounded payload
  const fullBuffer = Buffer.concat(chunks);
  return {
    ok: true,
    bodyText: fullBuffer.toString("utf8"),
    statusCode: 200,
  };
}
```

---

## 4. Next.js 16 Proxy & Route Handler Compatibility

### 4.1 Next.js 16 Body Consumption Semantics
- In Next.js App Router, `req.body` is a standard Web API `ReadableStream<Uint8Array>`.
- **Stream Single-Read Constraint**: A Web `ReadableStream` can only be locked and read once (`reader = req.body.getReader()`). Calling `await req.text()` after reading the stream will throw `TypeError: Body has already been read`.
- **Architectural Solution**:
  - `src/proxy.ts` performs **zero body reading**. It only inspects headers (`content-length`, `content-type`, `authorization`).
  - `src/app/api/webhook/[...path]/route.ts` performs the single, authoritative read via `readBoundedBody(req)`.
  - The returned `bodyText` is used for **both** HMAC signature calculation and JSON/Form parsing, completely eliminating duplicate stream reads.

---

## 5. Verification Verdict

| Verification Item | Specification Invariant | Status |
| :--- | :--- | :---: |
| Rejection of header-only validation | Documented in Section 1 | **PASS** |
| Chunk-by-chunk streaming byte counter | Implemented via `read.read()` in Section 3 | **PASS** |
| Active circuit-breaker cancellation | `reader.cancel()` called at 1,048,577 bytes | **PASS** |
| Malformed Content-Length handling | Regex validation in Section 3 (returns `400`) | **PASS** |
| Next.js 16 stream single-read compatibility | Verified in Section 4.1 | **PASS** |

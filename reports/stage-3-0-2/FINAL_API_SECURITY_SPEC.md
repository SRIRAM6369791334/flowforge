# FlowForge — Stage 3.0.2: Final API Security Specification (Fail-Closed Architecture)

> **Document ID**: `STAGE-3-0-2-API-SEC-01`  
> **Status**: APPROVED TECHNICAL SPECIFICATION  
> **Target Implementation**: Phase 1 (`T1.5` / `DEF-SEC-03`)  
> **Target File**: `src/middleware.ts`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`

---

## 1. Executive Summary & Threat Model

FlowForge currently exposes 14 API routes in `src/app/api/` with **zero authentication middleware**. Prior designs evaluated allowing requests with missing `Origin` or `Sec-Fetch-Site` headers under the assumption of local loopback traffic. This was a critical security flaw: non-browser clients (such as `curl`, automated exploit scripts, malicious CLI tools, or malware running on the LAN) omit `Origin` and `Sec-Fetch-Site` by default.

This specification establishes a **fail-closed, defense-in-depth API protection architecture** implemented via Next.js Middleware (`src/middleware.ts`), strictly enforcing:
1. **Default-Deny Policy**: Any unauthenticated request to protected endpoints is rejected before executing route handlers.
2. **Deterministic Studio vs Programmatic Separation**: Browser Studio sessions and external programmatic clients are authenticated through distinct, tamper-resistant channels.
3. **Strict Origin & Host Binding**: Defends against Cross-Site Request Forgery (CSRF), Cross-Origin Information Leaks, and DNS Rebinding.
4. **Exact Route Matching**: Disallows fuzzy or unnormalized route exemptions, preventing internal API exposure.
5. **Cryptographic Webhook Signature Verification**: Verifies incoming webhooks using constant-time HMAC comparison.

---

## 2. Fail-Closed Authentication Matrix

### 2.1 Configuration State Handling

| Environment | `FLOWFORGE_API_KEY` Configured? | Client Type | Authentication Outcome | HTTP Status & Response |
| :--- | :--- | :--- | :--- | :--- |
| **Production** (`NODE_ENV === "production"`) | ❌ **Missing / Empty** | Any (Studio or Programmatic) | **FAIL-CLOSED (DENY)** | `500 Internal Server Error`<br>`{"error": "Security Configuration Error: FLOWFORGE_API_KEY must be set in production"}` |
| **Production** | ✅ **Set** | Programmatic | Validates `Bearer` / `x-api-key` | `200` (Valid) or `401 Unauthorized` |
| **Production** | ✅ **Set** | Browser Studio | Validates Origin + Studio Session/Header | `200` (Valid) or `403 Forbidden` |
| **Development** (`NODE_ENV !== "production"`) | ❌ **Missing / Empty** | Browser Studio (Loopback) | Allowed with `Warning` header | `200 OK` + Console Dev Warning |
| **Development** | ❌ **Missing / Empty** | External / Non-Loopback IP | **DENY** | `401 Unauthorized`<br>`{"error": "FLOWFORGE_API_KEY required for non-loopback requests"}` |
| **Development** | ✅ **Set** | Any | Enforces strict validation | Normal authentication rules apply |

> [!IMPORTANT]
> In production, missing security configuration **fails closed**. FlowForge will refuse to process protected API requests without an explicit `FLOWFORGE_API_KEY`.

---

## 3. Comprehensive Inventory of All 14 API Routes

Every API route handler currently present in `src/app/api/` has been verified directly against source code:

| # | Route File Path | Exported HTTP Methods | Source Lines | Security Classification | Allowed Intake Policy |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | `src/app/api/webhook/[...path]/route.ts` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | L78 | **Public Intake** | Verified path + optional HMAC signature (`x-hub-signature-256`, `x-signature`) |
| **2** | `src/app/api/forms/submit/route.ts` | `POST` | L12 | **Public Intake** | **POST ONLY**. Strict 405 Method Not Allowed on `GET`, `PUT`, `DELETE` |
| **3** | `src/app/api/ai-builder/route.ts` | `POST` | L11 | **Protected Internal** | Studio Session or API Key |
| **4** | `src/app/api/db/route.ts` | `GET`, `POST`, `DELETE` | L7, L18, L23 | **Protected Internal** | Studio Session or API Key (Direct DB Record Access) |
| **5** | `src/app/api/events/route.ts` | `GET` (SSE & Polling) | L4 | **Protected Internal** | Studio Session or API Key (Live Execution Stream) |
| **6** | `src/app/api/executions/route.ts` | `GET`, `DELETE` | L4, L20 | **Protected Internal** | Studio Session or API Key |
| **7** | `src/app/api/queue/route.ts` | `GET`, `POST` | L5, L14 | **Protected Internal** | Studio Session or API Key (Worker Queue Control) |
| **8** | `src/app/api/secrets/route.ts` | `GET`, `POST`, `DELETE` | L5, L11, L17 | **CRITICAL PROTECTED** | Studio Session or Master API Key (Credential Store) |
| **9** | `src/app/api/telegram/route.ts` | `GET`, `POST` | L4, L27 | **Protected Internal** | Studio Session or API Key (Bot Listener Lifecycle) |
| **10** | `src/app/api/workflows/route.ts` | `GET`, `POST` | L4, L9 | **Protected Internal** | Studio Session or API Key |
| **11** | `src/app/api/workflows/run-parallel/route.ts` | `POST` | L8 | **Protected Internal** | Studio Session or API Key (Concurrent Batch Executor) |
| **12** | `src/app/api/workflows/[id]/route.ts` | `GET`, `PUT`, `DELETE` | L5, L15, L26 | **Protected Internal** | Studio Session or API Key |
| **13** | `src/app/api/workflows/[id]/live/route.ts` | `GET` | L4 | **Protected Internal** | Studio Session or API Key |
| **14** | `src/app/api/workflows/[id]/run/route.ts` | `POST` | L8 | **Protected Internal** | Studio Session or API Key (Workflow Trigger) |

---

## 4. Browser Studio Request Authentication Rules

### 4.1 Rejection of Header-Absence Assumptions
- **Flawed Assumption**: "If `Origin` and `Sec-Fetch-Site` are missing, assume it is a local Studio request."
- **Vulnerability**: Non-browser CLI tools (`curl`, Python `requests`, malware) omit `Origin` and `Sec-Fetch-Site` by default. Under the flawed assumption, any external attacker script sending a raw HTTP request would bypass authentication entirely.
- **Enforced Rule**: A missing `Origin` or missing `Sec-Fetch-Site` **NEVER** grants Studio trust. Requests lacking browser-origin proof MUST provide valid API key credentials.

### 4.2 Strict Trusted-Origin Comparison Algorithm

When a request asserts browser Studio identity, its `Origin` header is parsed and compared:

```typescript
function isTrustedOrigin(originHeader: string | null, hostHeader: string | null, allowedOrigins: Set<string>): boolean {
  if (!originHeader) return false;

  // 1. Safe URL parsing — reject malformed URI strings, null strings, control chars
  let parsed: URL;
  try {
    parsed = new URL(originHeader);
  } catch {
    return false; // Malformed Origin syntax -> Immediate Rejection
  }

  // 2. Disallow insecure schemes in production
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    // Exception: loopback testing in isolated environments
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return false;
    }
  }

  // 3. Normalized origin string: protocol + "//" + host (includes port if non-default)
  const normalizedOrigin = `${parsed.protocol}//${parsed.host}`.toLowerCase();

  // 4. Exact match against host header (Same-Origin)
  if (hostHeader) {
    const hostWithHttp = `http://${hostHeader}`.toLowerCase();
    const hostWithHttps = `https://${hostHeader}`.toLowerCase();
    if (normalizedOrigin === hostWithHttp || normalizedOrigin === hostWithHttps) {
      return true;
    }
  }

  // 5. Configured allowed origins whitelist
  return allowedOrigins.has(normalizedOrigin);
}
```

### 4.3 Studio Custom Request Header / Session Validation
To prevent Cross-Site Scripting (XSS) from other origins and ensure browser requests originate from FlowForge's own UI:
- FlowForge Studio frontend (`src/app/page.tsx` and custom fetch wrapper) includes the header:
  `x-flowforge-studio: 1`
- Browser navigation requests (`Sec-Fetch-Dest: document`) are routed to the Next.js page renderer.
- Mutation and data API requests (`/api/*`) require:
  `isTrustedOrigin(origin, host, allowedOrigins) === true` **AND** `Sec-Fetch-Site === "same-origin"` **AND** `x-flowforge-studio === "1"`.
- Requests failing this check are treated as programmatic clients and must provide `FLOWFORGE_API_KEY`.

---

## 5. Programmatic Client Authentication

For external integrations, CI/CD pipelines, and automated runners:
1. **Supported Headers**:
   - `Authorization: Bearer <API_KEY>`
   - `x-api-key: <API_KEY>`
2. **Constant-Time Verification**:
   To prevent side-channel timing attacks, the token comparison uses `crypto.timingSafeEqual`:
   ```typescript
   function safeCompareKeys(provided: string, expected: string): boolean {
     const bufA = Buffer.from(provided, "utf8");
     const bufB = Buffer.from(expected, "utf8");
     if (bufA.length !== bufB.length) {
       // Return false but execute dummy timing to equalize execution time
       crypto.timingSafeEqual(bufA, bufA);
       return false;
     }
     return crypto.timingSafeEqual(bufA, bufB);
   }
   ```
3. **Failure Response**:
   HTTP `401 Unauthorized` with header `WWW-Authenticate: Bearer realm="FlowForge API"`.

---

## 6. Public Route Exemption & Anti-Bypass Guardrails

### 6.1 Exact Route Normalization & Matching

To prevent path traversal bypasses (e.g., `/api/webhook/../secrets` or `/api/forms/submit/../../db`):

```typescript
// Normalize URL pathname using POSIX semantics
const pathname = path.posix.normalize(request.nextUrl.pathname);

// Exact public route evaluation
const isPublicWebhook = pathname.startsWith("/api/webhook/") && pathname.length > "/api/webhook/".length;
const isPublicFormSubmit = pathname === "/api/forms/submit";
```

- **Prefix Traversal Protection**: Any path containing unnormalized `..` or `%2e%2e` is normalized before evaluation. If normalization attempts to escape `/api/`, Next.js automatically returns 400.
- **No Wildcard Leaks**: No other endpoints under `/api/` are granted public exemption.

### 6.2 HTTP Method Filtering on Public Endpoints
- `/api/forms/submit`:
  - Allowed: `POST` only.
  - Any `GET`, `PUT`, `DELETE`, `PATCH` request immediately receives `405 Method Not Allowed` with `Allow: POST`.
- `/api/webhook/[...path]`:
  - Allowed: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

---

## 7. Webhook Cryptographic Signature Verification

For `/api/webhook/[...path]`:
1. When a workflow's `webhook_trigger` node defines a `secret` parameter:
   - Middleware or route handler inspects signature headers:
     - `x-hub-signature-256` (GitHub, Gitea) format: `sha256=<hex_digest>`
     - `x-signature-256` / `x-signature` (Generic / Stripe / Shopify)
     - `x-flowforge-signature`
   - Computes expected HMAC:
     ```typescript
     const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
     const expectedHeader = `sha256=${hmac}`;
     const isValid = safeCompareKeys(providedHeader, expectedHeader) || safeCompareKeys(providedHeader, hmac);
     ```
   - If invalid: rejects immediately with `401 Unauthorized` (`{"error": "Invalid webhook signature"}`).
2. If no `secret` is configured:
   - Requires path entropy (path must not be trivial or easily guessable).

---

## 8. CORS & OPTIONS Preflight Handling

```typescript
export function handleCorsAndPreflight(req: Request, trustedOrigin: boolean): Response | null {
  if (req.method === "OPTIONS") {
    if (!trustedOrigin) {
      return new Response(null, { status: 403, statusText: "Forbidden Origin" });
    }
    const origin = req.headers.get("origin") ?? "";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-flowforge-studio",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return null;
}
```

---

## 9. Next.js Middleware Implementation Architecture (`src/middleware.ts`)

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/api/:path*"],
};

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1. Handle CORS Preflight
  // ... (Evaluates OPTIONS per Section 8)

  // 2. Check Public Route Exemptions
  // ... (Exact matching per Section 6)

  // 3. Evaluate Authentication
  // ... (Evaluates Studio Origin or Programmatic API Key per Sections 4 & 5)

  // 4. Deny / Allow
}
```

---

## 10. Verification Verdict

| Verification Item | Source Evidence | Status |
| :--- | :--- | :---: |
| All 14 API routes inventoried | `src/app/api/**/*.ts` inspect log | **PASS** |
| Fail-closed policy for production | Defined in Section 2.1 | **PASS** |
| Disallow missing Origin as trusted | Defined in Section 4.1 | **PASS** |
| Constant-time comparison | Defined in Section 5 | **PASS** |
| Exact public route matching | Defined in Section 6.1 | **PASS** |
| OPTIONS & CORS enforcement | Defined in Section 8 | **PASS** |

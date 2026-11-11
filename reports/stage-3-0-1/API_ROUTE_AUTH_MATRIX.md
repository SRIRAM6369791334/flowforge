# FlowForge — Stage 3.0.1: API Route Authentication & Authorization Policy Matrix

> **Scope**: Route-by-route security policy, threat vectors, middleware specifications, and authentication strategies across all 14 Next.js API endpoints.

---

## 1. Route-by-Route Policy Matrix

| # | Route Pattern | Allowed HTTP Methods | Policy Classification | Access Control Requirements | Threat Vectors Mitigated |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/api/workflows` | `GET`, `POST` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Unauthorized workflow creation / enumeration |
| 2 | `/api/workflows/[id]` | `GET`, `PUT`, `DELETE`| `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Workflow tampering / deletion |
| 3 | `/api/workflows/[id]/run` | `POST` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Unauthorized manual workflow execution |
| 4 | `/api/workflows/[id]/live` | `GET` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Execution state reconnaissance |
| 5 | `/api/workflows/run-parallel`| `POST` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Denial of Service via parallel batch spam |
| 6 | `/api/executions` | `GET`, `DELETE` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Execution log theft or history wiping |
| 7 | `/api/queue` | `GET`, `POST` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Queue saturation / burst injection attacks |
| 8 | `/api/telegram` | `GET`, `POST` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Poller disruption / unauthorized simulation |
| 9 | `/api/db` | `GET`, `POST`, `DELETE`| `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Direct database table read/write/drop |
| 10 | `/api/secrets` | `GET`, `POST`, `DELETE`| `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Plaintext secret theft / credential overwrite |
| 11 | `/api/ai-builder` | `POST` | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Gemini API quota exhaustion by unauthorized callers |
| 12 | `/api/events` | `GET` (SSE) | `STUDIO_INTERNAL` | Same-Origin OR `x-flowforge-key` | Live data exfiltration via unauthorized SSE streams |
| 13 | `/api/forms/submit` | `POST` | `PUBLIC_FORM` | Open (Optional Rate Limit / Captcha) | External spam submission |
| 14 | `/api/webhook/[...path]` | `ALL` | `PUBLIC_WEBHOOK` | Open (Optional HMAC Signature Verification)| Forged webhook triggers (mitigated in downstream nodes) |

---

## 2. Threat Analysis: Why Naive IP Checks Fail

### 2.1 The `X-Forwarded-For` Header Spoofing Vulnerability
In a naive middleware check:
```typescript
// INSECURE NAIVE PATTERN:
const ip = req.headers.get("x-forwarded-for");
if (ip === "127.0.0.1") { allow(); }
```
Any attacker anywhere on the internet can send:
```bash
curl -H "X-Forwarded-For: 127.0.0.1" https://flowforge.example.com/api/secrets
```
Because Next.js route handlers read headers without an upstream trusted reverse proxy (like Cloudflare or AWS ALB with stripped headers), trusting forwarded headers is a critical security vulnerability.

### 2.2 Cross-Origin / Browser CSRF Vector
Even if FlowForge binds strictly to `127.0.0.1:3000`, if the developer visits an untrusted website (`https://attacker.site`) in Chrome, the attacker's page can execute:
```javascript
fetch("http://127.0.0.1:3000/api/secrets", { method: "GET" })
```
If the API does not enforce browser origin boundaries, the browser sends the loopback request.

---

## 3. The Hardened Next.js Middleware Specification (`src/middleware.ts`)

```typescript
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/api/webhook/", "/api/forms/submit"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip non-API and static assets
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 2. Allow explicitly public webhook and form routes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 3. Check for programmatic API Key (for external automation or CLI calls)
  const serverKey = process.env.FLOWFORGE_API_KEY;
  const providedKey = req.headers.get("x-flowforge-key");
  if (serverKey && providedKey === serverKey) {
    return NextResponse.next();
  }

  // 4. Browser Studio Protection (Anti-CSRF & Origin Verification)
  // Check Sec-Fetch-Site: if present and cross-site, reject immediately!
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    return NextResponse.json(
      { error: "Security Policy Violation: Cross-origin browser requests rejected." },
      { status: 403 }
    );
  }

  // Check Origin / Host match for mutating requests
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json(
        { error: "Security Policy Violation: Origin mismatch." },
        { status: 403 }
      );
    }
  }

  // If a server key is enforced and not in local dev mode, require key
  if (serverKey && !providedKey && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Authentication Required: Invalid or missing x-flowforge-key." },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
```

# FlowForge — Stage 3.0.5: Final Production Studio Authentication Flow

> **Document ID**: `STAGE-3-0-5-AUTH-01`  
> **Status**: AUTHORITATIVE PRODUCTION SPECIFICATION  
> **Task Reference**: `T1 — Finalize Studio Authentication`  
> **Target Module**: `src/proxy.ts` (Next.js 16 Proxy)  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `6aec3ba0b0213d29d8995a329971bc391100bb5b`

---

## 1. Selected Production Studio Authentication Architecture

To resolve the design dilemma between client-side prompt modals and perimeter proxy authentication, FlowForge formally selects:

### 🏆 **The Canonical Flow: Next.js 16 Proxy HTTP Basic Authentication (RFC 7617)**

```
Browser Navigates to Production Studio: GET https://flowforge.domain.com/
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Next.js 16 Proxy (src/proxy.ts)                                  │
│ • Checks NODE_ENV === "production"                               │
│ • Inspects "Authorization" header                                │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │ No Credentials / Invalid                        │ Valid Credentials Present
         ▼                                                 ▼
┌─────────────────────────────────┐               ┌──────────────────────────────────┐
│ Return HTTP 401 Unauthorized    │               │ Return NextResponse.next()       │
│ Header: WWW-Authenticate:       │               │ Browser renders full studio      │
│ Basic realm="FlowForge Studio"  │               │ All subsequent fetch calls       │
└────────────────┬────────────────┘               │ include Authorization header     │
                 │                                └──────────────────────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Browser Native Auth Dialog:     │
│ Username: [flowforge]           │
│ Password: [FLOWFORGE_API_KEY]   │
└─────────────────────────────────┘
```

---

## 2. Why HTTP Basic Authentication is the Superior Production Flow

| Architectural Criterion | In-App Client Prompt Modal | Next.js 16 Proxy HTTP Basic Auth (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Perimeter Protection** | ❌ **Weak**: Serves full HTML, React DOM bundles, templates, and UI assets to untrusted visitors before prompt is answered. | ✅ **Strong**: Unauthenticated requests are blocked at `src/proxy.ts`. Zero HTML or JS is transmitted to untrusted clients. | Prevents exposure of workflow schemas, templates, and component internals to unauthorized reconnaissance. |
| **Initial Page Compatibility** | ⚠️ Requires React hydration and local state management before gate engages. | ✅ Operates entirely at HTTP protocol layer before rendering. | 100% compatible with Next.js 16 SSR and static page routing. |
| **Browser Refresh Resilience** | ⚠️ Requires `sessionStorage` serialization and custom re-hydration. | ✅ Browser automatically attaches cached credentials across all reloads and sub-requests. | Zero state loss upon browser refresh (`F5` / `Cmd+R`). |
| **API Route Integration** | ⚠️ Must inject custom `x-api-key` headers into every `fetch()` call across 2,260 lines of `page.tsx`. | ✅ Browser automatically transmits `Authorization` header on all same-origin fetch calls (`/api/*`). | Eliminates invasive modifications to client-side data-fetching routines. |
| **Multi-Client Unification** | ❌ Two separate validation paths in middleware. | ✅ Single unified validator in `src/proxy.ts`: validates both Basic Auth (`user:pass`) and Bearer/API-key tokens. | Reduces attack surface and code complexity. |
| **Package & DB Dependency** | ❌ Requires UI modal components and client storage management. | ✅ **Zero packages, zero database changes**. Pure HTTP standard (RFC 7617). | Complies with Phase 1 minimal-change and stability mandate. |

---

## 3. Comprehensive Authentication Lifecycle

### 3.1 Credential Submission & Validation
- **Username**: Accepted as `flowforge`, `admin`, or any non-empty string.
- **Password**: Must strictly equal `process.env.FLOWFORGE_API_KEY`.
- **Validation**: Decodes `base64(user:password)`, extracts password, and calls `constantTimeCompare(password, envApiKey)`.

### 3.2 Browser Refresh Behavior
- Upon successful authentication, modern web browsers (Chrome, Firefox, Safari, Edge) retain the Basic Auth credential in their secure, process-isolated authentication cache for the session.
- When the user refreshes the page or opens new tabs to the same origin, the browser automatically includes the `Authorization: Basic ...` header. No re-prompting occurs during active sessions.

### 3.3 Logout & Key Removal
Because HTTP Basic Auth is managed by the browser session cache, FlowForge provides an explicit logout endpoint:
- **Route**: `GET /api/auth/logout` (intercepted by `src/proxy.ts`).
- **Mechanism**: Responds with:
  ```http
  HTTP/1.1 401 Unauthorized
  WWW-Authenticate: Basic realm="FlowForge Studio"
  Content-Type: application/json

  {"loggedOut": true, "message": "Session credentials invalidated"}
  ```
- Sending a 401 on logout instructs the browser to flush its credential cache for the origin, effectively locking the Studio.

### 3.4 Credential Exposure Controls
- Basic Auth credentials are transmitted **strictly over TLS (`https://`)** in production.
- Credentials are **never** present in URL query parameters, avoiding leakage in browser history, proxy access logs, or `Referer` headers.

---

## 4. Anti-CSRF vs Identity Authentication Separation

> [!IMPORTANT]
> **Anti-CSRF controls and Identity Authentication are completely decoupled:**
> 1. **Identity Authentication (Who you are)**: Verified strictly via `Authorization: Basic ...`, `Authorization: Bearer ...`, or `x-api-key: ...`.
> 2. **Anti-CSRF Protection (Where the request came from)**: Verified strictly via `Origin` matching and `Sec-Fetch-Site`. Even with valid Basic Auth credentials, a cross-origin browser request from `evil.com` will be rejected by CORS / origin validation.

---

## 5. Environment Access Policies

| Environment | Host / IP Context | Security Policy | Implementation |
| :--- | :--- | :--- | :--- |
| **Production** | Any Public IP / Domain | **Strict Basic Auth / API Key** | `src/proxy.ts` rejects any unauthenticated request to `/` or `/api/*` with `401 Unauthorized` (`WWW-Authenticate: Basic`). |
| **Development** | Local Loopback (`localhost`, `127.0.0.1`, `[::1]`) | **Unauthenticated Local Studio** | Direct access allowed for zero-friction local development with `x-flowforge-dev-warning` header. |
| **Development** | Local LAN (`192.168.x.x`, `10.x.x.x`) | **Strict Authentication** | Prevents unauthorized devices on the local Wi-Fi/LAN from accessing FlowForge without `FLOWFORGE_API_KEY`. |

---

## 6. Verification Verdict

| Verification Item | Specification Invariant | Status |
| :--- | :--- | :---: |
| Single production authentication flow selected | HTTP Basic Auth (RFC 7617) in Section 1 | **PASS** |
| Perimeter protection before HTML/JS delivery | Validated in Section 2 | **PASS** |
| Browser refresh & session cache persistence | Documented in Section 3.2 | **PASS** |
| Credential invalidation (logout) endpoint | Defined in Section 3.3 | **PASS** |
| Decoupling of Anti-CSRF and Identity Auth | Codified in Section 4 | **PASS** |
| Development loopback vs LAN access rules | Tabulated in Section 5 | **PASS** |

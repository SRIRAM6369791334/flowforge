# FlowForge — Stage 3.0.4: Production Studio Authentication Contract & Scope Reconciliation

> **Document ID**: `STAGE-3-0-4-AUTH-01`  
> **Status**: APPROVED SECURITY ARCHITECTURE REPORT  
> **Task Reference**: `T1 — Production Studio Authentication`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `dc91684784a867f08b350616b3f7177651a2491a`

---

## 1. Physical Source Code Audit for Authentication Mechanisms

A comprehensive regex scan across all TypeScript source files (`src/**/*.ts`, `src/**/*.tsx`) was executed:
```powershell
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "cookie|session|login|password"
```

### 1.1 Factual Audit Findings
1. **Zero Session Management**: No session creation, session lookup, session tables, or session storage exists anywhere in FlowForge.
2. **Zero User Concept**: No user database, user records, username/password pairs, or identity structures exist in `src/lib/store.ts` or `data/db.json`.
3. **Zero Authentication Routes**: No `/api/auth/*`, `/api/login`, or `/api/session` routes exist in `src/app/api/`.
4. **Zero Cookie Handling**: Neither `cookies()` from `next/headers` nor manual `Set-Cookie` headers are used anywhere in the application.
5. **Occurrences of "session" / "password" in Source**:
   - `src/lib/executors.ts:645`: Refers to Stripe Checkout sessions (`https://api.stripe.com/v1/checkout/sessions`).
   - `src/lib/nodes.ts:344`: Refers to WhatsApp 24-hour customer messaging sessions.
   - `src/lib/nodes.ts:377` & `src/lib/store.ts:55`: Refers to Gmail SMTP App Password (`GMAIL_APP_PASSWORD`).
   - `src/app/page.tsx:2201`: Refers to an HTML `<input type="password">` field in the modal where users paste their Gmail App Password into the local store.

---

## 2. Analysis of "Signed HttpOnly Session Cookies"

In Stage 3.0.2 and 3.0.3 reports, it was claimed that in production, Studio users would authenticate via *"cryptographically signed, HttpOnly session cookies issued, validated, expired, and invalidated"*.

### 2.1 The Engineering Prerequisites of Session Cookies
To genuinely implement signed HttpOnly cookie sessions, the application would require:
1. **Session Lifecycle Store**: A persistent session table in `src/lib/store.ts` storing `sessionId`, `userId`, `createdAt`, `expiresAt`, `ipHash`, and `userAgentHash`.
2. **Cryptographic Signing Engine**: An HMAC signing utility (e.g. `cookie-signature` or `crypto.createHmac`) with a dedicated `SESSION_SECRET` key to detect cookie tampering.
3. **Session Issuance & Invalidation Routes**:
   - `POST /api/auth/login`: Authenticates credentials and sets `Set-Cookie: ff_session=<signed_token>; HttpOnly; Secure; SameSite=Lax; Path=/`.
   - `POST /api/auth/logout`: Clears cookie (`Max-Age=0`) and removes session from store.
4. **Login UI & State Guard**: A dedicated login view (`src/app/login/page.tsx` or modal dialog), redirect logic in middleware/proxy, and client authentication context in `src/app/page.tsx`.

---

## 3. Can the 4-File Phase 1 Scope Implement Session Cookies?

**NO.**

Phase 1 is strictly scoped as **"Stability & Security Hardening"**:
- `src/lib/executors.ts` (Dynamic date grounding, exec killswitch, filesystem jail)
- `src/app/page.tsx` (SSE EventSource canvas listener)
- `src/proxy.ts` (Next.js 16 API Proxy)
- `tests/phase1-security.test.mjs` (Automated regression suite)

Attempting to implement a full user-login, session-database, and cookie-management subsystem within Phase 1 would:
1. Expand the file scope into `src/lib/store.ts`, `data/db.json`, `src/app/layout.tsx`, and new auth API routes.
2. Introduce significant architectural risk and state regression in a phase meant to stabilize existing features.
3. Violate the zero-dependency, minimal-blast-radius mandate.

---

## 4. Reconciled Production Studio Authentication Contract

### 4.1 Strict Anti-CSRF vs Authentication Distinction
> [!IMPORTANT]
> **HTTP `Origin`, `Sec-Fetch-Site`, and `x-flowforge-studio` headers are strictly Anti-CSRF browser controls. They are NEVER treated as user identity or authentication.**  
> An attacker using CLI tools or non-browser scripts can forge these headers at will.

### 4.2 Reconciled Phase 1 Policy for Production vs Development

| Environment | Client Type | Authentication Gate | Implementation Mechanism in Phase 1 |
| :--- | :--- | :--- | :--- |
| **Production** (`NODE_ENV === "production"`) | Programmatic API (`/api/*`) | `FLOWFORGE_API_KEY` | `Authorization: Bearer <key>` or `x-api-key: <key>` verified via constant-time compare in `src/proxy.ts`. |
| **Production** | Browser Studio UI (`/`, `/api/*`) | `FLOWFORGE_API_KEY` | **Option A (Standard)**: HTTP Basic Authentication challenge (`WWW-Authenticate: Basic realm="FlowForge Studio"`) enforced by `src/proxy.ts` using `FLOWFORGE_API_KEY`.<br>**Option B**: Key prompt modal in Studio UI storing key in `sessionStorage` and transmitting via `x-api-key`. |
| **Development** (`NODE_ENV !== "production"`) | Localhost Studio (`127.0.0.1`, `::1`) | Anti-CSRF + Dev Flag | `Origin` equality + `Sec-Fetch-Site: same-origin` + `x-flowforge-studio: 1` allowed with `x-flowforge-dev-warning` header. |
| **Development** | Network / LAN Access (`192.168.x.x`) | `FLOWFORGE_API_KEY` | Strictly requires `FLOWFORGE_API_KEY` even in dev mode to prevent unauthenticated Wi-Fi / LAN tampering. |

### 4.3 Roadmap Placement of Full Session Cookie Subsystem
The full multi-user database, salted password hashing, and signed HttpOnly session cookie lifecycle is formally placed where it belongs in the architecture:
- **Roadmap Task**: `T3.6` (Phase 3: Database Persistence & Session Architecture).

---

## 5. Verification Verdict

| Audit Item | Evidence & Verification | Status |
| :--- | :--- | :---: |
| Physical audit of existing session/cookie code | Regex search confirmed 0 session mechanisms in `src/` | **PASS (VERIFIED EMPTY)** |
| Elimination of false "session cookie exists" claims | Explicitly corrected in Section 2 | **PASS** |
| Phase 1 scope reconciliation | Basic Auth / API Key challenge adopted for Prod Studio in Section 4.2 | **PASS** |
| Anti-CSRF vs Auth distinction | Formally codified in Section 4.1 | **PASS** |
| Deferral of multi-user cookie session system | Assigned to Phase 3 (`T3.6`) in Section 4.3 | **PASS** |

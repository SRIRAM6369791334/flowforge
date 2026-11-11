# FlowForge — Stage 3.0.4: Final Webhook Security Scope & Architectural Distribution

> **Document ID**: `STAGE-3-0-4-WEBHOOK-02`  
> **Status**: APPROVED ARCHITECTURE & SCOPE SPECIFICATION  
> **Task Reference**: `T2 — Webhook Security Scope`  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `dc91684784a867f08b350616b3f7177651a2491a`

---

## 1. Source Code Inspection of Webhook Subsystem

Direct source inspection was conducted on the two webhook-related files in the repository:
1. `src/app/api/webhook/[...path]/route.ts` (78 LOC): Webhook HTTP ingress handler.
2. `src/lib/executors.ts:134–137`: Webhook trigger executor definition (`webhook_trigger: { mode: "all", run: async (_p, _i, rc) => [{ json: rc.trigger }] }`).

### 1.1 Findings in Current Baseline
- **L25 of `route.ts`**: `const rawBody = method === "GET" || method === "HEAD" ? "" : await req.text();`  
  Buffers the entire HTTP request body into memory without inspecting `content-length` or streaming limits.
- **L11–20 of `route.ts`**: Finds matching active workflow by path string and method. If found, forwards `triggerData` directly into `enqueueWorkflowRun`.
- **Zero Signature Checking**: Neither HMAC nor token verification is performed.
- **Zero Rate Limiting**: The route can be called without concurrency or rate restrictions.

---

## 2. Architectural Distribution of Webhook Security Controls

The required webhook security controls operate at two fundamentally different architectural layers: the **Proxy Layer** (before route dispatch) and the **Route Handler Layer** (after workflow matching).

```
Incoming Request: POST /api/webhook/github-events
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Next.js 16 Proxy (src/proxy.ts)                     │
│ 1. 1 MB Streaming Body Limit (inspects Content-Length)      │
│ 2. Sliding-Window Rate Limiting (60 req/min per IP/path)    │
│ 3. URL Traversal Normalization                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Allowed)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Webhook Route Handler (src/app/api/webhook/...)   │
│ 1. Workflow Lookup (matches path -> retrieves node.params)  │
│ 2. Raw-Body HMAC-SHA256 Verification (GitHub / Generic)     │
│ 3. Stripe Signature Verification (t=<ts>, v1=<hash>)        │
│ 4. Timestamp & Replay Drift Check (max 300s window)         │
│ 5. Privileged Node Guard (blocks exec/write_file if unsigned)│
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Controls Allocated to `src/proxy.ts` (Next.js 16 Proxy)
- **1 MB Body Limit Enforcement**:
  - `src/proxy.ts` inspects `req.headers.get("content-length")`.
  - If `contentLength > 1048576` (1 MB), `src/proxy.ts` immediately aborts the connection and returns HTTP `413 Payload Too Large` without passing the payload into Node.js memory.
- **Sliding-Window Rate Limiting**:
  - An in-memory rate limiter tracks requests per client IP and path.
  - If threshold (60 requests/minute) is exceeded, returns HTTP `429 Too Many Requests` with `Retry-After: 60`.

### 2.2 Controls Allocated to `src/app/api/webhook/[...path]/route.ts` (Route Handler)
Because webhook secrets and node configurations are workflow-specific, the following controls **must be executed inside the route handler**:
- **Raw-Body HMAC-SHA256 Verification**:
  - Evaluated after `match = workflows.list()...` resolves the target node.
  - If `match.node.params.secret` is set: computes HMAC-SHA256 over `rawBody` and compares against `x-hub-signature-256` or `x-signature` using constant-time comparison.
- **Stripe Signature Parsing**:
  - Parses `t=<timestamp>,v1=<hash>` from `stripe-signature` header and validates against `match.node.params.secret`.
- **Replay Protection Window**:
  - Rejects requests where $|T_{now} - T_{webhook}| > 300\text{ seconds}$.
- **Privileged Node Restriction on Unsigned Webhooks**:
  - If `match.node.params.secret` is not set, inspects downstream nodes in `match.wf.nodes`.
  - If any downstream node is `exec`, `write_file`, or mutating `db_query`, execution is blocked unless `match.node.params.allowUnauthenticatedPrivilegedExecution === true`.

---

## 3. Reconciliation with Phase 1 Target File Inventory

### 3.1 The Scope Decision
- **Option A (Strict 4-File Phase 1 Scope)**:
  - Phase 1 implements Layer 1 controls (1 MB body limit and rate limiting) inside `src/proxy.ts`.
  - Layer 2 controls (HMAC verification and privileged node gates in `route.ts`) are scheduled for **Phase 2 (Integration & Webhook Hardening / Task T2.7 / DEF-SEC-05)**.
- **Option B (End-to-End 5-File Phase 1 Scope)**:
  - Phase 1 modifies `src/app/api/webhook/[...path]/route.ts` immediately alongside `src/proxy.ts`, delivering both Layer 1 and Layer 2 defenses in Phase 1.

### 3.2 Authoritative Scope Governance
To eliminate ambiguity:
- **Decision**: To guarantee complete security closure for webhooks in Phase 1 without deferred vulnerability windows, **Option B is formally adopted**.
- `src/app/api/webhook/[...path]/route.ts` is officially registered as a target file for Phase 1.
- The Phase 1 file inventory is updated from 4 to **5 files** (3 existing modified + 2 newly created).

---

## 4. Current Status: Specification vs Implementation

> [!CAUTION]
> **Strict Reality Check**: None of these webhook security controls are currently present in the codebase.  
> They exist **ONLY AS SPECIFICATIONS**. Application source code in `src/app/api/webhook/[...path]/route.ts` remains in its original unhardened baseline state until Stage 3.1 is authorized.

---

## 5. Verification Verdict

| Audit Item | Architectural Analysis | Status |
| :--- | :--- | :---: |
| Baseline code inspection of `route.ts` | Confirmed unbuffered `req.text()` at L25 | **PASS** |
| Layer 1 vs Layer 2 control distribution | Formally mapped in Section 2 | **PASS** |
| Phase 1 file scope reconciliation | Formally expanded to include `route.ts` in Section 3.2 | **PASS** |
| Reality disclaimer on specification vs code | Explicitly recorded in Section 4 | **PASS** |

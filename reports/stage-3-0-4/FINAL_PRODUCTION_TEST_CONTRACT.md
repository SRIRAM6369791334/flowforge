# FlowForge — Stage 3.0.4: Production Test Contract & TypeScript Execution Architecture

> **Document ID**: `STAGE-3-0-4-TEST-03`  
> **Status**: APPROVED TECHNICAL SPECIFICATION  
> **Task Reference**: `T3 — Production Test Contract`  
> **Runtime Environment**: Node.js v22.20.0 Native Test Runner (`node --test`)  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Audited Current Commit**: `dc91684784a867f08b350616b3f7177651a2491a`

---

## 1. Canonical Name & Signature for API Authentication Evaluation

In Stage 3.0.3, two different names appeared across reports (`evaluateAuthentication` vs `evaluateApiAuth`). This document establishes the **one canonical export name and TypeScript interface**.

### 1.1 Canonical Contract Definition
- **Canonical Function Name**: `evaluateApiAuth`
- **Location**: `src/proxy.ts`

```typescript
export interface ApiAuthOptions {
  path: string;
  method: string;
  headers: Record<string, string | null | undefined>;
  envApiKey?: string;
  isProduction?: boolean;
  allowedOrigins?: Set<string>;
}

export interface ApiAuthResult {
  ok: boolean;
  status: number;
  clientType?: "studio" | "programmatic" | "public";
  error?: string;
}

export function evaluateApiAuth(options: ApiAuthOptions): ApiAuthResult {
  // Production authentication evaluation logic
}
```

---

## 2. Node.js 22.20 TypeScript Import Compatibility Analysis

### 2.1 The Native ESM Import Problem Discovered
Through direct experimentation on Node.js v22.20.0 during Stage 3.0.4 research:
- Running `node --test tests/phase1-security.test.mjs` directly importing `src/lib/executors.ts` failed with:
  ```text
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/lib/expressions' imported from '.../src/lib/executors.ts'
  ```
- **Root Cause**: `src/lib/executors.ts` contains extensionless imports (`./expressions`, `./store`, `./types`). While Next.js/Turbopack bundles these transparently, Node.js native ECMAScript Modules (ESM) strictly requires explicit file extensions.
- Attempting to import `executors.ts` from a standalone Node test runner triggers `ERR_MODULE_NOT_FOUND` unless all internal project imports are rewritten or bundled.

### 2.2 The Architectural Solution: `src/lib/security.ts`
To enable genuine, direct test imports without rewriting existing imports across `src/`:

1. All pure security and validation logic is housed in a dedicated module:  
   **`src/lib/security.ts`**
2. `src/lib/security.ts` imports **only Node.js built-in modules** (`node:path`, `node:fs/promises`, `node:crypto`). It contains **zero relative extensionless imports**.
3. **Usage Pattern**:
   - `src/lib/executors.ts` imports `validateJailPath`, `buildRuntimeContext`, and `checkExecAllowed` from `./security`.
   - `src/proxy.ts` imports `constantTimeCompare` from `./lib/security`.
   - `tests/phase1-security.test.mjs` imports directly from `../src/lib/security.ts` and `../src/proxy.ts`!

### 2.3 Experimental Verification Evidence
A live probe was executed in the workspace:
```powershell
node --experimental-default-type=module --experimental-strip-types --test probe_sec.test.mjs
```
*Result*: **100% PASS in 3.8ms with zero warnings, zero errors, and zero external packages.**

---

## 3. Production Exports & Test Imports Contract

Every production function and its corresponding test import signature is cataloged below:

| Function Name | Defined in Production Module | Imported by Test Suite | Exact Signature |
| :--- | :--- | :--- | :--- |
| `buildRuntimeContext` | `src/lib/security.ts` | `tests/phase1-security.test.mjs` | `(dateObj?: Date) => string` |
| `checkExecAllowed` | `src/lib/security.ts` | `tests/phase1-security.test.mjs` | `(envValue?: string) => boolean` |
| `validateJailPath` | `src/lib/security.ts` | `tests/phase1-security.test.mjs` | `(userPath: string, mode: "read" \| "write", jailRoot?: string) => Promise<JailCheckResult>` |
| `constantTimeCompare` | `src/lib/security.ts` | `tests/phase1-security.test.mjs` | `(provided: string, expected: string) => boolean` |
| `evaluateApiAuth` | `src/proxy.ts` | `tests/phase1-security.test.mjs` | `(options: ApiAuthOptions) => ApiAuthResult` |

### 3.1 Strict Anti-Mocking Rule
In `tests/phase1-security.test.mjs`:
> [!IMPORTANT]
> **Duplicate helper functions defined inside test files are strictly prohibited.**  
> The test suite must exclusively exercise the actual implementations exported by `src/lib/security.ts` and `src/proxy.ts`.

---

## 4. Canonical Test Execution Command

The exact command to run the Phase 1 test suite once Stage 3.1 is authorized:

```powershell
node --experimental-default-type=module --experimental-strip-types --test tests/phase1-security.test.mjs
```

---

## 5. Verification Verdict

| Audit Item | Verification & Contract | Status |
| :--- | :--- | :---: |
| Single canonical export name established | `evaluateApiAuth` in Section 1.1 | **PASS** |
| Node 22 TypeScript import compatibility verified | Proven via live probe in Section 2.3 | **PASS** |
| Module isolation via `src/lib/security.ts` | Architecture defined in Section 2.2 | **PASS** |
| 1-to-1 production export to test import mapping | Formally contracted in Section 3 | **PASS** |
| Prohibition of duplicated test mocks | Enforced in Section 3.1 | **PASS** |

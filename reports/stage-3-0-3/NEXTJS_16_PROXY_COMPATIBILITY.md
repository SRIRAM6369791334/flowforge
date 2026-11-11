# FlowForge — Stage 3.0.3: Next.js 16 Proxy Convention & Architecture Compatibility

> **Document ID**: `STAGE-3-0-3-NEXTJS16-01`  
> **Status**: VERIFIED ARCHITECTURAL SPECIFICATION  
> **Installed Framework**: Next.js 16.4.6, React 19.3.0, TypeScript 5.x  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`  
> **Current Commit**: `d097365445ea64e7fe65839b2ae8ae842245b736`

---

## 1. Executive Summary & Source Code Verification

In Stage 3.0.1 and Stage 3.0.2, the proposed file for intercepting and authenticating API routes was specified as `src/middleware.ts`.

A direct inspection of the installed `next` package at version `16.4.6` (`node_modules/next/dist/build/index.js` lines 713–731 and `node_modules/next/dist/build/analysis/get-page-static-info.js` lines 264–335) revealed a critical architectural finding:

> [!WARNING]
> **Next.js 16 has officially deprecated the `middleware` file convention in favor of `proxy`.**  
> Direct evidence from `node_modules/next/dist/build/index.js`:
> ```javascript
> if (middlewareFilePath) {
>   if (proxyFilePath) {
>     throw new Error(
>       `Both ${MIDDLEWARE_FILENAME} file "./${path.relative(cwd, absoluteMiddlewarePath)}" and ${PROXY_FILENAME} file "./${path.relative(cwd, absoluteProxyPath)}" are detected. Please use "./${path.relative(cwd, absoluteProxyPath)}" only. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy`
>     );
>   }
>   _log.warnOnce(
>     `The "${MIDDLEWARE_FILENAME}" file convention is deprecated. Please use "${PROXY_FILENAME}" instead.\n\n` +
>     `  To migrate automatically, run:\n` +
>     `  npx @next/codemod@canary middleware-to-proxy .\n\n` +
>     `  Learn more: https://nextjs.org/docs/messages/middleware-to-proxy`
>   );
> }
> ```

---

## 2. Comparison: `src/middleware.ts` vs `src/proxy.ts`

| Architectural Dimension | Legacy `src/middleware.ts` | Next.js 16 `src/proxy.ts` | FlowForge Architectural Impact |
| :--- | :--- | :--- | :--- |
| **Status in Next.js 16.4.6** | ⚠️ **Deprecated** (Triggers build warning) | ✅ **Official Standard Convention** | Adopting `proxy.ts` future-proofs the codebase and eliminates build warnings. |
| **Execution Runtime** | Defaults to Edge runtime | **Node.js Server Runtime** (`SERVER_RUNTIME.nodejs`) | **Major Win**: Full access to native `node:crypto`, `node:fs`, `node:path`, and Node.js stream APIs without Edge runtime polyfills or restrictions. |
| **Export Requirement** | `export function middleware(req)` or `export default` | `export function proxy(req)` or `export default` | Clean, explicit function naming. |
| **Route Segment Config** | Allowed `runtime = 'edge'` | **Disallowed** (Proxy always runs on Node.js runtime) | Setting `runtime = 'edge'` in `proxy.ts` throws an error (`get-page-static-info.js:600`). |
| **Matcher Config** | `export const config = { matcher: [...] }` | `export const config = { matcher: [...] }` | Identical routing matcher semantics. |
| **Conflict Handling** | If `proxy.ts` also exists, build crashes | If `middleware.ts` also exists, build crashes | Only one convention file may exist. |

---

## 3. Authoritative Specification for `src/proxy.ts`

To comply with Next.js 16.4.6 conventions, FlowForge Phase 1 Task `T1.5` will create **`src/proxy.ts`** (not `src/middleware.ts`).

### 3.1 Filename & Location
- **Path**: `src/proxy.ts` (located inside `src/` at convention level, alongside `src/app/` and `src/lib/`).

### 3.2 Export Signature & Structure
```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 1. Route Matcher: Intercepts all API routes
export const config = {
  matcher: ["/api/:path*"],
};

// 2. Exported Handler: Must be named "proxy" or "default"
export async function proxy(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname;

  // OPTIONS Preflight handling
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  // Public Route Exemption
  if (isPublicRoute(pathname, req.method)) {
    return NextResponse.next();
  }

  // Authentication Evaluation (Fail-Closed)
  const authResult = evaluateAuthentication(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  return NextResponse.next();
}
```

### 3.3 Testable Helper Export
To allow the automated test suite (`tests/phase1-security.test.mjs`) to test the actual production authentication logic directly, `src/proxy.ts` will export its core decision functions:
```typescript
export interface AuthEvaluationResult {
  ok: boolean;
  status: number;
  error?: string;
  clientType?: "studio" | "programmatic" | "public";
}

export function evaluateAuthentication(req: Request | NextRequest): AuthEvaluationResult {
  // Pure evaluation function tested by regression suite
}

export function isPublicRoute(pathname: string, method: string): boolean {
  // Pure route normalization and matching tested by regression suite
}
```

---

## 4. Verification Verdict

| Verification Item | Source Evidence in Next.js 16.4.6 | Verdict |
| :--- | :--- | :---: |
| `middleware` deprecation verified | `node_modules/next/dist/build/index.js:730` | **PASS** |
| `proxy` convention verified | `node_modules/next/dist/build/index.js:716` | **PASS** |
| Node.js runtime enforcement | `node_modules/next/dist/build/analysis/get-page-static-info.js:600` | **PASS** |
| Matcher compatibility | `node_modules/next/dist/build/analysis/get-page-static-info.js:348` | **PASS** |
| Target file updated from `middleware.ts` to `proxy.ts` | Formally specified in Section 3 | **PASS** |

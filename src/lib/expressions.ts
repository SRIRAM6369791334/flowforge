import vm from "node:vm";
import type { FieldDef, Item } from "./types";

export interface ExprContext {
  $json: Record<string, unknown>;
  $input: Item[];
  $node: Record<string, { json: Record<string, unknown>; items: Item[] }>;
  $secrets: Record<string, string>;
  $execution: { id: string; mode: string };
}

const EXPR = /\{\{([\s\S]+?)\}\}/g;
const SOLE_EXPR = /^\s*\{\{([\s\S]+?)\}\}\s*$/;

function evalExpr(code: string, ctx: ExprContext): unknown {
  const sandbox = {
    ...ctx,
    $now: new Date(),
    $today: new Date().toISOString().slice(0, 10),
    $todayDate: new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    $todayTime: new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    }),
    JSON,
    Math,
    Date,
    Number,
    String,
    Object,
    Array,
    encodeURIComponent,
    decodeURIComponent,
  };
  try {
    return vm.runInNewContext(`(${code})`, sandbox, { timeout: 1000 });
  } catch (e) {
    throw new Error(`Expression {{${code}}} failed: ${(e as Error).message}`);
  }
}

/** Resolve `{{ expr }}` in a string. A string that is exactly one expression keeps the raw value type. */
export function resolveString(str: string, ctx: ExprContext, jsonEscape = false): unknown {
  const sole = str.match(SOLE_EXPR);
  if (sole && !jsonEscape) return evalExpr(sole[1], ctx);
  return str.replace(EXPR, (_, code: string) => {
    const v = evalExpr(code, ctx);
    if (v === undefined || v === null) return "";
    if (jsonEscape) {
      // Inside a JSON template: strings are escaped to be quote-safe, everything else is serialised.
      return typeof v === "string" ? JSON.stringify(v).slice(1, -1) : JSON.stringify(v);
    }
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

export function resolveParams(params: Record<string, unknown>, fields: FieldDef[], ctx: ExprContext) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = params[f.key] ?? f.default;
    if (f.type === "code") {
      out[f.key] = raw; // code is executed, not templated
    } else if (f.type === "json") {
      const s = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
      if (!s.trim()) {
        out[f.key] = undefined;
        continue;
      }
      const sole = s.match(SOLE_EXPR);
      if (sole) {
        out[f.key] = evalExpr(sole[1], ctx);
        continue;
      }
      const resolved = resolveString(s, ctx, true) as string;
      try {
        out[f.key] = JSON.parse(resolved);
      } catch {
        throw new Error(`Field "${f.label}" is not valid JSON after expressions: ${resolved.slice(0, 200)}`);
      }
    } else if (typeof raw === "string") {
      const v = resolveString(raw, ctx);
      out[f.key] = f.type === "number" ? Number(v) : v;
    } else {
      out[f.key] = raw;
    }
  }
  return out;
}

export function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), obj);
}

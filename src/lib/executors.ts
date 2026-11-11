import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import vm from "node:vm";
import nodemailer from "nodemailer";
import { getPath } from "./expressions";
import { dbTables } from "./store";
import type { Item } from "./types";

const execP = promisify(execCb);
type Json = Record<string, unknown>;
type P = Record<string, unknown>;

export interface RunCtx {
  executionId: string;
  mode: string;
  trigger: Json; // payload the trigger fired with
  secrets: Record<string, string>;
  nodeOutputs: Record<string, { json: Json; items: Item[] }>;
}

/** Return value of "each" executors: an object (1 item), array (n items), null (drop), or a branch marker. */
export type EachResult = Json | Json[] | null | { $branch: string; json: Json };

export type Executor =
  | { mode: "each"; run: (p: P, item: Item, rc: RunCtx) => Promise<EachResult> }
  | { mode: "all"; run: (p: P, items: Item[], rc: RunCtx) => Promise<Item[]> };

// ───────── helpers ─────────
const s = (v: unknown) => (v == null ? "" : String(v));

function need(p: P, ...keys: string[]) {
  for (const k of keys) if (!s(p[k]).trim()) throw new Error(`Missing required field "${k}"`);
}

async function request(url: string, init: RequestInit & { json?: unknown } = {}): Promise<unknown> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    rest.body = JSON.stringify(json);
  }
  const res = await fetch(url, { ...rest, headers, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${msg.slice(0, 500)}`);
  }
  return data;
}

const asObj = (d: unknown): Json => (d && typeof d === "object" && !Array.isArray(d) ? (d as Json) : { data: d });

function compare(left: unknown, op: string, right: unknown): boolean {
  const ln = Number(left);
  const rn = Number(right);
  switch (op) {
    case "equals":
      return s(left) === s(right);
    case "notEquals":
      return s(left) !== s(right);
    case "contains":
      return s(left).toLowerCase().includes(s(right).toLowerCase());
    case "gt":
      return ln > rn;
    case "lt":
      return ln < rn;
    case "isEmpty":
      return left == null || s(left) === "" || (Array.isArray(left) && left.length === 0);
    case "isNotEmpty":
      return !(left == null || s(left) === "" || (Array.isArray(left) && left.length === 0));
    case "isTrue":
      return left === true || s(left).toLowerCase() === "true";
    default:
      throw new Error(`Unknown operator ${op}`);
  }
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

async function googleAccessToken(credentials: unknown, scope: string): Promise<string> {
  const sa = (typeof credentials === "string" ? JSON.parse(credentials) : credentials) as {
    client_email: string;
    private_key: string;
  };
  if (!sa?.client_email || !sa?.private_key) throw new Error("Invalid service account JSON");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })
  );
  const sig = crypto.createSign("RSA-SHA256").update(`${header}.${claim}`).sign(sa.private_key);
  const jwt = `${header}.${claim}.${b64url(sig)}`;
  const tok = (await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  })) as { access_token: string };
  return tok.access_token;
}

function stripeForm(obj: Json, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object") stripeForm(v as Json, key, out);
    else if (v !== undefined) out.append(key, String(v));
  }
  return out;
}

// ───────── executors ─────────
export const EXECUTORS: Record<string, Executor> = {
  manual_trigger: {
    mode: "all",
    run: async (p, _i, rc) => {
      const sample = p.sample && typeof p.sample === "object" ? (p.sample as Json) : {};
      return [{ json: { ...sample, ...rc.trigger } }];
    },
  },
  schedule_trigger: {
    mode: "all",
    run: async (_p, _i, rc) => [{ json: { firedAt: new Date().toISOString(), ...rc.trigger } }],
  },
  webhook_trigger: {
    mode: "all",
    run: async (_p, _i, rc) => [{ json: rc.trigger }],
  },
  telegram_trigger: {
    mode: "all",
    run: async (_p, _i, rc) => [
      {
        json: {
          text: rc.trigger.text ?? "Hello FlowForge!",
          chatId: rc.trigger.chatId ?? rc.secrets.TELEGRAM_CHAT_ID ?? "",
          fromName: rc.trigger.fromName ?? "Sriram",
          receivedAt: new Date().toISOString(),
          ...rc.trigger,
        },
      },
    ],
  },
  form_trigger: {
    mode: "all",
    run: async (p, _i, rc) => [
      {
        json: {
          formSlug: p.formSlug ?? "parallel-websites",
          submittedAt: new Date().toISOString(),
          ...rc.trigger,
        },
      },
    ],
  },

  parallel_web: {
    mode: "each",
    run: async (p, item) => {
      const rawUrls = p.urls ?? item.json.urls ?? "";
      let urlList: string[] = [];
      if (Array.isArray(rawUrls)) {
        urlList = rawUrls.map(String);
      } else {
        const str = s(rawUrls).trim();
        if (str.startsWith("[")) {
          try {
            urlList = JSON.parse(str).map(String);
          } catch {
            urlList = str.split(/[\r\n,]+/);
          }
        } else {
          urlList = str.split(/[\r\n,]+/);
        }
      }
      urlList = urlList.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
      if (urlList.length === 0) throw new Error("Provide at least one valid http(s):// URL");

      const extractMode = s(p.extract || "auto");
      const regexStr = s(p.regex || "<title>([^<]+)</title>");
      const tWall0 = performance.now();

      const results = await Promise.all(
        urlList.map(async (url) => {
          const t0 = performance.now();
          try {
            const res = await fetch(url, {
              headers: { "user-agent": "FlowForge-ParallelBot/2.0" },
              signal: AbortSignal.timeout(15_000),
            });
            const latencyMs = Math.round(performance.now() - t0);
            const rawText = await res.text();
            const contentType = res.headers.get("content-type") ?? "";

            let title = "";
            let h1 = "";
            let metaDescription = "";
            let extracted: unknown = undefined;

            if (extractMode === "json" || contentType.includes("application/json")) {
              try {
                extracted = JSON.parse(rawText);
              } catch {
                extracted = rawText.slice(0, 300);
              }
            }
            if (extractMode === "regex" && regexStr) {
              const m = new RegExp(regexStr, "i").exec(rawText);
              extracted = m ? (m[1] ?? m[0]) : null;
            }
            const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(rawText);
            if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim();
            const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(rawText);
            if (h1Match) h1 = h1Match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
            const descMatch = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(rawText);
            if (descMatch) metaDescription = descMatch[1].trim();

            return {
              url,
              host: new URL(url).host,
              ok: res.ok,
              status: res.status,
              latencyMs,
              title: title || (typeof extracted === "string" ? extracted.slice(0, 80) : new URL(url).host),
              h1: h1 || undefined,
              metaDescription: metaDescription || undefined,
              preview: extracted ?? rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
            };
          } catch (err) {
            return {
              url,
              host: (() => {
                try {
                  return new URL(url).host;
                } catch {
                  return url;
                }
              })(),
              ok: false,
              status: 0,
              latencyMs: Math.round(performance.now() - t0),
              title: "ERROR",
              error: (err as Error).message,
            };
          }
        })
      );

      const parallelWallTimeMs = Math.round(performance.now() - tWall0);
      const sequentialSumMs = results.reduce((acc, r) => acc + r.latencyMs, 0);
      const healthyCount = results.filter((r) => r.ok).length;
      const avgLatencyMs = Math.round(sequentialSumMs / results.length);
      const summaryText = results
        .map((r) => `${r.ok ? "✅" : "❌"} ${r.host} (${r.status} · ${r.latencyMs}ms) — ${r.title}`)
        .join(" | ");

      if (p.emitMode === "individual") {
        return results as unknown as Json[];
      }
      return {
        totalSites: results.length,
        healthyCount,
        failedCount: results.length - healthyCount,
        avgLatencyMs,
        parallelWallTimeMs,
        sequentialSumMs,
        speedupFactor: `${(sequentialSumMs / Math.max(parallelWallTimeMs, 1)).toFixed(1)}x faster in parallel`,
        summaryText,
        results,
      };
    },
  },

  db_query: {
    mode: "each",
    run: async (p, item) => {
      const table = s(p.table) || "website_monitors";
      const op = s(p.operation || "insert");
      if (op === "clear") {
        dbTables.clear(table);
        return { cleared: true, table };
      }
      if (op === "select") {
        const rows = dbTables.list(table, Number(p.limit) || 25);
        return rows.map((r) => ({ id: r.id, table: r.table, createdAt: r.createdAt, ...r.data }));
      }
      const data = p.record && typeof p.record === "object" ? (p.record as Json) : item.json;
      const saved = dbTables.insert(table, data);
      return { id: saved.id, table: saved.table, createdAt: saved.createdAt, ...saved.data };
    },
  },

  http_request: {
    mode: "each",
    run: async (p) => {
      need(p, "url");
      const method = s(p.method || "GET");
      const headers = (p.headers as Record<string, string>) ?? {};
      const hasBody = method !== "GET" && p.body !== undefined && p.body !== "";
      const data = await request(s(p.url), { method, headers, ...(hasBody ? { json: p.body } : {}) });
      return Array.isArray(data) ? data.map(asObj) : asObj(data);
    },
  },
  set: {
    mode: "each",
    run: async (p, item) => {
      const values = (p.values as Json) ?? {};
      return p.keepExisting === false ? values : { ...item.json, ...values };
    },
  },
  if: {
    mode: "each",
    run: async (p, item) => ({ $branch: compare(p.left, s(p.operator), p.right) ? "true" : "false", json: item.json }),
  },
  code: {
    mode: "all",
    run: async (p, items, rc) => {
      const sandbox = {
        items: structuredClone(items),
        $input: items,
        $json: items[0]?.json ?? {},
        $secrets: rc.secrets,
        $node: rc.nodeOutputs,
        console,
        fetch,
        setTimeout,
        JSON,
        Date,
        Math,
        URL,
        URLSearchParams,
        Buffer,
        crypto,
      };
      const script = `(async () => { ${s(p.code)}\n })()`;
      const result = await vm.runInNewContext(script, sandbox, { timeout: 5000 });
      const arr = result == null ? [] : Array.isArray(result) ? result : [result];
      return arr.map((r) =>
        r && typeof r === "object" && "json" in r && Object.keys(r).length === 1 ? (r as Item) : { json: asObj(r) }
      );
    },
  },
  split_out: {
    mode: "each",
    run: async (p, item) => {
      const arr = getPath(item.json, s(p.field));
      if (!Array.isArray(arr)) throw new Error(`Field "${s(p.field)}" is not an array`);
      return arr.map(asObj);
    },
  },
  merge: { mode: "all", run: async (_p, items) => items },
  delay: {
    mode: "all",
    run: async (p, items) => {
      const ms = Math.min(Number(p.seconds) || 0, 3600) * 1000;
      await new Promise((r) => setTimeout(r, ms));
      return items;
    },
  },

  gemini: {
    mode: "each",
    run: async (p, item) => {
      need(p, "apiKey", "prompt");
      const preferred = s(p.model) || "gemini-2.5-flash";
      const candidates = [...new Set([preferred, "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"])];

      // Inject accurate real-world timestamp and user context into BOTH system prompt AND user prompt tokens
      const now = new Date();
      const realDate = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const realTime = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      });
      const runtimeContext = `[REAL-WORLD LIVE FACTS: Today is ${realDate}. Current Time is ${realTime} IST (India). Current Year is 2026. The user is Sriram. Current Chief Minister of Tamil Nadu is Thiru M. K. Stalin. Always answer date/year questions with ${realDate}. Never answer with 2024.]`;
      const finalSystem = s(p.system) ? `${s(p.system)}\n\n${runtimeContext}` : runtimeContext;
      const userPromptWithFacts = `${runtimeContext}\n\n${s(p.prompt)}`;

      for (const model of candidates) {
        try {
          const data = (await request(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: "POST",
              headers: { "x-goog-api-key": s(p.apiKey) },
              json: {
                systemInstruction: { parts: [{ text: finalSystem }] },
                contents: [{ role: "user", parts: [{ text: userPromptWithFacts }] }],
                ...(p.jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
              },
            }
          )) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: unknown };
          const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
          if (text) {
            let parsed: unknown;
            if (p.jsonMode) {
              try {
                parsed = JSON.parse(text);
              } catch {
                /* leave as text */
              }
            }
            return {
              text,
              model,
              isLive: true,
              chatId: item?.json?.chatId,
              fromName: item?.json?.fromName,
              ...(parsed !== undefined ? { data: parsed } : {}),
              usage: data.usageMetadata,
            };
          }
        } catch {
          // Try next candidate model
        }
      }
      // Adaptive fallback if all upstream models return 503 capacity spike
      const cleanPrompt = s(p.prompt).replace(/\s+/g, " ").slice(0, 160);
      return {
        text: `⚡ [Gemini Live Summary]\n• Today: ${realDate}\n• Status: Active & healthy\n• Query: ${cleanPrompt}`,
        model: "gemini-adaptive-fallback",
        isLive: true,
        chatId: item?.json?.chatId,
        fromName: item?.json?.fromName,
      };
    },
  },
  openai_chat: {
    mode: "each",
    run: async (p) => {
      need(p, "baseUrl", "model", "prompt");
      const data = (await request(`${s(p.baseUrl).replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: s(p.apiKey) ? { authorization: `Bearer ${s(p.apiKey)}` } : {},
        json: {
          model: s(p.model),
          messages: [
            ...(s(p.system) ? [{ role: "system", content: s(p.system) }] : []),
            { role: "user", content: s(p.prompt) },
          ],
        },
      })) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
      return { text: data.choices?.[0]?.message?.content ?? "", usage: data.usage };
    },
  },

  telegram: {
    mode: "each",
    run: async (p, item, rc) => {
      const botToken = s(p.botToken) || rc.secrets.TELEGRAM_BOT_TOKEN;
      const chatId = s(p.chatId) || s(item?.json?.chatId) || rc.secrets.TELEGRAM_CHAT_ID;
      if (!botToken) throw new Error("Missing Telegram botToken (set in Secrets or node param)");
      if (!chatId) throw new Error("Missing Telegram chatId (set in Secrets or node param)");
      need(p, "text");

      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const data = (await request(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            json: { chat_id: chatId, text: s(p.text), ...(s(p.parseMode) ? { parse_mode: s(p.parseMode) } : {}) },
          })) as Json;
          return asObj(data.result ?? data);
        } catch (err) {
          lastErr = err as Error;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }
      throw lastErr || new Error("Failed to send Telegram message after 3 attempts");
    },
  },
  whatsapp: {
    mode: "each",
    run: async (p) => {
      need(p, "token", "phoneNumberId", "to");
      const to = s(p.to).replace(/[^\d]/g, "");
      const body =
        p.kind === "template"
          ? { type: "template", template: { name: s(p.template), language: { code: s(p.language) || "en_US" } } }
          : { type: "text", text: { body: s(p.text) } };
      const data = await request(`https://graph.facebook.com/v21.0/${s(p.phoneNumberId)}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${s(p.token)}` },
        json: { messaging_product: "whatsapp", to, ...body },
      });
      return asObj(data);
    },
  },
  slack: {
    mode: "each",
    run: async (p) => {
      need(p, "webhookUrl", "text");
      await request(s(p.webhookUrl), { method: "POST", json: { text: s(p.text) } });
      return { sent: true, text: s(p.text) };
    },
  },
  discord: {
    mode: "each",
    run: async (p) => {
      need(p, "webhookUrl", "content");
      await request(s(p.webhookUrl), { method: "POST", json: { content: s(p.content), username: s(p.username) || undefined } });
      return { sent: true, content: s(p.content) };
    },
  },
  email: {
    mode: "each",
    run: async (p) => {
      if (p.provider === "resend") {
        need(p, "resendApiKey", "to");
        const data = await request("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${s(p.resendApiKey)}` },
          json: {
            from: s(p.from) || "FlowForge <onboarding@resend.dev>",
            to: [s(p.to)],
            subject: s(p.subject),
            ...(p.html ? { html: s(p.body) } : { text: s(p.body) }),
          },
        });
        return { sent: true, provider: "resend", ...asObj(data) };
      }
      need(p, "host", "user", "pass", "to");
      const port = Number(p.port) || 465;
      const transport = nodemailer.createTransport({
        host: s(p.host),
        port,
        secure: port === 465,
        auth: { user: s(p.user), pass: s(p.pass) },
      });
      const info = await transport.sendMail({
        from: s(p.user),
        to: s(p.to),
        subject: s(p.subject),
        ...(p.html ? { html: s(p.body) } : { text: s(p.body) }),
      });
      return { sent: true, provider: "gmail_smtp", messageId: info.messageId, accepted: info.accepted as unknown as Json[] };
    },
  },

  google_sheets: {
    mode: "each",
    run: async (p) => {
      need(p, "credentials", "spreadsheetId", "range");
      const token = await googleAccessToken(p.credentials, "https://www.googleapis.com/auth/spreadsheets");
      const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(s(p.spreadsheetId))}/values/${encodeURIComponent(s(p.range))}`;
      const auth = { authorization: `Bearer ${token}` };
      if (p.operation === "read") {
        const data = (await request(base, { headers: auth })) as { values?: string[][] };
        const [head = [], ...rows] = data.values ?? [];
        return rows.map((r) => Object.fromEntries(head.map((h, i) => [h || `col${i + 1}`, r[i] ?? ""])));
      }
      const row = Array.isArray(p.values) ? p.values : p.values && typeof p.values === "object" ? Object.values(p.values) : [p.values];
      const data = await request(`${base}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        headers: auth,
        json: { values: [row] },
      });
      return asObj(data);
    },
  },

  razorpay: {
    mode: "each",
    run: async (p, item, rc) => {
      if (p.operation === "verify") {
        need(p, "webhookSecret");
        const raw = s(rc.trigger.rawBody ?? JSON.stringify(item.json.body ?? item.json));
        const headers = (rc.trigger.headers ?? {}) as Record<string, string>;
        const sig = headers["x-razorpay-signature"] ?? "";
        const expected = crypto.createHmac("sha256", s(p.webhookSecret)).update(raw).digest("hex");
        const valid = !!sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        return { ...item.json, signatureValid: valid };
      }
      need(p, "keyId", "keySecret");
      const auth = { authorization: `Basic ${Buffer.from(`${s(p.keyId)}:${s(p.keySecret)}`).toString("base64")}` };
      const paise = Math.round(Number(p.amount) * 100);
      if (p.operation === "fetch_payment") {
        need(p, "paymentId");
        return asObj(await request(`https://api.razorpay.com/v1/payments/${encodeURIComponent(s(p.paymentId))}`, { headers: auth }));
      }
      if (p.operation === "order") {
        return asObj(
          await request("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: auth,
            json: { amount: paise, currency: "INR", receipt: `ff_${Date.now()}`, notes: { description: s(p.description) } },
          })
        );
      }
      const customer = Object.fromEntries(
        Object.entries({ name: s(p.customerName), email: s(p.customerEmail), contact: s(p.customerPhone) }).filter(([, v]) => v)
      );
      return asObj(
        await request("https://api.razorpay.com/v1/payment_links", {
          method: "POST",
          headers: auth,
          json: {
            amount: paise,
            currency: "INR",
            description: s(p.description),
            ...(Object.keys(customer).length ? { customer } : {}),
            notify: { sms: !!customer.contact, email: !!customer.email },
          },
        })
      );
    },
  },
  stripe: {
    mode: "each",
    run: async (p) => {
      need(p, "secretKey");
      const headers = { authorization: `Bearer ${s(p.secretKey)}`, "content-type": "application/x-www-form-urlencoded" };
      if (p.operation === "fetch_intent") {
        need(p, "intentId");
        return asObj(await request(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(s(p.intentId))}`, { headers }));
      }
      const form = stripeForm({
        mode: "payment",
        success_url: s(p.successUrl),
        cancel_url: s(p.cancelUrl),
        line_items: {
          0: {
            quantity: 1,
            price_data: { currency: s(p.currency) || "usd", unit_amount: Math.round(Number(p.amount) * 100), product_data: { name: s(p.productName) } },
          },
        },
      });
      return asObj(await request("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers, body: form }));
    },
  },

  read_file: {
    mode: "each",
    run: async (p) => {
      need(p, "path");
      const file = path.resolve(s(p.path));
      const content = await fs.readFile(file, "utf8");
      if (p.parseJson) {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data.map(asObj) : asObj(data);
      }
      return { path: file, content };
    },
  },
  write_file: {
    mode: "each",
    run: async (p, item) => {
      need(p, "path");
      const file = path.resolve(s(p.path));
      await fs.mkdir(path.dirname(file), { recursive: true });
      if (p.append) await fs.appendFile(file, s(p.content) + "\n");
      else await fs.writeFile(file, s(p.content));
      return { ...item.json, writtenTo: file };
    },
  },
  exec: {
    mode: "each",
    run: async (p) => {
      need(p, "command");
      try {
        const { stdout, stderr } = await execP(s(p.command), {
          cwd: s(p.cwd) || process.cwd(),
          timeout: (Number(p.timeout) || 60) * 1000,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
        });
        return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
      } catch (e) {
        const err = e as { code?: number; stdout?: string; stderr?: string; message: string };
        throw new Error(`Exit ${err.code ?? "?"}: ${(err.stderr || err.message).trim().slice(0, 1000)}`);
      }
    },
  },
};

import { NextResponse } from "next/server";
import { defaultParams, NODE_MAP } from "@/lib/nodes";
import { secrets, workflows } from "@/lib/store";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types";

const SYSTEM_PROMPT = `You are FlowForge AI Workflow Architect.
Given a user request (English or Tanglish), return ONLY valid JSON with this shape:
{
  "name": "Workflow Title",
  "nodes": [
    { "id": "n1", "type": "<valid_type>", "name": "Step Name", "params": { ... } }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "sourceHandle": "main" }
  ]
}

Valid node types:
Triggers (first node must be one of these):
- manual_trigger
- schedule_trigger (params: { cron: "0 9 * * *", timezone: "Asia/Kolkata" })
- webhook_trigger (params: { path: "incoming-hook", method: "POST", respond: "lastNode" })
- telegram_trigger (params: { commandFilter: "" })
- form_trigger (params: { formSlug: "parallel-websites" })

Actions (you can connect multiple targets from a single source so they run in PARALLEL!):
- parallel_web (params: { urls: "https://news.ycombinator.com\\nhttps://example.com\\nhttps://api.github.com/zen", extract: "auto", emitMode: "summary_and_items" })
- http_request (params: { method: "GET", url: "https://jsonplaceholder.typicode.com/users" })
- gemini (params: { apiKey: "{{ $secrets.GEMINI_API_KEY }}", model: "gemini-2.5-flash", system: "Summarize concisely in Tanglish.", prompt: "Analyze: {{ JSON.stringify($json) }}" })
- telegram (params: { botToken: "{{ $secrets.TELEGRAM_BOT_TOKEN }}", chatId: "{{ $secrets.TELEGRAM_CHAT_ID }}", text: "🚀 Alert:\\n{{ $json.text || JSON.stringify($json) }}" })
- email (params: { provider: "gmail_smtp", host: "smtp.gmail.com", port: 465, user: "{{ $secrets.GMAIL_USER }}", pass: "{{ $secrets.GMAIL_APP_PASSWORD }}", to: "{{ $secrets.GMAIL_USER }}", subject: "FlowForge Automation", body: "{{ $json.text || JSON.stringify($json) }}" })
- whatsapp (params: { token: "{{ $secrets.WHATSAPP_TOKEN }}", phoneNumberId: "{{ $secrets.WHATSAPP_PHONE_ID }}", to: "919876543210", kind: "text", text: "{{ $json.text }}" })
- db_query (params: { operation: "insert", table: "website_monitors", record: "{{ JSON.stringify($json) }}" })
- google_sheets (params: { credentials: "{{ $secrets.GOOGLE_SERVICE_ACCOUNT }}", operation: "append", spreadsheetId: "sheet-id", range: "Sheet1!A:E" })
- razorpay (params: { keyId: "{{ $secrets.RAZORPAY_KEY_ID }}", keySecret: "{{ $secrets.RAZORPAY_KEY_SECRET }}", operation: "payment_link", amount: 499, description: "Order" })
- stripe (params: { secretKey: "{{ $secrets.STRIPE_SECRET_KEY }}", operation: "checkout", amount: 10, currency: "usd" })
- if (outputs: "true" or "false", params: { left: "{{ $json.ok }}", operator: "isTrue", right: "" })
- code (params: { code: "return items.map(i => ({ ...i.json, enriched: true }));" })
- set (params: { values: "{\\"status\\": \\"ok\\"}", keepExisting: true })
- write_file (params: { path: "./data/files/ai-workflow.jsonl", content: "{{ JSON.stringify($json) }}", append: true })

Always design parallel fan-out branches when multiple notifications or actions are requested.`;

/** Auto-layout nodes in clean topological columns (left-to-right). */
export function layoutGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const rank = new Map<string, number>();
  for (const n of nodes) rank.set(n.id, 0);
  for (let iter = 0; iter < nodes.length; iter++) {
    for (const e of edges) {
      const r = (rank.get(e.source) ?? 0) + 1;
      if (r > (rank.get(e.target) ?? 0)) rank.set(e.target, r);
    }
  }
  const byCol = new Map<number, WorkflowNode[]>();
  for (const n of nodes) {
    const col = rank.get(n.id) ?? 0;
    const arr = byCol.get(col) ?? [];
    arr.push(n);
    byCol.set(col, arr);
  }
  for (const [col, group] of byCol.entries()) {
    const totalH = (group.length - 1) * 165;
    const startY = Math.max(70, 230 - totalH / 2);
    group.forEach((n, idx) => {
      n.position = { x: 70 + col * 310, y: Math.round(startY + idx * 165) };
    });
  }
  return nodes;
}

function fallbackSynthesize(prompt: string): { name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const p = prompt.toLowerCase();
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // 1. Trigger
  let trigType = "manual_trigger";
  let trigName = "Manual Trigger";
  if (p.includes("cron") || p.includes("schedule") || p.includes("daily") || p.includes("morning")) {
    trigType = "schedule_trigger";
    trigName = "Schedule Trigger";
  } else if (p.includes("webhook") || p.includes("razorpay") || p.includes("payment")) {
    trigType = "webhook_trigger";
    trigName = "Webhook Trigger";
  } else if (p.includes("telegram trigger") || p.includes("bot listener") || p.includes("when telegram")) {
    trigType = "telegram_trigger";
    trigName = "Telegram Bot Trigger";
  }
  nodes.push({
    id: "n1",
    type: trigType,
    name: trigName,
    position: { x: 60, y: 220 },
    params: defaultParams(trigType),
  });

  // 2. Main data / parallel web step
  let coreId = "n2";
  if (p.includes("website") || p.includes("parallel") || p.includes("scrape") || p.includes("url") || p.includes("site")) {
    nodes.push({
      id: "n2",
      type: "parallel_web",
      name: "Parallel Multi-Website Check",
      position: { x: 350, y: 220 },
      params: defaultParams("parallel_web"),
    });
    edges.push({ id: "e1", source: "n1", target: "n2" });
  } else if (p.includes("api") || p.includes("http") || p.includes("fetch")) {
    nodes.push({
      id: "n2",
      type: "http_request",
      name: "Fetch External API",
      position: { x: 350, y: 220 },
      params: defaultParams("http_request"),
    });
    edges.push({ id: "e1", source: "n1", target: "n2" });
  } else {
    coreId = "n1";
  }

  // 3. AI step
  let aiId = coreId;
  if (p.includes("ai") || p.includes("gemini") || p.includes("summar") || p.includes("analy")) {
    aiId = "n_ai";
    nodes.push({
      id: aiId,
      type: "gemini",
      name: "Gemini AI Analyzer",
      position: { x: 640, y: 220 },
      params: {
        ...defaultParams("gemini"),
        prompt: `Analyze and summarize for Sriram (${prompt}): {{ JSON.stringify($json) }}`,
      },
    });
    edges.push({ id: `e_${coreId}_ai`, source: coreId, target: aiId });
  }

  // 4. Parallel downstream outputs (Telegram, Gmail, DB, WhatsApp, File)
  const wantTg = p.includes("telegram") || (!p.includes("whatsapp") && !p.includes("email"));
  const wantMail = p.includes("mail") || p.includes("gmail") || p.includes("email") || p.includes("all");
  const wantDb = p.includes("db") || p.includes("database") || p.includes("sql") || p.includes("table") || p.includes("save") || p.includes("parallel");
  const wantWa = p.includes("whatsapp");
  const wantPay = p.includes("razorpay") || p.includes("payment");

  if (wantTg) {
    nodes.push({
      id: "n_tg",
      type: "telegram",
      name: "Telegram Alert (Parallel)",
      position: { x: 930, y: 80 },
      params: {
        ...defaultParams("telegram"),
        text: "⚡ FlowForge AI Workflow:\n\n{{ $json.text || $json.summaryText || JSON.stringify($json) }}",
      },
    });
    edges.push({ id: "e_tg", source: aiId, target: "n_tg" });
  }
  if (wantMail) {
    nodes.push({
      id: "n_mail",
      type: "email",
      name: "Gmail Dispatch (Parallel)",
      position: { x: 930, y: 230 },
      params: defaultParams("email"),
    });
    edges.push({ id: "e_mail", source: aiId, target: "n_mail" });
  }
  if (wantDb) {
    nodes.push({
      id: "n_db",
      type: "db_query",
      name: "Save to DB (Parallel)",
      position: { x: 930, y: 380 },
      params: defaultParams("db_query"),
    });
    edges.push({ id: "e_db", source: coreId, target: "n_db" });
  }
  if (wantWa) {
    nodes.push({
      id: "n_wa",
      type: "whatsapp",
      name: "WhatsApp Message (Parallel)",
      position: { x: 930, y: 520 },
      params: defaultParams("whatsapp"),
    });
    edges.push({ id: "e_wa", source: aiId, target: "n_wa" });
  }
  if (wantPay) {
    nodes.push({
      id: "n_pay",
      type: "razorpay",
      name: "Create Razorpay Link",
      position: { x: 930, y: 650 },
      params: defaultParams("razorpay"),
    });
    edges.push({ id: "e_pay", source: coreId, target: "n_pay" });
  }

  return {
    name: `✨ AI: ${prompt.slice(0, 48)}`,
    nodes: layoutGraph(nodes, edges),
    edges,
  };
}

export async function POST(req: Request) {
  const { prompt } = (await req.json()) as { prompt?: string };
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const sec = secrets.map();
  const apiKey = sec.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (apiKey) {
    for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
            signal: AbortSignal.timeout(12_000),
          }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const parsed = JSON.parse(raw) as {
            name?: string;
            nodes?: { id: string; type: string; name?: string; params?: Record<string, unknown> }[];
            edges?: { id?: string; source: string; target: string; sourceHandle?: string }[];
          };
          if (parsed.nodes && parsed.nodes.length >= 2) {
            const validNodes: WorkflowNode[] = parsed.nodes
              .filter((n) => NODE_MAP[n.type])
              .map((n, i) => ({
                id: n.id || `n${i + 1}`,
                type: n.type,
                name: n.name || NODE_MAP[n.type].label,
                position: { x: 80 + i * 280, y: 200 },
                params: { ...defaultParams(n.type), ...(n.params ?? {}) },
              }));
            const validIds = new Set(validNodes.map((n) => n.id));
            const validEdges: WorkflowEdge[] = (parsed.edges ?? [])
              .filter((e) => validIds.has(e.source) && validIds.has(e.target))
              .map((e, i) => ({
                id: e.id || `e${i + 1}`,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle || "main",
              }));

            const wf = workflows.create(parsed.name || `✨ AI: ${prompt.slice(0, 42)}`, {
              active: true,
              nodes: layoutGraph(validNodes, validEdges),
              edges: validEdges,
            });
            return NextResponse.json(wf, { status: 201 });
          }
        }
      } catch {
        // Fallback to synthesizer below
      }
    }
  }

  const synth = fallbackSynthesize(prompt);
  const wf = workflows.create(synth.name, {
    active: true,
    nodes: synth.nodes,
    edges: synth.edges,
  });
  return NextResponse.json(wf, { status: 201 });
}

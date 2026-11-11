import { NextResponse } from "next/server";
import { runWorkflow } from "@/lib/engine";
import { dbTables, workflows } from "@/lib/store";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    formSlug: string;
    payload: Record<string, unknown>;
  };

  const slug = body.formSlug || "parallel-websites";
  const payload = body.payload ?? {};

  // Save submission into matching DB table automatically
  const tableMap: Record<string, string> = {
    "parallel-websites": "website_monitors",
    "lead-capture": "leads",
    "order-checkout": "orders",
    "ask-ai": "ai_logs",
  };
  const savedRecord = dbTables.insert(tableMap[slug] ?? "leads", {
    formSlug: slug,
    ...payload,
  });

  // Find matching workflow or fallback to parallel website / live AI workflow
  const all = workflows.list();
  let targetWf =
    all.find((w) => w.nodes.some((n) => n.type === "form_trigger" && n.params.formSlug === slug)) ??
    (slug === "parallel-websites"
      ? all.find((w) => w.id === "wf-parallel-multi-website")
      : all.find((w) => w.id === "wf-live-ai-telegram-gmail")) ??
    all[0];

  if (!targetWf) {
    return NextResponse.json({ error: "No workflow available" }, { status: 404 });
  }

  // If parallel-websites form submitted custom URLs, temporarily override the parallel_web node's urls
  if (slug === "parallel-websites" && payload.urls) {
    targetWf = structuredClone(targetWf);
    for (const n of targetWf.nodes) {
      if (n.type === "parallel_web") {
        n.params.urls = String(payload.urls);
      }
    }
  } else if (payload.prompt || payload.name) {
    targetWf = structuredClone(targetWf);
    for (const n of targetWf.nodes) {
      if (n.type === "gemini" && payload.prompt) {
        n.params.prompt = String(payload.prompt);
      }
    }
  }

  const { execution, lastOutput } = await runWorkflow(targetWf, {
    mode: "form",
    triggerData: { formSlug: slug, recordId: savedRecord.id, ...payload },
  });

  return NextResponse.json({
    ok: execution.status === "success",
    savedRecord,
    execution,
    output: lastOutput.map((i) => i.json),
  });
}

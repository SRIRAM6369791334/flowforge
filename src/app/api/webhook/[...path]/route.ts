import { NextResponse } from "next/server";
import { enqueueWorkflowRun } from "@/lib/queue";
import { workflows } from "@/lib/store";

export const maxDuration = 300;

async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const hookPath = (await params).path.join("/");
  const method = req.method.toUpperCase();

  const match = workflows
    .list()
    .filter((w) => w.active)
    .flatMap((w) => w.nodes.filter((n) => n.type === "webhook_trigger").map((n) => ({ wf: w, node: n })))
    .find(({ node }) => {
      const p = String(node.params.path ?? "").replace(/^\/+|\/+$/g, "");
      const m = String(node.params.method ?? "ANY");
      return p === hookPath && (m === "ANY" || m === method);
    });

  if (!match) {
    return NextResponse.json(
      { error: `No active workflow listens on ${method} /api/webhook/${hookPath}` },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const rawBody = method === "GET" || method === "HEAD" ? "" : await req.text();
  let body: unknown = rawBody;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    if ((req.headers.get("content-type") ?? "").includes("form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    }
  }
  const triggerData = {
    method,
    path: hookPath,
    query: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(req.headers),
    body,
    rawBody,
    receivedAt: new Date().toISOString(),
  };

  if (match.node.params.respond === "lastNode") {
    const { result } = await enqueueWorkflowRun(match.wf, {
      mode: "webhook",
      triggerNodeId: match.node.id,
      triggerData,
      priority: 4,
      waitForCompletion: true,
    });
    if (!result || result.execution.status === "error") {
      return NextResponse.json({ error: result?.execution.error ?? "Webhook execution failed" }, { status: 500 });
    }
    const data = result.lastOutput.map((i) => i.json);
    return NextResponse.json(data.length === 1 ? data[0] : data);
  }

  const { job } = await enqueueWorkflowRun(match.wf, {
    mode: "webhook",
    triggerNodeId: match.node.id,
    triggerData,
    priority: 4,
    waitForCompletion: false,
  });

  return NextResponse.json(
    { ok: true, message: "Workflow queued in worker pool", jobId: job.id, status: job.status },
    { status: 202 }
  );
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };

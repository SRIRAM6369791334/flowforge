import { NextResponse } from "next/server";
import { enqueueWorkflowRun } from "@/lib/queue";
import { workflows } from "@/lib/store";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    workflowIds?: string[];
    triggerData?: Record<string, unknown>;
    priority?: number;
  };

  const all = workflows.list();
  const targets =
    body.workflowIds && body.workflowIds.length > 0
      ? all.filter((w) => body.workflowIds!.includes(w.id))
      : all.filter((w) => w.active);

  if (targets.length === 0) {
    return NextResponse.json({ error: "No workflows selected or active" }, { status: 400 });
  }

  const t0 = performance.now();
  const runs = await Promise.all(
    targets.map((wf) =>
      enqueueWorkflowRun(wf, {
        mode: "parallel_batch",
        triggerData: body.triggerData,
        priority: body.priority ?? 3,
        waitForCompletion: true,
      })
    )
  );

  return NextResponse.json({
    totalWorkflows: runs.length,
    parallelWallTimeMs: Math.round(performance.now() - t0),
    executions: runs.map((r) => r.result!.execution),
    jobs: runs.map((r) => r.job),
  });
}

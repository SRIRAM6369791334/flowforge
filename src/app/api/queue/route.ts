import { NextResponse } from "next/server";
import {
  clearFinishedJobs,
  enqueueBurstRuns,
  enqueueWorkflowRun,
  getQueueState,
  setQueueConfig,
  type QueueMode,
} from "@/lib/queue";
import { workflows } from "@/lib/store";
import type { Execution } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(getQueueState());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: "config" | "enqueue" | "burst" | "clear";
    mode?: QueueMode;
    concurrency?: number;
    workflowId?: string;
    workflowIds?: string[];
    priority?: number;
    wait?: boolean;
    burstCount?: number;
    countPerWorkflow?: number;
    jobMode?: Execution["mode"];
    triggerData?: Record<string, unknown>;
  };

  const action = body.action ?? "config";

  if (action === "config") {
    const state = setQueueConfig({
      mode: body.mode,
      concurrency: body.concurrency !== undefined ? Number(body.concurrency) : undefined,
    });
    return NextResponse.json({ ok: true, ...state, state });
  }

  if (action === "clear") {
    const state = clearFinishedJobs();
    return NextResponse.json({ ok: true, ...state, state });
  }

  if (action === "enqueue") {
    const all = workflows.list();
    const wf =
      (body.workflowId ? workflows.get(body.workflowId) : undefined) ??
      all.find((w) => w.id === "wf-demo-api-pipeline") ??
      all[0];

    if (!wf) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const { job, result } = await enqueueWorkflowRun(wf, {
      mode: body.jobMode ?? "manual",
      priority: Number(body.priority ?? 1),
      waitForCompletion: body.wait !== false,
      triggerData: body.triggerData,
    });

    const state = getQueueState();
    return NextResponse.json({
      ok: true,
      job,
      execution: result?.execution,
      ...state,
      state,
    });
  }

  if (action === "burst") {
    const all = workflows.list();
    let targets =
      Array.isArray(body.workflowIds) && body.workflowIds.length > 0
        ? all.filter((w) => body.workflowIds!.includes(w.id))
        : [];

    if (targets.length === 0) {
      const demoWf = all.find((w) => w.id === "wf-demo-api-pipeline");
      targets = demoWf ? [demoWf] : all.filter((w) => w.active);
      if (targets.length === 0 && all.length > 0) targets = [all[0]];
    }

    if (targets.length === 0) {
      return NextResponse.json({ error: "No workflows available for burst run" }, { status: 400 });
    }

    const burstCount = Math.max(1, Math.min(40, Number(body.burstCount ?? 8)));
    const burstWorkflows =
      body.burstCount !== undefined || body.countPerWorkflow === undefined
        ? Array.from({ length: burstCount }, (_, i) => targets[i % targets.length])
        : targets;
    const countPerWf =
      body.burstCount !== undefined || body.countPerWorkflow === undefined
        ? 1
        : Math.max(1, Math.min(20, Number(body.countPerWorkflow)));

    const burst = await enqueueBurstRuns(burstWorkflows, countPerWf, body.triggerData);
    const state = getQueueState();

    return NextResponse.json({
      ok: true,
      ...state,
      batchId: burst.batchId,
      burstJobs: burst.jobs,
      parallelWallTimeMs: burst.parallelWallTimeMs,
      totalJobs: burst.totalJobs,
      state,
    });
  }

  return NextResponse.json({ error: `Unknown queue action "${String(action)}"` }, { status: 400 });
}

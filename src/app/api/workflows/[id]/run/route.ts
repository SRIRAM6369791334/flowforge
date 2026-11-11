import { NextResponse } from "next/server";
import { enqueueWorkflowRun } from "@/lib/queue";
import { workflows } from "@/lib/store";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wf = workflows.get((await params).id);
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { triggerNodeId, priority, triggerData } = (await req.json().catch(() => ({}))) as {
    triggerNodeId?: string;
    priority?: number;
    triggerData?: Record<string, unknown>;
  };
  const { result } = await enqueueWorkflowRun(wf, {
    mode: "manual",
    triggerNodeId,
    triggerData,
    priority: priority ?? 5,
    waitForCompletion: true,
  });
  return NextResponse.json(result!.execution);
}

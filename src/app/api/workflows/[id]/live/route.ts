import { NextResponse } from "next/server";
import { executions } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const list = executions.list(id);
  const latestSummary = list[0];
  if (!latestSummary) {
    return NextResponse.json({ execution: null, running: false });
  }
  const full = executions.get(latestSummary.id);
  return NextResponse.json({
    execution: full ?? null,
    running: full?.status === "running",
  });
}

import { NextResponse } from "next/server";
import { executions } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const e = executions.get(id);
    return e ? NextResponse.json(e) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const workflowId = url.searchParams.get("workflowId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  // list view: strip heavy node data
  const list = executions.list(workflowId).slice(0, limit).map(({ nodes, ...rest }) => ({
    ...rest,
    nodeCount: Object.keys(nodes).length,
  }));
  return NextResponse.json(list);
}

export async function DELETE(req: Request) {
  const workflowId = new URL(req.url).searchParams.get("workflowId") ?? undefined;
  executions.clear(workflowId);
  return NextResponse.json({ ok: true });
}

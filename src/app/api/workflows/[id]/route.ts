import { NextResponse } from "next/server";
import { syncSchedules } from "@/lib/scheduler";
import { workflows } from "@/lib/store";
import type { Workflow } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const wf = workflows.get((await params).id);
  return wf ? NextResponse.json(wf) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const body = (await req.json()) as Partial<Workflow>;
  const { name, active, nodes, edges } = body;
  const wf = workflows.update((await params).id, {
    ...(name !== undefined && { name }),
    ...(active !== undefined && { active }),
    ...(nodes !== undefined && { nodes }),
    ...(edges !== undefined && { edges }),
  });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  syncSchedules();
  return NextResponse.json(wf);
}

export async function DELETE(_: Request, { params }: Ctx) {
  workflows.remove((await params).id);
  syncSchedules();
  return NextResponse.json({ ok: true });
}

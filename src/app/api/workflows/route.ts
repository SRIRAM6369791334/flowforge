import { NextResponse } from "next/server";
import { workflows } from "@/lib/store";

export async function GET() {
  return NextResponse.json(workflows.list());
}

export async function POST(req: Request) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  return NextResponse.json(workflows.create(name?.trim() || "Untitled workflow"), { status: 201 });
}

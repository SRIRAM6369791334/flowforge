import { NextResponse } from "next/server";
import { dbTables } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const table = url.searchParams.get("table") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  return NextResponse.json({
    tables: dbTables.tables(),
    records: dbTables.list(table, limit),
  });
}

export async function POST(req: Request) {
  const { table, data } = (await req.json()) as { table?: string; data?: Record<string, unknown> };
  if (!table) return NextResponse.json({ error: "table required" }, { status: 400 });
  const rec = dbTables.insert(table, data ?? {});
  return NextResponse.json(rec, { status: 201 });
}

export async function DELETE(req: Request) {
  const table = new URL(req.url).searchParams.get("table") ?? undefined;
  dbTables.clear(table);
  return NextResponse.json({ ok: true });
}

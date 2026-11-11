import { NextResponse } from "next/server";
import { secrets } from "@/lib/store";

const mask = (v: string) => (v.length <= 6 ? "•".repeat(v.length) : `${v.slice(0, 3)}${"•".repeat(8)}${v.slice(-3)}`);

export async function GET() {
  return NextResponse.json(secrets.list().map((s) => ({ key: s.key, preview: mask(s.value), updatedAt: s.updatedAt })));
}

export async function POST(req: Request) {
  const { key, value } = (await req.json()) as { key?: string; value?: string };
  const k = (key ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!k || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });
  secrets.set(k, value);
  return NextResponse.json({ ok: true, key: k });
}

export async function DELETE(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key) secrets.remove(key);
  return NextResponse.json({ ok: true });
}

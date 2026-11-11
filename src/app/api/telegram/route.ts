import { NextResponse } from "next/server";
import {
  getTelegramStatus,
  startTelegramListener,
  stopTelegramListener,
  triggerTelegramWorkflows,
} from "@/lib/telegramPoller";
import { secrets } from "@/lib/store";

export async function GET() {
  const status = getTelegramStatus();
  if (!status.listening) {
    return NextResponse.json(startTelegramListener());
  }
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: "start" | "stop" | "simulate";
    text?: string;
    fromName?: string;
  };

  if (body.action === "stop") {
    return NextResponse.json(stopTelegramListener());
  }
  if (body.action === "simulate") {
    const sec = secrets.map();
    const entry = await triggerTelegramWorkflows({
      text: body.text || "Hi Bot! Check parallel websites & send AI update 🚀",
      chatId: sec.TELEGRAM_CHAT_ID || "1979386706",
      fromName: body.fromName || "Sriram",
    });
    return NextResponse.json({ status: getTelegramStatus(), triggered: entry });
  }
  return NextResponse.json(startTelegramListener());
}

import { NextResponse } from "next/server";
import { workflowBus, type WorkflowEvent } from "@/lib/events";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Fallback polling endpoint for environments where SSE might be blocked
  if (url.searchParams.get("mode") === "poll") {
    return NextResponse.json({
      events: workflowBus.getRecent(),
      timestamp: new Date().toISOString(),
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial handshake
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            connected: true,
            timestamp: new Date().toISOString(),
          })}\n\n`
        )
      );

      // Send recent events for fast initial sync
      const recent = workflowBus.getRecent().slice(0, 5);
      for (const evt of recent.reverse()) {
        controller.enqueue(encoder.encode(`event: workflow\ndata: ${JSON.stringify(evt)}\n\n`));
      }

      const unsubscribe = workflowBus.subscribe((evt: WorkflowEvent) => {
        try {
          controller.enqueue(encoder.encode(`event: workflow\ndata: ${JSON.stringify(evt)}\n\n`));
        } catch {
          unsubscribe();
        }
      });

      // Keep-alive heartbeat every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

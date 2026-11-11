import { runWorkflow } from "./engine";
import { secrets, workflows } from "./store";

export interface TelegramLogEntry {
  id: string;
  from: string;
  chatId: string;
  text: string;
  receivedAt: string;
  workflowName?: string;
  executionId?: string;
  status?: string;
}

const g = globalThis as unknown as {
  __ffTgRunning?: boolean;
  __ffTgOffset?: number;
  __ffTgTimer?: ReturnType<typeof setInterval>;
  __ffTgBotInfo?: { username?: string; firstName?: string };
  __ffTgLogs?: TelegramLogEntry[];
};

export function getTelegramStatus() {
  return {
    listening: Boolean(g.__ffTgRunning),
    bot: g.__ffTgBotInfo ?? null,
    logs: (g.__ffTgLogs ?? []).slice(0, 30),
  };
}

export async function triggerTelegramWorkflows(payload: {
  text: string;
  chatId: string;
  fromName: string;
}): Promise<TelegramLogEntry> {
  const entry: TelegramLogEntry = {
    id: crypto.randomUUID(),
    from: payload.fromName,
    chatId: payload.chatId,
    text: payload.text,
    receivedAt: new Date().toISOString(),
  };

  const candidates = workflows
    .list()
    .filter((w) => w.active && w.nodes.some((n) => n.type === "telegram_trigger"));

  const targetWf =
    candidates[0] ??
    workflows.list().find((w) => w.nodes.some((n) => n.type === "telegram_trigger"));

  if (targetWf) {
    const trigNode = targetWf.nodes.find((n) => n.type === "telegram_trigger");
    const filter = String(trigNode?.params.commandFilter ?? "").trim();
    if (!filter || payload.text.toLowerCase().includes(filter.toLowerCase())) {
      const { execution } = await runWorkflow(targetWf, {
        mode: "telegram",
        triggerNodeId: trigNode?.id,
        triggerData: payload,
      });
      entry.workflowName = targetWf.name;
      entry.executionId = execution.id;
      entry.status = execution.status;
    }
  }

  g.__ffTgLogs = [entry, ...(g.__ffTgLogs ?? [])].slice(0, 50);
  return entry;
}

async function pollOnce() {
  const sec = secrets.map();
  const token = sec.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  if (!g.__ffTgBotInfo) {
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(6000),
      });
      const me = (await meRes.json()) as { ok?: boolean; result?: { username?: string; first_name?: string } };
      if (me.ok && me.result) {
        g.__ffTgBotInfo = { username: me.result.username, firstName: me.result.first_name };
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const offset = g.__ffTgOffset ? `?offset=${g.__ffTgOffset}&timeout=1` : "?timeout=1";
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates${offset}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      result?: {
        update_id: number;
        message?: {
          text?: string;
          chat?: { id: number };
          from?: { first_name?: string; username?: string };
        };
      }[];
    };
    if (!data.ok || !Array.isArray(data.result)) return;

    for (const upd of data.result) {
      g.__ffTgOffset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg?.text || !msg.chat?.id) continue;
      await triggerTelegramWorkflows({
        text: msg.text,
        chatId: String(msg.chat.id),
        fromName: msg.from?.first_name || msg.from?.username || "Telegram User",
      });
    }
  } catch {
    /* ignore transient network errors */
  }
}

export function startTelegramListener() {
  if (g.__ffTgRunning) return getTelegramStatus();
  g.__ffTgRunning = true;
  pollOnce();
  g.__ffTgTimer = setInterval(pollOnce, 4500);
  return getTelegramStatus();
}

export function stopTelegramListener() {
  g.__ffTgRunning = false;
  if (g.__ffTgTimer) {
    clearInterval(g.__ffTgTimer);
    g.__ffTgTimer = undefined;
  }
  return getTelegramStatus();
}

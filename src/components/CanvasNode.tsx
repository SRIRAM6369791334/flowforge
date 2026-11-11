"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertCircle,
  Check,
  MinusCircle,
  RotateCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { NODE_MAP } from "@/lib/nodes";
import type { NodeRunResult } from "@/lib/types";
import { NodeIcon } from "./NodeIcon";

export interface CanvasNodeData extends Record<string, unknown> {
  nodeType: string;
  label: string;
  params: Record<string, unknown>;
  retryCount?: number;
  retryDelayMs?: number;
  continueOnError?: boolean;
  runResult?: NodeRunResult;
  isRunning?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Triggers: "#f59e0b",
  "Web & Scraping": "#06b6d4",
  "Parallel & Web": "#06b6d4",
  Web: "#06b6d4",
  "Core & Logic": "#8b5cf6",
  "Core/Logic": "#8b5cf6",
  Core: "#8b5cf6",
  Logic: "#8b5cf6",
  AI: "#6366f1",
  Messaging: "#0ea5e9",
  Database: "#10b981",
  Google: "#10b981",
  Payments: "#3b82f6",
  System: "#64748b",
};

function getCategoryColor(category?: string): string {
  if (!category) return "#6366f1";
  return CATEGORY_COLORS[category] || "#6366f1";
}

function getCategoryLabel(category?: string): string {
  if (!category) return "ACTION";
  if (category === "Parallel & Web") return "Web & Scraping";
  if (category === "Core") return "Core & Logic";
  return category;
}

function summarize(type: string, p: Record<string, unknown>): string {
  switch (type) {
    case "parallel_web": {
      const count = String(p.urls || "")
        .split(/[\r\n,]+/)
        .filter((x) => x.trim().startsWith("http")).length;
      return `${count || 1} sites in parallel`;
    }
    case "db_query":
      return `${p.operation || "insert"} → ${p.table || "table"}`;
    case "telegram_trigger":
      return p.commandFilter ? `filter: ${p.commandFilter}` : "all messages";
    case "form_trigger":
      return `form: ${p.formSlug || "parallel-websites"}`;
    case "http_request":
      return `${p.method || "GET"} ${String(p.url || "").replace(/^https?:\/\//, "").slice(0, 22)}`;
    case "schedule_trigger":
      return `cron: ${p.cron || "* * * * *"}`;
    case "webhook_trigger":
      return `${p.method || "ANY"} /api/webhook/${p.path || "hook"}`;
    case "if":
      return `${p.left || "$json"} ${p.operator || "equals"} ${p.right ?? ""}`;
    case "gemini":
    case "openai_chat":
      return String(p.model || "LLM");
    case "whatsapp":
      return `to: ${p.to || "—"}`;
    case "telegram":
      return `chat: ${p.chatId || "—"}`;
    case "razorpay":
    case "stripe":
      return `${p.operation || "pay"} · ${p.amount ?? ""}`;
    case "google_sheets":
      return `${p.operation || "append"} · ${p.range || "Sheet1"}`;
    case "read_file":
    case "write_file":
      return String(p.path || "");
    case "exec":
      return String(p.command || "").slice(0, 22);
    default:
      return "";
  }
}

export const CanvasNode = memo(function CanvasNode({ data, selected }: NodeProps) {
  const d = data as CanvasNodeData;
  const meta = NODE_MAP[d.nodeType];
  const outputs = meta?.outputs ?? ["main"];
  const sub = summarize(d.nodeType, d.params ?? {});
  const res = d.runResult;
  const catColor = getCategoryColor(meta?.category);
  const categoryLabel = getCategoryLabel(meta?.category);

  const borderClass = d.isRunning
    ? "border-amber-500 ring-2 ring-amber-500/40 shadow-amber-500/10 shadow-lg animate-pulse"
    : selected
      ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-500/20 shadow-2xl"
      : res?.status === "error"
        ? "border-rose-500/80 ring-1 ring-rose-500/30 shadow-rose-950/20"
        : res?.status === "success"
          ? "border-emerald-500/50 shadow-emerald-950/20"
          : "border-zinc-700/60 hover:border-zinc-500/80";

  const hasResilienceBadges = (d.retryCount ?? 0) > 0 || Boolean(d.continueOnError);

  return (
    <div
      className={`group relative w-[240px] rounded-xl bg-[#161822] border p-3 shadow-xl shadow-black/40 transition-all duration-150 ${borderClass}`}
    >
      {/* Category left colored accent pill */}
      <div
        className="pointer-events-none absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-90 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: catColor }}
      />

      {/* Subtle top accent hairline */}
      <div
        className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-b-full opacity-60 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: catColor }}
      />

      {/* Target Handle (Input) */}
      {!meta?.isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          title="Input"
          className="!-left-[7px] !h-3.5 !w-3.5 !rounded-full !border-2 !border-zinc-900 !bg-zinc-400 transition-all hover:!bg-indigo-400 hover:!scale-125"
        />
      )}

      {/* Node Header */}
      <div className="flex items-center gap-2.5 pl-1">
        {/* 36x36 icon container with subtle category background tint and crisp colored icon */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-150 group-hover:scale-105"
          style={{
            backgroundColor: `${catColor}15`,
            borderColor: `${catColor}30`,
            color: catColor,
          }}
        >
          <NodeIcon name={meta?.icon ?? "Box"} className="h-5 w-5" />
        </div>

        {/* Right / Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {categoryLabel}
            </span>
            {meta?.isTrigger && (
              <Zap className="h-2.5 w-2.5 text-amber-400 fill-amber-400/40" />
            )}
          </div>
          <div className="truncate text-sm font-semibold text-zinc-100 transition-colors group-hover:text-white">
            {d.label}
          </div>
        </div>
      </div>

      {/* Node Body / Preview */}
      {sub && (
        <div className="mt-1.5 pl-1">
          <div className="truncate rounded border border-white/5 bg-black/30 px-2 py-1 font-mono text-xs text-zinc-300">
            {sub}
          </div>
        </div>
      )}

      {/* Resilience badges if configured */}
      {hasResilienceBadges && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-1">
          {(d.retryCount ?? 0) > 0 && (
            <span
              title={`Auto-retry up to ${d.retryCount} times (${d.retryDelayMs ?? 500}ms delay)`}
              className="inline-flex items-center gap-1 rounded border border-zinc-700/60 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300"
            >
              <RotateCw className="h-2.5 w-2.5 text-indigo-400" />
              {d.retryCount}x
            </span>
          )}
          {d.continueOnError && (
            <span
              title="Continue workflow even if this node fails"
              className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300"
            >
              <ShieldCheck className="h-2.5 w-2.5 text-amber-400" />
              shield
            </span>
          )}
        </div>
      )}

      {/* Status Footer */}
      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/80 pt-2 pl-1">
        {d.isRunning ? (
          <div className="flex items-center gap-1.5">
            <RotateCw className="h-3 w-3 animate-spin text-amber-400" />
            <span className="font-mono text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
              Running
            </span>
          </div>
        ) : res?.status === "success" ? (
          <div className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </span>
            <span className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-300">
              {res.durationMs !== undefined ? `${res.durationMs}ms` : "32ms"}
            </span>
            {res.wave !== undefined && (
              <span className="inline-flex items-center rounded border border-zinc-700/60 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
                wave {res.wave + 1}
              </span>
            )}
          </div>
        ) : res?.status === "error" ? (
          <div className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-300">
            <AlertCircle className="h-3 w-3 text-rose-400" />
            <span>{res.error ? String(res.error).slice(0, 18) : "Error"}</span>
          </div>
        ) : res?.status === "skipped" ? (
          <div className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
            <MinusCircle className="h-3 w-3" />
            <span>Skipped</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-500/80 ring-1 ring-zinc-400/20" title="Idle" />
            <span className="text-[10px] font-medium text-zinc-400">Idle</span>
          </div>
        )}

        <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
          {d.isRunning ? "busy" : res?.status ? res.status : "ready"}
        </span>
      </div>

      {/* Output Handles */}
      {outputs.length === 1 ? (
        <Handle
          type="source"
          id="main"
          position={Position.Right}
          title="Output: main"
          className="!-right-[7px] !h-3.5 !w-3.5 !rounded-full !border-2 !border-zinc-900 !bg-zinc-400 transition-all hover:!bg-indigo-400 hover:!scale-125"
        />
      ) : (
        outputs.map((h, i) => {
          const topPct = ((i + 1) / (outputs.length + 1)) * 100;
          const isTrue = h === "true";
          const isFalse = h === "false";
          return (
            <div key={h} className="group/branch">
              <span
                style={{ top: `${topPct}%` }}
                className={`pointer-events-none absolute right-3 -translate-y-1/2 font-mono text-[10px] font-semibold transition-colors ${
                  isTrue
                    ? "text-emerald-400 group-hover/branch:text-emerald-300"
                    : isFalse
                      ? "text-rose-400 group-hover/branch:text-rose-300"
                      : "text-zinc-400"
                }`}
              >
                {h}
              </span>
              <Handle
                type="source"
                id={h}
                position={Position.Right}
                title={`Branch: ${h}`}
                style={{ top: `${topPct}%` }}
                className={`!-right-[7px] !h-3.5 !w-3.5 !rounded-full !border-2 !border-zinc-900 transition-all hover:!scale-125 ${
                  isTrue
                    ? "!bg-emerald-500 hover:!bg-emerald-400"
                    : isFalse
                      ? "!bg-rose-500 hover:!bg-rose-400"
                      : "!bg-zinc-400 hover:!bg-indigo-400"
                }`}
              />
            </div>
          );
        })
      )}
    </div>
  );
});

"use client";

import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  Trash2,
  X,
  Play,
  Sparkles,
  ShieldAlert,
  Layers,
  Clock,
  Database,
  Plus,
  Terminal,
  ChevronDown,
} from "lucide-react";
import { NODE_MAP } from "@/lib/nodes";
import type { FieldDef, NodeRunResult, WorkflowNode } from "@/lib/types";
import { NodeIcon } from "./NodeIcon";

interface InspectorProps {
  node: WorkflowNode;
  runResult?: NodeRunResult;
  onChange: (patch: Partial<WorkflowNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  onRunFromHere?: () => void;
}

const QUICK_EXPRESSIONS = [
  { label: "$json", expr: "{{ $json }}" },
  { label: "$secrets", expr: "{{ $secrets.API_KEY }}" },
  { label: "$node", expr: "{{ $node['Previous Node'].json }}" },
  { label: "$today", expr: "{{ $today }}" },
];

function getOutputItemCount(res?: NodeRunResult): number {
  if (!res?.output) return 0;
  if (Array.isArray(res.output)) return res.output.length;
  return Object.values(res.output).reduce((acc, arr) => acc + arr.length, 0);
}

/**
 * Lightweight syntax highlighter for formatted JSON lines
 */
function highlightJsonTokens(line: string): React.ReactNode {
  const tokenRegex =
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|([{}[\],])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      elements.push(line.slice(lastIndex, match.index));
    }

    const [full, stringVal, colon, keyword, punct] = match;

    if (colon) {
      elements.push(
        <span key={match.index} className="text-sky-300 font-medium">
          {stringVal}
        </span>
      );
      elements.push(
        <span key={`${match.index}-colon`} className="text-zinc-500">
          {colon}
        </span>
      );
    } else if (stringVal) {
      elements.push(
        <span key={match.index} className="text-emerald-300">
          {stringVal}
        </span>
      );
    } else if (keyword) {
      if (keyword === "true" || keyword === "false") {
        elements.push(
          <span key={match.index} className="text-purple-300 font-semibold">
            {keyword}
          </span>
        );
      } else {
        elements.push(
          <span key={match.index} className="text-rose-400 font-semibold">
            {keyword}
          </span>
        );
      }
    } else if (punct) {
      elements.push(
        <span key={match.index} className="text-zinc-500">
          {punct}
        </span>
      );
    } else {
      elements.push(
        <span key={match.index} className="text-amber-300 font-mono">
          {full}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    elements.push(line.slice(lastIndex));
  }

  return elements.length > 0 ? elements : line;
}

function SyntaxJsonViewer({ data }: { data: unknown }) {
  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(data ?? [], null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const lines = useMemo(() => jsonString.split("\n"), [jsonString]);

  return (
    <div className="relative rounded-xl border border-white/10 bg-[#0a0c12] overflow-hidden shadow-inner">
      <div className="max-h-[500px] overflow-auto py-3 font-mono text-[11px] leading-relaxed">
        {lines.map((line, idx) => (
          <div key={idx} className="flex px-3 hover:bg-white/[0.02] transition-colors">
            <span className="w-8 shrink-0 select-none text-right pr-3 text-zinc-600 font-mono text-[10px] leading-relaxed border-r border-white/[0.06] mr-3">
              {idx + 1}
            </span>
            <span className="flex-1 whitespace-pre font-mono">{highlightJsonTokens(line)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Inspector({
  node,
  runResult,
  onChange,
  onDelete,
  onClose,
  onRunFromHere,
}: InspectorProps) {
  const meta = NODE_MAP[node.type];
  const [tab, setTab] = useState<"params" | "output" | "input">("params");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedExpr, setCopiedExpr] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<"output" | "input" | null>(null);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const [resilienceOpen, setResilienceOpen] = useState(
    Boolean(node.retryCount || node.continueOnError)
  );

  if (!meta) return null;

  const setParam = (key: string, value: unknown) => {
    onChange({ params: { ...node.params, [key]: value } });
  };

  const webhookUrl =
    node.type === "webhook_trigger" && typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook/${String(node.params.path || "my-hook").replace(/^\/+/, "")}`
      : null;

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1500);
  };

  const handleInsertExpression = (expr: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(expr).catch(() => {});
    }

    // Find target field: either currently focused text-like field or first text/textarea/code/json field
    const targetField =
      meta.fields.find(
        (f) =>
          f.key === focusedFieldKey &&
          (f.type === "text" || f.type === "textarea" || f.type === "code" || f.type === "json")
      ) ??
      meta.fields.find(
        (f) => f.type === "text" || f.type === "textarea" || f.type === "code" || f.type === "json"
      );

    if (targetField) {
      const currentVal = node.params[targetField.key] ?? targetField.default ?? "";
      const currentStr =
        typeof currentVal === "string" ? currentVal : JSON.stringify(currentVal, null, 2);
      const nextStr = currentStr
        ? `${currentStr}${currentStr.endsWith(" ") ? "" : " "}${expr}`
        : expr;
      setParam(targetField.key, nextStr);
    }

    setCopiedExpr(expr);
    setTimeout(() => setCopiedExpr(null), 1200);
  };

  const copyJsonPayload = (kind: "output" | "input", data: unknown) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(data ?? [], null, 2)).catch(() => {});
    }
    setCopiedJson(kind);
    setTimeout(() => setCopiedJson(null), 1500);
  };

  const outputCount = getOutputItemCount(runResult);
  const inputCount = runResult?.input?.length ?? 0;

  return (
    <aside className="flex h-full w-[360px] max-w-full shrink-0 flex-col border-l border-white/10 bg-[#12141c]/95 backdrop-blur-xl shadow-2xl animate-[slideInRight_0.2s_ease-out] z-30">
      {/* ─── Header: 36x36 Category icon badge, editable node name & actions ─── */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0f121b]/80">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* 36x36 category icon badge */}
          <div
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform"
            style={{
              backgroundColor: `${meta.color}15`,
              borderColor: `${meta.color}35`,
              boxShadow: `0 0 14px -3px ${meta.color}30`,
            }}
          >
            <NodeIcon name={meta.icon} className="h-4.5 w-4.5" style={{ color: meta.color }} />
          </div>

          <div className="min-w-0 flex-1 pr-2">
            <input
              value={node.name}
              onChange={(e) => onChange({ name: e.target.value })}
              title="Click to rename node"
              className="w-full truncate rounded-md bg-transparent px-1.5 py-0.5 text-xs font-semibold text-zinc-100 outline-none transition border border-transparent hover:border-white/10 hover:bg-white/[0.04] focus:border-indigo-500 focus:bg-black/50 focus:ring-1 focus:ring-indigo-500/50"
            />
            <div className="flex items-center gap-1.5 mt-0.5 px-1.5">
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400 border border-white/10">
                {meta.category}
              </span>
              <span className="truncate text-[11px] text-zinc-400">
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {meta.isTrigger && onRunFromHere && (
            <button
              onClick={onRunFromHere}
              title="Trigger workflow execution from this node"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 transition"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </button>
          )}
          <button
            onClick={onDelete}
            title="Delete this node (Del)"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close Inspector (Esc)"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Tabs: Parameters, Output Data, Input Data ─── */}
      <div className="px-3.5 py-2.5 border-b border-white/10 bg-black/20">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
          {(
            [
              { id: "params", label: "Parameters" },
              { id: "output", label: "Output Data", count: outputCount, status: runResult?.status },
              { id: "input", label: "Input Data", count: inputCount },
            ] as const
          ).map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-white shadow-sm border border-white/15"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <span className="truncate">{t.label}</span>
                {t.id === "output" && t.status && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono font-semibold ${
                      t.status === "success"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : t.status === "error"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-zinc-700 text-zinc-300"
                    }`}
                  >
                    {t.status === "success" ? t.count : "!"}
                  </span>
                )}
                {t.id === "input" && (t.count ?? 0) > 0 && (
                  <span className="rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 text-[9px] font-mono font-semibold">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Body Content ─── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "params" && (
          <>
            {/* Live Webhook Info Callout */}
            {webhookUrl && (
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-orange-300">
                    <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                    <span>Live Webhook Endpoint</span>
                  </div>
                  <span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-orange-200 border border-orange-500/30">
                    POST
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 truncate rounded-md bg-black/50 border border-orange-500/20 px-2 py-1 font-mono text-[11px] text-orange-200">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={copyWebhook}
                    title="Copy Webhook URL"
                    className="inline-flex items-center justify-center h-7 px-2 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-200 hover:bg-orange-500/25 transition text-xs"
                  >
                    {copiedWebhook ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="text-[11px] text-orange-200/70 leading-relaxed">
                  Toggle workflow <strong>Active</strong> in top bar to receive live external payloads.
                </div>
              </div>
            )}

            {/* Quick Expression Chips */}
            <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-300">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  <span>Quick Expressions</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {focusedFieldKey ? `Insert: ${focusedFieldKey}` : "Click to insert"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_EXPRESSIONS.map((item) => {
                  const isCopied = copiedExpr === item.expr;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleInsertExpression(item.expr)}
                      title={`Click to insert ${item.expr}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-mono font-medium transition-all ${
                        isCopied
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 shadow-sm"
                          : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-200"
                      }`}
                    >
                      {isCopied ? (
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      ) : (
                        <Plus className="h-2.5 w-2.5 text-zinc-400" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parameter Fields */}
            <div className="space-y-3.5">
              {meta.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={node.params[field.key] ?? field.default ?? ""}
                  isFocused={focusedFieldKey === field.key}
                  onFocus={() => setFocusedFieldKey(field.key)}
                  onChange={(val) => setParam(field.key, val)}
                />
              ))}
            </div>

            {/* Resilience options (Retry & Continue-on-Error): Clean accordion or card */}
            {!meta.isTrigger && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setResilienceOpen(!resilienceOpen)}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-200">Retry &amp; Resilience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/10">
                      {node.retryCount ? `${node.retryCount}x retry` : "Off"}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${
                        resilienceOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {resilienceOpen && (
                  <div className="p-3.5 pt-0 space-y-3 border-t border-white/[0.06]">
                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
                          Auto-Retries (0–5)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={node.retryCount ?? 0}
                          onChange={(e) =>
                            onChange({ retryCount: Math.max(0, Math.min(5, Number(e.target.value))) })
                          }
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">
                          Delay (ms)
                        </label>
                        <input
                          type="number"
                          min={50}
                          step={100}
                          value={node.retryDelayMs ?? 500}
                          onChange={(e) =>
                            onChange({ retryDelayMs: Math.max(50, Number(e.target.value)) })
                          }
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(node.continueOnError)}
                        onChange={(e) => onChange({ continueOnError: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/30 accent-indigo-500"
                      />
                      <div className="text-xs">
                        <span className="font-medium text-zinc-200">Continue on Error</span>
                        <p className="text-[11px] text-zinc-400 leading-normal mt-0.5">
                          Continue workflow downstream if this node encounters an error.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "output" && (
          <div className="space-y-3">
            {!runResult ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center space-y-2">
                <Terminal className="h-8 w-8 text-zinc-600 mx-auto" />
                <div className="text-xs font-medium text-zinc-300">No output recorded yet</div>
                <p className="text-[11px] text-zinc-500 max-w-[260px] mx-auto">
                  Execute the workflow to inspect live output records, payload items, and execution duration.
                </p>
              </div>
            ) : (
              <>
                {/* Telemetry Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        runResult.status === "success"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : runResult.status === "error"
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                      }`}
                    >
                      {runResult.status === "success" && (
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      )}
                      {runResult.status}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                      <Database className="h-2.5 w-2.5 text-indigo-400" />
                      {outputCount} item{outputCount === 1 ? "" : "s"}
                    </span>

                    {runResult.wave !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                        <Layers className="h-2.5 w-2.5 text-cyan-400" />
                        Wave {runResult.wave + 1}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                      <Clock className="h-2.5 w-2.5 text-zinc-500" />
                      {runResult.durationMs} ms
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyJsonPayload("output", runResult.output ?? [])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition"
                    title="Copy Output JSON"
                  >
                    {copiedJson === "output" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>

                {runResult.error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 font-mono text-xs text-rose-200 whitespace-pre-wrap leading-relaxed">
                    <div className="font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Execution Error
                    </div>
                    {runResult.error}
                  </div>
                )}

                <SyntaxJsonViewer data={runResult.output ?? []} />
              </>
            )}
          </div>
        )}

        {tab === "input" && (
          <div className="space-y-3">
            {!runResult?.input ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center space-y-2">
                <Database className="h-8 w-8 text-zinc-600 mx-auto" />
                <div className="text-xs font-medium text-zinc-300">No input records available</div>
                <p className="text-[11px] text-zinc-500 max-w-[260px] mx-auto">
                  Input data appears after an upstream node passes its payload into this node.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-medium text-sky-300">
                      <Database className="h-2.5 w-2.5 text-sky-400" />
                      {inputCount} input item{inputCount === 1 ? "" : "s"}
                    </span>
                    {runResult.wave !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                        <Layers className="h-2.5 w-2.5 text-cyan-400" />
                        Wave {runResult.wave + 1}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => copyJsonPayload("input", runResult.input)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition"
                    title="Copy Input JSON"
                  >
                    {copiedJson === "input" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <SyntaxJsonViewer data={runResult.input} />
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function FieldInput({
  field,
  value,
  isFocused,
  onFocus,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  isFocused?: boolean;
  onFocus?: () => void;
  onChange: (v: unknown) => void;
}) {
  const inputClass =
    "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-zinc-200">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400/90 font-normal">*</span>}
        </label>
        {isFocused && (
          <span className="text-[10px] font-mono text-indigo-400 font-medium">active</span>
        )}
      </div>

      {field.type === "select" ? (
        <select
          value={String(value ?? "")}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} bg-[#12141c] text-zinc-100 cursor-pointer`}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#12141c] text-zinc-100">
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "boolean" ? (
        <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/30 accent-indigo-500"
          />
          <span className="text-xs text-zinc-200">
            {Boolean(value) ? "Enabled" : "Disabled"}
          </span>
        </label>
      ) : field.type === "textarea" || field.type === "json" || field.type === "code" ? (
        <textarea
          rows={field.type === "code" ? 7 : field.type === "json" ? 5 : 4}
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          placeholder={field.placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} leading-relaxed resize-y ${
            field.type === "code" || field.type === "json" ? "font-mono" : ""
          }`}
        />
      ) : field.type === "number" ? (
        <input
          type="number"
          value={Number(value ?? 0)}
          placeholder={field.placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.help && <p className="text-[11px] leading-relaxed text-zinc-400">{field.help}</p>}
    </div>
  );
}

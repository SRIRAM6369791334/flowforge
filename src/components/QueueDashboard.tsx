"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Gauge,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { Workflow } from "@/lib/types";

export interface QueueJobView {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: "manual" | "schedule" | "webhook" | "telegram" | "form" | "parallel_batch";
  priority: number;
  status: "queued" | "running" | "completed" | "failed";
  workerId?: number;
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  waitTimeMs?: number;
  runTimeMs?: number;
  executionId?: string;
  error?: string;
}

export interface QueueStateView {
  mode: "parallel_pool" | "sequential_fifo";
  concurrency: number;
  activeWorkers: number | unknown[];
  stats: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    avgWaitMs: number;
    avgRunMs: number;
    throughputPerMin?: number;
  };
  jobs: QueueJobView[];
}

export interface QueueDashboardProps {
  workflows: Workflow[];
  onInspectExecution: (executionId: string) => void;
  onToast?: (msg: string, kind?: "success" | "info" | "error") => void;
  onQueueStatsChange?: (stats: {
    queued: number;
    running: number;
    mode: string;
    concurrency: number;
  }) => void;
  compact?: boolean;
}

export function QueueDashboard({
  workflows,
  onInspectExecution,
  onToast,
  onQueueStatsChange,
}: QueueDashboardProps) {
  const [state, setState] = useState<QueueStateView>({
    mode: "parallel_pool",
    concurrency: 6,
    activeWorkers: 0,
    stats: {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      avgWaitMs: 0,
      avgRunMs: 0,
      throughputPerMin: 0,
    },
    jobs: [],
  });

  const [burstSize, setBurstSize] = useState<number>(10);
  const [targetWorkflowId, setTargetWorkflowId] = useState<string>("all");
  const [firingBurst, setFiringBurst] = useState(false);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [enqueuingSingle, setEnqueuingSingle] = useState(false);
  const [sliderValue, setSliderValue] = useState<number>(6);
  const [sliderDragging, setSliderDragging] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as QueueStateView;
      if (data && data.stats) {
        setState(data);
        if (!sliderDragging) {
          setSliderValue(data.concurrency || 6);
        }
        onQueueStatsChange?.({
          queued: data.stats.queued ?? 0,
          running: data.stats.running ?? 0,
          mode: data.mode,
          concurrency: data.concurrency,
        });
      }
    } catch {
      // ignore transient network errors during background polling
    }
  }, [onQueueStatsChange, sliderDragging]);

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(fetchQueue, 1500);
    return () => clearInterval(timer);
  }, [fetchQueue]);

  const updateConfig = async (mode: "parallel_pool" | "sequential_fifo", concurrency: number) => {
    setUpdatingConfig(true);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "config", mode, concurrency }),
      });
      if (res.ok) {
        await fetchQueue();
        onToast?.(
          mode === "parallel_pool"
            ? `⚡ Switched to Parallel Worker Pool (${concurrency}x concurrent workers)`
            : "⏳ Switched to Sequential FIFO Queue (strict 1-by-1 order)",
          "info"
        );
      }
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleFireBurst = async () => {
    if (firingBurst) return;
    setFiringBurst(true);
    try {
      const workflowIds =
        targetWorkflowId === "all" ? workflows.map((w) => w.id) : [targetWorkflowId];

      onToast?.(
        `🔥 Fired ${burstSize} simultaneous requests into the ${
          state.mode === "parallel_pool"
            ? `${state.concurrency}-worker parallel pool`
            : "FIFO queue"
        }!`,
        "info"
      );

      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "burst",
          burstCount: burstSize,
          workflowIds: workflowIds.length > 0 ? workflowIds : undefined,
        }),
      });
      const data = await res.json();
      await fetchQueue();
      const wallMs = data?.parallelWallTimeMs ?? data?.wallTimeMs;
      onToast?.(
        `✅ Burst of ${burstSize} concurrent requests processed${wallMs ? ` in ${wallMs} ms` : ""}!`,
        "success"
      );
    } catch {
      onToast?.("Failed to trigger request burst", "error");
    } finally {
      setFiringBurst(false);
    }
  };

  const handleEnqueueSingle = async (priority = 5) => {
    if (enqueuingSingle) return;
    setEnqueuingSingle(true);
    try {
      const wfId = targetWorkflowId === "all" ? workflows[0]?.id : targetWorkflowId;
      if (!wfId) return;
      await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "enqueue",
          workflowId: wfId,
          priority,
          wait: false,
        }),
      });
      await fetchQueue();
      onToast?.(`📥 Enqueued priority job (P${priority}) into worker pool`, "info");
    } finally {
      setEnqueuingSingle(false);
    }
  };

  const handleClearFinished = async () => {
    await fetch("/api/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    await fetchQueue();
    onToast?.("Cleared finished jobs from queue history", "info");
  };

  const effectiveConcurrency =
    state.mode === "sequential_fifo"
      ? 1
      : Math.max(1, Math.min(16, state.concurrency || 6));
  const runningJobs = state.jobs.filter((j) => j.status === "running");

  // Worker slots array 1..effectiveConcurrency
  const workerSlots = Array.from({ length: effectiveConcurrency }, (_, idx) => {
    const slotNum = idx + 1;
    const assignedJob =
      runningJobs.find((j) => j.workerId === slotNum) ?? runningJobs[idx] ?? null;
    return {
      slotNum,
      job: assignedJob,
    };
  });

  const avgLatencyMs = Math.round(state.stats.avgRunMs || 0);
  const avgWaitMs = Math.round(state.stats.avgWaitMs || 0);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e15]/95 backdrop-blur-xl p-4 sm:p-5 shadow-2xl space-y-4 text-zinc-100 transition-all">
      {/* ─── 1. TOP BAR: Mode Pill Toggle, Concurrency Slider & Burst Trigger Controls ─── */}
      <div className="flex flex-col gap-3.5 border-b border-white/[0.08] pb-4">
        {/* Title & Live Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-white">
                  Worker Pool &amp; Concurrent Queue
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-none mt-0.5">
                Multi-thread parallel workflow execution and load-spike resilience
              </p>
            </div>
          </div>

          {/* Mode Pill Toggle */}
          <div className="inline-flex items-center p-1 rounded-xl bg-black/40 border border-white/[0.08]">
            <button
              onClick={() => updateConfig("parallel_pool", sliderValue)}
              disabled={updatingConfig}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                state.mode === "parallel_pool"
                  ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span>Parallel Worker Pool</span>
            </button>
            <button
              onClick={() => updateConfig("sequential_fifo", state.concurrency)}
              disabled={updatingConfig}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                state.mode === "sequential_fifo"
                  ? "bg-amber-600/25 text-amber-200 border border-amber-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>Sequential FIFO</span>
            </button>
          </div>
        </div>

        {/* Controls Row: Concurrency Slider + Burst Controls */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-center">
          {/* Concurrency Slider (1x .. 16x) */}
          <div className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-black/30 p-3 flex flex-col justify-center space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                <span>Pool Concurrency</span>
              </div>
              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-300">
                {state.mode === "sequential_fifo" ? "1x (FIFO)" : `${sliderValue}x Workers`}
              </span>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min={1}
                max={16}
                disabled={state.mode === "sequential_fifo"}
                value={sliderValue}
                onMouseDown={() => setSliderDragging(true)}
                onTouchStart={() => setSliderDragging(true)}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                onMouseUp={(e) => {
                  setSliderDragging(false);
                  updateConfig("parallel_pool", Number((e.target as HTMLInputElement).value));
                }}
                onTouchEnd={(e) => {
                  setSliderDragging(false);
                  updateConfig("parallel_pool", Number((e.target as HTMLInputElement).value));
                }}
                className="w-full accent-indigo-400 cursor-pointer disabled:opacity-30 h-1.5 bg-zinc-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[9px] font-mono text-zinc-500 px-0.5">
                <span>1x</span>
                <span>4x</span>
                <span>8x</span>
                <span>12x</span>
                <span>16x</span>
              </div>
            </div>
          </div>

          {/* Burst Trigger Controls (5x, 10x, 20x) */}
          <div className="lg:col-span-7 rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                <span>Simulate Traffic Burst</span>
              </div>

              {/* 5x, 10x, 20x Burst Pills */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
                {[5, 10, 20].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setBurstSize(cnt)}
                    className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold transition ${
                      burstSize === cnt
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {cnt}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={targetWorkflowId}
                onChange={(e) => setTargetWorkflowId(e.target.value)}
                className="flex-1 min-w-[160px] rounded-md border border-white/[0.08] bg-black/50 px-2.5 py-1.5 text-xs text-zinc-200 outline-none transition focus:border-indigo-500/80 cursor-pointer"
              >
                <option value="all">All Active Workflows</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleEnqueueSingle(10)}
                disabled={enqueuingSingle}
                title="Enqueue 1 priority job into queue"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.07] hover:text-white transition disabled:opacity-50"
              >
                {enqueuingSingle ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-indigo-400 fill-current" />
                )}
                <span>+1 Priority</span>
              </button>

              <button
                onClick={handleFireBurst}
                disabled={firingBurst}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:from-orange-400 hover:to-rose-400 transition disabled:opacity-50"
              >
                {firingBurst ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Flame className="h-3.5 w-3.5 fill-current" />
                )}
                <span>{firingBurst ? `Firing ${burstSize}x…` : `Fire Burst (${burstSize}x)`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. LIVE STATS STRIP: Compact KPI Metrics ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Queued */}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            <span>Queued</span>
            <Layers className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-amber-300">
            {state.stats.queued}
          </div>
          <div className="text-[10px] text-zinc-500 leading-none">Awaiting worker slot</div>
        </div>

        {/* Running */}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            <span>Running</span>
            <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-cyan-300">
            {state.stats.running}{" "}
            <span className="text-xs font-normal text-zinc-500">/ {effectiveConcurrency}</span>
          </div>
          <div className="text-[10px] text-zinc-500 leading-none">Active parallel threads</div>
        </div>

        {/* Completed */}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            <span>Completed</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-emerald-300">
            {state.stats.completed}
          </div>
          <div className="text-[10px] text-zinc-500 leading-none">Successful executions</div>
        </div>

        {/* Failed */}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            <span>Failed</span>
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-rose-400">
            {state.stats.failed}
          </div>
          <div className="text-[10px] text-zinc-500 leading-none">Errored executions</div>
        </div>

        {/* Avg Latency */}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            <span>Avg Latency</span>
            <Gauge className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-indigo-300">
            {avgLatencyMs}
            <span className="text-xs font-normal text-zinc-500 ml-0.5">ms</span>
          </div>
          <div className="text-[10px] text-zinc-500 leading-none">
            Queue wait: {avgWaitMs}ms
          </div>
        </div>
      </div>

      {/* ─── 3. WORKER POOL GRID: Sleek Compact Worker Slot Cards ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              Worker Pool Slots ({workerSlots.filter((s) => s.job).length} of {effectiveConcurrency}{" "}
              Busy)
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {state.mode === "parallel_pool" ? "Multi-Threaded Pool" : "Single-Thread FIFO"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {workerSlots.map(({ slotNum, job }) => {
            const isActive = Boolean(job);
            return (
              <div
                key={slotNum}
                className={`relative overflow-hidden rounded-xl border p-2.5 transition-all ${
                  isActive
                    ? "border-cyan-500/40 bg-gradient-to-b from-cyan-500/10 to-transparent shadow-sm"
                    : "border-white/[0.06] bg-black/20 hover:border-white/[0.1]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-zinc-200">
                    Worker #{slotNum}
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? "bg-cyan-400 animate-pulse" : "bg-zinc-600"
                      }`}
                    />
                    <span
                      className={`text-[9px] font-mono font-semibold uppercase ${
                        isActive ? "text-cyan-300" : "text-zinc-500"
                      }`}
                    >
                      {isActive ? "BUSY" : "IDLE"}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 min-h-[30px] flex flex-col justify-center">
                  {job ? (
                    <>
                      <div
                        className="truncate text-xs font-medium text-white"
                        title={job.workflowName}
                      >
                        {job.workflowName}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300/80 mt-0.5">
                        <span>#{job.id.slice(0, 8)}</span>
                        <span className="rounded bg-indigo-500/20 px-1 text-[9px] text-indigo-300">
                          P{job.priority}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-500 font-normal">Standby · Ready</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 4. JOBS TABLE: High-Density, Clean Rows with Status Pills & Metrics ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span>Live Job Telemetry ({state.jobs.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchQueue}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/[0.08] bg-white/[0.03] text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleClearFinished}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/[0.08] bg-white/[0.03] text-[11px] text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear Finished</span>
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/35">
          {state.jobs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 space-y-1">
              <div>Queue is currently empty.</div>
              <div className="text-[11px] text-zinc-600">
                Trigger a burst or run a workflow to watch parallel workers process jobs live.
              </div>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-white/[0.08] bg-[#12151f] text-[10px] font-semibold uppercase tracking-wider text-zinc-400 z-10">
                  <tr>
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">Workflow</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Worker</th>
                    <th className="px-3 py-2">Wait Time</th>
                    <th className="px-3 py-2">Exec Time</th>
                    <th className="px-3 py-2 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {state.jobs.slice(0, 50).map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => job.executionId && onInspectExecution(job.executionId)}
                      className={`transition ${
                        job.executionId
                          ? "cursor-pointer hover:bg-white/[0.04]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-400">
                        {job.id.slice(0, 10)}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-zinc-200">
                        {job.workflowName}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="rounded bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-indigo-300">
                          P{job.priority}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            job.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : job.status === "running"
                                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 animate-pulse"
                                : job.status === "queued"
                                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {job.status === "running" && (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          )}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-cyan-300">
                        {job.workerId ? `Worker #${job.workerId}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-300">
                        {job.waitTimeMs !== undefined ? `${job.waitTimeMs}ms` : "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-emerald-300">
                        {job.runTimeMs !== undefined ? `${job.runTimeMs}ms` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {job.executionId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-indigo-200">
                            <span>Canvas</span>
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

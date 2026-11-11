import { runWorkflow, type RunOptions, type RunResult } from "./engine";
import type { Workflow } from "./types";

export type QueueMode = "parallel_pool" | "sequential_fifo";

export interface QueueJob {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: "manual" | "schedule" | "webhook" | "telegram" | "form" | "parallel_batch";
  priority: number; // higher runs first
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

export interface WorkerSlot {
  id: number;
  workerId: number;
  status: "idle" | "active";
  jobId?: string;
  workflowId?: string;
  workflowName?: string;
  startedAt?: string;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  avgWaitMs: number;
  avgRunMs: number;
  throughputPerMin: number;
}

export interface QueueState {
  mode: QueueMode;
  concurrency: number;
  effectiveConcurrency: number;
  activeWorkers: number;
  workers: WorkerSlot[];
  stats: QueueStats;
  jobs: QueueJob[];
}

interface InternalJobEntry {
  seq: number;
  job: QueueJob;
  wf: Workflow;
  opts: RunOptions;
  minSimMs?: number;
  resolvers: Array<(res: { job: QueueJob; result?: RunResult }) => void>;
}

interface InternalQueueStore {
  mode: QueueMode;
  concurrency: number;
  seqCounter: number;
  entries: InternalJobEntry[];
  activeSlots: Map<number, string>; // workerId -> jobId
}

declare global {
  // eslint-disable-next-line no-var
  var __ffQueue: InternalQueueStore | undefined;
}

const MAX_JOB_HISTORY = 120;

function getStore(): InternalQueueStore {
  if (!globalThis.__ffQueue) {
    globalThis.__ffQueue = {
      mode: "parallel_pool",
      concurrency: 6,
      seqCounter: 0,
      entries: [],
      activeSlots: new Map<number, string>(),
    };
  }
  return globalThis.__ffQueue;
}

function getEffectiveConcurrency(store: InternalQueueStore): number {
  return store.mode === "sequential_fifo" ? 1 : Math.max(1, Math.min(20, store.concurrency));
}

function allocateWorkerSlot(store: InternalQueueStore, maxWorkers: number): number | undefined {
  for (let slot = 1; slot <= maxWorkers; slot++) {
    if (!store.activeSlots.has(slot)) {
      return slot;
    }
  }
  return undefined;
}

function trimHistory(store: InternalQueueStore) {
  if (store.entries.length <= MAX_JOB_HISTORY) return;
  const activeOrQueued = store.entries.filter(
    (e) => e.job.status === "queued" || e.job.status === "running"
  );
  const finished = store.entries
    .filter((e) => e.job.status === "completed" || e.job.status === "failed")
    .slice(-(MAX_JOB_HISTORY - activeOrQueued.length));
  store.entries = [...activeOrQueued, ...finished];
}

function pumpQueue() {
  const store = getStore();
  const maxWorkers = getEffectiveConcurrency(store);

  while (store.activeSlots.size < maxWorkers) {
    // Pick highest-priority queued job (FIFO tie-breaker via seq)
    const queuedEntries = store.entries.filter((e) => e.job.status === "queued");
    if (queuedEntries.length === 0) break;

    if (store.mode === "sequential_fifo") {
      queuedEntries.sort((a, b) => a.seq - b.seq);
    } else {
      queuedEntries.sort((a, b) => b.job.priority - a.job.priority || a.seq - b.seq);
    }

    const nextEntry = queuedEntries[0];
    const slot = allocateWorkerSlot(store, maxWorkers);
    if (slot === undefined) break;

    const nowMs = Date.now();
    const enqMs = new Date(nextEntry.job.enqueuedAt).getTime();
    nextEntry.job.status = "running";
    nextEntry.job.workerId = slot;
    nextEntry.job.startedAt = new Date(nowMs).toISOString();
    nextEntry.job.waitTimeMs = Math.max(0, nowMs - enqMs);
    store.activeSlots.set(slot, nextEntry.job.id);

    // Launch worker asynchronously in parallel
    void (async () => {
      const t0 = performance.now();
      let result: RunResult | undefined;
      try {
        result = await runWorkflow(nextEntry.wf, nextEntry.opts);
        const elapsed = performance.now() - t0;
        if (nextEntry.minSimMs && elapsed < nextEntry.minSimMs) {
          await new Promise((r) => setTimeout(r, nextEntry.minSimMs! - elapsed));
        }

        const finMs = Date.now();
        nextEntry.job.finishedAt = new Date(finMs).toISOString();
        nextEntry.job.runTimeMs = Math.max(1, Math.round(performance.now() - t0));
        nextEntry.job.executionId = result.execution.id;

        if (result.execution.status === "error") {
          nextEntry.job.status = "failed";
          nextEntry.job.error = result.execution.error ?? "Workflow execution error";
        } else {
          nextEntry.job.status = "completed";
        }
      } catch (err) {
        nextEntry.job.finishedAt = new Date().toISOString();
        nextEntry.job.runTimeMs = Math.max(1, Math.round(performance.now() - t0));
        nextEntry.job.status = "failed";
        nextEntry.job.error = (err as Error)?.message ?? "Unexpected worker error";
      } finally {
        store.activeSlots.delete(slot);
        const snapshot = { ...nextEntry.job };
        for (const resolve of nextEntry.resolvers) {
          try {
            resolve({ job: snapshot, result });
          } catch {
            /* ignore resolver errors */
          }
        }
        nextEntry.resolvers = [];
        trimHistory(store);
        pumpQueue();
      }
    })();
  }
}

export async function enqueueWorkflowRun(
  wf: Workflow,
  opts: RunOptions & { priority?: number; waitForCompletion?: boolean; minSimMs?: number }
): Promise<{ job: QueueJob; result?: RunResult }> {
  const store = getStore();
  const seq = ++store.seqCounter;
  const job: QueueJob = {
    id: `job_${seq}_${crypto.randomUUID().slice(0, 6)}`,
    workflowId: wf.id,
    workflowName: wf.name,
    mode: opts.mode,
    priority: typeof opts.priority === "number" && Number.isFinite(opts.priority) ? opts.priority : 1,
    status: "queued",
    enqueuedAt: new Date().toISOString(),
  };

  const entry: InternalJobEntry = {
    seq,
    job,
    wf,
    opts: {
      mode: opts.mode,
      triggerNodeId: opts.triggerNodeId,
      triggerData: opts.triggerData,
    },
    minSimMs: opts.minSimMs,
    resolvers: [],
  };

  store.entries.push(entry);

  const waitForCompletion = opts.waitForCompletion !== false;
  if (!waitForCompletion) {
    pumpQueue();
    return { job: { ...job } };
  }

  return new Promise<{ job: QueueJob; result?: RunResult }>((resolve) => {
    entry.resolvers.push(resolve);
    pumpQueue();
  });
}

export async function enqueueBurstRuns(
  wfs: Workflow[],
  countPerWorkflow = 1,
  triggerData?: Record<string, unknown>
): Promise<{
  batchId: string;
  jobs: QueueJob[];
  parallelWallTimeMs: number;
  totalJobs: number;
  mode: QueueMode;
  concurrency: number;
}> {
  const store = getStore();
  const batchId = `burst_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 4)}`;
  const count = Math.max(1, Math.min(30, Math.round(countPerWorkflow)));

  const burstItems: Array<{ wf: Workflow; index: number; priority: number }> = [];
  let idx = 0;
  for (let c = 0; c < count; c++) {
    for (const wf of wfs) {
      idx++;
      const priority = (idx % 3) + 1; // priorities 1..3 to demonstrate priority scheduling
      burstItems.push({ wf, index: idx, priority });
    }
  }

  const t0 = performance.now();
  const completed = await Promise.all(
    burstItems.map((item) =>
      enqueueWorkflowRun(item.wf, {
        mode: "parallel_batch",
        priority: item.priority,
        waitForCompletion: true,
        minSimMs: 220,
        triggerData: {
          ...triggerData,
          batchId,
          burstIndex: item.index,
          totalInBurst: burstItems.length,
          enqueuedAt: new Date().toISOString(),
        },
      })
    )
  );

  const parallelWallTimeMs = Math.round(performance.now() - t0);
  return {
    batchId,
    jobs: completed.map((c) => c.job),
    parallelWallTimeMs,
    totalJobs: completed.length,
    mode: store.mode,
    concurrency: getEffectiveConcurrency(store),
  };
}

export function getQueueState(): QueueState {
  const store = getStore();
  const effectiveConcurrency = getEffectiveConcurrency(store);

  const allJobs = store.entries.map((e) => ({ ...e.job }));
  const queued = allJobs.filter((j) => j.status === "queued").length;
  const running = allJobs.filter((j) => j.status === "running").length;
  const completed = allJobs.filter((j) => j.status === "completed").length;
  const failed = allJobs.filter((j) => j.status === "failed").length;

  const jobsWithWait = allJobs.filter((j) => typeof j.waitTimeMs === "number");
  const avgWaitMs =
    jobsWithWait.length > 0
      ? Math.round(jobsWithWait.reduce((acc, j) => acc + (j.waitTimeMs ?? 0), 0) / jobsWithWait.length)
      : 0;

  const jobsWithRun = allJobs.filter((j) => typeof j.runTimeMs === "number");
  const avgRunMs =
    jobsWithRun.length > 0
      ? Math.round(jobsWithRun.reduce((acc, j) => acc + (j.runTimeMs ?? 0), 0) / jobsWithRun.length)
      : 0;

  const now = Date.now();
  const finishedLastMin = allJobs.filter(
    (j) =>
      (j.status === "completed" || j.status === "failed") &&
      j.finishedAt &&
      now - new Date(j.finishedAt).getTime() <= 60_000
  ).length;

  const workers: WorkerSlot[] = Array.from({ length: effectiveConcurrency }, (_, idx) => {
    const slot = idx + 1;
    const activeJobId = store.activeSlots.get(slot);
    const activeEntry = activeJobId ? store.entries.find((e) => e.job.id === activeJobId) : undefined;
    return {
      id: slot,
      workerId: slot,
      status: activeEntry ? "active" : "idle",
      jobId: activeEntry?.job.id,
      workflowId: activeEntry?.job.workflowId,
      workflowName: activeEntry?.job.workflowName,
      startedAt: activeEntry?.job.startedAt,
    };
  });

  // Sort jobs: running first, then queued, then finished (newest first)
  const statusRank: Record<QueueJob["status"], number> = {
    running: 0,
    queued: 1,
    completed: 2,
    failed: 2,
  };
  const sortedJobs = [...allJobs].sort((a, b) => {
    const rA = statusRank[a.status];
    const rB = statusRank[b.status];
    if (rA !== rB) return rA - rB;
    if (a.status === "running" && b.status === "running") {
      return (a.workerId ?? 0) - (b.workerId ?? 0);
    }
    if (a.status === "queued" && b.status === "queued") {
      return b.priority - a.priority || a.enqueuedAt.localeCompare(b.enqueuedAt);
    }
    return b.enqueuedAt.localeCompare(a.enqueuedAt);
  });

  return {
    mode: store.mode,
    concurrency: store.concurrency,
    effectiveConcurrency,
    activeWorkers: store.activeSlots.size,
    workers,
    stats: {
      queued,
      running,
      completed,
      failed,
      avgWaitMs,
      avgRunMs,
      throughputPerMin: finishedLastMin,
    },
    jobs: sortedJobs,
  };
}

export function setQueueConfig(cfg: {
  mode?: "parallel_pool" | "sequential_fifo";
  concurrency?: number;
}): QueueState {
  const store = getStore();
  if (cfg.mode === "parallel_pool" || cfg.mode === "sequential_fifo") {
    store.mode = cfg.mode;
  }
  if (typeof cfg.concurrency === "number" && Number.isFinite(cfg.concurrency)) {
    store.concurrency = Math.max(1, Math.min(20, Math.round(cfg.concurrency)));
  }
  pumpQueue();
  return getQueueState();
}

export function clearFinishedJobs(): QueueState {
  const store = getStore();
  store.entries = store.entries.filter(
    (e) => e.job.status === "queued" || e.job.status === "running"
  );
  return getQueueState();
}

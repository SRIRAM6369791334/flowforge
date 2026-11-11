import { EXECUTORS, type RunCtx } from "./executors";
import { resolveParams, type ExprContext } from "./expressions";
import { NODE_MAP } from "./nodes";
import { executions, secrets } from "./store";
import { workflowBus } from "./events";
import type { Execution, Item, Workflow, WorkflowNode } from "./types";

const MAX_STORED_ITEMS = 50;
const trim = (items: Item[]) => items.slice(0, MAX_STORED_ITEMS);

export interface RunOptions {
  mode: Execution["mode"];
  triggerNodeId?: string;
  triggerData?: Record<string, unknown>;
}

export interface RunResult {
  execution: Execution;
  lastOutput: Item[];
}

function pickTrigger(wf: Workflow, opts: RunOptions): WorkflowNode {
  if (opts.triggerNodeId) {
    const n = wf.nodes.find((x) => x.id === opts.triggerNodeId);
    if (n) return n;
  }
  const triggers = wf.nodes.filter((n) => NODE_MAP[n.type]?.isTrigger);
  const preferred: Record<Execution["mode"], string> = {
    manual: "manual_trigger",
    schedule: "schedule_trigger",
    webhook: "webhook_trigger",
    telegram: "telegram_trigger",
    form: "form_trigger",
    parallel_batch: "manual_trigger",
  };
  const t = triggers.find((n) => n.type === preferred[opts.mode]) ?? triggers[0];
  if (!t) throw new Error("Workflow has no trigger node");
  return t;
}

/**
 * Group reachable nodes into topological waves so every wave's nodes run in parallel via Promise.all.
 */
function planParallelWaves(wf: Workflow, start: string): string[][] {
  const reachable = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of wf.edges) {
      if (e.source === id && !reachable.has(e.target)) {
        reachable.add(e.target);
        queue.push(e.target);
      }
    }
  }
  const edges = wf.edges.filter((e) => reachable.has(e.source) && reachable.has(e.target));
  const indeg = new Map([...reachable].map((id) => [id, 0]));
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  indeg.set(start, 0);

  let currentWave = [start];
  const waves: string[][] = [];
  let visited = 0;

  while (currentWave.length > 0) {
    waves.push(currentWave);
    visited += currentWave.length;
    const nextWave: string[] = [];
    for (const id of currentWave) {
      for (const e of edges.filter((x) => x.source === id)) {
        const d = (indeg.get(e.target) ?? 1) - 1;
        indeg.set(e.target, d);
        if (d === 0) nextWave.push(e.target);
      }
    }
    currentWave = nextWave;
  }

  if (visited !== reachable.size) {
    throw new Error("Workflow contains a cycle — loops are not supported");
  }
  return waves;
}

export async function runWorkflow(wf: Workflow, opts: RunOptions): Promise<RunResult> {
  const execution: Execution = {
    id: crypto.randomUUID(),
    workflowId: wf.id,
    workflowName: wf.name,
    mode: opts.mode,
    status: "running",
    startedAt: new Date().toISOString(),
    nodes: {},
  };
  executions.save(execution);
  workflowBus.broadcast({
    type: "start",
    executionId: execution.id,
    workflowId: wf.id,
    workflowName: wf.name,
    mode: opts.mode,
    triggerData: opts.triggerData,
    execution,
    timestamp: new Date().toISOString(),
  });

  const rc: RunCtx = {
    executionId: execution.id,
    mode: opts.mode,
    trigger: opts.triggerData ?? {},
    secrets: secrets.map(),
    nodeOutputs: {},
  };
  const outputs = new Map<string, Record<string, Item[]>>();
  let lastOutput: Item[] = [];

  try {
    const trigger = pickTrigger(wf, opts);
    const waves = planParallelWaves(wf, trigger.id);
    const byId = new Map(wf.nodes.map((n) => [n.id, n]));

    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];

      // Execute all nodes in this topological wave concurrently in parallel!
      await Promise.all(
        wave.map(async (id) => {
          const node = byId.get(id)!;
          const meta = NODE_MAP[node.type];
          const executor = EXECUTORS[node.type];
          const startedAt = new Date().toISOString();
          const t0 = performance.now();

          const input: Item[] = [];
          for (const e of wf.edges.filter((x) => x.target === id)) {
            const out = outputs.get(e.source);
            if (out) input.push(...(out[e.sourceHandle || "main"] ?? []));
          }
          if (id !== trigger.id && input.length === 0) {
            execution.nodes[id] = { status: "skipped", startedAt, durationMs: 0, wave: waveIdx };
            return;
          }

          const maxAttempts = Math.max(1, (Number(node.retryCount) || 0) + 1);
          const retryDelayMs = Math.max(0, Number(node.retryDelayMs) || 500);
          let attempt = 0;
          let lastErr: Error | null = null;

          while (attempt < maxAttempts) {
            attempt++;
            try {
              if (!meta || !executor) throw new Error(`Unknown node type "${node.type}"`);
              const ctxFor = (item: Item | undefined): ExprContext => ({
                $json: item?.json ?? {},
                $input: input,
                $node: rc.nodeOutputs,
                $secrets: rc.secrets,
                $execution: { id: execution.id, mode: opts.mode },
              });

              const handles: Record<string, Item[]> = {};
              const push = (h: string, items: Item[]) => (handles[h] ??= []).push(...items);

              if (executor.mode === "all") {
                const params = resolveParams(node.params, meta.fields, ctxFor(input[0]));
                push("main", await executor.run(params, input, rc));
              } else {
                // Run items in parallel if multiple items flow through
                for (const item of input) {
                  const params = resolveParams(node.params, meta.fields, ctxFor(item));
                  const r = await executor.run(params, item, rc);
                  if (r == null) continue;
                  if (!Array.isArray(r) && "$branch" in r && typeof r.$branch === "string") {
                    push(r.$branch, [{ json: r.json as Item["json"] }]);
                  } else {
                    push("main", (Array.isArray(r) ? r : [r]).map((json) => ({ json })));
                  }
                }
              }

              outputs.set(id, handles);
              const all = Object.values(handles).flat();
              lastOutput = all;
              rc.nodeOutputs[node.name] = { json: all[0]?.json ?? {}, items: all };
              const multi = (meta.outputs?.length ?? 0) > 1;
              execution.nodes[id] = {
                status: "success",
                startedAt,
                durationMs: Math.round(performance.now() - t0),
                attempts: attempt,
                wave: waveIdx,
                input: trim(input),
                output: multi
                  ? Object.fromEntries(Object.entries(handles).map(([k, v]) => [k, trim(v)]))
                  : trim(handles.main ?? []),
              };
              lastErr = null;
              break;
            } catch (err) {
              lastErr = err as Error;
              if (attempt < maxAttempts) {
                await new Promise((r) => setTimeout(r, retryDelayMs));
              }
            }
          }

          if (lastErr) {
            if (node.continueOnError) {
              const fallbackItems: Item[] = [{ json: { error: lastErr.message, continuedOnError: true } }];
              outputs.set(id, { main: fallbackItems });
              rc.nodeOutputs[node.name] = { json: fallbackItems[0].json, items: fallbackItems };
              execution.nodes[id] = {
                status: "error",
                startedAt,
                durationMs: Math.round(performance.now() - t0),
                attempts: attempt,
                wave: waveIdx,
                input: trim(input),
                output: fallbackItems,
                error: `${lastErr.message} (continued)`,
              };
            } else {
              execution.nodes[id] = {
                status: "error",
                startedAt,
                durationMs: Math.round(performance.now() - t0),
                attempts: attempt,
                wave: waveIdx,
                input: trim(input),
                error: lastErr.message,
              };
              throw new Error(`${node.name}: ${lastErr.message}`);
            }
          }
        })
      );
      executions.save(execution);
      workflowBus.broadcast({
        type: "progress",
        executionId: execution.id,
        workflowId: wf.id,
        workflowName: wf.name,
        mode: opts.mode,
        execution,
        timestamp: new Date().toISOString(),
      });
    }

    execution.status = "success";
  } catch (err) {
    execution.status = "error";
    execution.error = (err as Error).message;
  }
  execution.finishedAt = new Date().toISOString();
  executions.save(execution);
  workflowBus.broadcast({
    type: "complete",
    executionId: execution.id,
    workflowId: wf.id,
    workflowName: wf.name,
    mode: opts.mode,
    execution,
    timestamp: new Date().toISOString(),
  });
  return { execution, lastOutput };
}

/**
 * Run multiple workflows simultaneously in parallel via Promise.all.
 */
export async function runWorkflowsInParallel(
  wfs: Workflow[],
  triggerData?: Record<string, unknown>
): Promise<{
  totalWorkflows: number;
  parallelWallTimeMs: number;
  executions: Execution[];
}> {
  const t0 = performance.now();
  const results = await Promise.all(
    wfs.map((wf) => runWorkflow(wf, { mode: "parallel_batch", triggerData }))
  );
  return {
    totalWorkflows: results.length,
    parallelWallTimeMs: Math.round(performance.now() - t0),
    executions: results.map((r) => r.execution),
  };
}

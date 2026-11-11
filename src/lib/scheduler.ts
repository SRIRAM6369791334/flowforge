import { runWorkflow } from "./engine";
import { workflows } from "./store";

interface CronJob {
  workflowId: string;
  nodeId: string;
  expr: string;
}

const g = globalThis as unknown as {
  __ffCronJobs?: CronJob[];
  __ffCronTimer?: ReturnType<typeof setInterval>;
  __ffLastMinute?: string;
};

function matchField(field: string, value: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    const [rangePart, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    if (rangePart === "*") {
      if (value % step === 0) return true;
      continue;
    }
    if (rangePart.includes("-")) {
      const [lo, hi] = rangePart.split("-").map(Number);
      if (value >= lo && value <= hi && (value - lo) % step === 0) return true;
      continue;
    }
    if (Number(rangePart) === value) return true;
  }
  return false;
}

export function validateCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5 && parts.every((p) => /^[\d*,/-]+$/.test(p));
}

function matchesCron(expr: string, d: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hr, dom, mon, dow] = parts;
  return (
    matchField(min, d.getMinutes()) &&
    matchField(hr, d.getHours()) &&
    matchField(dom, d.getDate()) &&
    matchField(mon, d.getMonth() + 1) &&
    matchField(dow, d.getDay())
  );
}

function ensureTicker() {
  if (g.__ffCronTimer) return;
  g.__ffCronTimer = setInterval(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (g.__ffLastMinute === key) return;
    g.__ffLastMinute = key;
    for (const job of g.__ffCronJobs ?? []) {
      if (!matchesCron(job.expr, now)) continue;
      const fresh = workflows.get(job.workflowId);
      if (!fresh?.active) continue;
      runWorkflow(fresh, { mode: "schedule", triggerNodeId: job.nodeId })
        .then(({ execution }) => console.log(`[flowforge] scheduled run ${fresh.name}: ${execution.status}`))
        .catch((err) => console.error(`[flowforge] scheduled run error:`, err));
    }
  }, 15_000);
}

/** (Re)register cron jobs for all active workflows. Idempotent. */
export function syncSchedules() {
  ensureTicker();
  const jobs: CronJob[] = [];
  for (const wf of workflows.list()) {
    if (!wf.active) continue;
    for (const node of wf.nodes.filter((n) => n.type === "schedule_trigger")) {
      const expr = String(node.params.cron ?? "").trim();
      if (!validateCron(expr)) {
        console.warn(`[flowforge] invalid cron "${expr}" in workflow ${wf.name}`);
        continue;
      }
      jobs.push({ workflowId: wf.id, nodeId: node.id, expr });
    }
  }
  g.__ffCronJobs = jobs;
  console.log(`[flowforge] ${jobs.length} schedule(s) active`);
}

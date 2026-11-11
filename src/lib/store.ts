import fs from "node:fs";
import path from "node:path";
import { STARTER_WORKFLOWS } from "./templates";
import type { DbRecord, Execution, Secret, Workflow } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const EXTERNAL_ENV_FILES = [
  "D:\\My n8n\\.env",
  "D:\\My n8n\\.env.local",
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
];
const MAX_EXECUTIONS = 500;
const MAX_RECORDS = 2000;

interface DB {
  workflows: Workflow[];
  executions: Execution[];
  secrets: Secret[];
  records: DbRecord[];
}

function parseDotEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && val !== "") {
        out[key] = val;
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function loadEnvSecrets(): Secret[] {
  const merged: Record<string, string> = {};
  for (const fp of EXTERNAL_ENV_FILES) {
    Object.assign(merged, parseDotEnvFile(fp));
  }
  if (merged.GMAIL_USER && !merged.SMTP_USER) merged.SMTP_USER = merged.GMAIL_USER;
  if (merged.GMAIL_APP_PASSWORD && !merged.SMTP_PASS) merged.SMTP_PASS = merged.GMAIL_APP_PASSWORD;

  const now = new Date().toISOString();
  return Object.entries(merged).map(([key, value]) => ({ key, value, updatedAt: now }));
}

function mergeSecrets(existing: Secret[]): { list: Secret[]; changed: boolean } {
  const envSecrets = loadEnvSecrets();
  const byKey = new Map<string, Secret>();
  for (const s of envSecrets) byKey.set(s.key, s);
  for (const s of existing) if (s.value) byKey.set(s.key, s);
  const list = [...byKey.values()];
  const changed = list.length !== existing.length;
  return { list, changed };
}

function read(): DB {
  if (!fs.existsSync(DB_FILE)) {
    const seeded: DB = {
      workflows: structuredClone(STARTER_WORKFLOWS),
      executions: [],
      secrets: loadEnvSecrets(),
      records: [],
    };
    write(seeded);
    return seeded;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Partial<DB>;
    const existingWf = db.workflows ?? [];
    const wfIds = new Set(existingWf.map((w) => w.id));
    let wfChanged = false;
    for (const tmpl of STARTER_WORKFLOWS) {
      if (!wfIds.has(tmpl.id)) {
        existingWf.unshift(structuredClone(tmpl));
        wfChanged = true;
      }
    }
    const { list: mergedSecrets, changed: secChanged } = mergeSecrets(db.secrets ?? []);
    const result: DB = {
      workflows: existingWf,
      executions: db.executions ?? [],
      secrets: mergedSecrets,
      records: db.records ?? [],
    };
    if (wfChanged || secChanged) write(result);
    return result;
  } catch {
    return { workflows: [], executions: [], secrets: loadEnvSecrets(), records: [] };
  }
}

function write(db: DB) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function mutate<T>(fn: (db: DB) => T): T {
  const db = read();
  const out = fn(db);
  write(db);
  return out;
}

// ---------- Workflows ----------
export const workflows = {
  list: () => read().workflows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  get: (id: string) => read().workflows.find((w) => w.id === id),
  create: (name: string, custom?: Partial<Workflow>): Workflow =>
    mutate((db) => {
      const now = new Date().toISOString();
      const wf: Workflow = {
        id: custom?.id ?? crypto.randomUUID(),
        name,
        active: custom?.active ?? false,
        nodes: custom?.nodes ?? [
          { id: crypto.randomUUID(), type: "manual_trigger", name: "Manual Trigger", position: { x: 80, y: 200 }, params: {} },
        ],
        edges: custom?.edges ?? [],
        createdAt: now,
        updatedAt: now,
      };
      db.workflows.unshift(wf);
      return wf;
    }),
  update: (id: string, patch: Partial<Omit<Workflow, "id" | "createdAt">>) =>
    mutate((db) => {
      const wf = db.workflows.find((w) => w.id === id);
      if (!wf) return undefined;
      Object.assign(wf, patch, { updatedAt: new Date().toISOString() });
      return wf;
    }),
  remove: (id: string) =>
    mutate((db) => {
      db.workflows = db.workflows.filter((w) => w.id !== id);
      db.executions = db.executions.filter((e) => e.workflowId !== id);
    }),
};

// ---------- Executions ----------
export const executions = {
  list: (workflowId?: string) =>
    read()
      .executions.filter((e) => !workflowId || e.workflowId === workflowId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  get: (id: string) => read().executions.find((e) => e.id === id),
  save: (exec: Execution) =>
    mutate((db) => {
      const i = db.executions.findIndex((e) => e.id === exec.id);
      if (i >= 0) db.executions[i] = exec;
      else db.executions.push(exec);
      if (db.executions.length > MAX_EXECUTIONS) {
        db.executions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        db.executions = db.executions.slice(-MAX_EXECUTIONS);
      }
    }),
  clear: (workflowId?: string) =>
    mutate((db) => {
      db.executions = workflowId ? db.executions.filter((e) => e.workflowId !== workflowId) : [];
    }),
};

// ---------- Secrets ----------
export const secrets = {
  list: () => read().secrets,
  map: () => Object.fromEntries(read().secrets.map((s) => [s.key, s.value])),
  set: (key: string, value: string) =>
    mutate((db) => {
      const s = db.secrets.find((x) => x.key === key);
      const updatedAt = new Date().toISOString();
      if (s) Object.assign(s, { value, updatedAt });
      else db.secrets.push({ key, value, updatedAt });
    }),
  remove: (key: string) =>
    mutate((db) => {
      db.secrets = db.secrets.filter((s) => s.key !== key);
    }),
};

// ---------- Database Tables ----------
export const dbTables = {
  tables: (): { name: string; count: number }[] => {
    const counts = new Map<string, number>([
      ["website_monitors", 0],
      ["leads", 0],
      ["orders", 0],
      ["ai_logs", 0],
    ]);
    for (const r of read().records) {
      counts.set(r.table, (counts.get(r.table) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  },
  list: (table?: string, limit = 100): DbRecord[] =>
    read()
      .records.filter((r) => !table || r.table === table)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit),
  insert: (table: string, data: Record<string, unknown>): DbRecord =>
    mutate((db) => {
      const rec: DbRecord = {
        id: `rec_${crypto.randomUUID().slice(0, 8)}`,
        table: table.trim() || "default",
        data,
        createdAt: new Date().toISOString(),
      };
      db.records.push(rec);
      if (db.records.length > MAX_RECORDS) {
        db.records = db.records.slice(-MAX_RECORDS);
      }
      return rec;
    }),
  clear: (table?: string) =>
    mutate((db) => {
      db.records = table ? db.records.filter((r) => r.table !== table) : [];
    }),
};

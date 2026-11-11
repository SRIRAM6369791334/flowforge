export type Item = { json: Record<string, unknown> };

export type FieldType = "text" | "textarea" | "number" | "select" | "code" | "json" | "boolean";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  default?: unknown;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export type NodeCategory =
  | "Triggers"
  | "Parallel & Web"
  | "Core"
  | "AI"
  | "Messaging"
  | "Database"
  | "Google"
  | "Payments"
  | "System";

export interface NodeMeta {
  type: string;
  label: string;
  description: string;
  category: NodeCategory;
  color: string;
  icon: string; // lucide icon name
  isTrigger?: boolean;
  outputs?: string[]; // named output handles; default ["main"]
  fields: FieldDef[];
}

export interface WorkflowNode {
  id: string;
  type: string; // node type key
  name: string;
  position: { x: number; y: number };
  params: Record<string, unknown>;
  retryCount?: number; // auto-retry attempts on error (0-5)
  retryDelayMs?: number; // delay between retries
  continueOnError?: boolean; // route errors to "error" handle or pass error item instead of halting
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = "running" | "success" | "error";

export interface NodeRunResult {
  status: "success" | "error" | "skipped";
  startedAt: string;
  durationMs: number;
  attempts?: number;
  wave?: number; // parallel execution wave index
  input?: Item[];
  output?: Item[] | Record<string, Item[]>;
  error?: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: "manual" | "schedule" | "webhook" | "telegram" | "form" | "parallel_batch";
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  nodes: Record<string, NodeRunResult>;
}

export interface Secret {
  key: string;
  value: string;
  updatedAt: string;
}

export interface DbRecord {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: string;
}

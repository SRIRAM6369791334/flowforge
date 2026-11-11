"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Play,
  Save,
  Plus,
  Trash2,
  KeyRound,
  History,
  Workflow as WorkflowIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Power,
  Layers,
  Database,
  FileSpreadsheet,
  Send,
  Wand2,
  LayoutGrid,
  Download,
  Upload,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Copy,
  Check,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { CATEGORIES, NODE_DEFS, NODE_MAP, defaultParams } from "@/lib/nodes";
import type { DbRecord, Execution, Workflow, WorkflowEdge, WorkflowNode } from "@/lib/types";
import { CanvasNode, type CanvasNodeData } from "@/components/CanvasNode";
import { Inspector } from "@/components/Inspector";
import { NodeIcon } from "@/components/NodeIcon";
import { QueueDashboard } from "@/components/QueueDashboard";

const nodeTypes = { flowNode: CanvasNode };

const PRESET_SECRET_KEYS = [
  "GEMINI_API_KEY",
  "RESEND_API_KEY",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "DEFAULT_FROM_EMAIL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_ID",
  "SLACK_WEBHOOK_URL",
  "DISCORD_WEBHOOK_URL",
  "GOOGLE_SERVICE_ACCOUNT",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "STRIPE_SECRET_KEY",
];

const AI_BUILDER_SUGGESTIONS = [
  "Check 5 websites in parallel, analyze with Gemini AI, save to DB, and alert Telegram & Gmail",
  "When Telegram bot receives a message, reply with Gemini AI and log to Database",
  "Every morning at 9am fetch tech news, summarize in Tanglish with Gemini, send to Telegram & Email",
  "Webhook order trigger → create Razorpay link + save to DB + send WhatsApp & Gmail in parallel",
];

function toRfNodes(
  wfNodes: WorkflowNode[],
  lastExec: Execution | null,
  running: boolean
): Node<CanvasNodeData>[] {
  return wfNodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position,
    data: {
      nodeType: n.type,
      label: n.name,
      params: n.params,
      retryCount: n.retryCount,
      retryDelayMs: n.retryDelayMs,
      continueOnError: n.continueOnError,
      runResult: lastExec?.nodes?.[n.id],
      isRunning: running,
    },
  }));
}

function toRfEdges(wfEdges: WorkflowEdge[]): Edge[] {
  return wfEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? "main",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#818cf8" },
    style: { stroke: e.sourceHandle === "false" ? "#f43f5e" : e.sourceHandle === "true" ? "#10b981" : "#6366f1" },
  }));
}

type DockTab = "queue" | "database" | "executions" | "telegram";

export default function FlowForgeStudio() {
  const [workflowList, setWorkflowList] = useState<Workflow[]>([]);
  const [currentWf, setCurrentWf] = useState<Workflow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Sleek Collapsible Left Sidebar: 48px rail by default, expandable to 260px drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [leftTab, setLeftTab] = useState<"nodes" | "workflows">("nodes");
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Floating AI Builder Modal (Spotlight / Cmd+K style)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBuilding, setAiBuilding] = useState(false);
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  // Secrets Vault Modal
  const [secretsModalOpen, setSecretsModalOpen] = useState(false);
  const [secretList, setSecretList] = useState<{ key: string; preview: string; updatedAt: string }[]>([]);
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretVal, setNewSecretVal] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Run / Save state
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastExec, setLastExec] = useState<Execution | null>(null);
  const [execHistory, setExecHistory] = useState<(Omit<Execution, "nodes"> & { nodeCount: number })[]>([]);

  // Overlay Bottom Dev Console & Telemetry Drawer (DEFAULT FALSE: 100% AIRY HERO CANVAS!)
  const [dockExpanded, setDockExpanded] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>("queue");
  const [dockHeight, setDockHeight] = useState<"compact" | "tall">("compact");

  // MiniMap state (compact and collapsible)
  const [miniMapOpen, setMiniMapOpen] = useState(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Parallel Batch state
  const [selectedBatchWfs, setSelectedBatchWfs] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    totalWorkflows: number;
    parallelWallTimeMs: number;
    executions: Execution[];
  } | null>(null);
  const [quickUrls, setQuickUrls] = useState(
    "https://news.ycombinator.com\nhttps://example.com\nhttps://jsonplaceholder.typicode.com/posts/1\nhttps://httpbin.org/get\nhttps://api.github.com/zen"
  );
  const [quickWebRunning, setQuickWebRunning] = useState(false);
  const [quickWebResult, setQuickWebResult] = useState<Record<string, unknown> | null>(null);

  // Public Forms state
  const [activeFormSlug, setActiveFormSlug] = useState("parallel-websites");
  const [formUrls, setFormUrls] = useState(
    "https://news.ycombinator.com\nhttps://example.com\nhttps://api.github.com/zen"
  );
  const [formName, setFormName] = useState("Sriram");
  const [formEmail, setFormEmail] = useState("sriramsri1234321@gmail.com");
  const [formPhone, setFormPhone] = useState("919876543210");
  const [formAmount, setFormAmount] = useState(499);
  const [formPrompt, setFormPrompt] = useState("Give me 3 automation ideas for e-commerce in Tanglish");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formResponse, setFormResponse] = useState<Record<string, unknown> | null>(null);

  // Telegram Live Bot state
  const [tgStatus, setTgStatus] = useState<{
    listening: boolean;
    bot: { username?: string; firstName?: string } | null;
    logs: {
      id: string;
      from: string;
      chatId: string;
      text: string;
      receivedAt: string;
      workflowName?: string;
      status?: string;
    }[];
  } | null>(null);
  const [tgSimText, setTgSimText] = useState("Vanakkam Bot! Check parallel websites & give AI status summary");
  const [tgSimulating, setTgSimulating] = useState(false);

  // Database state
  const [dbTablesList, setDbTablesList] = useState<{ name: string; count: number }[]>([]);
  const [activeTable, setActiveTable] = useState("website_monitors");
  const [dbRecords, setDbRecords] = useState<DbRecord[]>([]);

  // Toast Notification state
  const [toast, setToast] = useState<{ message: string; kind: "success" | "info" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live Queue Badge state
  const [queueBadge, setQueueBadge] = useState<{
    queued: number;
    running: number;
    mode: string;
    concurrency: number;
  }>({
    queued: 0,
    running: 0,
    mode: "parallel_pool",
    concurrency: 6,
  });

  const showToast = useCallback((message: string, kind: "success" | "info" | "error" = "success") => {
    setToast({ message, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectWorkflow = useCallback(
    async (wf: Workflow, exec: Execution | null = null) => {
      setCurrentWf(wf);
      let targetExec = exec;
      if (!targetExec) {
        try {
          const res = await fetch(`/api/executions?workflowId=${wf.id}`);
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              const fullRes = await fetch(`/api/executions?id=${list[0].id}`);
              if (fullRes.ok) targetExec = await fullRes.json();
            }
          }
        } catch {
          // ignore
        }
      }
      setLastExec(targetExec);
      setNodes(toRfNodes(wf.nodes, targetExec, false));
      setEdges(toRfEdges(wf.edges));
      setSelectedNodeId(null);
      setDirty(false);
    },
    [setNodes, setEdges]
  );

  const loadWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      const list = (await res.json()) as Workflow[];
      setWorkflowList(list);
      setSelectedBatchWfs(list.map((w) => w.id));
      if (list.length > 0 && !currentWf) {
        selectWorkflow(list[0]);
      }
    } catch {
      // ignore
    }
  }, [currentWf, selectWorkflow]);

  useEffect(() => {
    loadWorkflows();
    fetch("/api/telegram").catch(() => {});
  }, [loadWorkflows]);

  // Background poll for queue stats
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/queue", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (data?.stats) {
          setQueueBadge({
            queued: data.stats.queued ?? 0,
            running: data.stats.running ?? 0,
            mode: data.mode ?? "parallel_pool",
            concurrency: data.concurrency ?? 6,
          });
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // 100% Rock-solid real-time sync for current workflow (catches Telegram, Webhooks, Schedules & manual runs instantly)
  useEffect(() => {
    if (!currentWf) return;
    let active = true;

    const pollLive = async () => {
      try {
        const res = await fetch(`/api/workflows/${currentWf.id}/live`, { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = (await res.json()) as { execution: Execution | null; running: boolean };
        if (!data.execution || !active) return;

        // If execution is currently running
        if (data.running) {
          setRunning(true);
          setLastExec(data.execution);
          return;
        }

        // Check if an execution has completed or updated
        setLastExec((prev) => {
          if (!prev || prev.id !== data.execution?.id || prev.finishedAt !== data.execution?.finishedAt) {
            setRunning(false);
            if (prev && prev.id !== data.execution?.id) {
              const nodeCount = Object.keys(data.execution?.nodes || {}).length;
              const modeLabel = data.execution?.mode === "telegram" ? "Telegram message" : data.execution?.mode;
              showToast(`⚡ ${modeLabel} automation executed live (${nodeCount} nodes completed in waves)!`, "success");
            }
            return data.execution;
          }
          return prev;
        });
      } catch {
        // ignore
      }
    };

    pollLive();
    const interval = setInterval(pollLive, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentWf?.id, showToast]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          runResult: lastExec?.nodes?.[n.id],
          isRunning: running,
        },
      }))
    );
  }, [lastExec, running, setNodes]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const snapshotWorkflow = useCallback((): Workflow | null => {
    if (!currentWf) return null;
    const wfNodes: WorkflowNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      name: n.data.label,
      position: n.position,
      params: n.data.params,
      retryCount: n.data.retryCount,
      retryDelayMs: n.data.retryDelayMs,
      continueOnError: n.data.continueOnError,
    }));
    const wfEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? "main",
    }));
    return { ...currentWf, nodes: wfNodes, edges: wfEdges };
  }, [currentWf, nodes, edges]);

  const saveWorkflow = useCallback(
    async (patch?: Partial<Workflow>, notify = false) => {
      const snap = snapshotWorkflow();
      if (!snap) return null;
      setSaving(true);
      try {
        const payload = { ...snap, ...patch };
        const res = await fetch(`/api/workflows/${snap.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const saved = (await res.json()) as Workflow;
        setCurrentWf(saved);
        setWorkflowList((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
        setDirty(false);
        if (notify) {
          showToast(`💾 Saved "${saved.name}" (${saved.nodes.length} nodes)`, "info");
        }
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [snapshotWorkflow, showToast]
  );

  const handleRun = useCallback(
    async (triggerNodeId?: string) => {
      if (!currentWf || running) return;
      await saveWorkflow();
      setRunning(true);
      try {
        const res = await fetch(`/api/workflows/${currentWf.id}/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ triggerNodeId }),
        });
        const exec = (await res.json()) as Execution;
        setLastExec(exec);
        if (exec.status === "success") {
          showToast(
            `⚡ Executed "${currentWf.name}" (${Object.keys(exec.nodes || {}).length} nodes in parallel waves)`,
            "success"
          );
        } else {
          showToast(`⚠️ Workflow error: ${exec.error || "Check node inspector"}`, "error");
        }
      } finally {
        setRunning(false);
      }
    },
    [currentWf, running, saveWorkflow, showToast]
  );

  const handleAutoLayout = useCallback(() => {
    const rank = new Map<string, number>();
    for (const n of nodes) rank.set(n.id, 0);
    for (let iter = 0; iter < nodes.length; iter++) {
      for (const e of edges) {
        const r = (rank.get(e.source) ?? 0) + 1;
        if (r > (rank.get(e.target) ?? 0)) rank.set(e.target, r);
      }
    }
    const byCol = new Map<number, Node<CanvasNodeData>[]>();
    for (const n of nodes) {
      const col = rank.get(n.id) ?? 0;
      const arr = byCol.get(col) ?? [];
      arr.push(n);
      byCol.set(col, arr);
    }
    const posMap = new Map<string, { x: number; y: number }>();
    for (const [col, group] of byCol.entries()) {
      const totalH = (group.length - 1) * 165;
      const startY = Math.max(70, 230 - totalH / 2);
      group.forEach((n, idx) => {
        posMap.set(n.id, { x: 70 + col * 310, y: Math.round(startY + idx * 165) });
      });
    }
    setNodes((nds) => nds.map((n) => ({ ...n, position: posMap.get(n.id) ?? n.position })));
    setDirty(true);
  }, [nodes, edges, setNodes]);

  // Keyboard shortcuts:
  // Ctrl/Cmd+S -> Save
  // Ctrl/Cmd+Enter -> Run
  // Ctrl/Cmd+L -> Auto-Layout
  // Ctrl/Cmd+K -> AI Command Bar
  // Escape -> Close modals / Inspector / Dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveWorkflow(undefined, true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        handleAutoLayout();
        showToast("Auto-aligned workflow DAG into parallel wave columns", "info");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAiModalOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (aiModalOpen) setAiModalOpen(false);
        else if (secretsModalOpen) setSecretsModalOpen(false);
        else if (selectedNodeId) setSelectedNodeId(null);
        else if (dockExpanded) setDockExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveWorkflow, handleRun, handleAutoLayout, showToast, aiModalOpen, secretsModalOpen, selectedNodeId, dockExpanded]);

  useEffect(() => {
    if (aiModalOpen && aiInputRef.current) {
      setTimeout(() => aiInputRef.current?.focus(), 50);
    }
  }, [aiModalOpen]);

  const handleAiBuild = async (customPrompt?: string) => {
    const promptText = (customPrompt ?? aiPrompt).trim();
    if (!promptText || aiBuilding) return;
    setAiBuilding(true);
    try {
      const res = await fetch("/api/ai-builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      const wf = (await res.json()) as Workflow;
      if (wf.id) {
        setWorkflowList((prev) => [wf, ...prev]);
        selectWorkflow(wf);
        setAiPrompt("");
        setAiModalOpen(false);
        showToast(`✨ Generated AI workflow "${wf.name}" with ${wf.nodes.length} nodes!`, "success");
      }
    } finally {
      setAiBuilding(false);
    }
  };

  const handleExportJson = () => {
    const snap = snapshotWorkflow();
    if (!snap) return;
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${snap.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<Workflow>;
      if (!Array.isArray(parsed.nodes)) return;
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: parsed.name || file.name.replace(/\.json$/i, "") }),
      });
      const created = (await res.json()) as Workflow;
      const putRes = await fetch(`/api/workflows/${created.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: parsed.name || created.name,
          active: Boolean(parsed.active),
          nodes: parsed.nodes,
          edges: parsed.edges ?? [],
        }),
      });
      const updated = (await putRes.json()) as Workflow;
      setWorkflowList((prev) => [updated, ...prev.filter((w) => w.id !== updated.id)]);
      selectWorkflow(updated);
      showToast(`Imported "${updated.name}" successfully`, "info");
    } finally {
      e.target.value = "";
    }
  };

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const newEdge: Edge = {
        id: `e-${crypto.randomUUID().slice(0, 8)}`,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? "main",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#818cf8" },
        style: {
          stroke: conn.sourceHandle === "false" ? "#f43f5e" : conn.sourceHandle === "true" ? "#10b981" : "#6366f1",
        },
      };
      setEdges((eds) => [...eds, newEdge]);
      setDirty(true);
    },
    [setEdges]
  );

  const addNodeOfType = (type: string) => {
    const meta = NODE_MAP[type];
    if (!meta) return;
    const id = `n-${crypto.randomUUID().slice(0, 8)}`;
    const count = nodes.filter((n) => n.data.nodeType === type).length;
    const label = count === 0 ? meta.label : `${meta.label} ${count + 1}`;
    const anchor = nodes.find((n) => n.id === selectedNodeId) ?? nodes[nodes.length - 1];
    const position = anchor ? { x: anchor.position.x + 290, y: anchor.position.y } : { x: 100, y: 180 };

    const newNode: Node<CanvasNodeData> = {
      id,
      type: "flowNode",
      position,
      data: {
        nodeType: type,
        label,
        params: defaultParams(type),
      },
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true }]);
    if (anchor && !meta.isTrigger) {
      const anchorMeta = NODE_MAP[anchor.data.nodeType];
      const handle = anchorMeta?.outputs?.[0] ?? "main";
      setEdges((eds) => [
        ...eds,
        {
          id: `e-${crypto.randomUUID().slice(0, 8)}`,
          source: anchor.id,
          target: id,
          sourceHandle: handle,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#818cf8" },
          style: { stroke: handle === "true" ? "#10b981" : "#6366f1" },
        },
      ]);
    }
    setSelectedNodeId(id);
    setDirty(true);
    showToast(`Added "${label}" to canvas`, "info");
  };

  const selectedWfNode = useMemo<WorkflowNode | null>(() => {
    const n = nodes.find((x) => x.id === selectedNodeId);
    if (!n) return null;
    return {
      id: n.id,
      type: n.data.nodeType,
      name: n.data.label,
      position: n.position,
      params: n.data.params,
      retryCount: n.data.retryCount,
      retryDelayMs: n.data.retryDelayMs,
      continueOnError: n.data.continueOnError,
    };
  }, [nodes, selectedNodeId]);

  const updateSelectedNode = (patch: Partial<WorkflowNode>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                ...(patch.name !== undefined ? { label: patch.name } : {}),
                ...(patch.params !== undefined ? { params: patch.params } : {}),
                ...(patch.retryCount !== undefined ? { retryCount: patch.retryCount } : {}),
                ...(patch.retryDelayMs !== undefined ? { retryDelayMs: patch.retryDelayMs } : {}),
                ...(patch.continueOnError !== undefined ? { continueOnError: patch.continueOnError } : {}),
              },
            }
          : n
      )
    );
    setDirty(true);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setDirty(true);
  };

  const createNewWorkflow = async () => {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Workflow ${workflowList.length + 1}` }),
    });
    const wf = (await res.json()) as Workflow;
    setWorkflowList((prev) => [wf, ...prev]);
    selectWorkflow(wf);
  };

  const deleteWorkflow = async (id: string) => {
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    const next = workflowList.filter((w) => w.id !== id);
    setWorkflowList(next);
    if (currentWf?.id === id) {
      if (next[0]) selectWorkflow(next[0]);
      else setCurrentWf(null);
    }
  };

  // Parallel Batch Runner
  const runParallelBatch = async () => {
    if (batchRunning) return;
    setBatchRunning(true);
    try {
      const res = await fetch("/api/workflows/run-parallel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowIds: selectedBatchWfs }),
      });
      const data = await res.json();
      setBatchResult(data);
      showToast(
        `⚡ Executed ${data?.totalWorkflows ?? selectedBatchWfs.length} workflows concurrently (${data?.parallelWallTimeMs ?? 0} ms)!`,
        "success"
      );
    } finally {
      setBatchRunning(false);
    }
  };

  const runQuickParallelWebsites = async () => {
    if (quickWebRunning) return;
    setQuickWebRunning(true);
    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formSlug: "parallel-websites",
          payload: { urls: quickUrls, source: "Parallel Hub" },
        }),
      });
      const data = await res.json();
      setQuickWebResult(data);
      showToast("🌐 Parallel website audit completed & logged to Database!", "success");
      loadDatabase();
    } finally {
      setQuickWebRunning(false);
    }
  };

  // Public Form Submit
  const submitMiniAppForm = async () => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      const payload =
        activeFormSlug === "parallel-websites"
          ? { urls: formUrls, requestedBy: formName }
          : activeFormSlug === "lead-capture"
            ? {
                name: formName,
                email: formEmail,
                phone: formPhone,
                prompt: `New lead ${formName} (${formEmail}). Generate a warm welcome message in Tanglish.`,
              }
            : activeFormSlug === "order-checkout"
              ? {
                  name: formName,
                  email: formEmail,
                  phone: formPhone,
                  amount: formAmount,
                  prompt: `Order confirmed for ${formName}, amount ₹${formAmount}. Write a short confirmation note.`,
                }
              : { name: formName, prompt: formPrompt };

      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ formSlug: activeFormSlug, payload }),
      });
      const data = await res.json();
      setFormResponse(data);
      showToast("Form submitted and triggered live workflow", "success");
      loadDatabase();
    } finally {
      setFormSubmitting(false);
    }
  };

  // Telegram Bot API
  const loadTelegramStatus = async () => {
    try {
      const res = await fetch("/api/telegram");
      setTgStatus(await res.json());
    } catch {
      // ignore
    }
  };

  const toggleTelegramBot = async (action: "start" | "stop") => {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTgStatus(await res.json());
  };

  const simulateTelegramIncoming = async () => {
    if (tgSimulating) return;
    setTgSimulating(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "simulate", text: tgSimText, fromName: "Sriram" }),
      });
      const data = await res.json();
      setTgStatus(data.status);
      showToast("Telegram message triggered workflow & sent reply!", "success");
    } finally {
      setTgSimulating(false);
    }
  };

  // Database API
  const loadDatabase = useCallback(
    async (table = activeTable) => {
      try {
        const res = await fetch(`/api/db?table=${encodeURIComponent(table)}`);
        const data = (await res.json()) as { tables: { name: string; count: number }[]; records: DbRecord[] };
        setDbTablesList(data.tables || []);
        setDbRecords(data.records || []);
      } catch {
        // ignore
      }
    },
    [activeTable]
  );

  // Executions & Secrets
  const loadExecutions = async () => {
    try {
      const res = await fetch("/api/executions");
      setExecHistory(await res.json());
    } catch {
      // ignore
    }
  };

  const inspectExecution = async (execId: string) => {
    const res = await fetch(`/api/executions?id=${execId}`);
    const full = (await res.json()) as Execution;
    const wf = workflowList.find((w) => w.id === full.workflowId);
    if (wf) {
      selectWorkflow(wf, full);
    } else {
      setLastExec(full);
    }
    showToast(`Inspecting execution ${execId.slice(0, 8)} on canvas`, "info");
  };

  const loadSecrets = async () => {
    try {
      const res = await fetch("/api/secrets");
      setSecretList(await res.json());
    } catch {
      // ignore
    }
  };

  const saveSecret = async () => {
    if (!newSecretKey.trim()) return;
    await fetch("/api/secrets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: newSecretKey, value: newSecretVal }),
    });
    setNewSecretKey("");
    setNewSecretVal("");
    loadSecrets();
    showToast(`Saved secret "${newSecretKey}"`, "success");
  };

  const deleteSecret = async (key: string) => {
    await fetch(`/api/secrets?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    loadSecrets();
    showToast(`Deleted secret "${key}"`, "info");
  };

  // Dock Switcher helper
  const handleDockTabClick = (tab: DockTab) => {
    setDockTab(tab);
    setDockExpanded(true);
    if (tab === "database") loadDatabase();
    else if (tab === "executions") loadExecutions();
    else if (tab === "telegram") loadTelegramStatus();
  };

  // Category collapse toggle
  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const filteredDefs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NODE_DEFS;
    return NODE_DEFS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [search]);

  const totalDbCount = useMemo(() => {
    return dbTablesList.reduce((acc, t) => acc + (t.count || 0), 0);
  }, [dbTablesList]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#090a0f] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* ───────── Non-intrusive Refined Toast Notification ───────── */}
      {toast && (
        <div
          className={`fixed bottom-12 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-xl transition-all duration-200 animate-float-in ${
            toast.kind === "success"
              ? "border-emerald-500/40 bg-[#0d1f18]/90 text-emerald-200 shadow-emerald-500/10"
              : toast.kind === "error"
                ? "border-rose-500/40 bg-[#240e14]/90 text-rose-200 shadow-rose-500/10"
                : "border-indigo-500/40 bg-[#121626]/90 text-indigo-200 shadow-indigo-500/10"
          }`}
        >
          {toast.kind === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : toast.kind === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <Zap className="h-4 w-4 shrink-0 text-cyan-400" />
          )}
          <span className="tracking-tight">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 rounded p-0.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ───────── Collapsible Left Sidebar (48px rail or 260px drawer) ───────── */}
      {sidebarCollapsed ? (
        /* Sleek 48px Icon Rail */
        <aside className="flex h-full w-12 shrink-0 flex-col items-center border-r border-white/[0.08] bg-[#0c0e15] py-2.5 z-20 select-none transition-all duration-200 ease-in-out">
          {/* Logo / Brand mini icon */}
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm shadow-indigo-500/30 border border-white/10 hover:scale-105 transition"
            title="FlowForge v2.4 (Click to expand sidebar)"
          >
            <Sparkles className="h-4 w-4 text-white" />
          </button>

          <div className="my-2.5 h-px w-5 bg-white/10" />

          {/* Action Rail: Add Node, Workflows, Templates */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                setLeftTab("nodes");
                setSidebarCollapsed(false);
              }}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition"
              title="Add Node (+)"
            >
              <Plus className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                setLeftTab("workflows");
                setSidebarCollapsed(false);
              }}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition"
              title={`Workflows (${workflowList.length})`}
            >
              <WorkflowIcon className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-indigo-600 px-1 font-mono text-[8px] font-bold text-white shadow">
                {workflowList.length}
              </span>
            </button>

            <button
              onClick={() => setAiModalOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-200 transition"
              title="AI Workflow Builder (⌘K)"
            >
              <Wand2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1" />

          {/* Expand sidebar toggle button */}
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition"
            title="Expand Sidebar (260px)"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </aside>
      ) : (
        /* Expanded 260px Palette Drawer */
        <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0c0e15] z-20 select-none transition-all duration-200 ease-in-out">
          {/* Brand header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5 bg-[#0f121d]">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm shadow-indigo-500/30 border border-white/10">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-tight text-white">FlowForge</span>
                  <span className="rounded bg-indigo-500/20 px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                    v2.4
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={createNewWorkflow}
                title="Create new workflow"
                className="btn-primary !px-2 !py-0.5 text-xs shadow-md shadow-indigo-500/15"
              >
                <Plus className="h-3 w-3" /> New
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1 rounded text-zinc-400 hover:bg-white/10 hover:text-white transition"
                title="Collapse to rail (48px)"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="grid grid-cols-2 border-b border-white/[0.08] p-1.5 gap-1 bg-black/40">
            <button
              onClick={() => setLeftTab("nodes")}
              className={`rounded-md py-1 text-xs font-semibold transition-all ${
                leftTab === "nodes"
                  ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
              }`}
            >
              + Nodes ({filteredDefs.length})
            </button>
            <button
              onClick={() => setLeftTab("workflows")}
              className={`rounded-md py-1 text-xs font-semibold transition-all ${
                leftTab === "workflows"
                  ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
              }`}
            >
              Workflows ({workflowList.length})
            </button>
          </div>

          {/* Tab Content */}
          {leftTab === "nodes" ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Search */}
              <div className="p-2.5 border-b border-white/5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Parallel, DB, Gemini…"
                    className="input !pl-8 !py-1 text-xs"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-2 text-zinc-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Accordion Categories */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {CATEGORIES.map((cat) => {
                  const items = filteredDefs.filter((d) => d.category === cat);
                  if (items.length === 0) return null;
                  const isCollapsed = Boolean(collapsedCategories[cat]);

                  return (
                    <div key={cat} className="rounded-lg border border-white/5 bg-white/[0.015] overflow-hidden">
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left transition hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-1.5">
                          {isCollapsed ? (
                            <ChevronRight className="h-3 w-3 text-zinc-500" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-zinc-400" />
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                            {cat}
                          </span>
                        </div>
                        <span className="rounded-full bg-white/5 px-1.5 py-0.2 font-mono text-[9px] text-zinc-400">
                          {items.length}
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-1 p-1 pt-0.5">
                          {items.map((def) => (
                            <button
                              key={def.type}
                              onClick={() => addNodeOfType(def.type)}
                              className="group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-all duration-150 hover:border-white/10 hover:bg-white/[0.05]"
                            >
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                                style={{ backgroundColor: `${def.color}22`, border: `1px solid ${def.color}44` }}
                              >
                                <NodeIcon name={def.icon} className="h-3 w-3" style={{ color: def.color }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium text-zinc-200 group-hover:text-white">
                                  {def.label}
                                </div>
                                <div className="truncate text-[10px] text-zinc-500">{def.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {workflowList.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => selectWorkflow(wf)}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition-all ${
                    currentWf?.id === wf.id
                      ? "border-indigo-500/50 bg-indigo-500/15 shadow-sm"
                      : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${wf.active ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-zinc-600"}`} />
                      <span className="truncate text-xs font-semibold text-zinc-100">{wf.name}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {wf.nodes.length} nodes · {wf.active ? "Active" : "Draft"}
                    </div>
                  </div>
                  {workflowList.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(wf.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition"
                      title="Delete workflow"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* ───────── Main Column: Header + 100% Airy Primary Hero Canvas + Status Bar ───────── */}
      <div className="relative flex flex-1 flex-col h-full overflow-hidden">
        {/* 1. CLEAN MINIMAL HEADER (Linear / Figma style, zero overlap) */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0c0e15]/95 backdrop-blur-md px-3.5 gap-3 z-20 select-none">
          {/* Left: Minimalist logo icon + "FlowForge" + vertical separator + Full editable workflow title + clean "Active" switch pill */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm shadow-indigo-500/30 border border-white/10">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-bold tracking-tight text-white select-none">FlowForge</span>
            </div>

            <div className="h-4 w-px bg-white/10 shrink-0" />

            {currentWf ? (
              <div className="flex items-center gap-2 min-w-0">
                <input
                  value={currentWf.name}
                  onChange={(e) => {
                    setCurrentWf({ ...currentWf, name: e.target.value });
                    setDirty(true);
                  }}
                  className="w-36 sm:w-52 md:w-72 lg:w-96 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-zinc-100 outline-none transition hover:border-white/10 hover:bg-white/[0.04] focus:border-indigo-500/50 focus:bg-[#161822]"
                  title="Click to rename workflow"
                  placeholder="Workflow title..."
                />
                <button
                  onClick={() => saveWorkflow({ active: !currentWf.active }, true)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                    currentWf.active
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-500/10"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Toggle Workflow Active status"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      currentWf.active ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                    }`}
                  />
                  <span>{currentWf.active ? "Active" : "Draft"}</span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-zinc-400">No workflow selected</span>
            )}
          </div>

          {/* Right: Clean action buttons (Secrets, Auto-Layout, Export/Import, Save, Execute Workflow) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Secrets Vault Button */}
            <button
              onClick={() => {
                setSecretsModalOpen(true);
                loadSecrets();
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
              title="Open Secrets Vault"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline">Secrets</span>
            </button>
            <button
              onClick={() => {
                handleAutoLayout();
                showToast("Auto-aligned workflow DAG into parallel wave columns", "info");
              }}
              title="Auto-Layout Nodes (Ctrl+L / Cmd+L)"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Auto-Layout</span>
              <kbd className="hidden lg:inline-block rounded bg-white/5 px-1 py-0.2 font-mono text-[9px] text-zinc-400">
                ⌘L
              </kbd>
            </button>

            <div className="flex items-center border border-white/10 rounded-md bg-white/[0.02] overflow-hidden">
              <button
                onClick={handleExportJson}
                title="Export Workflow JSON"
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
              >
                <Download className="h-3.5 w-3.5 text-zinc-400" />
                <span className="hidden xl:inline">Export</span>
              </button>
              <div className="h-3.5 w-px bg-white/10" />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Import Workflow JSON"
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
              >
                <Upload className="h-3.5 w-3.5 text-zinc-400" />
                <span className="hidden xl:inline">Import</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />

            <button
              onClick={() => saveWorkflow(undefined, true)}
              disabled={saving}
              title="Save Workflow (Ctrl+S / Cmd+S)"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5 text-zinc-400" />
              <span>{saving ? "Saving…" : dirty ? "Save*" : "Save"}</span>
              <kbd className="hidden md:inline-block rounded bg-white/5 px-1 py-0.2 font-mono text-[9px] text-zinc-400">
                ⌘S
              </kbd>
            </button>

            {/* Prominent Execute Workflow Button */}
            <button
              onClick={() => handleRun()}
              disabled={running || !currentWf}
              title="Execute Workflow in Parallel Waves (Ctrl+Enter / Cmd+Enter)"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              <span>{running ? "Running…" : "Execute Workflow"}</span>
              <kbd className="hidden sm:inline-block rounded bg-black/25 px-1.5 py-0.2 font-mono text-[9px] text-emerald-100">
                ⌘↵
              </kbd>
            </button>
          </div>
        </header>

        {/* 2. FULL AIRY HERO CANVAS AREA (100% Screen Primary Focus) */}
        <div className="relative flex-1 w-full overflow-hidden">
          {/* FLOATING AI COMMAND BAR (Cmd+K) in top-center */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button
              onClick={() => setAiModalOpen(true)}
              className="group flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-[#111420]/90 hover:bg-[#161a29] px-4 py-1.5 text-xs font-medium text-zinc-200 hover:text-white shadow-xl shadow-black/50 backdrop-blur-md transition-all duration-200 hover:border-indigo-500/50 hover:shadow-indigo-500/10 active:scale-[0.98]"
              title="Open AI Workflow Builder (Ctrl+K / Cmd+K)"
            >
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                <Sparkles className="h-2.5 w-2.5" />
              </div>
              <span className="tracking-tight font-medium">AI Workflow Builder</span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.2 font-mono text-[9px] text-zinc-400 group-hover:text-zinc-200">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Last run execution summary pill */}
          {lastExec && (
            <div
              className={`absolute left-4 top-3.5 z-20 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-lg backdrop-blur-md ${
                lastExec.status === "success"
                  ? "border-emerald-500/40 bg-[#0c1e15]/90 text-emerald-200"
                  : "border-rose-500/40 bg-[#250d14]/90 text-rose-200"
              }`}
            >
              {lastExec.status === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">
                {lastExec.status === "success"
                  ? `Executed ${Object.keys(lastExec.nodes || {}).length} nodes in parallel waves`
                  : lastExec.error}
              </span>
              <button
                onClick={() => setLastExec(null)}
                className="ml-1 text-[10px] text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* MiniMap Toggle Button */}
          <button
            onClick={() => setMiniMapOpen((prev) => !prev)}
            className={`absolute z-20 flex items-center justify-center rounded-md border border-white/10 bg-[#101420]/90 hover:bg-[#161a29] text-zinc-400 hover:text-white shadow-lg backdrop-blur-md transition-all ${
              miniMapOpen
                ? "bottom-[138px] right-4 h-5 px-1.5 text-[9px] font-mono gap-1"
                : "bottom-12 right-4 h-7 px-2 text-[10px] font-medium gap-1.5"
            }`}
            title={miniMapOpen ? "Collapse MiniMap" : "Expand MiniMap"}
          >
            <LayoutGrid className="h-3 w-3 text-indigo-400" />
            <span>{miniMapOpen ? "Hide Map" : "MiniMap"}</span>
          </button>

          {/* Persistent Full ReactFlow Canvas */}
          <div className="relative w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                onNodesChange(changes);
                if (changes.some((c) => c.type === "position" || c.type === "remove")) setDirty(true);
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
                if (changes.some((c) => c.type === "remove")) setDirty(true);
              }}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              deleteKeyCode={["Backspace", "Delete"]}
            >
              <Background gap={22} size={1} color="#1c2130" />
              {/* Controls at bottom-left */}
              <Controls
                position="bottom-left"
                className="!bottom-12 !left-4 !bg-[#101420]/90 !border-white/10 !rounded-lg !shadow-xl"
              />
              {/* MiniMap at bottom-right, compact & collapsible */}
              {miniMapOpen && (
                <MiniMap
                  position="bottom-right"
                  className="!bottom-12 !right-4 !rounded-xl !border !border-white/10 !bg-[#0b0d15]/95 !shadow-2xl"
                  style={{ width: 130, height: 85 }}
                  pannable
                  zoomable
                  nodeColor={(n) => NODE_MAP[(n.data as CanvasNodeData)?.nodeType]?.color ?? "#6366f1"}
                />
              )}
            </ReactFlow>
          </div>

          {/* Node Inspector Slide-over (Floating drawer docked cleanly on right) */}
          {selectedWfNode && (
            <div className="absolute top-0 right-0 bottom-0 z-40 flex pointer-events-auto shadow-2xl">
              <Inspector
                node={selectedWfNode}
                runResult={lastExec?.nodes?.[selectedWfNode.id]}
                onChange={updateSelectedNode}
                onDelete={deleteSelectedNode}
                onClose={() => setSelectedNodeId(null)}
                onRunFromHere={() => handleRun(selectedWfNode.id)}
              />
            </div>
          )}

          {/* 3. Bottom Telemetry & Dev Console Overlay Drawer (Slides smoothly up from bottom) */}
          {dockExpanded && (
            <div
              className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t border-white/10 bg-[#0c0e17]/98 backdrop-blur-2xl shadow-2xl shadow-black transition-all duration-300 ease-in-out ${
                dockHeight === "compact" ? "h-[360px]" : "h-[540px]"
              }`}
            >
              {/* Dock Header Bar */}
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#101422] px-3.5 gap-2 select-none">
                {/* Dock Tabs */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDockTabClick("queue")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      dockTab === "queue"
                        ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    <Zap className="h-3 w-3 text-cyan-400" />
                    <span>⚡ Queue &amp; Worker Pool</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
                        queueBadge.running + queueBadge.queued > 0
                          ? "bg-amber-400 text-black font-bold animate-pulse"
                          : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {queueBadge.running + queueBadge.queued > 0
                        ? `${queueBadge.running + queueBadge.queued} live`
                        : `${queueBadge.concurrency}W`}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDockTabClick("database")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      dockTab === "database"
                        ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    <Database className="h-3 w-3 text-emerald-400" />
                    <span>🗄️ Database Tables</span>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.2 font-mono text-[9px] text-zinc-400">
                      {totalDbCount}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDockTabClick("executions")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      dockTab === "executions"
                        ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    <History className="h-3 w-3 text-indigo-400" />
                    <span>📜 Execution History</span>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.2 font-mono text-[9px] text-zinc-400">
                      {execHistory.length}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDockTabClick("telegram")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      dockTab === "telegram"
                        ? "bg-sky-500/25 text-sky-200 border border-sky-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    <Send className="h-3 w-3 text-sky-400" />
                    <span>💬 Telegram &amp; Forms</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] font-bold ${
                        tgStatus?.listening
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {tgStatus?.listening ? "LIVE" : "IDLE"}
                    </span>
                  </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDockHeight((prev) => (prev === "compact" ? "tall" : "compact"))}
                    className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                    title={dockHeight === "compact" ? "Expand dock to full (540px)" : "Compact dock (360px)"}
                  >
                    {dockHeight === "compact" ? (
                      <Maximize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Minimize2 className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => setDockExpanded(false)}
                    className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                    title="Close Console & Queue"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Dock Content Body */}
              <div className="flex-1 overflow-y-auto p-4 bg-[#090b12]">
                {/* TAB 1: Queue & Worker Pool Telemetry */}
                {dockTab === "queue" && (
                  <div className="space-y-4 max-w-7xl mx-auto">
                    <QueueDashboard
                      workflows={workflowList}
                      onInspectExecution={inspectExecution}
                      onToast={showToast}
                      onQueueStatsChange={setQueueBadge}
                    />

                    {/* Parallel Batch Execution Utilities */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
                      {/* Multi-Workflow Parallel Batch */}
                      <div className="rounded-xl border border-white/10 bg-[#101420] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                              <Zap className="h-3.5 w-3.5" /> Multi-Workflow Parallel Batch (Promise.all)
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              Fire multiple workflows simultaneously into the worker pool.
                            </div>
                          </div>
                          <button
                            onClick={runParallelBatch}
                            disabled={batchRunning || selectedBatchWfs.length === 0}
                            className="btn-run !py-1 !px-2.5 text-xs !bg-cyan-600 hover:!bg-cyan-500"
                          >
                            {batchRunning ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3 fill-current" />
                            )}
                            {batchRunning ? "Running…" : `Run ${selectedBatchWfs.length} Batch`}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-black/30 rounded-lg">
                          {workflowList.map((wf) => {
                            const checked = selectedBatchWfs.includes(wf.id);
                            return (
                              <button
                                key={wf.id}
                                onClick={() =>
                                  setSelectedBatchWfs((prev) =>
                                    checked ? prev.filter((x) => x !== wf.id) : [...prev, wf.id]
                                  )
                                }
                                className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                                  checked
                                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                                    : "bg-white/5 text-zinc-400 hover:text-zinc-200"
                                }`}
                              >
                                {wf.name} ({wf.nodes.length}n)
                              </button>
                            );
                          })}
                        </div>

                        {batchResult && (
                          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs flex items-center justify-between font-semibold text-emerald-300">
                            <span>✅ Executed {batchResult.totalWorkflows} Workflows</span>
                            <span>Wall Time: {batchResult.parallelWallTimeMs} ms</span>
                          </div>
                        )}
                      </div>

                      {/* Multi-Website Parallel Scraper / Monitor */}
                      <div className="rounded-xl border border-white/10 bg-[#101420] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                              <Layers className="h-3.5 w-3.5" /> Parallel Website Health &amp; Scraper
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              Concurrently fetches sites, summarizes with Gemini, and records to Database.
                            </div>
                          </div>
                          <button
                            onClick={runQuickParallelWebsites}
                            disabled={quickWebRunning}
                            className="btn-primary !py-1 !px-2.5 text-xs"
                          >
                            {quickWebRunning ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            {quickWebRunning ? "Auditing…" : "Audit Sites"}
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          value={quickUrls}
                          onChange={(e) => setQuickUrls(e.target.value)}
                          className="input font-mono text-xs !py-1.5"
                          placeholder="One URL per line…"
                        />

                        {quickWebResult && (
                          <pre className="max-h-24 overflow-auto rounded border border-white/10 bg-black/50 p-2 font-mono text-[10px] text-cyan-300">
                            {JSON.stringify(quickWebResult, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Live Database Tables */}
                {dockTab === "database" && (
                  <div className="space-y-3 max-w-6xl mx-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200">Database Tables:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {dbTablesList.map((t) => (
                            <button
                              key={t.name}
                              onClick={() => {
                                setActiveTable(t.name);
                                loadDatabase(t.name);
                              }}
                              className={`rounded-md border px-2.5 py-1 font-mono text-xs transition ${
                                activeTable === t.name
                                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {t.name} ({t.count})
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadDatabase(activeTable)}
                          className="btn-ghost !py-1 !px-2 text-xs border border-white/10"
                          title="Refresh Table"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                        <button
                          onClick={async () => {
                            await fetch(`/api/db?table=${encodeURIComponent(activeTable)}`, { method: "DELETE" });
                            loadDatabase(activeTable);
                            showToast(`Cleared table "${activeTable}"`, "info");
                          }}
                          className="btn-ghost !py-1 !px-2 text-xs border border-white/10 text-rose-400 hover:text-rose-300"
                        >
                          Clear `{activeTable}`
                        </button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101420]">
                      {dbRecords.length === 0 ? (
                        <div className="p-8 text-center text-xs text-zinc-500">
                          No rows in `{activeTable}` yet. Run a workflow with Database Table node or submit a Form!
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
                            <tr>
                              <th className="px-4 py-2.5">ID</th>
                              <th className="px-4 py-2.5">Created</th>
                              <th className="px-4 py-2.5">Row Data (JSON)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-mono">
                            {dbRecords.map((r) => (
                              <tr key={r.id} className="hover:bg-white/[0.02]">
                                <td className="px-4 py-2 text-emerald-300 text-[11px]">{r.id}</td>
                                <td className="px-4 py-2 text-zinc-400 text-[11px] font-sans">
                                  {new Date(r.createdAt).toLocaleTimeString()}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-zinc-200 max-w-xl truncate">
                                  {JSON.stringify(r.data)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: Execution History */}
                {dockTab === "executions" && (
                  <div className="space-y-3 max-w-6xl mx-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 font-medium">
                        Past execution traces. Click any run to inspect per-node wave inputs &amp; outputs on canvas.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={loadExecutions}
                          className="btn-ghost !py-1 !px-2 text-xs border border-white/10"
                          title="Refresh history"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                        <button
                          onClick={async () => {
                            await fetch("/api/executions", { method: "DELETE" });
                            loadExecutions();
                            showToast("Execution history cleared", "info");
                          }}
                          className="btn-ghost !py-1 !px-2 text-xs border border-white/10 text-rose-400 hover:text-rose-300"
                        >
                          Clear History
                        </button>
                      </div>
                    </div>

                    {execHistory.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-[#101420] p-8 text-center text-xs text-zinc-500">
                        No executions yet. Click <strong>Run Workflow</strong> to execute!
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101420]">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
                            <tr>
                              <th className="px-4 py-2.5">Status</th>
                              <th className="px-4 py-2.5">Workflow</th>
                              <th className="px-4 py-2.5">Mode</th>
                              <th className="px-4 py-2.5">Started</th>
                              <th className="px-4 py-2.5">Nodes</th>
                              <th className="px-4 py-2.5">Error</th>
                              <th className="px-4 py-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {execHistory.map((e) => (
                              <tr
                                key={e.id}
                                onClick={() => inspectExecution(e.id)}
                                className="cursor-pointer transition hover:bg-white/[0.03]"
                              >
                                <td className="px-4 py-2">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      e.status === "success"
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : e.status === "error"
                                          ? "bg-rose-500/15 text-rose-300"
                                          : "bg-amber-500/15 text-amber-300"
                                    }`}
                                  >
                                    {e.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 font-medium text-zinc-200">{e.workflowName}</td>
                                <td className="px-4 py-2 uppercase text-[10px] font-mono text-zinc-400">{e.mode}</td>
                                <td className="px-4 py-2 text-zinc-400 text-[11px]">
                                  {new Date(e.startedAt).toLocaleTimeString()}
                                </td>
                                <td className="px-4 py-2 text-zinc-400">{e.nodeCount}</td>
                                <td className="px-4 py-2 text-rose-300 truncate max-w-xs">{e.error ?? "—"}</td>
                                <td className="px-4 py-2 text-right">
                                  <span className="text-[11px] font-semibold text-indigo-400 hover:underline">
                                    Inspect →
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: Telegram Bot & Mini-App Forms */}
                {dockTab === "telegram" && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 max-w-6xl mx-auto">
                    {/* Left: Telegram Bot */}
                    <div className="rounded-xl border border-sky-500/30 bg-[#101420] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                            <Send className="h-3.5 w-3.5" /> 2-Way Telegram Bot Listener
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {tgStatus?.bot?.username
                              ? `@${tgStatus.bot.username} · Polling live`
                              : "Polling Telegram Bot API with TELEGRAM_BOT_TOKEN"}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTelegramBot(tgStatus?.listening ? "stop" : "start")}
                          className={
                            tgStatus?.listening
                              ? "btn-ghost !py-1 !px-2.5 text-xs border border-emerald-500/40 text-emerald-300"
                              : "btn-primary !py-1 !px-2.5 text-xs"
                          }
                        >
                          <Power className="h-3 w-3" />
                          {tgStatus?.listening ? "Listening (Stop)" : "Start Listener"}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          value={tgSimText}
                          onChange={(e) => setTgSimText(e.target.value)}
                          className="input flex-1 text-xs !py-1"
                          placeholder="Test incoming message…"
                        />
                        <button
                          onClick={simulateTelegramIncoming}
                          disabled={tgSimulating}
                          className="btn-run !py-1 !px-3 text-xs"
                        >
                          {tgSimulating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          {tgSimulating ? "Replying…" : "Test Reply"}
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        <div className="text-[10px] font-semibold uppercase text-zinc-400">Recent Bot Events:</div>
                        {!tgStatus?.logs?.length ? (
                          <div className="text-[11px] text-zinc-500 italic">No incoming bot messages yet.</div>
                        ) : (
                          tgStatus.logs.slice(0, 5).map((l) => (
                            <div
                              key={l.id}
                              className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-2.5 py-1 text-xs"
                            >
                              <span className="truncate">
                                <strong className="text-sky-300">{l.from}:</strong> {l.text}
                              </span>
                              <span className="text-[10px] text-emerald-400">{l.status || "triggered"}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right: Public Mini-Apps / Forms */}
                    <div className="rounded-xl border border-pink-500/30 bg-[#101420] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-pink-300">
                          <FileSpreadsheet className="h-3.5 w-3.5" /> Mini-Apps &amp; Public Forms
                        </div>
                        <div className="flex gap-1">
                          {[
                            { slug: "parallel-websites", title: "🌐 Sites" },
                            { slug: "lead-capture", title: "💼 Leads" },
                            { slug: "order-checkout", title: "💳 Orders" },
                            { slug: "ask-ai", title: "🤖 AI" },
                          ].map((f) => (
                            <button
                              key={f.slug}
                              onClick={() => {
                                setActiveFormSlug(f.slug);
                                setFormResponse(null);
                              }}
                              className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                                activeFormSlug === f.slug
                                  ? "bg-pink-500/25 text-pink-200 border border-pink-500/40"
                                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                              }`}
                            >
                              {f.title}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {activeFormSlug === "parallel-websites" && (
                          <textarea
                            rows={2}
                            value={formUrls}
                            onChange={(e) => setFormUrls(e.target.value)}
                            className="input font-mono text-xs !py-1"
                          />
                        )}
                        {activeFormSlug !== "parallel-websites" && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                              placeholder="Name"
                              className="input !py-1 text-xs"
                            />
                            <input
                              value={formEmail}
                              onChange={(e) => setFormEmail(e.target.value)}
                              placeholder="Email"
                              className="input !py-1 text-xs"
                            />
                          </div>
                        )}
                        <button
                          onClick={submitMiniAppForm}
                          disabled={formSubmitting}
                          className="btn-run !py-1 !px-3 text-xs w-full justify-center"
                        >
                          {formSubmitting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3 fill-current" />
                          )}
                          {formSubmitting ? "Submitting…" : "Submit & Trigger Workflow"}
                        </button>

                        {formResponse && (
                          <pre className="max-h-24 overflow-auto rounded border border-white/10 bg-black/50 p-2 font-mono text-[10px] text-emerald-300">
                            {JSON.stringify(formResponse, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. MINIMAL ELEGANT 32PX STATUS BAR */}
        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-white/[0.08] bg-[#0c0e15] px-3.5 text-[11px] text-zinc-400 select-none z-40">
          {/* Left: [ ⚡ Worker Pool: 6x Idle ] [ 🗄️ Database: 0 records ] [ Last Run: Success ] */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleDockTabClick("queue");
              }}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-white/5 hover:text-zinc-200 transition"
              title="Click to open Worker Pool Telemetry"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  queueBadge.running > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                }`}
              />
              <span className="font-medium text-zinc-300">
                ⚡ Worker Pool: {queueBadge.concurrency}x {queueBadge.running > 0 ? `${queueBadge.running} Running` : "Idle"}
              </span>
            </button>

            <span className="text-zinc-600">·</span>

            <button
              onClick={() => {
                handleDockTabClick("database");
              }}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-white/5 hover:text-zinc-200 transition"
              title="Click to inspect Database Tables"
            >
              <Database className="h-3 w-3 text-emerald-400" />
              <span>Database: {totalDbCount} records</span>
            </button>

            <span className="text-zinc-600">·</span>

            <div className="flex items-center gap-1.5 px-2 py-0.5 text-zinc-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  lastExec ? (lastExec.status === "success" ? "bg-emerald-400" : "bg-rose-400") : "bg-zinc-500"
                }`}
              />
              <span>Last Run: {lastExec ? (lastExec.status === "success" ? "Success" : "Failed") : "Ready"}</span>
            </div>
          </div>

          {/* Right: [ ⌃ Console & Queue (Toggle) ] [ Fullscreen ] */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDockExpanded((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-0.5 font-medium transition ${
                dockExpanded
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "hover:bg-white/5 hover:text-zinc-200"
              }`}
              title="Toggle Console & Queue Dock"
            >
              {dockExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              <span>Console &amp; Queue</span>
              {queueBadge.running + queueBadge.queued > 0 && (
                <span className="rounded bg-amber-400 px-1 text-[9px] font-bold text-black animate-pulse">
                  {queueBadge.running + queueBadge.queued}
                </span>
              )}
            </button>

            <span className="text-zinc-600">·</span>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-white/5 hover:text-zinc-200 transition"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* ───────── Floating AI Workflow Builder Spotlight Modal (Cmd+K) ───────── */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-md animate-float-in">
          <div className="w-full max-w-2xl rounded-2xl border border-indigo-500/30 bg-[#121624]/95 p-5 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">AI Workflow Builder</h3>
                  <p className="text-[11px] text-zinc-400">Describe any automation in English or Tanglish</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">ESC to close</span>
                <button
                  onClick={() => setAiModalOpen(false)}
                  className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                ref={aiInputRef}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAiBuild();
                }}
                placeholder="e.g. Check 5 websites in parallel, analyze with Gemini AI, save to DB, and alert Telegram & Gmail..."
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 pr-28"
                autoFocus
              />
              <button
                onClick={() => handleAiBuild()}
                disabled={aiBuilding || !aiPrompt.trim()}
                className="absolute right-2 top-2 btn-primary !py-1.5 !px-3 text-xs"
              >
                {aiBuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {aiBuilding ? "Building…" : "Generate"}
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                1-Click Prompt Templates
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {AI_BUILDER_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleAiBuild(s)}
                    disabled={aiBuilding}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-left text-xs text-zinc-300 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
                  >
                    <Wand2 className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <span className="line-clamp-2">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Secrets Vault Modal ───────── */}
      {secretsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-float-in">
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#121624]/95 p-6 shadow-2xl backdrop-blur-xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Secrets Vault</h3>
                  <p className="text-[11px] text-zinc-400">
                    Synced automatically with <code className="text-indigo-300">D:\My n8n\.env</code>. Reference with{" "}
                    <code className="text-indigo-300">{"{{ $secrets.KEY }}"}</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSecretsModalOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_SECRET_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setNewSecretKey(k)}
                  className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-300"
                >
                  + {k}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/40 p-3 sm:grid-cols-3">
              <input
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                placeholder="KEY_NAME"
                className="input font-mono text-xs !py-1.5"
              />
              <input
                type="password"
                value={newSecretVal}
                onChange={(e) => setNewSecretVal(e.target.value)}
                placeholder="Secret value / token"
                className="input font-mono text-xs !py-1.5"
              />
              <button onClick={saveSecret} className="btn-primary justify-center !py-1.5 text-xs">
                Save Secret
              </button>
            </div>

            <div className="overflow-y-auto flex-1 rounded-xl border border-white/10 bg-black/30">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Key</th>
                    <th className="px-4 py-2.5">Preview</th>
                    <th className="px-4 py-2.5">Expression</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {secretList.map((s) => (
                    <tr key={s.key} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-semibold text-zinc-200">{s.key}</td>
                      <td className="px-4 py-2 text-zinc-400">{s.preview}</td>
                      <td className="px-4 py-2 text-indigo-300">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`{{ $secrets.${s.key} }}`);
                            setCopiedKey(s.key);
                            setTimeout(() => setCopiedKey(null), 1500);
                          }}
                          className="flex items-center gap-1.5 text-[11px] hover:text-indigo-200"
                          title="Click to copy expression"
                        >
                          <span>{`{{ $secrets.${s.key} }}`}</span>
                          {copiedKey === s.key ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => deleteSecret(s.key)} className="text-rose-400 hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

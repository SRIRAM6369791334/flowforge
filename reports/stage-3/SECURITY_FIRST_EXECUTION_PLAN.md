# FlowForge — Stage 3.0: Security-First Execution Plan

> **Scope**: Detailed engineering blueprints for Phase 1 P0 security gates, vulnerability mitigations, and core operational fixes prior to any UI/UX modifications.

---

## 1. Security Architecture Blueprint

```
                     INCOMING REQUEST / WORKFLOW TRIGGER
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    NEXT.JS MIDDLEWARE        │  <-- Task T1.5 (DEF-SEC-03)
                      │    (src/middleware.ts)      │      Loopback allowed freely;
                      │   Check x-flowforge-key     │      External/LAN requires key
                      └──────────────┬──────────────┘
                                     │ Allowed
                                     ▼
                      ┌─────────────────────────────┐
                      │     WORKFLOW ENGINE         │
                      │    (src/lib/engine.ts)      │
                      └──────────────┬──────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│      EXEC NODE      │   │  READ/WRITE FILES   │   │     GEMINI NODE     │
│ (`executors.ts:673`)│   │ (`executors.ts:649`)│   │ (`executors.ts:369`)│
├─────────────────────┤   ├─────────────────────┤   ├─────────────────────┤
│ Task T1.3           │   │ Task T1.4           │   │ Task T1.1           │
│ FLOWFORGE_ENABLE_   │   │ Jailed strictly to  │   │ Injects live ISO    │
│ EXEC kill-switch    │   │ `data/files/` root  │   │ timestamp & 2026 yr │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## 2. In-Depth Technical Implementation Blueprints

### 2.1 Task T1.1: Live ISO Timestamp Grounding (DEF-AI-01)
- **Target Files**: `src/lib/executors.ts:369-395`, `src/lib/telegramPoller.ts:115-135`
- **Vulnerability / Defect**: Gemini replies with training cutoff date (2024) and rejects user date corrections.
- **Implementation Blueprint**:
  In `src/lib/executors.ts` inside the `gemini` node executor:
  ```typescript
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
  const liveFacts = 
    `[LIVE RUNTIME FACTS: Today is ${dateStr}. Current Time is ${timeStr} IST. ` +
    `Current Year is ${now.getFullYear()}. Always provide current 2026 dates.]`;

  const finalSystem = s(p.system) ? `${s(p.system)}\n\n${liveFacts}` : liveFacts;
  const userPromptWithFacts = `${liveFacts}\n\n${s(p.prompt)}`;
  ```
- **Verification Criteria**: Query Gemini node with prompt *"What is today's year and date?"*; verify response contains `2026`.

---

### 2.2 Task T1.2: Canvas SSE Live Auto-Binding (DEF-WF-01)
- **Target File**: `src/app/page.tsx:210-255`
- **Vulnerability / Defect**: Canvas nodes at `http://localhost:3000` remain completely static during background Telegram or webhook executions.
- **Implementation Blueprint**:
  In `src/app/page.tsx`, establish a persistent `EventSource` connection to `/api/events`:
  ```typescript
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("workflow", (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "workflow_start" && payload.workflowId === activeWorkflowId) {
          // Auto-attach open canvas to background execution
          setActiveExecutionId(payload.executionId);
          setIsRunning(true);
        } else if (payload.type === "workflow_finish" && payload.executionId === activeExecutionId) {
          setIsRunning(false);
        }
      } catch { /* ignore malformed events */ }
    });
    return () => es.close();
  }, [activeWorkflowId, activeExecutionId]);
  ```
- **Verification Criteria**: Send test Telegram message or trigger webhook; observe canvas nodes automatically illuminating with green wave borders in real-time.

---

### 2.3 Task T1.3: Host Shell RCE Kill-Switch (DEF-SEC-01)
- **Target File**: `src/lib/executors.ts:673-690` (`exec` node)
- **Vulnerability**: Unrestricted command execution with host operating system privileges.
- **Implementation Blueprint**:
  ```typescript
  exec: {
    mode: "each",
    run: async (p) => {
      need(p, "command");
      const isExecEnabled = process.env.FLOWFORGE_ENABLE_EXEC === "true";
      if (!isExecEnabled) {
        throw new Error(
          "Security Policy Violation: Host shell command execution is disabled. " +
          "Set FLOWFORGE_ENABLE_EXEC=true in environment to authorize."
        );
      }
      // Sanitize command against null bytes and control chars
      const cmd = s(p.command).replace(/\0/g, "");
      const { stdout, stderr } = await execP(cmd, {
        cwd: s(p.cwd) || process.cwd(),
        timeout: (Number(p.timeout) || 60) * 1000,
      });
      return { stdout, stderr, exitCode: 0 };
    },
  }
  ```
- **Verification Criteria**: Verify `exec` throws error when `FLOWFORGE_ENABLE_EXEC` is not explicitly `"true"`.

---

### 2.4 Task T1.4: Filesystem Path Traversal Jail (DEF-SEC-02)
- **Target File**: `src/lib/executors.ts:649-672` (`read_file`, `write_file`)
- **Vulnerability**: Relative or absolute path traversal allows reading or overwriting system files.
- **Implementation Blueprint**:
  ```typescript
  function jailPath(userPath: string): string {
    const root = path.resolve(process.cwd(), "data", "files");
    if (!fsSync.existsSync(root)) {
      fsSync.mkdirSync(root, { recursive: true });
    }
    const resolved = path.resolve(root, userPath);
    if (!resolved.startsWith(root)) {
      throw new Error(`Security Policy Violation: Path "${userPath}" escapes the data/files jail boundary.`);
    }
    return resolved;
  }
  ```
  Apply `jailPath()` to both `read_file` and `write_file` executors.
- **Verification Criteria**: Passing `../../package.json` throws security jail exception.

---

### 2.5 Task T1.5: API Access Control Middleware (DEF-SEC-03)
- **Target File**: `src/middleware.ts` (New file)
- **Vulnerability**: Completely unauthenticated API access.
- **Implementation Blueprint**:
  Create Next.js middleware that checks requests to `/api/(workflows|secrets|db|queue)`:
  - If request originates from `127.0.0.1` or `::1` or `localhost`, permit seamlessly for zero-friction local development.
  - If request originates from external IP/LAN or public internet, require `headers.get("x-flowforge-key") === process.env.FLOWFORGE_API_KEY`.
- **Verification Criteria**: External HTTP requests without API key receive `401 Unauthorized`; local requests pass seamlessly.

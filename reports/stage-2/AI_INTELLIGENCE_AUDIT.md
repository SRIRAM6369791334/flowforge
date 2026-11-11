# FlowForge — Stage 2: AI Intelligence & LLM Subsystem Audit

> **Scope**: In-depth audit of Google Gemini integrations, OpenAI-compatible fallbacks, prompt engineering, dynamic context construction, conversation memory, and natural language workflow synthesis.  
> **Source Files**: `src/lib/nodes.ts:268-324`, `src/lib/executors.ts:369-461`, `src/lib/telegramPoller.ts:24-175`, `src/app/api/ai-builder/route.ts:1-285`.

---

## 1. AI Integration Architecture

FlowForge implements artificial intelligence across two major tiers:
1. **Runtime Execution Tier (`gemini` & `openai_chat` nodes)**: Direct execution of LLM requests inside workflow graphs.
2. **Workflow Synthesis Tier (`/api/ai-builder`)**: Natural-language to DAG generation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI SUBSYSTEM ARCHITECTURE                       │
├───────────────────────────────────┬────────────────────────────────────┤
│ RUNTIME NODE EXECUTION            │ AI WORKFLOW SYNTHESIS              │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Direct fetch to Gemini v1beta   │ • System prompt DAG constraints    │
│ • Direct fetch to OpenAI v1 API   │ • 3-Tier model cascade (12s abort) │
│ • Expression-injected prompts     │ • Heuristic regex fallback         │
│ • JSON structured output parser   │ • Topological coordinate layout    │
│ • In-memory per-chat memory (TG)  │ • Direct persistence to `db.json`  │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. In-Depth Defect & Vulnerability Analysis

### 2.1 DEF-AI-01: Temporal Disconnection & Date Hallucination
- **Confirmed Evidence**:
  - `src/lib/telegramPoller.ts:156-167`:
    ```typescript
    const systemInstruction = 
      `You are FlowForge AI, an intelligent Telegram assistant for Sriram. ` +
      `Respond naturally, warmly, concisely, and helpfully in English or Tanglish (Tamil-English) as appropriate.`;
    ```
  - `src/lib/executors.ts:369-375`:
    ```typescript
    const system = s(p.system) || "You are a helpful assistant.";
    ```
- **Analysis**:
  - The model receives zero context regarding the current date, time, year, or local timezone.
  - When asked for temporal information, Gemini 2.5 Flash defaults to its internal training knowledge cutoff date (mid-2024).
  - The model firmly asserts that 2024 is the current year and rejects user corrections stating that 2026 is far in the future.
- **Architectural Solution**:
  Dynamically prepend the following metadata block to all system instructions before dispatching to the LLM:
  ```typescript
  const now = new Date();
  const temporalContext = 
    `[SYSTEM RUNTIME CONTEXT]\n` +
    `Current ISO Timestamp: ${now.toISOString()}\n` +
    `Current Year: ${now.getFullYear()}\n` +
    `Current Date: ${now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
    `Server Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n` +
    `---\n`;
  ```

---

### 2.2 DEF-AI-02: AI Builder Prompt Whitelist Omission
- **Confirmed Evidence**:
  - `src/app/api/ai-builder/route.ts:18-41`:
    ```typescript
    Supported node types:
    - Triggers: manual_trigger, telegram_trigger, form_trigger, schedule_trigger, webhook_trigger
    - Parallel & Web: parallel_web
    - Core: http_request, set, if, code, split_out, merge, delay
    - AI: gemini, openai_chat
    - Messaging: telegram, whatsapp, slack, discord, email
    ```
- **Analysis**:
  - 7 node types are entirely omitted: `db_query`, `google_sheets`, `razorpay`, `stripe`, `read_file`, `write_file`, and `exec`.
  - The model will never generate database logging or payment nodes from natural language prompts, even when the user explicitly requests: *"When a payment is received, store in database and send email"*.
- **Architectural Solution**:
  Update `SYSTEM_PROMPT` to enumerate all 27 registered node types with their required parameters.

---

### 2.3 DEF-AI-03: In-Memory Conversation Memory Volatility
- **Confirmed Evidence**:
  - `src/lib/telegramPoller.ts:24`:
    ```typescript
    const SESSION_CHATS = new Map<string, SessionChat>();
    ```
- **Analysis**:
  - Conversation context is held in a Node.js process heap variable.
  - Any server restart, crash, or code reload wipes all user chat history.
- **Architectural Solution**:
  Persist `SESSION_CHATS` in `data/db.json` under a new collection `sessions`, or cache in a dedicated file `data/sessions.json`.

---

### 2.4 DEF-AI-04: Lack of Exponential Backoff on HTTP 429
- **Confirmed Evidence**:
  - `src/lib/executors.ts:405-412`:
    ```typescript
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }
    ```
- **Analysis**:
  - If the Gemini API returns HTTP 429 (`RESOURCE_EXHAUSTED`), the executor throws an unhandled error immediately.
  - The workflow terminates or falls back without attempting a 2-second or 4-second exponential backoff.
- **Architectural Solution**:
  Wrap the fetch call with a 3-attempt jittered exponential retry loop on HTTP 429 and HTTP 503 status codes.

---

## 3. Absence of Dynamic Tool / Function Calling
- Currently, FlowForge's AI integrations operate strictly as text transformers (Text-in → Text-out).
- The Gemini model cannot dynamically inspect database tables or trigger external tools autonomously during conversation; it can only execute within the static graph sequence.
- **Recommendation for Stage 3/4**: Integrate Gemini Function Calling schemas to allow autonomous agent nodes that decide which sub-workflows to trigger.

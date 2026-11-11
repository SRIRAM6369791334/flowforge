import type { NodeMeta } from "./types";

/**
 * Client-safe node catalogue. Executors live in ./executors.ts.
 * Any text field supports expressions: {{ $json.email }} {{ $node["HTTP Request"].json.id }} {{ $secrets.API_KEY }}
 */
export const NODE_DEFS: NodeMeta[] = [
  // ───────────── Triggers ─────────────
  {
    type: "manual_trigger",
    label: "Manual Trigger",
    description: "Start the workflow by clicking Run",
    category: "Triggers",
    color: "#f97316",
    icon: "MousePointerClick",
    isTrigger: true,
    fields: [{ key: "sample", label: "Test payload (JSON)", type: "json", default: "{}", help: "Emitted as the first item" }],
  },
  {
    type: "telegram_trigger",
    label: "Telegram Bot Trigger",
    description: "Fires live when you message your Telegram Bot",
    category: "Triggers",
    color: "#0ea5e9",
    icon: "Send",
    isTrigger: true,
    fields: [
      {
        key: "commandFilter",
        label: "Command / keyword filter (optional)",
        type: "text",
        default: "",
        placeholder: "e.g. /check or leave empty for all messages",
        help: "Leave blank to trigger on every incoming Telegram message",
      },
    ],
  },
  {
    type: "form_trigger",
    label: "Public Form Trigger",
    description: "Fires when a user submits a Mini-App / Public Form",
    category: "Triggers",
    color: "#ec4899",
    icon: "FileSpreadsheet",
    isTrigger: true,
    fields: [
      {
        key: "formSlug",
        label: "Form slug",
        type: "select",
        default: "parallel-websites",
        options: [
          { label: "🌐 Parallel Multi-Website Audit Form", value: "parallel-websites" },
          { label: "💼 Lead Capture & Auto-Responder Form", value: "lead-capture" },
          { label: "💳 Instant Order & Payment Form", value: "order-checkout" },
          { label: "🤖 Ask AI & Save to DB Form", value: "ask-ai" },
        ],
      },
    ],
  },
  {
    type: "schedule_trigger",
    label: "Schedule",
    description: "Run on a cron schedule (workflow must be Active)",
    category: "Triggers",
    color: "#f97316",
    icon: "Clock",
    isTrigger: true,
    fields: [
      { key: "cron", label: "Cron expression", type: "text", default: "*/5 * * * *", help: "min hour day month weekday — e.g. 0 9 * * 1-5 = 9am weekdays" },
      { key: "timezone", label: "Timezone", type: "text", default: "Asia/Kolkata" },
    ],
  },
  {
    type: "webhook_trigger",
    label: "Webhook",
    description: "Trigger via HTTP call to /api/webhook/<path> (workflow must be Active)",
    category: "Triggers",
    color: "#f97316",
    icon: "Webhook",
    isTrigger: true,
    fields: [
      { key: "path", label: "Path", type: "text", default: "my-hook", required: true },
      {
        key: "method",
        label: "Method",
        type: "select",
        default: "ANY",
        options: ["ANY", "GET", "POST", "PUT", "PATCH", "DELETE"].map((v) => ({ label: v, value: v })),
      },
      {
        key: "respond",
        label: "Respond",
        type: "select",
        default: "immediately",
        options: [
          { label: "Immediately (202)", value: "immediately" },
          { label: "With last node output", value: "lastNode" },
        ],
      },
    ],
  },

  // ───────────── Parallel & Web ─────────────
  {
    type: "parallel_web",
    label: "Parallel Multi-Website",
    description: "Run multiple websites / APIs at the exact same time (Promise.all)",
    category: "Parallel & Web",
    color: "#06b6d4",
    icon: "Layers",
    fields: [
      {
        key: "urls",
        label: "URLs (one per line or JSON array)",
        type: "textarea",
        default:
          "https://news.ycombinator.com\nhttps://api.github.com/zen\nhttps://jsonplaceholder.typicode.com/todos/1\nhttps://httpbin.org/get",
        help: "All URLs are fetched simultaneously in parallel",
        required: true,
      },
      {
        key: "extract",
        label: "Extract mode",
        type: "select",
        default: "auto",
        options: [
          { label: "Auto (Page Title + Meta + H1 + Status + Latency)", value: "auto" },
          { label: "JSON Response", value: "json" },
          { label: "Regex Match", value: "regex" },
          { label: "Raw Text Snippet", value: "text" },
        ],
      },
      {
        key: "regex",
        label: "Regex pattern (optional)",
        type: "text",
        default: "<title>([^<]+)</title>",
      },
      {
        key: "concurrency",
        label: "Max parallel concurrency",
        type: "number",
        default: 10,
      },
      {
        key: "emitMode",
        label: "Output format",
        type: "select",
        default: "summary_and_items",
        options: [
          { label: "Combined Summary Item (results[] + stats)", value: "summary_and_items" },
          { label: "One Item per Website (fan-out)", value: "individual" },
        ],
      },
    ],
  },

  // ───────────── Core ─────────────
  {
    type: "http_request",
    label: "HTTP Request",
    description: "Call any REST API",
    category: "Core",
    color: "#3b82f6",
    icon: "Globe",
    fields: [
      {
        key: "method",
        label: "Method",
        type: "select",
        default: "GET",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((v) => ({ label: v, value: v })),
      },
      { key: "url", label: "URL", type: "text", default: "https://jsonplaceholder.typicode.com/todos/1", required: true },
      { key: "headers", label: "Headers (JSON)", type: "json", default: "{}" },
      { key: "body", label: "Body (JSON)", type: "json", default: "", help: "Ignored for GET" },
    ],
  },
  {
    type: "set",
    label: "Set Fields",
    description: "Add or overwrite fields on each item",
    category: "Core",
    color: "#3b82f6",
    icon: "PenLine",
    fields: [
      { key: "values", label: "Fields (JSON)", type: "json", default: '{\n  "greeting": "Hello {{ $json.name }}"\n}' },
      { key: "keepExisting", label: "Keep existing fields", type: "boolean", default: true },
    ],
  },
  {
    type: "if",
    label: "IF",
    description: "Route items to true / false branches",
    category: "Core",
    color: "#a855f7",
    icon: "GitBranch",
    outputs: ["true", "false"],
    fields: [
      { key: "left", label: "Value", type: "text", default: "{{ $json.status }}" },
      {
        key: "operator",
        label: "Operator",
        type: "select",
        default: "equals",
        options: [
          { label: "equals", value: "equals" },
          { label: "not equals", value: "notEquals" },
          { label: "contains", value: "contains" },
          { label: "greater than", value: "gt" },
          { label: "less than", value: "lt" },
          { label: "is empty", value: "isEmpty" },
          { label: "is not empty", value: "isNotEmpty" },
          { label: "is true", value: "isTrue" },
        ],
      },
      { key: "right", label: "Compare to", type: "text", default: "" },
    ],
  },
  {
    type: "code",
    label: "Code (JavaScript)",
    description: "Transform items with JavaScript",
    category: "Core",
    color: "#a855f7",
    icon: "Code",
    fields: [
      {
        key: "code",
        label: "JavaScript",
        type: "code",
        default:
          "// `items` = [{ json: {...} }], also $secrets, $node, fetch\n// return an array of objects or items\nreturn items.map(i => ({ ...i.json, processedAt: new Date().toISOString() }));",
      },
    ],
  },
  {
    type: "split_out",
    label: "Split Into Items",
    description: "Turn an array field into separate items (loop)",
    category: "Core",
    color: "#a855f7",
    icon: "Split",
    fields: [{ key: "field", label: "Array field path", type: "text", default: "results", help: "Dot path, e.g. results or body.users" }],
  },
  {
    type: "merge",
    label: "Merge",
    description: "Combine items from multiple parallel branches",
    category: "Core",
    color: "#a855f7",
    icon: "Merge",
    fields: [],
  },
  {
    type: "delay",
    label: "Wait",
    description: "Pause before continuing",
    category: "Core",
    color: "#64748b",
    icon: "Timer",
    fields: [{ key: "seconds", label: "Seconds", type: "number", default: 1 }],
  },

  // ───────────── AI ─────────────
  {
    type: "gemini",
    label: "Gemini AI",
    description: "Generate text with Google Gemini",
    category: "AI",
    color: "#8b5cf6",
    icon: "Sparkles",
    fields: [
      { key: "apiKey", label: "API key", type: "text", default: "{{ $secrets.GEMINI_API_KEY }}" },
      { key: "model", label: "Model", type: "text", default: "gemini-2.5-flash" },
      { key: "system", label: "System instruction", type: "textarea", default: "You are a helpful assistant." },
      { key: "prompt", label: "Prompt", type: "textarea", default: "Summarize: {{ JSON.stringify($json) }}", required: true },
      { key: "jsonMode", label: "Return JSON", type: "boolean", default: false },
    ],
  },
  {
    type: "openai_chat",
    label: "OpenAI-compatible LLM",
    description: "OpenAI, OpenRouter, Groq, Ollama…",
    category: "AI",
    color: "#8b5cf6",
    icon: "Bot",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "text", default: "https://api.openai.com/v1" },
      { key: "apiKey", label: "API key", type: "text", default: "{{ $secrets.OPENAI_API_KEY }}" },
      { key: "model", label: "Model", type: "text", default: "gpt-4o-mini" },
      { key: "system", label: "System prompt", type: "textarea", default: "You are a helpful assistant." },
      { key: "prompt", label: "Prompt", type: "textarea", default: "{{ $json.text }}", required: true },
    ],
  },

  // ───────────── Messaging ─────────────
  {
    type: "telegram",
    label: "Telegram",
    description: "Send a Telegram bot message",
    category: "Messaging",
    color: "#0ea5e9",
    icon: "Send",
    fields: [
      { key: "botToken", label: "Bot token", type: "text", default: "{{ $secrets.TELEGRAM_BOT_TOKEN }}" },
      { key: "chatId", label: "Chat ID", type: "text", default: "{{ $secrets.TELEGRAM_CHAT_ID }}", required: true },
      { key: "text", label: "Message", type: "textarea", default: "Hello from FlowForge 🚀" },
      {
        key: "parseMode",
        label: "Parse mode",
        type: "select",
        default: "",
        options: [
          { label: "None", value: "" },
          { label: "Markdown", value: "MarkdownV2" },
          { label: "HTML", value: "HTML" },
        ],
      },
    ],
  },
  {
    type: "whatsapp",
    label: "WhatsApp",
    description: "Send via WhatsApp Cloud API (Meta)",
    category: "Messaging",
    color: "#22c55e",
    icon: "MessageCircle",
    fields: [
      { key: "token", label: "Access token", type: "text", default: "{{ $secrets.WHATSAPP_TOKEN }}" },
      { key: "phoneNumberId", label: "Phone number ID", type: "text", default: "{{ $secrets.WHATSAPP_PHONE_ID }}" },
      { key: "to", label: "To (with country code)", type: "text", default: "91XXXXXXXXXX", required: true },
      {
        key: "kind",
        label: "Message type",
        type: "select",
        default: "text",
        options: [
          { label: "Text", value: "text" },
          { label: "Template", value: "template" },
        ],
      },
      { key: "text", label: "Text", type: "textarea", default: "Vanakkam! 👋", help: "Text messages need an open 24h session" },
      { key: "template", label: "Template name", type: "text", default: "hello_world" },
      { key: "language", label: "Template language", type: "text", default: "en_US" },
    ],
  },
  {
    type: "slack",
    label: "Slack",
    description: "Post to Slack via incoming webhook",
    category: "Messaging",
    color: "#e11d48",
    icon: "Hash",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", type: "text", default: "{{ $secrets.SLACK_WEBHOOK_URL }}" },
      { key: "text", label: "Message", type: "textarea", default: "New event: {{ JSON.stringify($json) }}" },
    ],
  },
  {
    type: "discord",
    label: "Discord",
    description: "Post to Discord via webhook",
    category: "Messaging",
    color: "#6366f1",
    icon: "MessagesSquare",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", type: "text", default: "{{ $secrets.DISCORD_WEBHOOK_URL }}" },
      { key: "username", label: "Bot name", type: "text", default: "FlowForge" },
      { key: "content", label: "Message", type: "textarea", default: "Hello from FlowForge 🚀" },
    ],
  },
  {
    type: "email",
    label: "Email (Gmail SMTP / Resend)",
    description: "Send email via Gmail App Password or Resend API",
    category: "Messaging",
    color: "#ef4444",
    icon: "Mail",
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        default: "gmail_smtp",
        options: [
          { label: "Gmail / SMTP (GMAIL_USER + GMAIL_APP_PASSWORD)", value: "gmail_smtp" },
          { label: "Resend API (RESEND_API_KEY)", value: "resend" },
        ],
      },
      { key: "host", label: "SMTP host", type: "text", default: "smtp.gmail.com" },
      { key: "port", label: "Port", type: "number", default: 465 },
      { key: "user", label: "Gmail / SMTP user", type: "text", default: "{{ $secrets.GMAIL_USER }}" },
      { key: "pass", label: "Gmail App Password", type: "text", default: "{{ $secrets.GMAIL_APP_PASSWORD }}" },
      { key: "resendApiKey", label: "Resend API Key", type: "text", default: "{{ $secrets.RESEND_API_KEY }}" },
      { key: "from", label: "From (Resend)", type: "text", default: "{{ $secrets.DEFAULT_FROM_EMAIL }}" },
      { key: "to", label: "To", type: "text", default: "{{ $secrets.GMAIL_USER }}", required: true },
      { key: "subject", label: "Subject", type: "text", default: "Hello from FlowForge 🚀" },
      { key: "body", label: "Body", type: "textarea", default: "Hi Sriram,\n\n{{ $json.text || JSON.stringify($json) }}" },
      { key: "html", label: "Body is HTML", type: "boolean", default: false },
    ],
  },

  // ───────────── Database ─────────────
  {
    type: "db_query",
    label: "Database Table",
    description: "Insert or query rows in FlowForge DB tables",
    category: "Database",
    color: "#10b981",
    icon: "Database",
    fields: [
      {
        key: "operation",
        label: "Operation",
        type: "select",
        default: "insert",
        options: [
          { label: "Insert Row", value: "insert" },
          { label: "Select / List Rows", value: "select" },
          { label: "Clear Table", value: "clear" },
        ],
      },
      {
        key: "table",
        label: "Table name",
        type: "text",
        default: "website_monitors",
        help: "e.g. website_monitors, leads, orders, ai_logs",
        required: true,
      },
      {
        key: "record",
        label: "Row data (JSON, for Insert)",
        type: "json",
        default: "{{ JSON.stringify($json) }}",
      },
      {
        key: "limit",
        label: "Limit (for Select)",
        type: "number",
        default: 25,
      },
    ],
  },

  // ───────────── Google ─────────────
  {
    type: "google_sheets",
    label: "Google Sheets",
    description: "Read or append rows (service account)",
    category: "Google",
    color: "#16a34a",
    icon: "Sheet",
    fields: [
      {
        key: "credentials",
        label: "Service account JSON",
        type: "text",
        default: "{{ $secrets.GOOGLE_SERVICE_ACCOUNT }}",
        help: "Share the sheet with the service account email",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        default: "append",
        options: [
          { label: "Append row", value: "append" },
          { label: "Read rows", value: "read" },
        ],
      },
      { key: "spreadsheetId", label: "Spreadsheet ID", type: "text", default: "", required: true },
      { key: "range", label: "Range", type: "text", default: "Sheet1!A:Z" },
      { key: "values", label: "Row values (JSON array)", type: "json", default: '["{{ $json.name }}", "{{ $json.email }}"]', help: "Append only" },
    ],
  },

  // ───────────── Payments ─────────────
  {
    type: "razorpay",
    label: "Razorpay",
    description: "Payment links, orders, webhook verification",
    category: "Payments",
    color: "#2563eb",
    icon: "IndianRupee",
    fields: [
      { key: "keyId", label: "Key ID", type: "text", default: "{{ $secrets.RAZORPAY_KEY_ID }}" },
      { key: "keySecret", label: "Key secret", type: "text", default: "{{ $secrets.RAZORPAY_KEY_SECRET }}" },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        default: "payment_link",
        options: [
          { label: "Create payment link", value: "payment_link" },
          { label: "Create order", value: "order" },
          { label: "Fetch payment", value: "fetch_payment" },
          { label: "Verify webhook signature", value: "verify" },
        ],
      },
      { key: "amount", label: "Amount (₹)", type: "number", default: 499 },
      { key: "description", label: "Description", type: "text", default: "Order payment" },
      { key: "customerName", label: "Customer name", type: "text", default: "{{ $json.name }}" },
      { key: "customerEmail", label: "Customer email", type: "text", default: "{{ $json.email }}" },
      { key: "customerPhone", label: "Customer phone", type: "text", default: "{{ $json.phone }}" },
      { key: "paymentId", label: "Payment ID (fetch)", type: "text", default: "" },
      { key: "webhookSecret", label: "Webhook secret (verify)", type: "text", default: "{{ $secrets.RAZORPAY_WEBHOOK_SECRET }}" },
    ],
  },
  {
    type: "stripe",
    label: "Stripe",
    description: "Checkout sessions & payment lookup",
    category: "Payments",
    color: "#635bff",
    icon: "CreditCard",
    fields: [
      { key: "secretKey", label: "Secret key", type: "text", default: "{{ $secrets.STRIPE_SECRET_KEY }}" },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        default: "checkout",
        options: [
          { label: "Create checkout session", value: "checkout" },
          { label: "Fetch payment intent", value: "fetch_intent" },
        ],
      },
      { key: "amount", label: "Amount (major units)", type: "number", default: 10 },
      { key: "currency", label: "Currency", type: "text", default: "usd" },
      { key: "productName", label: "Product name", type: "text", default: "FlowForge order" },
      { key: "successUrl", label: "Success URL", type: "text", default: "https://example.com/success" },
      { key: "cancelUrl", label: "Cancel URL", type: "text", default: "https://example.com/cancel" },
      { key: "intentId", label: "Payment intent ID (fetch)", type: "text", default: "" },
    ],
  },

  // ───────────── System ─────────────
  {
    type: "read_file",
    label: "Read File",
    description: "Read a local file",
    category: "System",
    color: "#78716c",
    icon: "FileInput",
    fields: [
      { key: "path", label: "File path", type: "text", default: "./data/files/input.txt", required: true },
      { key: "parseJson", label: "Parse as JSON", type: "boolean", default: false },
    ],
  },
  {
    type: "write_file",
    label: "Write File",
    description: "Write / append to a local file",
    category: "System",
    color: "#78716c",
    icon: "FileOutput",
    fields: [
      { key: "path", label: "File path", type: "text", default: "./data/files/output.txt", required: true },
      { key: "content", label: "Content", type: "textarea", default: "{{ JSON.stringify($json) }}" },
      { key: "append", label: "Append (one line per item)", type: "boolean", default: true },
    ],
  },
  {
    type: "exec",
    label: "Run Command",
    description: "Execute a shell command / script",
    category: "System",
    color: "#78716c",
    icon: "Terminal",
    fields: [
      { key: "command", label: "Command", type: "text", default: "node --version", required: true },
      { key: "cwd", label: "Working directory", type: "text", default: "" },
      { key: "timeout", label: "Timeout (s)", type: "number", default: 60 },
    ],
  },
];

export const NODE_MAP: Record<string, NodeMeta> = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]));

export const CATEGORIES = [
  "Triggers",
  "Parallel & Web",
  "Core",
  "AI",
  "Messaging",
  "Database",
  "Google",
  "Payments",
  "System",
] as const;

export function defaultParams(type: string): Record<string, unknown> {
  const def = NODE_MAP[type];
  return Object.fromEntries((def?.fields ?? []).map((f) => [f.key, f.default ?? ""]));
}

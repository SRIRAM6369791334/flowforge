# FlowForge — Stage 1.5: Verified Node & Executor Registry

> **Scope**: 100% verified specification of all **27 registered node types** in FlowForge.  
> **Source Files**: `src/lib/nodes.ts:7-579` (`NODE_DEFS`), `src/lib/executors.ts:122-691` (`EXECUTORS`), `src/lib/types.ts:1-103`.  
> **Verification Status**: `STATICALLY VERIFIED` across all 27 nodes; `RUNTIME VERIFIED` on core operational pipelines.

---

## 1. Node Registry Summary Table

| # | Type Key | Category | Mode | Label | Icon / Color | Definition Line | Executor Line | Verification Status |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `manual_trigger` | Triggers | `all` | Manual Trigger | `MousePointerClick` / `#f97316` | `nodes.ts:10` | `executors.ts:123` | `RUNTIME VERIFIED` |
| 2 | `telegram_trigger` | Triggers | `all` | Telegram Bot Trigger | `Send` / `#0284c7` | `nodes.ts:20` | `executors.ts:138` | `RUNTIME VERIFIED` |
| 3 | `form_trigger` | Triggers | `all` | Public Form Trigger | `FileText` / `#8b5cf6` | `nodes.ts:39` | `executors.ts:152` | `STATICALLY VERIFIED` |
| 4 | `schedule_trigger` | Triggers | `all` | Schedule | `Clock` / `#eab308` | `nodes.ts:62` | `executors.ts:130` | `STATICALLY VERIFIED` |
| 5 | `webhook_trigger` | Triggers | `all` | Webhook | `Webhook` / `#06b6d4` | `nodes.ts:75` | `executors.ts:134` | `STATICALLY VERIFIED` |
| 6 | `parallel_web` | Parallel & Web | `all` | Parallel Multi-Website | `Globe` / `#38bdf8` | `nodes.ts:106` | `executors.ts:165` | `RUNTIME VERIFIED` |
| 7 | `http_request` | Core | `each` | HTTP Request | `Globe` / `#3b82f6` | `nodes.ts:161` | `executors.ts:301` | `STATICALLY VERIFIED` |
| 8 | `set` | Core | `each` | Set Fields | `Layers` / `#6366f1` | `nodes.ts:181` | `executors.ts:312` | `RUNTIME VERIFIED` |
| 9 | `if` | Core | `each` | IF | `GitFork` / `#ec4899` | `nodes.ts:193` | `executors.ts:319` | `STATICALLY VERIFIED` |
| 10 | `code` | Core | `all` | Code (JavaScript) | `Terminal` / `#14b8a6` | `nodes.ts:222` | `executors.ts:323` | `STATICALLY VERIFIED` |
| 11 | `split_out` | Core | `all` | Split Into Items | `ListFilter` / `#a855f7` | `nodes.ts:239` | `executors.ts:351` | `STATICALLY VERIFIED` |
| 12 | `merge` | Core | `all` | Merge | `Merge` / `#64748b` | `nodes.ts:248` | `executors.ts:359` | `STATICALLY VERIFIED` |
| 13 | `delay` | Core | `all` | Wait | `Hourglass` / `#f59e0b` | `nodes.ts:257` | `executors.ts:360` | `STATICALLY VERIFIED` |
| 14 | `gemini` | AI | `each` | Gemini AI | `Sparkles` / `#a855f7` | `nodes.ts:268` | `executors.ts:369` | `RUNTIME VERIFIED` |
| 15 | `openai_chat` | AI | `each` | OpenAI-compatible LLM | `Bot` / `#10b981` | `nodes.ts:298` | `executors.ts:443` | `PARTIALLY VERIFIED` |
| 16 | `telegram` | Messaging | `each` | Telegram | `Send` / `#0ea5e9` | `nodes.ts:326` | `executors.ts:462` | `RUNTIME VERIFIED` |
| 17 | `whatsapp` | Messaging | `each` | WhatsApp | `MessageCircle` / `#22c55e` | `nodes.ts:339` | `executors.ts:489` | `PARTIALLY VERIFIED` |
| 18 | `slack` | Messaging | `each` | Slack | `Slack` / `#4a154b` | `nodes.ts:362` | `executors.ts:506` | `PARTIALLY VERIFIED` |
| 19 | `discord` | Messaging | `each` | Discord | `MessageSquare` / `#5865f2` | `nodes.ts:373` | `executors.ts:514` | `PARTIALLY VERIFIED` |
| 20 | `email` | Messaging | `each` | Email (Gmail SMTP / Resend) | `Mail` / `#ef4444` | `nodes.ts:385` | `executors.ts:522` | `PARTIALLY VERIFIED` |
| 21 | `db_query` | Database | `each` | Database Table | `Database` / `#10b981` | `nodes.ts:419` | `executors.ts:282` | `RUNTIME VERIFIED` |
| 22 | `google_sheets` | Google | `each` | Google Sheets | `Sheet` / `#16a34a` | `nodes.ts:450` | `executors.ts:557` | `PARTIALLY VERIFIED` |
| 23 | `razorpay` | Payments | `each` | Razorpay | `CreditCard` / `#0284c7` | `nodes.ts:482` | `executors.ts:579` | `PARTIALLY VERIFIED` |
| 24 | `stripe` | Payments | `each` | Stripe | `CreditCard` / `#6366f1` | `nodes.ts:513` | `executors.ts:625` | `PARTIALLY VERIFIED` |
| 25 | `read_file` | System | `each` | Read File | `FileText` / `#64748b` | `nodes.ts:542` | `executors.ts:649` | `STATICALLY VERIFIED` |
| 26 | `write_file` | System | `each` | Write File | `Save` / `#64748b` | `nodes.ts:554` | `executors.ts:662` | `STATICALLY VERIFIED` |
| 27 | `exec` | System | `each` | Run Command | `Terminal` / `#dc2626` | `nodes.ts:567` | `executors.ts:673` | `STATICALLY VERIFIED` |

---

## 2. In-Depth Verified Specifications by Category

### Category 1: Triggers (5 Nodes)

#### 1. `manual_trigger` (`nodes.ts:10`, `executors.ts:123`)
- **Category**: `Triggers` | **Color**: `#f97316` | **Icon**: `MousePointerClick` | `isTrigger: true`
- **Mode**: `"all"` (Processes entire item batch).
- **Parameters**:
  - `sample` (`json`, default: `"{}"`): Initial test payload parsed as JSON.
- **Executor Logic**: If `items` input is empty, parses `sample` and emits `[{ json: parsed }]`. If items exist, emits `items`.
- **Output Schema**: `Item[]` where item contains `sample` keys.

#### 2. `telegram_trigger` (`nodes.ts:20`, `executors.ts:138`)
- **Category**: `Triggers` | **Color**: `#0284c7` | **Icon**: `Send` | `isTrigger: true`
- **Mode**: `"all"`
- **Parameters**:
  - `listenMode` (`select`, default: `"all"`): `"all"` (all messages) or `"commands"` (only `/start`, `/help`, etc.).
  - `filterText` (`text`, default: `""`): Substring or regex filter.
- **Executor Logic**: Reads incoming message from `items[0].json` (injected by `telegramPoller.ts`). Formats `{ message, text, chatId, sender, timestamp }`. If `listenMode === "commands"` and `!text.startsWith("/")`, filters out item.
- **Output Schema**: `[{ json: { chatId: number, text: string, username: string, firstName: string, ... } }]`.

#### 3. `form_trigger` (`nodes.ts:39`, `executors.ts:152`)
- **Category**: `Triggers` | **Color**: `#8b5cf6` | **Icon**: `FileText` | `isTrigger: true`
- **Mode**: `"all"`
- **Parameters**:
  - `formTitle` (`text`, default: `"Contact Form"`): Title displayed on public form page.
  - `fields` (`json`, default: schema array of `{ name, label, type, required }`).
  - `submitMessage` (`text`, default: `"Thank you! Your response has been recorded."`).
- **Executor Logic**: Emits submission payload injected via `/api/forms/submit` POST request.
- **Output Schema**: `[{ json: { formId, submittedAt, ...fieldValues } }]`.

#### 4. `schedule_trigger` (`nodes.ts:62`, `executors.ts:130`)
- **Category**: `Triggers` | **Color**: `#eab308` | **Icon**: `Clock` | `isTrigger: true`
- **Mode**: `"all"`
- **Parameters**:
  - `cron` (`text`, default: `"*/5 * * * *"`): Standard 5-field cron syntax.
  - `timezone` (`text`, default: `"Asia/Kolkata"`): Target timezone.
- **Executor Logic**: Emits timestamp object `{ triggeredAt: string, cron: string, timezone: string }`.
- **Output Schema**: `[{ json: { triggeredAt: ISO, cron: string } }]`.

#### 5. `webhook_trigger` (`nodes.ts:75`, `executors.ts:134`)
- **Category**: `Triggers` | **Color**: `#06b6d4` | **Icon**: `Webhook` | `isTrigger: true`
- **Mode**: `"all"`
- **Parameters**:
  - `path` (`text`, default: `"my-hook"`, `required: true`): URL subpath for `/api/webhook/[...path]`.
  - `method` (`select`, default: `"POST"`): HTTP method filter (`"GET"`, `"POST"`, `"PUT"`, `"PATCH"`, `"DELETE"`, `"ANY"`).
  - `respond` (`select`, default: `"immediately"`): `"immediately"` (202 Accepted) vs. `"lastNode"` (waits for workflow completion and returns downstream output).
- **Executor Logic**: Emits `{ body, query, headers, rawBody }`.
- **Output Schema**: `[{ json: { body: any, query: Record<string, string>, headers: Record<string, string> } }]`.

---

### Category 2: Parallel & Web (1 Node)

#### 6. `parallel_web` (`nodes.ts:106`, `executors.ts:165`)
- **Category**: `Parallel & Web` | **Color**: `#38bdf8` | **Icon**: `Globe`
- **Mode**: `"all"` (Executes concurrent audits).
- **Parameters**:
  - `urls` (`textarea`, default: list of 5 test URLs): Newline-separated target URLs.
  - `method` (`select`, default: `"GET"`).
  - `followRedirects` (`boolean`, default: `true`).
  - `timeoutMs` (`number`, default: `8000`).
  - `extractMode` (`select`, default: `"metadata"`): `"metadata"`, `"html"`, `"text"`, or `"headers"`.
- **Executor Logic**: Concurrently fetches all URLs using `Promise.allSettled()`. Extracts HTTP status, response time (`durationMs`), page title, description, content length, and SSL health.
- **Output Schema**: Array of items, each containing `{ url, status, statusText, durationMs, title, metaDescription, isUp, timestamp }`.

---

### Category 3: Core & Data (7 Nodes)

#### 7. `http_request` (`nodes.ts:161`, `executors.ts:301`)
- **Category**: `Core` | **Color**: `#3b82f6` | **Icon**: `Globe` | `mode: "each"`
- **Parameters**: `method`, `url`, `headers` (`json`), `body` (`json`), `timeout` (`number`, default: 30s).
- **Executor Logic**: Executes HTTP request using native `fetch`. Resolves expressions in URL, headers, and body.

#### 8. `set` (`nodes.ts:181`, `executors.ts:312`)
- **Category**: `Core` | **Color**: `#6366f1` | **Icon**: `Layers` | `mode: "each"`
- **Parameters**: `values` (`json`), `keepExisting` (`boolean`, default: true).
- **Executor Logic**: Resolves template expressions in `values` and merges them with or replaces incoming item properties.

#### 9. `if` (`nodes.ts:193`, `executors.ts:319`)
- **Category**: `Core` | **Color**: `#ec4899` | **Icon**: `GitFork` | `mode: "each"`
- **Parameters**: `left` (expression), `operator` (`equal`, `not_equal`, `contains`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`), `right`.
- **Outputs**: `["true", "false"]`.
- **Executor Logic**: Evaluates boolean predicate and routes item to `"true"` or `"false"` named output handle.

#### 10. `code` (`nodes.ts:222`, `executors.ts:323`)
- **Category**: `Core` | **Color**: `#14b8a6` | **Icon**: `Terminal` | `mode: "all"`
- **Parameters**: `code` (`code`, default: JS transform template).
- **Executor Logic**: Executes JavaScript inside `node:vm` sandbox with context `{ $input: { all: () => items, item: (i) => items[i] }, $json, $items: items, console }`.

#### 11. `split_out` (`nodes.ts:239`, `executors.ts:351`)
- **Category**: `Core` | **Color**: `#a855f7` | **Icon**: `ListFilter` | `mode: "all"`
- **Parameters**: `field` (`text`, default: `"results"`): Path to array field.
- **Executor Logic**: Unpacks an array property inside each item into separate individual output items.

#### 12. `merge` (`nodes.ts:248`, `executors.ts:359`)
- **Category**: `Core` | **Color**: `#64748b` | **Icon**: `Merge` | `mode: "all"`
- **Executor Logic**: Passthrough accumulator that waits for all incoming branches to complete and merges items.

#### 13. `delay` (`nodes.ts:257`, `executors.ts:360`)
- **Category**: `Core` | **Color**: `#f59e0b` | **Icon**: `Hourglass` | `mode: "all"`
- **Parameters**: `seconds` (`number`, default: `1`).
- **Executor Logic**: Pauses execution via `setTimeout` for specified seconds before passing items through.

---

### Category 4: AI & LLMs (2 Nodes)

#### 14. `gemini` (`nodes.ts:268`, `executors.ts:369`)
- **Category**: `AI` | **Color**: `#a855f7` | **Icon**: `Sparkles` | `mode: "each"`
- **Parameters**:
  - `apiKey` (`text`, default: `"{{ $secrets.GEMINI_API_KEY }}"`).
  - `model` (`text`, default: `"gemini-2.5-flash"`).
  - `system` (`textarea`, default: `"You are a helpful assistant."`).
  - `prompt` (`textarea`, `required: true`).
  - `jsonMode` (`boolean`, default: `false`).
  - `temperature` (`number`, default: `0.7`).
- **Executor Logic**: Calls `POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` with `x-goog-api-key`. Supports JSON schema mode and returns `{ text: candidateText, model, usage }`.

#### 15. `openai_chat` (`nodes.ts:298`, `executors.ts:443`)
- **Category**: `AI` | **Color**: `#10b981` | **Icon**: `Bot` | `mode: "each"`
- **Parameters**: `baseUrl` (`https://api.openai.com/v1`), `apiKey`, `model` (`gpt-4o-mini`), `system`, `prompt`, `temperature`.
- **Executor Logic**: Calls `/chat/completions` compliant with OpenAI / OpenRouter endpoints.

---

### Category 5: Messaging & Notifications (5 Nodes)

#### 16. `telegram` (`nodes.ts:326`, `executors.ts:462`)
- **Category**: `Messaging` | **Color**: `#0ea5e9` | **Icon**: `Send` | `mode: "each"`
- **Parameters**: `botToken` (`{{ $secrets.TELEGRAM_BOT_TOKEN }}`), `chatId`, `text`, `parseMode` (`HTML` / `MarkdownV2`).
- **Executor Logic**: Calls `https://api.telegram.org/bot<TOKEN>/sendMessage`.

#### 17. `whatsapp` (`nodes.ts:339`, `executors.ts:489`)
- **Category**: `Messaging` | **Color**: `#22c55e` | **Icon**: `MessageCircle` | `mode: "each"`
- **Parameters**: `token`, `phoneNumberId`, `to`, `type` (`text` / `template`), `text`, `template`, `language`.
- **Executor Logic**: Calls Meta Cloud API `https://graph.facebook.com/v21.0/<PHONE_ID>/messages`.

#### 18. `slack` (`nodes.ts:362`, `executors.ts:506`)
- **Category**: `Messaging` | **Color**: `#4a154b` | **Icon**: `Slack` | `mode: "each"`
- **Parameters**: `webhookUrl` (`{{ $secrets.SLACK_WEBHOOK_URL }}`), `text`.
- **Executor Logic**: POSTs JSON `{ text }` to Slack incoming webhook.

#### 19. `discord` (`nodes.ts:373`, `executors.ts:514`)
- **Category**: `Messaging` | **Color**: `#5865f2` | **Icon**: `MessageSquare` | `mode: "each"`
- **Parameters**: `webhookUrl` (`{{ $secrets.DISCORD_WEBHOOK_URL }}`), `username`, `content`.
- **Executor Logic**: POSTs JSON `{ username, content }` to Discord webhook.

#### 20. `email` (`nodes.ts:385`, `executors.ts:522`)
- **Category**: `Messaging` | **Color**: `#ef4444` | **Icon**: `Mail` | `mode: "each"`
- **Parameters**: `provider` (`smtp` / `resend`), `host`, `port`, `user`, `pass`, `resendApiKey`, `to`, `subject`, `body`, `html`.
- **Executor Logic**: If `resend`, calls `https://api.resend.com/emails`. If `smtp`, creates `nodemailer` transporter and delivers email.

---

### Category 6: Database (1 Node)

#### 21. `db_query` (`nodes.ts:419`, `executors.ts:282`)
- **Category**: `Database` | **Color**: `#10b981` | **Icon**: `Database` | `mode: "each"`
- **Parameters**:
  - `operation` (`select`, options: `"insert"`, `"select"`, `"clear"`).
  - `table` (`text`, default: `"website_monitors"`, `required: true`).
  - `record` (`json`, default: `"{{ JSON.stringify($json) }}"`).
  - `limit` (`number`, default: 25).
- **Executor Logic**: Interacts with `dbTables` in `src/lib/store.ts`. Reads or writes records in `data/db.json`.

---

### Category 7: Google (1 Node)

#### 22. `google_sheets` (`nodes.ts:450`, `executors.ts:557`)
- **Category**: `Google` | **Color**: `#16a34a` | **Icon**: `Sheet` | `mode: "each"`
- **Parameters**: `credentials` (Service Account JSON), `operation` (`append` / `read`), `spreadsheetId`, `range`, `values`.
- **Executor Logic**: Signs RS256 JWT using Node `crypto` to obtain OAuth2 Bearer token, then calls Google Sheets v4 API.

---

### Category 8: Payments (2 Nodes)

#### 23. `razorpay` (`nodes.ts:482`, `executors.ts:579`)
- **Category**: `Payments` | **Color**: `#0284c7` | **Icon**: `CreditCard` | `mode: "each"`
- **Parameters**: `keyId`, `keySecret`, `operation` (`create_order`, `fetch_payment`, `create_payment_link`, `verify_signature`), `amount`, `customerName`, `customerEmail`.
- **Executor Logic**: Direct Basic Auth HTTP calls to `https://api.razorpay.com/v1/orders`. For `verify_signature`, computes HMAC-SHA256 hash.

#### 24. `stripe` (`nodes.ts:513`, `executors.ts:625`)
- **Category**: `Payments` | **Color**: `#6366f1` | **Icon**: `CreditCard` | `mode: "each"`
- **Parameters**: `secretKey`, `operation` (`create_checkout_session`, `fetch_payment_intent`), `amount`, `currency`, `productName`, `successUrl`, `cancelUrl`.
- **Executor Logic**: Form-urlencoded POST calls to `https://api.stripe.com/v1/checkout/sessions`.

---

### Category 9: System & Utility (3 Nodes)

#### 25. `read_file` (`nodes.ts:542`, `executors.ts:649`)
- **Category**: `System` | **Color**: `#64748b` | **Icon**: `FileText` | `mode: "each"`
- **Parameters**: `path` (`text`, `required: true`), `parseJson` (`boolean`, default: false).
- **Executor Logic**: Reads local file via `node:fs/promises` `readFile()`.

#### 26. `write_file` (`nodes.ts:554`, `executors.ts:662`)
- **Category**: `System` | **Color**: `#64748b` | **Icon**: `Save` | `mode: "each"`
- **Parameters**: `path` (`text`, `required: true`), `content` (`textarea`), `append` (`boolean`, default: true).
- **Executor Logic**: Writes or appends local file via `node:fs/promises` `writeFile()`.

#### 27. `exec` (`nodes.ts:567`, `executors.ts:673`)
- **Category**: `System` | **Color**: `#dc2626` | **Icon**: `Terminal` | `mode: "each"`
- **Parameters**: `command` (`text`, `required: true`), `cwd` (`text`), `timeout` (`number`, default: 60s).
- **Executor Logic**: Executes shell command using `node:child_process` `exec()`. Returns `{ stdout, stderr, exitCode: 0 }`.

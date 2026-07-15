# API Reference

Two servers expose HTTP endpoints:

- **MCP Gateway** at `http://127.0.0.1:8000` — Python/FastAPI; MCP tools, Google OAuth, IndMoney OAuth, `/api/*` data endpoints.
- **Dashboard Server** at `http://localhost:8080` — Node/Express; proxies `/api/*` to gateway, adds LLM wish endpoints.

---

## MCP Gateway (`http://127.0.0.1:8000`)

---

## Health

### `GET /health`

Returns gateway status. No authentication required.

**Response**
```json
{
  "status": "ok",
  "server": "personal-secure-gateway",
  "version": "1.0.0",
  "google_configured": true
}
```

---

## MCP Transport

### `GET /sse`

Opens a Server-Sent Events stream for MCP tool discovery and execution.

### `POST /messages/`

Receives MCP protocol messages posted by SSE clients (used internally by MCP SDK).

### `GET|POST|DELETE /mcp`

MCP Streamable HTTP transport for modern clients (Claude Desktop, Cursor).

---

## Google Auth

### `GET /auth/google`

Starts the Google OAuth 2.0 flow. Redirects to Google's consent screen.

### `GET /auth/callback`

OAuth redirect URI. Exchanges code for token and stores it in the OS credential store.

### `GET /auth/status`

**Response**
```json
{
  "authenticated": true,
  "google_configured": true,
  "spreadsheet_id": null,
  "spreadsheet_name": null
}
```

### `DELETE /auth/token`

Removes the stored Google token.

**Response** `{ "status": "disconnected" }`

---

## IndMoney Auth (OAuth 2.1 + PKCE)

### `GET /auth/indmoney`

Starts the IndMoney OAuth 2.1 + PKCE flow. Dynamically registers the gateway as a client on first call (RFC 7591), then redirects to IndMoney's authorization endpoint.

### `GET /auth/indmoney/callback`

Exchanges the authorization code (+ PKCE verifier) for a token and stores it.

### `DELETE /auth/indmoney/token`

Removes the stored IndMoney token.

**Response** `{ "status": "disconnected" }`

---

## Config — Sheets

### `GET /config/sheets`

Lists Google Drive spreadsheets accessible to the authenticated user.

**Response**
```json
[
  { "id": "<spreadsheet-id>", "name": "MyStocks", "modifiedTime": "2025-01-01T00:00:00Z" }
]
```

### `POST /config/sheets/{spreadsheet_id}`

Saves a spreadsheet ID. Must match `^[A-Za-z0-9_\-]{20,60}$`.

**Response** `{ "status": "saved", "spreadsheet_id": "<id>" }`

---

## Config — IndMoney

### `GET /config/indmoney/status`

**Response**
```json
{
  "connected": true,
  "tools": ["networth_snapshot", "indian_stocks_sips", "mf_sips", "networth_holdings"],
  "auth_configured": true,
  "url": "https://mcp.indmoney.com/mcp",
  "display_tool": "networth_snapshot",
  "oauth_configured": true
}
```

### `POST /config/indmoney/save`

**Request body**
```json
{ "url": "https://mcp.indmoney.com/mcp", "display_tool": "networth_snapshot" }
```

---

## Data Endpoints (`/api/*`)

All `/api/*` routes require a valid `Authorization: Bearer <GATEWAY_API_TOKEN>` header when `GATEWAY_API_TOKEN` is set in `.env`. The dashboard server injects this automatically.

---

### `GET /api/status`

Returns connection status for all services.

**Response**
```json
{
  "connected": true,
  "google_configured": true,
  "whatsapp_configured": false,
  "indmoney_configured": true,
  "tunnel_running": false,
  "gatewayUrl": "http://127.0.0.1:8000",
  "timestamp": "2026-07-15T10:00:00Z"
}
```

---

### `GET /api/weather`

**Query params:** `location` (string, default `"Bengaluru"`)

**Response** — MCP text content envelope:
```json
{
  "content": [{ "type": "text", "text": "**Weather for Bengaluru**\n**Condition:** ..." }],
  "isError": false
}
```

---

### `GET /api/calendar`

**Query params:** `daysAhead` (int, default 1), `maxResults` (int, default 15)

**Response** — MCP text content envelope (same shape as weather).

---

### `GET /api/celebrations`

Returns today's birthday and anniversary calendar events.

**Response** — array:
```json
[
  {
    "name": "Alice",
    "type": "birthday",
    "subType": "birthday",
    "eventTitle": "Alice's Birthday"
  }
]
```

---

### `GET /api/stocks`

**Query params:** `symbols` (comma-separated, optional)

**Response** — MCP text content envelope; parsed by `parseStocks()` in the browser.

---

### `GET /api/system`

Returns live system metrics sampled from `psutil`. Polled by SystemCard every 3 seconds.
Metrics in `SYSTEM_DISABLED_METRICS` are skipped and return `null` / `{}` / `[]`.

**Response**
```json
{
  "cpu": {
    "percent": 45.2,
    "cores": 8,
    "physical": 4
  },
  "ram": {
    "percent": 72.1,
    "used_gb": 11.5,
    "total_gb": 16.0
  },
  "disk": {
    "percent": 65.3,
    "used_gb": 250.1,
    "total_gb": 512.0
  },
  "temperature": 62.5,
  "network": {
    "send_bps": 1024,
    "recv_bps": 204800
  },
  "disk_io": {
    "read_bps": 10485760,
    "write_bps": 2097152
  },
  "battery": {
    "percent": 78.5,
    "power_plugged": true,
    "time_left": null
  },
  "uptime": "3d 14h 22m",
  "load_avg": [1.2, 0.8, 0.6],
  "cpu_freq": {
    "current_ghz": 3.50,
    "max_ghz": 3.80
  },
  "swap": {
    "percent": 25.0,
    "used_gb": 2.0,
    "total_gb": 8.0
  },
  "top_processes": [
    { "name": "Google Chrome Helper", "cpu": 20.2, "mem_mb": 243.4, "pid": 1234 },
    { "name": "node", "cpu": 8.1, "mem_mb": 180.0, "pid": 5678 }
  ],
  "os": {
    "os": "macOS Sequoia",
    "version": "15.2.1",
    "arch": "arm64"
  }
}
```

**Notes:**
- `temperature`: `null` if disabled or unavailable on this OS/hardware. Disabled by default — requires `osx-cpu-temp` on macOS.
- `disk_io`: `{}` if disabled. Disabled by default — may need elevated permissions on Windows.
- `top_processes`: `[]` if disabled. Disabled by default — may trigger UAC/sudo on some systems.
- `network.send_bps` / `recv_bps`: `null` on the first poll (no previous sample to diff against).
- `disk_io.read_bps` / `write_bps`: `null` on first poll, `0` or more thereafter.
- `battery`: `null` on desktops / systems without a battery.
- `cpu_freq`: `null` on Apple Silicon M-series (not exposed via psutil on arm64 macOS).
- `swap`: `null` when system swap total is 0 (common on Apple Silicon).
- `load_avg`: approximated on Windows via psutil's rolling CPU average (psutil ≥ 5.6.2).
- `top_processes[].cpu`: `0` on the first poll; real values from the second poll onward (psutil `interval=None` behaviour).

---

### `GET /api/system/config`

Returns which metrics are currently disabled.

**Response**
```json
{ "disabled": ["temperature", "disk_io", "top_processes"] }
```

### `POST /api/system/config`

Updates the disabled metrics list and persists it to `mcp-gateway/.env` as `SYSTEM_DISABLED_METRICS`.

**Body**
```json
{ "disabled": ["temperature"] }
```

**Valid metric names:** `temperature`, `disk_io`, `top_processes`, `battery`, `load_avg`, `cpu_freq`, `swap`

**Response** `{ "ok": true, "disabled": ["temperature"] }`

> Configured via **MCP Gateway Dashboard → System tab → Metric Permissions**. Not exposed through the daily dashboard proxy.

---

### `GET /api/gmail`

Returns a paginated Gmail inbox, filtered by the server-side blocked-senders list.

**Query params:** `page` (int, default 1), `pageSize` (int, default 20, max 50)

**Response**
```json
{
  "messages": [
    {
      "id": "msg-id",
      "threadId": "thread-id",
      "subject": "Hello",
      "from": "Alice <alice@example.com>",
      "snippet": "Just checking in...",
      "date": "2026-07-15T09:30:00Z",
      "unread": true
    }
  ],
  "totalCount": 142,
  "page": 1,
  "pageSize": 20
}
```

---

### `GET /api/gmail/message/{message_id}`

Returns the full body of a single email.

**Response**
```json
{
  "id": "msg-id",
  "subject": "Hello",
  "from": "Alice <alice@example.com>",
  "to": "me@example.com",
  "date": "2026-07-15T09:30:00Z",
  "body_text": "Just checking in...",
  "body_html": "<p>Just checking in...</p>"
}
```

---

### `GET /api/gmail/config`

Returns the current Gmail blocked-senders list.

**Response**
```json
{ "blockedSenders": ["noreply@spam.com", "promotions@ads.com"] }
```

### `POST /api/gmail/config`

Updates the blocked-senders list. Persisted to `GMAIL_BLOCKED_SENDERS` in gateway `.env`.

**Request body** `{ "blockedSenders": ["noreply@spam.com"] }`

**Response** `{ "ok": true }`

---

### `GET /api/indmoney`

Calls the configured `INDMONEY_DISPLAY_TOOL` and returns its raw text output.

**Response** `{ "text": "<tool output>" }`

---

### `GET /api/indmoney/overview`

Fetches five IndMoney tools in parallel and returns structured data for the Net Worth card.

**Response — 200 OK**
```json
{
  "snapshot": {
    "total_networth": 1500000,
    "total_invested": 1200000,
    "investments": [
      { "asset_type": "MF", "current_value": 800000, "invested_amount": 650000 }
    ]
  },
  "stock_sips": [],
  "mf_sips": [],
  "mf_holdings": [
    {
      "investment_code": "INF200K01RD2",
      "investment": "Axis Bluechip Fund",
      "asset_type": "MF",
      "invested_amount": 50000,
      "market_value": 61000,
      "pnl_per": 22.0,
      "broker": "Zerodha"
    }
  ],
  "stock_holdings": [
    {
      "investment": "RELIANCE",
      "asset_type": "IND_STOCK",
      "invested_amount": 25000,
      "market_value": 27500,
      "pnl_per": 10.0,
      "broker": "Dhan"
    }
  ]
}
```

**Response — 401 (token expired)**
```json
{ "auth_required": true, "error": "IndMoney session expired" }
```

**Notes:**
- `stock_sips` and `mf_sips` are empty arrays when the user has no active SIP mandates.
- `mf_holdings` and `stock_holdings` use `networth_holdings` with `asset_type` enum — 27 MF holdings and 3 stock holdings are typical in practice.
- The `family` tab in the UI is static — IndMoney MCP has no multi-member/family portfolio tools.

---

### `GET /api/gateway/token`

Returns the current gateway API token.

**Response**
```json
{
  "token": "abc123...",
  "configured": true,
  "envLine": "GATEWAY_API_TOKEN=abc123..."
}
```

### `POST /api/gateway/token/rotate`

Generates a new 32-byte URL-safe token and writes it to `.env`.

**Response**
```json
{
  "token": "newtoken...",
  "envLine": "GATEWAY_API_TOKEN=newtoken..."
}
```

---

## Error Format

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid spreadsheet ID format"
}
```

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `AUTH_ERROR` | 401 | Not authenticated or token expired |
| `CONFIG_ERROR` | 400/500 | Missing or invalid configuration |
| `VALIDATION_ERROR` | 400 | Invalid input value |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `SERVICE_ERROR` | 500 | Downstream API failure |
| `TOOL_ERROR` | 500 | Unexpected tool execution error |
| `UNKNOWN_TOOL` | 404 | Tool name not registered |

---

## Dashboard Server (`http://localhost:8080`)

All `/api/*` routes are proxied to the MCP Gateway. Additional endpoints:

---

### `GET /api/config/llm/env-status`

Returns whether the server has an LLM configured in `.env`.

**Response**
```json
{ "configured": true, "provider": "openai", "model": "gpt-4o-mini" }
```

---

### `POST /api/wishes/generate`

Generates personalised birthday/anniversary messages. Tries browser key → server `.env` → returns `null`.

**Request body**
```json
{
  "name": "Alice",
  "type": "birthday",
  "subType": null,
  "llmConfig": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "baseUrl": ""
  }
}
```

**Response — AI generated**
```json
{ "messages": ["Wishing you a wonderful birthday, Alice!"], "source": "ai" }
```

**Response — no LLM**
```json
{ "messages": null, "source": "none" }
```

When `messages` is `null`, `CelebrationsCard` uses `wishMessages.js` templates as fallback.

| Provider | Notes |
|----------|-------|
| `openai` | `https://api.openai.com/v1/chat/completions` |
| `anthropic` | `https://api.anthropic.com/v1/messages` |
| `custom` | OpenAI-compatible; `baseUrl` required |

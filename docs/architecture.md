# Architecture

## Vision

`mcp-gateway` is a **local MCP gateway** — a single long-running process that:

1. Exposes a unified MCP endpoint any client can connect to (SSE and Streamable HTTP).
2. Hosts tools directly (weather, Gmail, Calendar, stocks, calculator, system stats).
3. Proxies downstream MCP servers (IndMoney) — aggregating their tools into one flat list.
4. Owns all credentials so no frontend ever touches a secret.
5. Serves a set of REST data endpoints (`/api/*`) consumed exclusively by the daily briefing dashboard.
6. Applies cross-cutting concerns (rate limiting, audit logging) once, not in every client.

The `daily-briefing-dashboard` is one frontend built on this gateway. Claude Desktop, Gemini Desktop, and Cursor are others. They all connect to the same gateway MCP endpoint with no duplicated config.

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                  MCP Clients                                   │
│                                                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  Claude Desktop  │  │  Gemini Desktop  │  │  Daily Briefing Dashboard    │  │
│  │  Cursor / VSCode │  │  (SSE / HTTP)    │  │  (Node/Express + React)      │  │
│  │  (SSE / HTTP)    │  │                  │  │  port 8080                   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────┬───────────────┘  │
└───────────┼────────────────────┼─────────────────────────── ┼──────────────────┘
            │  SSE  /sse         │                             │  REST /api/*
            │  HTTP /mcp         │                             │  (dashboard-only)
            └────────────────────┼─────────────────────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │     mcp-gateway      │
                      │   (Python FastAPI)   │
                      │   127.0.0.1:8000     │
                      │                      │
                      │  MCP Server          │
                      │  ├── SSE transport   │
                      │  └── HTTP transport  │
                      │                      │
                      │  Built-in Tools      │
                      │  ├── calculate       │
                      │  ├── get_weather     │
                      │  ├── gmail_list_*    │
                      │  ├── calendar_list_* │
                      │  └── get_stocks      │
                      │                      │
                      │  Proxied Tools       │
                      │  └── indmoney_*      │  ← downstream MCP
                      │                      │
                      │  REST Data Endpoints │
                      │  ├── GET /api/system │  ← local psutil
                      │  ├── GET /api/weather│
                      │  ├── GET /api/calendar│
                      │  ├── GET /api/gmail  │
                      │  ├── GET /api/stocks │
                      │  ├── GET /api/       │
                      │  │   indmoney/overview│
                      │  └── …               │
                      │                      │
                      │  Auth               │
                      │  ├── Google OAuth2  │
                      │  ├── IndMoney       │
                      │  │   OAuth 2.1+PKCE │
                      │  └── OS Credential  │
                      │      Store          │
                      │                      │
                      │  Cross-cutting       │
                      │  ├── Rate limiter    │
                      │  ├── Audit logger    │
                      │  └── Error handler   │
                      └────────┬─────────────┘
                               │
           ┌───────────────────┼──────────────────────┐
           │                   │                      │
  ┌────────▼────────┐  ┌───────▼──────┐  ┌───────────▼─────────┐
  │  Google APIs    │  │   wttr.in    │  │  IndMoney MCP        │
  │  Gmail v1       │  │  (weather)   │  │  https://mcp.        │
  │  Calendar v3    │  └──────────────┘  │  indmoney.com/mcp    │
  │  Drive v3       │                    │  (Streamable HTTP,   │
  │  Sheets v4      │  ┌──────────────┐  │   OAuth 2.1 + PKCE)  │
  └─────────────────┘  │  Local host  │  └──────────────────────┘
                       │  psutil      │
                       │  (system     │
                       │   metrics)   │
                       └──────────────┘

  OS Credential Store (macOS Keychain / Windows Credential Manager /
                        Linux Secret Service)  ←  via `keyring`
```

---

## Dashboard Card Layout

The bento grid uses a 12-column layout. Cards occupy fixed rows:

```
Row 1  [  Weather (4)  ]  [  Net Worth (4)  ]  [  System (4)  ]
Row 2  [   Gmail (4)   ]  [  Calendar (4)   ]  [ Celebrations(4)]
Row 3  [    WhatsApp (6)    ]  [    Stocks (6)    ]
```

Cards in each row shrink/expand when siblings are hidden:
- Trio row (3 cards): each `col-span-4`. Two visible → `col-span-6`. One visible → `col-span-12`.
- Pair row (2 cards): each `col-span-6`. One visible → `col-span-12`.

Card visibility is user-controlled via **Settings → Layout** and stored in `localStorage`.

---

## Component Details

### mcp-gateway (`src/`)

| Module | File | Responsibility |
|--------|------|----------------|
| **Entry point** | `main.py` | FastAPI app, MCP server wiring, lifespan, all HTTP routes, IndMoney OAuth 2.1 + PKCE flow |
| **Routers** | `routers/api.py` | All `/api/*` REST endpoints consumed by the dashboard |
| **Routers** | `routers/tunnel.py` | Cloudflare Tunnel management |
| **Routers** | `routers/whatsapp.py` | WhatsApp webhook and message endpoints |
| **Tools** | `tools/calculator.py` | Safe math expression evaluator |
| **Tools** | `tools/weather.py` | Weather via wttr.in, IMD alerts for Indian cities |
| **Tools** | `tools/gmail.py` | Gmail inbox listing (`fetch_gmail_list`, `fetch_gmail_message`) |
| **Tools** | `tools/calendar.py` | Google Calendar event listing |
| **Tools** | `tools/stocks.py` | Stock portfolio from Google Sheets |
| **Tools** | `tools/system.py` | Live system metrics via psutil: CPU, RAM, disk, temperature, network I/O, disk I/O, battery, uptime, load average, CPU frequency, swap, top processes |
| **Downstream** | `services/downstream/indmoney_client.py` | Proxies `indmoney_*` tools to `mcp.indmoney.com` via Streamable HTTP; handles token refresh |
| **Services** | `services/google_client_factory.py` | Builds authenticated Google API clients |
| **Services** | `services/google_auth.py` | Loads/stores Google credentials, scope definitions |
| **Auth** | `auth/token_manager.py` | OS credential store read/write, token refresh, expiry check |
| **Config** | `config/settings.py` | `pydantic-settings` BaseSettings, `.env` parsing |
| **Config** | `config/secrets.py` | Keyring wrapper + `.env` file updater |
| **Utils** | `utils/rate_limiter.py` | Per-tool token-bucket rate limiter |
| **Utils** | `utils/logger.py` | Daily rotating JSON audit log |
| **Utils** | `utils/errors.py` | `MCPError` hierarchy, `sanitize_error` |

### daily-briefing-dashboard

| File | Responsibility |
|------|----------------|
| `server.js` | Express server (port 8080); proxies all `/api/*` to gateway; LLM wish endpoints |
| `src/App.jsx` | Root component; bento grid; `computeSpans()` for dynamic layout; card visibility state |
| `src/components/Header.jsx` | Personalised greeting ("Good Morning, Ritesh 👋") pulled from `localStorage`; refresh + settings buttons |
| `src/components/BentoCard.jsx` | Shared card shell (glass border, header, skeleton, error state) |
| `src/components/WeatherCard.jsx` | Weather with time-of-day animated backgrounds |
| `src/components/CalendarCard.jsx` | Today's schedule; 24h compact time format |
| `src/components/CelebrationsCard.jsx` | Birthday/anniversary; AI wish generation; multi-event tab UI |
| `src/components/IndMoneyCard.jsx` | Net worth / IndMoney portfolio; tabs: Overview / Performance / SIPs / Family |
| `src/components/StocksCard.jsx` | Stock portfolio; broker-wise donut (Dhan vs Zerodha); eye icon; profit/loss count; top gainer/loser |
| `src/components/GmailCard.jsx` | Gmail inbox; top 5 on card face; full inbox popup with pagination; email detail popup |
| `src/components/WhatsAppCard.jsx` | WhatsApp messages via gateway |
| `src/components/SystemCard.jsx` | Live system metrics (CPU/RAM/Disk/Network/Battery gauges); uptime; "Details →" popup with load avg, CPU freq, swap, disk I/O, top processes |
| `src/components/SettingsModal.jsx` | Settings dialog: Location (+ user name) / Google / Stocks / IndMoney / Gmail / AI / WhatsApp / Layout tabs |
| `src/hooks/useDashboard.js` | Polling hook: fetches all card data, MCP status, retry on reconnect |
| `src/hooks/useClock.js` | Live clock with greeting time-of-day logic |
| `src/utils/parsers.js` | `parseWeather`, `parseCalendar`, `parseStocks`, `parseIndMoney`, `parseCelebrations`, formatting helpers |
| `src/data/wishMessages.js` | Template wish messages (birthday, anniversary, work-anniversary) used as AI fallback |

### Management Scripts

| Script | Responsibility |
|--------|----------------|
| `scripts/start_dashboard.py` | Unified stack manager: `start`, `stop`, `restart`, `status` for gateway + dashboard |
| `scripts/setup.py` | One-time git config: `skip-worktree` for protected files |
| `mcp-gateway/start.py` | Launch uvicorn in background, write PID file, poll `/health` |
| `mcp-gateway/stop.py` | Kill by PID file; fallback to port scan |
| `daily-briefing-dashboard/start.py` | Check Node.js, install npm packages if needed, launch `node server.js` |
| `daily-briefing-dashboard/stop.py` | Kill by PID file; fallback to port scan |

All scripts are cross-platform (Windows, macOS, Linux).

---

## HTTP Endpoints

### MCP Gateway (`http://127.0.0.1:8000`)

#### MCP Transport

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{status: "ok"}` plus gateway version |
| `GET` | `/sse` | MCP-over-SSE connection endpoint |
| `POST` | `/messages/` | MCP SSE message posting |
| `GET/POST/DELETE` | `/mcp` | MCP Streamable HTTP transport |

#### Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/status` | Google + IndMoney auth status |
| `GET` | `/auth/google` | Start Google OAuth2 flow |
| `GET` | `/auth/callback` | Google OAuth2 callback |
| `DELETE` | `/auth/token` | Revoke Google token |
| `GET` | `/auth/indmoney` | Start IndMoney OAuth 2.1 + PKCE flow |
| `GET` | `/auth/indmoney/callback` | IndMoney OAuth callback |
| `DELETE` | `/auth/indmoney/token` | Revoke IndMoney token |

#### Config

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/config/sheets` | List accessible Google Sheets |
| `POST` | `/config/sheets/{id}` | Save spreadsheet ID |
| `GET` | `/config/indmoney/status` | IndMoney connection status + available tools |
| `POST` | `/config/indmoney/save` | Save IndMoney MCP URL and display tool |

#### Data (`/api/*` — consumed by dashboard)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Gateway + service connection status |
| `GET` | `/api/weather` | Current weather for configured location |
| `GET` | `/api/calendar` | Upcoming calendar events |
| `GET` | `/api/celebrations` | Today's birthdays and anniversaries |
| `GET` | `/api/stocks` | Stock portfolio from Google Sheet |
| `GET` | `/api/system` | Live system metrics (CPU, RAM, disk, network, battery, uptime, load avg, swap, top processes) |
| `GET` | `/api/gmail` | Paginated Gmail inbox (`page`, `pageSize` params) |
| `GET` | `/api/gmail/message/{id}` | Full email body by message ID |
| `GET` | `/api/gmail/config` | Get Gmail blocked-senders list |
| `POST` | `/api/gmail/config` | Update Gmail blocked-senders list |
| `GET` | `/api/indmoney` | Raw IndMoney display tool output |
| `GET` | `/api/indmoney/overview` | Structured: networth snapshot + stock/MF SIPs + holdings |
| `GET` | `/api/indmoney/family` | Family portfolio endpoint (IndMoney MCP has no family tools — returns holdings only) |
| `GET` | `/api/gateway/token` | Current gateway API token |
| `POST` | `/api/gateway/token/rotate` | Rotate gateway API token |
| `GET` | `/api/config/gateway-url` | Gateway base URL (used by dashboard) |

### Dashboard Server (`http://localhost:8080`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/*` | Proxies all paths to the MCP Gateway |
| `GET` | `/api/config/llm/env-status` | Returns whether server has an LLM configured |
| `POST` | `/api/wishes/generate` | Generates personalised wish messages via LLM |

---

## Data Flows

### System Metrics (polling every 3 seconds)

```
Browser (SystemCard)     Dashboard server        mcp-gateway        psutil
        │                      │                      │                │
        │── GET /api/system ──►│                      │                │
        │                      │── GET /api/system ──►│                │
        │                      │                      │── cpu_percent()│
        │                      │                      │── virtual_memory()
        │                      │                      │── disk_usage() │
        │                      │                      │── net_io_counters()
        │                      │                      │── disk_io_counters()
        │                      │                      │── sensors_battery()
        │                      │                      │── boot_time()  │
        │                      │                      │── getloadavg() │
        │                      │                      │── cpu_freq()   │
        │                      │                      │── swap_memory()│
        │                      │                      │── process_iter()
        │                      │◄── JSON metrics ─────│                │
        │◄── JSON metrics ─────│                      │                │
        │                      │                      │                │
  Delta-tracked rates:
  network: (bytes_sent_now - bytes_sent_prev) / dt → send_bps / recv_bps
  disk_io: (read_bytes_now - read_bytes_prev) / dt  → read_bps / write_bps
  Both use module-level _last_net / _last_disk state in system.py
```

### Built-in Tool Call (happy path)

```
AI Client          mcp-gateway              External API
    │                   │                        │
    │── SSE connect ───►│                        │
    │◄── tool list ─────│                        │
    │── call_tool() ───►│                        │
    │                   │── rate_limiter.check() │
    │                   │── log_tool_access()    │
    │                   │── load_token()         │
    │                   │── Google API call ────►│
    │                   │◄── data ───────────────│
    │◄── TextContent ───│                        │
```

### IndMoney Overview (parallel fetch)

```
Browser (IndMoneyCard)   Dashboard server      mcp-gateway      IndMoney MCP
          │                     │                   │                │
          │── GET /api/         │                   │                │
          │   indmoney/overview►│── GET /api/       │                │
          │                     │   indmoney/overview►              │
          │                     │                   │── asyncio.gather():
          │                     │                   │   networth_snapshot
          │                     │                   │   indian_stocks_sips
          │                     │                   │   mf_sips
          │                     │                   │   networth_holdings(MF)
          │                     │                   │   networth_holdings(IND_STOCK)
          │                     │                   │──────────────►│
          │                     │                   │◄── 5 responses│
          │                     │◄── merged JSON ───│               │
          │◄── merged JSON ─────│                   │               │
```

### Google OAuth Flow

```
Browser            mcp-gateway              Google OAuth
    │                   │                        │
    │── GET /auth/google►│                       │
    │                   │── generate state+URL    │
    │◄── 302 redirect ──│                        │
    │────────────────────────────────────────────►│
    │◄── consent screen ─────────────────────────│
    │── user grants scopes ──────────────────────►│
    │◄── 302 → /auth/callback?code=...&state=... ─│
    │── GET /auth/callback►│                      │
    │                   │── flow.fetch_token(code)│
    │                   │── store_oauth_token()  │
    │◄── success HTML ──│                        │
```

### IndMoney OAuth 2.1 + PKCE Flow

```
Browser            mcp-gateway              IndMoney OAuth
    │                   │                        │
    │── GET /auth/indmoney►│                     │
    │                   │── _get_or_register_client()
    │                   │   (RFC 7591 dynamic registration on first connect)
    │                   │── _pkce_pair() (code_verifier + S256 code_challenge)
    │◄── 302 redirect ──│                        │
    │────────────────────────────────────────────►│
    │◄── IndMoney consent ───────────────────────│
    │── OTP + MPIN ──────────────────────────────►│
    │◄── 302 → /auth/indmoney/callback?code=... ──│
    │── GET /auth/indmoney/callback►│             │
    │                   │── POST /token (code + verifier)
    │                   │◄── access_token + refresh_token
    │                   │── store_indmoney_token() (keychain + .env)
    │◄── success HTML ──│
    │   (postMessage → dashboard)
```

### AI Wish Generation

```
Browser (CelebrationsCard)   Dashboard server       LLM API
          │                        │                    │
          │── POST /api/wishes/    │                    │
          │   generate ───────────►│                    │
          │                        │── llmConfig? → use browser key
          │                        │   else .env LLM_API_KEY
          │                        │── POST to OpenAI/Anthropic ────►│
          │                        │◄── generated messages ──────────│
          │◄── { messages[], source: 'ai'|'none'|'error' }
          │── source='none'?
          │   → wishMessages.js template fallback
```

### Personalised Greeting

```
SettingsModal (LocationTab)               Header
        │                                   │
        │── setName() → localStorage         │── useState(localStorage.getItem())
        │── dispatchEvent(                  │── addEventListener(
        │     'dashboard-user-name-change') │     'dashboard-user-name-change')
        │                                   │◄── CustomEvent.detail = trimmedName
        │                                   │── setUserName(detail)
        │                                   │── render: "Good Morning, Ritesh 👋"
```

---

## System Card — Metrics Detail

`tools/system.py` collects metrics cross-platform using `psutil`:

| Metric | psutil call | Windows | macOS | Notes |
|--------|------------|---------|-------|-------|
| CPU % | `cpu_percent(interval=0.5)` | ✓ | ✓ | 0.5s blocking sample |
| RAM | `virtual_memory()` | ✓ | ✓ | |
| Disk usage | `disk_usage('/' or 'C:\\')` | ✓ | ✓ | |
| CPU temp | `sensors_temperatures()` | partial | partial | falls back to `osx-cpu-temp` / `powermetrics` on macOS |
| Network I/O | `net_io_counters()` delta | ✓ | ✓ | module-level state tracks prev sample |
| Disk I/O | `disk_io_counters()` delta | ✓ | ✓ | same delta pattern as network |
| Battery | `sensors_battery()` | ✓ | ✓ | `None` on desktops with no battery |
| Uptime | `boot_time()` | ✓ | ✓ | formatted as "3d 14h 22m" |
| Load average | `getloadavg()` | ✓ (approx) | ✓ | Windows approximates from CPU rolling avg (psutil ≥ 5.6.2) |
| CPU frequency | `cpu_freq()` | ✓ | partial | `None` on Apple Silicon M-series |
| Swap | `swap_memory()` | ✓ | ✓ | `None` returned when total = 0 |
| Top processes | `process_iter(...)` | ✓ | ✓ | sorted by cpu% then mem; cpu% = 0 on first poll |

---

## IndMoney MCP — Known Limitations

`mcp.indmoney.com/mcp` exposes 15 tools, all for the authenticated individual account:

- `networth_snapshot` — total portfolio snapshot
- `networth_holdings` — holdings by `asset_type` (MF, IND_STOCK, US_STOCK, etc.)
- `indian_stocks_sips` — SIP mandates for Indian stocks
- `mf_sips` — SIP mandates for mutual funds
- and others for transactions, performance, etc.

**No family/multi-member tools exist.** The Family tab in IndMoneyCard is static and explains this limitation. `networth_holdings` returns `broker` per holding but no `member_name` field.

---

## Dynamic Card Layout

```
App.jsx
    │
    ├── CARD_ORDER = ['weather','indmoney','system',
    │                 'gmail','calendar','celebrations',
    │                 'whatsapp','stocks']
    │
    ├── cardLayout.hidden = Set of hidden card IDs (localStorage)
    │
    ├── visibleCards = CARD_ORDER.filter(id => !hidden.has(id))
    │
    └── computeSpans(visibleCards) → { id: colSpan, ... }
          │
          ├── Row 1: ['weather','indmoney','system']
          │   3 visible → each col-span-4
          │   2 visible → each col-span-6
          │   1 visible → col-span-12
          │
          ├── Row 2: ['gmail','calendar','celebrations']
          │   same collapsing logic as Row 1
          │
          ├── 'whatsapp' → col-span-6 (or col-span-12 if stocks hidden)
          └── 'stocks'   → col-span-6 (or col-span-12 if whatsapp hidden)
```

---

## Security Model

| Concern | Mechanism |
|---------|-----------|
| Secret storage | OS credential store (`keyring`): macOS Keychain / Windows Credential Manager / Linux Secret Service; `.env` as serialised fallback cache |
| Secret isolation | `.env` is gitignored; `.env.sample` has placeholder values only |
| CORS | `CORSMiddleware` restricts to `DASHBOARD_ORIGIN` (default `http://localhost:8080`) |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `CSP` via pure ASGI middleware (preserves SSE streaming) |
| Google OAuth state TTL | In-memory `_AUTH_FLOWS` expire after `AUTH_FLOW_TTL_SECONDS` (default 300 s) |
| IndMoney PKCE | S256 code challenge/verifier (OAuth 2.1) |
| Dynamic client registration | IndMoney client ID/secret via RFC 7591; stored in `.env` |
| postMessage origin | IndMoney success page sends `postMessage` only to `DASHBOARD_ORIGIN` |
| Token exposure | `sanitize_error()` redacts strings ≥ 30 chars from error messages |
| Input validation | Spreadsheet IDs: `^[A-Za-z0-9_\-]{20,60}$`; IndMoney URLs: `urlparse`; tool names: `[a-z0-9_]{1,60}` |
| Rate limiting | Per-tool token-bucket: 60 req/min, configurable |
| Audit trail | JSON log per day at `mcp-gateway/logs/` — every tool call, auth event, system event |
| Local-only | Gateway binds to `127.0.0.1` — not reachable from the network by default |
| User name | Stored in `localStorage` only — never sent to the gateway |
| Gmail blocklist | Stored in `GMAIL_BLOCKED_SENDERS` in gateway `.env`; applied server-side before returning results |

---

## Adding a New Built-in Tool

1. Create `src/tools/<name>.py` with `handle_<name>(args...) -> str`.
2. Add a `Tool(name=..., description=..., inputSchema=...)` to `_TOOLS` in `main.py`.
3. Add a `case "<name>":` branch in `_dispatch()` in `main.py`, wrapping sync calls with `asyncio.to_thread()`.
4. If the tool needs a Google API: add `get_<service>_client()` to `google_client_factory.py`.
5. If it needs a REST endpoint: add a route in `routers/api.py`.

Rate limiting, logging, and error handling are applied automatically.

## Adding a New Downstream MCP Server

1. Create `src/services/downstream/<name>_client.py` with `list_tools()` and `call_tool()`.
2. In `main.py` `list_tools()`: import and call `<name>_client.list_tools()`, extend the list.
3. In `main.py` `call_tool()`: add a branch (e.g. `if name.startswith("<prefix>_"):`) delegating to `<name>_client.call_tool()`.

---

## Configuration Reference

### mcp-gateway `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google Cloud OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Cloud OAuth 2.0 client secret |
| `GOOGLE_OAUTH_TOKEN` | Auto | Serialised token written by `store_oauth_token()`; do not set manually |
| `MYSTOCKS_SPREADSHEET_ID` | For stocks | Google Sheet ID used by `get_stocks` tool |
| `MYSTOCKS_RANGE` | No | Sheet range (default: `A:Z`) |
| `GMAIL_BLOCKED_SENDERS` | No | Comma-separated list of sender addresses/domains to hide from Gmail results |
| `INDMONEY_MCP_URL` | No | IndMoney MCP endpoint (default: `https://mcp.indmoney.com/mcp`) |
| `INDMONEY_SCOPES` | No | OAuth scopes (default: `portfolio:read market:read`) |
| `INDMONEY_DISPLAY_TOOL` | No | Tool name (without prefix) for dashboard card |
| `INDMONEY_CLIENT_ID` | Auto | Written by dynamic client registration |
| `INDMONEY_CLIENT_SECRET` | Auto | Written by dynamic client registration |
| `INDMONEY_OAUTH_TOKEN` | Auto | Serialised IndMoney token |
| `GATEWAY_API_TOKEN` | Auto | Bearer token for dashboard → gateway auth; rotate via `POST /api/gateway/token/rotate` |
| `MCP_SERVER_NAME` | No | Advertised MCP server name (default: `personal-secure-gateway`) |
| `MCP_HOST` | No | Bind address (default: `127.0.0.1`) |
| `MCP_PORT` | No | Port (default: `8000`) |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` (default: `info`) |
| `RATE_LIMIT_ENABLED` | No | Enable/disable rate limiter (default: `true`) |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | Per-tool per-minute limit (default: `60`) |
| `DASHBOARD_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:8080`) |
| `AUTH_FLOW_TTL_SECONDS` | No | OAuth state expiry (default: `300`) |

### daily-briefing-dashboard `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_GATEWAY_URL` | No | Gateway base URL (default: `http://127.0.0.1:8000`) |
| `PORT` | No | Dashboard listen port (default: `8080`) |
| `DASHBOARD_ORIGIN` | No | Must match gateway's `DASHBOARD_ORIGIN` |
| `LLM_PROVIDER` | No | Server-side LLM: `openai` \| `anthropic` \| `custom` |
| `LLM_API_KEY` | No | API key for the server-side LLM |
| `LLM_MODEL` | No | Model name (defaults: `gpt-4o-mini` / `claude-haiku-4-5-20251001`) |
| `LLM_BASE_URL` | No | Base URL for custom OpenAI-compatible providers |

### User preferences (localStorage — never sent to server)

| Key | Description |
|-----|-------------|
| `dashboard_user_name` | User's display name shown in the greeting |
| `dashboard_location` | City/location for weather |
| `dashboard_hidden_cards` | JSON array of hidden card IDs |
| `dashboard_llm_models` | JSON array of configured LLM models |
| `dashboard_active_llm` | Active LLM model index |

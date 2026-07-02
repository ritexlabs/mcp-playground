# Architecture

## Vision

`mcp-gateway` is a **local MCP gateway** — a single long-running process that:

1. Exposes a unified MCP endpoint any client can connect to (SSE and Streamable HTTP).
2. Hosts tools directly (weather, Gmail, Calendar, stocks, calculator).
3. Proxies downstream MCP servers (IndMoney) — aggregating their tools into one flat list.
4. Owns all credentials so no frontend ever touches a secret.
5. Applies cross-cutting concerns (rate limiting, audit logging) once, not in every client.

The `daily-briefing-dashboard` is one frontend built on this gateway. Claude Desktop, Gemini Desktop, and Cursor are others. They all connect to the same gateway endpoint with no duplicated config.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             MCP Clients                                 │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Claude Desktop  │  │  Gemini Desktop  │  │  Daily Briefing      │  │
│  │  Cursor / VSCode │  │  (SSE / HTTP)    │  │  Dashboard           │  │
│  │  (SSE / HTTP)    │  │                  │  │  (Node/Express)      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
└───────────┼────────────────────┼───────────────────────┼───────────────┘
            │   SSE  http://127.0.0.1:8000/sse            │
            │   HTTP http://127.0.0.1:8000/mcp            │
            └────────────────────┼────────────────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │     mcp-gateway      │
                      │   (Python FastAPI)   │
                      │                      │
                      │  ┌────────────────┐  │
                      │  │   MCP Server   │  │  ← mcp SDK
                      │  │  SSE + HTTP    │  │
                      │  └────────────────┘  │
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
                      │  Cross-cutting       │
                      │  ├── Rate limiter    │
                      │  ├── Audit logger    │
                      │  └── Error handler   │
                      │                      │
                      │  Auth               │
                      │  ├── Google OAuth2  │
                      │  ├── IndMoney       │
                      │  │   OAuth 2.1+PKCE │
                      │  └── OS Credential  │
                      │      Store          │
                      │                      │
                      │  HTTP Endpoints      │
                      │  ├── GET  /health    │
                      │  ├── GET  /sse       │
                      │  ├── POST /messages/ │
                      │  ├── *   /mcp        │
                      │  ├── GET  /auth/*    │
                      │  ├── GET  /config/*  │
                      │  └── GET  /indmoney/ │
                      └────────┬─────────────┘
                               │
           ┌───────────────────┼─────────────────────┐
           │                   │                     │
  ┌────────▼────────┐  ┌───────▼──────┐  ┌──────────▼──────────┐
  │  Google APIs    │  │   wttr.in    │  │  IndMoney MCP        │
  │  Gmail v1       │  │ (weather)    │  │  https://mcp.        │
  │  Calendar v3    │  └──────────────┘  │  indmoney.com/mcp    │
  │  Drive v3       │                    │  (Streamable HTTP)   │
  │  Sheets v4      │                    └──────────────────────┘
  └─────────────────┘

  OS Credential Store (macOS Keychain / Windows Credential Manager /
                        Linux Secret Service)  ←  via `keyring`
```

---

## Component Details

### mcp-gateway (`src/`)

| Module | File | Responsibility |
|--------|------|----------------|
| **Entry point** | `main.py` | FastAPI app, MCP server wiring, lifespan, all HTTP routes, IndMoney OAuth 2.1 + PKCE flow |
| **Tools** | `tools/calculator.py` | Safe math expression evaluator |
| **Tools** | `tools/weather.py` | Weather via wttr.in, IMD alerts for Indian cities |
| **Tools** | `tools/gmail.py` | Gmail inbox listing |
| **Tools** | `tools/calendar.py` | Google Calendar event listing |
| **Tools** | `tools/stocks.py` | Stock portfolio from Google Sheets |
| **Downstream** | `services/downstream/indmoney_client.py` | Proxies `indmoney_*` tools to `mcp.indmoney.com` via Streamable HTTP; handles token refresh |
| **Services** | `services/google_client_factory.py` | Builds authenticated Google API clients |
| **Services** | `services/google_auth.py` | Loads/stores Google credentials, scope definitions |
| **Auth** | `auth/token_manager.py` | OS credential store read/write, token refresh, expiry check |
| **Config** | `config/settings.py` | `pydantic-settings` BaseSettings, `.env` parsing, IndMoney settings |
| **Config** | `config/secrets.py` | Keyring wrapper + `.env` file updater for both Google and IndMoney tokens |
| **Utils** | `utils/rate_limiter.py` | Per-tool token-bucket rate limiter |
| **Utils** | `utils/logger.py` | Daily rotating JSON audit log |
| **Utils** | `utils/errors.py` | `MCPError` hierarchy, `sanitize_error` |

### daily-briefing-dashboard

| File | Responsibility |
|------|----------------|
| `server.js` | Express API, MCP SSE client, CORS + security headers, proxy routes to gateway `/auth/*`, `/config/*`, `/indmoney/*` |
| `public/app.js` | UI logic: fetch from `/api/*`, render all cards, per-card error tracking, retry on reconnect, settings dialog |
| `public/index.html` | Dashboard shell; settings dialog (Location / Google / Stocks / IndMoney / Layout tabs); dialog placed outside all cards |
| `public/style.css` | Dark glassmorphism theme, responsive grid, performance-tuned blur values |
| `public/celebrations.js` | Birthday and anniversary detection from calendar events |

### Management Scripts

| Script | Responsibility |
|--------|----------------|
| `scripts/start_dashboard.py` | Unified stack manager: `start`, `stop`, `restart`, `status` for gateway + dashboard |
| `scripts/setup.py` | One-time git config: `skip-worktree` for protected files, sets `core.hooksPath` |
| `mcp-gateway/setup.py` | Create `.venv`, install `requirements.txt`, create `.env` from `.env.example` |
| `mcp-gateway/start.py` | Launch uvicorn in background, write PID file, poll `/health` for up to 10 s |
| `mcp-gateway/stop.py` | Kill by PID file; fallback to port scan via `netstat`/`lsof` |
| `daily-briefing-dashboard/start.py` | Check Node.js, install npm packages if needed, launch `node server.js` in background |
| `daily-briefing-dashboard/stop.py` | Kill by PID file; fallback to port scan |

All scripts are cross-platform (Windows, macOS, Linux). Shell `.sh` wrappers remain as aliases for macOS/Linux.

---

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{status: "ok"}` plus gateway version |
| `GET` | `/sse` | MCP-over-SSE connection endpoint (legacy transport) |
| `POST` | `/messages/` | MCP SSE message posting |
| `GET/POST/DELETE` | `/mcp` | MCP Streamable HTTP transport (modern clients) |
| `GET` | `/auth/status` | Google + IndMoney auth status |
| `GET` | `/auth/google` | Start Google OAuth2 flow (browser redirect) |
| `GET` | `/auth/callback` | Google OAuth2 callback; stores token to keychain |
| `DELETE` | `/auth/token` | Revoke Google token |
| `GET` | `/auth/indmoney` | Start IndMoney OAuth 2.1 + PKCE flow; auto-registers client if needed |
| `GET` | `/auth/indmoney/callback` | IndMoney callback; exchanges code + verifier for token |
| `DELETE` | `/auth/indmoney/token` | Revoke IndMoney token |
| `GET` | `/config/sheets` | List accessible Google Sheets |
| `POST` | `/config/sheets/{id}` | Save spreadsheet ID to settings |
| `GET` | `/config/indmoney/status` | IndMoney connection status + available tools |
| `POST` | `/config/indmoney/save` | Save IndMoney MCP URL and display tool preference |
| `GET` | `/indmoney/data` | Fetch data for the configured display tool |
| `GET` | `/indmoney/overview` | Fetch networth + SIP + holdings overview for the dashboard card |

---

## Data Flows

### Built-in Tool Call (happy path)

```
AI Client          mcp-gateway              External API
    │                   │                        │
    │── SSE connect ───►│                        │
    │◄── tool list ─────│                        │
    │                   │                        │
    │── call_tool() ───►│                        │
    │                   │── rate_limiter.check() │
    │                   │── log_tool_access()    │
    │                   │── load_token()         │
    │                   │   (keychain → refresh) │
    │                   │                        │
    │                   │── Google API call ────►│
    │                   │◄── data ───────────────│
    │                   │                        │
    │◄── TextContent ───│                        │
```

### IndMoney Tool Proxy

```
AI Client          mcp-gateway              IndMoney MCP
    │                   │                        │
    │── call_tool()     │                        │
    │   (indmoney_*) ──►│                        │
    │                   │── rate_limiter.check() │
    │                   │── log_tool_access()    │
    │                   │── _build_headers()     │
    │                   │   (get token → refresh │
    │                   │    if expired)         │
    │                   │                        │
    │                   │── streamablehttp_client►│
    │                   │   call_tool(name, args)│
    │                   │◄── TextContent ────────│
    │                   │                        │
    │◄── TextContent ───│                        │
```

### Google OAuth Flow

```
Browser            mcp-gateway              Google OAuth
    │                   │                        │
    │── GET /auth/google►│                        │
    │                   │── generate state+URL    │
    │                   │── store flow in _AUTH_FLOWS
    │◄── 302 redirect ──│                        │
    │                                             │
    │────────────────────────────────────────────►│
    │◄── consent screen ─────────────────────────│
    │── user grants scopes ──────────────────────►│
    │◄── 302 → /auth/callback?code=...&state=... ─│
    │                   │                        │
    │── GET /auth/callback►│                      │
    │                   │── flow.fetch_token(code)│
    │                   │── token_manager.from_credentials()
    │                   │── store_oauth_token()  │
    │                   │   (keychain + .env)    │
    │◄── success HTML ──│                        │
```

### IndMoney OAuth 2.1 + PKCE Flow

```
Browser            mcp-gateway              IndMoney OAuth
    │                   │                        │
    │── GET /auth/indmoney►│                      │
    │                   │── _get_or_register_client()
    │                   │   (RFC 7591 dynamic registration
    │                   │    on first connect; reuses
    │                   │    INDMONEY_CLIENT_ID after)
    │                   │── _pkce_pair()          │
    │                   │   (code_verifier +      │
    │                   │    S256 code_challenge) │
    │                   │── store flow in _INDMONEY_AUTH_FLOWS
    │◄── 302 redirect ──│                        │
    │                                             │
    │────────────────────────────────────────────►│
    │◄── IndMoney consent ───────────────────────│
    │── OTP + MPIN ──────────────────────────────►│
    │◄── 302 → /auth/indmoney/callback?code=... ──│
    │                   │                        │
    │── GET /auth/indmoney/callback►│             │
    │                   │── POST /token          │
    │                   │   (code + code_verifier)│
    │                   │◄── access_token +      │
    │                   │    refresh_token        │
    │                   │── store_indmoney_token()│
    │                   │   (keychain + .env)    │
    │◄── success HTML ──│                        │
    │   (postMessage →  │                        │
    │    dashboard)     │                        │
```

### Token Lifecycle (Google)

```
load_token(service)
    │
    ├── get_oauth_token()          # keychain first, .env fallback
    │     └── None → raise AuthenticationError
    │
    ├── to_credentials(token_data)
    │     └── expiry_date (ms) → naive UTC datetime (google-auth expects naive)
    │
    ├── creds.expired?
    │     └── Yes → refresh_token()
    │           ├── creds.refresh(GoogleRequest())
    │           ├── SUCCESS → from_credentials() → store_oauth_token()
    │           └── invalid_grant → clear_oauth_token() + raise AuthenticationError
    │
    └── _needs_refresh(creds)?     # warn if expiry < 24h
          └── Yes → refresh_token()
```

### Token Lifecycle (IndMoney)

```
_build_headers()
    │
    ├── get_indmoney_token()       # keychain first, .env fallback
    │     └── None → raise (no auth configured)
    │
    ├── access_token = token_data["access_token"]
    │
    ├── expires_at < now?
    │     └── Yes → _refresh_access_token(token_data)
    │           ├── POST /token  (grant_type=refresh_token)
    │           ├── preserve refresh_token if not returned
    │           └── store_indmoney_token() → keychain + .env
    │
    └── return {"Authorization": "Bearer <access_token>"}
```

---

## Security Model

| Concern | Mechanism |
|---------|-----------|
| Secret storage | OS credential store (`keyring`): macOS Keychain / Windows Credential Manager / Linux Secret Service; `.env` as serialised fallback cache |
| Secret isolation | `.env` is gitignored; `.env.example` has placeholder values only |
| CORS | FastAPI `CORSMiddleware` restricts allowed origins to `DASHBOARD_ORIGIN` (default `http://localhost:8080`) |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy` on all responses via a pure ASGI middleware (not `BaseHTTPMiddleware`) to preserve SSE streaming |
| Google OAuth state TTL | In-memory `_AUTH_FLOWS` entries expire after `AUTH_FLOW_TTL_SECONDS` (default 300 s) |
| IndMoney OAuth state TTL | In-memory `_INDMONEY_AUTH_FLOWS` entries expire after `AUTH_FLOW_TTL_SECONDS` |
| PKCE | IndMoney auth uses S256 code challenge/verifier (OAuth 2.1); client secret is optional |
| Dynamic client registration | IndMoney client ID/secret obtained via RFC 7591 on first connect; stored in `.env` for reuse |
| postMessage origin | IndMoney success page sends `postMessage` only to `DASHBOARD_ORIGIN` — never to `'*'` |
| Token exposure | `sanitize_error()` redacts strings ≥ 30 chars (including `.`, `/`, `+`, `=`) from error messages |
| Input validation | Spreadsheet IDs: `^[A-Za-z0-9_\-]{20,60}$`; IndMoney URLs: `urlparse`; tool names: `[a-z0-9_]{1,60}` |
| Rate limiting | Per-tool token-bucket: 60 req/min default, configurable via `.env` |
| Audit trail | JSON log per day at `mcp-gateway/logs/`: every tool call, auth event, system event |
| Credential scope | All Google services share one token with combined scopes; no per-service tokens |
| Local-only | Gateway binds to `127.0.0.1` — not reachable from the network by default |

---

## Adding a New Built-in Tool

1. Create `src/tools/<name>.py` with a function `handle_<name>(args...) -> str`.
2. Add a `Tool(name=..., description=..., inputSchema=...)` to `_TOOLS` in `main.py`.
3. Add a `case "<name>":` branch in `_dispatch()` in `main.py`, wrapping sync calls with `asyncio.to_thread()`.
4. If the tool needs a Google API: add a `get_<service>_client()` to `google_client_factory.py`.

No changes needed to rate limiting, logging, or error handling — those are applied automatically in `call_tool()`.

## Adding a New Downstream MCP Server

1. Create `src/services/downstream/<name>_client.py` with `list_tools()` and `call_tool()` functions.
2. In `main.py` `list_tools()`: import and call `<name>_client.list_tools()`, extend the tool list.
3. In `main.py` `call_tool()`: add a branch (e.g. `if name.startswith("<prefix>_"):`) that delegates to `<name>_client.call_tool()`.
4. Rate limiting and audit logging are applied automatically before the branch runs.

---

## Future: Multi-Server Gateway

IndMoney is already proxied as a downstream MCP server. The pattern can be extended to any MCP server:

```
mcp-gateway (aggregator)
    ├── [built-in tools]           # weather, calculator (no auth needed)
    ├── [google tools]             # gmail, calendar, stocks (Google OAuth2)
    │
    ├── IndMoney MCP               # https://mcp.indmoney.com/mcp (OAuth 2.1 + PKCE)
    │     └── indmoney_* tools
    │
    ├── Downstream MCP server B   # e.g. a Notion MCP server
    │     └── notion_* tools
    │
    └── Downstream MCP server C   # e.g. a GitHub MCP server
          └── github_* tools
```

The gateway:
1. Connects to each downstream server on demand (Streamable HTTP or stdio).
2. Merges tool lists, prefixing by service name to avoid collisions.
3. Routes `call_tool()` to the right downstream.
4. Applies rate limiting and audit logging before routing.
5. Manages credentials per downstream server independently.

Clients (Claude Desktop, dashboard, etc.) see a single flat tool list and need no changes.

---

## Configuration Reference

### mcp-gateway `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google Cloud OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Cloud OAuth 2.0 client secret |
| `GOOGLE_OAUTH_TOKEN` | Auto | Serialised token written by `store_oauth_token()`; do not set manually |
| `MYSTOCKS_SPREADSHEET_ID` | For stocks | Google Sheet ID used by `get_stocks` tool |
| `MYSTOCKS_RANGE` | No | Sheet range to read (default: `A:Z`) |
| `INDMONEY_MCP_URL` | No | Downstream IndMoney MCP endpoint (default: `https://mcp.indmoney.com/mcp`) |
| `INDMONEY_SCOPES` | No | OAuth scopes requested (default: `portfolio:read market:read`) |
| `INDMONEY_DISPLAY_TOOL` | No | Tool name (without prefix) to show on the dashboard card |
| `INDMONEY_CLIENT_ID` | Auto | Written by dynamic client registration; do not set manually |
| `INDMONEY_CLIENT_SECRET` | Auto | Written by dynamic client registration; do not set manually |
| `INDMONEY_OAUTH_TOKEN` | Auto | Serialised IndMoney token; do not set manually |
| `MCP_SERVER_NAME` | No | MCP server name advertised to clients (default: `personal-secure-gateway`) |
| `MCP_SERVER_VERSION` | No | MCP server version string (default: `1.0.0`) |
| `MCP_HOST` | No | Bind address (default: `127.0.0.1`) |
| `MCP_PORT` | No | Port (default: `8000`) |
| `LOG_LEVEL` | No | Logging level: `debug`, `info`, `warn`, `error` (default: `info`) |
| `RATE_LIMIT_ENABLED` | No | Enable/disable rate limiter (default: `true`) |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | Requests per tool per minute (default: `60`) |
| `TOKEN_EXPIRY_WARNING_HOURS` | No | Refresh Google token this many hours before expiry (default: `24`) |
| `DASHBOARD_ORIGIN` | No | Allowed CORS origin and postMessage target (default: `http://localhost:8080`) |
| `AUTH_FLOW_TTL_SECONDS` | No | OAuth state expiry in seconds (default: `300`) |

### daily-briefing-dashboard `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_GATEWAY_URL` | No | Gateway base URL (default: `http://127.0.0.1:8000`) |
| `PORT` | No | Dashboard listen port (default: `8080`) |
| `DASHBOARD_ORIGIN` | No | Allowed CORS origin — must match gateway's `DASHBOARD_ORIGIN` (default: `http://localhost:8080`) |

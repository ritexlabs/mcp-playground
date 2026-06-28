# Architecture

## Vision

`mcp-gateway` is a **local MCP gateway** — a single long-running process that:

1. Exposes a unified MCP-over-SSE endpoint any client can connect to.
2. Hosts tools directly (today) and can proxy to downstream MCP servers (future).
3. Owns all credentials so no frontend ever touches a secret.
4. Applies cross-cutting concerns (rate limiting, audit logging) once, not in every client.

The `daily-briefing-dashboard` is one frontend built on this gateway. Claude Desktop, Gemini Desktop, and Cursor are others. They all connect to the same SSE endpoint with no duplicated config.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MCP Clients                                │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Claude Desktop  │  │  Gemini Desktop  │  │ Daily Briefing   │  │
│  │   (SSE MCP)      │  │   (SSE MCP)      │  │   Dashboard      │  │
│  │                  │  │                  │  │  (Node/Express)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼────────────────────┼────────────────────┼──────────────┘
            │                    │                    │
            │    SSE  http://127.0.0.1:8000/sse       │
            └────────────────────┼────────────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │     mcp-gateway      │
                      │   (Python FastAPI)   │
                      │                      │
                      │  ┌────────────────┐  │
                      │  │  MCP Server    │  │  ← mcp SDK
                      │  │  (SSE layer)   │  │
                      │  └────────────────┘  │
                      │                      │
                      │  Tools               │
                      │  ├── calculate       │
                      │  ├── get_weather     │
                      │  ├── gmail_list_*    │
                      │  ├── calendar_list_* │
                      │  └── get_stocks      │
                      │                      │
                      │  Cross-cutting       │
                      │  ├── Rate limiter    │
                      │  ├── Audit logger    │
                      │  └── Error handler   │
                      │                      │
                      │  Auth               │
                      │  ├── Google OAuth2  │
                      │  └── macOS Keychain │
                      │                      │
                      │  HTTP Endpoints      │
                      │  ├── GET  /health    │
                      │  ├── GET  /sse       │
                      │  ├── POST /messages/ │
                      │  ├── GET  /auth/*    │
                      │  └── GET  /config/*  │
                      └──────────┬──────────┘
                                 │
           ┌─────────────────────┼────────────────────┐
           │                     │                    │
  ┌────────▼────────┐   ┌────────▼────────┐  ┌───────▼──────┐
  │  Google APIs    │   │    wttr.in      │  │  macOS       │
  │  Gmail v1       │   │  (weather JSON) │  │  Keychain    │
  │  Calendar v3    │   └─────────────────┘  │  (token      │
  │  Drive v3       │                        │   storage)   │
  │  Sheets v4      │                        └──────────────┘
  └─────────────────┘
```

---

## Component Details

### mcp-gateway (`src/`)

| Module | File | Responsibility |
|--------|------|----------------|
| **Entry point** | `main.py` | FastAPI app, MCP server wiring, lifespan, all HTTP routes |
| **Tools** | `tools/*.py` | One handler per tool; pure functions returning `str` |
| **Services** | `services/google_client_factory.py` | Builds authenticated Google API clients |
| **Services** | `services/google_auth.py` | Loads/stores credentials, scope definitions |
| **Auth** | `auth/token_manager.py` | Keychain read/write, token refresh, expiry check |
| **Config** | `config/settings.py` | `pydantic-settings` BaseSettings, `.env` parsing |
| **Config** | `config/secrets.py` | Keyring wrapper + `.env` file updater |
| **Utils** | `utils/rate_limiter.py` | Per-tool token-bucket rate limiter |
| **Utils** | `utils/logger.py` | Daily rotating JSON audit log |
| **Utils** | `utils/errors.py` | `MCPError` hierarchy, `sanitize_error` |

### daily-briefing-dashboard

| File | Responsibility |
|------|----------------|
| `server.js` | Express API, MCP SSE client, proxy routes to gateway `/auth/*` and `/config/*` |
| `public/app.js` | UI logic: fetch from `/api/*`, render cards, settings dialog with 3 tabs |
| `public/index.html` | Dashboard shell, settings dialog (Location / Google / Stocks tabs) |
| `public/style.css` | Dark glassmorphism theme, responsive grid |
| `public/celebrations.js` | Birthday and anniversary detection from calendar events |

---

## Data Flows

### Tool Call (happy path)

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

### Token Lifecycle

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

---

## Security Model

| Concern | Mechanism |
|---------|-----------|
| Secret storage | macOS Keychain via `keyring`; `.env` as fallback cache |
| Secret isolation | `.env` is gitignored; pre-commit hook blocks `*.env*` commits |
| Token exposure | `sanitize_error()` redacts strings ≥ 30 chars (tokens) from error messages |
| Rate limiting | Per-tool token-bucket: 60 req/min default, configurable via `.env` |
| Audit trail | JSON log per day: every tool call, auth event, system event |
| Credential scope | All Google services share one token with combined scopes; no per-service tokens |
| Local-only | Gateway binds to `127.0.0.1` — not reachable from network by default |

---

## Adding a New Tool

1. Create `src/tools/<name>.py` with a function `handle_<name>(args...) -> str`.
2. Add a `Tool(name=..., description=..., inputSchema=...)` to `_TOOLS` in `main.py`.
3. Add a `case "<name>":` branch in `_dispatch()` in `main.py`, wrapping sync calls with `asyncio.to_thread()`.
4. If the tool needs a Google API: add a `get_<service>_client()` to `google_client_factory.py`.

No changes needed to rate limiting, logging, or error handling — those are applied automatically in `call_tool()`.

---

## Future: Multi-Server Gateway

The current architecture hosts tools directly inside the gateway process. The planned evolution is:

```
mcp-gateway (aggregator)
    ├── [built-in tools]           # weather, calculator (no auth needed)
    │
    ├── Downstream MCP server A   # e.g. a Notion MCP server (stdio or SSE)
    │     └── tool: search_pages, create_page
    │
    ├── Downstream MCP server B   # e.g. a GitHub MCP server
    │     └── tool: list_prs, create_issue
    │
    └── Downstream MCP server C   # e.g. a Slack MCP server
          └── tool: send_message, list_channels
```

The gateway would:
1. Connect to each downstream MCP server (stdio or SSE) on startup.
2. Merge tool lists from all servers, prefixing by server name to avoid collisions.
3. Route `call_tool()` to the right downstream server.
4. Apply rate limiting and audit logging before routing.
5. Manage credentials per downstream server independently.

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
| `MYSTOCKS_RANGE` | No | Sheet range to read (default: `Sheet1!A:E`) |
| `MCP_HOST` | No | Bind address (default: `127.0.0.1`) |
| `MCP_PORT` | No | Port (default: `8000`) |
| `RATE_LIMIT_ENABLED` | No | Enable/disable rate limiter (default: `true`) |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | Requests per tool per minute (default: `60`) |
| `TOKEN_EXPIRY_WARNING_HOURS` | No | Refresh token this many hours before expiry (default: `24`) |

### daily-briefing-dashboard `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_GATEWAY_URL` | No | Gateway base URL (default: `http://127.0.0.1:8000`) |
| `PORT` | No | Dashboard port (default: `8080`) |

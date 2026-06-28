# MCP Playground

> A local MCP gateway that aggregates tools and services behind a single SSE endpoint — connect any MCP-compatible frontend (Claude Desktop, Gemini Desktop, Cursor, or your own dashboard) without repeating auth or configuration.

---

## What We Are Building

Two components live in this repo:

| Component | Role |
|-----------|------|
| [`mcp-gateway/`](mcp-gateway/) | Local MCP server (Python / FastAPI). Hosts tools, owns Google OAuth, enforces rate limits and audit logging. Any MCP client connects here. |
| [`daily-briefing-dashboard/`](daily-briefing-dashboard/) | Personal morning dashboard (Node / Express + vanilla JS). Connects to the gateway via SSE, renders weather, Gmail, Calendar, and stock portfolio. |

The gateway is the stable core. The dashboard is one consumer. Claude Desktop, Gemini Desktop, Cursor, and any other MCP-aware app are other consumers — all reading from the same gateway, with no duplicated credentials.

---

## Repository Layout

```
mcp-playground/
├── mcp-gateway/              # Python FastAPI MCP server
│   ├── src/
│   │   ├── main.py           # FastAPI app, MCP server wiring, auth + config endpoints
│   │   ├── tools/            # One file per tool (weather, gmail, calendar, stocks, calculator)
│   │   ├── services/         # Google client factory + credential loader
│   │   ├── auth/             # Token manager (keychain, refresh, expiry)
│   │   ├── config/           # Settings (pydantic-settings) + secrets (keyring)
│   │   └── utils/            # Rate limiter, JSON audit logger, error types
│   ├── scripts/              # One-off helpers (auth_all.py)
│   ├── requirements.txt
│   ├── setup.sh              # Create .venv, install deps
│   ├── start.sh              # Launch uvicorn in background with PID guard
│   └── stop.sh               # Kill by PID or port
│
├── daily-briefing-dashboard/ # Node/Express frontend
│   ├── server.js             # Express API + MCP SSE client + config proxy routes
│   ├── public/
│   │   ├── index.html        # Dashboard shell + settings dialog (3 tabs)
│   │   ├── app.js            # All UI logic: weather, calendar, Gmail, stocks, auth UI
│   │   ├── celebrations.js   # Birthday / anniversary detection
│   │   └── style.css         # Dark glassmorphism theme
│   ├── start.sh
│   └── stop.sh
│
├── docs/
│   ├── architecture.md       # System design, data flows, design decisions
│   └── development.md        # Local setup guide
└── scripts/                  # Repo-level scripts (git hooks, etc.)
```

---

## Quick Start

### 1 — MCP Gateway

```bash
cd mcp-gateway
./setup.sh                  # creates .venv, installs requirements.txt (first run only)

cp .env.example .env        # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

./start.sh                  # starts on http://127.0.0.1:8000
```

Authenticate Google (Gmail, Calendar, Drive, Sheets) via the dashboard settings or directly:
```bash
open http://127.0.0.1:8000/auth/google
```

Verify the gateway is up:
```bash
curl http://127.0.0.1:8000/health
```

### 2 — Daily Briefing Dashboard

```bash
cd daily-briefing-dashboard
cp .env.example .env        # set MCP_GATEWAY_URL=http://127.0.0.1:8000 if non-default

npm install                 # first run only
./start.sh                  # starts on http://localhost:8080
```

Open [http://localhost:8080](http://localhost:8080), then **Settings → Google → Connect Google**.

---

## Connecting Other Frontends

The gateway speaks standard MCP-over-SSE. Any MCP client works without changes:

### Claude Desktop

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "mcp-gateway": {
      "url": "http://127.0.0.1:8000/sse"
    }
  }
}
```

### Gemini Desktop / AI Studio

Add an MCP server with URL `http://127.0.0.1:8000/sse`.

### Cursor

Settings → Features → MCP → Add → type `sse`, URL `http://127.0.0.1:8000/sse`.

### VS Code — Cline / Roo Code

```json
{ "mcpServers": { "mcp-gateway": { "url": "http://127.0.0.1:8000/sse" } } }
```

See [`mcp-gateway/INTEGRATION.md`](mcp-gateway/INTEGRATION.md) for full details and Python SDK usage.

---

## Available Tools

| Tool | Auth required | Description |
|------|---------------|-------------|
| `calculate` | — | Safe math expression evaluator (sympy) |
| `get_weather` | — | Current weather via wttr.in, with IMD alerts for Indian cities |
| `gmail_list_latest` | Google | Latest inbox emails (subject, sender, snippet) |
| `calendar_list_events` | Google | Upcoming events from Google Calendar |
| `get_stocks` | Google | Stock portfolio from a configured Google Sheet |

---

## Key Design Decisions

- **Single OAuth token for all Google services.** Gmail, Calendar, Drive, and Sheets share one set of scopes and one refresh token stored in macOS Keychain.
- **Gateway owns auth, not clients.** Frontends never handle credentials. The gateway exposes `/auth/google` → `/auth/callback` for browser-based OAuth and stores the token in keychain.
- **SSE transport, not stdio.** A persistent SSE connection means the gateway runs once as a daemon; any number of clients connect without spawning subprocesses.
- **Rate limiting per tool.** Token-bucket limiter (in-memory, per tool name) guards against runaway AI loops.
- **Daily rotating JSON audit log.** Every tool call and auth event is written to `~/.local/mcp-gateway/logs/audit-YYYY-MM-DD.log`.

---

## Security

- All secrets live in `.env` (gitignored) or macOS Keychain — never in code.
- A pre-commit hook in `.git/hooks/pre-commit` blocks accidental `.env*` file commits.
- `.env.example` ships safe placeholder values only.
- Never commit or push automatically — all git actions are manual.

See [`CLAUDE.md`](CLAUDE.md) for full security and contribution conventions.

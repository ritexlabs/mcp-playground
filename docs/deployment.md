# Deployment Guide

This project is designed for **local personal use** on macOS. Both the gateway and dashboard run on `localhost` and are not intended to be exposed to the internet.

---

## Requirements

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| macOS | 12+ (Keychain required for token storage) |

---

## First-Time Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd mcp-playground
```

### 2. Set up the MCP Gateway

```bash
cd mcp-gateway
./setup.sh                  # creates .venv and installs Python dependencies

cp .env.example .env        # create your local config
```

Edit `mcp-gateway/.env` and fill in your values:

```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
DASHBOARD_ORIGIN=http://localhost:8080
```

See [Google Cloud Console setup](#google-cloud-setup) below.

### 3. Set up the Dashboard

```bash
cd ../daily-briefing-dashboard
npm install                 # install Node dependencies

cp .env.example .env        # create your local config
```

Edit `daily-briefing-dashboard/.env`:

```
MCP_GATEWAY_URL=http://127.0.0.1:8000
PORT=8080
DASHBOARD_ORIGIN=http://localhost:8080
```

`DASHBOARD_ORIGIN` must match the value in `mcp-gateway/.env`.

---

## Google Cloud Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create a new project (or select an existing one).
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Sheets API
4. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Add authorised redirect URI: `http://127.0.0.1:8000/auth/callback`
5. Copy the **Client ID** and **Client Secret** into `mcp-gateway/.env`.

---

## Running

### Start the full stack (recommended)

From the repo root:

```bash
bash scripts/start_dashboard.sh start
```

This starts the gateway first, waits for it to be healthy, then starts the dashboard.

```bash
bash scripts/start_dashboard.sh stop     # graceful shutdown
bash scripts/start_dashboard.sh restart  # restart both
bash scripts/start_dashboard.sh status   # check PIDs and health
```

### Start services individually

```bash
# Gateway
cd mcp-gateway && ./start.sh

# Verify
curl http://127.0.0.1:8000/health

# Dashboard (in a separate terminal)
cd daily-briefing-dashboard && ./start.sh
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Authenticate Google

Open the dashboard and click **Settings → Google → Connect Google** — or navigate directly:

```bash
open http://127.0.0.1:8000/auth/google
```

Grant all requested permissions (Gmail, Calendar, Drive, Sheets). The token is stored in macOS Keychain — you will not need to re-authenticate unless you revoke access.

### Connect IndMoney (optional)

1. Open the dashboard and click **Settings → IndMoney → Connect IndMoney**.
2. A new window opens — log in with your IndMoney mobile number, OTP, and MPIN.
3. The token is stored in macOS Keychain automatically.

> **Session expiry** — IndMoney access tokens expire periodically. When your token expires the "My Networth" card shows a **"Session Expired — Reconnect IndMoney"** button. Click it to re-authenticate without losing other settings.

---

## Stopping

```bash
cd mcp-gateway && ./stop.sh
cd daily-briefing-dashboard && ./stop.sh
```

---

## Secrets and Security Checklist

Before running and before every git push:

- [ ] `mcp-gateway/.env` exists and is **not** staged in git (`git status` should not show it).
- [ ] `daily-briefing-dashboard/.env` exists and is **not** staged in git.
- [ ] `.env.example` files contain only placeholder values — no real IDs, secrets, or tokens.
- [ ] `DASHBOARD_ORIGIN` matches in both `.env` files.
- [ ] `git diff --cached` shows no credential material.
- [ ] If `INDMONEY_CLIENT_ID` / `INDMONEY_CLIENT_SECRET` appear in git diff → **do not push** — these are auto-written to `.env` and must stay local.

---

## Logs

Audit logs are written to:
```
~/.local/mcp-gateway/logs/audit-YYYY-MM-DD.log
```

Each line is a JSON object with `event`, `timestamp`, `tool`, and outcome fields. Logs rotate daily. No credential values appear in logs — `sanitize_error()` redacts strings over 30 characters.

---

## Updating

```bash
git pull
cd mcp-gateway && pip install -r requirements.txt   # if requirements changed
cd ../daily-briefing-dashboard && npm install       # if package.json changed
./start.sh
```

---

## Connecting Other MCP Clients

The gateway speaks standard MCP-over-SSE. Any MCP-compatible client can connect without code changes:

| Client | Configuration |
|--------|--------------|
| Claude Desktop | Add `"mcp-gateway": { "url": "http://127.0.0.1:8000/sse" }` to `claude_desktop_config.json` |
| Cursor | Settings → Features → MCP → Add → type `sse`, URL `http://127.0.0.1:8000/sse` |
| Gemini Desktop | Add MCP server URL `http://127.0.0.1:8000/sse` |
| VS Code (Cline/Roo) | Add `{ "mcpServers": { "mcp-gateway": { "url": "http://127.0.0.1:8000/sse" } } }` |

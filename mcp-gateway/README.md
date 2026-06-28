# MCP Gateway

A security-hardened Model Context Protocol (MCP) server built with **Python + FastAPI**. Exposes your personal Google services and utility tools to any MCP-compatible AI client via HTTP/SSE. Everything runs **locally on your machine** — no data leaves your laptop.

---

## Available Tools

| Tool | Auth Required | Description |
|---|---|---|
| `calculate` | None | Safe math expressions via sympy — `2^10`, `(25+5)*2`, etc. |
| `get_weather` | None | Current conditions via Open-Meteo (primary) / wttr.in (fallback). Includes IMD alerts for India. |
| `gmail_list_latest` | Google OAuth | Latest emails from your Gmail inbox |
| `calendar_list_events` | Google OAuth | Upcoming events from Google Calendar |
| `get_stocks` | Google OAuth | Stock portfolio from a Google Sheet |

---

## Project Layout

```
mcp-gateway/
├── src/
│   ├── main.py                        # FastAPI app — MCP server + SSE transport
│   ├── config/
│   │   ├── settings.py                # pydantic-settings env loading
│   │   └── secrets.py                 # macOS Keychain + .env token storage
│   ├── auth/
│   │   └── token_manager.py           # Token load, refresh, expiry checks
│   ├── services/
│   │   ├── google_auth.py             # OAuth2 flow + combined token
│   │   └── google_client_factory.py   # Gmail / Calendar / Sheets / Drive clients
│   ├── tools/
│   │   ├── calculator.py
│   │   ├── weather.py
│   │   ├── gmail.py
│   │   ├── calendar.py
│   │   └── stocks.py
│   └── utils/
│       ├── logger.py                  # JSON audit logger with daily rotation
│       ├── rate_limiter.py            # Token bucket rate limiter
│       └── errors.py                  # Custom error hierarchy
├── scripts/
│   └── auth_all.py                    # One-shot OAuth flow — all Google scopes
├── logs/                              # Daily audit logs (git-ignored)
├── .env                               # Your credentials (git-ignored, chmod 600)
├── .env.example                       # Template — start here
├── requirements.txt                   # Python dependencies
├── setup.sh                           # First-run helper
├── start.sh                           # Start the gateway in the background
└── INTEGRATION.md                     # Step-by-step guides for Claude Desktop, Cursor, VS Code, ADK
```

---

## Quick Start

### 1 — First run

```bash
cd mcp-gateway
bash setup.sh
# Creates .venv, installs deps, creates .env from .env.example
```

### 2 — Add credentials

```bash
nano .env
```

Minimum required:
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret
```

See [Getting Google Credentials](#getting-google-credentials) for the full walkthrough.

### 3 — Authenticate (one-time)

```bash
.venv/bin/python scripts/auth_all.py
```

A browser window opens. Sign in, tick **all** permission checkboxes, and click **Allow**. The script saves a combined `GOOGLE_OAUTH_TOKEN` to `.env` and macOS Keychain. Only needed once per machine.

### 4 — Start

```bash
./start.sh
# ✅ Gateway is up (PID 12345)
#    Health: http://127.0.0.1:8000/health
#    SSE:    http://127.0.0.1:8000/sse
```

Or run directly:
```bash
.venv/bin/uvicorn src.main:app --host 127.0.0.1 --port 8000
```

### 5 — Connect a client

See [INTEGRATION.md](INTEGRATION.md) for Claude Desktop, Cursor IDE, VS Code (Cline/Roo Code), and Python agents.

---

## Getting Google Credentials

**Step 1 — Create a Google Cloud project**

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (e.g. `MCP Personal Gateway`).

**Step 2 — Enable APIs**

Enable each of these in your project:
- Gmail API
- Google Calendar API
- Google Sheets API
- Google Drive API

**Step 3 — OAuth consent screen**

Go to **APIs & Services → OAuth consent screen**:
1. User Type: **External** → Create.
2. App name: `MCP Personal Gateway`, fill your email.
3. Skip Scopes (the auth script handles this).
4. **Test users** → Add your Gmail address → Save.

**Step 4 — Create credentials**

1. **Credentials → Create OAuth client ID → Desktop application**.
2. Name it `MCP Gateway Desktop Client` → Create.
3. Copy the Client ID and Client Secret into `.env`.

**Step 5 — Authenticate**

```bash
.venv/bin/python scripts/auth_all.py
```

> If you see "This app isn't verified", click **Advanced → Go to MCP Gateway (unsafe)** — expected for local development apps.

---

## Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Google tools | — | OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google tools | — | OAuth Client Secret |
| `GOOGLE_OAUTH_TOKEN` | Auto-set | — | Combined token (set by `auth_all.py`) |
| `MYSTOCKS_SPREADSHEET_ID` | `get_stocks` | — | Google Sheet spreadsheet ID |
| `MYSTOCKS_RANGE` | No | `Sheet1!A:E` | Sheet range to read |
| `MCP_HOST` | No | `127.0.0.1` | Gateway bind address |
| `MCP_PORT` | No | `8000` | Gateway port |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `RATE_LIMIT_ENABLED` | No | `true` | Enable per-tool rate limiting |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | `60` | Requests per minute per tool |
| `TOKEN_EXPIRY_WARNING_HOURS` | No | `24` | Hours before expiry to proactively refresh |
| `MCP_SERVER_NAME` | No | `personal-secure-gateway` | Server name shown to clients |

---

## Tool Reference

### `calculate`

Safe mathematical expression evaluation.

```
Input:   { "expression": "2^10 + 5 * 3" }
Output:  "Result: 1039"
```

Supported: `+`, `-`, `*`, `/`, `%`, `^`, `()`. Max 500 characters.

### `get_weather`

```
Input:   { "location": "Mumbai", "temperature_unit": "celsius" }
Input:   { "latitude": 28.6, "longitude": 77.2 }
Output:  Condition, temperature, feels-like, humidity, precipitation, wind speed.
         IMD severe weather warnings appended for Indian locations.
```

Providers: Open-Meteo (primary) → wttr.in (fallback).

### `gmail_list_latest`

```
Input:   { "max_results": 10 }   // 1–20, default 5
Output:  From, Subject, Preview for each message
```

### `calendar_list_events`

```
Input:   { "days_ahead": 7, "max_results": 20, "calendar_id": "primary" }
         // days_ahead: 1–90 (default 7), max_results: 1–50 (default 10)
Output:  Title, Start, End, Location, Description for each event
```

### `get_stocks`

```
Input:   { "symbols": ["AAPL", "MSFT"] }  // optional filter
Output:  Portfolio rows from the configured Google Sheet
```

#### Setting up your MyStocks sheet

1. Create a Google Sheet. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
2. Set `MYSTOCKS_SPREADSHEET_ID` in `.env`.
3. Default column layout (`MYSTOCKS_RANGE=Sheet1!A:E`):

| Symbol | Name | Price | Change | Notes |
|---|---|---|---|---|

Adapt the range in `.env` to match your actual column layout.

---

## Security Architecture

### Transport
The gateway runs as a local HTTP server on `127.0.0.1` only — no inbound connections from the internet. MCP clients connect via SSE at `/sse`.

### Token storage
OAuth tokens are stored in **macOS Keychain** (encrypted by the OS) with `.env` as a plaintext fallback. A single combined token covers all four Google scopes — one auth flow serves Gmail, Calendar, Drive, and Sheets.

### Token lifecycle
Auto-refreshes when the token is within 24 hours of expiry. Google API calls (synchronous SDK) are wrapped with `asyncio.to_thread()` so they do not block the FastAPI event loop.

### Input validation
- Calculator: only digits and math operators allowed (regex allowlist), then parsed by sympy.
- Numbers: range-clamped on all numeric arguments.
- Strings: sanitised before passing to Google APIs.

### Error handling
All error messages passed to clients are sanitised — home directory paths and long credential-like strings are redacted. Custom exception hierarchy maps to appropriate HTTP status codes.

### Rate limiting
Token bucket algorithm, per tool, in memory. Default: 60 requests/minute per tool. Disable with `RATE_LIMIT_ENABLED=false`.

### Audit logging
JSON logs written to `~/.local/mcp-gateway/logs/audit-YYYY-MM-DD.log`. Events: `tool_access`, `auth_event`, `system_event`.

```bash
# Live tail
tail -f ~/.local/mcp-gateway/logs/audit-$(date +%Y-%m-%d).log | python3 -m json.tool

# Find errors
grep '"result": "error"' ~/.local/mcp-gateway/logs/audit-*.log
```

---

## Development

```bash
# Run with auto-reload
.venv/bin/uvicorn src.main:app --reload --host 127.0.0.1 --port 8000

# Install a new dep
.venv/bin/pip install <package>
echo "<package>>=x.y" >> requirements.txt
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError` | Run `bash setup.sh` to create `.venv` and install deps |
| `.env not found` | Copy `.env.example` to `.env` and fill in credentials |
| `GOOGLE_CLIENT_ID is not set` | Edit `.env` with your Google Cloud OAuth credentials |
| `invalid_grant` on token refresh | Revoke at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and re-run `auth_all.py` |
| Gateway not reachable | Check `./start.sh` output and `logs/gateway.log` |

**Clear keychain token and re-authenticate:**
```bash
python3 -c "from src.config.secrets import clear_oauth_token; clear_oauth_token()"
.venv/bin/python scripts/auth_all.py
```

**Reset everything:**
```bash
rm -rf .venv && bash setup.sh
```

# Development Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | For mcp-gateway |
| Node.js | 18+ | For daily-briefing-dashboard |
| macOS Keychain | — | Token storage (macOS only) |
| Google Cloud project | — | OAuth 2.0 credentials for Gmail / Calendar / Sheets |

---

## One-Time Setup: Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (type: Web application).
3. Add `http://127.0.0.1:8000/auth/callback` as an **Authorised redirect URI**.
4. Enable these APIs on your project:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Sheets API
5. Copy the **Client ID** and **Client Secret** — you'll put them in `.env`.

---

## MCP Gateway

### Setup (first run)

```bash
cd mcp-gateway
./setup.sh              # creates .venv and installs requirements.txt
cp .env.example .env    # copy the template
```

Edit `.env` and fill in:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### Start / Stop

```bash
./start.sh              # launches uvicorn at http://127.0.0.1:8000
./stop.sh               # graceful shutdown
```

Logs tail: `tail -f ~/.local/mcp-gateway/logs/audit-$(date +%F).log`

### Google Authentication

After starting the gateway, open the auth URL in a browser:
```bash
open http://127.0.0.1:8000/auth/google
```
Or use the Settings → Google tab in the dashboard.

You will see a Google consent screen. Grant all requested permissions (Gmail, Calendar, Drive, Sheets). The token is stored in macOS Keychain and never committed to git.

To check auth status:
```bash
curl http://127.0.0.1:8000/auth/status
```

To disconnect:
```bash
curl -X DELETE http://127.0.0.1:8000/auth/token
```

### Test a Tool

```bash
# Health check
curl http://127.0.0.1:8000/health

# List available Google Sheets (requires auth)
curl http://127.0.0.1:8000/config/sheets
```

### Configure Stocks Sheet

```bash
# List your Drive spreadsheets
curl http://127.0.0.1:8000/config/sheets

# Save the spreadsheet ID you want to use
curl -X POST http://127.0.0.1:8000/config/sheets/<SPREADSHEET_ID>
```

Or use the Settings → Stocks tab in the dashboard.

### Environment Variables

See [`docs/architecture.md`](architecture.md#configuration-reference) for the full reference.

---

## Daily Briefing Dashboard

### Setup (first run)

```bash
cd daily-briefing-dashboard
npm install
cp .env.example .env    # only needed if gateway is not on http://127.0.0.1:8000
```

### Start / Stop

```bash
./start.sh              # launches at http://localhost:8080
./stop.sh
```

The dashboard checks gateway reachability on startup. If the gateway is not running it will warn and retry.

### Settings Dialog

Open the dashboard and click **Settings** (top-right):

| Tab | What it does |
|-----|-------------|
| **Location** | Set your city for weather |
| **Google** | Connect / disconnect Google OAuth (opens the gateway's `/auth/google`) |
| **Stocks** | Browse your Drive spreadsheets and pick the portfolio sheet |

---

## Project Structure — Key Files

```
mcp-gateway/src/
├── main.py                     # FastAPI + MCP server wiring
│                               # Edit here to: add routes, register tools, change auth flow
│
├── tools/
│   ├── weather.py              # get_weather tool
│   ├── gmail.py                # gmail_list_latest tool
│   ├── calendar.py             # calendar_list_events tool
│   ├── stocks.py               # get_stocks tool (reads Google Sheet)
│   └── calculator.py           # calculate tool (sympy)
│
├── services/
│   ├── google_client_factory.py  # get_gmail_client(), get_sheets_client(), etc.
│   └── google_auth.py            # ALL_SCOPES, get_google_credentials()
│
├── auth/
│   └── token_manager.py          # load_token(), refresh_token(), to/from_credentials()
│
├── config/
│   ├── settings.py               # pydantic-settings, _find_env_file()
│   └── secrets.py                # keyring wrappers, update_env_setting()
│
└── utils/
    ├── errors.py                 # MCPError, AuthenticationError, ServiceError, ...
    ├── logger.py                 # log_tool_access(), log_auth_event(), log_system_event()
    └── rate_limiter.py           # Token-bucket rate limiter
```

---

## Adding a New Tool

1. Create `src/tools/<name>.py`:
   ```python
   def handle_my_tool(param: str) -> str:
       # call your API / do work
       return "result text"
   ```

2. Register the tool in `src/main.py`:
   ```python
   # In _TOOLS list:
   Tool(
       name="my_tool",
       description="What it does.",
       inputSchema={
           "type": "object",
           "properties": {"param": {"type": "string"}},
           "required": ["param"],
       },
   )

   # In _dispatch():
   case "my_tool":
       return await asyncio.to_thread(handle_my_tool, args.get("param", ""))
   ```

3. If the tool calls a synchronous API, wrap it with `asyncio.to_thread()` as shown above.

That's it. Rate limiting and audit logging are applied automatically.

---

## Branching Strategy

- `main` — production-ready, protected
- `feat/<slug>` — new features
- `fix/<slug>` — bug fixes
- `chore/<slug>` — maintenance

All PRs target `main`. Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).

---

## Security Notes

- Never commit `.env` or any file with real credentials.
- The pre-commit hook at `.git/hooks/pre-commit` will block staged `.env*` files.
- `GOOGLE_OAUTH_TOKEN` in `.env` is written automatically by the gateway — it is safe to leave it there but do not commit it.
- `CLAUDE.md` is gitignored (contains local AI assistant context).
- Before pushing, inspect `git diff origin/HEAD...HEAD` and confirm no secrets are present.

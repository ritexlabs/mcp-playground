# Development Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | For mcp-gateway |
| Node.js | 18+ | For daily-briefing-dashboard |
| psutil | 5.6.2+ | For `getloadavg()` on Windows |
| Google Cloud project | — | OAuth 2.0 credentials for Gmail / Calendar / Sheets |

Token storage uses the OS credential store: **macOS Keychain**, **Windows Credential Manager**, or **Linux Secret Service** (via `keyring`).

---

## One-Time Setup: Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (type: Web application).
3. Add `http://127.0.0.1:8000/auth/callback` as an **Authorised redirect URI**.
4. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Sheets API
5. Copy the **Client ID** and **Client Secret** into `mcp-gateway/.env`.

---

## MCP Gateway

### Setup (first run)

```bash
cd mcp-gateway
python mcp_gateway.py setup    # creates .venv, installs dependencies, copies .env.example → .env
```

Edit `mcp-gateway/.env`:
```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
DASHBOARD_ORIGIN=http://localhost:8080
```

### Start / Stop

```bash
python mcp_gateway.py start    # launches uvicorn at http://127.0.0.1:8000
python mcp_gateway.py stop
```

Logs: `tail -f mcp-gateway/logs/gateway.log`

### Authenticate Google

```bash
open http://127.0.0.1:8000/auth/google
# or: Settings → Google → Connect Google in the dashboard
```

Grant Gmail, Calendar, Drive, and Sheets permissions. Token is stored in the OS credential store.

### Connect IndMoney (optional)

Settings → IndMoney → Connect IndMoney. Completes OAuth 2.1 + PKCE in a popup window.

### Configure Gmail blocked senders

Settings → Gmail → add sender addresses or domains to hide from the inbox.

### Configure Stocks Sheet

Settings → Stocks → browse your Drive sheets and pick the portfolio spreadsheet.

Or via curl:
```bash
curl http://127.0.0.1:8000/config/sheets
curl -X POST http://127.0.0.1:8000/config/sheets/<SPREADSHEET_ID>
```

---

## Daily Briefing Dashboard

### Setup (first run)

```bash
cd daily-briefing-dashboard
npm install
cp .env.example .env    # only if gateway is not on http://127.0.0.1:8000
```

### Start / Stop (recommended)

```bash
python scripts/start_dashboard.py start    # gateway → dashboard
python scripts/start_dashboard.py stop
python scripts/start_dashboard.py restart
python scripts/start_dashboard.py status
```

Or individually:
```bash
cd daily-briefing-dashboard
npm run build
node server.js
```

Open [http://localhost:8080](http://localhost:8080).

### Settings Dialog (Daily Dashboard)

| Tab | What it does |
|-----|-------------|
| **Location** | Set your city for weather; set your **display name** for the personalised greeting ("Good Morning, Ritesh 👋") |
| **Gateway** | View MCP gateway connection status and URL; open the gateway dashboard |
| **AI** | Add LLM models for AI wish generation; set the active model |
| **Notes** | Configure task alarm behaviour: animation style (Bounce / Confetti / Fireworks / Wave / Shake), ringtone (Chime / Bell / Beep / Alarm — each with a ▶ preview), and snooze duration (5 / 10 / 15 min). All stored in `localStorage` only. |
| **Layout** | Show/hide dashboard cards; layout adjusts automatically |

### MCP Gateway Dashboard (`http://127.0.0.1:8000/dashboard`)

| Tab | What it does |
|-----|-------------|
| **Status** | Live service health for Google, WhatsApp, IndMoney, Tunnel |
| **Google** | Connect / disconnect Google OAuth |
| **Stocks** | Browse and select the Google Sheets portfolio spreadsheet |
| **IndMoney** | Connect IndMoney; pick the display tool |
| **WhatsApp** | Configure WhatsApp Business Cloud API credentials and webhook |
| **Gmail** | Manage the server-side blocked-senders list |
| **System** | View live host metrics (CPU / RAM / Disk / Temperature); configure **Metric Permissions** — enable or disable metrics that may require elevated access (`temperature`, `disk_io`, `top_processes` are off by default) |
| **Tunnel** | Start/stop Cloudflare Tunnel; view the public webhook URL |
| **API Token** | View and rotate the `GATEWAY_API_TOKEN` used by the daily dashboard |

---

## Project Structure — Key Files

```
mcp-gateway/src/
├── main.py                       # FastAPI + MCP server wiring; all auth flows
│
├── routers/
│   ├── api.py                    # All /api/* REST endpoints (dashboard data)
│   ├── tunnel.py                 # Cloudflare Tunnel management
│   └── whatsapp.py               # WhatsApp webhook + message endpoints
│
├── tools/
│   ├── weather.py                # get_weather tool (wttr.in)
│   ├── gmail.py                  # fetch_gmail_list(), fetch_gmail_message()
│   ├── calendar.py               # calendar_list_events tool
│   ├── stocks.py                 # get_stocks tool (reads Google Sheet)
│   ├── calculator.py             # calculate tool (sympy)
│   └── system.py                 # fetch_system_stats() — CPU, RAM, disk, network,
│                                 # disk I/O, battery, uptime, load avg, CPU freq,
│                                 # swap, top processes (all via psutil; cross-platform)
│
├── services/
│   ├── google_client_factory.py  # get_gmail_client(), get_sheets_client(), etc.
│   ├── google_auth.py            # ALL_SCOPES, get_google_credentials()
│   └── downstream/
│       └── indmoney_client.py    # Proxies indmoney_* tools to mcp.indmoney.com
│
├── auth/
│   └── token_manager.py          # load_token(), refresh_token(), to/from_credentials()
│
├── config/
│   ├── settings.py               # pydantic-settings BaseSettings, _find_env_file()
│   └── secrets.py                # keyring wrappers, update_env_setting()
│
└── utils/
    ├── errors.py                 # MCPError, AuthenticationError, ServiceError, ...
    ├── logger.py                 # log_tool_access(), log_auth_event(), log_system_event()
    └── rate_limiter.py           # Token-bucket rate limiter

daily-briefing-dashboard/
├── server.js                     # Express (port 8080); proxies /api/* to gateway;
│                                 # LLM wish endpoints
└── src/
    ├── App.jsx                   # Root; bento grid; computeSpans(); card visibility state
    │
    ├── components/
    │   ├── BentoCard.jsx         # Shared card shell (glass border, header, skeleton, error)
    │   ├── Header.jsx            # Greeting + clock; reads user name from localStorage;
    │   │                         # listens to 'dashboard-user-name-change' CustomEvent
    │   ├── WeatherCard.jsx       # Weather + AQI pill + 5-day forecast strip;
    │   │                         # time-of-day animated backgrounds
    │   ├── CalendarCard.jsx      # Today's schedule; 24h compact time (HH:MM–HH:MM)
    │   ├── CelebrationsCard.jsx  # Birthday/anniversary; AI wish generation; multi-event tabs
    │   ├── IndMoneyCard.jsx      # Net worth / portfolio; tabs: Overview / Performance /
    │   │                         # SIPs (with MF + stock holdings fallback) / Family (static)
    │   ├── StocksCard.jsx        # Stock portfolio; broker-wise donut (Dhan vs Zerodha);
    │   │                         # profit/loss count pills; top gainer/loser; eye icon;
    │   │                         # full popup with sortable table + broker tabs
    │   ├── GmailCard.jsx         # Gmail inbox; top 5 on card; full inbox popup with
    │   │                         # pagination; email detail popup
    │   ├── WhatsAppCard.jsx      # WhatsApp messages via gateway
    │   ├── SystemCard.jsx        # Live system gauges (CPU / RAM / Disk / Network /
    │   │                         # Battery); uptime in footer; "Details →" popup with
    │   │                         # load avg, CPU freq, swap, disk I/O, top 5 processes
    │   ├── QuickNotesCard.jsx    # Task checklist: add/mark-done/delete tasks; per-task
    │   │                         # alarm picker (datetime-local inline); pending count badge;
    │   │                         # listens to 'tasks-updated' CustomEvent for snooze/dismiss sync
    │   ├── AlarmNotification.jsx # Full-screen portal alarm overlay; CSS animations
    │   │                         # (Bounce/Confetti/Fireworks/Wave/Shake); Web Audio ringtone;
    │   │                         # Snooze + Dismiss buttons; plays sound on mount
    │   ├── SettingsModal.jsx     # Settings dialog (Location / Gateway / AI / Notes / Layout)
    │   └── StatusPill.jsx        # MCP connection status indicator
    │
    ├── hooks/
    │   ├── useDashboard.js       # Polling hook; fetches all card data; reconnect retry
    │   └── useClock.js           # Live clock; greeting (Good Morning / Afternoon / Evening)
    │
    ├── data/
    │   └── wishMessages.js       # Birthday/anniversary template messages (AI fallback)
    │
    └── utils/
        ├── parsers.js            # parseWeather(), parseCalendar(), parseStocks(),
        │                         # parseIndMoney(), parseCelebrations(), fmtCurrency(),
        │                         # fmtPct(), formatTime(), formatDate()
        └── alarmUtils.js         # loadTasks/saveTasks, loadAlarmConfig/saveAlarmConfig,
                                  # playAlarmSound(ringtone), genId()
```

---

## System Card — Adding New Metrics

Metrics live in `mcp-gateway/src/tools/system.py`. The `fetch_system_stats()` function collects everything and returns a single JSON dict.

To add a new metric:

1. Write a private function `_my_metric() -> <type> | None` — return `None` on failure or if unavailable.
2. Add it to the `return { ... }` in `fetch_system_stats()`.
3. Add the display component in `SystemCard.jsx` — on the card face for high-visibility metrics, or inside `SystemDetailsPopup` for details.

Delta-tracked rate metrics (like network and disk I/O) need module-level state:
```python
_last_foo = None
_last_foo_ts: float = 0.0

def _foo_rate() -> dict:
    global _last_foo, _last_foo_ts
    cur = psutil.foo_counters()
    now = time.monotonic()
    rate = None
    if _last_foo is not None:
        dt = now - _last_foo_ts
        if dt > 0:
            rate = max(0, round((cur.bytes - _last_foo.bytes) / dt))
    _last_foo = cur
    _last_foo_ts = now
    return {"rate_bps": rate}
```

---

## AI Wish Generation

### Option A — Browser-side key (per-user)

Settings → AI → Add Model. Key stored in `localStorage`; sent per-request to `/api/wishes/generate` and never persisted server-side.

### Option B — Server-side key (shared)

```
# daily-briefing-dashboard/.env
LLM_PROVIDER=openai
LLM_API_KEY=<your-api-key>
LLM_MODEL=gpt-4o-mini
```

Fallback chain: `browser llmConfig` → `server .env` → `wishMessages.js` templates

---

## Personalised Greeting

The greeting "Good Morning, Ritesh 👋" is powered by:

1. `SettingsModal.jsx` — Location tab has a "Your Name" field. On save:
   - Writes to `localStorage['dashboard_user_name']`
   - Dispatches `new CustomEvent('dashboard-user-name-change', { detail: name })`

2. `Header.jsx` — reads the initial value from `localStorage` and listens to the custom event:
   ```js
   const [userName, setUserName] = useState(() => localStorage.getItem('dashboard_user_name') || '')
   useEffect(() => {
     window.addEventListener('dashboard-user-name-change', e => setUserName(e.detail))
   }, [])
   ```

The name is **never sent to the server** — it stays in the browser.

---

## Adding a New Tool (backend)

1. Create `src/tools/<name>.py`:
   ```python
   def handle_my_tool(param: str) -> str:
       return "result"
   ```

2. Register in `src/main.py`:
   ```python
   # _TOOLS list:
   Tool(name="my_tool", description="...", inputSchema={...})

   # _dispatch():
   case "my_tool":
       return await asyncio.to_thread(handle_my_tool, args.get("param", ""))
   ```

3. Add a REST endpoint in `src/routers/api.py` if the dashboard needs to call it directly.

Rate limiting and audit logging are applied automatically.

---

## Long-Running Dashboard Performance

The dashboard is designed to run continuously in a browser tab for 24+ hours without accumulating memory or CPU load.

### What keeps it safe

| Concern | Mechanism |
|---------|-----------|
| **Stale / piled-up fetch requests** | Each card has a dedicated `AbortController`. Starting a new fetch immediately cancels any prior in-flight request for that card, so only one request per card is ever pending at a time. |
| **Hanging requests** | Every data fetch carries a 20-second hard timeout via the `AbortController`. If the gateway doesn't respond in 20 s, the request is aborted and the error state triggers the backoff logic. |
| **Persistent-error thrashing** | Errored cards are retried with exponential backoff: attempts 1–3 retry on the next 10 s poll, attempts 4–8 back off to 60 s, and attempt 9+ back off to 5 minutes. A card that fails all day makes at most ~70 requests instead of 8,640. |
| **Hidden-tab waste** | Both polling intervals (10 s status/retry + 5 min indices) are stored in refs so the `visibilitychange` handler can clear them when the tab is hidden and restart them on focus. |
| **Unmount leaks** | `useEffect` cleanup aborts all in-flight requests and clears all intervals, so no callbacks fire after the component unmounts. |
| **Web Audio accumulation** | `playAlarmSound` schedules `AudioContext.close()` after all oscillator notes finish. Browsers allow roughly 6 open `AudioContext`s; forgetting to close them triggers a browser warning and eventually silences new ones. |

### Polling schedule

| Source | Interval | Notes |
|--------|----------|-------|
| Status check + errored-card retry | 10 s | Only retries cards in error state and past their backoff window |
| Market indices (NIFTY / BANKNIFTY / SENSEX) | 5 min | Separate interval; paused when tab is hidden |
| Alarm check | 10 s (in `App.jsx`) | Reads `localStorage` only; no network |

---

## Tasks & Reminders Alarms

The **Tasks & Reminders** card (Row 1, centre) is a browser-only feature — no backend involved.

**Data model** (stored in `localStorage['dashboard_tasks']`):
```json
[
  { "id": "abc123", "text": "Review PR", "done": false, "alarm": "2026-07-16T09:00:00.000Z" },
  { "id": "def456", "text": "Call dentist", "done": true,  "alarm": null }
]
```

**Alarm flow:**
1. `App.jsx` runs `setInterval` every 10 seconds.
2. Finds the first task where `!done && alarm && new Date(alarm) <= now`.
3. Sets `alarmTask` state → renders `<AlarmNotification>` portal over the whole page.
4. Notification plays a Web Audio ringtone and shows the configured CSS animation.
5. **Snooze**: reschedules `task.alarm = now + snooze_minutes`, dispatches `tasks-updated`.
6. **Dismiss**: clears `task.alarm = null`, dispatches `tasks-updated`.
7. `QuickNotesCard` listens to `tasks-updated` and reloads from `localStorage`.

**Alarm config** (stored in `localStorage['dashboard_alarm_config']`):
```json
{ "animation": "bounce", "ringtone": "chime", "snooze": 5 }
```
Change via **Settings → Notes**. Dispatches `alarm-config-changed` CustomEvent so `App.jsx` picks up the new config immediately without a page reload.

---

## Adding a New Dashboard Card

1. Create `src/components/MyCard.jsx`. Follow the pattern of an existing card:
   - Use `BentoCard` as the shell.
   - Add a `createPortal` popup for details.
   - Use `useMemo` for derived values, not inline calculations in JSX.

2. Add a data fetch in `useDashboard.js`.

3. Register the card in `App.jsx`:
   - Add to `CARD_ORDER` array.
   - Add to the `computeSpans()` row logic.
   - Render `<MyCard />` in the grid.

4. Add a toggle in `SettingsModal.jsx` → Layout tab.

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
- `.env.sample` must contain only placeholder values.
- `GOOGLE_OAUTH_TOKEN`, `INDMONEY_*` tokens, and `GATEWAY_API_TOKEN` in `.env` are written automatically — safe to leave but never commit.
- `DASHBOARD_ORIGIN` must match in both `.env` files — the gateway enforces it for CORS and for IndMoney's `postMessage` target.
- Before pushing: `git diff origin/HEAD...HEAD` — confirm no secrets are visible.
- If a secret is accidentally committed: remove it from history immediately and rotate the credential.

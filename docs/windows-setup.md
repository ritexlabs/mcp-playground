# Windows Setup Guide

This guide walks you through running the MCP Playground (gateway + dashboard) on Windows 10 or Windows 11.

All shell scripts have been replaced with Python scripts so everything works identically on Windows, macOS, and Linux.

---

## Prerequisites — Software You Must Install Manually

The setup script checks for these tools and will tell you if something is missing, but you need to install them yourself before running anything.

### 1. Python 3.11 or later

1. Open [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. Click **Download Python 3.12.x** (or the latest 3.11+)
3. Run the installer
4. **Important** — on the first screen, tick **"Add Python to PATH"** before clicking Install Now

Verify the install by opening a new Command Prompt or PowerShell window and typing:

```
python --version
```

You should see `Python 3.11.x` or later. If you see `Python 3.10` or an error, re-install with the PATH option ticked.

---

### 2. Node.js 18 or later

1. Open [https://nodejs.org/](https://nodejs.org/)
2. Download the **LTS** version (18.x or later)
3. Run the installer — defaults are fine, no extra options needed

Verify the install:

```
node --version
npm --version
```

Both commands should print version numbers. If not, reopen your terminal after installing.

---

### 3. Git

If you cloned this repo you already have Git. Verify:

```
git --version
```

If missing, download from [https://git-scm.com/](https://git-scm.com/) and install with defaults.

---

## First-Time Setup

Run these steps once after cloning the repository.

### Step 1 — Git configuration (optional, one-time)

This protects AI instruction files from being accidentally committed:

```
python scripts\setup.py
```

### Step 2 — Set up the MCP Gateway

```
cd mcp-gateway
python setup.py
```

This script will:
- Confirm Python 3.11+ is available
- Create `mcp-gateway\.env` from the example template
- Create the `logs\` directory
- Create a virtual environment at `mcp-gateway\.venv`
- Install all Python packages listed in `requirements.txt`

After it finishes you will see a **"Setup complete!"** message with the next steps printed out.

### Step 3 — Add your Google credentials

Open `mcp-gateway\.env` in any text editor (Notepad works fine) and fill in your Google OAuth credentials:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
```

**How to get these values:**

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Go to **APIs & Services → Library** and enable:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Sheets API
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Copy the **Client ID** and **Client Secret** into `mcp-gateway\.env`

### Step 4 — Authorise Google services

This opens your browser for a one-time sign-in. Run from inside the `mcp-gateway` folder:

```
cd mcp-gateway
.venv\Scripts\python.exe scripts\auth_all.py
```

- Your browser will open — sign in with your Google account
- Tick **all permission checkboxes** on the consent screen
- Close the browser tab when prompted
- The token is stored securely in the Windows Credential Manager

You only need to do this once. The token auto-refreshes.

---

## Running the Application

### Option A — Start everything at once (recommended)

From the **repo root** (the folder containing `scripts\`):

```
python scripts\start_dashboard.py start
```

This starts the gateway first, waits for it to be healthy, then starts the dashboard.

Open your browser and go to [http://localhost:8080](http://localhost:8080)

### Option B — Start services individually

Open **two separate terminal windows**.

**Terminal 1 — Gateway:**

```
cd mcp-gateway
python start.py
```

**Terminal 2 — Dashboard:**

```
cd daily-briefing-dashboard
python start.py
```

---

## Managing the Stack

All commands are run from the **repo root**:

| Action | Command |
|--------|---------|
| Start everything | `python scripts\start_dashboard.py start` |
| Stop everything | `python scripts\start_dashboard.py stop` |
| Restart everything | `python scripts\start_dashboard.py restart` |
| Check status | `python scripts\start_dashboard.py status` |

Or manage each service individually:

| Action | Command |
|--------|---------|
| Start gateway | `cd mcp-gateway && python start.py` |
| Stop gateway | `cd mcp-gateway && python stop.py` |
| Start dashboard | `cd daily-briefing-dashboard && python start.py` |
| Stop dashboard | `cd daily-briefing-dashboard && python stop.py` |

---

## Checking Logs

**Gateway log:**

```
type mcp-gateway\logs\gateway.log
```

To follow it in real time (PowerShell):

```powershell
Get-Content mcp-gateway\logs\gateway.log -Wait -Tail 50
```

**Dashboard log:**

```
type daily-briefing-dashboard\.server.log
```

To follow it in real time (PowerShell):

```powershell
Get-Content daily-briefing-dashboard\.server.log -Wait -Tail 50
```

---

## Windows-Specific Notes

### Token storage

On macOS the app uses the macOS Keychain. On Windows it uses the **Windows Credential Manager** (via the `keyring` Python library). Your Google and IndMoney OAuth tokens are stored there automatically — you do not need to do anything extra.

To view stored credentials: **Control Panel → Credential Manager → Windows Credentials → look for entries starting with `mcp-gateway`**.

### Firewall prompt

The first time you start the gateway, Windows Firewall may ask if `python.exe` should be allowed to access the network. Click **Allow access** — the gateway only binds to `127.0.0.1` (localhost) and is never reachable from outside your machine.

### Terminal colours

All scripts use ANSI colour codes. These work in:
- **Windows Terminal** (recommended — install from Microsoft Store)
- **PowerShell 5.1+**
- **Command Prompt** on Windows 10 1903 and later

If you see raw escape characters like `\033[32m` instead of green text, use Windows Terminal or PowerShell instead of an older cmd window.

### Process management

The `.py` scripts use `DETACHED_PROCESS` and `CREATE_NEW_PROCESS_GROUP` flags to keep the gateway and dashboard running after the terminal closes. The PID is stored in:
- `mcp-gateway\.gateway.pid`
- `daily-briefing-dashboard\.server.pid`

Running `python stop.py` reads these files to cleanly terminate the process. If a PID file is missing, the stop script falls back to finding the process by port using `netstat`.

---

## Troubleshooting

### `python` is not recognised

Make sure you ticked **"Add Python to PATH"** during installation. Reinstall if needed, or add it manually:

1. Open **System Properties → Advanced → Environment Variables**
2. Under **User variables**, find **Path** and click Edit
3. Add `C:\Users\YourName\AppData\Local\Programs\Python\Python312\`
   (adjust to match your Python version)
4. Also add `C:\Users\YourName\AppData\Local\Programs\Python\Python312\Scripts\`
5. Click OK and reopen your terminal

### `npm` is not recognised

Node.js was likely installed without the option to add it to PATH. Reinstall from [https://nodejs.org/](https://nodejs.org/) — the installer adds npm to PATH automatically.

### Gateway shows `Access Denied` or port conflict

Port 8000 may already be in use. Start the gateway on a different port:

```
cd mcp-gateway
python start.py --port 8001
```

Then update `daily-briefing-dashboard\.env`:

```
MCP_GATEWAY_URL=http://127.0.0.1:8001
```

### `ModuleNotFoundError` when starting the gateway

The virtual environment packages may not have been installed. Re-run setup:

```
cd mcp-gateway
python setup.py
```

### Google auth browser tab does not open

Try running the auth script with `--no-browser` and manually copy the URL it prints:

```
cd mcp-gateway
.venv\Scripts\python.exe scripts\auth_all.py
```

If the browser still doesn't open, check that your default browser is set in Windows Settings.

### IndMoney card shows "Session Expired"

IndMoney access tokens expire periodically. Click the **Reconnect IndMoney** button that appears on the card, or go to **Settings → IndMoney → Connect IndMoney** and sign in again.

---

## Quick Reference

```
# One-time setup
python scripts\setup.py          # git config
cd mcp-gateway
python setup.py                  # install python deps
# edit mcp-gateway\.env with your Google credentials
.venv\Scripts\python.exe scripts\auth_all.py   # google auth

# Daily use (from repo root)
python scripts\start_dashboard.py start    # start everything
python scripts\start_dashboard.py stop     # stop everything
python scripts\start_dashboard.py status   # check what's running

# Then open http://localhost:8080 in your browser
```

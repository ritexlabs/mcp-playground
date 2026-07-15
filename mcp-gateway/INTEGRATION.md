# Client Integration Guide

Connect the MCP Gateway to AI desktop apps and IDEs. The gateway speaks standard MCP-over-SSE, so any MCP-compatible client works with no code changes.

**Gateway endpoints:**

| Endpoint | URL | Used by |
|----------|-----|---------|
| Streamable HTTP (modern MCP) | `http://127.0.0.1:8000/mcp` | Claude Desktop, Gemini Desktop, Cursor |
| SSE (legacy MCP) | `http://127.0.0.1:8000/sse` | Daily Briefing Dashboard, older clients |
| Health check | `http://127.0.0.1:8000/health` | All |

**Start the gateway before connecting any client:**

```bash
cd mcp-gateway
python mcp-gateway/mcp_gateway.py start
# Verify: curl http://127.0.0.1:8000/health
```

---

## Claude Desktop

Claude Desktop supports MCP servers over SSE. No subprocess or extra config is needed — just point it at the running gateway.

### Step 1 — Open the configuration file

```bash
open ~/Library/Application\ Support/Claude/
```

Open `claude_desktop_config.json` in a text editor. If the file does not exist, create it.

### Step 2 — Add the gateway

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "url": "http://127.0.0.1:8000/mcp"
    }
  }
}
```

If you already have other MCP servers configured, add `mcp-gateway` alongside them:

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "url": "http://127.0.0.1:8000/mcp"
    },
    "some-other-server": {
      "command": "..."
    }
  }
}
```

### Step 3 — Restart Claude Desktop

Quit Claude Desktop completely (not just close the window — use ⌘Q or menu → Quit) and reopen it.

### Step 4 — Verify the connection

1. Open a new conversation in Claude Desktop.
2. Click the **Tools** icon (hammer icon near the input box) — you should see the gateway tools listed:
   - `calculate`
   - `get_weather`
   - `gmail_list_latest`
   - `calendar_list_events`
   - `get_stocks`
   - `indmoney_*` (if IndMoney is connected)

3. Try a quick test in the chat:
   ```
   What is the weather in Bengaluru?
   ```
   Claude will call `get_weather` automatically.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Tools not visible after restart | Confirm the gateway is running: `curl http://127.0.0.1:8000/health` |
| `Connection refused` error | The gateway is not running — run `python mcp-gateway/mcp_gateway.py start` in `mcp-gateway/` |
| JSON parse error on startup | Check `claude_desktop_config.json` for syntax errors (trailing commas, missing braces) |
| Tools visible but returning errors | Check that Google is authenticated: open `http://127.0.0.1:8000/auth/status` in a browser |

---

## Gemini Desktop

Google's Gemini desktop app supports MCP servers through its settings panel.

### Step 1 — Start the gateway

Make sure the MCP Gateway is running:

```bash
cd mcp-gateway
python mcp-gateway/mcp_gateway.py start
curl http://127.0.0.1:8000/health
```

### Step 2 — Open Gemini Desktop settings

1. Open the **Gemini** desktop app.
2. Click the **Settings** icon (gear icon, usually in the top-right or sidebar).
3. Navigate to **Extensions** or **Tools** → **MCP Servers** (the exact label depends on your app version).

### Step 3 — Add the MCP Gateway

Click **Add server** (or **+**) and fill in:

| Field | Value |
|-------|-------|
| Name | `mcp-gateway` |
| Type / Transport | `SSE` or `HTTP` |
| URL | `http://127.0.0.1:8000/mcp` |

Save and close settings.

### Step 4 — Verify the connection

The server status indicator should turn green or show "Connected". You can test by typing a prompt that triggers a tool:

```
What's the weather like in Mumbai?
```

Gemini will call `get_weather` via the gateway and return the result.

### Step 5 — Authenticate Google tools (first time)

If you want Gmail, Calendar, or Stocks tools to work, authenticate Google via the dashboard or directly in a browser:

```
http://127.0.0.1:8000/auth/google
```

Grant all requested permissions. The token is stored in macOS Keychain — you only need to do this once.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Server shows "Disconnected" | Gateway not running — run `python mcp-gateway/mcp_gateway.py start` |
| No tools appear | Check URL is exactly `http://127.0.0.1:8000/mcp` (not `/sse`) |
| Google tools return auth errors | Open `http://127.0.0.1:8000/auth/google` to re-authenticate |

> **Note:** Gemini Desktop's MCP UI may differ between versions. If the steps above don't match your app version, look for any "Connect tools", "Extensions", or "MCP" section in settings.

---

## Cursor IDE

1. Open **Cursor Settings** (`⌘,` on macOS) → **Features** → **MCP**.
2. Click **+ Add New MCP Server**.
3. Set:
   - **Name:** `mcp-gateway`
   - **Type:** `http` or `sse`
   - **URL:** `http://127.0.0.1:8000/mcp`
4. Click **Save**.

The status indicator turns green when the gateway is running. Tools appear in the Cursor agent panel.

---

## VS Code — Cline / Roo Code

Edit the Cline MCP settings file:

```
~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

Add the gateway:

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "url": "http://127.0.0.1:8000/mcp",
      "disabled": false
    }
  }
}
```

Save the file. Cline picks up the server automatically without restarting VS Code.

---

## Python (MCP SDK)

Connect from a Python script for scripting or automation:

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    async with sse_client("http://127.0.0.1:8000/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List available tools
            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            # Call a tool
            result = await session.call_tool("get_weather", {"location": "Bengaluru"})
            print(result.content[0].text)

asyncio.run(main())
```

Install the SDK: `pip install mcp`

---

## Available Tools

| Tool | Auth required | Description |
|------|---------------|-------------|
| `calculate` | None | Safe math expression evaluator |
| `get_weather` | None | Current weather + IMD alerts for Indian cities |
| `gmail_list_latest` | Google | Fetch latest inbox emails (subject, sender, snippet) |
| `calendar_list_events` | Google | List upcoming Google Calendar events |
| `get_stocks` | Google | Portfolio data from a configured Google Sheet |
| `indmoney_networth_snapshot` | IndMoney | Net worth snapshot across all asset classes |
| `indmoney_indian_stocks_sips` | IndMoney | Indian stock SIP holdings |
| `indmoney_mf_sips` | IndMoney | Mutual fund SIP holdings |
| `indmoney_*` | IndMoney | All other tools discovered from IndMoney MCP |

### Authentication Quick Reference

| Service | How to authenticate | Where tokens are stored |
|---------|---------------------|------------------------|
| Google | Open `http://127.0.0.1:8000/auth/google` in a browser | macOS Keychain |
| IndMoney | Open Dashboard → Settings → IndMoney → Connect | macOS Keychain |

---

## Running Multiple Clients at Once

All clients connect to the same gateway simultaneously. The gateway handles concurrent SSE connections — no limit, no conflicts. Google and IndMoney tokens are shared across all clients automatically.

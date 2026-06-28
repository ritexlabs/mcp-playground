# MCP Gateway Integration Guide

This guide shows how to connect the Python FastAPI MCP gateway to various AI clients.

The gateway exposes a standard MCP-over-SSE interface:
- **SSE endpoint:** `GET  http://127.0.0.1:8000/sse`
- **Messages endpoint:** `POST http://127.0.0.1:8000/messages/`
- **Health check:** `GET  http://127.0.0.1:8000/health`

**Start the gateway first:**
```bash
cd mcp-gateway
./setup.sh          # first run only
python scripts/auth_all.py   # one-time Google OAuth
./start.sh
```

---

## 1. Claude Desktop

Claude Desktop supports both stdio and SSE MCP servers.

### SSE (Recommended — no subprocess needed)

1. Open the Claude Desktop configuration file:
   ```bash
   # macOS
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Windows
   notepad %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Add the gateway under `mcpServers`:
   ```json
   {
     "mcpServers": {
       "mcp-gateway": {
         "url": "http://127.0.0.1:8000/sse"
       }
     }
   }
   ```

3. Make sure the gateway is running (`./start.sh`), then restart Claude Desktop.

---

## 2. Python Agent (Google ADK / Custom)

Connect from a Python script using the `mcp` SDK's `sse_client`:

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    async with sse_client("http://127.0.0.1:8000/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            result = await session.call_tool("get_weather", {"location": "Bengaluru"})
            print(result.content[0].text)

asyncio.run(main())
```

---

## 3. Cursor IDE

1. Open **Cursor Settings** → **Features** → **MCP**.
2. Click **+ Add New MCP Server**.
3. Set:
   - **Name:** `mcp-gateway`
   - **Type:** `sse`
   - **URL:** `http://127.0.0.1:8000/sse`
4. Click **Save**.

The status indicator turns green once the gateway is running.

---

## 4. VS Code — Cline / Roo Code

Edit the Cline MCP settings file:
`~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "url": "http://127.0.0.1:8000/sse",
      "disabled": false
    }
  }
}
```

Save the file. Cline picks up the server automatically.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `calculate` | Safe math expression evaluation |
| `get_weather` | Current weather + IMD alerts for Indian cities |
| `gmail_list_latest` | Fetch inbox emails via Gmail API |
| `calendar_list_events` | List upcoming Google Calendar events |
| `get_stocks` | Portfolio data from a Google Sheet |

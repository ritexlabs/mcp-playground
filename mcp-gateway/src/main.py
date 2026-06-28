import asyncio
import contextlib
import logging

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import (
    TextContent,
    Tool,
)

from .config.secrets import (
    clear_oauth_token,
    get_oauth_token,
    store_oauth_token,
    update_env_setting,
)
from .config.settings import settings
from .tools.calculator import handle_calculate
from .tools.calendar import handle_calendar_list_events
from .tools.gmail import handle_gmail_list_latest
from .tools.stocks import handle_get_stocks
from .tools.weather import handle_get_weather
from .utils.errors import MCPError, sanitize_error
from .auth.token_manager import token_manager
from .utils.logger import log_auth_event, log_system_event, log_tool_access
from .utils.rate_limiter import rate_limiter

_AUTH_FLOWS: dict[str, object] = {}

logger = logging.getLogger(__name__)

_TOOLS: list[Tool] = [
    Tool(
        name="calculate",
        description="Evaluate a safe math expression (arithmetic, exponents, percentages).",
        inputSchema={
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "Math expression to evaluate"},
            },
            "required": ["expression"],
        },
    ),
    Tool(
        name="get_weather",
        description="Get current weather for a location. Includes IMD alerts for Indian cities.",
        inputSchema={
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City or place name"},
                "latitude": {"type": "number"},
                "longitude": {"type": "number"},
                "temperature_unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "default": "celsius",
                },
            },
        },
    ),
    Tool(
        name="gmail_list_latest",
        description="List the latest emails from your Gmail inbox.",
        inputSchema={
            "type": "object",
            "properties": {
                "max_results": {
                    "type": "integer",
                    "description": "Number of emails to fetch (1–20)",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20,
                },
            },
        },
    ),
    Tool(
        name="calendar_list_events",
        description="List upcoming Google Calendar events.",
        inputSchema={
            "type": "object",
            "properties": {
                "max_results": {
                    "type": "integer",
                    "description": "Maximum events to return (1–50)",
                    "default": 10,
                    "minimum": 1,
                    "maximum": 50,
                },
                "days_ahead": {
                    "type": "integer",
                    "description": "How many days to look ahead (1–90)",
                    "default": 7,
                    "minimum": 1,
                    "maximum": 90,
                },
                "calendar_id": {
                    "type": "string",
                    "description": "Google Calendar ID (default: 'primary')",
                    "default": "primary",
                },
            },
        },
    ),
    Tool(
        name="get_stocks",
        description="Fetch stock data from a Google Sheet (MyStocks portfolio).",
        inputSchema={
            "type": "object",
            "properties": {
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ticker symbols to filter (e.g. ['AAPL', 'MSFT']). Empty = all.",
                },
            },
        },
    ),
]

mcp_server = Server(settings.MCP_SERVER_NAME)
sse_transport = SseServerTransport("/messages/")


@mcp_server.list_tools()
async def list_tools() -> list[Tool]:
    return _TOOLS


@mcp_server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    rate_limiter.check_limit(name)
    log_tool_access(name, arguments)

    try:
        result = await _dispatch(name, arguments)
    except MCPError:
        raise
    except Exception as exc:
        logger.exception("Unexpected error in tool %s", name)
        raise MCPError(sanitize_error(exc), "TOOL_ERROR") from exc

    return [TextContent(type="text", text=result)]


async def _dispatch(name: str, args: dict) -> str:
    match name:
        case "calculate":
            return handle_calculate(args.get("expression", ""))

        case "get_weather":
            return await handle_get_weather(
                location=args.get("location"),
                latitude=args.get("latitude"),
                longitude=args.get("longitude"),
                temperature_unit=args.get("temperature_unit", "celsius"),
            )

        case "gmail_list_latest":
            return await asyncio.to_thread(
                handle_gmail_list_latest,
                args.get("max_results", 5),
            )

        case "calendar_list_events":
            return await asyncio.to_thread(
                handle_calendar_list_events,
                args.get("max_results", 10),
                args.get("days_ahead", 7),
                args.get("calendar_id", "primary"),
            )

        case "get_stocks":
            return await asyncio.to_thread(
                handle_get_stocks,
                args.get("symbols"),
            )

        case _:
            raise MCPError(f"Unknown tool: {name}", "UNKNOWN_TOOL", 404)


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    log_system_event(
        "startup",
        server=settings.MCP_SERVER_NAME,
        version=settings.MCP_SERVER_VERSION,
        host=settings.MCP_HOST,
        port=settings.MCP_PORT,
        google_configured=settings.is_google_configured(),
        always_available=["calculate", "get_weather"],
    )
    yield
    log_system_event("shutdown", server=settings.MCP_SERVER_NAME)


app = FastAPI(
    title=settings.MCP_SERVER_NAME,
    version=settings.MCP_SERVER_VERSION,
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "server": settings.MCP_SERVER_NAME,
        "version": settings.MCP_SERVER_VERSION,
        "google_configured": settings.is_google_configured(),
    }


@app.get("/sse")
async def handle_sse(request: Request):
    async with sse_transport.connect_sse(
        request.scope, request.receive, request._send
    ) as streams:
        await mcp_server.run(
            streams[0],
            streams[1],
            mcp_server.create_initialization_options(),
        )


@app.post("/messages/")
async def handle_messages(request: Request):
    await sse_transport.handle_post_message(
        request.scope, request.receive, request._send
    )


@app.exception_handler(MCPError)
async def mcp_error_handler(_request: Request, exc: MCPError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": str(exc)},
    )


# ── Auth endpoints ─────────────────────────────────────────────────────────────

def _make_flow():
    from google_auth_oauthlib.flow import Flow
    from .services.google_auth import ALL_SCOPES
    client_config = {
        "installed": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://127.0.0.1:8000/auth/callback"],
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=ALL_SCOPES,
        redirect_uri=f"http://{settings.MCP_HOST}:{settings.MCP_PORT}/auth/callback",
    )
    return flow


@app.get("/auth/status")
async def auth_status():
    token_data = await asyncio.to_thread(get_oauth_token)
    authenticated = bool(token_data)

    spreadsheet_name = None
    if authenticated and settings.MYSTOCKS_SPREADSHEET_ID:
        try:
            from .services.google_client_factory import get_sheets_client
            svc = await asyncio.to_thread(get_sheets_client)
            meta = await asyncio.to_thread(
                lambda: svc.spreadsheets()
                .get(spreadsheetId=settings.MYSTOCKS_SPREADSHEET_ID, fields="properties/title")
                .execute()
            )
            spreadsheet_name = meta.get("properties", {}).get("title")
        except Exception:
            pass

    return {
        "authenticated": authenticated,
        "google_configured": settings.is_google_configured(),
        "spreadsheet_id": settings.MYSTOCKS_SPREADSHEET_ID or None,
        "spreadsheet_name": spreadsheet_name,
    }


@app.get("/auth/google")
async def auth_google():
    if not settings.is_google_configured():
        return HTMLResponse(
            "<h2>GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in .env</h2>"
            "<p>Add your Google Cloud OAuth credentials and restart the gateway.</p>",
            status_code=503,
        )
    flow = _make_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline", prompt="consent", include_granted_scopes="true"
    )
    _AUTH_FLOWS[state] = flow
    return RedirectResponse(auth_url)


@app.get("/auth/callback")
async def auth_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return HTMLResponse(_html_result("Authorization Denied", error, success=False))

    flow = _AUTH_FLOWS.pop(state, None)
    if not flow:
        return HTMLResponse(_html_result("Session Expired", "Please try again.", success=False), status_code=400)

    try:
        await asyncio.to_thread(flow.fetch_token, code=code)
        creds = flow.credentials
        token_data = token_manager.from_credentials(creds)
        await asyncio.to_thread(store_oauth_token, token_data)
        log_auth_event("google", "oauth_callback", True)
        return HTMLResponse(_html_result(
            "Connected!",
            "Google authorization successful. You can close this tab and return to the dashboard.",
            success=True,
        ))
    except Exception as exc:
        log_auth_event("google", "oauth_callback", False, error=str(exc))
        return HTMLResponse(_html_result("Authorization Failed", sanitize_error(exc), success=False), status_code=500)


@app.delete("/auth/token")
async def disconnect_google():
    await asyncio.to_thread(clear_oauth_token)
    log_auth_event("google", "disconnect", True)
    return {"status": "disconnected"}


# ── Config endpoints ───────────────────────────────────────────────────────────

@app.get("/config/sheets")
async def list_sheets():
    try:
        from .services.google_client_factory import get_drive_client
        drive = await asyncio.to_thread(get_drive_client)
        result = await asyncio.to_thread(
            lambda: drive.files()
            .list(
                q="mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
                fields="files(id,name,modifiedTime)",
                orderBy="modifiedTime desc",
                pageSize=50,
            )
            .execute()
        )
        return result.get("files", [])
    except MCPError:
        raise
    except Exception as exc:
        raise MCPError(sanitize_error(exc), "SERVICE_ERROR", 500) from exc


@app.post("/config/sheets/{spreadsheet_id}")
async def save_sheet(spreadsheet_id: str):
    if not spreadsheet_id or len(spreadsheet_id) > 200:
        raise MCPError("Invalid spreadsheet ID", "VALIDATION_ERROR", 400)
    settings.MYSTOCKS_SPREADSHEET_ID = spreadsheet_id
    await asyncio.to_thread(update_env_setting, "MYSTOCKS_SPREADSHEET_ID", spreadsheet_id)
    return {"status": "saved", "spreadsheet_id": spreadsheet_id}


def _html_result(title: str, message: str, *, success: bool) -> str:
    color = "#2dd4bf" if success else "#f43f5e"
    icon = "✅" if success else "❌"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    body {{ background:#070a13; color:#f8fafc; font-family:system-ui,sans-serif;
           display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }}
    .box {{ background:rgba(17,24,39,.8); border:1px solid rgba(255,255,255,.08);
            border-radius:1rem; padding:2.5rem; max-width:420px; text-align:center; }}
    h2 {{ color:{color}; margin-bottom:.75rem; font-size:1.5rem; }}
    p  {{ color:#94a3b8; line-height:1.6; }}
    .icon {{ font-size:2.5rem; margin-bottom:1rem; }}
    button {{ margin-top:1.5rem; background:{color}; color:#070a13; border:none;
              border-radius:.5rem; padding:.6rem 1.5rem; font-size:.95rem;
              font-weight:700; cursor:pointer; }}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">{icon}</div>
    <h2>{title}</h2>
    <p>{message}</p>
    <button onclick="window.close()">Close Tab</button>
  </div>
</body>
</html>"""


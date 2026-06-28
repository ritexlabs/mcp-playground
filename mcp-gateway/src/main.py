import asyncio
import contextlib
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.types import (
    TextContent,
    Tool,
)

from .config.secrets import (
    clear_indmoney_token,
    clear_oauth_token,
    get_indmoney_token,
    get_oauth_token,
    store_indmoney_token,
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

# Stores {state: {"flow": ..., "created_at": float}} for TTL enforcement
_AUTH_FLOWS: dict[str, dict] = {}
# Stores {state: {"code_verifier": str, "client_id": str, "created_at": float}}
_INDMONEY_AUTH_FLOWS: dict[str, dict] = {}

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
http_session_manager = StreamableHTTPSessionManager(mcp_server, stateless=True)


@mcp_server.list_tools()
async def list_tools() -> list[Tool]:
    tools = list(_TOOLS)
    try:
        from .services.downstream.indmoney_client import list_tools as _indmoney_tools
        downstream = await _indmoney_tools()
        tools.extend(downstream)
    except Exception:
        pass
    return tools


@mcp_server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    rate_limiter.check_limit(name)
    log_tool_access(name, arguments)

    # Proxy IndMoney tools to downstream server
    if name.startswith("indmoney_"):
        from .services.downstream.indmoney_client import call_tool as _indmoney_call
        try:
            return await _indmoney_call(name, arguments)
        except MCPError:
            raise
        except Exception as exc:
            logger.exception("Unexpected error calling IndMoney tool %s", name)
            raise MCPError(sanitize_error(exc), "TOOL_ERROR") from exc

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
    async with http_session_manager.run():
        yield
    log_system_event("shutdown", server=settings.MCP_SERVER_NAME)


class _SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )
        return response


app = FastAPI(
    title=settings.MCP_SERVER_NAME,
    version=settings.MCP_SERVER_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.DASHBOARD_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)
app.add_middleware(_SecurityHeadersMiddleware)


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


# Streamable HTTP transport — used by Claude Desktop and other modern MCP clients
@app.api_route("/mcp", methods=["GET", "POST", "DELETE"])
async def handle_mcp(request: Request):
    await http_session_manager.handle_request(
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
    _AUTH_FLOWS[state] = {"flow": flow, "created_at": time.time()}
    return RedirectResponse(auth_url)


@app.get("/auth/callback")
async def auth_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return HTMLResponse(_html_result("Authorization Denied", error, success=False))

    entry = _AUTH_FLOWS.pop(state, None)
    if not entry:
        return HTMLResponse(_html_result("Session Expired", "Please try again.", success=False), status_code=400)
    if time.time() - entry["created_at"] > settings.AUTH_FLOW_TTL_SECONDS:
        return HTMLResponse(_html_result("Session Expired", "Authorization window expired. Please try again.", success=False), status_code=400)
    flow = entry["flow"]

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


# ── IndMoney OAuth endpoints (OAuth 2.1 + PKCE + dynamic client registration) ──

# Endpoints discovered from https://mcp.indmoney.com/.well-known/oauth-authorization-server
_INDMONEY_AUTH_ENDPOINT = "https://mcp.indmoney.com/authorize"
_INDMONEY_TOKEN_ENDPOINT = "https://mcp.indmoney.com/token"
_INDMONEY_REGISTER_ENDPOINT = "https://mcp.indmoney.com/register"


def _pkce_pair() -> tuple[str, str]:
    import hashlib, base64, secrets as _s
    verifier = base64.urlsafe_b64encode(_s.token_bytes(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


async def _get_or_register_indmoney_client() -> tuple[str, str | None]:
    """Dynamically register this gateway as an OAuth client on first call; reuse after."""
    if settings.INDMONEY_CLIENT_ID:
        return settings.INDMONEY_CLIENT_ID, settings.INDMONEY_CLIENT_SECRET

    import httpx as _httpx
    redirect_uri = f"http://{settings.MCP_HOST}:{settings.MCP_PORT}/auth/indmoney/callback"

    async with _httpx.AsyncClient() as client:
        resp = await client.post(
            _INDMONEY_REGISTER_ENDPOINT,
            json={
                "client_name": settings.MCP_SERVER_NAME,
                "redirect_uris": [redirect_uri],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "client_secret_post",
            },
            timeout=15,
        )
        resp.raise_for_status()
        reg = resp.json()

    client_id: str = reg["client_id"]
    client_secret: str | None = reg.get("client_secret")

    settings.INDMONEY_CLIENT_ID = client_id
    await asyncio.to_thread(update_env_setting, "INDMONEY_CLIENT_ID", client_id)
    if client_secret:
        settings.INDMONEY_CLIENT_SECRET = client_secret
        await asyncio.to_thread(update_env_setting, "INDMONEY_CLIENT_SECRET", client_secret)

    log_auth_event("indmoney", "client_registered", True)
    return client_id, client_secret


@app.get("/auth/indmoney")
async def auth_indmoney():
    try:
        client_id, _ = await _get_or_register_indmoney_client()
    except Exception as exc:
        log_auth_event("indmoney", "client_register", False, error=str(exc))
        return HTMLResponse(
            _html_result("Registration Failed", sanitize_error(exc), success=False),
            status_code=500,
        )

    import secrets as _secrets
    from urllib.parse import urlencode

    state = _secrets.token_urlsafe(32)
    code_verifier, code_challenge = _pkce_pair()
    _INDMONEY_AUTH_FLOWS[state] = {"code_verifier": code_verifier, "client_id": client_id, "created_at": time.time()}

    redirect_uri = f"http://{settings.MCP_HOST}:{settings.MCP_PORT}/auth/indmoney/callback"
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state,
        "scope": settings.INDMONEY_SCOPES,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return RedirectResponse(f"{_INDMONEY_AUTH_ENDPOINT}?{urlencode(params)}")


@app.get("/auth/indmoney/callback")
async def auth_indmoney_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return HTMLResponse(_html_result("Authorization Denied", error, success=False))

    flow = _INDMONEY_AUTH_FLOWS.pop(state, None)
    if not flow:
        return HTMLResponse(
            _html_result("Session Expired", "Please try again.", success=False), status_code=400
        )
    if time.time() - flow["created_at"] > settings.AUTH_FLOW_TTL_SECONDS:
        return HTMLResponse(
            _html_result("Session Expired", "Authorization window expired. Please try again.", success=False), status_code=400
        )

    try:
        import httpx as _httpx

        redirect_uri = f"http://{settings.MCP_HOST}:{settings.MCP_PORT}/auth/indmoney/callback"
        token_body: dict = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": flow["client_id"],
            "code_verifier": flow["code_verifier"],
        }
        if settings.INDMONEY_CLIENT_SECRET:
            token_body["client_secret"] = settings.INDMONEY_CLIENT_SECRET

        async with _httpx.AsyncClient() as client:
            resp = await client.post(_INDMONEY_TOKEN_ENDPOINT, data=token_body, timeout=15)
            resp.raise_for_status()
            token_data = resp.json()

        if "expires_in" in token_data and "expires_at" not in token_data:
            token_data["expires_at"] = time.time() + int(token_data["expires_in"])

        await asyncio.to_thread(store_indmoney_token, token_data)
        log_auth_event("indmoney", "oauth_callback", True)

        from .services.downstream import indmoney_client as _im
        _im._cache_expires = 0.0

        return HTMLResponse(_indmoney_success_html())
    except Exception as exc:
        log_auth_event("indmoney", "oauth_callback", False, error=str(exc))
        return HTMLResponse(
            _html_result("Authorization Failed", sanitize_error(exc), success=False),
            status_code=500,
        )


@app.delete("/auth/indmoney/token")
async def disconnect_indmoney():
    await asyncio.to_thread(clear_indmoney_token)
    from .services.downstream import indmoney_client as _im
    _im._cache_expires = 0.0
    log_auth_event("indmoney", "disconnect", True)
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
    import re as _re
    if not spreadsheet_id or not _re.fullmatch(r"[A-Za-z0-9_\-]{20,60}", spreadsheet_id):
        raise MCPError("Invalid spreadsheet ID format", "VALIDATION_ERROR", 400)
    settings.MYSTOCKS_SPREADSHEET_ID = spreadsheet_id
    await asyncio.to_thread(update_env_setting, "MYSTOCKS_SPREADSHEET_ID", spreadsheet_id)
    return {"status": "saved", "spreadsheet_id": spreadsheet_id}


# ── IndMoney config endpoints ──────────────────────────────────────────────────

@app.get("/config/indmoney/status")
async def indmoney_status():
    from .services.downstream.indmoney_client import test_connection
    result = await test_connection()
    result["url"] = settings.INDMONEY_MCP_URL
    result["display_tool"] = settings.INDMONEY_DISPLAY_TOOL
    # oauth_configured: always true — gateway self-registers via dynamic client registration
    result["oauth_configured"] = True
    return result


@app.post("/config/indmoney/save")
async def indmoney_save(body: dict):
    from urllib.parse import urlparse
    import re as _re

    url = body.get("url", "").strip()
    display_tool = body.get("display_tool", "").strip()

    if url:
        parsed = urlparse(url)
        if parsed.scheme not in ("https", "http") or not parsed.netloc:
            raise MCPError("Invalid IndMoney MCP URL", "VALIDATION_ERROR", 400)
        settings.INDMONEY_MCP_URL = url
        await asyncio.to_thread(update_env_setting, "INDMONEY_MCP_URL", url)
    if display_tool is not None:
        if display_tool and not _re.fullmatch(r"[a-z0-9_]{1,60}", display_tool):
            raise MCPError("Invalid display_tool name", "VALIDATION_ERROR", 400)
        settings.INDMONEY_DISPLAY_TOOL = display_tool or None
        await asyncio.to_thread(update_env_setting, "INDMONEY_DISPLAY_TOOL", display_tool)

    from .services.downstream import indmoney_client as _im
    _im._cache_expires = 0.0

    from .services.downstream.indmoney_client import test_connection
    result = await test_connection()
    result["url"] = settings.INDMONEY_MCP_URL
    result["display_tool"] = settings.INDMONEY_DISPLAY_TOOL
    result["oauth_configured"] = settings.is_indmoney_configured()
    return result


@app.get("/indmoney/data")
async def indmoney_data():
    """Call the configured display tool and return its text output."""
    tool = settings.INDMONEY_DISPLAY_TOOL
    if not tool:
        raise MCPError(
            "No IndMoney display tool configured. Open Settings → IndMoney to pick one.",
            "CONFIG_ERROR", 400
        )
    from .services.downstream.indmoney_client import call_tool as _indmoney_call
    try:
        content = await _indmoney_call(f"indmoney_{tool}", {})
        text = "\n".join(c.text for c in content if hasattr(c, "text"))
        return {"text": text}
    except MCPError:
        raise
    except Exception as exc:
        raise MCPError(sanitize_error(exc), "SERVICE_ERROR", 500) from exc


@app.get("/indmoney/overview")
async def indmoney_overview():
    """Return structured networth + SIP data for the dashboard card."""
    import json as _json
    from .services.downstream.indmoney_client import call_tool as _call

    async def _fetch(tool: str, args: dict = {}):
        try:
            content = await _call(f"indmoney_{tool}", args)
            text = "\n".join(c.text for c in content if hasattr(c, "text"))
            return _json.loads(text) if text.strip() else {}
        except Exception:
            return {}

    snapshot, stock_sips, mf_sips = await asyncio.gather(
        _fetch("networth_snapshot"),
        _fetch("indian_stocks_sips"),
        _fetch("mf_sips"),
    )

    return {
        "snapshot": snapshot,
        "stock_sips": stock_sips.get("indian_stocks_sips", []),
        "mf_sips": mf_sips.get("mf_sips", []),
    }


def _indmoney_success_html() -> str:
    dashboard_origin = settings.DASHBOARD_ORIGIN
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>IndMoney Connected</title>
  <style>
    body {{ background:#070a13; color:#f8fafc; font-family:system-ui,sans-serif;
           display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }}
    .box {{ background:rgba(17,24,39,.8); border:1px solid rgba(255,255,255,.08);
           border-radius:1rem; padding:2.5rem; max-width:420px; text-align:center; }}
    h2 {{ color:#2dd4bf; margin-bottom:.75rem; font-size:1.5rem; }}
    p  {{ color:#94a3b8; line-height:1.6; }}
    .icon {{ font-size:2.5rem; margin-bottom:1rem; }}
    .countdown {{ color:#2dd4bf; font-weight:600; }}
    button {{ margin-top:1.5rem; background:#2dd4bf; color:#070a13; border:none;
             border-radius:.5rem; padding:.6rem 1.5rem; font-size:.95rem;
             font-weight:700; cursor:pointer; }}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">✅</div>
    <h2>IndMoney Connected!</h2>
    <p>Authorization successful. Returning to dashboard in <span class="countdown" id="n">3</span>s…</p>
    <button onclick="goBack()">Go to Dashboard</button>
  </div>
  <script>
    var DASHBOARD_ORIGIN = {repr(dashboard_origin)};
    function notify() {{
      try {{ window.opener && window.opener.postMessage({{ type: 'indmoney_connected' }}, DASHBOARD_ORIGIN); }} catch(e) {{}}
    }}
    function goBack() {{
      notify();
      if (window.opener && !window.opener.closed) {{ window.opener.focus(); window.close(); }}
      else {{ window.location.href = DASHBOARD_ORIGIN; }}
    }}
    notify();
    let n = 3;
    const el = document.getElementById('n');
    const t = setInterval(() => {{
      n--;
      if (el) el.textContent = n;
      if (n <= 0) {{ clearInterval(t); goBack(); }}
    }}, 1000);
  </script>
</body>
</html>"""


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


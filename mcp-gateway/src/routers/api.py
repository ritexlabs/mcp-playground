"""REST data endpoints for the daily briefing dashboard proxy.

All routes are prefixed /api/ and require auth (enforced by the middleware
in main.py). These replace the tool calls that used to go via MCP SSE.
"""
import asyncio
import json
import re
import secrets as _secrets
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..config.secrets import update_env_setting
from ..config.settings import settings
from ..tools.calendar import handle_calendar_list_events
from ..tools.gmail import fetch_gmail_list, fetch_gmail_message, handle_gmail_list_latest
from ..tools.system import fetch_system_stats
from ..tools.stocks import handle_get_stocks
from ..tools.weather import handle_get_weather
from .tunnel import is_running as tunnel_running
from .whatsapp import _configured as wa_configured

router = APIRouter(prefix="/api", tags=["data"])


# ── Gateway status ────────────────────────────────────────────────────────────

@router.get("/status")
async def gateway_status():
    return {
        "connected":             True,
        "google_configured":     settings.is_google_configured(),
        "whatsapp_configured":   wa_configured(),
        "indmoney_configured":   settings.is_indmoney_configured(),
        "tunnel_running":        tunnel_running(),
        "gatewayUrl":            f"http://{settings.MCP_HOST}:{settings.MCP_PORT}",
        "timestamp":             datetime.utcnow().isoformat() + "Z",
    }


# ── Data endpoints ────────────────────────────────────────────────────────────

@router.get("/weather")
async def weather(location: str = "Bengaluru"):
    result = await handle_get_weather(location=location)
    return {"content": [{"type": "text", "text": result}], "isError": False}


@router.get("/calendar")
async def calendar(daysAhead: int = 1, maxResults: int = 15):
    result = await asyncio.to_thread(handle_calendar_list_events, maxResults, daysAhead)
    return {"content": [{"type": "text", "text": result}]}


@router.get("/system")
async def system_stats():
    try:
        result = await asyncio.to_thread(fetch_system_stats)
        return result
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.get("/gmail/config")
async def gmail_config_get():
    raw = settings.GMAIL_BLOCKED_SENDERS or ""
    entries = [e.strip() for e in raw.split(",") if e.strip()]
    return {"blockedSenders": entries}


@router.post("/gmail/config")
async def gmail_config_save(body: dict):
    entries: list[str] = body.get("blockedSenders", [])
    value = ",".join(e.strip() for e in entries if e.strip())
    settings.GMAIL_BLOCKED_SENDERS = value
    await asyncio.to_thread(update_env_setting, "GMAIL_BLOCKED_SENDERS", value)
    return {"ok": True}


@router.get("/gmail/message/{message_id}")
async def gmail_message(message_id: str):
    try:
        msg = await asyncio.to_thread(fetch_gmail_message, message_id)
        return msg
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.get("/gmail")
async def gmail(page: int = 1, pageSize: int = 20):
    blocked_str = settings.GMAIL_BLOCKED_SENDERS or ""
    blocked = [e.strip().lower() for e in blocked_str.split(",") if e.strip()]
    page = max(1, page)
    page_size = max(1, min(50, pageSize))
    try:
        result = await asyncio.to_thread(fetch_gmail_list, page_size, page, blocked)
        return result
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.get("/stocks")
async def stocks(symbols: str = ""):
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()] or None
    result   = await asyncio.to_thread(handle_get_stocks, sym_list)
    return {"content": [{"type": "text", "text": result}]}


@router.get("/celebrations")
async def celebrations():
    result    = await asyncio.to_thread(handle_calendar_list_events, 50, 2, "primary")
    text      = result or ""
    today_str = datetime.now().strftime("%Y-%m-%d")

    found = []
    for block in re.split(r"(?=•\s+\*\*)", text):
        tm = re.match(r"^•\s+\*\*(.+?)\*\*", block)
        if not tm:
            continue
        sm = re.search(r"\*\*Start:\*\*\s*([\d-]+)", block)
        if sm and sm.group(1)[:10] != today_str:
            continue
        title = tm.group(1).strip()
        tl    = title.lower()
        ctype = "birthday" if "birthday" in tl else ("anniversary" if "anniversary" in tl else None)
        if not ctype:
            continue
        sub = "work-anniversary" if "work" in tl else ("wedding-anniversary" if "wedding" in tl else ctype)
        name = re.sub(r"\b(happy|birthday|anniversary|work|wedding|celebration|day)\b", "", title, flags=re.IGNORECASE)
        name = re.sub(r"'s\s*", "", name)
        name = re.sub(r"[-–—:,!]", " ", name)
        name = re.sub(r"\s+", " ", name).strip() or "Friend"
        found.append({"name": name, "type": ctype, "subType": sub, "eventTitle": title})
    return found


# ── IndMoney ──────────────────────────────────────────────────────────────────

@router.get("/indmoney")
async def indmoney_data():
    tool = settings.INDMONEY_DISPLAY_TOOL
    if not tool:
        raise HTTPException(400, "No IndMoney display tool configured — open the Gateway Dashboard → IndMoney to pick one.")
    from ..services.downstream.indmoney_client import call_tool
    try:
        content = await call_tool(f"indmoney_{tool}", {})
        text    = "\n".join(c.text for c in content if hasattr(c, "text"))
        return {"text": text}
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.get("/indmoney/overview")
async def indmoney_overview():
    from ..services.downstream.indmoney_client import call_tool, test_connection

    async def _fetch(tool: str, args: dict = {}):
        try:
            content = await call_tool(f"indmoney_{tool}", args)
            text    = "\n".join(c.text for c in content if hasattr(c, "text"))
            return json.loads(text) if text.strip() else {}
        except Exception:
            return {}

    snapshot, stock_sips, mf_sips, mf_holdings, stock_holdings = await asyncio.gather(
        _fetch("networth_snapshot"),
        _fetch("indian_stocks_sips"),
        _fetch("mf_sips"),
        _fetch("networth_holdings", {"asset_type": "MF"}),
        _fetch("networth_holdings", {"asset_type": "IND_STOCK"}),
    )

    if not snapshot:
        conn = await test_connection()
        if not conn.get("connected"):
            err = conn.get("error", "")
            if "401" in err or "nauthorized" in err:
                return JSONResponse({"auth_required": True, "error": "IndMoney session expired"}, status_code=401)

    return {
        "snapshot":       snapshot,
        "stock_sips":     stock_sips.get("indian_stocks_sips", []),
        "mf_sips":        mf_sips.get("mf_sips", []),
        "mf_holdings":    mf_holdings.get("holdings", []),
        "stock_holdings": stock_holdings.get("holdings", []),
    }


@router.get("/indmoney/family")
async def indmoney_family():
    from ..services.downstream.indmoney_client import call_tool

    async def _fetch(tool: str, args: dict = {}):
        try:
            content = await call_tool(f"indmoney_{tool}", args)
            text    = "\n".join(c.text for c in content if hasattr(c, "text"))
            return json.loads(text) if text.strip() else {}
        except Exception:
            return {}

    holdings = await _fetch("networth_holdings")
    return {"holdings": holdings}


# ── Gateway API token management ──────────────────────────────────────────────

@router.get("/gateway/token")
async def gateway_token():
    token = settings.GATEWAY_API_TOKEN or ""
    return {
        "token":       token,
        "configured":  bool(token),
        "envLine":     f"GATEWAY_API_TOKEN={token}" if token else "",
    }


@router.post("/gateway/token/rotate")
async def gateway_token_rotate():
    new_token = _secrets.token_urlsafe(32)
    settings.GATEWAY_API_TOKEN = new_token
    await asyncio.to_thread(update_env_setting, "GATEWAY_API_TOKEN", new_token)
    return {
        "token":   new_token,
        "envLine": f"GATEWAY_API_TOKEN={new_token}",
    }


# ── Pass-through helper for gateway URL (needed by daily dashboard) ───────────

@router.get("/config/gateway-url")
async def config_gateway_url():
    return {"url": f"http://{settings.MCP_HOST}:{settings.MCP_PORT}"}

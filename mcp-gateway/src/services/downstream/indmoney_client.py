import asyncio
import time

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.types import TextContent, Tool

from ...config.settings import settings
from ...utils.errors import AuthenticationError, ConfigurationError, ServiceError

_TOOL_PREFIX = "indmoney_"
_tool_cache: list[Tool] = []
_cache_expires: float = 0.0
_CACHE_TTL = 300.0


def _get_url() -> str:
    url = settings.INDMONEY_MCP_URL
    if not url:
        raise ConfigurationError("INDMONEY_MCP_URL not set. Add it in Settings → IndMoney.")
    return url


_INDMONEY_TOKEN_ENDPOINT = "https://mcp.indmoney.com/token"


def _refresh_access_token(token_data: dict) -> dict:
    """Synchronously refresh using the refresh_token; stores updated token in keychain."""
    from ...config.secrets import store_indmoney_token

    resp = httpx.post(
        _INDMONEY_TOKEN_ENDPOINT,
        data={
            "grant_type": "refresh_token",
            "refresh_token": token_data["refresh_token"],
            "client_id": settings.INDMONEY_CLIENT_ID,
            "client_secret": settings.INDMONEY_CLIENT_SECRET,
        },
        timeout=10,
    )
    resp.raise_for_status()
    new_data = resp.json()

    # Preserve refresh_token when not returned (common for long-lived refresh tokens)
    if "refresh_token" not in new_data and "refresh_token" in token_data:
        new_data["refresh_token"] = token_data["refresh_token"]

    if "expires_in" in new_data and "expires_at" not in new_data:
        new_data["expires_at"] = time.time() + int(new_data["expires_in"])

    store_indmoney_token(new_data)
    return new_data


def _build_headers() -> dict[str, str]:
    from ...config.secrets import get_indmoney_token

    token_data = get_indmoney_token()
    if not token_data:
        return {}

    access_token = token_data.get("access_token")
    if not access_token:
        return {}

    # Refresh proactively if within 60 s of expiry
    expires_at = token_data.get("expires_at")
    if expires_at and time.time() > expires_at - 60:
        if token_data.get("refresh_token"):
            try:
                token_data = _refresh_access_token(token_data)
                access_token = token_data.get("access_token", access_token)
            except Exception:
                pass  # Proceed with stale token; downstream server will reject with 401

    return {"Authorization": f"Bearer {access_token}"}


def _unwrap(exc: Exception) -> Exception:
    """Extract the first real cause from an anyio ExceptionGroup."""
    if isinstance(exc, BaseExceptionGroup):
        for e in exc.exceptions:
            return _unwrap(e)
    return exc


async def list_tools(force: bool = False) -> list[Tool]:
    global _tool_cache, _cache_expires

    if not force and time.monotonic() < _cache_expires and _tool_cache:
        return _tool_cache

    try:
        url = _get_url()
        headers = _build_headers()
        async with streamablehttp_client(url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await asyncio.wait_for(session.initialize(), timeout=10)
                result = await asyncio.wait_for(session.list_tools(), timeout=10)
                tools = [
                    Tool(
                        name=f"{_TOOL_PREFIX}{t.name}",
                        description=f"[IndMoney] {t.description or t.name}",
                        inputSchema=t.inputSchema,
                    )
                    for t in result.tools
                ]
                _tool_cache = tools
                _cache_expires = time.monotonic() + _CACHE_TTL
                return tools
    except ConfigurationError:
        return []
    except TimeoutError as exc:
        raise ServiceError("indmoney", "connection timed out") from exc
    except Exception as exc:
        raise ServiceError("indmoney", str(exc)) from exc


async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if not name.startswith(_TOOL_PREFIX):
        raise ValueError(f"Not an IndMoney tool: {name}")

    original_name = name[len(_TOOL_PREFIX):]

    try:
        url = _get_url()
        headers = _build_headers()
        async with streamablehttp_client(url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await asyncio.wait_for(session.initialize(), timeout=10)
                result = await asyncio.wait_for(
                    session.call_tool(original_name, arguments), timeout=30
                )
                return list(result.content)
    except ConfigurationError:
        raise
    except TimeoutError as exc:
        raise ServiceError("indmoney", "request timed out") from exc
    except Exception as exc:
        raise ServiceError("indmoney", str(exc)) from exc


async def test_connection() -> dict:
    """Returns status dict for the settings UI."""
    from ...config.secrets import get_indmoney_token

    token_data = get_indmoney_token()
    auth_configured = bool(token_data and token_data.get("access_token"))

    try:
        url = _get_url()
        headers = _build_headers()
        async with streamablehttp_client(url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await asyncio.wait_for(session.initialize(), timeout=10)
                result = await asyncio.wait_for(session.list_tools(), timeout=10)
                names = [t.name for t in result.tools]
                # Refresh cache
                global _tool_cache, _cache_expires
                _tool_cache = [
                    Tool(
                        name=f"{_TOOL_PREFIX}{t.name}",
                        description=f"[IndMoney] {t.description or t.name}",
                        inputSchema=t.inputSchema,
                    )
                    for t in result.tools
                ]
                _cache_expires = time.monotonic() + _CACHE_TTL
                return {"connected": True, "tools": names, "auth_configured": auth_configured}
    except ConfigurationError as exc:
        return {"connected": False, "error": str(exc), "auth_configured": auth_configured}
    except Exception as exc:
        real = _unwrap(exc)
        return {"connected": False, "error": str(real), "auth_configured": auth_configured}

import json
import logging
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response

from ..config.secrets import update_env_setting
from ..config.settings import settings
from .tunnel import is_running as tunnel_running

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

# Webhook routes are kept on a separate router so auth middleware can skip them
# (Meta cannot send Bearer tokens in webhook callbacks)
webhook_router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp-webhook"])

WA_API_VERSION = "v21.0"
WA_API_BASE = f"https://graph.facebook.com/{WA_API_VERSION}"

_BASE_DIR = Path(__file__).parent.parent.parent
WA_MESSAGES_FILE = _BASE_DIR / ".whatsapp-messages.json"
WA_MAX_MESSAGES = 500

logger = logging.getLogger(__name__)


def _load() -> list:
    try:
        return json.loads(WA_MESSAGES_FILE.read_text())
    except Exception:
        return []


def _save(msgs: list) -> None:
    sorted_msgs = sorted(msgs, key=lambda m: -(m.get("timestamp") or 0))[:WA_MAX_MESSAGES]
    WA_MESSAGES_FILE.write_text(json.dumps(sorted_msgs, indent=2))


def _configured() -> bool:
    return bool(settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID and settings.WHATSAPP_VERIFY_TOKEN)


# ── Status & config ───────────────────────────────────────────────────────────

@router.get("/status")
async def whatsapp_status():
    raw = (settings.WHATSAPP_WEBHOOK_DOMAIN or "").replace("https://", "").replace("http://", "").rstrip("/")
    return {
        "configured": _configured(),
        "webhookUrl": f"https://{raw}/webhook/whatsapp" if raw else None,
        "hasDomain": bool(raw),
        "phoneNumberId": settings.WHATSAPP_PHONE_NUMBER_ID or None,
        "webhookDomain": settings.WHATSAPP_WEBHOOK_DOMAIN or None,
        "hasAccessToken": bool(settings.WHATSAPP_ACCESS_TOKEN),
        "hasVerifyToken": bool(settings.WHATSAPP_VERIFY_TOKEN),
    }


@router.post("/config")
async def whatsapp_config(body: dict):
    if "accessToken" in body:
        v = (body["accessToken"] or "").strip()
        settings.WHATSAPP_ACCESS_TOKEN = v or None
        update_env_setting("WHATSAPP_ACCESS_TOKEN", v)
    if "phoneNumberId" in body:
        v = (body["phoneNumberId"] or "").strip()
        settings.WHATSAPP_PHONE_NUMBER_ID = v or None
        update_env_setting("WHATSAPP_PHONE_NUMBER_ID", v)
    if "verifyToken" in body:
        v = (body["verifyToken"] or "").strip()
        settings.WHATSAPP_VERIFY_TOKEN = v or None
        update_env_setting("WHATSAPP_VERIFY_TOKEN", v)
    if "webhookDomain" in body:
        v = (body["webhookDomain"] or "").strip().replace("https://", "").replace("http://", "").rstrip("/")
        settings.WHATSAPP_WEBHOOK_DOMAIN = v or None
        update_env_setting("WHATSAPP_WEBHOOK_DOMAIN", v)

    raw = (settings.WHATSAPP_WEBHOOK_DOMAIN or "").replace("https://", "").replace("http://", "").rstrip("/")
    return {
        "ok": True,
        "configured": _configured(),
        "webhookUrl": f"https://{raw}/api/whatsapp/webhook" if raw else None,
    }


# ── Webhook (no auth — Meta cannot send Bearer tokens) ───────────────────────

def _verify_webhook(request: Request) -> Response:
    mode      = request.query_params.get("hub.mode")
    token     = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge", "")
    verify    = settings.WHATSAPP_VERIFY_TOKEN
    if mode == "subscribe" and verify and token == verify:
        return Response(content=challenge, media_type="text/plain")
    return Response(status_code=403)


@webhook_router.get("/webhook")
async def whatsapp_webhook_verify(request: Request):
    return _verify_webhook(request)


# Alias path: matches Meta callback URL https://whatsapp.robokingmaster.in/webhook/whatsapp
meta_webhook_router = APIRouter(tags=["whatsapp-webhook"])

@meta_webhook_router.get("/webhook/whatsapp")
async def meta_webhook_verify(request: Request):
    return _verify_webhook(request)

@meta_webhook_router.post("/webhook/whatsapp")
async def meta_webhook_receive(request: Request, bg: BackgroundTasks):
    return await whatsapp_webhook_receive(request, bg)


def _process(payload: dict) -> None:
    try:
        _run_process(payload)
    except Exception:
        logger.exception("WhatsApp webhook processing error")


def _run_process(payload: dict) -> None:
    if payload.get("object") != "whatsapp_business_account":
        return
    msgs    = _load()
    changed = False
    by_id   = {m["wa_message_id"]: m for m in msgs}

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value")
            if not value:
                continue
            contacts = {c["wa_id"]: c for c in value.get("contacts", [])}
            for msg in value.get("messages", []):
                msg_id   = msg.get("id", "")
                msg_type = msg.get("type", "")
                if not msg_id or msg_id in by_id:
                    continue
                if msg_type == "reaction":
                    continue
                if msg_type == "text":
                    text = msg.get("text", {}).get("body", "")
                elif msg_type in ("image", "audio", "video", "document", "sticker"):
                    text = f"[{msg_type.capitalize()}]"
                elif msg_type == "location":
                    loc  = msg.get("location", {})
                    text = f"[Location {loc.get('latitude', '')},{loc.get('longitude', '')}]"
                else:
                    text = f"[{msg_type}]" if msg_type else "[Message]"
                contact = contacts.get(msg.get("from", ""), {})
                record  = {
                    "wa_message_id":    msg_id,
                    "from_phone":       msg.get("from", ""),
                    "from_name":        contact.get("profile", {}).get("name"),
                    "body":             text,
                    "timestamp":        int(msg.get("timestamp", 0)),
                    "dashboard_status": "unread",
                    "wa_delivery":      None,
                    "reply_text":       None,
                    "reply_wa_id":      None,
                    "replied_at":       None,
                }
                msgs.append(record)
                by_id[msg_id] = record
                changed = True
                logger.info("stored wa msg id=%s type=%s from=%s", msg_id, msg_type, msg.get("from"))
            for status in value.get("statuses", []):
                st_id  = status.get("id", "")
                st_val = status.get("status", "")
                errors = status.get("errors", [])
                err_code = errors[0].get("code") if errors else None
                if st_val == "failed" and err_code:
                    logger.warning("delivery failed for %s: code=%s %s", st_id, err_code, errors[0].get("title", ""))
                for m in msgs:
                    # New outgoing records: match by wa_message_id
                    if m.get("direction") == "outgoing" and m.get("wa_message_id") == st_id:
                        if m.get("wa_delivery") != st_val:
                            m["wa_delivery"] = st_val
                            if err_code:
                                m["wa_delivery_error"] = err_code
                            changed = True
                    # Legacy incoming records with reply_wa_id (backward compat)
                    elif m.get("reply_wa_id") == st_id and m.get("wa_delivery") != st_val:
                        m["wa_delivery"] = st_val
                        if err_code:
                            m["wa_delivery_error"] = err_code
                        changed = True
    if changed:
        _save(msgs)


@webhook_router.post("/webhook")
async def whatsapp_webhook_receive(request: Request, bg: BackgroundTasks):
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=200)
    logger.debug("WhatsApp webhook payload: %s", json.dumps(body))
    bg.add_task(_process, body)
    return Response(status_code=200)


# ── Messages & replies ────────────────────────────────────────────────────────

@router.get("/messages")
async def whatsapp_messages():
    tr         = tunnel_running()
    configured = _configured()
    if not configured:
        return {"configured": False, "conversations": [], "totalUnread": 0, "tunnelRunning": tr}

    all_msgs: list = _load()
    by_phone: dict[str, list] = {}
    for msg in all_msgs:
        by_phone.setdefault(msg["from_phone"], []).append(msg)

    conversations = []
    for phone, messages in by_phone.items():
        sm = sorted(messages, key=lambda m: -(m.get("timestamp") or 0))
        conversations.append({
            "phone":          phone,
            "name":           next((m["from_name"] for m in sm if m.get("from_name")), None),
            "unread_count":   sum(1 for m in sm if m.get("dashboard_status") == "unread"),
            "last_timestamp": sm[0]["timestamp"] if sm else 0,
            "last_message":   sm[0].get("body", "") if sm else "",
            "messages":       sm,
        })

    conversations.sort(key=lambda c: -(c.get("last_timestamp") or 0))
    return {
        "configured":  True,
        "conversations": conversations,
        "totalUnread": sum(c["unread_count"] for c in conversations),
        "tunnelRunning": tr,
    }


@router.post("/reply")
async def whatsapp_reply(body: dict):
    to   = body.get("to") or ""
    text = (body.get("text") or "").strip()
    if not to or not text:
        raise HTTPException(400, "to and text are required")
    if not settings.WHATSAPP_ACCESS_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        raise HTTPException(500, "WhatsApp not configured")

    payload: dict = {
        "messaging_product": "whatsapp",
        "to":                to,
        "type":              "text",
        "text":              {"body": text},
    }
    if body.get("replyToMessageId"):
        payload["context"] = {"message_id": body["replyToMessageId"]}

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{WA_API_BASE}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        data = r.json()
        if not r.is_success:
            raise HTTPException(r.status_code, data.get("error", {}).get("message", "Send failed"))

    sent_id  = (data.get("messages") or [{}])[0].get("id")
    now      = int(time.time())
    msgs     = _load()

    # Store the outgoing message as its own record so every sent reply is
    # always visible, regardless of whether there are unreplied incoming messages.
    msgs.append({
        "wa_message_id":    sent_id,
        "from_phone":       to,
        "from_name":        None,
        "body":             text,
        "timestamp":        now,
        "direction":        "outgoing",
        "dashboard_status": "sent",
        "wa_delivery":      None,
    })

    # Mark all unreplied incoming messages from this contact as replied
    for m in msgs:
        if m["from_phone"] == to and m.get("direction") != "outgoing" and m.get("dashboard_status") not in ("replied", "read"):
            m["dashboard_status"] = "replied"
            m["replied_at"]       = now

    _save(msgs)
    return {"ok": True, "messageId": sent_id}


@router.post("/mark-read")
async def whatsapp_mark_read(body: dict):
    phone  = body.get("phone") or ""
    msg_id = body.get("lastMessageId")
    if not phone:
        raise HTTPException(400, "phone required")

    msgs = _load()
    for m in msgs:
        if m["from_phone"] == phone and m.get("dashboard_status") == "unread":
            m["dashboard_status"] = "read"
    _save(msgs)

    if msg_id and settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{WA_API_BASE}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
                    headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
                    json={"messaging_product": "whatsapp", "status": "read", "message_id": msg_id},
                    timeout=10,
                )
        except Exception:
            pass

    return {"ok": True}

import json
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
        "webhookUrl": f"https://{raw}/api/whatsapp/webhook" if raw else None,
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


def _process(body: dict) -> None:
    if body.get("object") != "whatsapp_business_account":
        return
    msgs    = _load()
    changed = False
    by_id   = {m["wa_message_id"]: m for m in msgs}

    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value")
            if not value:
                continue
            contacts = {c["wa_id"]: c for c in value.get("contacts", [])}
            for msg in value.get("messages", []):
                if msg.get("type") != "text" or msg["id"] in by_id:
                    continue
                contact = contacts.get(msg["from"], {})
                record  = {
                    "wa_message_id":    msg["id"],
                    "from_phone":       msg["from"],
                    "from_name":        contact.get("profile", {}).get("name"),
                    "body":             msg.get("text", {}).get("body", ""),
                    "timestamp":        int(msg.get("timestamp", 0)),
                    "dashboard_status": "unread",
                    "wa_delivery":      None,
                    "reply_text":       None,
                    "reply_wa_id":      None,
                    "replied_at":       None,
                }
                msgs.append(record)
                by_id[msg["id"]] = record
                changed = True
            for status in value.get("statuses", []):
                for m in msgs:
                    if m.get("reply_wa_id") == status["id"] and m.get("wa_delivery") != status["status"]:
                        m["wa_delivery"] = status["status"]
                        changed = True
    if changed:
        _save(msgs)


@webhook_router.post("/webhook")
async def whatsapp_webhook_receive(request: Request, bg: BackgroundTasks):
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=200)
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

    sent_id = (data.get("messages") or [{}])[0].get("id")
    msgs    = _load()
    to_upd  = sorted(
        [m for m in msgs if m["from_phone"] == to and m.get("dashboard_status") != "replied"],
        key=lambda m: -(m.get("timestamp") or 0),
    )
    first = True
    for m in to_upd:
        m["dashboard_status"] = "replied"
        m["replied_at"]       = int(time.time())
        if first:
            m["reply_text"]  = text
            m["reply_wa_id"] = sent_id
            first = False
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

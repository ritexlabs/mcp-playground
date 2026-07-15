import base64
import re

from ..services.google_client_factory import get_gmail_client


# ── Blocklist helpers ─────────────────────────────────────────────────────────

def _parse_blocked(blocked_str: str) -> list[str]:
    return [e.strip().lower() for e in blocked_str.split(",") if e.strip()]


def _is_blocked(from_header: str, blocked: list[str]) -> bool:
    lower = from_header.lower()
    m = re.search(r"<([^>]+)>", lower)
    email = m.group(1) if m else lower.strip()
    for entry in blocked:
        if entry.startswith("@"):
            if email.endswith(entry):
                return True
        else:
            if email == entry:
                return True
    return False


# ── Page token cache (module-level, reset on restart) ─────────────────────────

_page_token_cache: dict[int, str] = {}


def _get_page_token(page: int) -> str | None:
    if page <= 1:
        return None
    return _page_token_cache.get(page)


def _store_page_token(current_page: int, next_token: str | None) -> None:
    if next_token:
        _page_token_cache[current_page + 1] = next_token


# ── Structured fetch functions ────────────────────────────────────────────────

def fetch_gmail_list(
    max_results: int = 20,
    page: int = 1,
    blocked: list[str] | None = None,
) -> dict:
    """
    Fetch a paginated inbox list as structured JSON.
    Returns {"messages": [...], "nextPageToken": str|None, "totalUnread": int}
    Each message: {"id", "from", "subject", "snippet", "date", "isUnread"}
    """
    blocked = blocked or []
    service = get_gmail_client()

    page_token = _get_page_token(page)
    # Fetch extra to compensate for filtered-out blocked senders
    fetch_count = max_results + max(len(blocked) * 2, 10)
    kwargs: dict = {"userId": "me", "maxResults": fetch_count, "q": "label:INBOX"}
    if page_token:
        kwargs["pageToken"] = page_token

    result = service.users().messages().list(**kwargs).execute()
    raw_messages = result.get("messages", [])
    next_token = result.get("nextPageToken")
    _store_page_token(page, next_token)

    messages = []
    unread_count = 0
    for msg in raw_messages:
        detail = (
            service.users()
            .messages()
            .get(userId="me", id=msg["id"], format="metadata",
                 metadataHeaders=["From", "Subject", "Date"])
            .execute()
        )
        headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
        from_hdr = headers.get("From", "")
        if _is_blocked(from_hdr, blocked):
            continue
        label_ids = detail.get("labelIds", [])
        is_unread = "UNREAD" in label_ids
        if is_unread:
            unread_count += 1
        messages.append({
            "id":       msg["id"],
            "from":     from_hdr,
            "subject":  headers.get("Subject", "(no subject)"),
            "snippet":  detail.get("snippet", ""),
            "date":     headers.get("Date", ""),
            "isUnread": is_unread,
        })
        if len(messages) >= max_results:
            break

    return {
        "messages":      messages,
        "nextPageToken": next_token,
        "totalUnread":   unread_count,
    }


def fetch_gmail_message(message_id: str) -> dict:
    """
    Fetch a single message's full content.
    Returns {"id", "from", "to", "subject", "date", "body_text", "body_html"}
    """
    service = get_gmail_client()
    detail = service.users().messages().get(userId="me", id=message_id, format="full").execute()
    headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}

    body_text = ""
    body_html = ""

    def _extract(part: dict) -> None:
        nonlocal body_text, body_html
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data", "")
        if data:
            decoded = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            if mime == "text/plain" and not body_text:
                body_text = decoded
            elif mime == "text/html" and not body_html:
                body_html = decoded
        for sub in part.get("parts", []):
            _extract(sub)

    _extract(detail.get("payload", {}))

    return {
        "id":        message_id,
        "from":      headers.get("From", ""),
        "to":        headers.get("To", ""),
        "subject":   headers.get("Subject", "(no subject)"),
        "date":      headers.get("Date", ""),
        "body_text": body_text,
        "body_html": body_html,
    }


# ── Legacy MCP tool function (kept for main.py tool dispatch) ─────────────────

def handle_gmail_list_latest(max_results: int = 5) -> str:
    max_results = max(1, min(20, max_results))
    service = get_gmail_client()

    result = (
        service.users()
        .messages()
        .list(userId="me", maxResults=max_results, q="label:INBOX")
        .execute()
    )
    messages = result.get("messages", [])
    if not messages:
        return "Your inbox is empty!"

    lines = ["📬 Latest emails:\n"]
    for msg in messages:
        detail = service.users().messages().get(userId="me", id=msg["id"]).execute()
        headers = {
            h["name"]: h["value"]
            for h in detail.get("payload", {}).get("headers", [])
        }
        lines.append(
            f"• **From:** {headers.get('From', 'Unknown')}\n"
            f"  **Subject:** {headers.get('Subject', 'No Subject')}\n"
            f"  **Preview:** {detail.get('snippet', '')}\n"
        )
    return "\n".join(lines)

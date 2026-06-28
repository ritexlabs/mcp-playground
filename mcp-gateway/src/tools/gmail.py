from ..services.google_client_factory import get_gmail_client


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

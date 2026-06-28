from datetime import datetime, timedelta, timezone

from ..services.google_client_factory import get_calendar_client


def handle_calendar_list_events(
    max_results: int = 10,
    days_ahead: int = 7,
    calendar_id: str = "primary",
) -> str:
    max_results = max(1, min(50, max_results))
    days_ahead = max(1, min(90, days_ahead))

    service = get_calendar_client()
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days_ahead)

    result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=now.isoformat(),
            timeMax=end.isoformat(),
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events = result.get("items", [])
    if not events:
        return f"No events scheduled for the next {days_ahead} days"

    lines = [f"📅 Upcoming events (next {days_ahead} days):\n"]
    for event in events:
        title = event.get("summary", "Untitled Event")
        start = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date", "Unknown")
        end_t = event.get("end", {}).get("dateTime") or event.get("end", {}).get("date", "Unknown")
        location = f"\n  **Location:** {event['location']}" if event.get("location") else ""
        desc = event.get("description", "")
        description = (
            f"\n  **Description:** {desc[:100]}{'...' if len(desc) > 100 else ''}" if desc else ""
        )
        lines.append(
            f"• **{title}**\n  **Start:** {start}\n  **End:** {end_t}{location}{description}\n"
        )
    return "\n".join(lines)

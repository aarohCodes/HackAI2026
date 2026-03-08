"""Google Calendar integration: fetch events, find free slots, create study events."""
import logging
from datetime import datetime, timedelta
from typing import Optional

from services.google_oauth_service import get_calendar_service

logger = logging.getLogger(__name__)


async def get_events(user, start: datetime, end: datetime) -> list[dict]:
    """Fetch all events from the user's primary Google Calendar in a date range."""
    service = await get_calendar_service(user)
    if not service:
        return []

    try:
        events_result = service.events().list(
            calendarId="primary",
            timeMin=start.isoformat() + "Z",
            timeMax=end.isoformat() + "Z",
            singleEvents=True,
            orderBy="startTime",
            maxResults=250,
        ).execute()

        events = []
        for item in events_result.get("items", []):
            start_dt = item.get("start", {})
            end_dt = item.get("end", {})
            events.append({
                "id": item.get("id"),
                "summary": item.get("summary", "(No title)"),
                "start": start_dt.get("dateTime") or start_dt.get("date"),
                "end": end_dt.get("dateTime") or end_dt.get("date"),
                "all_day": "date" in start_dt and "dateTime" not in start_dt,
                "color": item.get("colorId"),
                "description": item.get("description", ""),
            })
        return events
    except Exception as e:
        logger.error("Failed to fetch Google Calendar events: %s", e)
        return []


async def get_free_busy(user, start: datetime, end: datetime) -> list[dict]:
    """Get busy time blocks from Google Calendar FreeBusy API."""
    service = await get_calendar_service(user)
    if not service:
        return []

    try:
        body = {
            "timeMin": start.isoformat() + "Z",
            "timeMax": end.isoformat() + "Z",
            "items": [{"id": "primary"}],
        }
        result = service.freebusy().query(body=body).execute()
        busy = result.get("calendars", {}).get("primary", {}).get("busy", [])
        return [{"start": b["start"], "end": b["end"]} for b in busy]
    except Exception as e:
        logger.error("Failed to get free/busy: %s", e)
        return []


def find_free_slots(
    busy_blocks: list[dict],
    start: datetime,
    end: datetime,
    min_duration_minutes: int = 30,
) -> list[dict]:
    """Compute available time windows from busy blocks.
    Only considers hours between 8am and 10pm."""
    from datetime import time as dt_time

    # Parse busy blocks into datetime pairs
    busy = []
    for b in busy_blocks:
        bs = b["start"] if isinstance(b["start"], datetime) else datetime.fromisoformat(b["start"].replace("Z", "+00:00")).replace(tzinfo=None)
        be = b["end"] if isinstance(b["end"], datetime) else datetime.fromisoformat(b["end"].replace("Z", "+00:00")).replace(tzinfo=None)
        busy.append((bs, be))
    busy.sort(key=lambda x: x[0])

    slots = []
    current = start

    for busy_start, busy_end in busy:
        if current < busy_start:
            # There's a gap before this busy block
            gap_start = current
            gap_end = busy_start
            # Clip to reasonable hours (8am-10pm)
            _add_reasonable_slots(slots, gap_start, gap_end, min_duration_minutes)
        current = max(current, busy_end)

    # Gap after last busy block
    if current < end:
        _add_reasonable_slots(slots, current, end, min_duration_minutes)

    return slots


def _add_reasonable_slots(slots, gap_start, gap_end, min_duration_minutes):
    """Add slots within 8am-10pm range from a gap."""
    day = gap_start.date()
    end_day = gap_end.date()

    current_day = day
    while current_day <= end_day:
        day_start = max(gap_start, datetime.combine(current_day, datetime.min.time().replace(hour=8)))
        day_end = min(gap_end, datetime.combine(current_day, datetime.min.time().replace(hour=22)))

        if day_end > day_start and (day_end - day_start).total_seconds() >= min_duration_minutes * 60:
            slots.append({
                "start": day_start.isoformat(),
                "end": day_end.isoformat(),
                "duration_minutes": int((day_end - day_start).total_seconds() / 60),
            })
        current_day += timedelta(days=1)


async def create_study_event(
    user, title: str, start: datetime, end: datetime, description: str = ""
) -> Optional[str]:
    """Create a study event on the user's Google Calendar. Returns the event ID."""
    service = await get_calendar_service(user)
    if not service:
        return None

    try:
        event = {
            "summary": f"[CogniPath] {title}",
            "description": description,
            "start": {"dateTime": start.isoformat() + "Z", "timeZone": "UTC"},
            "end": {"dateTime": end.isoformat() + "Z", "timeZone": "UTC"},
            "colorId": "1",  # Lavender
        }
        created = service.events().insert(calendarId="primary", body=event).execute()
        return created.get("id")
    except Exception as e:
        logger.error("Failed to create Google Calendar event: %s", e)
        return None

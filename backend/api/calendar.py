from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from database.models import User, Hub, ConceptNode, StudyPlan, StudySession
from services.calendar_service import get_events, get_free_busy, find_free_slots, create_study_event
from services.gemini_service import generate_study_schedule
from api.deps import get_current_user
from beanie import PydanticObjectId
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/events")
async def list_calendar_events(
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Fetch real Google Calendar events for display."""
    if not current_user.google_calendar_connected:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    now = datetime.utcnow()
    # Default to current week (Monday to Sunday)
    if start:
        start_dt = datetime.fromisoformat(start)
    else:
        start_dt = now - timedelta(days=now.weekday())
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)

    if end:
        end_dt = datetime.fromisoformat(end)
    else:
        end_dt = start_dt + timedelta(days=7)

    events = await get_events(current_user, start_dt, end_dt)
    return {"events": events}


class ScheduleRequest(BaseModel):
    hours_per_week: float = 2.0
    hub_ids: list[str] = []
    week_start: Optional[str] = None  # ISO date string


@router.post("/schedule")
async def generate_schedule(
    req: ScheduleRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a study schedule using Gemini + Google Calendar free slots."""
    if not current_user.google_calendar_connected:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    uid = current_user.id
    now = datetime.utcnow()

    # Determine week range
    if req.week_start:
        week_start = datetime.fromisoformat(req.week_start)
    else:
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    # Get busy blocks from Google Calendar
    busy_blocks = await get_free_busy(current_user, week_start, week_end)
    free_slots = find_free_slots(busy_blocks, week_start, week_end, min_duration_minutes=30)

    # Gather concepts from selected hubs (or all hubs if none specified)
    if req.hub_ids:
        hub_oids = [PydanticObjectId(hid) for hid in req.hub_ids]
        nodes = await ConceptNode.find(
            ConceptNode.user_id == uid,
            {"hub_id": {"$in": hub_oids}},
        ).to_list()
    else:
        nodes = await ConceptNode.find(ConceptNode.user_id == uid).to_list()

    hub_concepts = []
    for n in nodes:
        hub_concepts.append({
            "concept": n.concept,
            "hub_id": str(n.hub_id) if n.hub_id else None,
            "node_id": str(n.id),
            "state": n.state.value,
            "retention": n.retention_rt,
            "mastery": n.mastery_score,
        })

    # Sort by retention ascending (most urgent first)
    hub_concepts.sort(key=lambda x: x["retention"])

    # Call Gemini to generate schedule
    result = generate_study_schedule(free_slots, hub_concepts, req.hours_per_week)

    if not result or "sessions" not in result:
        raise HTTPException(status_code=502, detail="Failed to generate study schedule")

    # Create study events on Google Calendar and build StudyPlan
    sessions = []
    for s in result["sessions"]:
        start_time = datetime.fromisoformat(s["start_iso"])
        end_time = datetime.fromisoformat(s["end_iso"])

        # Write to Google Calendar
        event_id = await create_study_event(
            current_user,
            title=f"Study: {s['concept']}",
            start=start_time,
            end=end_time,
            description=f"Activity: {s.get('activity_type', 'review')}\nReason: {s.get('reason', '')}",
        )

        sessions.append(StudySession(
            concept=s["concept"],
            hub_id=s.get("hub_id"),
            node_id=s.get("node_id"),
            start_time=start_time,
            end_time=end_time,
            activity_type=s.get("activity_type", "review"),
            reason=s.get("reason", ""),
            google_event_id=event_id,
        ))

    # Save the study plan
    plan = StudyPlan(
        user_id=uid,
        week_start=week_start,
        sessions=sessions,
        hours_per_week=req.hours_per_week,
        hub_ids=req.hub_ids,
        created_at=datetime.utcnow(),
    )
    await plan.insert()

    logger.info("Generated study plan for user %s: %d sessions", uid, len(sessions))

    return {
        "plan_id": str(plan.id),
        "sessions": [
            {
                "concept": s.concept,
                "hub_id": s.hub_id,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "activity_type": s.activity_type,
                "reason": s.reason,
                "google_event_id": s.google_event_id,
            }
            for s in sessions
        ],
    }


@router.get("/plan")
async def get_plan(
    week_start: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get the latest study plan for the current week."""
    uid = current_user.id

    if week_start:
        ws = datetime.fromisoformat(week_start)
        plan = await StudyPlan.find_one(
            StudyPlan.user_id == uid,
            StudyPlan.week_start == ws,
        )
    else:
        plans = await StudyPlan.find(
            StudyPlan.user_id == uid,
        ).sort("-created_at").limit(1).to_list()
        plan = plans[0] if plans else None

    if not plan:
        return {"plan": None}

    return {
        "plan": {
            "id": str(plan.id),
            "week_start": plan.week_start.isoformat(),
            "hours_per_week": plan.hours_per_week,
            "hub_ids": plan.hub_ids,
            "sessions": [
                {
                    "concept": s.concept,
                    "hub_id": s.hub_id,
                    "start_time": s.start_time.isoformat(),
                    "end_time": s.end_time.isoformat(),
                    "activity_type": s.activity_type,
                    "reason": s.reason,
                    "google_event_id": s.google_event_id,
                    "completed": s.completed,
                }
                for s in plan.sessions
            ],
        },
    }


@router.delete("/disconnect")
async def disconnect_calendar(current_user: User = Depends(get_current_user)):
    """Remove Google Calendar tokens (keeps Google auth for login)."""
    current_user.google_access_token = None
    current_user.google_refresh_token = None
    current_user.google_token_expiry = None
    current_user.google_calendar_connected = False
    await current_user.save()
    return {"status": "ok", "message": "Google Calendar disconnected"}

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from services.youtube_service import find_snippet
from database.models import User, Recommendation
from api.deps import get_current_user
from beanie import PydanticObjectId

router = APIRouter()


class SnippetRequest(BaseModel):
    concept: str
    gap_description: str
    youtube_query: str
    timestamp_hint: str = ""
    recommendation_id: Optional[str] = None


@router.post("/snippet")
async def get_youtube_snippet(req: SnippetRequest, current_user: User = Depends(get_current_user)):
    result = find_snippet(
        concept=req.concept,
        gap_description=req.gap_description,
        youtube_query=req.youtube_query,
        timestamp_hint=req.timestamp_hint,
    )

    if result is None:
        return {"snippet": None, "message": "No snippet available"}

    if req.recommendation_id:
        rec = await Recommendation.get(PydanticObjectId(req.recommendation_id))
        if rec:
            rec.youtube_video_id = result.get("video_id")
            rec.youtube_title = result.get("title")
            rec.timestamp_start = result.get("start_seconds")
            rec.timestamp_end = result.get("end_seconds")
            rec.snippet_reason = result.get("snippet_reason")
            await rec.save()

    return {"snippet": result}

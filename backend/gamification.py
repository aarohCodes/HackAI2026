from fastapi import APIRouter, HTTPException, Depends
from database.models import User
from services.gamification_service import (
    get_user_stats,
    update_streak,
    check_achievements,
    get_leaderboard,
    ACHIEVEMENT_DEFINITIONS,
)
from deps import get_current_user

router = APIRouter()


@router.get("/stats")
async def gamification_stats(current_user: User = Depends(get_current_user)):
    stats = await get_user_stats(current_user.id)
    if "error" in stats:
        raise HTTPException(status_code=404, detail=stats["error"])
    return stats


@router.post("/claim-daily")
async def claim_daily_bonus(current_user: User = Depends(get_current_user)):
    result = await update_streak(current_user.id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/achievements")
async def get_achievements(current_user: User = Depends(get_current_user)):
    all_achievements = []
    for defn in ACHIEVEMENT_DEFINITIONS:
        all_achievements.append(
            {
                **defn,
                "unlocked": defn["key"] in current_user.achievements,
            }
        )

    newly = await check_achievements(current_user.id)

    return {
        "achievements": all_achievements,
        "newly_unlocked": newly,
    }


@router.get("/leaderboard")
async def leaderboard():
    return {"leaderboard": await get_leaderboard(limit=10)}

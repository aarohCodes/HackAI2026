from database.models import User, LearningEvent, Achievement
from beanie import PydanticObjectId
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

XP_AWARDS = {
    "view": 20,
    "rewatch": 15,
    "practice": 60,
    "feynman": 120,
    "socratic_round": 150,
    "socratic_complete": 450,
    "snapshot": 80,
    "search": 10,
    "daily_login": 25,
    "external_visit": 5,
}

LEVEL_THRESHOLDS = [
    (1, 0, "Novice"),
    (2, 100, "Novice"),
    (3, 250, "Novice"),
    (4, 450, "Novice"),
    (5, 700, "Novice"),
    (6, 1001, "Explorer"),
    (7, 1400, "Explorer"),
    (8, 1900, "Explorer"),
    (9, 2500, "Explorer"),
    (10, 3000, "Explorer"),
    (11, 3500, "Pathfinder"),
    (12, 4200, "Pathfinder"),
    (13, 5000, "Pathfinder"),
    (14, 5900, "Pathfinder"),
    (15, 6900, "Pathfinder"),
    (16, 8001, "Pathfinder"),
    (17, 9200, "Pathfinder"),
    (18, 10500, "Pathfinder"),
    (19, 12000, "Pathfinder"),
    (20, 13500, "Pathfinder"),
    (21, 15000, "Scholar"),
    (25, 18001, "Scholar"),
    (30, 24000, "Scholar"),
    (31, 26000, "Master"),
    (35, 30000, "Master"),
    (40, 35001, "Master"),
    (41, 38000, "Sage"),
    (45, 45000, "Sage"),
    (50, 60000, "Sage"),
]


def compute_level(total_xp: int) -> tuple[int, str]:
    """Return (level, title) for a given XP total."""
    level, title = 1, "Novice"
    for lvl, threshold, ttl in LEVEL_THRESHOLDS:
        if total_xp >= threshold:
            level, title = lvl, ttl
        else:
            break
    return level, title


def xp_for_next_level(total_xp: int) -> dict:
    """Return current level XP range for progress bar."""
    current_threshold = 0
    next_threshold = 100
    for i, (lvl, threshold, _) in enumerate(LEVEL_THRESHOLDS):
        if total_xp >= threshold:
            current_threshold = threshold
            if i + 1 < len(LEVEL_THRESHOLDS):
                next_threshold = LEVEL_THRESHOLDS[i + 1][1]
            else:
                next_threshold = threshold + 5000
        else:
            break

    return {
        "current_threshold": current_threshold,
        "next_threshold": next_threshold,
        "xp_in_level": total_xp - current_threshold,
        "xp_needed": next_threshold - current_threshold,
    }


async def award_xp(user_id: PydanticObjectId, event_type: str) -> dict:
    """Award XP for an action, update level, return XP gain info."""
    user = await User.get(user_id)
    if not user:
        return {"error": "User not found"}

    base_xp = XP_AWARDS.get(event_type, 10)
    streak_bonus = min(user.streak_days, 30) * 2
    total_award = base_xp + streak_bonus

    user.xp += total_award
    user.daily_xp += total_award

    new_level, new_title = compute_level(user.xp)
    leveled_up = new_level > user.level
    user.level = new_level
    user.level_title = new_title

    await user.save()

    return {
        "xp_gained": total_award,
        "base_xp": base_xp,
        "streak_bonus": streak_bonus,
        "total_xp": user.xp,
        "level": user.level,
        "level_title": user.level_title,
        "leveled_up": leveled_up,
    }


async def update_streak(user_id: PydanticObjectId) -> dict:
    """Check and update daily streak."""
    user = await User.get(user_id)
    if not user:
        return {"error": "User not found"}

    today = datetime.utcnow().date()

    if user.last_active_date:
        last_date = user.last_active_date.date()
        if last_date == today:
            return {"streak_days": user.streak_days, "already_claimed": True}
        elif last_date == today - timedelta(days=1):
            user.streak_days += 1
        else:
            user.streak_days = 1
    else:
        user.streak_days = 1

    user.last_active_date = datetime.utcnow()
    user.daily_xp = 0

    login_xp = XP_AWARDS["daily_login"] + (user.streak_days * 10)
    user.xp += login_xp
    user.daily_xp += login_xp

    new_level, new_title = compute_level(user.xp)
    user.level = new_level
    user.level_title = new_title

    await user.save()

    return {
        "streak_days": user.streak_days,
        "xp_gained": login_xp,
        "total_xp": user.xp,
        "already_claimed": False,
    }


ACHIEVEMENT_DEFINITIONS = [
    {"key": "first_steps", "name": "First Steps", "description": "Complete your first learning event", "icon": "🚀", "condition": "events >= 1", "xp_reward": 50, "rarity": "common"},
    {"key": "feynman_apprentice", "name": "Feynman Apprentice", "description": "Complete 5 Feynman challenges", "icon": "🎤", "condition": "feynman_count >= 5", "xp_reward": 200, "rarity": "rare"},
    {"key": "debate_champion", "name": "Debate Champion", "description": "Complete 10 Socratic debates", "icon": "⚔️", "condition": "socratic_count >= 10", "xp_reward": 500, "rarity": "epic"},
    {"key": "streak_fire", "name": "Streak Fire", "description": "Maintain a 7-day streak", "icon": "🔥", "condition": "streak >= 7", "xp_reward": 300, "rarity": "rare"},
    {"key": "decay_slayer", "name": "Decay Slayer", "description": "Recover 5 fading concepts", "icon": "🛡️", "condition": "recovered >= 5", "xp_reward": 400, "rarity": "epic"},
    {"key": "graph_explorer", "name": "Graph Explorer", "description": "Unlock 20 concept nodes", "icon": "🗺️", "condition": "nodes >= 20", "xp_reward": 250, "rarity": "rare"},
    {"key": "speed_demon", "name": "Speed Demon", "description": "Complete 3 Quick Snapshots in under 90 seconds", "icon": "⚡", "condition": "fast_snapshots >= 3", "xp_reward": 350, "rarity": "epic"},
    {"key": "knowledge_keeper", "name": "Knowledge Keeper", "description": "Maintain 90%+ retention for 7 days", "icon": "👑", "condition": "high_retention_days >= 7", "xp_reward": 1000, "rarity": "legendary"},
]


async def check_achievements(user_id: PydanticObjectId) -> list[dict]:
    """Check for newly unlocked achievements."""
    user = await User.get(user_id)
    if not user:
        return []

    events = await LearningEvent.find(LearningEvent.user_id == user_id).to_list()

    stats = {
        "events": len(events),
        "feynman_count": sum(1 for e in events if e.event_type == "feynman"),
        "socratic_count": sum(1 for e in events if e.event_type in ("socratic_round", "socratic_complete")),
        "streak": user.streak_days,
        "nodes": 0,
        "recovered": 0,
        "fast_snapshots": 0,
        "high_retention_days": 0,
    }

    from database.models import ConceptNode, NodeState
    nodes = await ConceptNode.find(ConceptNode.user_id == user_id).to_list()
    stats["nodes"] = sum(1 for n in nodes if n.state != NodeState.RED)

    newly_unlocked = []
    for defn in ACHIEVEMENT_DEFINITIONS:
        if defn["key"] in user.achievements:
            continue

        condition = defn["condition"]
        field, _, threshold = condition.partition(" >= ")
        try:
            if stats.get(field.strip(), 0) >= int(threshold.strip()):
                user.achievements.append(defn["key"])
                user.xp += defn["xp_reward"]
                newly_unlocked.append(defn)
        except (ValueError, KeyError):
            continue

    if newly_unlocked:
        new_level, new_title = compute_level(user.xp)
        user.level = new_level
        user.level_title = new_title
        await user.save()

    return newly_unlocked


async def get_user_stats(user_id: PydanticObjectId) -> dict:
    """Get full gamification stats for a user."""
    user = await User.get(user_id)
    if not user:
        return {"error": "User not found"}

    events = await LearningEvent.find(LearningEvent.user_id == user_id).to_list()
    level_progress = xp_for_next_level(user.xp)

    return {
        "xp": user.xp,
        "level": user.level,
        "level_title": user.level_title,
        "streak_days": user.streak_days,
        "daily_xp": user.daily_xp,
        "daily_xp_goal": user.daily_xp_goal,
        "daily_progress_pct": min(100, round(user.daily_xp / max(user.daily_xp_goal, 1) * 100)),
        "total_events": len(events),
        "achievements": user.achievements,
        "level_progress": level_progress,
        "skill_points": user.skill_points,
    }


async def get_leaderboard(limit: int = 10) -> list[dict]:
    """Top users by XP."""
    users = await User.find_all().sort("-xp").limit(limit).to_list()
    return [
        {
            "name": u.name,
            "xp": u.xp,
            "level": u.level,
            "level_title": u.level_title,
            "streak_days": u.streak_days,
        }
        for u in users
    ]

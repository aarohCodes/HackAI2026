from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database.models import User, ConceptNode, KnowledgeEdge, NodeState
from services.gemini_service import generate_onboarding_graph
from services.gamification_service import get_user_stats
from api.deps import get_current_user
from beanie import PydanticObjectId
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class OnboardRequest(BaseModel):
    goal: str
    background: str
    prior_history: Optional[str] = None
    learner_type: str = "gradual"


@router.post("/onboard")
async def onboard_user(req: OnboardRequest, current_user: User = Depends(get_current_user)):
    """Complete onboarding for the authenticated user — sets goal/background and generates knowledge graph."""
    if current_user.goal:
        raise HTTPException(status_code=400, detail="User has already onboarded")

    current_user.goal = req.goal
    current_user.background = req.background
    current_user.prior_history = req.prior_history
    current_user.learner_type = req.learner_type
    await current_user.save()

    logger.info("Generating onboarding graph for user %s — goal: %s", current_user.id, req.goal)

    try:
        graph_data = generate_onboarding_graph(
            goal=req.goal,
            background=req.background,
            prior_history=req.prior_history or "",
        )
    except Exception as exc:
        logger.error("Gemini onboarding call crashed: %s", exc)
        graph_data = None

    nodes_created = []
    edges_created = 0
    concept_to_id = {}
    is_fallback = False

    if graph_data and "nodes" in graph_data and len(graph_data["nodes"]) > 0:
        is_fallback = graph_data.get("_fallback", False)
        for n in graph_data["nodes"]:
            state_str = n.get("state", "red")
            try:
                state = NodeState(state_str)
            except ValueError:
                state = NodeState.RED

            node = ConceptNode(
                user_id=current_user.id,
                concept=n["concept"],
                domain=n.get("domain", "general"),
                complexity_tier=n.get("complexity_tier", 1),
                dependency_depth=n.get("dependency_depth", 0),
                state=state,
                mastery_score=1.0 if state == NodeState.GREEN else (0.5 if state == NodeState.YELLOW else 0.0),
                retention_rt=1.0 if state == NodeState.GREEN else (0.7 if state == NodeState.YELLOW else 0.0),
                canvas_x=n.get("canvas_x", 0),
                canvas_y=n.get("canvas_y", 0),
                created_at=datetime.utcnow(),
            )
            await node.insert()
            nodes_created.append(node)
            concept_to_id[n["concept"].lower()] = node.id

        for e in graph_data.get("edges", []):
            from_id = concept_to_id.get(e["from"].lower())
            to_id = concept_to_id.get(e["to"].lower())
            if from_id and to_id:
                edge = KnowledgeEdge(
                    user_id=current_user.id,
                    from_node_id=from_id,
                    to_node_id=to_id,
                    edge_type=e.get("type", "prerequisite"),
                )
                await edge.insert()
                edges_created += 1

    logger.info("Onboarding complete for user %s: %d nodes, %d edges%s",
                current_user.id, len(nodes_created), edges_created,
                " (fallback)" if is_fallback else "")

    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "level": current_user.level,
            "level_title": current_user.level_title,
        },
        "nodes_created": len(nodes_created),
        "is_fallback": is_fallback,
    }


@router.get("/me")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get the authenticated user's full profile + gamification stats."""
    stats = await get_user_stats(current_user.id)

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "goal": current_user.goal,
        "background": current_user.background,
        "learner_type": current_user.learner_type,
        "created_at": current_user.created_at.isoformat(),
        "gamification": stats,
    }


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Get a user by ID — only allowed if it's the current user."""
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    stats = await get_user_stats(current_user.id)

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "goal": current_user.goal,
        "background": current_user.background,
        "learner_type": current_user.learner_type,
        "created_at": current_user.created_at.isoformat(),
        "gamification": stats,
    }

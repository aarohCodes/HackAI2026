from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database.models import (
    User, ConceptNode, KnowledgeEdge, LearningEvent,
    Recommendation, NodeState, CanvasSnapshot, NodeSnapshot,
)
from services.gamification_service import award_xp, check_achievements
from services.gemini_service import generate_topic_nodes
from deps import get_current_user
from beanie import PydanticObjectId
from db import past_learning_col
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class EventRequest(BaseModel):
    node_id: str
    event_type: str
    duration_seconds: int = 0
    success: Optional[bool] = None
    confidence_before: Optional[float] = None
    confidence_after: Optional[float] = None
    source: str = "inapp"
    metadata: Optional[dict] = None


class PositionUpdate(BaseModel):
    x: float
    y: float


@router.get("/canvas")
async def get_canvas_state(current_user: User = Depends(get_current_user)):
    uid = current_user.id
    nodes = await ConceptNode.find(ConceptNode.user_id == uid).to_list()
    edges = await KnowledgeEdge.find(KnowledgeEdge.user_id == uid).to_list()

    node_recs = {}
    for node in nodes:
        if node.state in (NodeState.FADING, NodeState.GLOW):
            rec = await Recommendation.find_one(
                Recommendation.node_id == node.id,
                Recommendation.dismissed == False,
            )
            if rec:
                node_recs[str(node.id)] = {
                    "id": str(rec.id),
                    "gemini_reasoning": rec.gemini_reasoning,
                    "practice_scenario": rec.practice_scenario,
                    "youtube_video_id": rec.youtube_video_id,
                    "youtube_title": rec.youtube_title,
                    "timestamp_start": rec.timestamp_start,
                    "timestamp_end": rec.timestamp_end,
                    "snippet_reason": rec.snippet_reason,
                    "learning_mode": rec.learning_mode.value if rec.learning_mode else None,
                }

    return {
        "nodes": [
            {
                "id": str(n.id),
                "concept": n.concept,
                "domain": n.domain,
                "state": n.state.value,
                "mode": n.mode.value if n.mode else None,
                "complexity_tier": n.complexity_tier,
                "dependency_depth": n.dependency_depth,
                "mastery_score": n.mastery_score,
                "retention_rt": n.retention_rt,
                "review_count": n.review_count,
                "canvas_x": n.canvas_x,
                "canvas_y": n.canvas_y,
                "active_recommendation": node_recs.get(str(n.id)),
            }
            for n in nodes
        ],
        "edges": [
            {
                "from_node_id": str(e.from_node_id),
                "to_node_id": str(e.to_node_id),
                "edge_type": e.edge_type,
            }
            for e in edges
        ],
    }


@router.post("/event")
async def log_learning_event(req: EventRequest, current_user: User = Depends(get_current_user)):
    uid = current_user.id
    nid = PydanticObjectId(req.node_id)

    node = await ConceptNode.get(nid)
    if not node or node.user_id != uid:
        raise HTTPException(status_code=404, detail="Node not found")

    xp_result = await award_xp(uid, req.event_type)

    event = LearningEvent(
        user_id=uid,
        node_id=nid,
        event_type=req.event_type,
        duration_seconds=req.duration_seconds,
        success=req.success,
        confidence_before=req.confidence_before,
        confidence_after=req.confidence_after,
        source=req.source,
        metadata=req.metadata,
        xp_earned=xp_result.get("xp_gained", 0),
        created_at=datetime.utcnow(),
    )
    await event.insert()

    node.review_count += 1
    node.last_reviewed = datetime.utcnow()
    if req.event_type in ("view", "practice", "feynman", "complete") and node.state == NodeState.RED:
        node.state = NodeState.YELLOW
    if req.event_type == "complete":
        node.state = NodeState.GREEN
        node.mastery_score = max(node.mastery_score, 0.85)
        node.retention_rt = max(node.retention_rt, 0.9)
    await node.save()

    try:
        past_learning_col.update_one(
            {"user_id": str(uid), "topic": node.concept},
            {"$set": {
                "user_id": str(uid),
                "topic": node.concept,
                "domain": node.domain,
                "progress": int(node.mastery_score * 100),
                "score": int(node.retention_rt * 100),
                "state": node.state.value,
                "review_count": node.review_count,
            }},
            upsert=True,
        )
    except Exception:
        logger.warning("Failed to upsert past_learning for %s", node.concept)

    new_achievements = await check_achievements(uid)

    return {
        "event_id": str(event.id),
        "xp": xp_result,
        "new_achievements": new_achievements,
    }


@router.patch("/node/{node_id}/position")
async def update_node_position(node_id: str, pos: PositionUpdate, current_user: User = Depends(get_current_user)):
    node = await ConceptNode.get(PydanticObjectId(node_id))
    if not node or node.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Node not found")

    node.canvas_x = pos.x
    node.canvas_y = pos.y
    await node.save()
    return {"ok": True}


class AddTopicRequest(BaseModel):
    topic: str


@router.post("/add-topic")
async def add_topic(req: AddTopicRequest, current_user: User = Depends(get_current_user)):
    """Generate new concept nodes for a topic using Gemini and add them to the user's graph."""
    uid = current_user.id

    existing_nodes = await ConceptNode.find(ConceptNode.user_id == uid).to_list()
    existing_concepts = [n.concept for n in existing_nodes]

    max_x = max((n.canvas_x for n in existing_nodes), default=0)
    avg_y = sum(n.canvas_y for n in existing_nodes) / len(existing_nodes) if existing_nodes else 0

    search_context = ""
    youtube_context = ""
    try:
        from search.search import search_web
        web_results = await search_web(req.topic)
        if web_results:
            search_context = "\n".join(f"- {r.title}: {r.url}" for r in web_results[:2])
    except Exception as exc:
        logger.warning("search_web failed for add_topic: %s", exc)

    try:
        from search.youtube import search_youtube
        yt_result = await search_youtube(req.topic)
        youtube_context = f"YouTube: {yt_result.title} ({yt_result.video_url})"
    except Exception as exc:
        logger.warning("search_youtube failed for add_topic: %s", exc)

    try:
        graph_data = generate_topic_nodes(
            topic=req.topic,
            background=current_user.background or "",
            existing_concepts=existing_concepts,
            start_x=max_x + 300,
            start_y=avg_y,
        )
    except Exception as exc:
        logger.exception("generate_topic_nodes failed for topic %s", req.topic)
        raise HTTPException(status_code=502, detail=f"Topic generation failed: {exc}") from exc

    if not graph_data or "nodes" not in graph_data or not graph_data["nodes"]:
        raise HTTPException(status_code=502, detail="Failed to generate topic nodes. Please try again.")

    nodes_created = []
    concept_to_id = {}

    for n in existing_nodes:
        concept_to_id[n.concept.lower()] = n.id

    base_x = max_x + 300
    for i, n in enumerate(graph_data["nodes"]):
        concept = n.get("concept") or n.get("name")
        if not concept or not str(concept).strip():
            continue
        concept = str(concept).strip()
        state_str = n.get("state", "red")
        try:
            state = NodeState(state_str)
        except ValueError:
            state = NodeState.RED

        node = ConceptNode(
            user_id=uid,
            concept=concept,
            domain=n.get("domain", "general"),
            complexity_tier=int(n.get("complexity_tier", 1)),
            dependency_depth=int(n.get("dependency_depth", 0)),
            state=state,
            mastery_score=0.0,
            retention_rt=0.0,
            canvas_x=float(n.get("canvas_x", base_x + i * 200)),
            canvas_y=float(n.get("canvas_y", 0)),
            created_at=datetime.utcnow(),
        )
        await node.insert()
        nodes_created.append(node)
        concept_to_id[concept.lower()] = node.id

    for e in graph_data.get("edges", []):
        from_name = e.get("from") or e.get("from_node")
        to_name = e.get("to") or e.get("to_node")
        if not from_name or not to_name:
            continue
        from_id = concept_to_id.get(str(from_name).lower())
        to_id = concept_to_id.get(str(to_name).lower())
        if from_id and to_id:
            edge = KnowledgeEdge(
                user_id=uid,
                from_node_id=from_id,
                to_node_id=to_id,
                edge_type=e.get("type", "prerequisite"),
            )
            await edge.insert()

    if not nodes_created:
        raise HTTPException(
            status_code=502,
            detail="Could not create any nodes for this topic. Please try a different topic name.",
        )

    return {
        "nodes_created": len(nodes_created),
        "search_context": search_context or None,
        "youtube_context": youtube_context or None,
        "nodes": [
            {
                "id": str(n.id),
                "concept": n.concept,
                "domain": n.domain,
                "state": n.state.value,
                "complexity_tier": n.complexity_tier,
                "canvas_x": n.canvas_x,
                "canvas_y": n.canvas_y,
            }
            for n in nodes_created
        ],
    }


@router.get("/history")
async def get_canvas_history(current_user: User = Depends(get_current_user)):
    """
    Return node state snapshots grouped by date for the timeline scrubber.
    Aggregates from learning events to reconstruct historical states.
    """
    uid = current_user.id
    events = (
        await LearningEvent.find(LearningEvent.user_id == uid)
        .sort("created_at")
        .to_list()
    )

    nodes = await ConceptNode.find(ConceptNode.user_id == uid).to_list()
    node_map = {str(n.id): n for n in nodes}

    snapshots_by_date = {}
    for event in events:
        date_key = event.created_at.strftime("%Y-%m-%d")
        if date_key not in snapshots_by_date:
            snapshots_by_date[date_key] = {}

        nid = str(event.node_id)
        if nid in node_map:
            n = node_map[nid]
            snapshots_by_date[date_key][nid] = NodeSnapshot(
                node_id=nid,
                concept=n.concept,
                state=n.state,
                retention_rt=n.retention_rt,
                canvas_x=n.canvas_x,
                canvas_y=n.canvas_y,
            )

    result = []
    for date_str in sorted(snapshots_by_date.keys()):
        snap_nodes = list(snapshots_by_date[date_str].values())
        result.append(
            CanvasSnapshot(
                date=datetime.strptime(date_str, "%Y-%m-%d"),
                nodes=snap_nodes,
            )
        )

    return {"history": [s.model_dump() for s in result]}

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database.models import (
    User, ConceptNode, KnowledgeEdge, LearningEvent,
    Recommendation, NodeState, CanvasSnapshot, NodeSnapshot,
)
from services.gemini_service import generate_topic_nodes, generate_concept_explanation
from api.deps import get_current_user
from beanie import PydanticObjectId
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


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
        xp_earned=0,
        created_at=datetime.utcnow(),
    )
    await event.insert()

    node.review_count += 1
    node.last_reviewed = datetime.utcnow()
    if req.event_type in ("view", "practice", "feynman") and node.state == NodeState.RED:
        node.state = NodeState.YELLOW
    await node.save()

    return {
        "event_id": str(event.id),
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


class SearchTopicRequest(BaseModel):
    topic: str
    background: str = ""


@router.post("/search")
async def search_topic(req: SearchTopicRequest, current_user: User = Depends(get_current_user)):
    """Reset the user's graph and generate a new one for the searched topic."""
    uid = current_user.id

    # Delete all existing nodes and edges
    await ConceptNode.find(ConceptNode.user_id == uid).delete()
    await KnowledgeEdge.find(KnowledgeEdge.user_id == uid).delete()

    # Update user goal to the searched topic
    current_user.goal = req.topic
    if req.background:
        current_user.background = req.background
    await current_user.save()

    # Generate graph using web-search-enhanced generation
    from api.users import _generate_graph_with_research
    graph_data = await _generate_graph_with_research(
        goal=req.topic,
        background=current_user.background or "",
        prior_history="",
    )

    if not graph_data or "nodes" not in graph_data or len(graph_data["nodes"]) == 0:
        raise HTTPException(status_code=502, detail="Failed to generate knowledge graph")

    nodes_created = []
    concept_to_id = {}

    for n in graph_data["nodes"]:
        state_str = n.get("state", "red")
        try:
            state = NodeState(state_str)
        except ValueError:
            state = NodeState.RED

        node = ConceptNode(
            user_id=uid,
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

    edges_created = 0
    for e in graph_data.get("edges", []):
        from_id = concept_to_id.get(e["from"].lower())
        to_id = concept_to_id.get(e["to"].lower())
        if from_id and to_id:
            edge = KnowledgeEdge(
                user_id=uid,
                from_node_id=from_id,
                to_node_id=to_id,
                edge_type=e.get("type", "prerequisite"),
            )
            await edge.insert()
            edges_created += 1

    logger.info("Search graph for '%s': %d nodes, %d edges", req.topic, len(nodes_created), edges_created)

    return {
        "topic": req.topic,
        "nodes_created": len(nodes_created),
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


@router.get("/node/{node_id}/detail")
async def get_node_detail(node_id: str, current_user: User = Depends(get_current_user)):
    """Get AI explanation for a concept node. Used when clicking a node on the canvas."""
    node = await ConceptNode.get(PydanticObjectId(node_id))
    if not node or node.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Node not found")

    # Get AI explanation
    explanation = generate_concept_explanation(
        concept=node.concept,
        user_background=current_user.background or "",
        user_goal=current_user.goal or "",
    )

    # Get prerequisite/dependent nodes for context
    edges = await KnowledgeEdge.find(KnowledgeEdge.user_id == current_user.id).to_list()
    prereq_ids = [e.from_node_id for e in edges if e.to_node_id == node.id]
    dependent_ids = [e.to_node_id for e in edges if e.from_node_id == node.id]

    prereqs = []
    for pid in prereq_ids:
        pnode = await ConceptNode.get(pid)
        if pnode:
            prereqs.append({"id": str(pnode.id), "concept": pnode.concept, "state": pnode.state.value})

    dependents = []
    for did in dependent_ids:
        dnode = await ConceptNode.get(did)
        if dnode:
            dependents.append({"id": str(dnode.id), "concept": dnode.concept, "state": dnode.state.value})

    # Check if all prerequisites are green (mastered)
    all_prereqs_met = all(p["state"] == "green" for p in prereqs) if prereqs else True

    return {
        "node": {
            "id": str(node.id),
            "concept": node.concept,
            "domain": node.domain,
            "state": node.state.value,
            "mastery_score": node.mastery_score,
            "complexity_tier": node.complexity_tier,
        },
        "explanation": explanation,
        "prerequisites": prereqs,
        "dependents": dependents,
        "all_prereqs_met": all_prereqs_met,
    }

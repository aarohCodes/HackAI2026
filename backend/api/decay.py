from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from database.models import User, ConceptNode, LearningEvent, NodeState
from ml.predict import predict_node_retention, compute_spacing_score
from ml.evaluate import load_metrics, compute_decay_curves
from api.deps import get_current_user
from beanie import PydanticObjectId

router = APIRouter()


@router.post("/run")
async def run_decay_scoring(current_user: User = Depends(get_current_user)):
    """Score all concept nodes for the authenticated user."""
    uid = current_user.id
    nodes = await ConceptNode.find(ConceptNode.user_id == uid).to_list()
    alerts = []

    for node in nodes:
        if node.state == NodeState.RED:
            continue

        events = (
            await LearningEvent.find(LearningEvent.node_id == node.id)
            .sort("created_at")
            .to_list()
        )

        review_timestamps = [
            e.created_at
            for e in events
            if e.event_type in ("view", "practice", "feynman")
        ]
        spacing_score = compute_spacing_score(review_timestamps)

        time_events = [e for e in events if e.duration_seconds]
        time_spent_avg = (
            sum(e.duration_seconds for e in time_events)
            / max(len(time_events), 1)
            / 60
        )

        feynman_events = [e for e in events if e.event_type == "feynman" and e.success]
        feynman_score = len(feynman_events) / max(node.review_count, 1)

        revisit_events = [e for e in events if e.event_type == "rewatch"]
        revisit_rate = len(revisit_events) / max(len(events), 1)

        fail_events = [
            e for e in events if e.event_type == "practice" and e.success is False
        ]
        practice_fail = len(fail_events) / max(len(events), 1)

        conf_gaps = [
            abs((e.confidence_after or 0) - (e.confidence_before or 0))
            for e in events
            if e.confidence_before is not None and e.confidence_after is not None
        ]
        confidence_gap = sum(conf_gaps) / max(len(conf_gaps), 1)

        days_since = 99.0
        if node.last_reviewed:
            days_since = (
                datetime.utcnow() - node.last_reviewed
            ).total_seconds() / 86400

        features = {
            "complexity_tier": node.complexity_tier,
            "dependency_depth": node.dependency_depth,
            "review_count": node.review_count,
            "spacing_score": spacing_score,
            "time_spent_avg": time_spent_avg,
            "feynman_score": feynman_score,
            "revisit_rate": revisit_rate,
            "practice_fail_rate": practice_fail,
            "confidence_gap": confidence_gap,
            "days_since_review": days_since,
        }

        result = predict_node_retention(features)

        node.retention_rt = result["retention"]
        if result["alert"]:
            node.state = NodeState.FADING
            alerts.append(
                {
                    "node_id": str(node.id),
                    "concept": node.concept,
                    "retention": result["retention"],
                    "days_until_decay": result["days_until_decay"],
                }
            )
        elif result["node_state"] == "green":
            node.state = NodeState.GREEN
        elif result["node_state"] == "yellow":
            node.state = NodeState.YELLOW

        await node.save()

    return {"scored": len(nodes), "alerts": alerts}


@router.get("/scores")
async def get_decay_scores(current_user: User = Depends(get_current_user)):
    """Return current retention scores for all nodes."""
    uid = current_user.id
    nodes = await ConceptNode.find(ConceptNode.user_id == uid).to_list()

    return {
        "nodes": [
            {
                "id": str(n.id),
                "concept": n.concept,
                "state": n.state.value,
                "retention_rt": n.retention_rt,
                "review_count": n.review_count,
                "last_reviewed": n.last_reviewed.isoformat() if n.last_reviewed else None,
            }
            for n in nodes
        ]
    }


@router.get("/metrics")
async def get_model_metrics():
    """Return ML model metrics and decay curves for the dashboard."""
    metrics = load_metrics()
    curves = compute_decay_curves()
    return {"metrics": metrics, "curves": curves}

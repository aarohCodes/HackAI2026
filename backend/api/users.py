from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database.models import User, ConceptNode, KnowledgeEdge, NodeState
from services.gemini_service import generate_onboarding_graph, _call_gemini
from api.deps import get_current_user
from beanie import PydanticObjectId
import logging
import json

router = APIRouter()
logger = logging.getLogger(__name__)


class OnboardRequest(BaseModel):
    goal: str
    background: str
    prior_history: Optional[str] = None
    learner_type: str = "gradual"


async def _research_learning_path(goal: str, background: str) -> str:
    """Use Tavily web search to find real learning roadmaps for the user's goal."""
    try:
        from services.search_service import search_web
        results = await search_web(f"learning roadmap path to learn {goal}", max_results=2)
        if results:
            snippets = []
            for r in results:
                content = r.get("raw_content", "") or ""
                snippets.append(f"Source: {r['title']}\n{content[:2000]}")
            return "\n\n---\n\n".join(snippets)
    except Exception as e:
        logger.warning("Web search for learning path failed: %s", e)
    return ""


async def _generate_graph_with_research(goal: str, background: str, prior_history: str) -> dict | None:
    """Enhanced graph generation: web search for real roadmaps, then Gemini builds graph from that context."""
    # Step 1: Research real learning paths via web search
    web_context = await _research_learning_path(goal, background)

    if web_context:
        logger.info("Got web research context (%d chars), using it for graph generation", len(web_context))
        prompt = f"""You are initializing a personalized knowledge graph for a new learner on CogniPath.

LEARNER GOAL: {goal}
LEARNER BACKGROUND: {background}
PRIOR LEARNING HISTORY: {prior_history or 'None provided'}

REAL-WORLD LEARNING ROADMAP RESEARCH (from web search):
{web_context[:4000]}

Using the real-world roadmap above as reference, generate a knowledge graph of 15-25 concepts
that maps the SPECIFIC journey from the learner's current knowledge to their goal.

Rules:
- Concepts the learner already knows based on their background -> state: 'green'
- Concepts they partially know or have some exposure to -> state: 'yellow'
- Concepts they need to learn to reach their goal -> state: 'red'
- complexity_tier: 1=fundamental, 2=intermediate, 3=advanced
- dependency_depth: how many prerequisite hops from the root concept
- canvas_x, canvas_y: arrange as a left-to-right learning path,
  x from 100 to 1600 spacing ~150-200px apart, y centered around 0 with +/-200 spread
- edges: prerequisite edges from simpler to harder concepts
- Include at least 3-4 green nodes (things they already know) as foundation
- Include 3-5 yellow nodes (partially known)
- Fill the rest with red nodes (need to learn) building toward the goal
- Every concept name should be specific and descriptive (e.g., "Gradient Descent" not "Math")
- Use REAL topic names from the roadmap research, not generic placeholders

Return ONLY valid JSON (no markdown fences, no extra text):
{{
  "nodes": [
    {{
      "concept": "string",
      "domain": "string",
      "state": "red|yellow|green",
      "complexity_tier": 1,
      "dependency_depth": 0,
      "canvas_x": 0.0,
      "canvas_y": 0.0
    }}
  ],
  "edges": [
    {{ "from": "concept_name", "to": "concept_name", "type": "prerequisite" }}
  ]
}}"""
        result = _call_gemini(prompt)
        if result and "nodes" in result and len(result["nodes"]) >= 5:
            logger.info("Research-enhanced graph: %d nodes, %d edges",
                        len(result["nodes"]), len(result.get("edges", [])))
            return result

    # Fallback to standard Gemini-only generation
    logger.info("Falling back to standard Gemini graph generation")
    return generate_onboarding_graph(goal=goal, background=background, prior_history=prior_history)


@router.post("/onboard")
async def onboard_user(req: OnboardRequest, current_user: User = Depends(get_current_user)):
    """Complete onboarding for the authenticated user — sets goal/background and generates knowledge graph.
    Uses web search + YouTube to build a research-backed knowledge graph."""
    if current_user.goal:
        raise HTTPException(status_code=400, detail="User has already onboarded")

    current_user.goal = req.goal
    current_user.background = req.background
    current_user.prior_history = req.prior_history
    current_user.learner_type = req.learner_type
    await current_user.save()

    logger.info("Generating onboarding graph for user %s — goal: %s", current_user.id, req.goal)

    try:
        graph_data = await _generate_graph_with_research(
            goal=req.goal,
            background=req.background,
            prior_history=req.prior_history or "",
        )
    except Exception as exc:
        logger.error("Onboarding graph generation crashed: %s", exc)
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


@router.post("/reset-onboarding")
async def reset_onboarding(current_user: User = Depends(get_current_user)):
    """DEV ONLY: Clear the user's goal and delete all their nodes/edges so onboarding can be re-run."""
    # Delete all nodes and edges for this user
    await ConceptNode.find(ConceptNode.user_id == current_user.id).delete()
    await KnowledgeEdge.find(KnowledgeEdge.user_id == current_user.id).delete()

    current_user.goal = ""
    current_user.background = ""
    current_user.prior_history = None
    await current_user.save()

    logger.info("Reset onboarding for user %s", current_user.id)
    return {"status": "ok", "message": "Onboarding reset. You can now re-onboard."}


@router.get("/me")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "goal": current_user.goal,
        "background": current_user.background,
        "learner_type": current_user.learner_type,
        "created_at": current_user.created_at.isoformat(),
    }


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Get a user by ID — only allowed if it's the current user."""
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "goal": current_user.goal,
        "background": current_user.background,
        "learner_type": current_user.learner_type,
        "created_at": current_user.created_at.isoformat(),
    }

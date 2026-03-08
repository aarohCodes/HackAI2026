from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database.models import User, ConceptNode, NodeState
from services.gemini_service import (
    generate_adaptive_quiz,
    generate_scenario_challenge,
    generate_concept_drill,
    grade_open_answer,
)
from services.gamification_service import award_xp
from api.deps import get_current_user

router = APIRouter()


class QuizGenerateRequest(BaseModel):
    concept_ids: list[str] = []
    difficulty: str = "mixed"


class ScenarioRequest(BaseModel):
    concept: str
    node_id: Optional[str] = None


class DrillRequest(BaseModel):
    concept_ids: list[str] = []


class GradeAnswerRequest(BaseModel):
    concept: str
    question: str
    user_answer: str
    correct_answer: str


class QuizCompleteRequest(BaseModel):
    total_questions: int
    correct_answers: int
    time_seconds: int
    concepts_tested: list[str] = []


async def _get_user_concepts(user_id, concept_ids: list[str] = None, filter_weak: bool = False):
    """Fetch concept nodes for the user, optionally filtered."""
    if concept_ids:
        from beanie import PydanticObjectId
        nodes = []
        for cid in concept_ids:
            try:
                node = await ConceptNode.get(PydanticObjectId(cid))
                if node and node.user_id == user_id:
                    nodes.append(node)
            except Exception:
                continue
        return nodes

    query = ConceptNode.find(ConceptNode.user_id == user_id)
    if filter_weak:
        nodes = await query.to_list()
        return [n for n in nodes if n.state in (NodeState.RED, NodeState.YELLOW, NodeState.FADING)]
    return await query.to_list()


def _serialize_concepts(nodes) -> list[dict]:
    return [
        {
            "concept": n.concept,
            "domain": n.domain,
            "state": n.state.value,
            "mastery_score": n.mastery_score,
            "retention_rt": n.retention_rt,
            "complexity_tier": n.complexity_tier,
        }
        for n in nodes
    ]


@router.post("/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest, current_user: User = Depends(get_current_user)):
    """Generate a NotebookLM-style adaptive quiz from the user's knowledge graph."""
    nodes = await _get_user_concepts(current_user.id, req.concept_ids)
    if not nodes:
        raise HTTPException(status_code=400, detail="No concepts found. Complete onboarding first.")

    concepts = _serialize_concepts(nodes)
    result = generate_adaptive_quiz(concepts, current_user.background, req.difficulty)

    if result.get("_fallback"):
        raise HTTPException(status_code=503, detail="Quiz generation temporarily unavailable")

    return result


@router.post("/quiz/grade")
async def grade_answer(req: GradeAnswerRequest, current_user: User = Depends(get_current_user)):
    """Grade a fill-in-the-blank or open-ended answer via Gemini."""
    result = grade_open_answer(
        concept=req.concept,
        question=req.question,
        user_answer=req.user_answer,
        correct_answer=req.correct_answer,
    )
    return result


@router.post("/quiz/complete")
async def quiz_complete(req: QuizCompleteRequest, current_user: User = Depends(get_current_user)):
    """Record quiz completion, award XP, and update node mastery scores."""
    if req.total_questions == 0:
        return {"xp_earned": 0, "score_pct": 0}

    score_pct = round((req.correct_answers / req.total_questions) * 100)
    base_xp = req.correct_answers * 15
    if score_pct >= 90:
        base_xp += 100
    elif score_pct >= 70:
        base_xp += 50

    xp_result = await award_xp(current_user.id, "quiz")

    if score_pct >= 70 and req.concepts_tested:
        for concept_name in req.concepts_tested:
            node = await ConceptNode.find_one(
                ConceptNode.user_id == current_user.id,
                ConceptNode.concept == concept_name,
            )
            if node:
                boost = 0.15 if score_pct >= 90 else 0.08
                node.mastery_score = min(1.0, node.mastery_score + boost)
                if node.mastery_score >= 0.85 and node.state != NodeState.GREEN:
                    node.state = NodeState.GREEN
                elif node.mastery_score >= 0.5 and node.state == NodeState.RED:
                    node.state = NodeState.YELLOW
                await node.save()

    return {
        "score_pct": score_pct,
        "correct": req.correct_answers,
        "total": req.total_questions,
        "xp_earned": base_xp + xp_result.get("xp_gained", 0),
        "mastery_updated": len(req.concepts_tested) if score_pct >= 70 else 0,
    }


@router.post("/scenario/generate")
async def generate_scenario(req: ScenarioRequest, current_user: User = Depends(get_current_user)):
    """Generate a real-world scenario simulation for a specific concept."""
    all_nodes = await ConceptNode.find(ConceptNode.user_id == current_user.id).to_list()
    related = [n.concept for n in all_nodes if n.concept.lower() != req.concept.lower()][:8]

    result = generate_scenario_challenge(
        concept=req.concept,
        user_background=current_user.background,
        related_concepts=related,
    )

    if result.get("_fallback"):
        raise HTTPException(status_code=503, detail="Scenario generation temporarily unavailable")

    return result


@router.post("/drill/generate")
async def generate_drill(req: DrillRequest, current_user: User = Depends(get_current_user)):
    """Generate rapid-fire drill questions targeting weak concepts."""
    if req.concept_ids:
        nodes = await _get_user_concepts(current_user.id, req.concept_ids)
    else:
        nodes = await _get_user_concepts(current_user.id, filter_weak=True)

    if not nodes:
        all_nodes = await ConceptNode.find(ConceptNode.user_id == current_user.id).to_list()
        nodes = all_nodes[:10]

    if not nodes:
        raise HTTPException(status_code=400, detail="No concepts found for drilling.")

    concepts = _serialize_concepts(nodes)
    result = generate_concept_drill(concepts, current_user.background)

    if result.get("_fallback"):
        raise HTTPException(status_code=503, detail="Drill generation temporarily unavailable")

    return result

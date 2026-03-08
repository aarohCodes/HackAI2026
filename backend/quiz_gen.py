"""
quiz_gen.py - /quiz endpoint.
Generates 5 MCQ questions based on a given topic using Gemini,
personalized with MongoDB past_learning data.
From aaroh branch (originally quiz.py).
"""

import os
import json
import re
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

from db import past_learning_col
from database.models import User
from deps import get_current_user

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
logger = logging.getLogger(__name__)

router = APIRouter()


class QuizRequest(BaseModel):
    topic: str


class MCQOption(BaseModel):
    label: str
    text: str


class MCQQuestion(BaseModel):
    question: str
    options: list[MCQOption]
    correct_answer: str
    explanation: str


class QuizResponse(BaseModel):
    topic: str
    questions: list[MCQQuestion]


def _get_learning_context(user_id: str, topic: str) -> str:
    """Build context string from past learning data."""
    records = list(past_learning_col.find({"user_id": user_id}, {"_id": 0}))
    if not records:
        return "No prior learning history."

    lines = []
    for r in records:
        strengths = r.get("strengths")
        weaknesses = r.get("weaknesses")
        if not isinstance(strengths, list):
            strengths = []
        if not isinstance(weaknesses, list):
            weaknesses = []
        lines.append(
            f"- {r.get('topic', '?')}: Progress {r.get('progress', 0)}%, "
            f"Strengths: {', '.join(str(s) for s in strengths)}, "
            f"Weaknesses: {', '.join(str(w) for w in weaknesses)}"
        )
    return "\n".join(lines)


@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(req: QuizRequest, current_user: User = Depends(get_current_user)):
    """Generate 5 MCQ questions for the given topic."""
    try:
        context = _get_learning_context(str(current_user.id), req.topic)

        prompt = f"""You are an expert quiz maker. Generate exactly 5 multiple-choice questions
about the topic: "{req.topic}"

Student's learning background:
{context}

Instructions:
- Make questions progressively harder (easy -> medium -> hard).
- Focus more on the student's weak areas if relevant.
- Each question must have exactly 4 options labeled A, B, C, D.
- Provide the correct answer and a brief explanation.

Return your answer as a JSON array with exactly 5 objects. Each object must have:
- "question": the question text
- "options": [{{"label": "A", "text": "..."}}, {{"label": "B", "text": "..."}}, {{"label": "C", "text": "..."}}, {{"label": "D", "text": "..."}}]
- "correct_answer": the label of the correct option (e.g. "B")
- "explanation": a brief explanation

Return ONLY the JSON array, no other text.
"""

        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        if not text:
            raise HTTPException(status_code=503, detail="Quiz generation returned no content. Please try again.")

        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        questions_raw = json.loads(text)
        if not isinstance(questions_raw, list):
            questions_raw = [questions_raw] if isinstance(questions_raw, dict) else []

        questions = []
        for q in questions_raw[:5]:
            opts = q.get("options") or []
            options = []
            for o in opts:
                if isinstance(o, dict):
                    options.append(MCQOption(label=str(o.get("label", "?")), text=str(o.get("text", ""))))
                else:
                    options.append(MCQOption(label="?", text=str(o)))
            if len(options) < 2:
                continue
            questions.append(
                MCQQuestion(
                    question=str(q.get("question", "")),
                    options=options,
                    correct_answer=str(q.get("correct_answer", "A")),
                    explanation=str(q.get("explanation", "")),
                )
            )

        if len(questions) < 1:
            raise HTTPException(status_code=503, detail="Could not generate enough valid questions. Try a different topic.")
        return QuizResponse(topic=req.topic, questions=questions)

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.exception("Quiz JSON parse error for topic %s", req.topic)
        raise HTTPException(status_code=500, detail=f"Failed to parse quiz: {e}")
    except Exception as e:
        logger.exception("Quiz generation failed for topic %s", req.topic)
        raise HTTPException(status_code=500, detail=str(e))

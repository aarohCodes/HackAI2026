"""
quiz.py - /quiz endpoint.
Generates 5 MCQ questions based on a given topic using Gemini,
personalized with MongoDB past_learning data.
"""

import os
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

from db import past_learning_col

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

router = APIRouter()


class QuizRequest(BaseModel):
    topic: str
    user_id: str = "user_001"


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
        lines.append(
            f"- {r['topic']}: Progress {r['progress']}%, "
            f"Strengths: {', '.join(r.get('strengths', []))}, "
            f"Weaknesses: {', '.join(r.get('weaknesses', []))}"
        )
    return "\n".join(lines)


@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(req: QuizRequest):
    """Generate 5 MCQ questions for the given topic."""
    try:
        context = _get_learning_context(req.user_id, req.topic)

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
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        questions_raw = json.loads(text)

        questions = []
        for q in questions_raw[:5]:
            options = [MCQOption(label=o["label"], text=o["text"]) for o in q["options"]]
            questions.append(
                MCQQuestion(
                    question=q["question"],
                    options=options,
                    correct_answer=q["correct_answer"],
                    explanation=q.get("explanation", ""),
                )
            )

        return QuizResponse(topic=req.topic, questions=questions)

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse quiz JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

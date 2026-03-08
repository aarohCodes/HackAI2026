"""
summary.py - /summary endpoint.
Generates a concise summary of a given topic using Gemini,
personalized with MongoDB past_learning data.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

from db import past_learning_col

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

router = APIRouter()


class SummaryRequest(BaseModel):
    topic: str
    user_id: str = "user_001"


class SummaryResponse(BaseModel):
    topic: str
    summary: str
    key_points: list[str]
    related_past_topics: list[str]


def _get_related_context(user_id: str, topic: str) -> tuple[str, list[str]]:
    """Fetch past learning records and identify related topics."""
    records = list(past_learning_col.find({"user_id": user_id}, {"_id": 0}))
    related = []
    context_lines = []

    for r in records:
        context_lines.append(
            f"- {r['topic']}: Progress {r['progress']}%, Score {r['score']}, "
            f"Weaknesses: {', '.join(r.get('weaknesses', []))}"
        )
        # Simple keyword overlap check
        topic_lower = topic.lower()
        if (
            topic_lower in r["topic"].lower()
            or any(topic_lower in s.lower() for s in r.get("subtopics", []))
            or r["topic"].lower() in topic_lower
        ):
            related.append(r["topic"])

    return "\n".join(context_lines) if context_lines else "No prior learning data.", related


@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(req: SummaryRequest):
    """Generate a summary of the given topic, personalized with past learning context."""
    try:
        context, related_topics = _get_related_context(req.user_id, req.topic)

        prompt = f"""You are an expert educator. Generate a comprehensive yet concise summary
of the topic: "{req.topic}"

Student's learning history:
{context}

Instructions:
1. Write a clear 3-5 paragraph summary of the topic.
2. Tailor the depth based on the student's existing knowledge (if they already know basics, go deeper).
3. At the end, list exactly 5 key points as bullet items, each on its own line starting with "- ".

Format:
SUMMARY:
<your summary paragraphs>

KEY_POINTS:
- point 1
- point 2
- point 3
- point 4
- point 5
"""

        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = response.text

        # Parse summary and key points
        summary = ""
        key_points = []

        if "KEY_POINTS:" in text:
            parts = text.split("KEY_POINTS:")
            summary_part = parts[0]
            kp_part = parts[1]

            summary = summary_part.replace("SUMMARY:", "").strip()
            key_points = [
                line.strip().lstrip("- ").strip()
                for line in kp_part.strip().split("\n")
                if line.strip().startswith("-")
            ]
        else:
            summary = text.replace("SUMMARY:", "").strip()
            key_points = ["Refer to the summary above for key details."]

        return SummaryResponse(
            topic=req.topic,
            summary=summary,
            key_points=key_points[:5],
            related_past_topics=related_topics,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

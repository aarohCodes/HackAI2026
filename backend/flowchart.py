"""
flowchart.py - /flowchart endpoint.
Generates a Mermaid flowchart based on the user query,
using MongoDB past_learning data for context.
From aaroh branch.
"""

import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

from db import past_learning_col
from database.models import User
from deps import get_current_user

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter()


class FlowchartRequest(BaseModel):
    query: str


class FlowchartResponse(BaseModel):
    query: str
    mermaid_code: str
    explanation: str


def _get_past_learning_context(user_id: str) -> str:
    """Fetch past learning records from MongoDB and format as context."""
    records = list(past_learning_col.find({"user_id": user_id}, {"_id": 0}))
    if not records:
        return "No prior learning history found."

    lines = []
    for r in records:
        lines.append(
            f"- Topic: {r['topic']} | Progress: {r['progress']}% | "
            f"Score: {r['score']} | Strengths: {', '.join(r.get('strengths', []))} | "
            f"Weaknesses: {', '.join(r.get('weaknesses', []))}"
        )
    return "\n".join(lines)


@router.post("/flowchart", response_model=FlowchartResponse)
async def generate_flowchart(req: FlowchartRequest, current_user: User = Depends(get_current_user)):
    """Generate a Mermaid flowchart for the given query, personalized with past learning data."""
    try:
        context = _get_past_learning_context(str(current_user.id))

        prompt = f"""You are an expert educator. A student asks about: "{req.query}"

Here is the student's past learning history:
{context}

Generate a clear Mermaid.js flowchart (using `graph TD` syntax) that visually maps out
the learning path or concept breakdown for the query. Personalize based on the student's
strengths and weaknesses where relevant.

Return ONLY valid Mermaid code in a code block, followed by a brief 2-3 sentence explanation.
Format your response exactly as:

```mermaid
<mermaid code here>
```

EXPLANATION: <your explanation here>
"""

        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = response.text

        mermaid_code = ""
        explanation = ""

        if "```mermaid" in text:
            parts = text.split("```mermaid")
            if len(parts) > 1:
                mermaid_block = parts[1].split("```")[0].strip()
                mermaid_code = mermaid_block
        elif "```" in text:
            parts = text.split("```")
            if len(parts) > 1:
                mermaid_code = parts[1].strip()

        if "EXPLANATION:" in text:
            explanation = text.split("EXPLANATION:")[-1].strip()
        else:
            after_code = text.split("```")[-1].strip()
            explanation = after_code if after_code else "Flowchart generated based on your query."

        return FlowchartResponse(
            query=req.query,
            mermaid_code=mermaid_code,
            explanation=explanation,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

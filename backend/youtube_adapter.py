"""
youtube_adapter.py — Adapter for POST /youtube/snippet.
Orchestrates search/youtube + video/process + video/snippets
so the frontend's existing api.post('/youtube/snippet', ...) keeps working.
"""

import re
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from search.youtube import search_youtube
from video import (
    _extract_video_id,
    _fetch_transcript,
    _chunk_transcript,
    videos_col,
)
from database.models import User
from deps import get_current_user
import google.generativeai as genai
import json, os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter()


class SnippetAdapterRequest(BaseModel):
    concept: str
    gap_description: Optional[str] = None


class SnippetResult(BaseModel):
    video_id: str
    title: str
    start_seconds: float
    end_seconds: float
    snippet_reason: str


class SnippetAdapterResponse(BaseModel):
    snippet: Optional[SnippetResult] = None
    error: Optional[str] = None


@router.post("/youtube/snippet", response_model=SnippetAdapterResponse)
async def youtube_snippet(req: SnippetAdapterRequest, current_user: User = Depends(get_current_user)):
    query = req.gap_description or req.concept

    try:
        yt_result = await search_youtube(query)
    except RuntimeError as exc:
        return SnippetAdapterResponse(error=str(exc))

    video_id = yt_result.video_id
    video_url = yt_result.video_url
    title = yt_result.title

    existing = videos_col.find_one({"video_id": video_id})
    if not existing:
        try:
            raw_transcript = _fetch_transcript(video_id)
            chunks = _chunk_transcript(raw_transcript, chunk_size=5)
            doc = {
                "video_id": video_id,
                "user_id": str(current_user.id),
                "url": video_url,
                "title": title,
                "chunks": chunks,
            }
            videos_col.replace_one({"video_id": video_id}, doc, upsert=True)
        except RuntimeError as exc:
            return SnippetAdapterResponse(
                snippet=SnippetResult(
                    video_id=video_id,
                    title=title,
                    start_seconds=0,
                    end_seconds=60,
                    snippet_reason="Full video — transcript unavailable",
                )
            )
    else:
        chunks = existing.get("chunks", [])
        title = existing.get("title", title)

    if not chunks:
        return SnippetAdapterResponse(
            snippet=SnippetResult(
                video_id=video_id,
                title=title,
                start_seconds=0,
                end_seconds=60,
                snippet_reason="Full video recommended",
            )
        )

    chunk_list = "\n".join(
        f"[{i}] (start={c['start']}s) {c['text']}" for i, c in enumerate(chunks)
    )
    prompt = f"""Pick the single most relevant transcript chunk for the query.

Query: "{query}"

Transcript chunks:
{chunk_list}

Return ONLY a JSON object with:
- "index": the chunk index number
- "relevance_summary": a one-sentence explanation
Return ONLY valid JSON."""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        ranked = json.loads(text)

        if isinstance(ranked, list):
            ranked = ranked[0]

        idx = int(ranked["index"])
        if 0 <= idx < len(chunks):
            c = chunks[idx]
            return SnippetAdapterResponse(
                snippet=SnippetResult(
                    video_id=video_id,
                    title=title,
                    start_seconds=c["start"],
                    end_seconds=c["start"] + c["duration"],
                    snippet_reason=ranked.get("relevance_summary", "Most relevant segment"),
                )
            )
    except Exception:
        pass

    c = chunks[0]
    return SnippetAdapterResponse(
        snippet=SnippetResult(
            video_id=video_id,
            title=title,
            start_seconds=c["start"],
            end_seconds=c["start"] + c["duration"],
            snippet_reason="First segment of video",
        )
    )

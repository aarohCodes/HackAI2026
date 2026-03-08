"""
video.py - /video endpoints.
Process a YouTube video by URL, index its transcript, and return relevant snippets.
"""

import os
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi

from db import videos_col

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

router = APIRouter()


# ── Request / Response models ───────────────────────────────────────────────

class VideoProcessRequest(BaseModel):
    video_url: str
    user_id: str = "user_001"


class TranscriptChunk(BaseModel):
    text: str
    start: float
    duration: float


class VideoProcessResponse(BaseModel):
    video_id: str
    title: str
    total_chunks: int
    message: str


class SnippetRequest(BaseModel):
    video_id: str
    query: str
    top_k: int = 5


class Snippet(BaseModel):
    text: str
    start: float
    duration: float
    relevance_summary: str


class SnippetResponse(BaseModel):
    video_id: str
    query: str
    snippets: list[Snippet]


# ── Helpers ─────────────────────────────────────────────────────────────────

def _extract_video_id(url: str) -> str:
    """Extract the YouTube video ID from various URL formats."""
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})",
        r"(?:embed\/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts\/)([a-zA-Z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    raise ValueError(f"Cannot extract video ID from URL: {url}")


def _fetch_transcript(video_id: str) -> list[dict]:
    """Fetch the transcript for a YouTube video."""
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except Exception as e:
        raise RuntimeError(f"Could not fetch transcript for {video_id}: {e}")


def _chunk_transcript(transcript: list[dict], chunk_size: int = 5) -> list[dict]:
    """Group consecutive transcript entries into larger chunks."""
    chunks = []
    for i in range(0, len(transcript), chunk_size):
        group = transcript[i : i + chunk_size]
        combined_text = " ".join(entry["text"] for entry in group)
        start = group[0]["start"]
        duration = sum(entry["duration"] for entry in group)
        chunks.append({"text": combined_text, "start": start, "duration": round(duration, 2)})
    return chunks


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/video/process", response_model=VideoProcessResponse)
async def process_video(req: VideoProcessRequest):
    """
    Process a YouTube video:
    1. Extract video ID from URL
    2. Fetch transcript
    3. Chunk and index transcript in MongoDB
    """
    try:
        video_id = _extract_video_id(req.video_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if already indexed
    existing = videos_col.find_one({"video_id": video_id})
    if existing:
        return VideoProcessResponse(
            video_id=video_id,
            title=existing.get("title", video_id),
            total_chunks=len(existing.get("chunks", [])),
            message="Video already indexed.",
        )

    # Fetch & chunk transcript
    try:
        raw_transcript = _fetch_transcript(video_id)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    chunks = _chunk_transcript(raw_transcript, chunk_size=5)

    # Store in MongoDB
    doc = {
        "video_id": video_id,
        "user_id": req.user_id,
        "url": req.video_url,
        "title": video_id,  # YouTube Data API would give real title
        "chunks": chunks,
    }
    videos_col.replace_one({"video_id": video_id}, doc, upsert=True)

    return VideoProcessResponse(
        video_id=video_id,
        title=video_id,
        total_chunks=len(chunks),
        message="Video processed and indexed successfully.",
    )


@router.post("/video/snippets", response_model=SnippetResponse)
async def get_relevant_snippets(req: SnippetRequest):
    """
    Return the most relevant transcript snippets for a query.
    Uses Gemini to rank chunks by relevance.
    """
    doc = videos_col.find_one({"video_id": req.video_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Video {req.video_id} not found. Process it first.")

    chunks = doc.get("chunks", [])
    if not chunks:
        raise HTTPException(status_code=404, detail="No transcript chunks available for this video.")

    # Build a numbered list of chunks for the LLM
    chunk_list = "\n".join(
        f"[{i}] (start={c['start']}s) {c['text']}" for i, c in enumerate(chunks)
    )

    prompt = f"""You are a helpful assistant. Given the user's query and a list of transcript chunks
from a video, pick the top {req.top_k} most relevant chunks.

Query: "{req.query}"

Transcript chunks:
{chunk_list}

Return ONLY a JSON array of objects, each with:
- "index": the chunk index number
- "relevance_summary": a one-sentence explanation of why this chunk is relevant

Order from most to least relevant. Return ONLY valid JSON.
"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Strip markdown fences
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        import json
        ranked = json.loads(text)

        snippets = []
        for item in ranked[: req.top_k]:
            idx = int(item["index"])
            if 0 <= idx < len(chunks):
                c = chunks[idx]
                snippets.append(
                    Snippet(
                        text=c["text"],
                        start=c["start"],
                        duration=c["duration"],
                        relevance_summary=item.get("relevance_summary", ""),
                    )
                )

        return SnippetResponse(video_id=req.video_id, query=req.query, snippets=snippets)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

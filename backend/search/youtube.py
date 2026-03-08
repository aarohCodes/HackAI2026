"""
youtube.py — YouTube educational video search via YouTube Data API.
Adapted from nikhil branch with auth integration.
"""

import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from googleapiclient.discovery import build
from pydantic import BaseModel

from database.models import User
from deps import get_current_user

load_dotenv()

router = APIRouter(tags=["youtube"])


class YouTubeResult(BaseModel):
    video_id: str
    title: str
    description: str
    thumbnail_url: str
    video_url: str
    channel_name: str


class YouTubeSearchResponse(BaseModel):
    query: str
    youtube_result: YouTubeResult


class SearchRequest(BaseModel):
    query: str
    user_id: str | None = None


async def search_youtube(query: str) -> YouTubeResult:
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY environment variable is not set")

    try:
        youtube = build("youtube", "v3", developerKey=api_key)
        search_response = (
            youtube.search()
            .list(
                q=f"{query} tutorial explained",
                part="snippet",
                type="video",
                maxResults=1,
            )
            .execute()
        )
    except Exception as exc:
        error_msg = str(exc)
        if "quotaExceeded" in error_msg or "quota" in error_msg.lower():
            raise RuntimeError(
                "YouTube API quota exceeded. Please try again later."
            ) from exc
        raise RuntimeError(f"YouTube API error: {exc}") from exc

    items = search_response.get("items", [])
    if not items:
        raise RuntimeError(f"No YouTube results found for query: {query}")

    snippet = items[0]["snippet"]
    video_id = items[0]["id"]["videoId"]

    return YouTubeResult(
        video_id=video_id,
        title=snippet.get("title", ""),
        description=snippet.get("description", ""),
        thumbnail_url=snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
        video_url=f"https://youtube.com/watch?v={video_id}",
        channel_name=snippet.get("channelTitle", ""),
    )


@router.post("/youtube", response_model=YouTubeSearchResponse)
async def youtube(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> YouTubeSearchResponse:
    try:
        youtube_result = await search_youtube(request.query)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return YouTubeSearchResponse(
        query=request.query, youtube_result=youtube_result
    )

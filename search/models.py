from typing import Optional

from pydantic import BaseModel


class WebResult(BaseModel):
    """A single web search result from Tavily."""

    url: str
    title: str
    raw_content: Optional[str] = None


class YouTubeResult(BaseModel):
    """A single YouTube video result."""

    video_id: str
    title: str
    description: str
    thumbnail_url: str
    video_url: str
    channel_name: str


class WebSearchResponse(BaseModel):
    """Response for the /search endpoint containing web results."""

    query: str
    web_results: list[WebResult]


class YouTubeSearchResponse(BaseModel):
    """Response for the /youtube endpoint containing a YouTube result."""

    query: str
    youtube_result: YouTubeResult


class SearchRequest(BaseModel):
    """Request body for search endpoints."""

    query: str
    user_id: str | None = None

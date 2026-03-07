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


class SearchResponse(BaseModel):
    """Combined response containing web and YouTube search results."""

    query: str
    web_results: list[WebResult]
    youtube_result: YouTubeResult | None = None


class SearchRequest(BaseModel):
    """Request body for the /search/retrieve endpoint."""

    query: str
    user_id: str | None = None

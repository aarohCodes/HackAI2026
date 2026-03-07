import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from tavily import AsyncTavilyClient

load_dotenv()

router = APIRouter(prefix="/search", tags=["search"])


class WebResult(BaseModel):
    """A single web search result from Tavily."""

    url: str
    title: str
    raw_content: Optional[str] = None


class WebSearchResponse(BaseModel):
    """Response for the /search endpoint containing web results."""

    query: str
    web_results: list[WebResult]


class SearchRequest(BaseModel):
    """Request body for search endpoints."""

    query: str
    user_id: str | None = None


async def search_web(query: str) -> list[WebResult]:
    """Search the web using the Tavily API and return the top 2 results.

    Args:
        query: The search query string.

    Returns:
        A list of the top 2 WebResult objects.

    Raises:
        RuntimeError: If the Tavily API call fails.
    """
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError("TAVILY_API_KEY environment variable is not set")

    try:
        client = AsyncTavilyClient(api_key=api_key)
        response = await client.search(
            query=query,
            search_depth="advanced",
            max_results=2,
            include_raw_content=True,
        )
    except Exception as exc:
        raise RuntimeError(f"Tavily API error: {exc}") from exc

    results: list[WebResult] = []
    for item in response.get("results", [])[:2]:
        results.append(
            WebResult(
                url=item.get("url", ""),
                title=item.get("title", ""),
                raw_content=item.get("raw_content"),
            )
        )
    return results


@router.post("/search", response_model=WebSearchResponse)
async def search(request: SearchRequest) -> WebSearchResponse:
    """Search the web using Tavily and return the top 2 results.

    Args:
        request: Contains the search query and an optional user_id.

    Returns:
        A WebSearchResponse with 2 web results.
    """
    try:
        web_results = await search_web(request.query)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return WebSearchResponse(
        query=request.query,
        web_results=web_results,
    )
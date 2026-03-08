"""
search.py — Web search via Tavily.
Adapted from nikhil branch with auth integration.
"""

import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from tavily import AsyncTavilyClient

from database.models import User
from deps import get_current_user

load_dotenv()

router = APIRouter(tags=["search"])


class WebResult(BaseModel):
    url: str
    title: str
    raw_content: Optional[str] = None


class WebSearchResponse(BaseModel):
    query: str
    web_results: list[WebResult]


class SearchRequest(BaseModel):
    query: str
    user_id: str | None = None


async def search_web(query: str) -> list[WebResult]:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return []  # Graceful degradation when key not configured

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
async def search(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> WebSearchResponse:
    try:
        web_results = await search_web(request.query)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return WebSearchResponse(query=request.query, web_results=web_results)

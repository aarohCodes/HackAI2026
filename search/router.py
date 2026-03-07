import asyncio

from fastapi import APIRouter, HTTPException

from search.models import SearchRequest, SearchResponse
from search.search_service import search_web, search_youtube

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/retrieve", response_model=SearchResponse)
async def retrieve(request: SearchRequest) -> SearchResponse:
    """Search the web and YouTube concurrently for the given query.

    Args:
        request: Contains the search query and an optional user_id.

    Returns:
        A SearchResponse with web results and a YouTube result.
    """
    web_task = asyncio.create_task(search_web(request.query))
    youtube_task = asyncio.create_task(search_youtube(request.query))

    web_results = []
    youtube_result = None

    try:
        results = await asyncio.gather(web_task, youtube_task, return_exceptions=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}") from exc

    # Process web results
    if isinstance(results[0], Exception):
        raise HTTPException(status_code=500, detail=f"Web search failed: {results[0]}")
    web_results = results[0]

    # Process YouTube result (non-fatal — return None if it fails)
    if isinstance(results[1], Exception):
        youtube_result = None
    else:
        youtube_result = results[1]

    return SearchResponse(
        query=request.query,
        web_results=web_results,
        youtube_result=youtube_result,
    )

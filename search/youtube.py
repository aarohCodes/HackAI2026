import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from googleapiclient.discovery import build

from search.models import SearchRequest, YouTubeResult, YouTubeSearchResponse

load_dotenv()

router = APIRouter(prefix="/search", tags=["youtube"])


async def search_youtube(query: str) -> YouTubeResult:
    """Search YouTube for the most relevant educational video.

    Appends 'tutorial explained' to the query to bias toward educational content.

    Args:
        query: The search query string.

    Returns:
        A YouTubeResult for the top matching video.

    Raises:
        RuntimeError: If the YouTube API call fails or no results are found.
    """
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
            raise RuntimeError("YouTube API quota exceeded. Please try again later.") from exc
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
async def youtube(request: SearchRequest) -> YouTubeSearchResponse:
    """Search YouTube for the most relevant educational video.

    Args:
        request: Contains the search query and an optional user_id.

    Returns:
        A YouTubeSearchResponse with a single video result.
    """
    try:
        youtube_result = await search_youtube(request.query)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return YouTubeSearchResponse(
        query=request.query,
        youtube_result=youtube_result,
    )

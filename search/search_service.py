import os

from dotenv import load_dotenv
from tavily import AsyncTavilyClient
from googleapiclient.discovery import build

from search.models import WebResult, YouTubeResult

load_dotenv()


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

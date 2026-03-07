"""Integration tests for the search module.

Run with: pytest tests/test_search.py -m integration
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from search.search import router as search_router, search_web
from search.youtube import router as youtube_router, search_youtube


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(search_router)
    app.include_router(youtube_router)
    return app


# ---------------------------------------------------------------------------
# Service-level tests (hit live APIs)
# ---------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.asyncio
async def test_search_web_returns_two_results():
    """search_web should return exactly 2 WebResult objects with url and title."""
    results = await search_web("python decorators")

    assert len(results) == 2
    for r in results:
        assert isinstance(r.url, str) and r.url != ""
        assert isinstance(r.title, str) and r.title != ""


@pytest.mark.integration
@pytest.mark.asyncio
async def test_search_youtube_returns_result():
    """search_youtube should return a YouTubeResult with a valid video_id and url."""
    result = await search_youtube("python decorators")

    assert isinstance(result.video_id, str) and result.video_id != ""
    assert result.video_url.startswith("https://youtube.com/watch?v=")
    assert result.channel_name != ""


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_search_endpoint():
    """POST /search/search should return 200 with query and web_results."""
    app = _make_app()
    client = TestClient(app)

    response = client.post(
        "/search/search",
        json={"query": "machine learning basics"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "machine learning basics"
    assert isinstance(data["web_results"], list)
    assert len(data["web_results"]) == 2


@pytest.mark.integration
def test_youtube_endpoint():
    """POST /search/youtube should return 200 with query and youtube_result."""
    app = _make_app()
    client = TestClient(app)

    response = client.post(
        "/search/youtube",
        json={"query": "machine learning basics"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "machine learning basics"
    assert "youtube_result" in data
    assert data["youtube_result"]["video_id"] != ""
    assert data["youtube_result"]["video_url"].startswith("https://youtube.com/watch?v=")

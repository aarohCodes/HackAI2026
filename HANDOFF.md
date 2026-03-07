# Search Module — Handoff for Integration

## 1. Install dependencies

```bash
pip install fastapi uvicorn tavily-python google-api-python-client pydantic python-dotenv httpx
```

For running integration tests you also need:

```bash
pip install pytest pytest-asyncio
```

## 2. Environment variables

Create a `.env` file in the project root with:

```
TAVILY_API_KEY=<your-tavily-api-key>
YOUTUBE_API_KEY=<your-youtube-data-api-v3-key>
```

The module loads these via `python-dotenv` at import time.

## 3. Register the router

In your main FastAPI app:

```python
from fastapi import FastAPI
from search.search import router as search_router
from search.youtube import router as youtube_router

app = FastAPI()
app.include_router(search_router)
app.include_router(youtube_router)
```

This adds two endpoints:
- **POST `/search/search`** — web search (Tavily)
- **POST `/search/youtube`** — YouTube video search

## 4. Endpoint details

Both endpoints accept the same request body:

```json
{
  "query": "python decorators",
  "user_id": "optional-mongo-user-id"
}
```

`user_id` is optional and reserved for future MongoDB-based personalization.

### POST `/search/search` — `WebSearchResponse`

```json
{
  "query": "python decorators",
  "web_results": [
    {
      "url": "https://realpython.com/primer-on-python-decorators/",
      "title": "Primer on Python Decorators",
      "raw_content": "<!DOCTYPE html><html>...full page HTML/text from Tavily..."
    },
    {
      "url": "https://www.datacamp.com/tutorial/decorators-python",
      "title": "How to Use Python Decorators",
      "raw_content": "# How to Use Python Decorators\n\nLearn Python decorators..."
    }
  ]
}
```

Always returns exactly 2 web results.

### POST `/search/youtube` — `YouTubeSearchResponse`

```json
{
  "query": "python decorators",
  "youtube_result": {
    "video_id": "3tyaO-OE0K0",
    "title": "Python Decorators - Visually Explained",
    "description": "Resources & Further Learning...",
    "thumbnail_url": "https://i.ytimg.com/vi/3tyaO-OE0K0/hqdefault.jpg",
    "video_url": "https://youtube.com/watch?v=3tyaO-OE0K0",
    "channel_name": "Visually Explained"
  }
}
```

Returns a 500 if YouTube quota is exceeded or no results are found.

## 5. What is `raw_content`?

`raw_content` is the full HTML/text body that Tavily returns for each search result. This is the field you should pass downstream to **Firecrawl** for cleaned extraction, summarization, or chunking. It can be `null` if Tavily couldn't fetch the page content.

## 6. Known rate limits

| Service | Free tier limit | Notes |
|---------|----------------|-------|
| **Tavily** | 1,000 searches/month on the free plan | Advanced search depth counts as 1 search |
| **YouTube Data API v3** | 10,000 quota units/day | Each `search.list` call costs 100 units, so ~100 searches/day |

YouTube quota errors return a 500 with a descriptive message from the `/youtube` endpoint.

## 7. Running integration tests

These tests hit live APIs, so make sure your `.env` keys are set.

```bash
# Run only integration tests
pytest tests/test_search.py -m integration -v

# Skip integration tests (e.g., in CI)
pytest -m "not integration"
```

import os
import sys
import httpx
from dotenv import load_dotenv
from google import genai
from pymongo import MongoClient
from datetime import datetime, timezone

load_dotenv()

FIRECRAWL_SERVER_URL = os.getenv("FIRECRAWL_SERVER_URL", "http://localhost:8000")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "hackai2026")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "embeddings")
EMBEDDING_MODEL = "models/gemini-embedding-001"

_genai_client = genai.Client(api_key=GEMINI_API_KEY, http_options={"api_version": "v1beta"})

_mongo_client = MongoClient(MONGODB_URI)
collection = _mongo_client[MONGODB_DB][MONGODB_COLLECTION]


def embed_text(text: str) -> list[float]:
    result = _genai_client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values


def index_url(url: str) -> dict:
    """Scrape a URL via the firecrawl server, embed each chunk, and store in MongoDB."""
    with httpx.Client() as http:
        response = http.post(
            f"{FIRECRAWL_SERVER_URL}/firecrawl",
            json={"url": url},
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()

    page_url = data["url"]
    title = data["title"]
    chunks: list[str] = data["chunks"]

    # Remove any existing docs for this URL before re-indexing
    collection.delete_many({"url": page_url})

    docs = []
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk)
        docs.append({
            "url": page_url,
            "title": title,
            "chunk_index": i,
            "text": chunk,
            "embedding": embedding,
            "indexed_at": datetime.now(timezone.utc),
        })

    if docs:
        collection.insert_many(docs)

    return {
        "url": page_url,
        "title": title,
        "chunks_indexed": len(docs),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python indexing.py <url>")
        sys.exit(1)

    target_url = sys.argv[1]
    print(f"Indexing: {target_url}")
    result = index_url(target_url)
    print(f"Stored {result['chunks_indexed']} chunks for \"{result['title']}\"")

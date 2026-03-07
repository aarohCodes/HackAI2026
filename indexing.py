import os
import sys
import json
from dotenv import load_dotenv
from google import genai
from pymongo import MongoClient
from datetime import datetime, timezone

load_dotenv()

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


def index_scraped_data(data: dict) -> dict:
    """Embed each chunk from pre-scraped firecrawl output and store in MongoDB."""
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
    # Reads JSON from a file path argument or stdin (piped from firecrawl_server output)
    if len(sys.argv) >= 2:
        with open(sys.argv[1]) as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)

    print(f"Indexing: {data['url']}")
    result = index_scraped_data(data)
    print(f"Stored {result['chunks_indexed']} chunks for \"{result['title']}\"")

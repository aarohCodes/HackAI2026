import os
import sys
import httpx
from dotenv import load_dotenv
from indexing import index_scraped_data

load_dotenv()

FIRECRAWL_SERVER_URL = os.getenv("FIRECRAWL_SERVER_URL", "http://localhost:8000")


def run(url: str) -> dict:
    with httpx.Client() as http:
        response = http.post(
            f"{FIRECRAWL_SERVER_URL}/firecrawl",
            json={"url": url},
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()

    return index_scraped_data(data)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <url>")
        sys.exit(1)

    result = run(sys.argv[1])
    print(f"Stored {result['chunks_indexed']} chunks for \"{result['title']}\"")

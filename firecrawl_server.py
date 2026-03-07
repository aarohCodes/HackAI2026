from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from firecrawl import FirecrawlApp
import re
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

firecrawl = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    url: str
    title: str
    chunks: list[str]
    raw_markdown: str


def chunk_text(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks suitable for embedding."""
    # Split on paragraph boundaries first
    paragraphs = re.split(r"\n{2,}", text.strip())

    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 2 <= max_chunk_size:
            current_chunk = (current_chunk + "\n\n" + para).strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Start next chunk with overlap from end of previous
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = (overlap_text + "\n\n" + para).strip()
            else:
                # Single paragraph exceeds max size, split by sentences
                sentences = re.split(r"(?<=[.!?])\s+", para)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 1 <= max_chunk_size:
                        current_chunk = (current_chunk + " " + sentence).strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


@app.post("/firecrawl", response_model=ScrapeResponse)
def scrape(request: ScrapeRequest):
    try:
        result = firecrawl.scrape(request.url, formats=["markdown"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Firecrawl error: {str(e)}")

    markdown = result.markdown or ""
    title = getattr(result.metadata, "title", "") or request.url

    if not markdown:
        raise HTTPException(status_code=422, detail="No content returned for the given URL.")

    chunks = chunk_text(markdown)

    return ScrapeResponse(
        url=request.url,
        title=title,
        chunks=chunks,
        raw_markdown=markdown,
    )

"""
scrape.py — URL scraping via Firecrawl with text chunking.
Adapted from nikhil/karthik-dev firecrawl_server.py with auth integration.
"""

import os
import re

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from firecrawl import FirecrawlApp

from database.models import User
from deps import get_current_user

load_dotenv()

router = APIRouter(tags=["scrape"])

_firecrawl = None


def _get_firecrawl() -> FirecrawlApp:
    global _firecrawl
    if _firecrawl is None:
        api_key = os.getenv("FIRECRAWL_API_KEY")
        if not api_key:
            raise RuntimeError("FIRECRAWL_API_KEY environment variable is not set")
        _firecrawl = FirecrawlApp(api_key=api_key)
    return _firecrawl


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    url: str
    title: str
    chunks: list[str]
    raw_markdown: str


def chunk_text(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks: list[str] = []
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
                overlap_text = (
                    current_chunk[-overlap:]
                    if len(current_chunk) > overlap
                    else current_chunk
                )
                current_chunk = (overlap_text + "\n\n" + para).strip()
            else:
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


@router.post("/firecrawl", response_model=ScrapeResponse)
async def scrape(
    request: ScrapeRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        fc = _get_firecrawl()
        result = fc.scrape(request.url, formats=["markdown"])
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Firecrawl error: {exc}")

    markdown = result.markdown or ""
    title = getattr(result.metadata, "title", "") or request.url

    if not markdown:
        raise HTTPException(
            status_code=422, detail="No content returned for the given URL."
        )

    chunks = chunk_text(markdown)

    return ScrapeResponse(
        url=request.url, title=title, chunks=chunks, raw_markdown=markdown
    )

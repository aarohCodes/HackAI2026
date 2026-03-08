import os
import asyncio
import httpx
from dotenv import load_dotenv

from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from search.search import search_web
from search.youtube import search_youtube
from indexing import index_scraped_data

load_dotenv()

FIRECRAWL_SERVER_URL = os.getenv("FIRECRAWL_SERVER_URL", "http://localhost:8000")


# ── LangChain tools wrapping existing search functions ──────────────────────

@tool
async def web_search(query: str) -> str:
    """Search the web for relevant articles and websites about a topic.
    Returns URLs and titles of the top results."""
    results = await search_web(query)
    if not results:
        return "No web results found."
    lines = []
    for r in results:
        lines.append(f"- {r.title}: {r.url}")
    return "\n".join(lines)


@tool
async def youtube_search(query: str) -> str:
    """Search YouTube for relevant educational videos about a topic.
    Returns the top video with title, channel, and URL."""
    result = await search_youtube(query)
    return (
        f"Title: {result.title}\n"
        f"Channel: {result.channel_name}\n"
        f"URL: {result.video_url}\n"
        f"Description: {result.description}"
    )


# ── Pipeline: scrape via firecrawl then index ───────────────────────────────

def scrape_and_index(url: str) -> dict:
    """Send a URL to the firecrawl server, then index the chunks."""
    with httpx.Client() as http:
        response = http.post(
            f"{FIRECRAWL_SERVER_URL}/firecrawl",
            json={"url": url},
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
    return index_scraped_data(data)


# ── Agent setup ─────────────────────────────────────────────────────────────

def build_agent():
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    tools = [web_search, youtube_search]
    return create_react_agent(llm, tools)


async def run(query: str) -> dict:
    """Run the full pipeline: agent searches → scrape URLs → index embeddings."""
    agent = build_agent()

    # Let the agent search for information
    result = await agent.ainvoke(
        {"messages": [("user", f"Find the best web resources and a YouTube video about: {query}")]}
    )

    # Extract URLs from tool call results to scrape and index
    urls_to_index = []
    youtube_results = []

    for msg in result["messages"]:
        # Look for tool messages that contain URLs from web_search
        if hasattr(msg, "name") and msg.name == "web_search" and hasattr(msg, "content"):
            for line in msg.content.split("\n"):
                if line.startswith("- ") and ": http" in line:
                    url = line.split(": ", 1)[1].strip()
                    urls_to_index.append(url)
        # Capture YouTube results
        if hasattr(msg, "name") and msg.name == "youtube_search" and hasattr(msg, "content"):
            youtube_results.append(msg.content)

    # Scrape and index each discovered URL via firecrawl
    indexed = []
    for url in urls_to_index:
        try:
            idx_result = scrape_and_index(url)
            indexed.append(idx_result)
            print(f"  Indexed {idx_result['chunks_indexed']} chunks from: {url}")
        except Exception as e:
            print(f"  Failed to index {url}: {e}")

    # Get the agent's final response
    final_message = result["messages"][-1].content

    return {
        "query": query,
        "agent_response": final_message,
        "urls_indexed": indexed,
        "youtube": youtube_results,
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python main.py \"<query>\"")
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    print(f"Query: {query}\n")

    output = asyncio.run(run(query))

    print(f"\n{'='*60}")
    print(f"Agent Response:\n{output['agent_response']}")
    print(f"\nIndexed {len(output['urls_indexed'])} pages into MongoDB.")
    if output["youtube"]:
        print(f"\nYouTube:\n{output['youtube'][0]}")

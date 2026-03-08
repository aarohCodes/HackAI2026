from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.connection import connect_db, close_db
import os
from dotenv import load_dotenv

# Our core routers (auth, graph, gamification, gemini, assess, users)
import auth, users, graph, gemini, gamification, assess

# Aaroh's routers (flowchart, summary, quiz, video)
import flowchart, summary, quiz_gen, video

# Nikhil/karthik-dev search routers (web search, youtube search, scrape)
from search.search import router as search_web_router
from search.youtube import router as search_youtube_router
from search.scrape import router as search_scrape_router

# YouTube snippet adapter (bridges frontend → search/youtube + video processing)
import youtube_adapter

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="Cortex API",
    version="1.0.0",
    description="AI-Powered Adaptive Learning Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Our core routes ─────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(gemini.router, prefix="/api/gemini", tags=["gemini"])
app.include_router(gamification.router, prefix="/api/gamification", tags=["gamification"])
app.include_router(assess.router, prefix="/api/assess", tags=["assessment"])

# ── Aaroh's routes (flowchart, summary, quiz, video/snippets) ───────────────
app.include_router(flowchart.router, prefix="/api", tags=["flowchart"])
app.include_router(summary.router, prefix="/api", tags=["summary"])
app.include_router(quiz_gen.router, prefix="/api", tags=["quiz"])
app.include_router(video.router, prefix="/api", tags=["video"])

# ── Nikhil/karthik-dev search routes (web, youtube, scrape) ────────────────
app.include_router(search_web_router, prefix="/api/search", tags=["search"])
app.include_router(search_youtube_router, prefix="/api/search", tags=["search"])
app.include_router(search_scrape_router, prefix="/api", tags=["scrape"])
app.include_router(youtube_adapter.router, prefix="/api", tags=["youtube-adapter"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "cortex"}

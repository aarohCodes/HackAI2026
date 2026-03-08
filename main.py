"""
main.py - FastAPI application entry point for SkillForge (Aaroh) backend.

Run with:  uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flowchart import router as flowchart_router
from summary import router as summary_router
from quiz import router as quiz_router
from video import router as video_router

app = FastAPI(
    title="SkillForge – Aaroh Backend",
    description="AI-powered learning backend: flowcharts, summaries, quizzes, and video processing.",
    version="1.0.0",
)

# CORS – allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(flowchart_router, tags=["Flowchart"])
app.include_router(summary_router, tags=["Summary"])
app.include_router(quiz_router, tags=["Quiz"])
app.include_router(video_router, tags=["Video Processing"])


@app.get("/")
async def root():
    return {
        "service": "SkillForge – Aaroh Backend",
        "endpoints": ["/flowchart", "/summary", "/quiz", "/video/process", "/video/snippets"],
        "docs": "/docs",
    }

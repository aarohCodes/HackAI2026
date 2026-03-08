from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.connection import connect_db, close_db
from api import auth, users, graph, decay, gemini, youtube, gamification, assess, search
import os
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="CogniPath API",
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

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(decay.router, prefix="/api/decay", tags=["decay"])
app.include_router(gemini.router, prefix="/api/gemini", tags=["gemini"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(gamification.router, prefix="/api/gamification", tags=["gamification"])
app.include_router(assess.router, prefix="/api/assess", tags=["assessment"])
app.include_router(search.router, prefix="/api/search", tags=["search"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "cognipath"}

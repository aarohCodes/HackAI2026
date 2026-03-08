from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class NodeState(str, Enum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"
    FADING = "fading"
    GLOW = "glow"


class LearningMode(str, Enum):
    TEACH = "teach"
    DEFEND = "defend"
    CONNECT = "connect"
    QUICK = "quick"
    STRUGGLE = "struggle"


class AchievementRarity(str, Enum):
    COMMON = "common"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


# ── Embedded sub-models ──────────────────────────────────────────


class NodeSnapshot(BaseModel):
    """Point-in-time snapshot of a node for timeline history."""
    node_id: str
    concept: str
    state: NodeState
    retention_rt: float
    canvas_x: float
    canvas_y: float


class CanvasSnapshot(BaseModel):
    """Full canvas state at a point in time."""
    date: datetime
    nodes: List[NodeSnapshot]


# ── Documents ────────────────────────────────────────────────────


class User(Document):
    name: str
    email: str
    hashed_password: Optional[str] = None
    goal: str = ""
    background: str = ""
    prior_history: Optional[str] = None
    learner_type: str = "gradual"
    topics: List[str] = Field(default_factory=list)

    # Gamification
    xp: int = 0
    level: int = 1
    level_title: str = "Novice"
    streak_days: int = 0
    last_active_date: Optional[datetime] = None
    daily_xp: int = 0
    daily_xp_goal: int = 500
    achievements: List[str] = Field(default_factory=list)
    skill_points: dict = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = ["email"]


class ConceptNode(Document):
    user_id: PydanticObjectId
    concept: str
    domain: str
    complexity_tier: int = 1
    dependency_depth: int = 0
    state: NodeState = NodeState.RED
    mode: Optional[LearningMode] = None
    mastery_score: float = 0.0
    stability_s: float = 1.0
    retention_rt: float = 1.0
    last_reviewed: Optional[datetime] = None
    review_count: int = 0
    canvas_x: float = 0.0
    canvas_y: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "concept_nodes"
        indexes = ["user_id", "concept"]


class LearningEvent(Document):
    user_id: PydanticObjectId
    node_id: PydanticObjectId
    event_type: str
    duration_seconds: int = 0
    success: Optional[bool] = None
    confidence_before: Optional[float] = None
    confidence_after: Optional[float] = None
    source: str = "inapp"
    metadata: Optional[dict] = None
    xp_earned: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "learning_events"
        indexes = ["user_id", "node_id", "created_at"]


class Recommendation(Document):
    node_id: PydanticObjectId
    user_id: PydanticObjectId
    gemini_reasoning: str
    practice_scenario: str
    youtube_video_id: Optional[str] = None
    youtube_title: Optional[str] = None
    timestamp_start: Optional[int] = None
    timestamp_end: Optional[int] = None
    snippet_reason: Optional[str] = None
    learning_mode: Optional[LearningMode] = None
    dismissed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "recommendations"
        indexes = ["node_id", "user_id"]


class KnowledgeEdge(Document):
    user_id: PydanticObjectId
    from_node_id: PydanticObjectId
    to_node_id: PydanticObjectId
    edge_type: str = "prerequisite"

    class Settings:
        name = "knowledge_edges"
        indexes = ["user_id"]


class Achievement(Document):
    key: str
    name: str
    description: str
    icon: str
    condition: str
    xp_reward: int = 50
    rarity: AchievementRarity = AchievementRarity.COMMON

    class Settings:
        name = "achievements"
        indexes = ["key"]


class GeminiRateLimit(Document):
    """Tracks Gemini API calls per user per node for rate limiting."""
    user_id: PydanticObjectId
    node_id: PydanticObjectId
    last_called: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "gemini_rate_limits"
        indexes = ["user_id", "node_id"]


# All document models for init_beanie registration
ALL_MODELS = [
    User,
    ConceptNode,
    LearningEvent,
    Recommendation,
    KnowledgeEdge,
    Achievement,
    GeminiRateLimit,
]

# CLAUDE.md — pondr Development Guide

## Project Overview

pondr is an AI-powered adaptive learning platform for the Dallas AI Hackathon 2026. It uses a knowledge graph canvas (React Flow), ML-based knowledge decay prediction (XGBoost + Ebbinghaus curves), Google Gemini AI for personalized learning, and a YouTube snippet pipeline for targeted video learning.

**Hackathon Tracks**: Dallas AI + Data Science / ML

---

## Architecture

```
Frontend (React + Vite)  →  Backend (FastAPI)  →  MongoDB (Beanie ODM)
                                    ↓
                          Google Gemini API
                          YouTube Data API v3
                          XGBoost ML Model
```

### Key Technology Decisions
- **MongoDB + Beanie ODM** instead of PostgreSQL + SQLAlchemy (original spec). All models are async Beanie `Document` classes using Motor driver.
- **JWT Authentication** — email/password registration and login. All API endpoints (except `/api/auth/*` and `/api/health`) require a `Bearer` token. The token carries `sub` (user ObjectId) and `email`. Frontend stores token in `localStorage` and sends it via Axios interceptor.
- **Gamification layer** added on top of original spec: XP, levels, streaks, achievements, daily goals.
- **Chrome extension** is deferred — do not build unless explicitly asked.

### Auth Flow
1. User registers at `POST /api/auth/register` → gets JWT token + user object
2. User logs in at `POST /api/auth/login` → gets JWT token + user object
3. Token is stored in `localStorage` as `pondr_token`
4. All subsequent API calls include `Authorization: Bearer <token>` via Axios interceptor
5. Backend extracts user from token via `get_current_user` dependency (`backend/api/deps.py`)
6. If user has not onboarded (`goal` is empty), frontend routes to `/onboarding`
7. Onboarding updates the existing user record (does NOT create a new one)
8. On 401 response, frontend clears token and redirects to `/login`
9. Demo user: `alex@pondr.dev` / `demo1234` (created by seed script)

---

## Environment Variables

The `.env` file lives at the project root. See `example.env` for the template.

Required variables:
- `MONGO_DB_URI` — MongoDB connection string
- `MONGO_DB_NAME` — Database name (default: `pondr`)
- `GEMINI_API_KEY` — Google Gemini API key (for AI features)
- `YOUTUBE_API_KEY` — YouTube Data API v3 key (separate from Gemini)
- `SECRET_KEY` — App secret for JWT signing
- `CORS_ORIGINS` — Comma-separated allowed origins
- `DECAY_THRESHOLD` — Retention threshold for decay alerts (default: 0.70)
- `DECAY_ALERT_WINDOW_DAYS` — Days window for decay alerts (default: 3)

---

## Directory Structure

All import paths assume this layout. Do not deviate.

```
HackAI2026/
├── .env                           # API keys (never commit)
├── example.env                    # Template for .env
├── .gitignore
├── README.md
├── CLAUDE.md                      # This file
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt           # Python dependencies
│   ├── database/
│   │   ├── __init__.py
│   │   ├── models.py              # Beanie Document models
│   │   ├── connection.py          # Motor client + init_beanie()
│   │   └── seed.py                # Demo data seeder
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── generate_dataset.py    # 1000 synthetic learners
│   │   ├── train_model.py         # XGBoost training + metrics
│   │   ├── predict.py             # Inference + retention scoring
│   │   └── evaluate.py            # RMSE, MAE, lift computation
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py                # POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
│   │   ├── deps.py                # get_current_user dependency (JWT Bearer)
│   │   ├── users.py               # POST /api/users/onboard, GET /api/users/me
│   │   ├── graph.py               # GET /api/graph/canvas, POST /api/graph/event, etc.
│   │   ├── decay.py               # POST /api/decay/run, GET /api/decay/scores
│   │   ├── gemini.py              # POST /api/gemini/recommend, feynman, socratic
│   │   ├── youtube.py             # POST /api/youtube/snippet
│   │   └── gamification.py        # GET /api/gamification/stats, etc.
│   └── services/
│       ├── __init__.py
│       ├── auth_service.py        # JWT create/decode, password hash/verify (bcrypt)
│       ├── gemini_service.py      # All Gemini prompt templates + retry logic
│       ├── youtube_service.py     # YouTube search + transcript + Gemini timestamps
│       ├── graph_service.py       # NetworkX graph operations
│       └── gamification_service.py # XP, levels, streaks, achievements
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css              # Tailwind imports + custom styles
│       ├── api/
│       │   └── client.js          # Axios instance
│       ├── store/
│       │   └── useStore.js        # Zustand global state
│       ├── pages/
│       │   ├── Login.jsx          # Register / Login form (JWT auth)
│       │   ├── Onboarding.jsx     # Goal + background input → Gemini graph init
│       │   ├── Canvas.jsx         # Main React Flow canvas
│       │   ├── Metrics.jsx        # ML dashboard (recharts)
│       │   └── Assessment.jsx     # Mastery assessment modes
│       ├── components/
│       │   ├── canvas/
│       │   │   ├── ConceptNode.jsx
│       │   │   ├── RecommendationCard.jsx
│       │   │   ├── TimelineScrubber.jsx
│       │   │   └── NodeModeIcon.jsx
│       │   ├── learning/
│       │   │   ├── FeynmanChallenge.jsx
│       │   │   ├── SocraticDebate.jsx
│       │   │   ├── QuickSnapshot.jsx
│       │   │   └── VideoSnippet.jsx
│       │   ├── gamification/
│       │   │   ├── XPBar.jsx
│       │   │   ├── StreakCounter.jsx
│       │   │   ├── AchievementToast.jsx
│       │   │   ├── LevelBadge.jsx
│       │   │   └── DailyGoalRing.jsx
│       │   └── ui/
│       │       ├── Sidebar.jsx
│       │       └── MetricsPanel.jsx
│       └── hooks/
│           ├── useDecayMonitor.js
│           ├── useTracker.js
│           └── useGamification.js
└── extension/                     # DEFERRED — do not build yet
    ├── manifest.json
    ├── background.js
    ├── content.js
    └── popup.html
```

---

## Database Models (MongoDB + Beanie)

All models in `backend/database/models.py` using Beanie `Document` base class.

### User
```python
class User(Document):
    name: str
    email: str                        # unique
    goal: str                         # "I want to learn ML"
    background: str                   # "I know Python and stats"
    prior_history: Optional[str]      # free text learning history
    learner_type: str                 # "binge" | "gradual" | "consistent"
    xp: int = 0                       # gamification
    level: int = 1
    level_title: str = "Novice"
    streak_days: int = 0
    last_active_date: Optional[datetime]
    daily_xp: int = 0
    daily_xp_goal: int = 500
    achievements: List[str] = []      # achievement IDs
    created_at: datetime

    class Settings:
        name = "users"
```

### ConceptNode
```python
class ConceptNode(Document):
    user_id: PydanticObjectId
    concept: str                      # "backpropagation"
    domain: str                       # "machine_learning"
    complexity_tier: int              # 1=basic, 2=intermediate, 3=advanced
    dependency_depth: int             # hops from root
    state: NodeState                  # red | yellow | green | fading | glow
    mode: Optional[LearningMode]     # teach | defend | connect | quick | struggle
    mastery_score: float = 0.0       # 0.0 to 1.0
    stability_s: float = 1.0         # Ebbinghaus S parameter
    retention_rt: float = 1.0        # predicted retention
    last_reviewed: Optional[datetime]
    review_count: int = 0
    canvas_x: float = 0.0
    canvas_y: float = 0.0
    created_at: datetime

    class Settings:
        name = "concept_nodes"
```

### LearningEvent
```python
class LearningEvent(Document):
    user_id: PydanticObjectId
    node_id: PydanticObjectId
    event_type: str                   # view | rewatch | search | practice | feynman | snapshot
    duration_seconds: int
    success: Optional[bool]
    confidence_before: Optional[float]
    confidence_after: Optional[float]
    source: str                       # "inapp" | "extension"
    metadata: Optional[dict]
    xp_earned: int = 0
    created_at: datetime

    class Settings:
        name = "learning_events"
```

### Recommendation
```python
class Recommendation(Document):
    node_id: PydanticObjectId
    gemini_reasoning: str
    practice_scenario: str
    youtube_video_id: Optional[str]
    youtube_title: Optional[str]
    timestamp_start: Optional[int]    # seconds
    timestamp_end: Optional[int]
    snippet_reason: Optional[str]
    dismissed: bool = False
    created_at: datetime

    class Settings:
        name = "recommendations"
```

### KnowledgeEdge
```python
class KnowledgeEdge(Document):
    user_id: PydanticObjectId
    from_node_id: PydanticObjectId
    to_node_id: PydanticObjectId
    edge_type: str                    # "prerequisite" | "related"

    class Settings:
        name = "knowledge_edges"
```

### Achievement
```python
class Achievement(Document):
    name: str
    description: str
    icon: str                         # emoji or icon name
    condition: str                    # machine-readable condition
    xp_reward: int
    rarity: str                       # common | rare | epic | legendary

    class Settings:
        name = "achievements"
```

---

## API Endpoints

All routes are in separate files under `backend/api/`. Each file has its own `APIRouter`. All endpoints (except Auth and Health) require `Authorization: Bearer <token>` header. The user is extracted from the JWT token — no `user_id` in URLs or request bodies.

### Auth (`backend/api/auth.py`) — PUBLIC (no token required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with name, email, password → token + user |
| POST | `/api/auth/login` | Login with email, password → token + user |
| GET | `/api/auth/me` | Rehydrate user from token (requires token) |

### Users (`backend/api/users.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users/onboard` | Complete onboarding: set goal/background, generate knowledge graph |
| GET | `/api/users/me` | Get current user's profile + gamification stats |
| GET | `/api/users/{user_id}` | Get user by ID (must be self) |

### Graph (`backend/api/graph.py`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/graph/canvas` | All nodes + edges for canvas rendering |
| POST | `/api/graph/event` | Log a behavioral signal |
| PATCH | `/api/graph/node/{id}/position` | Persist node drag position |
| GET | `/api/graph/history` | Historical snapshots for timeline scrubber |

### Decay (`backend/api/decay.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/decay/run` | Score all nodes, update DB, return alerts |
| GET | `/api/decay/scores` | Current retention scores + alert flags |
| GET | `/api/decay/metrics` | Return ML metrics.json |

### Gemini (`backend/api/gemini.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/gemini/recommend` | Context-aware recommendation from Gemini |
| POST | `/api/gemini/feynman` | Evaluate Feynman explanation |
| POST | `/api/gemini/socratic` | Start Socratic challenge |
| POST | `/api/gemini/socratic/reply` | Continue Socratic thread |
| POST | `/api/gemini/quick-snapshot` | Quick concept summary |

### YouTube (`backend/api/youtube.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/youtube/snippet` | Search + transcript + timestamp extraction |

### Gamification (`backend/api/gamification.py`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gamification/stats` | XP, level, streak, daily progress |
| POST | `/api/gamification/claim-daily` | Claim daily login bonus |
| GET | `/api/gamification/achievements` | All achievements + unlock status |
| GET | `/api/gamification/leaderboard` | Top learners by XP |

---

## ML Model Details

### What It Predicts
Retention R(t) for each user-concept pair. Range: 0.0 (forgotten) to 1.0 (perfect recall). Personalizes the Ebbinghaus stability parameter S based on 9 behavioral features.

### Features (10 total input)
1. `complexity_tier` — 1/2/3
2. `dependency_depth` — hops from root concept
3. `review_count` — total reviews
4. `spacing_score` — how well-spaced reviews are (0-1)
5. `time_spent_avg` — average minutes per session
6. `feynman_score` — ratio of successful Feynman challenges
7. `revisit_rate` — ratio of rewatch events
8. `practice_fail_rate` — ratio of failed practice attempts
9. `confidence_gap` — average |confidence_after - confidence_before|
10. `days_since_review` — days since last review

### Node State Mapping
- R >= 0.85 → `green` (mastered)
- R >= 0.70 → `yellow` (in progress)
- R >= 0.60 AND days_until_decay <= 3 → `fading` (decay alert)
- R < 0.60 → `red` (needs review)

### Edge Cases (MUST handle)
- `days_since_review = 0` → return retention 1.0 without calling model
- `last_reviewed is null` → set days_since_review = 99, return retention 0.0
- `review_count = 0` → skip model, return state='red'
- Clip all predictions to [0.0, 1.0]
- Model file not found → log warning, return 0.5 default

---

## Gemini Integration Rules

### Retry Logic
1. If Gemini returns invalid JSON → retry once with "return ONLY JSON, no other text" prefix
2. If fails twice → return hardcoded fallback with a note
3. Rate limit: max 1 call per user per node per 6 hours

### Edge Cases
- Feynman score of 0.0 (blank explanation) → do NOT update node state
- Socratic history must be passed on every turn (Gemini has no memory)
- Onboarding graph generation is the most important Gemini call

---

## YouTube Pipeline Rules

### Edge Cases
- Transcript API fails → skip video, try next
- No videos with captions → return null, show "No snippet available"
- Clamp `timestamp_start` to minimum 0
- If Gemini returns start > end → swap them
- Use privacy-enhanced mode: `youtube-nocookie.com`

---

## UI Design System

The UI MUST match the provided reference screenshots exactly. The design follows a **dark futuristic theme** with these specific characteristics:

### Color Palette
- **Background**: `#0A0F1E` (deep navy/black)
- **Card Background**: `#0D1B2A` / `#111827`
- **Card Border**: `#1E3A5F` / `rgba(46, 134, 171, 0.3)`
- **Primary Accent**: `#8B5CF6` (purple/violet)
- **Secondary Accent**: `#2DD4BF` / `#06B6D4` (teal/cyan)
- **Success**: `#10B981` (emerald green)
- **Warning**: `#F59E0B` (amber)
- **Danger**: `#EF4444` (red)
- **Fading/Neutral**: `#6B7280` (gray)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `rgba(255, 255, 255, 0.7)`
- **Text Muted**: `rgba(255, 255, 255, 0.4)`

### Typography
- Headings: Bold, large, sometimes with purple gradient text
- Body: Clean sans-serif (Inter or system)
- Accent labels: Uppercase, small, letter-spaced, colored (teal/purple)

### Component Patterns (from screenshots)
1. **Sidebar**: Dark panel, user avatar + name + level title at top, nav items with active state highlight (purple pill background), icons for each nav item
2. **Cards**: Rounded corners (12-16px), subtle border, dark background, sometimes with gradient overlays (purple-to-blue)
3. **Progress Bars**: Thin colored bars (teal/purple gradient) below items
4. **Stats Cards**: Row of metric cards with large numbers, colored labels
5. **Node Graph**: Circles of varying sizes with glow effects, connecting lines, floating particle dots on dark space background
6. **Buttons**: Rounded, filled with accent color, hover glow
7. **Search Bars**: Dark input with subtle border, search icon, rounded
8. **Badges/Tags**: Small pill-shaped colored tags (e.g., "CORE HUB", "HIGH IMPACT")
9. **Daily Goal Ring**: Circular progress indicator in bottom-left
10. **Notification Bell**: Top-right with dot indicator

### Page-Specific UI Requirements

#### Home Dashboard (Screenshot 1)
- Greeting: "Hi {name}, good to see you back." with purple gradient on second part
- Current Knowledge section with concept cards (icon + name + proficiency level + edit button)
- Gaps Detected section with orange/warning-styled cards
- "Adjust Model" button at bottom center

#### Global Hub (Screenshot 2)
- Network View / List View toggle pills at top
- Large interactive bubble/circle visualization for learning hubs
- Hub circles scale by mastery percentage
- "CORE HUB" badge on primary hub
- Bottom bar: Total Mastery percentage, user info, Collaborative Mode indicator

#### Hub Explorer (Screenshot 3)
- Breadcrumb navigation: "Learning Path > Cluster Name"
- Stats bar: Knowledge Depth %, Related Connections count
- Interactive node graph with ACTIVE state indicator
- Right sidebar: Gemini AI panel with Daily Mission, checklist, "Start Mission" button, Resources list
- Bottom: Linear progress path (Foundations → Supervised Learning → Neural Networks → Advanced AI)

#### Video/Course View (Screenshot 4)
- Video player with custom progress bar
- Right sidebar: "Gemini Sidebar — LIVE AI ANALYSIS" with Insights/Notes/Q&A tabs
- Timestamp-linked critical concept callouts
- Key Vocabulary tags
- Contextual notes linking to prior modules
- Chat input: "Ask Gemini about this video..."
- Below video: Snippet Summary card + Key Resources list

#### Task Central (Screenshot 5)
- User card in sidebar: avatar, name, "LEVEL {n} {TITLE}" label
- Current Objectives grouped by hub
- Task cards with type label, progress bar, percentage
- Stats row: Completed Tasks, Active Streak, Skill Points (large numbers)
- Daily Goal ring in bottom-left corner

#### Cognitive Analysis (Screenshot 6)
- Time range selector: 24H / 7D / 30D pills
- Large KPI cards: Retention Score (big percentage), Knowledge Growth (with trend)
- Gemini Insight panel in sidebar with prediction + "Refresh Now" button
- Predicted Concept Decay grid: cards tagged by domain with stability indicators
- Upcoming Learning Session scheduler

#### Mastery Assessment (Screenshot 7)
- Readiness Score circular gauge (large, top-right)
- Assessment mode cards: Scenario Generator, Quick Quiz, Audio Socratic Lab
- Concept Drill section
- Recommended Focal Points: tagged cards (HIGH IMPACT, FAST TRACK, MASTERY CLOSE)
- Activity History with XP gains per action
- Footer: Privacy, Documentation, Support links

---

## Gamification System

### XP Awards
| Action | XP |
|--------|-----|
| Watch video snippet | +40 |
| Complete Quick Quiz | +80 |
| Feynman Challenge | +120 |
| Socratic Debate round | +150 |
| Complete Socratic (3+ rounds) | +450 |
| Daily login | +25 |
| Streak bonus (per day) | +10 * streak_days |

### Level Progression
| Level Range | Title | XP Required |
|-------------|-------|-------------|
| 1-5 | Novice | 0 – 1,000 |
| 6-10 | Explorer | 1,001 – 3,000 |
| 11-20 | Pathfinder | 3,001 – 8,000 |
| 21-30 | Scholar | 8,001 – 18,000 |
| 31-40 | Master | 18,001 – 35,000 |
| 41-50 | Sage | 35,001+ |

### Achievements
- **First Steps** — Complete your first learning event
- **Feynman Apprentice** — Complete 5 Feynman challenges
- **Debate Champion** — Win 10 Socratic debates
- **Streak Fire** — Maintain a 7-day streak
- **Decay Slayer** — Recover 5 fading concepts
- **Graph Explorer** — Unlock 20 nodes
- **Speed Demon** — Complete 3 Quick Snapshots in under 90 seconds
- **Knowledge Keeper** — Maintain 90%+ retention for 7 days

---

## Canvas Behavior Rules

- Node positions persist across reloads (PATCH on drag stop)
- Decay scoring updates nodes in real-time without full refetch
- MiniMap colors match node state colors exactly
- Timeline scrubber freezes canvas interactions in historical mode
- Recommendation cards queue (no overlap)
- Nodes with no events skip decay scoring

---

## Running the App

### Development
```bash
# Terminal 1: Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Seed data (one-time)
cd backend
python ml/generate_dataset.py
python ml/train_model.py
python database/seed.py
```

### Pre-Demo Checklist
- [ ] Canvas loads with realistic node graph for demo user
- [ ] At least 2 nodes in FADING state with recommendation cards
- [ ] Recommendation card shows: Gemini reasoning + YouTube embed + practice scenario
- [ ] Feynman flow works end-to-end: prompt → user types → Gemini evaluates → gap fill
- [ ] Socratic flow works: position → user replies → Gemini pushes back
- [ ] Timeline scrubber animates canvas backward through 14 days
- [ ] Metrics page shows all 4 visualizations
- [ ] Feature importance chart sorted and labeled
- [ ] Personalization lift is positive
- [ ] Gamification: XP gains animate, streak displays, level badge works

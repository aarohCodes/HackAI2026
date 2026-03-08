# CogniPath

**AI-Powered Adaptive Learning Platform**

CogniPath maps your knowledge as a living graph, predicts what you're about to forget using machine learning, and deploys Google Gemini to keep you sharp — through Feynman challenges, Socratic debates, and precision YouTube snippets.

Built for **Dallas AI Hackathon 2026** — Data Science / ML Track.

---

## What It Does

Most learning tools tell you *what* to study. CogniPath tells you *what you're about to forget* — before you forget it.

It builds a personalized knowledge graph from your learning goal and background, tracks every interaction you have with each concept, and uses an XGBoost model trained on Ebbinghaus forgetting curves to predict your retention score in real time. When a concept is about to decay, CogniPath triggers targeted interventions: a 30-second YouTube snippet at exactly the right timestamp, a Feynman challenge to expose gaps in your understanding, or a Socratic debate where Gemini takes the opposing side.

---

## Tech Stack

### Frontend

| Technology | Role |
|---|---|
| **React 18** | UI framework |
| **React Flow** | Interactive knowledge graph canvas (nodes, edges, drag) |
| **Tailwind CSS** | Dark futuristic UI design system |
| **Framer Motion** | Node glow animations, card transitions |
| **Zustand** | Global state management (auth, canvas, gamification) |
| **Recharts** | ML metrics dashboard (retention curves, feature importance) |
| **Vite** | Build tool and dev server |
| **Axios** | API client with JWT interceptor |

### Backend

| Technology | Role |
|---|---|
| **FastAPI** | REST API framework (async, auto-docs via OpenAPI) |
| **Uvicorn** | ASGI server |
| **Beanie ODM** | Async MongoDB object-document mapper |
| **Motor** | Async MongoDB driver (underlying Beanie) |
| **NetworkX** | Knowledge graph topology (prerequisite chains, depth calculation) |
| **python-jose** | JWT token creation and verification |
| **bcrypt** | Password hashing |

### AI / ML

| Technology | Role |
|---|---|
| **Google Gemini 1.5 Pro** | Recommendations, Feynman evaluation, Socratic debates, knowledge graph generation, YouTube timestamp extraction |
| **XGBoost** | Retention score prediction model |
| **scikit-learn** | Data preprocessing, train/test split, metrics |
| **Ebbinghaus Forgetting Curve** | Mathematical foundation for decay modeling |

### Data & APIs

| Technology | Role |
|---|---|
| **MongoDB Atlas** | Primary database (users, nodes, edges, events, recommendations) |
| **YouTube Data API v3** | Video search by concept + captions |
| **youtube-transcript-api** | Transcript extraction for timestamp pinpointing |

---

## Architecture

```
Browser (React + Vite)
        │
        │  HTTP + JWT Bearer token
        ▼
FastAPI (Uvicorn)
        │
        ├── MongoDB (Beanie ODM)
        │       └── users, concept_nodes, learning_events,
        │           knowledge_edges, recommendations, achievements
        │
        ├── Google Gemini API
        │       ├── Onboarding graph generation
        │       ├── Recommendation reasoning
        │       ├── Feynman explanation evaluation
        │       ├── Socratic debate responses
        │       ├── Quick snapshots
        │       └── YouTube timestamp extraction
        │
        ├── YouTube Data API v3
        │       └── Video search + transcript pipeline
        │
        └── XGBoost ML Model (local inference)
                └── Retention score prediction per concept node
```

### Request Flow

1. User opens the app → Axios sends `Authorization: Bearer <token>` on every request
2. FastAPI `get_current_user` dependency decodes the JWT, fetches the user from MongoDB
3. Business logic runs in service layer (`services/`) — never directly in route handlers
4. Beanie ODM handles all async MongoDB reads/writes
5. ML inference runs locally on the saved XGBoost model (no external call)
6. Gemini calls are made server-side, never from the browser

---

## Authentication Flow

```
POST /api/auth/register   →  name + email + password
                          ←  JWT token + user object

POST /api/auth/login      →  email + password
                          ←  JWT token + user object

Token stored in localStorage as `cognipath_token`
Axios interceptor attaches it to every request

GET /api/auth/me          →  Bearer token
                          ←  current user (re-hydration on refresh)

POST /api/users/onboard   →  goal + background
                          ←  Gemini-generated knowledge graph
                              (nodes + edges saved to MongoDB)
```

If `user.goal` is empty after login, the frontend redirects to `/onboarding`. A 401 response clears the token and redirects to `/login`.

**Demo account**: `alex@cognipath.dev` / `demo1234`

---

## ML Model: Knowledge Decay Predictor

### Problem

Human memory follows the Ebbinghaus forgetting curve: `R(t) = e^(-t/S)` where `R` is retention, `t` is elapsed time, and `S` is the stability parameter. Generic apps assume the same `S` for everyone. CogniPath personalizes `S` based on behavioral signals.

### Approach

1. Generate 1,000 synthetic learner trajectories (`ml/generate_dataset.py`) with realistic behavioral variance
2. Train an XGBoost regressor to predict `R(t)` from 10 features (`ml/train_model.py`)
3. At inference time, compute features from MongoDB events and call `ml/predict.py`
4. Map the predicted score to a node state and write it back to MongoDB

### Input Features

| Feature | Description |
|---|---|
| `complexity_tier` | 1 = basic, 2 = intermediate, 3 = advanced |
| `dependency_depth` | Hops from root concept in the graph |
| `review_count` | Total number of review events |
| `spacing_score` | How well-spaced reviews are (0–1) |
| `time_spent_avg` | Average minutes per learning session |
| `feynman_score` | Ratio of successful Feynman challenges |
| `revisit_rate` | Ratio of rewatch events |
| `practice_fail_rate` | Ratio of failed practice attempts |
| `confidence_gap` | Average `|confidence_after - confidence_before|` |
| `days_since_review` | Days elapsed since last review |

### Node State Mapping

| Retention Score | State | Color | Meaning |
|---|---|---|---|
| R >= 0.85 | `green` | Emerald | Mastered |
| R >= 0.70 | `yellow` | Amber | In progress |
| R >= 0.60, days_until_decay <= 3 | `fading` | Gray | Decay alert |
| R < 0.60 | `red` | Red | Needs review |

### Edge Cases

- `days_since_review = 0` → return 1.0 without calling model
- `last_reviewed is null` → set `days_since_review = 99`, return 0.0
- `review_count = 0` → skip model, return `red`
- All predictions clipped to [0.0, 1.0]
- Model file missing → log warning, return 0.5 default

---

## Gemini AI Integration

### Onboarding Graph Generation

The most critical Gemini call. When a user submits their learning goal (e.g., "I want to learn ML") and background (e.g., "I know Python and stats"), Gemini generates a structured knowledge graph: concept nodes with complexity tiers and dependency relationships. This is saved to MongoDB as the user's starting canvas.

### Learning Interventions

| Mode | Trigger | Gemini Task |
|---|---|---|
| **Recommendation** | Any node click | Generate context-aware study suggestion with reasoning |
| **Feynman Challenge** | User initiates | Evaluate user's plain-language explanation, identify gaps |
| **Socratic Debate** | User initiates | Take a position, push back on user's reasoning across turns |
| **Quick Snapshot** | Decay alert | Generate a 30-second micro-challenge |
| **YouTube Timestamp** | Snippet pipeline | Given transcript + concept, return optimal `[start, end]` seconds |

### Retry Logic

- Invalid JSON response → retry once with explicit JSON-only instruction
- Two failures → return hardcoded fallback with a note
- Rate limit: max 1 call per user per node per 6 hours

---

## YouTube Snippet Pipeline

```
User node has decay alert
        │
        ▼
POST /api/youtube/snippet  {concept, domain, context}
        │
        ├── YouTube Data API v3: search for relevant videos with captions
        │
        ├── youtube-transcript-api: fetch transcript for top results
        │
        ├── Gemini: given transcript + concept gap, return {start, end} seconds
        │
        └── Response: {video_id, title, timestamp_start, timestamp_end, reason}
                │
                ▼
        Frontend embeds youtube-nocookie.com player
        starting at timestamp_start
```

If transcripts are unavailable for all results, the API returns `null` and the UI shows "No snippet available" gracefully.

---

## Gamification System

| Action | XP Earned |
|---|---|
| Watch video snippet | +40 |
| Complete Quick Quiz | +80 |
| Feynman Challenge | +120 |
| Socratic Debate round | +150 |
| Complete full Socratic (3+ rounds) | +450 |
| Daily login | +25 |
| Streak bonus | +10 × streak_days |

### Level Progression

| Level | Title | XP Required |
|---|---|---|
| 1–5 | Novice | 0 – 1,000 |
| 6–10 | Explorer | 1,001 – 3,000 |
| 11–20 | Pathfinder | 3,001 – 8,000 |
| 21–30 | Scholar | 8,001 – 18,000 |
| 31–40 | Master | 18,001 – 35,000 |
| 41–50 | Sage | 35,001+ |

---

## API Reference

All endpoints (except `/api/auth/*` and `/api/health`) require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register → JWT token + user |
| POST | `/api/auth/login` | Login → JWT token + user |
| GET | `/api/auth/me` | Re-hydrate user from token |

### Users
| Method | Path | Description |
|---|---|---|
| POST | `/api/users/onboard` | Set goal + background, generate knowledge graph |
| GET | `/api/users/me` | Current user profile + gamification stats |

### Graph
| Method | Path | Description |
|---|---|---|
| GET | `/api/graph/canvas` | All nodes + edges for canvas |
| POST | `/api/graph/event` | Log a behavioral signal |
| PATCH | `/api/graph/node/{id}/position` | Persist drag position |
| GET | `/api/graph/history` | Historical snapshots for timeline scrubber |

### Decay
| Method | Path | Description |
|---|---|---|
| POST | `/api/decay/run` | Score all nodes, update DB, return alerts |
| GET | `/api/decay/scores` | Current retention scores + alert flags |
| GET | `/api/decay/metrics` | ML model evaluation metrics |

### Gemini
| Method | Path | Description |
|---|---|---|
| POST | `/api/gemini/recommend` | Context-aware recommendation |
| POST | `/api/gemini/feynman` | Evaluate Feynman explanation |
| POST | `/api/gemini/socratic` | Start Socratic challenge |
| POST | `/api/gemini/socratic/reply` | Continue Socratic thread |
| POST | `/api/gemini/quick-snapshot` | Quick concept summary |

### YouTube
| Method | Path | Description |
|---|---|---|
| POST | `/api/youtube/snippet` | Search + transcript + timestamp extraction |

### Gamification
| Method | Path | Description |
|---|---|---|
| GET | `/api/gamification/stats` | XP, level, streak, daily progress |
| POST | `/api/gamification/claim-daily` | Claim daily login bonus |
| GET | `/api/gamification/achievements` | All achievements + unlock status |
| GET | `/api/gamification/leaderboard` | Top learners by XP |

---

## Database Models

All models are async Beanie `Document` classes backed by MongoDB collections via the Motor driver.

| Model | Collection | Purpose |
|---|---|---|
| `User` | `users` | Auth, profile, gamification stats |
| `ConceptNode` | `concept_nodes` | Knowledge graph nodes + ML scores |
| `KnowledgeEdge` | `knowledge_edges` | Directed edges (prerequisite / related) |
| `LearningEvent` | `learning_events` | Behavioral signals for ML features |
| `Recommendation` | `recommendations` | Gemini outputs + YouTube snippets |
| `Achievement` | `achievements` | Achievement definitions |

---

## Project Structure

```
HackAI2026/
├── .env                           # API keys (never commit)
├── example.env                    # Template
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── database/
│   │   ├── models.py              # Beanie Document models
│   │   ├── connection.py          # Motor client + init_beanie()
│   │   └── seed.py                # Demo data seeder
│   ├── ml/
│   │   ├── generate_dataset.py    # 1,000 synthetic learner records
│   │   ├── train_model.py         # XGBoost training + metrics export
│   │   ├── predict.py             # Inference + retention scoring
│   │   └── evaluate.py            # RMSE, MAE, lift computation
│   ├── api/
│   │   ├── deps.py                # get_current_user JWT dependency
│   │   ├── auth.py                # Register + login routes
│   │   ├── users.py               # Onboarding + profile routes
│   │   ├── graph.py               # Canvas routes
│   │   ├── decay.py               # Decay scoring routes
│   │   ├── gemini.py              # Gemini AI routes
│   │   ├── youtube.py             # YouTube snippet routes
│   │   └── gamification.py        # XP + achievement routes
│   └── services/
│       ├── auth_service.py        # JWT + bcrypt
│       ├── gemini_service.py      # Gemini prompt templates + retry
│       ├── youtube_service.py     # YouTube + transcript + timestamps
│       ├── graph_service.py       # NetworkX graph operations
│       └── gamification_service.py # XP, levels, streaks
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── api/client.js          # Axios + JWT interceptor
        ├── store/useStore.js      # Zustand global state
        ├── pages/
        │   ├── Login.jsx          # Register / Login
        │   ├── Onboarding.jsx     # Goal + background → graph init
        │   ├── Canvas.jsx         # Main React Flow canvas
        │   ├── Metrics.jsx        # ML dashboard (Recharts)
        │   └── Assessment.jsx     # Mastery assessment modes
        ├── components/
        │   ├── canvas/            # ConceptNode, RecommendationCard, etc.
        │   ├── learning/          # FeynmanChallenge, SocraticDebate, etc.
        │   ├── gamification/      # XPBar, StreakCounter, LevelBadge, etc.
        │   └── ui/                # Sidebar, MetricsPanel
        └── hooks/
            ├── useDecayMonitor.js
            ├── useTracker.js
            └── useGamification.js
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas URI)
- Google Gemini API key
- YouTube Data API v3 key

### 1. Clone & Configure

```bash
git clone <repo-url>
cd HackAI2026
cp example.env .env
# Fill in MONGO_DB_URI, GEMINI_API_KEY, YOUTUBE_API_KEY, SECRET_KEY
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
```

### 3. Train the ML Model

```bash
python ml/generate_dataset.py   # generate synthetic training data
python ml/train_model.py        # train XGBoost, save model + metrics
```

### 4. Seed Demo Data

```bash
python database/seed.py
# Creates demo user: alex@cognipath.dev / demo1234
```

### 5. Start Backend

```bash
uvicorn main:app --reload --port 8000
```

### 6. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### Access

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGO_DB_URI` | MongoDB connection string |
| `MONGO_DB_NAME` | Database name (default: `cognipath`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `SECRET_KEY` | JWT signing secret |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `DECAY_THRESHOLD` | Retention threshold for alerts (default: `0.70`) |
| `DECAY_ALERT_WINDOW_DAYS` | Days window for decay alerts (default: `3`) |

---

## Hackathon Tracks

### Dallas AI Track
- Interactive knowledge graph canvas with real-time decay visualization
- Gemini-powered Feynman + Socratic learning modes
- YouTube snippet pipeline with transcript-level timestamp precision
- Dark futuristic UI matching provided design system

### Data Science / ML Track
- XGBoost decay model trained on Ebbinghaus forgetting curve foundations
- 10-feature behavioral fingerprint per user-concept pair
- Feature importance analysis and personalization lift over generic baseline
- Full metrics dashboard at `/metrics` (RMSE, MAE, retention curves, lift chart)

---

## Team

Built at HackAI 2026, Dallas.

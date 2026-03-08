# CogniPath

**AI-Powered Adaptive Learning Platform**

CogniPath maps your knowledge as a living graph, predicts what you're about to forget using machine learning, and deploys Google Gemini to keep you sharp — through Feynman challenges, Socratic debates, and precision YouTube snippets.

Built for **Dallas AI Hackathon 2026** — Data Science / ML Track.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, React Flow, Tailwind CSS, Framer Motion, Zustand, Recharts |
| **Backend** | FastAPI, Motor (async MongoDB), Beanie ODM, NetworkX |
| **AI / ML** | Google Gemini 1.5 Pro, XGBoost, scikit-learn |
| **Data** | MongoDB, YouTube Data API v3, youtube-transcript-api |
| **Infra** | Vite, Uvicorn, Chrome Extension (Manifest V3) |

---

## Features

### Knowledge Graph Canvas
Interactive React Flow canvas where every concept is a draggable node. Nodes glow, pulse, and change color based on your retention state — green (mastered), yellow (in progress), red (not learned), fading (decay alert).

### ML Decay Predictor
XGBoost model trained on Ebbinghaus forgetting curves with 9 behavioral features. Predicts when you'll forget each concept and triggers alerts before it happens.

### Gemini AI Integration
- **Recommendations**: Context-aware study suggestions with reasoning
- **Feynman Challenges**: Explain a concept back; Gemini finds the gaps
- **Socratic Debates**: Gemini takes a position and pushes back on your reasoning
- **Quick Snapshots**: 30-second micro-challenges
- **Onboarding Graph Generation**: Gemini builds your personalized knowledge map

### YouTube Snippet Pipeline
Searches YouTube, extracts transcripts, and uses Gemini to pinpoint the exact 30-second segment that fills your knowledge gap.

### Gamification
XP system, levels (Novice → Sage), daily streaks, achievements, skill points, and a daily goal ring to keep learning fun and addictive.

### Cognitive Analysis Dashboard
Retention scores, knowledge growth trends, predicted concept decay heatmap, and upcoming session scheduling optimized for your circadian rhythm.

---

## Project Structure

```
HackAI2026/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt
│   ├── database/
│   │   ├── models.py              # Beanie ODM document models
│   │   ├── connection.py          # Motor client + init_beanie
│   │   └── seed.py                # Demo data seeder
│   ├── ml/
│   │   ├── generate_dataset.py    # Synthetic learner data
│   │   ├── train_model.py         # XGBoost decay model
│   │   ├── predict.py             # Inference + scoring
│   │   └── evaluate.py            # Metrics computation
│   ├── api/
│   │   ├── users.py               # User profile routes
│   │   ├── graph.py               # Knowledge graph routes
│   │   ├── decay.py               # Decay prediction routes
│   │   ├── gemini.py              # Gemini AI routes
│   │   ├── youtube.py             # YouTube snippet routes
│   │   └── gamification.py        # XP, levels, achievements
│   └── services/
│       ├── gemini_service.py      # Gemini API wrapper
│       ├── youtube_service.py     # YouTube + transcript
│       ├── graph_service.py       # NetworkX operations
│       └── gamification_service.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/client.js
│       ├── store/useStore.js
│       ├── pages/
│       │   ├── Onboarding.jsx
│       │   ├── Canvas.jsx
│       │   ├── Metrics.jsx
│       │   └── Assessment.jsx
│       ├── components/
│       │   ├── canvas/
│       │   ├── learning/
│       │   ├── gamification/
│       │   └── ui/
│       └── hooks/
└── extension/                     # Chrome extension (future)
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running locally (or Atlas URI)

### 1. Clone & Configure
```bash
git clone <repo-url>
cd HackAI2026
cp example.env .env
# Edit .env with your API keys
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

### 3. Train ML Model
```bash
python ml/generate_dataset.py
python ml/train_model.py
```

### 4. Start Backend
```bash
uvicorn main:app --reload --port 8000
```

### 5. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 6. Seed Demo Data
```bash
cd backend
python database/seed.py
```

### Access Points
- **App**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/users/onboard` | POST | Create user + generate knowledge graph |
| `/api/users/{user_id}` | GET | User profile + gamification stats |
| `/api/graph/{user_id}` | GET | Full canvas state (nodes + edges) |
| `/api/graph/event` | POST | Log a learning event |
| `/api/graph/node/{id}/position` | PATCH | Persist node drag position |
| `/api/graph/{user_id}/history` | GET | Historical states for timeline |
| `/api/decay/run/{user_id}` | POST | Batch decay scoring |
| `/api/decay/{user_id}` | GET | Current retention scores |
| `/api/decay/metrics` | GET | ML model metrics |
| `/api/gemini/recommend` | POST | AI recommendation |
| `/api/gemini/feynman` | POST | Feynman evaluation |
| `/api/gemini/socratic` | POST | Start Socratic debate |
| `/api/gemini/socratic/reply` | POST | Continue debate |
| `/api/youtube/snippet` | POST | Find video snippet |
| `/api/gamification/{user_id}/stats` | GET | XP, level, streak |
| `/api/gamification/{user_id}/claim-daily` | POST | Claim daily bonus |
| `/api/gamification/{user_id}/achievements` | GET | Achievement list |
| `/api/gamification/leaderboard` | GET | Top learners |

---

## Hackathon Tracks

### Dallas AI Track
- Interactive knowledge graph canvas with decay visualization
- Gemini-powered Feynman + Socratic learning modes
- YouTube snippet pipeline with timestamp precision

### Data Science / ML Track
- XGBoost decay model with Ebbinghaus foundation
- Feature importance analysis
- Personalization lift over generic baseline
- Full metrics dashboard at `/metrics`

---

## Team
Built at HackAI 2026, Dallas.

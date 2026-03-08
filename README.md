# Cortex

**AI-Powered Adaptive Learning Platform**

Cortex maps your knowledge as a living graph, predicts what you're about to forget using machine learning, and deploys Google Gemini to keep you sharp — through Feynman challenges, Socratic debates, and precision YouTube snippets.

Built for **Dallas AI Hackathon 2026** — Data Science / ML Track.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, React Flow, Tailwind CSS, Framer Motion, Zustand, Recharts |
| **Backend** | FastAPI, Motor (async MongoDB), Beanie ODM, NetworkX |
| **AI / ML** | Google Gemini 2.0 Flash / 2.5 Flash, XGBoost, scikit-learn |
| **Data** | MongoDB, YouTube Data API v3, youtube-transcript-api, Tavily, Firecrawl |
| **Infra** | Vite, Uvicorn |

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
- **Flowcharts**: Mermaid.js learning-path flowcharts
- **Summaries**: Personalized topic summaries with key points
- **Quizzes**: Adaptive MCQ generation based on learning history

### YouTube Video Pipeline
- **Search**: Find the best educational video for any topic (via YouTube Data API)
- **Process & Snippet**: Process a video transcript and use Gemini to surface the most relevant segments for your query

### Web Search & Scraping
- **Tavily**: Search the web for relevant learning resources
- **Firecrawl**: Scrape and chunk web pages for embedding/indexing

### Gamification
XP system, levels (Novice → Sage), daily streaks, achievements, skill points, and a daily goal ring to keep learning fun and addictive.

### Mastery Assessments
- **Adaptive Quiz**: NotebookLM-style multi-type quizzes (MCQ, true/false, fill-blank, ordering, code trace)
- **Scenario Challenges**: Real-world case-study simulations
- **Concept Drills**: Rapid-fire recall training targeting weak concepts

### Cognitive Analysis Dashboard
Retention scores, knowledge growth trends, predicted concept decay heatmap, and upcoming session scheduling.

---

## Project Structure

```
HackAI2026/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt
│   ├── db.py                      # Sync pymongo collections (aaroh modules)
│   ├── indexing.py                # Gemini embeddings + MongoDB storage
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
│   │   ├── auth.py                # Register / Login / Me
│   │   ├── deps.py                # JWT auth dependency
│   │   ├── users.py               # User profile + onboarding
│   │   ├── graph.py               # Knowledge graph routes
│   │   ├── decay.py               # Decay prediction routes
│   │   ├── gemini.py              # Gemini AI routes
│   │   ├── gamification.py        # XP, levels, achievements
│   │   ├── assess.py              # Adaptive quiz, scenario, drill
│   │   ├── flowchart.py           # Mermaid flowchart generation
│   │   ├── summary.py             # Topic summary generation
│   │   ├── quiz_gen.py            # Simple MCQ quiz generation
│   │   └── video.py               # YouTube video process + snippets
│   ├── search/
│   │   ├── search.py              # Tavily web search
│   │   ├── youtube.py             # YouTube educational search
│   │   └── scrape.py              # Firecrawl URL scraping
│   └── services/
│       ├── auth_service.py        # JWT + bcrypt
│       ├── gemini_service.py      # Gemini API wrapper
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
│       │   ├── Landing.jsx
│       │   ├── Login.jsx
│       │   ├── Onboarding.jsx
│       │   ├── Canvas.jsx
│       │   ├── Metrics.jsx
│       │   ├── QuizPage.jsx
│       │   └── VideoView.jsx
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
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login, get JWT token |
| `/api/auth/me` | GET | Current user info |
| `/api/users/onboard` | POST | Generate personalized knowledge graph |
| `/api/graph` | GET | Full canvas state (nodes + edges) |
| `/api/graph/event` | POST | Log a learning event |
| `/api/decay/run` | POST | Batch decay scoring |
| `/api/decay` | GET | Current retention scores |
| `/api/gemini/recommend` | POST | AI recommendation |
| `/api/gemini/feynman` | POST | Feynman evaluation |
| `/api/gemini/socratic` | POST | Start Socratic debate |
| `/api/gemini/socratic/reply` | POST | Continue debate |
| `/api/gamification/stats` | GET | XP, level, streak |
| `/api/assess/quiz/generate` | POST | Adaptive quiz (NotebookLM-style) |
| `/api/assess/scenario/generate` | POST | Scenario challenge |
| `/api/assess/drill/generate` | POST | Rapid-fire drill |
| `/api/flowchart` | POST | Mermaid flowchart |
| `/api/summary` | POST | Topic summary |
| `/api/quiz` | POST | Simple 5-question MCQ |
| `/api/video/process` | POST | Process YouTube video transcript |
| `/api/video/snippets` | POST | Get relevant video snippets |
| `/api/search/web` | POST | Tavily web search |
| `/api/search/youtube` | POST | YouTube educational search |
| `/api/search/scrape` | POST | Firecrawl URL scrape |

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

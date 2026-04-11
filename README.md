# 🎯 Confido AI — AI-Powered Interview Performance Analyzer

> **Build Confidence for Interviews.** A full-stack AI platform that simulates real technical interviews, analyzes your answers with Google Gemini, tracks facial emotions & eye contact in real-time, and delivers personalized mentor-style coaching feedback.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google)](https://aistudio.google.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite)](https://www.sqlite.org/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite)](https://vitejs.dev/)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎤 **Voice + Text Input** | Speak your answers using browser speech recognition or type them |
| 🤖 **AI Scoring (Gemini)** | Google Gemini evaluates answers on Knowledge, Relevance, Clarity & Confidence with mentor-style coaching feedback |
| 📊 **Speech Analysis** | Detects filler words, hedging language, run-on sentences, and structural issues |
| 🧠 **Semantic Analysis** | Client-side NLP pipeline with concept matching, intent analysis, and semantic reasoning |
| 🗣️ **Smart Speech Corrections** | Domain-aware correction of technical jargon for accurate transcription |
| 👁️ **Eye Contact Tracking** | MediaPipe Face Mesh tracks gaze direction in real-time during interviews |
| 😊 **Emotion Detection** | face-api.js detects facial expressions (happy, neutral, anxious, etc.) |
| 🏆 **Weighted Scoring** | Final score: 85% answer quality + 15% eye contact |
| 📜 **Interview History** | Every session is saved and can be reviewed or deleted at any time |
| 🔒 **Auth System** | JWT-based login/signup with admin dashboard |
| 🔑 **Bring Your Own API Key** | Users can supply their own Gemini API key to bypass server rate limits |
| 🌐 **Multiple Domains** | Frontend, Backend, Full Stack, Data Science, DevOps, Behavioral |
| 💾 **Offline Question Caching** | IndexedDB-backed question bank for offline availability |

---

## 🖥️ Tech Stack

### Frontend
- **React 19** + **Vite** — Component-based SPA with fast HMR
- **Tailwind CSS 3** — Utility-first styling
- **React Router v7** — Client-side routing
- **Recharts** — Radar charts and score visualizations
- **MediaPipe Face Mesh** — Real-time eye contact detection
- **face-api.js** — In-browser facial emotion recognition
- **Web Speech API** — Browser-native voice transcription
- **Axios** — HTTP client for API requests
- **Dexie.js** — IndexedDB wrapper for offline question caching
- **Compromise.js** — Lightweight NLP for non-answer detection
- **Lucide React** — Icon library
- **@google/generative-ai** — Client-side Gemini API integration

### Backend
- **FastAPI (Python)** — High-performance async REST API
- **SQLite** — Lightweight relational database (auto-created on first run)
- **spaCy** (`en_core_web_lg`) — NLP content analysis
- **Google Gemini API** (`google-genai`) — LLM rubric-based evaluation & mentor-style feedback
- **python-jose** — JWT token creation & verification
- **bcrypt / passlib** — Password hashing
- **Pydantic** — Request/response validation
- **Uvicorn** — ASGI server
- **python-dotenv** — Environment variable management

---

## 📁 Project Structure

```
AI-Powered-Interview-Performance-Analyzer/
├── .gitignore
├── README.md
│
├── client/                          # React frontend (Vite)
│   ├── index.html                   # App entry HTML
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.cjs
│   ├── eslint.config.js
│   ├── vercel.json                  # Vercel deployment config
│   ├── .env.example                 # Environment variable template
│   ├── public/
│   │   ├── interview-illustration.png
│   │   ├── vite.svg
│   │   └── models/                  # face-api.js model weights (download separately)
│   └── src/
│       ├── main.jsx                 # React root mount
│       ├── App.jsx                  # Router & route definitions
│       ├── App.css                  # Global app styles
│       ├── index.css                # Tailwind imports
│       ├── theme-override.css       # Custom theme overrides
│       ├── pages/
│       │   ├── Landing.jsx          # Home / marketing page
│       │   ├── Login.jsx            # Auth (login + signup)
│       │   ├── DomainSelect.jsx     # Interview domain picker + API key input
│       │   ├── Interview.jsx        # Live interview screen
│       │   ├── Results.jsx          # Score breakdown & feedback
│       │   ├── History.jsx          # Past interview sessions
│       │   └── AdminDashboard.jsx   # Admin stats & user management
│       ├── components/
│       │   ├── Layout.jsx           # Navbar + page shell
│       │   ├── EyeContactChart.jsx  # Eye contact visualization
│       │   └── ProtectedRoute.jsx   # JWT auth guard
│       ├── services/
│       │   ├── voiceCaptureManager.js   # Speech capture + transcription
│       │   ├── speechCorrections.js     # Domain-aware speech correction dictionary
│       │   ├── semanticBrain.js         # Semantic analysis orchestrator
│       │   ├── semanticReasoner.js      # Deep semantic reasoning engine
│       │   ├── conceptMatcher.js        # Concept-level answer matching
│       │   ├── nonAnswerDetector.js     # Pre-LLM non-answer gate
│       │   ├── intentAnalyzer.js        # Intent classification
│       │   ├── geminiAnalysis.js        # Client-side Gemini API calls
│       │   ├── aiModels.js              # AI model orchestration
│       │   ├── apiClient.js             # Axios API wrapper
│       │   └── localAnalysis.js         # Offline fallback scoring
│       ├── context/
│       │   └── AuthContext.jsx      # Auth state management
│       ├── config/
│       │   └── apiConfig.js         # API endpoint configuration
│       ├── data/
│       │   └── questionBank.js      # Interview question bank (all domains)
│       ├── utils/
│       │   └── scoreColors.js       # Score color utilities
│       └── assets/                  # Static assets
│
└── server/                          # FastAPI backend (Python)
    ├── main.py                      # All API routes & app entry point
    ├── database.py                  # SQLite schema + all DB operations
    ├── auth.py                      # JWT + password hashing
    ├── config.py                    # Environment config
    ├── startup_checks.py            # Boot-time validation
    ├── requirements.txt             # Python dependencies
    ├── start_server.sh              # Server startup script
    ├── services/
    │   ├── __init__.py
    │   ├── llm_evaluator.py         # Gemini rubric-based scoring & mentor feedback
    │   ├── nlp_service.py           # spaCy content analysis
    │   ├── emotion_service.py       # Emotion analysis service
    │   └── transcription_service.py # Whisper transcription (reference, disabled)
    └── utils/
        ├── logger.py               # Logging utilities
        └── speech_analyzer.py       # Delivery metrics extractor
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+**
- **Python 3.9+**
- A free [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone the repository
```bash
git clone https://github.com/MohanReddy-5/AI-Powered-Interview-Performance-Analyzer.git
cd AI-Powered-Interview-Performance-Analyzer
```

### 2. Backend Setup
```bash
cd server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_lg
```

Create `server/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_jwt_secret_key_here
```

Start the server:
```bash
uvicorn main:app --reload --port 8000
```
Or use the startup script:
```bash
chmod +x start_server.sh
./start_server.sh
```

### 3. Frontend Setup
```bash
cd client
npm install
```

Create `client/.env` (or copy from `.env.example`):
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Start the dev server:
```bash
npm run dev
```

The app runs at **http://localhost:5173**. The backend runs at **http://localhost:8000**.

---

## ⚙️ How It Works

```
User speaks answer
        ↓
Browser Speech Recognition (Web Speech API)
        ↓
Voice Capture Manager → Speech Corrections (domain-aware)
        ↓
Non-Answer Detector → [Score 0 if blank/refusal]
        ↓
Semantic Brain (concept matching + intent analysis + semantic reasoning)
        ↓
Speech Analyzer (fillers, hedging, structure)
        ↓
FastAPI /api/submit-answer
        ↓
LLM Evaluator (Gemini) — rubric scoring + mentor-style coaching feedback
        ↓
SQLite (save answer + score + feedback)
        ↓
Results Page (score breakdown + coaching feedback + ideal answer)
```

### Scoring Formula
```
Per-question score  = avg(Knowledge + Relevance + Clarity + Confidence) × 10  [0-100]
Session overall     = (avg of all Q scores × 0.85) + (eye_contact% × 0.15)
```

### Feedback Style
The AI delivers feedback in a warm, mentor-style coaching format with three sections:
- **What landed** — Strengths in the answer
- **What's missing** — Gaps and areas to improve
- **Delivery** — Communication and presentation tips

---

## 🗄️ Database Schema

Three tables in `interview_app.db` (auto-created on first server start):

| Table | Key Columns |
|---|---|
| `users` | `id`, `name`, `email`, `hashed_password`, `is_admin`, `created_at` |
| `sessions` | `id` (UUID), `user_id`, `domain`, `overall_score`, `eye_contact_score` |
| `answers` | `id`, `session_id`, `question_id`, `question`, `user_transcript`, `ai_feedback` (JSON), `score`, `emotion_summary` |

---

## 🔐 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create account |
| `POST` | `/api/auth/login` | Login, get JWT |
| `GET` | `/api/auth/me` | Current user info |
| `POST` | `/api/start-session` | Begin interview session |
| `POST` | `/api/submit-answer` | Submit answer for AI evaluation |
| `POST` | `/api/end-interview/{id}` | End session, save eye contact score |
| `GET` | `/api/results/{session_id}` | Get full session results |
| `GET` | `/api/history` | User's past sessions |
| `DELETE` | `/api/history/{session_id}` | Delete a session |
| `POST` | `/api/gemini-analyze` | Server-side Gemini proxy |
| `POST` | `/api/validate-gemini-key` | Validate a user-provided Gemini API key |

---

## 🌐 Deployment

### Frontend (Vercel)
The `client/vercel.json` is pre-configured with SPA rewrites. Connect the `client/` folder to a Vercel project.

### Backend
Deploy to any platform that supports Python (Railway, Render, Fly.io). Set the following environment variables:
- `GEMINI_API_KEY` — Your Google Gemini API key
- `SECRET_KEY` — JWT signing secret

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source. See [LICENSE](LICENSE) for details.

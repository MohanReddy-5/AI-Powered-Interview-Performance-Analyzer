# 🎯 Confido AI — AI-Powered Interview Performance Analyzer

> **Build Confidence for Interviews.** A full-stack AI platform that simulates real technical interviews, analyzes your answers with Google Gemini, tracks your facial emotions, and gives you personalized feedback to help you land the job.

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
| 🤖 **AI Scoring** | Google Gemini evaluates answers on Knowledge, Relevance, Clarity & Confidence |
| 📊 **Speech Analysis** | Detects filler words, hedging language, run-on sentences, and structural issues |
| 👁️ **Eye Contact Tracking** | MediaPipe + face-api.js tracks gaze in real-time during interviews |
| 😊 **Emotion Detection** | face-api.js detects facial expressions (happy, neutral, anxious) |
| 🏆 **Weighted Scoring** | Final score: 85% answer quality + 15% eye contact |
| 📜 **Interview History** | Every session is saved and can be reviewed at any time |
| 🔒 **Auth System** | JWT-based login/signup with admin dashboard |
| 🌐 **Multiple Domains** | Frontend, Backend, Full Stack, Data Science, DevOps, Behavioral |

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

### Backend
- **FastAPI (Python)** — High-performance async REST API
- **SQLite** — Lightweight relational database (no server needed)
- **spaCy** (`en_core_web_lg`) — NLP content analysis
- **Google Gemini API** (`google-genai`) — LLM evaluation & feedback
- **DeepFace** *(optional)* — Server-side emotion analysis fallback
- **python-jose** — JWT token creation & verification
- **passlib** — Bcrypt password hashing
- **Pydantic** — Request/response validation
- **Uvicorn** — ASGI server

---

## 📁 Project Structure

```
AI-Powered-Interview-Performance-Analyzer/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── pages/              # Full-page route components
│   │   │   ├── Landing.jsx     # Home/marketing page
│   │   │   ├── Login.jsx       # Auth (login + signup)
│   │   │   ├── DomainSelect.jsx# Interview domain picker
│   │   │   ├── Interview.jsx   # Live interview screen
│   │   │   ├── Results.jsx     # Score breakdown & feedback
│   │   │   ├── History.jsx     # Past interview sessions
│   │   │   └── AdminDashboard.jsx # Admin stats & user management
│   │   ├── components/
│   │   │   ├── Layout.jsx      # Navbar + page shell
│   │   │   ├── EyeContactChart.jsx  # Eye contact visualization
│   │   │   └── ProtectedRoute.jsx   # JWT auth guard
│   │   ├── services/           # Client-side AI & API logic
│   │   │   ├── voiceCaptureManager.js  # Speech capture + transcription
│   │   │   ├── semanticBrain.js        # Semantic analysis orchestrator
│   │   │   ├── conceptMatcher.js       # Concept-level answer matching
│   │   │   ├── nonAnswerDetector.js    # Pre-LLM non-answer gate
│   │   │   ├── intentAnalyzer.js       # Intent classification
│   │   │   ├── geminiAnalysis.js       # Client Gemini proxy calls
│   │   │   ├── apiClient.js            # Axios API wrapper
│   │   │   └── localAnalysis.js        # Offline fallback scoring
│   │   ├── context/            # React context (auth state)
│   │   └── data/               # Interview question bank
│   ├── package.json
│   └── vite.config.js
│
└── server/                     # FastAPI backend (Python)
    ├── main.py                 # All API routes & app entry point
    ├── database.py             # SQLite schema + all DB operations
    ├── auth.py                 # JWT + password hashing
    ├── config.py               # Environment config
    ├── startup_checks.py       # Boot-time validation
    ├── services/
    │   ├── llm_evaluator.py    # Gemini rubric-based scoring
    │   ├── nlp_service.py      # spaCy content analysis
    │   ├── emotion_service.py  # DeepFace / fallback emotion
    │   └── transcription_service.py  # Whisper (disabled, kept for reference)
    ├── utils/
    │   └── speech_analyzer.py  # Delivery metrics extractor
    ├── interview_app.db        # SQLite database file
    └── requirements.txt
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
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

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```

The app runs at **http://localhost:5173**. The server runs at **http://localhost:8000**.

---

## ⚙️ How It Works

```
User speaks answer
        ↓
Browser Speech Recognition (Web Speech API)
        ↓
Voice Capture Manager (transcript)
        ↓
Non-Answer Detector → [Score 0 if blank/refusal]
        ↓
Speech Analyzer (fillers, hedging, structure)
        ↓
FastAPI /api/submit-answer
        ↓
LLM Evaluator (Gemini) — rubric scoring (Knowledge / Relevance / Clarity / Confidence)
        ↓
SQLite (save answer + score)
        ↓
Results Page (score breakdown + feedback + ideal answer)
```

### Scoring Formula
```
Per-question score  = avg(Knowledge + Relevance + Clarity + Confidence) × 10  [0-100]
Session overall     = (avg of all Q scores × 0.85) + (eye_contact% × 0.15)
```

---

## 🗄️ Database Schema

Three tables in `interview_app.db`:

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
| `POST` | `/api/submit-answer` | Submit answer (multipart form) |
| `POST` | `/api/end-interview/{id}` | End session, save eye contact |
| `GET` | `/api/results/{session_id}` | Get full session results |
| `GET` | `/api/history` | User's past sessions |
| `DELETE` | `/api/history/{session_id}` | Delete a session |
| `POST` | `/api/gemini-analyze` | Server-side Gemini proxy |

---

## 🌐 Deployment

### Frontend (Vercel)
The `client/vercel.json` is pre-configured. Connect the `client/` folder to a Vercel project.

### Backend
Deploy to any platform that supports Python (Railway, Render, Fly.io). Set `GEMINI_API_KEY` and `SECRET_KEY` as environment variables.

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

---

<div align="center">
  <strong>Built with ❤️ by Sai Srinivas Rayapati</strong><br/>
  <em>Confido AI — Build Confidence for Interviews</em>
</div>

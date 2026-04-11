from dotenv import load_dotenv
# Load .env FIRST — before any module reads os.environ
load_dotenv()

from starlette.requests import Request as StarletteRequest
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uuid
import database
import auth
import sys
import os

# Add services to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'services'))

# Add project root to system PATH for ffmpeg
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["PATH"] += os.pathsep + project_root
print(f"🔧 Added project root to PATH: {project_root}")

# ============================================================
# STARTUP VALIDATION
# ============================================================
print("\n🚀 Starting AI Interview Analyzer Backend...")
try:
    from startup_checks import check_environment
    if not check_environment():
        print("\n⛔ Server startup aborted due to configuration errors")
        print("   Please fix the errors above and try again.\n")
        sys.exit(1)
except ImportError:
    print("⚠️  Startup validation script not found - skipping checks")

# Import production AI services
try:
    from services.nlp_service import get_nlp_service
    from services.emotion_service import get_emotion_service
    print("✓ Production AI services imported successfully")
    USE_PRODUCTION_AI = True
except Exception as e:
    print(f"⚠ Production AI services not available: {e}")
    print("  Falling back to basic analysis")
    USE_PRODUCTION_AI = False

app = FastAPI(title="AI Interview Analyzer API", version="3.0.0")

# Enable CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global fallback: always return JSON, never crash with raw HTML 500 ──


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    import traceback
    print(f"\n💥 Unhandled exception on {request.url}:")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"success": False,
                 "error": "An unexpected server error occurred. Please try again."},
    )

# V2 API removed — dead code (client only calls /api/ endpoints in main.py)

# Initialize DB
database.init_db()

# Initialize AI services on startup


@app.on_event("startup")
async def startup_event():
    """Initialize AI models and verify configuration on server startup"""

    # Verify API key one more time
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key or len(api_key.strip()) < 20:
        print("\n" + "="*60)
        print("⚠️  WARNING: GEMINI_API_KEY NOT CONFIGURED")
        print("="*60)
        print("AI analysis will fail until you add your API key.")
        print("Get your FREE key at: https://aistudio.google.com/apikey")
        print("Add it to server/.env file")
        print("="*60 + "\n")
        return  # Don't try to initialize AI services

    if USE_PRODUCTION_AI:
        print("\n" + "="*60)
        print("Initializing Production AI Services...")
        print("="*60)
        try:
            # Pre-load NLP service
            nlp_service = get_nlp_service()
            print("✅ NLP Service ready (spaCy)")

            # Pre-load emotion service
            emotion_service = get_emotion_service()
            print("✅ Emotion Service ready")

            # Test LLM evaluator with API key
            from services.llm_evaluator import get_llm_evaluator
            llm_evaluator = get_llm_evaluator(api_key)
            masked_key = api_key[:8] + '*' * (len(api_key) - 8)
            print(f"✅ LLM Evaluator ready (Gemini API key: {masked_key})")

            print("="*60)
            print("🎉 All AI services initialized successfully!")
            print("="*60 + "\n")
        except Exception as e:
            print(f"❌ Error initializing AI services: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("\n⚠ Running with basic analysis (AI services not available)\n")

# ============================================================
# AUTHENTICATION MIDDLEWARE
# ============================================================


def get_current_user(authorization: str = Header(None)):
    """Extract and verify JWT token from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace("Bearer ", "")
    payload = auth.verify_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    user = database.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Verify user is admin"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False


class StartSessionRequest(BaseModel):
    domain: str


class SubmitAnswerRequest(BaseModel):
    session_id: str
    question: str
    transcript: str
    api_key: Optional[str] = None
    emotions: dict
    domain: str
    eye_contact_score: Optional[float] = None
    ideal_answer: Optional[str] = None

# ============================================================
# AUTHENTICATION ROUTES
# ============================================================


@app.post("/api/auth/signup")
async def signup(req: SignupRequest):
    """Create a new user account"""
    try:
        # Validate password length
        if len(req.password) < 8:
            raise HTTPException(
                status_code=400, detail="Password must be at least 8 characters")

        # Validate name
        if len(req.name.strip()) < 2:
            raise HTTPException(
                status_code=400, detail="Name must be at least 2 characters")

        # Hash password
        hashed_password = auth.hash_password(req.password)

        # Create user
        user_id = database.create_user(
            req.name.strip(), req.email, hashed_password)

        if not user_id:
            raise HTTPException(
                status_code=400, detail="Email already registered")

        # Create token
        token = auth.create_access_token(
            {"user_id": user_id, "email": req.email, "name": req.name.strip()})

        return {
            "success": True,
            "token": token,
            "user": {"id": user_id, "name": req.name.strip(), "email": req.email}
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Signup error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """Login and get JWT token"""
    try:
        # Check if this is creator login
        if auth.is_creator_login(req.email, req.password):
            # Check if creator account exists in database
            user = database.get_user_by_email(req.email)

            if not user:
                # Create creator account with admin privileges
                hashed_password = auth.hash_password(req.password)
                user_id = database.create_user(
                    "Creator", req.email, hashed_password, is_admin=True)
                user = database.get_user_by_id(user_id)
            elif not user.get("is_admin"):
                # Upgrade existing account to admin
                database.set_user_admin(user["id"], True)
                user = database.get_user_by_id(user["id"])

            # Create token with admin flag
            token = auth.create_access_token({
                "user_id": user["id"],
                "email": user["email"],
                "name": user.get("name", "Creator"),
                "is_admin": True
            })

            return {
                "success": True,
                "token": token,
                "user": {
                    "id": user["id"],
                    "name": user.get("name", "Creator"),
                    "email": user["email"],
                    "is_admin": True
                }
            }

        # Normal user login
        user = database.get_user_by_email(req.email)

        # Better error messages: Check email existence first
        if not user:
            raise HTTPException(
                status_code=401, detail="No account found with this email address")

        # Then check password
        if not auth.verify_password(req.password, user["hashed_password"]):
            raise HTTPException(
                status_code=401, detail="Incorrect password. Please try again.")

        # Create token with extended expiry if remember_me is checked
        token_expiry_days = 30 if req.remember_me else 7
        from datetime import timedelta
        token = auth.create_access_token(
            {
                "user_id": user["id"],
                "email": user["email"],
                "name": user.get("name", "User"),
                "is_admin": user.get("is_admin", False)
            },
            expires_delta=timedelta(days=token_expiry_days)
        )

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user["id"],
                "name": user.get("name", "User"),
                "email": user["email"],
                "is_admin": user.get("is_admin", False)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Login error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@app.get("/api/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user["id"],
        "name": current_user.get("name", "User"),
        "email": current_user["email"]
    }

# ============================================================
# INTERVIEW SESSION ROUTES
# ============================================================


@app.get("/")
async def root():
    """API Status endpoint"""
    return {
        "service": "AI Interview Analyzer API",
        "version": "3.0.0",
        "status": "running",
        "ai_mode": "production" if USE_PRODUCTION_AI else "basic",
        "features": ["authentication", "user_history", "admin_dashboard"]
    }


@app.post("/api/start-session")
async def start_session(req: StartSessionRequest, current_user: dict = Depends(get_current_user)):
    """Start a new interview session (requires authentication)"""
    session_id = str(uuid.uuid4())
    database.save_session(session_id, req.domain, user_id=current_user["id"])
    return {"session_id": session_id}


@app.post("/api/submit-answer")
async def submit_answer(
    session_id: str = Form(...),
    # Accepted from client for answer-question mapping
    question_id: str = Form(""),
    question: str = Form(...),
    transcript: str = Form(""),  # Optional now
    emotions: str = Form("{}"),   # JSON string — default to empty dict
    domain: str = Form(...),
    eye_contact_score: float = Form(0.0),
    ideal_answer: str = Form(""),
    # User's own Gemini key (takes priority over server key)
    user_api_key: str = Form(""),
    audio: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Submit an answer via Audio Blob or Text"""
    import json
    import shutil

    # ============================================================
    # MULTI-QUESTION DEBUG LOGGING
    # ============================================================
    print(f"\n{'='*60}")
    print(f"📝 SUBMIT ANSWER - Question Received")
    print(f"{'='*60}")
    print(f"Session ID: {session_id}")
    print(f"Question: {question[:100] if len(question) > 100 else question}")
    print(f"Transcript length: {len(transcript)} chars")
    print(f"User: {current_user.get('email', 'unknown')}")

    # Check how many answers already exist for this session
    try:
        existing_session = database.get_session_results(session_id)
        if existing_session:
            existing_answers = existing_session.get('answers', [])
            print(f"📊 Existing answers in database: {len(existing_answers)}")
            print(f"   This will be answer #{len(existing_answers) + 1}")
        else:
            print(f"📊 New session - this is the first answer")
    except:
        print(f"📊 Could not check existing answers")

    print(f"{'='*60}\n")

    # Parse emotions JSON
    try:
        emotions_data = json.loads(emotions)
    except:
        emotions_data = {}

    final_transcript = transcript.strip() if transcript else ""

    # 1. SAVE AUDIO FILE (for record-keeping and analysis)
    audio_filename = None
    print(f"🔍 DEBUG: Audio parameter received: {audio is not None}")
    audio_filename = None  # Audio saving disabled — not needed since Whisper is off

    # 2. OPTIONAL: Whisper transcription (DISABLED to avoid hallucinations)
    # Whisper hallucinates technical content from silence/noise
    # We use browser speech recognition which is more accurate
    USE_WHISPER = False  # Set to True only if you want server-side transcription

    if audio_filename and USE_PRODUCTION_AI and USE_WHISPER:
        try:
            audio_path = os.path.join(os.path.dirname(
                __file__), "..", "audio_recordings", audio_filename)
            print(f"🎤 Transcribing audio: {audio_filename}")

            from services.transcription_service import get_transcription_service
            ts_service = get_transcription_service()
            result = ts_service.transcribe_audio(audio_path)

            if result["success"] and len(result["text"].strip()) > 5:
                print(f"✅ Whisper: {result['text'][:50]}...")
                # Only use if browser didn't capture anything
                if not final_transcript:
                    final_transcript = result["text"]
            else:
                print(f"⚠ Transcription failed: {result.get('error')}")

        except Exception as e:
            print(f"❌ Transcription error: {e}")

    # ============================================================
    # STEP 2: TRANSCRIPT VALIDATION (WITH COMPREHENSIVE LOGGING)
    # ============================================================
    # BEGINNER EXPLANATION:
    # This section checks if the user actually said something meaningful.
    # We need to be CAREFUL not to reject valid short answers!

    print(f"\n{'='*60}")
    print(f"📝 TRANSCRIPT VALIDATION - Step-by-Step Debug")
    print(f"{'='*60}")
    print(f"1️⃣  Raw transcript received: '{final_transcript}'")
    print(f"    Length: {len(final_transcript)} characters")

    # Reduced noise word list - only truly meaningless filler words
    # CRITICAL: Don't filter out common English words that might be part of answers!
    noise_words = {
        'um', 'uh', 'hmm', 'huh', 'oh', 'ah', 'er', 'like', 'you know'
    }

    transcript_words = final_transcript.split() if final_transcript else []
    print(f"2️⃣  Total words: {len(transcript_words)}")
    print(
        f"    Words: {transcript_words[:10]}{'...' if len(transcript_words) > 10 else ''}")

    # Count meaningful words (excluding only true filler words)
    meaningful_words = [
        w for w in transcript_words
        if w.lower() not in noise_words and len(w) > 1
    ]
    print(f"3️⃣  Meaningful words: {len(meaningful_words)}")
    print(
        f"    Meaningful: {meaningful_words[:10]}{'...' if len(meaningful_words) > 10 else ''}")

    MIN_MEANINGFUL_WORDS = 2

    # ── Detect "I don't know" style answers BEFORE calling LLM ──────────────
    NO_ANSWER_PHRASES = [
        "i don't know", "i do not know", "i have no idea", "no idea",
        "not sure", "i'm not sure", "im not sure", "i cannot answer",
        "i don't remember", "i dont remember", "i forgot",
        "i have no clue", "i'm unsure", "im unsure", "skip", "pass",
        "i don't understand", "i dont understand", "no answer",
        "i don't have an answer", "i dont have an answer", "idk"
    ]
    lower_transcript = final_transcript.lower().strip() if final_transcript else ""
    transcript_word_count = len(
        [w for w in lower_transcript.split() if len(w) > 1])

    # CRITICAL FIX: Only auto-zero for short "I don't know" answers.
    # Long answers (>20 words) that mention uncertainty briefly before explaining
    # (e.g. "I'm not sure of the exact API but closures work by...") should
    # proceed to the LLM which can properly score the actual explanation content.
    if transcript_word_count <= 20:
        is_no_answer = any(
            phrase in lower_transcript for phrase in NO_ANSWER_PHRASES)
    else:
        # For long answers, only flag if the refusal phrase IS the whole answer
        # (very little meaningful content remains after removing the phrase)
        is_no_answer = False
        for phrase in NO_ANSWER_PHRASES:
            if phrase in lower_transcript:
                without_phrase = lower_transcript.replace(phrase, '').strip()
                remaining = [w for w in without_phrase.split() if len(w) > 2]
                if len(remaining) < 8:
                    is_no_answer = True
                break  # Only check first matched phrase

    is_empty = not final_transcript or len(final_transcript.strip()) == 0
    is_too_short = len(
        meaningful_words) < MIN_MEANINGFUL_WORDS and not lower_transcript

    print(f"4️⃣  Validation checks:")
    print(f"    - Is empty: {is_empty}")
    print(f"    - Is 'I don't know' type: {is_no_answer}")
    print(f"    - Too short: {is_too_short}")

    # ── Return 0 immediately for no-answer/empty — don't waste LLM call ─────
    if is_empty or is_too_short:
        print(f"⚠️  VALIDATION FAILED: Empty/no answer detected")
        print(f"{'='*60}\n")
        analysis = {
            "score": 0,
            "feedback": "❌ No meaningful answer detected. Please speak clearly and provide a complete answer.",
            "status": "no_answer",
            "metrics": {
                "word_count": len(transcript_words),
                "meaningful_words": len(meaningful_words),
                "validation_failed": True
            },
            "breakdown": {"knowledge": 0, "relevance": 0, "clarity": 0, "confidence": 0},
            "improvement_points": [
                "Please provide an actual answer to the question.",
                "If you're unsure, explain what you do know even if it's partial.",
                "Try the text input mode if voice recognition isn't working."
            ],
            "missing_keywords": []
        }
        if ideal_answer:
            analysis["ideal_answer"] = ideal_answer

    # PROCEED WITH EVALUATION (includes 'I don't know' — LLM will score it 0)
    else:
        print(f"✅ VALIDATION PASSED: Proceeding to evaluation")
        print(
            f"    Transcript: '{final_transcript[:100]}{'...' if len(final_transcript) > 100 else ''}'")
        print(f"{'='*60}\n")

        try:
            print(f"🤖 Starting AI Analysis...")

            # Use LLM Evaluator for human-like scoring (preferred)
            from services.llm_evaluator import get_llm_evaluator

            # Build the list of keys to try in order:
            #   1. User-provided key (if valid)
            #   2. Server key (always as fallback)
            # If the first key fails (returns local_analysis), try the next one.
            keys_to_try = []
            user_key_clean = user_api_key.strip() if user_api_key else ''
            server_key_clean = os.environ.get('GEMINI_API_KEY', '').strip()

            if user_key_clean and len(user_key_clean) >= 20:
                keys_to_try.append(('user', user_key_clean))
            if server_key_clean and len(server_key_clean) >= 10:
                # Only add server key if it's different from user key
                if server_key_clean != user_key_clean:
                    keys_to_try.append(('server', server_key_clean))

            # If no keys at all, add empty so fallback handles it
            if not keys_to_try:
                keys_to_try.append(('none', ''))

            # Get the singleton WITHOUT overwriting its default key
            llm_evaluator = get_llm_evaluator()

            analysis = None
            ideal = ideal_answer if ideal_answer and len(ideal_answer.strip()) > 0 else None

            for key_source, api_key_value in keys_to_try:
                print(f"🔑 Trying {key_source} API key for scoring...")

                result = llm_evaluator.evaluate_answer(
                    question=question,
                    user_answer=final_transcript,
                    domain=domain,
                    ideal_answer=ideal,
                    api_key=api_key_value
                )

                answer_type = result.get('answer_type', '')
                print(f"   → Result: score={result['score']}/100, type={answer_type}")

                # If we got a REAL AI response (not fallback), use it and stop
                if answer_type not in ('local_analysis', 'error_fallback', 'error'):
                    analysis = result
                    print(f"✅ AI analysis from {key_source} key: Score = {result['score']}/100")
                    break

                # If this was a non-answer detection (score=0), that's a real result — keep it
                if answer_type in ('non_answer', 'empty'):
                    analysis = result
                    print(f"✅ Non-answer detected by {key_source} key: Score = 0")
                    break

                # local_analysis/error = key failed (rate limited or error)
                # Try the next key
                print(f"⚠️ {key_source} key returned fallback — trying next key...")
                analysis = result  # keep as fallback in case no key works

            print(f"📊 Final score: {analysis['score']}/100 (type: {analysis.get('answer_type', 'unknown')})")

            if ideal_answer:
                analysis["ideal_answer"] = ideal_answer

        except Exception as e:
            print(f"❌ Error in AI analysis: {e}")
            import traceback
            traceback.print_exc()

            # Use the fallback scorer to produce a REAL score based on the answer
            # instead of giving everyone a flat 50/100
            try:
                from services.llm_evaluator import get_llm_evaluator
                from utils.speech_analyzer import analyze_speech_quality
                fallback_evaluator = get_llm_evaluator()
                speech_data = analyze_speech_quality(final_transcript)
                analysis = fallback_evaluator._create_fallback_response(
                    final_transcript, question, ideal_answer, speech_data
                )
                analysis["answer_type"] = "error_fallback"
                print(f"📊 Error fallback score: {analysis['score']}/100")
            except Exception as fallback_err:
                print(f"❌ Fallback also failed: {fallback_err}")
                analysis = {
                    "score": 0,
                    "feedback": "AI analysis encountered an issue. Your answer was recorded.",
                    "status": "error",
                    "breakdown": {"knowledge": 0, "relevance": 0, "clarity": 0, "confidence": 0,
                                  "technical": 0, "grammar": 0, "accent": 0,
                                  "technical_score": 0, "communication_score": 0,
                                  "depth_score": 0, "confidence_score": 0},
                    "improvement_points": ["Review the ideal answer and compare with what you said."],
                    "missing_keywords": [],
                    "answer_type": "error_fallback"
                }

        # Emotion Analysis — in a separate try/except so it can never crash the endpoint
        try:
            emotion_service = get_emotion_service()
            emotion_analysis = emotion_service.analyze_emotions(emotions_data)
        except Exception as emo_err:
            print(f"⚠️ Emotion analysis failed (non-critical): {emo_err}")
            emotion_analysis = {"dominant_emotion": "neutral",
                                "score": 50, "feedback": "Emotion data unavailable"}

    # ============================================================
    # ENSURE ideal_answer IS IN analysis BEFORE saving
    # ============================================================
    if ideal_answer and 'ideal_answer' not in analysis:
        analysis['ideal_answer'] = ideal_answer

    # Save to Database (including audio filename if available)
    save_ok = database.save_answer(
        session_id,
        question,
        final_transcript,
        analysis,
        analysis['score'],
        emotions_data,
        audio_filename,  # Store audio file reference
        question_id=question_id if question_id else None
    )

    # ============================================================
    # VERIFY SAVE RESULT
    # ============================================================
    if not save_ok:
        print(f"\n❌ CRITICAL: Answer failed to save to database!")
        print(f"   Session: {session_id}")
        print(f"   Question: {question[:50]}...")
        return {
            "success": False,
            "error": "Failed to save answer to database. Please try again.",
            "analysis": analysis,
            "transcript": final_transcript
        }

    print(f"\n💾 ANSWER SAVED TO DATABASE")
    print(
        f"   Question: {question[:50] if len(question) > 50 else question}...")
    print(f"   Score: {analysis['score']}/100")
    print(f"   Status: {analysis.get('status', 'unknown')}")
    print(f"   Question ID: {question_id or 'none'}")

    # Verify total answers in database
    try:
        updated_session = database.get_session_results(session_id)
        if updated_session:
            total_answers = len(updated_session.get('answers', []))
            print(f"   ✅ Total answers in database now: {total_answers}")
    except Exception as e:
        print(f"   ⚠️ Could not verify total: {e}")
    print(f"{'='*60}\n")

    if eye_contact_score is not None:
        try:
            database.update_session_eye_contact(session_id, eye_contact_score)
        except Exception as e:
            print(f"⚠️ Could not update eye contact score: {e}")

    return {"success": True, "analysis": analysis, "transcript": final_transcript}


@app.get("/api/results/{session_id}")
async def get_results(session_id: str):
    """Get interview session results"""
    try:
        results = database.get_session_results(session_id)
        if not results:
            raise HTTPException(status_code=404, detail="Session not found")
        return results
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching results: {e}")
        raise HTTPException(
            status_code=500, detail=f"Could not load results: {str(e)}")


@app.post("/api/end-interview/{session_id}")
async def end_interview(session_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """
    Signal that an interview session has ended.
    Accepts the final session-level eye contact score and saves it.
    """
    try:
        print(f"\n" + "="*60)
        print(f"🏁 END INTERVIEW - Session: {session_id}")
        print(f"   User: {current_user.get('email', 'unknown')}")
        print("="*60)

        # Parse request body for eye contact score
        try:
            body = await request.json()
            final_eye_contact = body.get("eye_contact_score", None)
        except Exception:
            final_eye_contact = None

        # Save final session-level eye contact score
        if final_eye_contact is not None:
            # Convert percentage (0-100) to decimal (0-1) for database
            eye_decimal = final_eye_contact / \
                100.0 if final_eye_contact > 1 else final_eye_contact
            database.update_session_eye_contact(session_id, eye_decimal)
            print(
                f"   👁️ Final eye contact score saved: {final_eye_contact}% ({eye_decimal:.2f})")

        # Get the full session results
        results = database.get_session_results(session_id)

        if not results:
            return {
                "success": True,
                "message": "Session ended (no answers recorded)",
                "overall_score": 0
            }

        overall_score = results.get("overall_score", 0)
        answer_count = len(results.get("answers", []))

        print(
            f"✅ Session ended. Answers: {answer_count}, Overall Score: {overall_score}")

        return {
            "success": True,
            "message": f"Interview ended. {answer_count} answers recorded.",
            "session_id": session_id,
            "overall_score": overall_score,
            "answer_count": answer_count
        }
    except Exception as e:
        print(f"❌ Error ending interview: {e}")
        import traceback
        traceback.print_exc()
        # Don't throw error - just return success so frontend navigates to results
        return {
            "success": True,
            "message": "Session ended",
            "overall_score": 0
        }

# ============================================================
# USER HISTORY ROUTES
# ============================================================


@app.get("/api/history")
async def get_user_history(current_user: dict = Depends(get_current_user)):
    """Get logged-in user's interview history"""
    sessions = database.get_user_sessions(current_user["id"])
    return {"success": True, "sessions": sessions}


@app.delete("/api/history/{session_id}")
async def delete_user_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user's interview session"""
    success = database.delete_session(session_id, current_user["id"])

    if not success:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this session")

    return {"success": True, "message": "Session deleted"}


@app.get("/api/history/session/{session_id}")
async def get_session_details(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed results for a specific session"""
    session_data = database.get_session_results(session_id)

    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify ownership
    if session_data.get('user_id') != current_user['id']:
        raise HTTPException(
            status_code=403, detail="Not authorized to view this session")

    return {"success": True, "data": session_data}

# ============================================================
# GEMINI API PROXY (keeps API key hidden from client)
# ============================================================


class GeminiAnalyzeRequest(BaseModel):
    transcript: str
    question: str
    ideal_answer: Optional[str] = None
    user_api_key: Optional[str] = None


class ValidateApiKeyRequest(BaseModel):
    api_key: str


@app.post("/api/validate-api-key")
async def validate_api_key(req: ValidateApiKeyRequest, current_user: dict = Depends(get_current_user)):
    """
    Validate a user-provided Gemini API key by making a tiny test call.
    Returns {"valid": true/false, "message": "..."}.
    """
    key = (req.api_key or '').strip()
    if not key or len(key) < 10:
        return {"valid": False, "message": "API key is too short or empty."}

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=key)
        # Minimal test call — uses almost no quota
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents='Reply with the single word OK',
            config=types.GenerateContentConfig(temperature=0.0)
        )
        resp_text = response.text if response else None
        if resp_text:
            print(f"✅ User API key validated successfully")
            return {"valid": True, "message": "API key is valid and working!"}
        else:
            return {"valid": False, "message": "API key returned empty response. Please check the key."}
    except Exception as e:
        error_str = str(e)
        print(f"❌ User API key validation failed: {error_str}")
        if '401' in error_str or 'UNAUTHENTICATED' in error_str or 'invalid' in error_str.lower():
            return {"valid": False, "message": "Invalid API key. Please check and try again."}
        elif '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
            # Key is valid but rate limited — still valid
            return {"valid": True, "message": "API key is valid (currently rate-limited, but it will work)."}
        elif '403' in error_str or 'PERMISSION_DENIED' in error_str:
            return {"valid": False, "message": "API key lacks permission. Enable the Generative Language API in Google Cloud Console."}
        else:
            return {"valid": False, "message": f"Could not validate key: {error_str[:120]}"}


@app.post("/api/gemini-analyze")
async def gemini_analyze(req: GeminiAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    """
    Server-side proxy for Gemini analysis.
    Routes through the LLMEvaluator singleton so that rate-limit state is shared
    with /api/submit-answer. This prevents the double-API-call per question that
    was causing 429 cascades and scoring all answers at 50.
    """

    # Key cascade: user's key > server env key
    user_key = (req.user_api_key or '').strip()
    server_key = os.environ.get('GEMINI_API_KEY', '').strip()

    # Build key list to try in order
    keys_to_try = []
    if user_key and len(user_key) >= 20:
        keys_to_try.append(('user', user_key))
    if server_key and len(server_key) >= 10 and server_key != user_key:
        keys_to_try.append(('server', server_key))
    if not keys_to_try:
        keys_to_try.append(('none', ''))

    transcript = (req.transcript or '').strip()
    question = req.question or ''
    ideal_answer = req.ideal_answer or ''

    # Empty transcript → return zero immediately (no API call)
    if not transcript or len(transcript) < 3:
        return {
            "success": True,
            "analysis": {
                "overall_score": 0,
                "technical": 0,
                "grammar": 0,
                "accent": 0,
                "confidence": 0,
                "feedback": "No meaningful answer detected.",
                "technical_feedback": "",
                "grammar_feedback": "",
                "missing_concepts": [],
                "improvement_points": ["Provide a complete answer to the question."],
                "status": "poor"
            }
        }

    try:
        # ── Delegate to the singleton so rate-limit state is shared globally ──
        from services.llm_evaluator import get_llm_evaluator
        evaluator = get_llm_evaluator()

        result = None
        for key_source, api_key_value in keys_to_try:
            print(f"🔑 Gemini proxy: Trying {key_source} API key...")

            r = evaluator.evaluate_answer(
                question=question,
                user_answer=transcript,
                domain="general",
                ideal_answer=ideal_answer if ideal_answer else None,
                api_key=api_key_value
            )

            answer_type = r.get('answer_type', '')
            if answer_type not in ('local_analysis', 'error_fallback', 'error') or answer_type in ('non_answer', 'empty'):
                result = r
                print(f"✅ Gemini proxy: {key_source} key succeeded (score={r['score']})")
                break

            print(f"⚠️ Gemini proxy: {key_source} key returned fallback — trying next...")
            result = r  # keep fallback in case no key works

        # Map LLMEvaluator result → legacy client-expected format
        score = result.get("score", 0)
        breakdown = result.get("breakdown", {})
        feedback = result.get("feedback", "")
        improvement_points = result.get("improvement_points", [])

        analysis = {
            "overall_score": score,
            "technical": breakdown.get("technical", breakdown.get("technical_score", score)),
            "grammar": breakdown.get("grammar", breakdown.get("communication_score", score)),
            "accent": breakdown.get("accent", breakdown.get("depth_score", score)),
            "confidence": breakdown.get("confidence_score", score),
            "feedback": feedback,
            "technical_feedback": "",
            "grammar_feedback": "",
            "missing_concepts": [],
            "improvement_points": improvement_points,
            "status": result.get("status", "fair"),
            "answer_type": result.get("answer_type", "evaluated")
        }

        print(f"✅ Gemini proxy (via singleton): score={score}")
        return {"success": True, "analysis": analysis}

    except Exception as e:
        print(f"❌ Gemini proxy error: {e}")
        return {
            "success": False,
            "error": str(e),
            "analysis": None
        }




# ============================================================
# ADMIN ROUTES
# ============================================================


@app.get("/api/admin/users")
async def get_all_users_admin(admin_user: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = database.get_all_users()
    return {"success": True, "users": users}


@app.get("/api/admin/stats")
async def get_platform_stats_admin(admin_user: dict = Depends(get_admin_user)):
    """Get platform statistics (admin only)"""
    stats = database.get_platform_stats()
    return {"success": True, "stats": stats}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"\n🚀 Starting AI Interview Analyzer Backend Server on port {port}...")
    print("📊 Using Production AI Models (spaCy + Whisper)")
    print("🔐 Authentication System Enabled")
    uvicorn.run(app, host="0.0.0.0", port=port)

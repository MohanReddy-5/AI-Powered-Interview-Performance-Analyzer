import sqlite3
import json
import os
from datetime import datetime

DB_NAME = "interview_app.db"


def _db_path():
    """Return an absolute path to the database file (safe regardless of CWD)."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), DB_NAME)


def _recreate_db():
    """Rename the corrupted DB file and create a fresh one."""
    db_path = _db_path()
    if os.path.exists(db_path):
        backup = db_path + ".corrupted"
        try:
            os.rename(db_path, backup)
            print(f"⚠️  Corrupted database renamed to: {backup}")
        except Exception as rename_err:
            print(f"⚠️  Could not rename corrupted DB: {rename_err}")
            try:
                os.remove(db_path)
            except Exception:
                pass
    print("🔄 Creating fresh database...")
    init_db()   # recursive call — safe because file is gone now


def init_db():
    db_path = _db_path()
    # ── Corruption guard ─────────────────────────────────────────
    try:
        probe = sqlite3.connect(db_path)
        probe.execute("PRAGMA integrity_check")
        probe.close()
    except sqlite3.DatabaseError as e:
        print(f"❌ Database integrity check failed ({e}). Auto-recovering...")
        probe.close() if probe else None
        _recreate_db()
        return            # _recreate_db already called init_db recursively
    # ─────────────────────────────────────────────────────────────
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Create Users Table
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    is_admin BOOLEAN DEFAULT 0,
                    created_at TEXT NOT NULL
                )''')

    # Create Sessions Table
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER,
                    domain TEXT,
                    created_at TEXT,
                    overall_score INTEGER,
                    eye_contact_score REAL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )''')

    # Create Answers Table
    c.execute('''CREATE TABLE IF NOT EXISTS answers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    question_id TEXT,
                    question TEXT,
                    user_transcript TEXT,
                    ai_feedback TEXT,
                    score INTEGER,
                    emotion_summary TEXT,
                    audio_filename TEXT,
                    created_at TEXT
                )''')

    conn.commit()

    # Migration: add question_id column if missing (for existing databases)
    try:
        c.execute("PRAGMA table_info(answers)")
        columns = [col[1] for col in c.fetchall()]
        if 'question_id' not in columns:
            c.execute("ALTER TABLE answers ADD COLUMN question_id TEXT")
            conn.commit()
            print("✅ Migration: Added question_id column to answers table")
    except Exception as e:
        print(f"⚠️  Migration check: {e}")

    conn.close()
    print(f"✅ Database ready: {db_path}")


def verify_database():
    """Verify database is accessible and has correct schema"""
    try:
        conn = sqlite3.connect(_db_path())
        c = conn.cursor()

        # Check if all required tables exist
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in c.fetchall()]

        required_tables = ['users', 'sessions', 'answers']
        missing_tables = [t for t in required_tables if t not in tables]

        if missing_tables:
            print(f"⚠️  Missing database tables: {missing_tables}")
            print("   Running database initialization...")
            conn.close()
            init_db()
            print("✅ Database initialized")
            return True

        # Test read access
        c.execute("SELECT COUNT(*) FROM users")
        user_count = c.fetchone()[0]

        conn.close()
        return True

    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

# ============================================================
# USER MANAGEMENT FUNCTIONS
# ============================================================


def create_user(name, email, hashed_password, is_admin=False):
    """Create a new user"""
    conn = sqlite3.connect(_db_path())
    c = conn.cursor()
    try:
        c.execute("""INSERT INTO users (name, email, hashed_password, is_admin, created_at) 
                     VALUES (?, ?, ?, ?, ?)""",
                  (name, email, hashed_password, is_admin, datetime.now().isoformat()))
        conn.commit()
        user_id = c.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Email already exists


def get_user_by_email(email):
    """Get user by email"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None


def get_user_by_id(user_id):
    """Get user by ID"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None


def get_all_users():
    """Get all users (admin only)"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        "SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC")
    users = [dict(row) for row in c.fetchall()]
    conn.close()
    return users


def set_user_admin(user_id, is_admin=True):
    """Set user admin status"""
    conn = sqlite3.connect(_db_path())
    c = conn.cursor()
    c.execute("UPDATE users SET is_admin = ? WHERE id = ?", (is_admin, user_id))
    conn.commit()
    conn.close()

# ============================================================
# SESSION MANAGEMENT FUNCTIONS
# ============================================================


def save_session(session_id, domain, user_id=None, eye_contact_score=None):
    conn = sqlite3.connect(_db_path())
    c = conn.cursor()
    c.execute("""INSERT OR IGNORE INTO sessions 
                 (id, user_id, domain, created_at, overall_score, eye_contact_score) 
                 VALUES (?, ?, ?, ?, ?, ?)""",
              (session_id, user_id, domain, datetime.now().isoformat(), 0, eye_contact_score))
    conn.commit()
    conn.close()


def save_answer(session_id, question, transcript, feedback_json, score, emotions, audio_filename=None, question_id=None):
    """Save an answer to the database with full error handling.

    Returns:
        True if save succeeded, False if it failed.
    """
    try:
        # Validate critical inputs
        if not session_id:
            print("❌ CRITICAL: save_answer called with empty session_id")
            return False
        if score is None:
            print("⚠️  save_answer: score is None, defaulting to 0")
            score = 0

        # Ensure feedback_json is serializable
        try:
            feedback_str = json.dumps(feedback_json) if feedback_json else '{}'
        except (TypeError, ValueError) as e:
            print(f"⚠️  save_answer: feedback_json not serializable: {e}")
            feedback_str = json.dumps(
                {"error": "Feedback could not be serialized"})

        # Ensure emotions is serializable
        try:
            emotions_str = json.dumps(emotions) if emotions else '{}'
        except (TypeError, ValueError) as e:
            print(f"⚠️  save_answer: emotions not serializable: {e}")
            emotions_str = '{}'

        conn = sqlite3.connect(_db_path())
        c = conn.cursor()

        # Deduplicate: if an answer for this session+question_id already exists, UPDATE it
        if question_id:
            c.execute("SELECT id FROM answers WHERE session_id = ? AND question_id = ?",
                      (session_id, question_id))
            existing = c.fetchone()
            if existing:
                c.execute('''UPDATE answers 
                             SET question = ?, user_transcript = ?, ai_feedback = ?, score = ?, 
                                 emotion_summary = ?, audio_filename = ?, created_at = ?
                             WHERE session_id = ? AND question_id = ?''',
                          (question, transcript, feedback_str, score, emotions_str, audio_filename,
                           datetime.now().isoformat(), session_id, question_id))
                conn.commit()
                conn.close()
                print(
                    f"💾 Answer UPDATED (existing row, session={session_id[:8]}..., question_id={question_id}, score={score})")
                return True

        c.execute('''INSERT INTO answers 
                     (session_id, question_id, question, user_transcript, ai_feedback, score, emotion_summary, audio_filename, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (session_id, question_id, question, transcript, feedback_str, score, emotions_str, audio_filename, datetime.now().isoformat()))
        conn.commit()
        row_id = c.lastrowid
        conn.close()
        print(
            f"💾 Answer saved successfully (row_id={row_id}, session={session_id[:8]}..., score={score})")
        return True
    except sqlite3.IntegrityError as e:
        print(f"❌ CRITICAL: Database integrity error saving answer: {e}")
        return False
    except sqlite3.OperationalError as e:
        print(f"❌ CRITICAL: Database operational error saving answer: {e}")
        return False
    except Exception as e:
        print(f"❌ CRITICAL: Unexpected error saving answer: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_session_results(session_id):
    """Get complete session results with all metadata and answers"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Get session metadata
    c.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    session_row = c.fetchone()

    if not session_row:
        conn.close()
        return None

    session = dict(session_row)

    # Get all answers for this session (deduplicated by question_id — keep latest)
    c.execute(
        """SELECT * FROM answers 
           WHERE session_id = ? 
           AND id IN (
               SELECT MAX(id) FROM answers 
               WHERE session_id = ? 
               GROUP BY COALESCE(question_id, id)
           )
           ORDER BY created_at""", (session_id, session_id))
    answer_rows = c.fetchall()

    answers = []
    for row in answer_rows:
        answer = dict(row)
        # Parse JSON fields
        try:
            answer['feedback'] = json.loads(
                answer['ai_feedback']) if answer.get('ai_feedback') else {}
        except:
            answer['feedback'] = answer.get('ai_feedback', '')

        try:
            answer['emotions'] = json.loads(
                answer['emotion_summary']) if answer.get('emotion_summary') else {}
        except:
            answer['emotions'] = {}

        # Extract ideal_answer from feedback JSON if present
        feedback_data = answer.get('feedback', {})
        if isinstance(feedback_data, dict) and feedback_data.get('ideal_answer'):
            answer['ideal_answer'] = feedback_data['ideal_answer']

        # Extract telemetry if available (stored in feedback or separate field)
        answer['telemetry'] = answer.get('feedback', {}).get('telemetry', {})

        # Clean up - use consistent field names
        answer['question'] = answer.get('question', '')
        answer['transcript'] = answer.get('user_transcript', '')

        answers.append(answer)

    # ============================================================
    # BEGINNER EXPLANATION: Overall Score Calculation
    # ============================================================
    # WEIGHTED FORMULA:
    #   overall_score = (answer_avg * 0.85) + (eye_contact * 0.15)
    #
    # - answer_avg: Average of ALL question scores (0-100).
    #   Every question (answered or not) has a record in the DB.
    #   Unanswered questions have score=0, dragging the average down.
    # - eye_contact: Eye contact percentage (0-100).
    #   Stored in sessions table as a decimal (0-1), converted here.
    #
    # IMPORTANT: We ALWAYS recalculate (no caching) so the score is
    # always accurate even when new answers are added mid-session.
    # ============================================================

    if answers:
        print(f"\n{'='*60}")
        print(f"📊 CALCULATING OVERALL SCORE (85% answers + 15% eye contact)")
        print(f"{'='*60}")
        print(f"Total answers in database: {len(answers)}")

        # 1) Answer average: ALL answer records (unanswered = score 0)
        total_score = sum(a.get('score', 0) or 0 for a in answers)
        answer_avg = total_score / len(answers)

        print(f"\n📈 Answer Score Breakdown:")
        for i, a in enumerate(answers, 1):
            print(f"   Q{i}: {a.get('score', 0)}/100")
        print(f"   Answer Average: {round(answer_avg)}/100")

        # 2) Eye contact score (stored as decimal 0-1 in DB, convert to 0-100)
        raw_eye = session.get('eye_contact_score') or 0
        eye_contact_pct = raw_eye * 100 if raw_eye <= 1 else raw_eye
        eye_contact_pct = min(100, max(0, eye_contact_pct))
        print(f"   Eye Contact: {round(eye_contact_pct)}/100 (raw: {raw_eye})")

        # 3) Weighted overall: 85% answers + 15% eye contact
        weighted_score = round((answer_avg * 0.85) + (eye_contact_pct * 0.15))
        weighted_score = min(100, max(0, weighted_score))

        print(f"\n✅ WEIGHTED OVERALL SCORE:")
        print(f"   Answer component (85%): {round(answer_avg * 0.85)}")
        print(
            f"   Eye contact component (15%): {round(eye_contact_pct * 0.15)}")
        print(f"   Final: {weighted_score}/100")
        print(f"{'='*60}\n")

        # ALWAYS update session score (no stale cache)
        session['overall_score'] = weighted_score
        try:
            write_conn = sqlite3.connect(_db_path())
            wc = write_conn.cursor()
            wc.execute("UPDATE sessions SET overall_score = ? WHERE id = ?",
                       (weighted_score, session_id))
            write_conn.commit()
            write_conn.close()
            print(f"💾 Persisted session overall_score to DB: {weighted_score}")
        except Exception as e:
            print(f"⚠️  Failed to persist overall_score: {e}")

    conn.close()

    return {
        "session": session,
        "overall_score": session['overall_score'],
        "answers": answers,
        "user_id": session.get('user_id')  # For ownership check
    }


def get_user_sessions(user_id):
    """Get all sessions for a specific user"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""SELECT id, domain, created_at, overall_score, eye_contact_score 
                 FROM sessions 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC""", (user_id,))
    sessions = [dict(row) for row in c.fetchall()]
    conn.close()
    return sessions


def delete_session(session_id, user_id):
    """Delete a session (with ownership check)"""
    conn = sqlite3.connect(_db_path())
    c = conn.cursor()

    # Verify ownership
    c.execute("SELECT user_id FROM sessions WHERE id = ?", (session_id,))
    result = c.fetchone()

    if not result or result[0] != user_id:
        conn.close()
        return False  # Not authorized

    # Delete answers first (foreign key constraint)
    c.execute("DELETE FROM answers WHERE session_id = ?", (session_id,))
    # Delete session
    c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    conn.commit()
    conn.close()
    return True


def update_session_eye_contact(session_id, eye_contact_score):
    """Update eye contact score for a session"""
    conn = sqlite3.connect(_db_path())
    c = conn.cursor()
    c.execute("UPDATE sessions SET eye_contact_score = ? WHERE id = ?",
              (eye_contact_score, session_id))
    conn.commit()
    conn.close()

# ============================================================
# ADMIN FUNCTIONS
# ============================================================


def get_platform_stats():
    """Get platform statistics (admin only)"""
    conn = sqlite3.connect(_db_path())
    c = conn.cursor()

    # Total users
    c.execute("SELECT COUNT(*) FROM users")
    total_users = c.fetchone()[0]

    # Total interviews
    c.execute("SELECT COUNT(*) FROM sessions")
    total_interviews = c.fetchone()[0]

    # Average score
    c.execute("SELECT AVG(overall_score) FROM sessions WHERE overall_score > 0")
    avg_score = c.fetchone()[0] or 0

    conn.close()

    return {
        "total_users": total_users,
        "total_interviews": total_interviews,
        "average_score": round(avg_score, 2)
    }

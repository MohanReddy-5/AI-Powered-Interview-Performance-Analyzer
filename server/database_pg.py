"""
PostgreSQL adapter for cloud deployment (Neon/Render).

IMPORTANT: This module has IDENTICAL function signatures to database.py (SQLite version).
It is only used when the DATABASE_URL environment variable is set.
Locally, the original SQLite database.py runs untouched.

This ensures zero risk to the existing system.
"""
import json
import os
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print("⚠️  psycopg2 not installed — PostgreSQL mode unavailable")


DATABASE_URL = os.environ.get("DATABASE_URL", "")


def _get_conn():
    """Get a PostgreSQL connection using DATABASE_URL."""
    if not HAS_PSYCOPG2:
        raise RuntimeError("psycopg2 not installed. Run: pip install psycopg2-binary")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def _dict_cursor(conn):
    """Return a cursor that returns dicts instead of tuples."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db():
    """Create tables if they don't exist (PostgreSQL syntax)."""
    conn = _get_conn()
    c = conn.cursor()

    # Create Users Table
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    is_admin BOOLEAN DEFAULT FALSE,
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
                    id SERIAL PRIMARY KEY,
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
    conn.close()
    print(f"✅ PostgreSQL database ready (Neon)")


def verify_database():
    """Verify database is accessible and has correct schema."""
    try:
        conn = _get_conn()
        c = conn.cursor()

        # Check if all required tables exist
        c.execute("""SELECT table_name FROM information_schema.tables 
                     WHERE table_schema = 'public'""")
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
        c.fetchone()

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
    conn = _get_conn()
    c = conn.cursor()
    try:
        c.execute("""INSERT INTO users (name, email, hashed_password, is_admin, created_at) 
                     VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                  (name, email, hashed_password, is_admin, datetime.now().isoformat()))
        user_id = c.fetchone()[0]
        conn.commit()
        conn.close()
        return user_id
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        conn.close()
        return None  # Email already exists
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"❌ Error creating user: {e}")
        return None


def get_user_by_email(email):
    """Get user by email"""
    conn = _get_conn()
    c = _dict_cursor(conn)
    c.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None


def get_user_by_id(user_id):
    """Get user by ID"""
    conn = _get_conn()
    c = _dict_cursor(conn)
    c.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None


def get_all_users():
    """Get all users (admin only)"""
    conn = _get_conn()
    c = _dict_cursor(conn)
    c.execute(
        "SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC")
    users = [dict(row) for row in c.fetchall()]
    conn.close()
    return users


def set_user_admin(user_id, is_admin=True):
    """Set user admin status"""
    conn = _get_conn()
    c = conn.cursor()
    c.execute("UPDATE users SET is_admin = %s WHERE id = %s", (is_admin, user_id))
    conn.commit()
    conn.close()


# ============================================================
# SESSION MANAGEMENT FUNCTIONS
# ============================================================

def save_session(session_id, domain, user_id=None, eye_contact_score=None):
    conn = _get_conn()
    c = conn.cursor()
    c.execute("""INSERT INTO sessions 
                 (id, user_id, domain, created_at, overall_score, eye_contact_score) 
                 VALUES (%s, %s, %s, %s, %s, %s)
                 ON CONFLICT (id) DO NOTHING""",
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

        conn = _get_conn()
        c = conn.cursor()

        # Deduplicate: if an answer for this session+question_id already exists, UPDATE it
        if question_id:
            c.execute("SELECT id FROM answers WHERE session_id = %s AND question_id = %s",
                      (session_id, question_id))
            existing = c.fetchone()
            if existing:
                c.execute('''UPDATE answers 
                             SET question = %s, user_transcript = %s, ai_feedback = %s, score = %s, 
                                 emotion_summary = %s, audio_filename = %s, created_at = %s
                             WHERE session_id = %s AND question_id = %s''',
                          (question, transcript, feedback_str, score, emotions_str, audio_filename,
                           datetime.now().isoformat(), session_id, question_id))
                conn.commit()
                conn.close()
                print(
                    f"💾 Answer UPDATED (existing row, session={session_id[:8]}..., question_id={question_id}, score={score})")
                return True

        c.execute('''INSERT INTO answers 
                     (session_id, question_id, question, user_transcript, ai_feedback, score, emotion_summary, audio_filename, created_at) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                  (session_id, question_id, question, transcript, feedback_str, score, emotions_str, audio_filename, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        print(
            f"💾 Answer saved successfully (session={session_id[:8]}..., score={score})")
        return True
    except Exception as e:
        print(f"❌ CRITICAL: Error saving answer: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_session_results(session_id):
    """Get complete session results with all metadata and answers"""
    conn = _get_conn()
    c = _dict_cursor(conn)

    # Get session metadata
    c.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
    session_row = c.fetchone()

    if not session_row:
        conn.close()
        return None

    session = dict(session_row)

    # Get all answers for this session (deduplicated by question_id — keep latest)
    c.execute(
        """SELECT * FROM answers 
           WHERE session_id = %s 
           AND id IN (
               SELECT MAX(id) FROM answers 
               WHERE session_id = %s 
               GROUP BY COALESCE(question_id, CAST(id AS TEXT))
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

        # Extract telemetry if available
        answer['telemetry'] = answer.get('feedback', {}).get('telemetry', {})

        # Clean up - use consistent field names
        answer['question'] = answer.get('question', '')
        answer['transcript'] = answer.get('user_transcript', '')

        answers.append(answer)

    # ============================================================
    # Overall Score Calculation (same formula as SQLite version)
    # WEIGHTED: 85% answers + 15% eye contact
    # ============================================================

    if answers:
        print(f"\n{'='*60}")
        print(f"📊 CALCULATING OVERALL SCORE (85% answers + 15% eye contact)")
        print(f"{'='*60}")
        print(f"Total answers in database: {len(answers)}")

        total_score = sum(a.get('score', 0) or 0 for a in answers)
        answer_avg = total_score / len(answers)

        print(f"\n📈 Answer Score Breakdown:")
        for i, a in enumerate(answers, 1):
            print(f"   Q{i}: {a.get('score', 0)}/100")
        print(f"   Answer Average: {round(answer_avg)}/100")

        raw_eye = session.get('eye_contact_score') or 0
        eye_contact_pct = raw_eye * 100 if raw_eye <= 1 else raw_eye
        eye_contact_pct = min(100, max(0, eye_contact_pct))
        print(f"   Eye Contact: {round(eye_contact_pct)}/100 (raw: {raw_eye})")

        weighted_score = round((answer_avg * 0.85) + (eye_contact_pct * 0.15))
        weighted_score = min(100, max(0, weighted_score))

        print(f"\n✅ WEIGHTED OVERALL SCORE:")
        print(f"   Answer component (85%): {round(answer_avg * 0.85)}")
        print(f"   Eye contact component (15%): {round(eye_contact_pct * 0.15)}")
        print(f"   Final: {weighted_score}/100")
        print(f"{'='*60}\n")

        session['overall_score'] = weighted_score
        try:
            update_conn = _get_conn()
            uc = update_conn.cursor()
            uc.execute("UPDATE sessions SET overall_score = %s WHERE id = %s",
                       (weighted_score, session_id))
            update_conn.commit()
            update_conn.close()
            print(f"💾 Persisted session overall_score to DB: {weighted_score}")
        except Exception as e:
            print(f"⚠️  Failed to persist overall_score: {e}")

    conn.close()

    return {
        "session": session,
        "overall_score": session['overall_score'],
        "answers": answers,
        "user_id": session.get('user_id')
    }


def get_user_sessions(user_id):
    """Get all sessions for a specific user"""
    conn = _get_conn()
    c = _dict_cursor(conn)
    c.execute("""SELECT id, domain, created_at, overall_score, eye_contact_score 
                 FROM sessions 
                 WHERE user_id = %s 
                 ORDER BY created_at DESC""", (user_id,))
    sessions = [dict(row) for row in c.fetchall()]
    conn.close()
    return sessions


def delete_session(session_id, user_id):
    """Delete a session (with ownership check)"""
    conn = _get_conn()
    c = conn.cursor()

    # Verify ownership
    c.execute("SELECT user_id FROM sessions WHERE id = %s", (session_id,))
    result = c.fetchone()

    if not result or result[0] != user_id:
        conn.close()
        return False

    # Delete answers first
    c.execute("DELETE FROM answers WHERE session_id = %s", (session_id,))
    # Delete session
    c.execute("DELETE FROM sessions WHERE id = %s", (session_id,))

    conn.commit()
    conn.close()
    return True


def update_session_eye_contact(session_id, eye_contact_score):
    """Update eye contact score for a session"""
    conn = _get_conn()
    c = conn.cursor()
    c.execute("UPDATE sessions SET eye_contact_score = %s WHERE id = %s",
              (eye_contact_score, session_id))
    conn.commit()
    conn.close()


# ============================================================
# ADMIN FUNCTIONS
# ============================================================

def get_platform_stats():
    """Get platform statistics (admin only)"""
    conn = _get_conn()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM users")
    total_users = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM sessions")
    total_interviews = c.fetchone()[0]

    c.execute("SELECT AVG(overall_score) FROM sessions WHERE overall_score > 0")
    avg_score = c.fetchone()[0] or 0

    conn.close()

    return {
        "total_users": total_users,
        "total_interviews": total_interviews,
        "average_score": round(avg_score, 2)
    }

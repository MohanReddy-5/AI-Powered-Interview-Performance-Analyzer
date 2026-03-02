"""
Startup checks for the AI Interview Analyzer backend.
Validates environment variables and optional dependencies before the server starts.
"""
import os
from dotenv import load_dotenv

load_dotenv()


def check_environment() -> bool:
    """
    Validate the environment is properly configured.
    Returns True if all critical checks pass, False otherwise.
    """
    all_ok = True

    print("\n" + "=" * 60)
    print("🔍 Running Startup Checks...")
    print("=" * 60)

    # 1. Check GEMINI_API_KEY
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if api_key and len(api_key) >= 10:
        masked_key = api_key[:8] + '*' * (len(api_key) - 8)
        print(f"  ✅ GEMINI_API_KEY configured ({masked_key})")
    else:
        print("  ⚠️  GEMINI_API_KEY not configured — AI analysis will use fallback scoring")
        # Not fatal — the LLM evaluator has a fallback

    # 2. Check JWT_SECRET
    jwt_secret = os.environ.get("JWT_SECRET", "")
    if jwt_secret and jwt_secret != "your-secret-key-change-this-in-production":
        print("  ✅ JWT_SECRET configured")
    else:
        print("  ⚠️  JWT_SECRET is using the default value — change in production!")

    # 3. Check optional dependencies
    print("\n  📦 Checking optional dependencies:")

    # spaCy
    try:
        import spacy
        print(f"    ✅ spaCy {spacy.__version__} installed")
        try:
            spacy.load("en_core_web_lg")
            print("    ✅ spaCy model 'en_core_web_lg' available")
        except OSError:
            try:
                spacy.load("en_core_web_sm")
                print(
                    "    ⚠️  Only 'en_core_web_sm' available (run: python -m spacy download en_core_web_lg)")
            except OSError:
                print(
                    "    ⚠️  No spaCy model found (run: python -m spacy download en_core_web_lg)")
    except ImportError:
        print("    ⚠️  spaCy not installed — NLP service will be unavailable")

    # google-genai
    try:
        from google import genai
        print("    ✅ google-genai installed")
    except ImportError:
        print("    ⚠️  google-genai not installed (run: pip install google-genai)")

    # Whisper (optional)
    try:
        import whisper
        print("    ✅ Whisper installed (server-side transcription available)")
    except ImportError:
        print("    ℹ️  Whisper not installed (using browser speech recognition instead)")

    # bcrypt
    try:
        import bcrypt
        print(f"    ✅ bcrypt installed")
    except ImportError:
        print("    ❌ bcrypt not installed — authentication will fail!")
        all_ok = False

    # python-jose
    try:
        from jose import jwt
        print("    ✅ python-jose installed")
    except ImportError:
        print("    ❌ python-jose not installed — JWT tokens will fail!")
        all_ok = False

    # ffmpeg check
    import shutil
    if shutil.which("ffmpeg"):
        print("    ✅ ffmpeg found in PATH")
    else:
        print("    ⚠️  ffmpeg not found — audio format conversion may fail")

    # 4. Check database
    try:
        import database
        if database.verify_database():
            print("  ✅ Database accessible and schema valid")
        else:
            print("  ⚠️  Database check returned issues")
    except Exception as e:
        print(f"  ⚠️  Database check failed: {e}")

    print("\n" + "=" * 60)
    if all_ok:
        print("✅ All critical checks passed!")
    else:
        print("❌ Some critical checks failed — see above")
    print("=" * 60 + "\n")

    return all_ok

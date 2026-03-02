import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # LLM Settings
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    # Application Settings
    DEBUG = True
    allow_origins = ["*"]  # For CORS

    # Storage
    DB_NAME = "interview_app.db"

    # Emotion Analysis
    EMOTION_INTERVAL = 1.0  # Seconds between emotion checks if processing on backend

    # Scoring Weights (Optional, can be used in Aggregator)
    WEIGHTS = {
        "knowledge": 0.4,
        "relevance": 0.3,
        "clarity": 0.2,
        "confidence": 0.1
    }


config = Config()

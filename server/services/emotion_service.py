"""
Emotion detection service using DeepFace (optional - fallback to basic scoring if fails)
"""
from typing import Dict, Optional
import warnings
warnings.filterwarnings('ignore')


class EmotionService:
    def __init__(self):
        """Initialize emotion detection service"""
        self.enabled = False
        try:
            from deepface import DeepFace
            self.DeepFace = DeepFace
            self.enabled = True
            print("✓ DeepFace emotion service initialized")
        except Exception as e:
            print(f"⚠ DeepFace not available: {e}")
            print("  Using fallback emotion analysis")

    def analyze_emotions(self, emotion_data) -> Dict:
        """
        Analyze emotions from frontend data or process image.
        Args:
            emotion_data: Dict containing emotion percentages or image path
        Returns:
            Analyzed emotion metrics
        """
        # ── Input validation ──────────────────────────────────────────────────
        if not emotion_data or not isinstance(emotion_data, dict):
            return {
                "dominant_emotion": "neutral",
                "confidence": 0.5,
                "score": 50,
                "feedback": "No emotion data provided"
            }

        if not self.enabled:
            # Fallback: Use emotion data from frontend (face-api.js)
            return self._analyze_frontend_emotions(emotion_data)

        # If we have an image, analyze with DeepFace
        if "image_path" in emotion_data:
            return self._analyze_with_deepface(emotion_data["image_path"])

        # Otherwise use frontend data
        return self._analyze_frontend_emotions(emotion_data)

    def _analyze_frontend_emotions(self, emotion_data: Dict) -> Dict:
        """Analyze emotions from frontend face-api.js data"""
        emotions = emotion_data.get("emotions", {})

        # ── Validate emotions dict ────────────────────────────────────────────
        if not emotions or not isinstance(emotions, dict):
            return {
                "dominant_emotion": "neutral",
                "confidence": 0.5,
                "score": 50,
                "feedback": "Emotion data not available"
            }

        # Find dominant emotion
        try:
            dominant = max(emotions.items(), key=lambda x: x[1])
        except (ValueError, TypeError):
            return {
                "dominant_emotion": "neutral",
                "confidence": 0.5,
                "score": 50,
                "feedback": "Could not determine dominant emotion"
            }

        # Score based on positive emotions
        # emotion values are expected in 0-1 range from face-api.js
        positive_emotions = ["happy", "neutral", "surprise"]

        positive_score = sum(emotions.get(e, 0) for e in positive_emotions)

        # FIX: Cap score at 100 — positive_score is already 0-1 range so * 100
        # gives 0-100. Use min() to prevent exceeding 100.
        emotion_score = min(100, max(0, int(positive_score * 100)))

        # FIX: Normalize confidence to 0-1 range
        raw_confidence = dominant[1]
        # If value looks like a percentage (> 1), normalize it
        confidence = (raw_confidence /
                      100.0) if raw_confidence > 1 else float(raw_confidence)
        confidence = min(1.0, max(0.0, confidence))

        # Generate feedback
        if dominant[0] in positive_emotions:
            feedback = f"Good emotional presence. Detected primarily {dominant[0]} expressions."
        else:
            feedback = f"Try to maintain a calmer demeanor. Detected primarily {dominant[0]} expressions."

        return {
            "dominant_emotion": dominant[0],
            "confidence": confidence,
            "score": emotion_score,
            "feedback": feedback,
            "all_emotions": emotions
        }

    def _analyze_with_deepface(self, image_path: str) -> Dict:
        """Analyze image with DeepFace"""
        try:
            result = self.DeepFace.analyze(
                image_path,
                actions=['emotion'],
                enforce_detection=False
            )

            emotions = result[0]['emotion']
            dominant = result[0]['dominant_emotion']

            # DeepFace returns percentages (0-100); normalize to 0-1 for confidence
            raw_score = int(emotions.get('happy', 0) +
                            emotions.get('neutral', 0))
            capped_score = min(100, max(0, raw_score))

            return {
                "dominant_emotion": dominant,
                "confidence": min(1.0, emotions[dominant] / 100.0),
                "score": capped_score,
                "feedback": f"Detected {dominant} as dominant emotion",
                "all_emotions": emotions
            }
        except Exception as e:
            return {
                "dominant_emotion": "neutral",
                "confidence": 0.5,
                "score": 50,
                "feedback": f"Analysis failed: {str(e)}"
            }


# Module-level singleton
_emotion_service: Optional[EmotionService] = None


def get_emotion_service() -> EmotionService:
    """Get or create emotion service singleton"""
    global _emotion_service  # noqa: PLW0603 – singleton pattern
    if _emotion_service is None:
        _emotion_service = EmotionService()
    return _emotion_service

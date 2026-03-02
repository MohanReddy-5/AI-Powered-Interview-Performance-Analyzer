"""
Production AI service for speech-to-text transcription using Whisper.
Whisper is optional — if not installed, the service will be unavailable.
"""
from typing import Optional
import warnings
warnings.filterwarnings('ignore')

# Lazy import — whisper is optional
_whisper = None


def _load_whisper():
    global _whisper
    if _whisper is None:
        try:
            import whisper
            _whisper = whisper
        except ImportError:
            raise ImportError(
                "openai-whisper is not installed. Install with: pip install openai-whisper"
            )
    return _whisper


class TranscriptionService:
    def __init__(self, model_name: str = "base"):
        """
        Initialize Whisper model
        Args:
            model_name: "tiny", "base", "small", "medium", "large"
        """
        whisper = _load_whisper()
        print(f"Loading Whisper {model_name} model...")
        self.model = whisper.load_model(model_name)
        print(f"✓ Whisper {model_name} loaded successfully")

    def transcribe_audio(self, audio_path: str, language: str = "en") -> dict:
        """
        Transcribe audio file to text
        Args:
            audio_path: Path to audio file
            language: Language code (default: "en")
        Returns:
            dict with 'text', 'segments', 'language'
        """
        try:
            result = self.model.transcribe(
                audio_path,
                language=language,
                fp16=False  # CPU compatible
            )

            return {
                "text": result["text"],
                "segments": result.get("segments", []),
                "language": result.get("language", language),
                "success": True
            }
        except Exception as e:
            return {
                "text": "",
                "error": str(e),
                "success": False
            }


# Global instance
_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service(model_name: str = "base") -> TranscriptionService:
    """Get or create transcription service singleton"""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService(model_name)
    return _transcription_service

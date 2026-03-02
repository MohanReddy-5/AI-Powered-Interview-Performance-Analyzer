"""
Production NLP service using spaCy for content analysis.
spaCy is loaded lazily — if not installed, the service will be unavailable.
"""
from typing import Dict, List
import re
import logging

logger = logging.getLogger(__name__)

# Lazy spaCy import
_spacy = None


def _load_spacy():
    global _spacy
    if _spacy is None:
        try:
            import spacy
            _spacy = spacy
        except ImportError:
            raise ImportError(
                "spaCy is not installed. Install with: pip install spacy && python -m spacy download en_core_web_lg"
            )
    return _spacy


class NLPService:
    def __init__(self, model_name: str = "en_core_web_lg"):
        """Initialize spaCy NLP model"""
        spacy = _load_spacy()
        print(f"Loading spaCy {model_name} model...")
        try:
            self.nlp = spacy.load(model_name)
        except OSError:
            # Fallback to smaller model
            print(f"⚠️  {model_name} not found, trying en_core_web_sm...")
            try:
                self.nlp = spacy.load("en_core_web_sm")
                model_name = "en_core_web_sm"
            except OSError:
                raise RuntimeError(
                    f"No spaCy model found. Run: python -m spacy download {model_name}"
                )
        print(f"✓ spaCy {model_name} loaded successfully")

    def analyze_answer(self, text: str, question: str = "", domain: str = "") -> Dict:
        """
        Analyze interview answer using STRICT, HONEST scoring
        Args:
            text: The answer text
            question: The interview question
            domain: Interview domain (e.g., "Frontend Developer")
        Returns:
            Analysis dict with scores and feedback
        """
        # STRICT: Empty or no answer = 0%
        if not text or len(text.strip()) == 0:
            return {
                "score": 0,
                "feedback": "No answer provided. Please speak your response clearly.",
                "status": "poor",
                "metrics": {}
            }

        # Clean the text
        cleaned = text.strip()
        words = cleaned.split()
        word_count_raw = len(words)

        # STRICT: Very short answer (< 5 words) = 0%
        if word_count_raw < 5:
            return {
                "score": 0,
                "feedback": "Answer is too short. Please provide a detailed explanation.",
                "status": "poor",
                "metrics": {"word_count": word_count_raw}
            }

        # CRITICAL: Filter out noise/filler words to check for MEANINGFUL content
        noise_words = {
            'the', 'a', 'an', 'um', 'uh', 'hmm', 'huh', 'oh', 'ah', 'okay', 'ok',
            'so', 'and', 'but', 'or', 'is', 'it', 'i', 'he', 'she', 'we', 'they',
            'this', 'that', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
            'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
            'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
            'by', 'from', 'as', 'into', 'like', 'just', 'you', 'your', 'my', 'me',
            'not', 'no', 'yes', 'yeah', 'yep', 'nope', 'well', 'then', 'than',
            'very', 'really', 'actually', 'basically', 'literally', 'right',
            'its', "it's", 'our', 'their', 'there', 'here', 'up', 'down',
            'out', 'about', 'if', 'when', 'what', 'which', 'who', 'how', 'all',
            'each', 'every', 'both', 'few', 'more', 'some', 'any', 'most',
            'other', 'also', 'after', 'before', 'because', 'while'
        }
        meaningful_words = [
            w for w in words if w.lower() not in noise_words and len(w) > 1]
        meaningful_count = len(meaningful_words)

        # If less than 3 meaningful words, this is noise/ambient sound, not an answer
        if meaningful_count < 3:
            return {
                "score": 0,
                "feedback": "No meaningful answer detected. Please provide a clear, detailed response.",
                "status": "poor",
                "metrics": {"word_count": word_count_raw, "meaningful_words": meaningful_count}
            }

        # STRICT: Check for "I don't know" type responses = 0%
        text_lower = cleaned.lower()
        dont_know_phrases = [
            "i don't know", "i dont know", "i do not know",
            "no idea", "not sure", "don't remember", "dont remember",
            "i'm not sure", "im not sure", "i am not sure"
        ]
        if any(phrase in text_lower for phrase in dont_know_phrases):
            return {
                "score": 0,
                "feedback": "You indicated uncertainty. Try to provide your best understanding of the concept.",
                "status": "poor",
                "metrics": {"word_count": word_count_raw}
            }

        # Process text with spaCy
        doc = self.nlp(text)

        # Extract metrics
        metrics = {
            "word_count": len([token for token in doc if not token.is_punct]),
            "sentence_count": len(list(doc.sents)),
            "unique_words": len(set([token.text.lower() for token in doc if token.is_alpha])),
            "technical_terms": self._count_technical_terms(doc, domain),
            "avg_word_length": sum(len(token.text) for token in doc if token.is_alpha) / max(len([t for t in doc if t.is_alpha]), 1),
            "noun_chunks": len(list(doc.noun_chunks)),
            "meaningful_words": meaningful_count
        }

        # SCORING based on meaningful content, not raw word count
        word_count = metrics["word_count"]
        technical_terms = metrics["technical_terms"]

        # Base score depends on meaningful word count AND technical terms
        if meaningful_count >= 20 and technical_terms >= 3:
            base_score = 70  # Substantial answer with technical depth
        elif meaningful_count >= 15 and technical_terms >= 2:
            base_score = 60  # Good answer
        elif meaningful_count >= 10:
            base_score = 45  # Decent answer
        elif meaningful_count >= 5:
            base_score = 30  # Short but present
        else:
            base_score = 15  # Very minimal

        # Calculate density (terms per word) safely
        density = technical_terms / max(meaningful_count, 1)

        # If high density (>15% is technical), boost
        if density > 0.15 and meaningful_count >= 5:
            base_score = max(base_score, 65)
        elif density > 0.10 and meaningful_count >= 5:
            base_score = max(base_score, 50)

        # Bonus points - Weighted towards CONTENT quality
        vocab_bonus = min(metrics["unique_words"] / 15 * 5, 5)  # +5 max
        sentence_bonus = min(metrics["sentence_count"] / 2 * 5, 5)  # +5 max
        technical_bonus = min(metrics["technical_terms"] * 5, 20)

        # RELEVANCE BONUS: Does the answer actually address the question?
        relevance_bonus = 0
        if question:
            stop_words = {"what", "how", "why", "when", "where", "who", "is", "are", "the", "a", "an",
                          "in", "on", "of", "to", "for", "with", "explain", "describe", "tell", "me", "about"}
            q_tokens = [w.lower() for w in re.findall(
                r'\b\w+\b', question) if w.lower() not in stop_words]

            if q_tokens:
                matches = sum(1 for token in q_tokens if token in text_lower)
                relevance_bonus = min(matches * 3, 15)

        total_score = int(base_score + vocab_bonus +
                          sentence_bonus + technical_bonus + relevance_bonus)

        # Cap at 100
        total_score = min(total_score, 100)

        # Generate feedback
        feedback = self._generate_feedback(metrics, total_score)

        # Determine status
        if total_score >= 80:
            status = "excellent"
        elif total_score >= 60:
            status = "good"
        elif total_score >= 40:
            status = "fair"
        else:
            status = "poor"

        return {
            "score": total_score,
            "feedback": feedback,
            "status": status,
            "metrics": metrics,
            "missing_keywords": []
        }

    def _count_technical_terms(self, doc, domain: str) -> int:
        """Count technical terms based on domain"""
        # Technical keywords by domain
        tech_keywords = {
            "frontend": ["react", "component", "state", "props", "hook", "dom", "css", "html", "javascript", "ui", "responsive"],
            "backend": ["api", "database", "server", "endpoint", "authentication", "query", "cache", "rest", "http"],
            "fullstack": ["frontend", "backend", "api", "database", "component", "server"],
            "data": ["data", "analysis", "model", "algorithm", "statistics", "python", "sql", "visualization"],
            "behavioral": ["team", "project", "challenge", "solution", "communication", "leadership"]
        }

        domain_lower = domain.lower()
        keywords = []
        for key, values in tech_keywords.items():
            if key in domain_lower:
                keywords.extend(values)

        if not keywords:
            keywords = tech_keywords.get("fullstack", [])

        text_lower = doc.text.lower()
        count = sum(1 for keyword in keywords if keyword in text_lower)
        return count

    def _generate_feedback(self, metrics: Dict, score: int) -> str:
        """Generate contextual feedback based on metrics"""
        feedback_parts = []

        # Length feedback - Context aware!
        if metrics["word_count"] < 30:
            if score > 70:
                feedback_parts.append(
                    "Concise and precise answer! You covered key points efficiently.")
            else:
                feedback_parts.append(
                    "Your answer is quite brief. Aim for more detail or examples.")
        elif metrics["word_count"] > 150:
            feedback_parts.append(
                "Good detail! Be mindful of keeping answers concise.")
        else:
            feedback_parts.append("Good answer length.")

        # Vocabulary feedback
        vocab_ratio = metrics["unique_words"] / max(metrics["word_count"], 1)
        if vocab_ratio < 0.5:
            feedback_parts.append("Try using more varied vocabulary.")
        else:
            feedback_parts.append("Good vocabulary diversity.")

        # Technical terms
        if metrics["technical_terms"] < 2:
            feedback_parts.append(
                "Include more domain-specific technical terms.")
        else:
            feedback_parts.append(
                f"Good use of technical terminology ({metrics['technical_terms']} terms).")

        return " ".join(feedback_parts)


# Global instance
_nlp_service = None


def get_nlp_service(model_name: str = "en_core_web_lg"):
    """Get or create NLP service singleton"""
    global _nlp_service
    if _nlp_service is None:
        _nlp_service = NLPService(model_name)
    return _nlp_service

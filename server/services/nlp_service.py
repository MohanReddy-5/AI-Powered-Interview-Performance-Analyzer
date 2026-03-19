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
        # WORD-COUNT GUARD: Only flag if the answer is short (≤20 words).
        # Long answers that mention uncertainty briefly before giving an explanation
        # should NOT be zeroed — let the scoring handle them properly.
        text_lower = cleaned.lower()
        dont_know_phrases = [
            "i don't know", "i dont know", "i do not know",
            "no idea", "don't remember", "dont remember",
            "i'm not sure", "im not sure", "i am not sure"
        ]
        word_count_check = len(cleaned.split())
        if word_count_check <= 20:
            if any(phrase in text_lower for phrase in dont_know_phrases):
                return {
                    "score": 0,
                    "feedback": "You indicated uncertainty. Try to provide your best understanding of the concept.",
                    "status": "poor",
                    "metrics": {"word_count": word_count_raw}
                }
        else:
            # Long answer: only zero if refusal phrase + very little real content remains
            for phrase in dont_know_phrases:
                if phrase in text_lower:
                    without_phrase = text_lower.replace(phrase, '').strip()
                    remaining_words = [w for w in without_phrase.split() if len(w) > 2]
                    if len(remaining_words) < 8:
                        return {
                            "score": 0,
                            "feedback": "You indicated uncertainty. Try to explain what you DO know, even if incomplete.",
                            "status": "poor",
                            "metrics": {"word_count": word_count_raw}
                        }
                    break  # Found phrase but user gave real content — continue scoring

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
        """Count technical terms based on domain — comprehensive coverage."""
        tech_keywords = {
            # Frontend
            "frontend": [
                "react", "reactjs", "component", "state", "props", "hook", "usestate", "useeffect",
                "useref", "usecallback", "usememo", "usecontext", "usereducer",
                "virtual dom", "dom", "css", "html", "javascript", "typescript",
                "responsive", "flexbox", "css grid", "media query", "ui", "ux",
                "webpack", "vite", "babel", "jsx", "tsx", "spa", "pwa",
                "rendering", "hydration", "lazy loading", "code splitting",
                "vue", "angular", "svelte", "next.js", "nuxt",
                "redux", "zustand", "mobx", "recoil", "context api",
                "accessibility", "aria", "semantic html", "seo",
            ],
            # Backend
            "backend": [
                "api", "rest", "restful", "graphql", "grpc", "websocket",
                "database", "sql", "nosql", "orm", "query", "index",
                "server", "endpoint", "route", "middleware", "authentication",
                "authorization", "jwt", "oauth", "session", "cookie",
                "cache", "redis", "memcache", "message queue", "kafka",
                "microservices", "monolith", "load balancer", "reverse proxy",
                "nginx", "apache", "node", "express", "fastapi", "django",
                "flask", "spring", "rails", "laravel",
            ],
            # Fullstack
            "fullstack": [
                "frontend", "backend", "api", "database", "component", "server",
                "deployment", "devops", "ci/cd", "docker", "kubernetes",
                "cloud", "aws", "gcp", "azure", "scalability", "performance",
            ],
            # Data / ML / AI
            "data": [
                "data", "analysis", "model", "algorithm", "statistics",
                "python", "pandas", "numpy", "sklearn", "tensorflow", "pytorch",
                "sql", "visualization", "etl", "pipeline", "feature",
                "training", "inference", "neural network", "deep learning",
                "clustering", "regression", "classification", "overfitting",
            ],
            # DevOps / Infrastructure
            "devops": [
                "docker", "kubernetes", "container", "pod", "cluster",
                "ci/cd", "pipeline", "jenkins", "github actions", "terraform",
                "ansible", "monitoring", "logging", "alerting", "prometheus",
                "grafana", "load balancer", "auto scaling", "cloud",
                "infrastructure", "iac", "deployment", "rollback",
            ],
            # System Design
            "system": [
                "scalability", "availability", "reliability", "latency",
                "throughput", "load balancer", "database sharding", "replication",
                "caching", "cdn", "message queue", "event driven", "microservices",
                "api gateway", "service mesh", "cap theorem", "consistency",
                "partition tolerance", "horizontal scaling", "vertical scaling",
            ],
            # Behavioral
            "behavioral": [
                "team", "project", "challenge", "solution", "communication",
                "leadership", "collaboration", "conflict", "deadline",
                "prioritize", "stakeholder", "agile", "scrum", "sprint",
                "feedback", "mentoring", "ownership", "impact",
            ],
        }

        domain_lower = domain.lower()
        keywords = set()

        # Collect all matching domain keywords
        for key, values in tech_keywords.items():
            if key in domain_lower:
                keywords.update(values)

        # Always include fullstack terms as baseline
        if not keywords:
            keywords.update(tech_keywords.get("fullstack", []))

        text_lower = doc.text.lower()
        # Partial match: check if any keyword is a substring of the text
        count = sum(1 for keyword in keywords if keyword in text_lower)
        return count

    def _generate_feedback(self, metrics: Dict, score: int) -> str:
        """Generate specific, actionable feedback based on spaCy metrics."""
        feedback_parts = []

        # Length feedback — context aware
        word_count = metrics["word_count"]
        if word_count < 20:
            if score >= 70:
                feedback_parts.append(
                    "Concise and precise — you covered key concepts efficiently. "
                    "Consider adding a brief example to make it even stronger.")
            else:
                feedback_parts.append(
                    f"Your answer was brief ({word_count} words). Aim for at least 40 words "
                    "with a definition, explanation, and one real-world example.")
        elif word_count > 200:
            feedback_parts.append(
                "Thorough answer — be mindful of length in real interviews; "
                "aim to make the key point in 60–100 words.")
        else:
            feedback_parts.append(f"Good answer length ({word_count} words).")

        # Vocabulary diversity
        vocab_ratio = metrics["unique_words"] / max(metrics["word_count"], 1)
        if vocab_ratio < 0.45:
            feedback_parts.append(
                "Vocabulary is repetitive — try to use synonyms or different terms "
                "to show breadth of knowledge.")
        elif vocab_ratio >= 0.7:
            feedback_parts.append("Strong vocabulary diversity — well-varied language.")

        # Technical depth
        tech_terms = metrics["technical_terms"]
        if tech_terms == 0:
            feedback_parts.append(
                "No domain-specific technical terms detected. "
                "Name the exact concepts, tools, or patterns you're describing.")
        elif tech_terms < 3:
            feedback_parts.append(
                f"Some technical terms used ({tech_terms}). "
                "Include more domain-specific terminology to demonstrate expertise.")
        else:
            feedback_parts.append(
                f"Good technical depth — {tech_terms} domain-specific terms used.")

        # Sentence structure
        sentence_count = metrics.get("sentence_count", 1)
        if sentence_count == 1 and word_count > 30:
            feedback_parts.append(
                "The answer was one long run-on sentence. "
                "Break it into 2–3 clear sentences for clarity.")
        elif sentence_count >= 3:
            feedback_parts.append("Clear multi-sentence structure — easy to follow.")

        return " ".join(feedback_parts)


# Global instance
_nlp_service = None


def get_nlp_service(model_name: str = "en_core_web_lg"):
    """Get or create NLP service singleton"""
    global _nlp_service
    if _nlp_service is None:
        _nlp_service = NLPService(model_name)
    return _nlp_service

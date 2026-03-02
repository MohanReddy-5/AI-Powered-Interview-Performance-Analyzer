"""
LLM EVALUATOR MODULE - FIXED
=============================
Human-like answer evaluation using rubric-based scoring.
Uses google-genai package for Gemini API access, with timeout and robust error handling.

FIXES APPLIED:
- Added per-call timeout (30s) to prevent connection exhaustion
- Wrapped json.loads() in try/except to handle malformed JSON
- Re-create client per-request so retries after timeout work correctly
- Score formula: rubric scores 0-10, multiplied to 0-100 correctly
- Fallback now recognizes technical terms and short valid answers
- API key length check relaxed to >= 10 (covers all real keys)
- Better input sanitization to prevent JSON escape issues
- Independent retry counters per call (not global session)
"""

from typing import Dict, Optional
import json
import time
import os
import re
import logging
import threading

logger = logging.getLogger(__name__)

# Lazy import at call time to avoid module-level crashes
_genai = None
_genai_types = None


def _get_genai():
    """Lazy import of google.genai to avoid startup crash if not installed."""
    global _genai, _genai_types
    if _genai is None:
        try:
            from google import genai
            from google.genai import types
            _genai = genai
            _genai_types = types
        except ImportError as e:
            raise ImportError(
                f"google-genai package not installed. Run: pip install google-genai\nOriginal error: {e}"
            )
    return _genai, _genai_types


class LLMEvaluator:
    """
    Evaluates interview answers using AI with a rubric system.

    Features:
    - Rubric-based scoring (knowledge, relevance, clarity, confidence)
    - Partial credit for reasoning attempts
    - Per-call retry logic (not global pool exhaustion)
    - Thread-safe timeout on every API call
    - Robust JSON parsing (handles markdown fences, partial responses)
    - Sensible fallback when AI is unavailable
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.max_retries = 2          # per individual call
        self.call_timeout = 25        # seconds per API call
        # Try these models in order — first available wins
        self.model_candidates = [
            'models/gemini-2.0-flash',
            'models/gemini-2.0-flash-lite',
            'models/gemini-flash-latest',
        ]

    def evaluate_answer(
        self,
        question: str,
        user_answer: str,
        domain: str,
        ideal_answer: Optional[str] = None,
        answer_type: str = "confident",
        api_key: Optional[str] = None
    ) -> Dict:
        """
        Evaluate an interview answer using rubric-based scoring.
        Each call creates its own client to avoid shared-state timeouts.
        """
        active_api_key = (api_key or self.api_key or "").strip()

        # ── PRE-LLM: Check for non-answers BEFORE wasting API quota ──
        non_answer = self._is_non_answer(user_answer)
        if non_answer:
            logger.info(
                "Non-answer detected (reason: %s) — score 0, skipping LLM", non_answer)
            return {
                "score": 0,
                "feedback": self._get_non_answer_feedback(non_answer),
                "status": "poor",
                "breakdown": {"knowledge": 0, "relevance": 0, "clarity": 0, "confidence": 0,
                              "technical": 0, "grammar": 0, "accent": 0,
                              "technical_score": 0, "communication_score": 0,
                              "depth_score": 0, "confidence_score": 0},
                "improvement_points": [
                    "Always attempt an answer — even partial knowledge is better than silence.",
                    "Study the ideal answer and practice explaining it in your own words.",
                    "If unsure, describe what you DO know about the topic."
                ],
                "answer_type": "non_answer"
            }

        # Relaxed check: real Gemini keys are typically 39 chars (AIzaSy...)
        if not active_api_key or len(active_api_key) < 10:
            # No API key — use concept-level fallback instead of error
            logger.warning("No API key — using concept-level fallback scoring")
            return self._create_fallback_response(user_answer, question, ideal_answer)

        # Sanitize inputs to prevent JSON injection in prompt
        safe_question = self._sanitize_text(question)
        safe_answer = self._sanitize_text(user_answer)
        safe_domain = self._sanitize_text(domain)
        safe_ideal = self._sanitize_text(
            ideal_answer) if ideal_answer else None

        # Independent retry loop per call
        for attempt in range(self.max_retries + 1):
            try:
                # Small courtesy delay to avoid hitting free-tier rate limits (60 req/min)
                if attempt > 0:
                    time.sleep(2.5 * attempt)
                else:
                    # ~75 req/min safety buffer on first attempt
                    time.sleep(0.8)

                result = self._evaluate_with_timeout(
                    question=safe_question,
                    user_answer=safe_answer,
                    domain=safe_domain,
                    ideal_answer=safe_ideal,
                    answer_type=answer_type,
                    api_key=active_api_key
                )

                if self._validate_response(result):
                    return result

                logger.warning(
                    "Invalid LLM response on attempt %d — retrying", attempt + 1)
                if attempt < self.max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue

            except TimeoutError:
                logger.error("LLM call timed out on attempt %d/%d",
                             attempt + 1, self.max_retries + 1)
                if attempt < self.max_retries:
                    time.sleep(2)
                    continue

            except Exception as e:
                error_str = str(e)
                # 429 = quota exhausted — retrying immediately wastes quota, use fallback
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                    logger.warning(
                        "Rate limited (429) on attempt %d — using fallback.", attempt + 1)
                    break
                logger.error(
                    "LLM evaluation error (attempt %d): %s", attempt + 1, e)
                if attempt < self.max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue

        # All retries exhausted — fall back to concept-level scoring
        logger.warning(
            "All retries exhausted — using concept-level fallback scoring")
        return self._create_fallback_response(user_answer, question, ideal_answer)

    def _evaluate_with_timeout(
        self,
        question: str,
        user_answer: str,
        domain: str,
        ideal_answer: Optional[str],
        answer_type: str,
        api_key: str
    ) -> Dict:
        """Run LLM evaluation in a thread with a hard timeout."""
        result_holder = {}
        error_holder = {}

        def _call():
            try:
                genai, types = _get_genai()
                # Create a fresh client per call — avoids connection reuse after timeout
                client = genai.Client(api_key=api_key)
                prompt = self._build_evaluation_prompt(
                    question=question,
                    user_answer=user_answer,
                    domain=domain,
                    ideal_answer=ideal_answer
                )
                # Try each model candidate in order
                last_error = None
                for model_name in self.model_candidates:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                temperature=0.3,
                                response_mime_type='application/json'
                            )
                        )
                        result_holder['value'] = self._parse_llm_response(
                            response.text)
                        break  # success
                    except Exception as model_err:
                        err_str = str(model_err)
                        if '404' in err_str or 'NOT_FOUND' in err_str:
                            last_error = model_err
                            continue  # try next model
                        raise  # non-404 errors propagate immediately
                else:
                    if last_error:
                        raise last_error  # all models returned 404
            except Exception as e:
                error_holder['value'] = e

        t = threading.Thread(target=_call, daemon=True)
        t.start()
        t.join(timeout=self.call_timeout)

        if t.is_alive():
            raise TimeoutError(
                f"LLM call exceeded {self.call_timeout}s timeout")

        if 'value' in error_holder:
            raise error_holder['value']

        return result_holder.get('value', {})

    def _parse_llm_response(self, response_text: str) -> Dict:
        """
        Robustly parse LLM JSON response.
        Handles: markdown code fences, trailing commas, partial responses.
        """
        if not response_text:
            raise ValueError("Empty response from LLM")

        text = response_text.strip()

        # Strip markdown code fences if present
        text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
        text = text.strip()

        # Try straight parse first
        try:
            raw = json.loads(text)
        except json.JSONDecodeError:
            # Try extracting first JSON object with regex
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if not match:
                raise ValueError(
                    f"No JSON object found in response: {text[:200]}")
            try:
                raw = json.loads(match.group())
            except json.JSONDecodeError as e:
                raise ValueError(
                    f"JSON parse failed: {e} | text: {text[:200]}")

        # Extract and clamp rubric scores (LLM returns 0-10)
        knowledge = max(0, min(10, float(raw.get("knowledge",  0))))
        relevance = max(0, min(10, float(raw.get("relevance",  0))))
        clarity = max(0, min(10, float(raw.get("clarity",    0))))
        confidence = max(0, min(10, float(raw.get("confidence", 0))))

        # Overall score: average of 4 rubric scores, scaled to 0-100
        overall_score = int(
            round((knowledge + relevance + clarity + confidence) / 4 * 10))
        overall_score = max(0, min(100, overall_score))

        # ══ POST-LLM ENFORCEMENT ══
        # Absolute 0 only for non-answers (relevance literally 0)
        if relevance == 0:
            overall_score = 0
            feedback_text = str(raw.get("feedback", "No feedback available"))
        else:
            feedback_text = str(raw.get("feedback", "No feedback available"))
            # NO ARTIFICIAL FLOOR — allow the full score range
            # Weak answers can legitimately score 15-45
            # The LLM prompt already instructs proper scoring

        status = (
            "excellent" if overall_score >= 80 else
            "good" if overall_score >= 60 else
            "fair" if overall_score >= 40 else
            "poor"
        )

        # Scale breakdown scores to 0-100 for Results page compatibility
        knowledge_100 = int(round(knowledge * 10))
        relevance_100 = int(round(relevance * 10))
        clarity_100 = int(round(clarity * 10))
        confidence_100 = int(round(confidence * 10))

        return {
            "score": overall_score,
            "feedback": feedback_text,
            "status": status,
            "breakdown": {
                # Raw 0-10 scores
                "knowledge":  knowledge,
                "relevance":  relevance,
                "clarity":    clarity,
                "confidence": confidence,
                # Scaled 0-100 scores for Results.jsx radar chart
                "technical": knowledge_100,
                "grammar": clarity_100,
                "accent": relevance_100,
                "technical_score": knowledge_100,
                "communication_score": clarity_100,
                "depth_score": relevance_100,
                "confidence_score": confidence_100
            },
            "improvement_points": raw.get("improvement_points", []),
            "ideal_answer": str(raw.get("ideal_answer", "")) if raw.get("ideal_answer") else None,
            "answer_type": "evaluated"
        }

    def _sanitize_text(self, text: str) -> str:
        """Remove characters that can break JSON string embedding in prompts."""
        if not text:
            return ""
        # Replace literal backslashes and control chars that break JSON
        text = text.replace('\\', ' ').replace('\r', ' ')
        # Collapse excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _build_evaluation_prompt(
        self,
        question: str,
        user_answer: str,
        domain: str,
        ideal_answer: Optional[str]
    ) -> str:
        """Builds the evaluation prompt for the LLM."""

        prompt = f"""You are a PRECISE and FAIR interview evaluator for {domain} positions.
Score the answer ACCURATELY based on actual content quality. Do NOT inflate scores.

**QUESTION:** {question}

**CANDIDATE'S ANSWER:** {user_answer}
"""
        if ideal_answer:
            prompt += f"\n**IDEAL ANSWER (reference for evaluation):** {ideal_answer}\n"

        prompt += """
STEP 1 — CHECK FOR NON-ANSWERS (do this first, mandatory):
These MUST get ALL scores = 0 immediately:
  • "I don't know", "no idea", "skip", "pass", any refusal
  • Empty, pure noise ("um", "uh"), fewer than 3 real words
  • Completely off-topic/unrelated content (score 0 for all)

STEP 2 — SCORE ACCURATELY (use the FULL range):
This is a SPOKEN interview. Be fair but precise.
  • Barely relevant, major confusion → score 2-3/10
  • Shows some understanding but misses most concepts → score 3-4/10
  • Decent answer, covers some key points → score 5-6/10
  • Good answer, covers most concepts well → score 6-7/10
  • Strong, comprehensive answer → score 8-9/10
  • Exceptional, expert-level → score 9-10/10

SPECIAL CASES:
  • BEHAVIORAL questions (teamwork, leadership, etc.): Thoughtful personal answers = 6+. Genuine reflection = 7+.
  • SHORT BUT CORRECT: Brief correct answers can score 5-7. Brevity is fine if accurate.
  • PARAPHRASING: Informal correct explanations get full credit.

⚠️ CRITICAL: Use the FULL 0-10 range. A mediocre answer should get 3-5, not 6+. Do NOT inflate every answer.

**OUTPUT — ONLY this JSON, no markdown:**
{"knowledge": <0-10>, "relevance": <0-10>, "clarity": <0-10>, "confidence": <0-10>, "feedback": "<2-3 specific sentences, start with what they got right>", "improvement_points": ["tip 1", "tip 2", "tip 3"], "ideal_answer": "<expert model answer in 2-4 sentences>"}

REMINDER: Non-answers = all 0. Use the FULL score range for genuine attempts. Do NOT cluster everything at 6+.
"""
        return prompt

    def _validate_response(self, response: Dict) -> bool:
        """Validates that the LLM response has all required fields."""
        if not response:
            return False

        required_fields = ["score", "feedback", "status", "breakdown"]
        for field in required_fields:
            if field not in response:
                return False

        breakdown = response.get("breakdown", {})
        for score_name in ["knowledge", "relevance", "clarity", "confidence"]:
            if score_name not in breakdown:
                return False
            score = breakdown[score_name]
            if not isinstance(score, (int, float)) or score < 0 or score > 10:
                return False

        overall = response.get("score", -1)
        if not isinstance(overall, (int, float)) or overall < 0 or overall > 100:
            return False

        return True

    # ── NON-ANSWER DETECTION (pre-LLM gate) ─────────────────────────────────

    _REFUSAL_PHRASES = [
        "i don't know", "i do not know", "i have no idea", "no idea",
        "not sure", "i'm not sure", "im not sure", "i cannot answer",
        "i can't answer", "i cant answer", "i don't remember", "i dont remember",
        "i forgot", "i have no clue", "no clue", "i'm unsure", "im unsure",
        "i don't understand", "i dont understand", "idk", "skip", "pass",
        "next question", "no answer", "nothing", "dunno", "i dunno",
        "cant say", "can't say", "no comment", "beats me",
        "i have nothing to say", "i got nothing", "i have nothing",
        "i really don't know", "honestly i don't know", "honestly no idea",
        "i'm blank", "im blank", "my mind is blank", "drawing a blank",
        "i can't think of anything", "zero clue", "never heard of it",
        "don't know what that is", "no clue what that means",
        "i don't have an answer", "not applicable", "i have no response",
        "what is that", "what does that mean",
    ]

    _REFUSAL_PATTERNS = [
        re.compile(
            r"\b(don'?t|do\s*not|can'?t|cannot|have\s*no|no)\s+(know|idea|clue|answer|response|understanding)", re.I),
        re.compile(
            r"\b(not\s+sure|unsure|uncertain|clueless|blank|stumped)\b", re.I),
        re.compile(r"\b(skip|pass|next)\s*(this)?\s*(one|question)?\b", re.I),
        re.compile(
            r"\b(never\s+(heard|learned|studied|seen|encountered))\b", re.I),
    ]

    _FILLER_WORDS = frozenset([
        'um', 'uh', 'hmm', 'err', 'ah', 'like', 'erm', 'uhh', 'umm',
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'i', 'me', 'my', 'we', 'you', 'your', 'he', 'she', 'it', 'they',
        'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'but',
        'not', 'this', 'that', 'so', 'do', 'does', 'did', 'will', 'would',
        'can', 'could', 'should', 'have', 'has', 'had', 'just', 'very',
        'also', 'been', 'being', 'what', 'how', 'why', 'when', 'where',
        'which', 'who', 'whom', 'basically', 'actually', 'really', 'well',
        'yeah', 'yes', 'no', 'okay', 'right', 'sure', 'thing', 'things',
    ])

    def _is_non_answer(self, text: str):
        """Multi-layer non-answer detection. Returns reason string or None."""
        if not text or not text.strip():
            return 'empty'

        lower = text.lower().strip()

        # Layer 1: Explicit refusal phrases
        for phrase in self._REFUSAL_PHRASES:
            if phrase in lower:
                return 'refusal'

        # Layer 2: Regex-based refusal intent (short answers only)
        words = lower.split()
        if len(words) <= 15:
            for pattern in self._REFUSAL_PATTERNS:
                if pattern.search(lower):
                    return 'refusal_intent'

        # Layer 3: Pure filler / noise
        meaningful = [
            w for w in words if w not in self._FILLER_WORDS and len(w) > 1]
        if len(meaningful) < 2:
            return 'noise_only'

        # Layer 4: Gibberish (most words lack vowels)
        if len(meaningful) < 10:
            gibberish_count = sum(
                1 for w in meaningful
                if not re.search(r'[aeiou]', w) and len(w) > 2
            )
            if gibberish_count > len(meaningful) * 0.6:
                return 'gibberish'

        return None  # Not a non-answer

    def _get_non_answer_feedback(self, reason: str) -> str:
        """Human-readable feedback for non-answers."""
        messages = {
            'empty': 'No answer was provided. Please speak or type your answer.',
            'refusal': '"I don\'t know" or refusal responses receive a score of 0. Always attempt an answer — even partial knowledge is better than silence.',
            'refusal_intent': 'Your response indicates uncertainty. Try to explain what you DO know, even if incomplete.',
            'noise_only': 'Only filler sounds were detected. Please provide a substantive answer.',
            'gibberish': 'The response appears incoherent. Please provide a clear, structured answer.',
        }
        return messages.get(reason, 'No meaningful answer detected.')

    # ── CONCEPT-LEVEL FALLBACK SCORING ─────────────────────────────────────

    def _create_fallback_response(
        self, user_answer: str, question: str, ideal_answer: str = None
    ) -> Dict:
        """
        Concept-level fallback when LLM is unavailable.
        Uses TF-IDF cosine similarity + keyword overlap instead of word-count.
        """
        import math
        from collections import Counter

        cleaned = user_answer.strip() if user_answer else ""
        words = cleaned.lower().split()

        if not cleaned or len(words) == 0:
            return {
                "score": 0, "feedback": "No answer provided.", "status": "no_answer",
                "breakdown": {"knowledge": 0, "relevance": 0, "clarity": 0, "confidence": 0,
                              "technical": 0, "grammar": 0, "accent": 0,
                              "technical_score": 0, "communication_score": 0,
                              "depth_score": 0, "confidence_score": 0},
                "improvement_points": ["Please provide an answer."],
                "answer_type": "empty"
            }

        # Filter to meaningful words
        meaningful = [
            w for w in words if w not in self._FILLER_WORDS and len(w) > 1]
        meaningful_count = len(meaningful)

        # Very short with no technical terms = too brief
        tech_pattern = re.compile(
            r'\b(api|rest|http|sql|nosql|orm|mvc|oop|async|await|promise|'
            r'callback|closure|recursion|array|stack|queue|tree|graph|'
            r'hash|cache|thread|process|class|object|function|variable|'
            r'database|server|client|frontend|backend|algorithm|'
            r'boolean|string|null|undefined|json|html|css|'
            r'react|angular|vue|node|python|java|typescript|javascript|'
            r'docker|kubernetes|git|component|state|props|hook|'
            r'schema|index|query|deploy|module|interface|pattern|'
            r'protocol|framework|library|package|scope|prototype|'
            r'inheritance|polymorphism|encapsulation|abstraction)\b',
            re.IGNORECASE
        )
        has_tech = bool(tech_pattern.search(cleaned))

        if meaningful_count < 2 and not has_tech:
            return {
                "score": 0,
                "feedback": "No meaningful answer provided. Please give a complete answer.",
                "status": "poor",
                "breakdown": {"knowledge": 0, "relevance": 0, "clarity": 0, "confidence": 0,
                              "technical": 0, "grammar": 0, "accent": 0,
                              "technical_score": 0, "communication_score": 0,
                              "depth_score": 0, "confidence_score": 0},
                "improvement_points": ["Provide a complete answer.", "Explain in your own words."],
                "answer_type": "too_brief"
            }

        # ── TF-IDF COSINE SIMILARITY (when ideal_answer is available) ──
        score = 0
        feedback = ""

        if ideal_answer and len(ideal_answer.strip()) > 10:
            cosine_sim = self._compute_cosine_similarity(
                cleaned.lower(), ideal_answer.lower()
            )
            keyword_score = self._compute_keyword_overlap(
                cleaned.lower(), question.lower(), ideal_answer.lower()
            )

            # Weighted blend
            raw = cosine_sim * 0.5 + keyword_score * \
                0.3 + min(meaningful_count / 30, 1.0) * 0.2

            # Calibrate to 0-100
            if raw <= 0.05:
                score = int(raw * 200)  # 0-10
            elif raw <= 0.15:
                score = 10 + int((raw - 0.05) * 200)  # 10-30
            elif raw <= 0.30:
                score = 30 + int((raw - 0.15) * 200)  # 30-60
            elif raw <= 0.50:
                score = 60 + int((raw - 0.30) * 150)  # 60-90
            else:
                score = 90 + int((raw - 0.50) * 20)   # 90-100

            score = max(0, min(100, score))

            # Extra boost for technical terms
            if has_tech:
                score = min(100, score + 8)

            # Zero gate: if cosine < 0.1 AND no keyword overlap → unrelated
            if cosine_sim < 0.1 and keyword_score < 0.05 and not has_tech:
                score = 0
                feedback = "Your answer does not appear to be related to the question."
            elif score >= 75:
                feedback = "Strong answer with good concept coverage."
            elif score >= 50:
                feedback = "Decent answer covering some key concepts. Add more depth."
            elif score >= 25:
                feedback = "Answer shows some awareness but misses major concepts."
            else:
                feedback = "Answer is weak. Review the ideal answer for key concepts."

        else:
            # No ideal answer — basic quality assessment
            if meaningful_count < 5:
                score = 25 if has_tech else 15
            elif meaningful_count < 15:
                score = 45 if has_tech else 35
            elif meaningful_count < 30:
                score = 60 if has_tech else 50
            else:
                score = 70 if has_tech else 60
            feedback = "Answer recorded. Scoring is approximate without an ideal answer reference."

        status = (
            "excellent" if score >= 80 else
            "good" if score >= 60 else
            "fair" if score >= 40 else
            "poor"
        )

        rb = max(0, min(10, int(score / 10)))
        return {
            "score": score,
            "feedback": feedback + " (Note: AI scoring unavailable — concept-level analysis used.)",
            "status": status,
            "breakdown": {
                "knowledge": rb, "relevance": rb, "clarity": rb, "confidence": rb,
                "technical": score, "grammar": min(100, score + 10),
                "accent": score, "confidence_score": score,
                "technical_score": score, "communication_score": min(100, score + 10),
                "depth_score": score
            },
            "improvement_points": [
                "AI analysis unavailable — concept-level scoring applied.",
                "Focus on covering the key technical concepts in your answer.",
                "Review the ideal answer for concepts you may have missed."
            ],
            "answer_type": "fallback_concept"
        }

    def _compute_cosine_similarity(self, text1: str, text2: str) -> float:
        """TF-IDF cosine similarity between two texts (Python version)."""
        import math
        from collections import Counter

        stop = self._FILLER_WORDS
        def tokenize(t): return [w for w in re.sub(
            r'[^a-z0-9\s]', '', t).split() if len(w) > 1 and w not in stop]

        t1 = tokenize(text1)
        t2 = tokenize(text2)
        if not t1 or not t2:
            return 0.0

        # TF
        tf1 = Counter(t1)
        tf2 = Counter(t2)
        for k in tf1:
            tf1[k] /= len(t1)
        for k in tf2:
            tf2[k] /= len(t2)

        vocab = set(tf1) | set(tf2)

        # IDF
        idf = {}
        for w in vocab:
            doc_count = (1 if w in tf1 else 0) + (1 if w in tf2 else 0)
            idf[w] = math.log(2 / doc_count) + 1

        # TF-IDF vectors + cosine
        dot = sum(tf1.get(w, 0) * idf[w] *
                  tf2.get(w, 0) * idf[w] for w in vocab)
        mag1 = math.sqrt(sum((tf1.get(w, 0) * idf[w]) ** 2 for w in vocab))
        mag2 = math.sqrt(sum((tf2.get(w, 0) * idf[w]) ** 2 for w in vocab))

        return dot / (mag1 * mag2) if mag1 * mag2 > 0 else 0.0

    def _compute_keyword_overlap(self, answer: str, question: str, ideal: str) -> float:
        """Compute keyword overlap between answer and (question + ideal answer)."""
        stop = self._FILLER_WORDS

        def get_keys(t): return set(
            w for w in re.sub(r'[^a-z0-9\s]', '', t).split() if len(w) > 2 and w not in stop
        )

        answer_keys = get_keys(answer)
        topic_keys = get_keys(question) | get_keys(ideal)

        if not topic_keys:
            return 0.0

        overlap = len(answer_keys & topic_keys)
        return overlap / len(topic_keys)

    def _create_error_response(self, error_message: str) -> Dict:
        return {
            "score": 0,
            "feedback": error_message,
            "status": "error",
            "breakdown": {"knowledge": 0, "relevance": 0, "clarity": 0, "confidence": 0,
                          "technical": 0, "grammar": 0, "accent": 0,
                          "technical_score": 0, "communication_score": 0,
                          "depth_score": 0, "confidence_score": 0},
            "improvement_points": ["Configure GEMINI_API_KEY to enable AI evaluation."],
            "answer_type": "error"
        }


# ─── Singleton ────────────────────────────────────────────────────────────────
_llm_evaluator: Optional[LLMEvaluator] = None


def get_llm_evaluator(api_key: Optional[str] = None) -> LLMEvaluator:
    """Get or create the LLM evaluator singleton."""
    global _llm_evaluator
    if _llm_evaluator is None:
        _llm_evaluator = LLMEvaluator(api_key=api_key)
    elif api_key and not _llm_evaluator.api_key:
        # Accept a late-supplied API key
        _llm_evaluator.api_key = api_key
    return _llm_evaluator

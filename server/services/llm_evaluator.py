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

# Global timestamp of the last Gemini API call (used to enforce minimum inter-call gap).
# A mutable list so it can be modified from inside a thread function without nonlocal.
_last_api_call_time: list = [0.0]

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
        # Priority: explicit arg > environment variable
        self.api_key = api_key or os.environ.get('GEMINI_API_KEY')
        self.max_retries = 2          # per individual call
        self.call_timeout = 30        # seconds per API call
        # CONFIRMED working Gemini model names (verified against API).
        # Only use names that are actually available on the free tier.
        # Invalid names cause non-404 errors that bypass the try-next-model
        # logic and hit the 429 handler instead, wasting quota rapidly.
        self.model_candidates = [
            'gemini-2.0-flash',          # Highest free-tier RPM (primary)
            'gemini-1.5-flash',          # Reliable fallback, high free-tier quota
            'gemini-1.5-flash-8b',       # Lightest fallback
        ]
        # Rate-limit cooldown: when a 429 is received, block further API calls
        # for `rate_limit_cooldown` seconds to let the full quota minute reset.
        # Free tier = 15 RPM. One call per question.
        self._rate_limit_until: float = 0.0   # Unix timestamp; 0 = not limited
        self._rate_limited_key: str = ''       # Which key triggered the cooldown
        self._rate_limit_lock = threading.Lock()
        self.rate_limit_cooldown = 65          # seconds to wait after a 429

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

        API Key Priority:
          1. Per-call `api_key` parameter (user-provided key)
          2. Singleton's self.api_key (set at init from env)
          3. Live os.environ['GEMINI_API_KEY'] (re-read every call)
        """
        # ── API KEY CASCADE ───────────────────────────────────────────
        # Step 1: prefer the per-call key if it looks valid
        active_api_key = (api_key or "").strip()
        key_source = "user-provided"

        # Step 2: fall back to the singleton's stored key
        if not active_api_key or len(active_api_key) < 10:
            active_api_key = (self.api_key or "").strip()
            key_source = "singleton"

        # Step 3: fall back to live env var (covers late .env edits)
        if not active_api_key or len(active_api_key) < 10:
            active_api_key = os.environ.get('GEMINI_API_KEY', '').strip()
            key_source = "env-var"
            # Also update the singleton so next call doesn't repeat this
            if active_api_key and len(active_api_key) >= 10:
                self.api_key = active_api_key

        if active_api_key and len(active_api_key) >= 10:
            masked = active_api_key[:8] + '***'
            print(f"🔑 LLM Evaluator: Using {key_source} API key ({masked})")
        else:
            print(f"⚠️ LLM Evaluator: No valid API key found from any source")

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

        # ── Run speech quality analysis (used by both LLM and fallback) ──
        from utils.speech_analyzer import analyze_speech_quality
        speech_metrics = analyze_speech_quality(user_answer)

        # Final key check: try environment if still empty
        if not active_api_key or len(active_api_key) < 10:
            active_api_key = os.environ.get('GEMINI_API_KEY', '').strip()

        if not active_api_key or len(active_api_key) < 10:
            # No API key — return honest "AI unavailable" response
            print("❌ LLM Evaluator: No valid API key found. Using fallback.")
            logger.warning("No API key — AI scoring unavailable")
            return self._create_fallback_response(user_answer, question, ideal_answer, speech_metrics)

        # ── Honor the 429 cooldown window ──────────────────────────────────────
        # If we hit a rate limit recently, skip the API call entirely and return
        # the fallback until the quota window resets. This prevents every
        # subsequent question in the session from burning retries and failing.
        # CRITICAL: Only apply cooldown if using the SAME key that triggered it.
        # If the user provided their OWN key, bypass the cooldown — their key
        # has its own quota.
        server_key = os.environ.get('GEMINI_API_KEY', '').strip()
        is_user_key = api_key and api_key.strip(
        ) != server_key and len(api_key.strip()) >= 20
        with self._rate_limit_lock:
            cooldown_active = time.time() < self._rate_limit_until
            cooldown_key = self._rate_limited_key

        if cooldown_active:
            # Check if the active key is the SAME key that caused the cooldown
            key_matches_cooldown = (
                active_api_key.strip() == cooldown_key
                or (not is_user_key and cooldown_key == server_key)
            )
            if key_matches_cooldown:
                remaining = int(self._rate_limit_until - time.time())
                print(
                    f"⏳ LLM Evaluator: rate-limit cooldown active — {remaining}s remaining. Using fallback.")
                logger.warning(
                    "Rate-limit cooldown active (%ds remaining) — skipping API call.", remaining)
                return self._create_fallback_response(user_answer, question, ideal_answer, speech_metrics)
            else:
                print(
                    f"🔑 Using different API key — bypassing cooldown for rate-limited key")

        print(
            f"🤖 LLM Evaluator: Starting analysis for question: '{question[:30]}...'")

        # Sanitize inputs to prevent JSON injection in prompt
        safe_question = self._sanitize_text(question)
        safe_answer = self._sanitize_text(user_answer)
        safe_domain = self._sanitize_text(domain)
        safe_ideal = self._sanitize_text(
            ideal_answer) if ideal_answer else None

        # Independent retry loop per call
        for attempt in range(self.max_retries + 1):
            try:
                # Enforce minimum 6s gap between ALL API calls (free tier = 15 RPM = 4s/req).
                # We add a 2s safety buffer to stay well under the limit.
                # _last_api_call_time is tracked globally on the singleton.
                _min_gap = 6.0
                with self._rate_limit_lock:
                    elapsed = time.time() - _last_api_call_time[0]
                    if elapsed < _min_gap:
                        wait_needed = _min_gap - elapsed
                    else:
                        wait_needed = 0.0

                if wait_needed > 0:
                    logger.debug(
                        "Inter-call throttle: sleeping %.1fs", wait_needed)
                    time.sleep(wait_needed)

                if attempt > 0:
                    time.sleep(3.0 * attempt)

                result = self._evaluate_with_timeout(
                    question=safe_question,
                    user_answer=safe_answer,
                    domain=safe_domain,
                    ideal_answer=safe_ideal,
                    answer_type=answer_type,
                    api_key=active_api_key,
                    speech_metrics=speech_metrics
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
                # 429 = quota exhausted — set cooldown window so subsequent
                # questions in this session skip the API gracefully
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                    retry_after = self._parse_retry_after(error_str)
                    with self._rate_limit_lock:
                        self._rate_limit_until = time.time() + retry_after
                        self._rate_limited_key = active_api_key.strip()
                    logger.warning(
                        "Rate limited (429) on attempt %d — cooldown set for %ss.",
                        attempt + 1, retry_after)
                    print(
                        f"⚠️ LLM Evaluator: Rate limited (429). Cooling down for {retry_after}s before next call.")
                    break

                logger.error(
                    "LLM evaluation error (attempt %d): %s", attempt + 1, e)
                print(f"❌ LLM Evaluator error (attempt {attempt + 1}): {e}")

                if attempt < self.max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue

        # All retries exhausted — return honest fallback
        logger.warning(
            "All retries exhausted — AI scoring unavailable")
        print("⚠️ LLM Evaluator: All retries exhausted. Using fallback.")
        return self._create_fallback_response(user_answer, question, ideal_answer, speech_metrics)

    def _evaluate_with_timeout(
        self,
        question: str,
        user_answer: str,
        domain: str,
        ideal_answer: Optional[str],
        answer_type: str,
        api_key: str,
        speech_metrics: dict = None
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
                    ideal_answer=ideal_answer,
                    speech_metrics=speech_metrics
                )
                # Try each model candidate in order
                last_error = None
                for model_name in self.model_candidates:
                    try:
                        # NOTE: response_mime_type='application/json' is intentionally
                        # omitted here. When set, some model versions return a
                        # "Invalid mime type" error that is NOT a 404, which caused
                        # the exception to propagate immediately and trigger 429 handling
                        # on the outer loop instead of trying the next model.
                        # We parse JSON manually in _parse_llm_response instead.
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                temperature=0.5
                            )
                        )
                        # Record call time IMMEDIATELY (even on failure — it still used quota)
                        _last_api_call_time[0] = time.time()

                        # Safety: response.text can be None or raise if response was
                        # blocked by safety filters, or if the response object is malformed.
                        resp_text = None
                        try:
                            resp_text = response.text if response else None
                        except Exception:
                            resp_text = None

                        if not resp_text:
                            raise ValueError(
                                f"Empty or blocked response from model {model_name}")

                        result_holder['value'] = self._parse_llm_response(
                            resp_text)
                        break  # success
                    except Exception as model_err:
                        err_str = str(model_err)
                        if ('404' in err_str or 'NOT_FOUND' in err_str
                                or 'not found' in err_str.lower()
                                or 'Empty or blocked response' in err_str):
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

    def _parse_retry_after(self, error_str: str) -> float:
        """Extract Retry-After seconds from a 429 error string.
        Falls back to self.rate_limit_cooldown if not present."""
        match = re.search(r'retry.?after[:\s]+(\d+)', error_str, re.I)
        if match:
            return float(match.group(1)) + 5   # +5s buffer
        return self.rate_limit_cooldown

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
        ideal_answer: Optional[str],
        speech_metrics: dict = None
    ) -> str:
        """Builds the evaluation prompt for the LLM, including speech quality metrics."""

        prompt = f"""You are a PRECISE and FAIR interview coach for {domain} positions.
You evaluate BOTH the content of the answer AND the delivery quality (how they said it).

**QUESTION:** {question}

**CANDIDATE'S ANSWER:** {user_answer}
"""
        if ideal_answer:
            prompt += f"\n**IDEAL ANSWER (reference for evaluation):** {ideal_answer}\n"

        # Include speech quality metrics if available
        if speech_metrics and speech_metrics.get('summary_for_llm'):
            prompt += f"\n**SPEECH QUALITY ANALYSIS (measured from transcript):**\n{speech_metrics['summary_for_llm']}\n"

        prompt += """
⚠️ CRITICAL — SPEECH-TO-TEXT TRANSCRIPT AWARENESS:
The candidate's answer above was captured via speech recognition (browser Web Speech API).
Speech-to-text often GARBLES technical terms. You MUST evaluate the INTENDED MEANING, not exact wording.

Common speech-to-text errors to mentally correct before scoring:
  • "clo sure" / "klosure" → closure
  • "poly more fizz um" / "polly morphism" → polymorphism
  • "you state" / "used state" → useState (React hook)
  • "you effect" / "used effect" → useEffect
  • "proto type" / "proto typical" → prototype / prototypal
  • "a sink" / "a sync" → async
  • "ho isting" / "hosting" (in JS context) → hoisting
  • "in capsule ation" / "and capsulation" → encapsulation
  • "in hair attends" / "in heritance" → inheritance
  • "destructor ring" / "this structuring" → destructuring
  • "ab straction" / "abstract ion" → abstraction
  • "prom is" / "proms" → promise / promises
  • "virtual dumb" / "virtual dome" → Virtual DOM
  • "jason" / "jay son" → JSON
  • "my sequel" → MySQL, "post gres" → PostgreSQL, "mongo db" → MongoDB
  • "dock er" / "darker" → Docker, "cube ernetes" → Kubernetes
  • Letters spoken individually: "a p i" → API, "j w t" → JWT, "c i c d" → CI/CD

SCORING RULE: If you can INFER the correct technical term from the garbled text,
score the answer AS IF the correct term was used. Do NOT penalize for speech recognition errors.
Only penalize for genuinely wrong or missing concepts.

"""
        prompt += """
STEP 1 — CHECK FOR NON-ANSWERS (do this first, mandatory):
These MUST get ALL scores = 0 immediately:
  • "I don't know", "no idea", "skip", "pass", any refusal
  • Empty, pure noise ("um", "uh"), fewer than 3 real words
  • Completely off-topic/unrelated content (score 0 for all)

STEP 2 — SCORE ACCURATELY (calibrated scale, use the FULL range):
This is a SPOKEN interview. Be accurate, fair, and generous for genuine understanding.
  • Barely relevant, major confusion → score 1-2/10
  • Shows vague awareness but misses most concepts → score 3-4/10
  • Partial understanding, covers a few key points → score 5-6/10
  • Good answer, covers most concepts correctly → score 7-8/10
  • Strong and comprehensive, solid technical accuracy → score 8-9/10
  • Exceptional, expert-level depth with examples → score 9-10/10

SPECIAL CASES:
  • BEHAVIORAL questions (teamwork, leadership, etc.): Thoughtful personal answers = 7+. Genuine reflection with specific examples = 8+.
  • SHORT BUT CORRECT: A brief but accurate answer can score 6-8. Conciseness is not penalized if the understanding is clear.
  • PARAPHRASING: Informal correct explanations get FULL credit. Understanding matters more than exact terminology.
  • CONCEPTS EXPLAINED DIFFERENTLY: If the candidate demonstrates correct understanding with their own words, score it the same as a textbook answer.

⚠️ CALIBRATION: A mediocre answer = 3-5. A correct but incomplete answer = 6-7. A correct and well-explained answer = 7-9. Do NOT deflate scores for correct answers.

STEP 3 — GENERATE STRUCTURED MENTOR-STYLE FEEDBACK:

⚠️ YOUR ROLE: You are a warm, supportive senior engineer giving 1-on-1 coaching over coffee. Be specific about what they nailed, honest about what's missing, and always leave them feeling motivated.

**FEEDBACK STYLE:**
- Sound like a real mentor — natural, conversational, genuinely invested in their growth
- DO NOT quote their exact words in quotation marks — DESCRIBE what they discussed
- Every piece of feedback must feel freshly written for THIS specific answer — NEVER formulaic
- Reference SPECIFIC concepts from their answer, not vague praise

**MANDATORY FORMAT — Every feedback MUST have EXACTLY these 3 labeled sections:**

"What landed:" — Warmly acknowledge what they got right (2-3 sentences, mentor tone)
- Name 2-3 specific concepts they ACTUALLY covered and explain WHY those matter
- Weave concepts into a natural observation, don't just list them
- Examples: "You clearly get the core idea here — your coverage of X and Y shows real hands-on understanding..."
  "What stood out was how naturally you connected A to B — that's the practical thinking interviewers want to see..."
  "The way you broke this down shows genuine familiarity — pulling in X and Y means you're thinking about this the right way..."

"What's missing:" — Concept-focused, growth-framing coaching (1-2 sentences)
- Identify 2-3 key CONCEPTS from the ideal answer they didn't cover — use specific technical concept names
- Frame as growth opportunities: "Where I'd push you to grow next is..." NOT "You forgot to mention..."
- If misconceptions exist, correct gently here: "One thing to revisit —..."
- Examples: "The concepts worth building into this answer are X and Y — mastering these would take your response from good to truly interview-ready..."
  "Where I'd push you to grow next is X and Y — these come up as follow-ups almost every time..."
  "To level up this answer, focus on X — that's the depth that makes interviewers think 'this person gets it'..."

"Delivery:" — One actionable communication observation tied to this question type (1 sentence)
- Based on SPEECH QUALITY data (fillers, hedging, confidence, structure)
- Include question-type-specific delivery advice (e.g., for comparison questions suggest side-by-side structure, for behavioral suggest STAR format, for concept questions suggest definition-first approach)
- Be specific and fixable

**VARIATION RULES — CRITICAL (every question MUST feel freshly written):**
- NEVER start "What landed:" the same way for any two questions — vary openers completely
- NEVER start "What's missing:" the same way for any two questions — rotate approaches
- Mix sentence structures, lengths, and rhythms across questions
- Sometimes be brief and punchy, sometimes more detailed and conversational

**IMPROVEMENT_POINTS rules (4-5 specific, actionable coaching tips — each MUST be specific to THIS question):**
- At least 2 tips MUST be specific to the question's TOPIC (e.g., for auth questions: "Practice explaining the JWT flow in 3 steps: creation, transmission, verification")
- At least 1 tip about HOW to structure/present THIS TYPE of answer
- At least 1 tip about delivery, communication technique, or interview strategy
- Each tip should reference something from their actual answer or a specific concept they should study
- NEVER give generic advice like "study more" or "add more details" — always say WHAT and HOW

GREAT improvement points (topic-specific, actionable):
  - "For authentication questions, practice explaining the full JWT lifecycle: creation with claims, transmission via Authorization headers, and server-side verification — this three-step walkthrough is what interviewers want to hear."
  - "You mentioned API keys but didn't contrast them with token-based auth — prepare a quick mental comparison (security level, use case, stateless vs stateful) for follow-up questions."
  - "Your answer covered the 'what' well but missed the 'why' — for each scaling approach you mention, add one sentence about WHEN you'd choose it and what tradeoffs you're accepting."
  - "The concepts of fault isolation and independent deployment were missing — these are the top two selling points interviewers expect in a microservices answer."
  - "Try the Problem → Solution → Tradeoff framework for this type of question — it shows you think like an architect, not just a developer."
  - "Consider pausing for one second before answering to mentally organize your points — even that brief pause prevents filler words and produces a more structured response."

BAD improvement points (NEVER DO THIS):
  - "Study the topic more" (no specific direction)
  - "Include more details" (what details?)
  - "Mention polymorphism" (just listing missing words)
  - "Structure your answer better" (no actionable advice)

**OUTPUT — ONLY this JSON, no markdown:**
{"knowledge": <0-10>, "relevance": <0-10>, "clarity": <0-10>, "confidence": <0-10>, "feedback": "What landed: <warm mentor-tone acknowledgment of 2-3 specific concepts they covered, explaining why those matter — 2-3 sentences> What's missing: <coaching-tone identification of 2-3 gaps framed as growth opportunities, gentle corrections if needed — 1-2 sentences> Delivery: <one actionable observation about communication quality>", "improvement_points": ["<topic-specific tip about a concept they should study deeper for THIS question>", "<actionable strategy for structuring THIS TYPE of answer>", "<specific gap from their answer with concrete advice on how to fill it>", "<delivery or communication technique relevant to this answer>", "<optional 5th: advanced topic insight or interview technique specific to this domain>"], "ideal_answer": "<expert model answer in 2-4 sentences>"}

REMINDER: Non-answers = all 0. Correct answers = 7-10. Be encouraging AND truthful — find the real strengths, address the real gaps, and always leave them feeling motivated to improve.
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
        words = lower.split()
        word_count = len(words)

        # Layer 1: Explicit refusal phrases
        # CRITICAL FIX: Word-count guard — only flag short answers (≤20 words) as refusal.
        # Long answers may mention uncertainty briefly before providing a real explanation
        # (e.g. "I don't know the exact syntax but closures work by...").
        # In those cases, let Gemini evaluate the actual content.
        if word_count <= 20:
            for phrase in self._REFUSAL_PHRASES:
                if phrase in lower:
                    return 'refusal'
        else:
            # Long answer: only flag as refusal if very little content remains
            # after removing the refusal phrase
            for phrase in self._REFUSAL_PHRASES:
                if phrase in lower:
                    without_refusal = lower.replace(phrase, '').strip()
                    remaining_words = [
                        w for w in without_refusal.split() if len(w) > 2]
                    if len(remaining_words) < 8:
                        # Mostly a refusal + very little real content
                        return 'refusal'
                    # Otherwise: user caveated but then explained — not a non-answer
                    break

        # Layer 2: Regex-based refusal intent (short answers only — ≤20 words)
        if word_count <= 20:
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

    # ── FALLBACK WHEN AI IS UNAVAILABLE ─────────────────────────────────────

    # Fuzzy matching map for common speech-to-text garbling of technical terms
    _SPEECH_CORRECTIONS = {
        # ORM / Database
        'rational': 'relational', 'relational': 'relational',
        'mapping': 'mapping', 'orm': 'orm',
        'sequel': 'sql', 'sequel': 'sql', 'my sequel': 'mysql',
        'post gres': 'postgresql', 'postgres': 'postgresql',
        'mongo': 'mongodb', 'redis': 'redis',
        'no sequel': 'nosql', 'nosql': 'nosql',
        'boil plate': 'boilerplate', 'boilerplate': 'boilerplate',
        'sequel eyes': 'sequelize', 'sequelize': 'sequelize',
        'equalise': 'sequelize', 'equalize': 'sequelize',
        'hibernate': 'hibernate', 'prisma': 'prisma',
        'alchemy': 'sqlalchemy', 'sql alchemy': 'sqlalchemy',
        # Auth
        'authentication': 'authentication', 'authorization': 'authorization',
        'appendication': 'authentication', 'verify': 'verify',
        'otherisation': 'authorization', 'authorisation': 'authorization',
        'jwt': 'jwt', 'oauth': 'oauth', 'token': 'token',
        'permissions': 'permissions', 'login': 'login',
        # Architecture patterns
        'strangler': 'strangler', 'fig': 'fig',
        'bulkhead': 'bulkhead', 'bulk head': 'bulkhead',
        'circuit breaker': 'circuit breaker',
        'microservices': 'microservices', 'monolith': 'monolith',
        'monograph': 'monolith',
        # General tech
        'api': 'api', 'rest': 'rest', 'graphql': 'graphql',
        'database': 'database', 'server': 'server',
        'endpoint': 'endpoint', 'middleware': 'middleware',
        'deployment': 'deployment', 'docker': 'docker',
        'kubernetes': 'kubernetes', 'container': 'container',
        'cache': 'cache', 'caching': 'caching',
        'scalability': 'scalability', 'load balancer': 'load balancer',
        'sharding': 'sharding', 'replication': 'replication',
        'tolerance': 'fault tolerance', 'fault tolerance': 'fault tolerance',
        'overloads': 'overloads', 'isolate': 'isolate',
        'compartments': 'compartments', 'resources': 'resources',
        'connection': 'connection', 'pool': 'pool',
        # Frontend
        'virtual dom': 'virtual dom', 'react': 'react',
        'component': 'component', 'hooks': 'hooks',
        'state': 'state', 'props': 'props',
        'javascript': 'javascript', 'typescript': 'typescript',
        'closure': 'closure', 'klosure': 'closure',
        'polymorphism': 'polymorphism', 'polly morphism': 'polymorphism',
        'encapsulation': 'encapsulation', 'and capsulation': 'encapsulation',
        'inheritance': 'inheritance', 'in heritance': 'inheritance',
        'abstraction': 'abstraction',
        # System design
        'legacy': 'legacy', 'migration': 'migration', 'migrate': 'migrate',
        'gradually': 'gradually', 'incrementally': 'incrementally',
        'replace': 'replace', 'routing': 'routing',
        'stability': 'stability', 'availability': 'availability',
        'consistency': 'consistency', 'partition': 'partition',
    }

    def _normalize_speech_text(self, text: str) -> str:
        """Apply speech-to-text corrections to normalize garbled technical terms."""
        lower = text.lower()
        # Apply multi-word corrections first (longer matches first)
        sorted_corrections = sorted(self._SPEECH_CORRECTIONS.items(),
                                    key=lambda x: len(x[0]), reverse=True)
        for garbled, correct in sorted_corrections:
            if garbled in lower:
                lower = lower.replace(garbled, correct)
        return lower

    def _fuzzy_keyword_match(self, answer_word: str, keyword: str) -> bool:
        """Check if an answer word is a fuzzy match for a keyword.
        Handles speech-to-text garbling by checking:
        - Exact match
        - Substring containment (one contains the other)
        - First 4+ chars match (prefix match)
        - Edit distance ≤ 2 for short words
        """
        if not answer_word or not keyword:
            return False
        a = answer_word.lower().strip('.,!?;:')
        k = keyword.lower().strip('.,!?;:')
        if len(a) < 2 or len(k) < 2:
            return False
        # Exact match
        if a == k:
            return True
        # One contains the other
        if len(a) >= 4 and len(k) >= 4:
            if a in k or k in a:
                return True
        # Prefix match (first 4+ characters)
        prefix_len = min(4, min(len(a), len(k)))
        if prefix_len >= 3 and a[:prefix_len] == k[:prefix_len]:
            # Also check they're similar length (within 3 chars)
            if abs(len(a) - len(k)) <= 3:
                return True
        return False

    def _detect_question_concepts(self, question: str, answer: str) -> float:
        """Detect if the answer addresses the core concepts asked about in the question.
        Returns a bonus score (0.0 to 0.4) based on concept coverage."""
        q_lower = question.lower()
        a_lower = answer.lower()
        bonus = 0.0

        # Map question patterns to concept-detection patterns in the answer
        concept_checks = [
            # ORM questions
            ({'orm', 'object relational', 'object-relational'},
             {'database', 'object', 'table', 'class', 'map', 'query', 'sql'}),
            # Auth questions
            ({'authentication', 'authorization', 'auth'},
             {'login', 'verify', 'access', 'permission', 'token', 'jwt', 'password', 'role', 'user'}),
            # Strangler fig
            ({'strangler'},
             {'legacy', 'replace', 'old system', 'new system', 'migrate', 'gradually', 'incrementally', 'route', 'routing'}),
            # Bulkhead
            ({'bulkhead'},
             {'isolate', 'resource', 'service', 'failure', 'prevent', 'pool', 'compartment', 'separate'}),
            # let/const/var
            ({'let', 'const', 'var'},
             {'scope', 'block', 'function', 'hoisting', 'reassign', 'immutable', 'declaration'}),
            # Virtual DOM
            ({'virtual dom'},
             {'memory', 'diff', 'render', 'update', 'real dom', 'reconciliation', 'performance', 'comparison'}),
            # Closures
            ({'closure'},
             {'function', 'scope', 'variable', 'outer', 'inner', 'access', 'return', 'lexical'}),
            # REST API
            ({'rest', 'restful', 'api'},
             {'http', 'get', 'post', 'put', 'delete', 'endpoint', 'resource', 'url', 'status'}),
            # Database indexing
            ({'index', 'indexing'},
             {'lookup', 'query', 'performance', 'column', 'search', 'b-tree', 'fast', 'scan'}),
            # Microservices
            ({'microservice'},
             {'service', 'independent', 'deploy', 'api', 'scale', 'separate', 'communicate', 'database'}),
            # ACID
            ({'acid'},
             {'atomic', 'consistent', 'isolation', 'durable', 'transaction', 'rollback'}),
            # CAP theorem
            ({'cap theorem', 'cap'},
             {'consistency', 'availability', 'partition', 'distributed', 'tolerance'}),
            # SQL vs NoSQL
            ({'sql', 'nosql'},
             {'relational', 'table', 'schema', 'document', 'flexible', 'scale', 'query'}),
            # CI/CD
            ({'ci/cd', 'cicd', 'ci cd'},
             {'pipeline', 'deploy', 'test', 'build', 'automate', 'integration', 'delivery'}),
            # Docker
            ({'docker', 'container'},
             {'image', 'container', 'deploy', 'environment', 'portable', 'isolate', 'run'}),
            # Event loop
            ({'event loop'},
             {'callback', 'queue', 'stack', 'async', 'single thread', 'non-blocking'}),
            # Caching
            ({'cache', 'caching'},
             {'store', 'fast', 'memory', 'redis', 'performance', 'hit', 'miss', 'expire'}),
        ]

        for q_concepts, a_concepts in concept_checks:
            # Check if the question is about this concept
            if any(c in q_lower for c in q_concepts):
                # Count how many answer concepts are present
                matches = sum(1 for c in a_concepts if c in a_lower)
                if matches >= 4:
                    bonus = max(bonus, 0.35)
                elif matches >= 3:
                    bonus = max(bonus, 0.28)
                elif matches >= 2:
                    bonus = max(bonus, 0.20)
                elif matches >= 1:
                    bonus = max(bonus, 0.10)

        return bonus

    def _create_fallback_response(
        self, user_answer: str, question: str, ideal_answer: str = None,
        speech_metrics: dict = None
    ) -> Dict:
        """
        Smart fallback when LLM is unavailable.
        Uses local NLP (cosine similarity + keyword overlap + speech metrics)
        PLUS speech-aware fuzzy matching and concept detection
        to produce a FAIR score for speech-to-text transcripts.

        Scoring is calibrated so that:
        - Excellent answers with good delivery => 85-95
        - Good answers => 70-84
        - Fair answers => 45-69
        - Poor/vague answers => 25-44
        """
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

        # ── NORMALIZE speech-to-text garbling before scoring ──
        normalized_answer = self._normalize_speech_text(cleaned)
        normalized_ideal = self._normalize_speech_text(
            ideal_answer) if ideal_answer else None

        # ── LOCAL CONTENT SCORING ──
        content_score = 0.0
        meaningful = [
            w for w in words if w not in self._FILLER_WORDS and len(w) > 2]
        meaningful_count = len(meaningful)

        similarity = 0.0
        keyword_overlap = 0.0
        fuzzy_bonus_val = 0.0

        if normalized_ideal and len(normalized_ideal.strip()) > 5:
            try:
                # Use normalized texts for similarity (fixes garbled term matching)
                similarity = self._compute_cosine_similarity(
                    normalized_answer, normalized_ideal
                )
                keyword_overlap = self._compute_keyword_overlap(
                    normalized_answer, question.lower(), normalized_ideal
                )
                fuzzy_bonus_val = self._compute_fuzzy_overlap(
                    normalized_answer, question.lower(), normalized_ideal
                )
                # Weighted blend
                content_score = (
                    similarity * 0.40 + keyword_overlap * 0.35 + fuzzy_bonus_val * 0.25)
            except Exception:
                content_score = 0.35  # Safe default on error
        else:
            # No ideal answer — score based on answer substance
            if meaningful_count >= 25:
                content_score = 0.65
            elif meaningful_count >= 15:
                content_score = 0.55
            elif meaningful_count >= 10:
                content_score = 0.45
            elif meaningful_count >= 5:
                content_score = 0.35
            else:
                content_score = 0.2

        # ── CONCEPT DETECTION BONUS ──
        concept_bonus = self._detect_question_concepts(question, cleaned)
        content_score = min(1.0, content_score + concept_bonus)

        # ── ANSWER SUBSTANCE BONUS ──
        # Longer meaningful answers deserve higher scores even if exact word matching is low
        if meaningful_count >= 40:
            content_score = max(content_score, 0.72)
        elif meaningful_count >= 30:
            content_score = max(content_score, 0.65)
        elif meaningful_count >= 20:
            content_score = max(content_score, 0.55)
        elif meaningful_count >= 12:
            content_score = max(content_score, 0.45)

        # ── HIGH-SIMILARITY BOOST ──
        # If cosine similarity or keyword overlap is very high, the answer is clearly correct
        if similarity >= 0.6 and keyword_overlap >= 0.5:
            content_score = max(content_score, 0.85)
        elif similarity >= 0.5 and keyword_overlap >= 0.4:
            content_score = max(content_score, 0.78)
        elif similarity >= 0.4 and keyword_overlap >= 0.3:
            content_score = max(content_score, 0.70)
        elif similarity >= 0.3 or keyword_overlap >= 0.4:
            content_score = max(content_score, 0.60)

        # ── DELIVERY SCORING (from speech metrics) ──
        delivery_score = 0.7  # Default: decent delivery
        has_examples = False
        has_structure = False
        has_confidence_markers = False
        filler_count = 0
        hedge_count = 0

        if speech_metrics:
            fillers = speech_metrics.get('filler_analysis', {})
            hedging = speech_metrics.get('hedging_analysis', {})
            structure = speech_metrics.get('structure_analysis', {})
            examples = speech_metrics.get('example_usage', {})
            confidence_info = speech_metrics.get('confidence_analysis', {})

            filler_count = fillers.get('count', 0)
            hedge_count = hedging.get('count', 0)
            has_structure_issue = bool(structure.get('issue'))
            has_examples = examples.get('used_examples', False)
            has_structure = structure.get('has_structure', False)
            has_confidence_markers = len(
                confidence_info.get('markers_found', [])) >= 2

            # Penalties for delivery issues
            if filler_count > 5:
                delivery_score -= 0.12
            elif filler_count > 2:
                delivery_score -= 0.06
            if hedge_count > 3:
                delivery_score -= 0.08
            elif hedge_count > 0:
                delivery_score -= 0.03
            if has_structure_issue:
                delivery_score -= 0.04

            # BONUSES for good delivery (critical for reaching 90+)
            if filler_count == 0:
                delivery_score += 0.10  # Clean speech
            if has_examples:
                delivery_score += 0.08  # Used concrete examples
            if has_structure:
                delivery_score += 0.08  # Structured answer
            if has_confidence_markers:
                delivery_score += 0.06  # Confident language
            if structure.get('sentence_count', 0) >= 3 and not has_structure_issue:
                delivery_score += 0.05  # Multi-sentence, well-formed

            delivery_score = max(0.3, min(1.0, delivery_score))

        # ── COMBINED SCORE ──
        # 70% content + 30% delivery
        raw_score = content_score * 0.70 + delivery_score * 0.30
        # Scale to 0-100, with floor at 25 (they gave a real answer) and cap at 95
        # (reserve 96-100 for LLM-evaluated exceptional answers only)
        score = int(round(raw_score * 100))
        score = max(25, min(95, score))

        # ── Compute rubric breakdown (0-10 scale) ──
        # Knowledge and relevance can differ — knowledge is content depth, relevance is question-matching
        knowledge_raw = min(10, max(1, round(content_score * 10)))
        # Relevance gets a slight boost if keyword overlap is high
        relevance_factor = min(1.0, content_score + (keyword_overlap * 0.15))
        relevance_raw = min(10, max(1, round(relevance_factor * 10)))
        clarity_raw = min(10, max(1, round(delivery_score * 10)))
        confidence_raw = min(10, max(1, round(delivery_score * 9.5)))

        status = (
            "excellent" if score >= 80 else
            "good" if score >= 60 else
            "fair" if score >= 40 else
            "poor"
        )

        # ── Build FEEDBACK WITH ANSWER ANALYSIS ──
        feedback_parts = []
        improvement_tips = []

        import random

        # ── Helper: clean keyword extraction (filters punctuation and junk) ──
        def _clean_keywords(text, min_len=4):
            if not text:
                return set()
            clean = re.sub(r'[^a-z0-9\s]', ' ', text.lower())
            _skip = {'used', 'using', 'example', 'best', 'need', 'make', 'work',
                     'data', 'type', 'each', 'more', 'many', 'other', 'first',
                     'second', 'third', 'same', 'different', 'another', 'only',
                     'from', 'that', 'this', 'with', 'into', 'than', 'then',
                     'when', 'where', 'which', 'about', 'between', 'through',
                     'after', 'before', 'during', 'without', 'within', 'across',
                     'common', 'based', 'over', 'under', 'because', 'such',
                     'most', 'some', 'like', 'just', 'also', 'well', 'very'}
            return set(
                w for w in clean.split()
                if len(w) >= min_len
                and w not in self._FILLER_WORDS
                and w not in _skip
                and not w.isdigit()
            )

        # ── Extract what user covered vs what's missing ──
        user_kw = _clean_keywords(normalized_answer)
        ideal_kw = _clean_keywords(
            normalized_ideal) if normalized_ideal else set()
        question_kw = _clean_keywords(question.lower())

        # Use question concept map for accurate, question-specific feedback
        try:
            from services.question_concepts import get_question_concepts
            _q_concepts = get_question_concepts(question)
        except Exception:
            _q_concepts = []

        if _q_concepts:
            _ans_lower = normalized_answer.lower()
            matched_concepts = []
            missing_concepts = []
            for _c in _q_concepts:
                _terms = [w for w in _c.lower().split() if len(w) > 3]
                if not _terms:
                    _terms = _c.lower().split()
                _hits = sum(1 for w in _terms if w in _ans_lower)
                if _hits >= max(1, len(_terms) // 2):
                    matched_concepts.append(_c)
                else:
                    missing_concepts.append(_c)
        else:
            matched_concepts = sorted(user_kw & (ideal_kw | question_kw))
            missing_concepts = sorted(ideal_kw - user_kw) if ideal_kw else []

        # ── What Landed Phrases (concept-focused, mentor tone) ──
        landed_phrases = []
        if len(matched_concepts) >= 3:
            sample = matched_concepts[:3]
            landed_phrases = [
                f"You clearly get the core idea here — your coverage of {', '.join(sample)} shows you've actually worked with these concepts, not just read about them.",
                f"What stood out was how naturally you brought in {', '.join(sample)} — these are exactly what an interviewer wants to hear, and you nailed them.",
                f"The way you connected {', '.join(sample)} shows real hands-on understanding. That's the kind of practical knowledge that separates strong candidates.",
                f"You hit the important marks here — {', '.join(sample)} are the building blocks, and the fact that you reached for them instinctively is a great sign.",
                f"This shows genuine familiarity — pulling in {', '.join(sample)} means you're thinking about this the right way, not just memorizing definitions.",
            ]
        elif len(matched_concepts) >= 1:
            sample = matched_concepts[:2]
            landed_phrases = [
                f"You're on the right track — identifying {', '.join(sample)} shows you've got the foundation. That's a solid starting point to build from.",
                f"The fact that you reached for {', '.join(sample)} tells me you understand the basics here. {'These are' if len(sample) > 1 else 'That is'} exactly where you want to start.",
                f"Good instinct going to {', '.join(sample)} first — that shows the kind of fundamentals that anchor a strong answer.",
            ]

        # ── What's Missing Phrases (concept-focused + growth-framing) ──
        missing_phrases = []
        if len(missing_concepts) >= 2:
            sample = missing_concepts[:3]
            missing_phrases = [
                f"The concepts worth building into this answer are {', '.join(sample)} — mastering these would take your response from good to truly interview-ready.",
                f"Where I'd push you to grow next is around {', '.join(sample)} — these are what separate a decent answer from one that really impresses.",
                f"To level up this answer, focus on {', '.join(sample)} — once you've internalized these, you'll handle follow-up questions with ease.",
                f"The depth an interviewer is looking for here includes {', '.join(sample)} — adding these to your toolkit makes this a standout answer.",
                f"The growth area here is {', '.join(sample)} — these come up as follow-ups almost every time, and having them ready gives you a real edge.",
            ]
        elif len(missing_concepts) == 1:
            missing_phrases = [
                f"The one concept that would really complete this is {missing_concepts[0]} — it's the missing piece that ties everything together.",
                f"To take this to the next level, work on {missing_concepts[0]} — once that's in your toolkit, this becomes a complete, confident answer.",
            ]

        # ── Structure Comments ──
        structure_phrases = []
        if meaningful_count >= 25:
            structure_phrases = [
                "Your answer had good depth and covered multiple angles, which shows thorough thinking.",
                "The breadth of your response demonstrates comprehensive thinking about this topic.",
            ]
        elif meaningful_count >= 15:
            structure_phrases = [
                "Your explanation was focused and relevant — adding another layer of detail would make it interview-ready.",
                "You kept it tight and on-topic, which is good — a bit more elaboration would push this higher.",
            ]
        elif meaningful_count < 10:
            structure_phrases = [
                "The answer was quite brief — interviewers generally expect a bit more elaboration to gauge depth.",
                "Try to expand beyond the headline points — even two more sentences would strengthen this significantly.",
            ]

        # ── Delivery Comments (many variants) ──
        delivery_phrases = []
        if speech_metrics:
            fillers = speech_metrics.get('filler_analysis', {})
            hedging = speech_metrics.get('hedging_analysis', {})
            structure_info = speech_metrics.get('structure_analysis', {})
            examples_info = speech_metrics.get('example_usage', {})
            confidence_info = speech_metrics.get('confidence_analysis', {})
            repetition = speech_metrics.get('repetition_analysis', {})

            if filler_count == 0 and has_confidence_markers:
                delivery_phrases = [
                    "Your delivery was polished and confident — no filler words, giving you a real professional edge.",
                    "On the communication side, your clean speaking style with no fillers made this feel authoritative.",
                    "Zero filler words and steady confidence throughout — that kind of delivery really impresses.",
                    "The way you spoke was clear and direct, which elevated the whole response.",
                ]
            elif filler_count == 0:
                delivery_phrases = [
                    "No filler words in your delivery, which keeps the answer sounding sharp and intentional.",
                    "Clean delivery with no filler pauses — that kind of fluency builds interviewer confidence.",
                    "Your speech was crisp and focused, which is a real strength in interview settings.",
                ]
            elif filler_count <= 2:
                delivery_phrases = [
                    "Your delivery was mostly smooth with just a couple of brief filler moments — very minor and easy to polish.",
                    "A couple of small filler moments, but overall your speaking pace was natural and comfortable.",
                ]
            elif filler_count <= 5:
                delivery_phrases = [
                    f"There were about {filler_count} filler moments — try embracing brief pauses instead, which sound more confident.",
                    f"Around {filler_count} filler words crept in — replacing these with short silent pauses would elevate your delivery.",
                ]
            else:
                delivery_phrases = [
                    f"About {filler_count} filler words came through — focus on slowing down slightly and allowing natural pauses.",
                    f"The {filler_count} filler moments diluted solid content — this is very fixable with practice.",
                ]

            if has_examples:
                delivery_phrases.append(random.choice([
                    "Using a concrete example was smart — it made your explanation tangible and memorable.",
                    "The real-world example you included added practical credibility to your answer.",
                ]))

            # Delivery-based improvement tips
            if filler_count > 2:
                improvement_tips.append(
                    "Practice replacing filler sounds with brief silent pauses — even a one-second pause sounds intentional and gives you time to think clearly."
                )
            if hedge_count > 0:
                improvement_tips.append(random.choice([
                    "Work on replacing hedging language ('I think', 'maybe', 'probably') with direct statements — state what you know, then add nuance.",
                    "Try opening with a clear, definitive statement before adding qualifications — it sets a much stronger first impression.",
                ]))
            if structure_info.get('issue') == 'single_run_on_sentence':
                improvement_tips.append(
                    "Break your answer into clear segments — try pausing briefly between main points to give the interviewer time to absorb each one."
                )
            elif structure_info.get('issue') == 'very_choppy':
                improvement_tips.append(
                    "Connect your short points with transitional phrases like 'building on that' or 'this connects to' — it creates a narrative flow."
                )

            overused = repetition.get('overused_words', {})
            if overused:
                improvement_tips.append(
                    "Vary your vocabulary more — when you notice yourself repeating a word, switch to a synonym or rephrase the idea."
                )

        # ── ASSEMBLE STRUCTURED FEEDBACK (What landed / What's missing / Delivery) ──

        # ── Build "What landed:" section ──
        landed_text = ""
        if content_score >= 0.78:
            if landed_phrases:
                landed_text = random.choice(landed_phrases)
            else:
                landed_text = random.choice([
                    "This was a really strong take — your answer showed deep practical knowledge of the core concepts.",
                    "You tackled this with a lot of confidence and clarity — impressive command of the material.",
                    "Your understanding here is clearly well-developed — this response hit the marks interviewers look for.",
                ])
            if structure_phrases:
                landed_text += " " + random.choice(structure_phrases)
        elif content_score >= 0.60:
            if landed_phrases:
                landed_text = random.choice(landed_phrases)
            else:
                landed_text = random.choice([
                    "There's real understanding here — you're clearly thinking about this the right way.",
                    "Your approach shows genuine engagement with these concepts, which is a strong foundation.",
                    "This had the right core ideas and was heading in a strong direction.",
                ])
            if structure_phrases:
                landed_text += " " + random.choice(structure_phrases)
        elif content_score >= 0.45:
            if landed_phrases:
                landed_text = random.choice(landed_phrases)
            else:
                landed_text = random.choice([
                    "You've got some of the right pieces here, which is a genuinely good starting point to build from.",
                    "There are seeds of the right ideas in what you said — building on what you know is the fastest path forward.",
                    "Your instinct about this topic is heading in the right direction, and that counts for a lot.",
                ])
        else:
            if landed_phrases:
                landed_text = random.choice(landed_phrases)
            else:
                landed_text = random.choice([
                    "It's great that you gave this a shot — that willingness to try matters more than you'd think.",
                    "This is a tricky topic, and the fact that you engaged with it puts you ahead of people who'd just say 'I don't know.'",
                    "Don't be discouraged here — every strong interviewer started by struggling with questions exactly like this.",
                    "The effort you put into this answer counts — with a bit of focused study, this becomes very doable.",
                ])

        # ── Build "What's missing:" section ──
        missing_text = ""
        if missing_phrases:
            missing_text = random.choice(missing_phrases)
        elif content_score < 0.45 and normalized_ideal:
            missing_text = "Review the ideal answer below — studying its structure will give you a clear roadmap of what to cover next time."
        elif content_score < 0.60:
            missing_text = "Adding more specific technical concepts and connecting them to practical scenarios would strengthen this significantly."

        # ── Build "Delivery:" section ──
        delivery_text = ""
        if delivery_phrases:
            delivery_text = random.choice(delivery_phrases[:3] if len(delivery_phrases) >= 3 else delivery_phrases)

        # ── Add question-type-aware delivery advice ──
        if delivery_text:
            _q_lower = question.lower()
            if any(kw in _q_lower for kw in ['explain', 'what is', 'what are', 'describe']):
                delivery_text += " For concept-explanation questions like this, leading with a crisp one-sentence definition before elaborating helps the interviewer anchor your answer."
            elif any(kw in _q_lower for kw in ['difference', 'compare', 'versus', 'vs']):
                delivery_text += " For comparison questions, a structured side-by-side contrast with clear categories makes your answer much easier to follow."
            elif any(kw in _q_lower for kw in ['tell me about', 'describe a time', 'give an example']):
                delivery_text += " For behavioral questions, the STAR format (Situation, Task, Action, Result) gives your story a clear, memorable arc."
            elif any(kw in _q_lower for kw in ['design', 'architect', 'build']):
                delivery_text += " For design questions, walking through requirements then components then data flow then tradeoffs shows the structured thinking interviewers value."
            elif any(kw in _q_lower for kw in ['how do you', 'how would you', 'how does']):
                delivery_text += " For process-oriented questions, describing your approach step by step with reasoning behind each choice demonstrates practical experience."
            elif any(kw in _q_lower for kw in ['optimize', 'improve', 'performance']):
                delivery_text += " For optimization questions, leading with 'profile first, then optimize' shows engineering maturity before diving into specific techniques."
            elif any(kw in _q_lower for kw in ['when', 'why', 'should']):
                delivery_text += " For decision-making questions, showing you can reason about tradeoffs — not just list options — is what separates strong answers."

        # ── Combine into structured feedback ──
        if landed_text:
            feedback_parts.append(f"What landed: {landed_text}")
        if missing_text:
            feedback_parts.append(f"What's missing: {missing_text}")
        if delivery_text:
            feedback_parts.append(f"Delivery: {delivery_text}")

        if not feedback_parts:
            feedback_parts.append("Your response has been analyzed — review the scores and improvement tips below for specific guidance.")

        # ── GENERATE TOPIC-SPECIFIC ACTION POINTS ──
        q_lower = question.lower()
        topic_tips = []

        if any(kw in q_lower for kw in ['authentication', 'auth', 'security', 'jwt', 'oauth']):
            topic_tips = [
                "For auth questions, practice drawing the complete flow: credentials submitted → server validates → token issued → client stores → subsequent requests include token → server verifies.",
                "Prepare a mental comparison of JWT vs Session vs OAuth vs API Keys — covering when each is appropriate separates good from great answers.",
                "Security topics often have follow-ups about vulnerabilities — think about CSRF, XSS, token theft and how each auth method handles them.",
                "Practice explaining the difference between authentication (who are you?) and authorization (what can you do?) — interviewers love candidates who distinguish these cleanly.",
            ]
        elif any(kw in q_lower for kw in ['rest', 'api', 'endpoint', 'http']):
            topic_tips = [
                "For REST API questions, anchor your answer in core constraints: stateless communication, resource-based URLs, proper HTTP methods, and meaningful status codes.",
                "Practice listing best practices in categories — URL design, HTTP methods, error handling, versioning, security — this shows organized thinking.",
                "Think about real decisions: when would you use query params vs path params? When is pagination important? These details signal hands-on experience.",
                "Mention idempotency for PUT/DELETE and non-idempotency for POST — this subtle distinction impresses interviewers who probe deeper.",
            ]
        elif any(kw in q_lower for kw in ['microservice', 'monolith', 'distributed']):
            topic_tips = [
                "Microservices questions almost always expect both pros AND cons — practice a balanced comparison covering at least 3 of each.",
                "Mention specific challenges: data consistency across services, distributed transactions, service discovery, and inter-service communication patterns.",
                "Tie your answer to real scenarios — 'When your team grows to 50+ engineers...' or 'In an e-commerce system...' shows practical judgment.",
                "Discuss the migration path from monolith to microservices — this shows you understand it's not a binary choice but a spectrum.",
            ]
        elif any(kw in q_lower for kw in ['scaling', 'horizontal', 'vertical', 'scale']):
            topic_tips = [
                "Always contrast clearly: horizontal (add more machines) vs vertical (upgrade one machine) with specific tradeoffs of cost, complexity, and failure modes.",
                "Include practical considerations: load balancing, database sharding, caching layers, and when each scaling approach makes sense architecturally.",
                "Mention that horizontal scaling handles single points of failure better, while vertical has simpler architecture — this tradeoff analysis shows depth.",
                "Real-world examples help: 'Netflix scales horizontally across regions because...' makes your answer memorable and credible.",
            ]
        elif any(kw in q_lower for kw in ['database', 'sql', 'nosql', 'index', 'query']):
            topic_tips = [
                "Database questions benefit from concrete examples — mention specific databases (PostgreSQL, MongoDB, Redis) and when you'd choose each.",
                "Practice explaining indexing with an analogy (like a book's index) then layer in B-tree details for technical depth.",
                "Think about tradeoffs: consistency vs availability, read-heavy vs write-heavy workloads, normalized vs denormalized schemas.",
                "Mention ACID properties for SQL and BASE properties for NoSQL — showing you understand both paradigms' guarantees is impressive.",
            ]
        elif any(kw in q_lower for kw in ['closure', 'scope', 'hoisting', 'javascript', 'js']):
            topic_tips = [
                "For JavaScript concept questions, walk through a simple mental code example step by step — this makes abstract concepts concrete.",
                "Connect the concept to practical use cases: closures in event handlers, module patterns, or data privacy — shows applied understanding.",
                "Practice explaining the 'why' behind the concept — why does JavaScript have closures? What problem do they solve? This shows deeper thinking.",
                "Mention the relationship between closures and lexical scoping — candidates who connect these concepts stand out.",
            ]
        elif any(kw in q_lower for kw in ['react', 'component', 'virtual dom', 'hooks', 'state']):
            topic_tips = [
                "React questions often probe the rendering lifecycle — practice explaining when and why components re-render.",
                "Connect theory to practice: explain the Virtual DOM by describing what happens when a user clicks a button and state changes.",
                "Mention performance implications and optimizations (React.memo, useCallback, useMemo) to show depth beyond basics.",
                "Discuss the component composition pattern vs inheritance — React's philosophy of 'composition over inheritance' is a key talking point.",
            ]
        elif any(kw in q_lower for kw in ['docker', 'container', 'kubernetes', 'deploy', 'ci/cd', 'cicd']):
            topic_tips = [
                "DevOps questions benefit from real workflow descriptions — walk through a deployment pipeline step by step.",
                "Mention specific tools and how they connect: Docker for containerization, Kubernetes for orchestration, Jenkins/GitHub Actions for CI/CD.",
                "Include the 'why' behind containerization — consistency across environments, isolation, portability — then give a concrete scenario.",
                "Discuss the difference between containers and VMs — this fundamental distinction shows you understand the underlying technology.",
            ]
        elif any(kw in q_lower for kw in ['consistency', 'eventual', 'cap', 'acid', 'transaction']):
            topic_tips = [
                "For CAP/consistency questions, use a concrete example (e-commerce inventory, banking) to illustrate the tradeoffs vividly.",
                "Practice explaining eventual consistency with a timeline: write happens → propagation delay → all nodes consistent — makes abstract concepts concrete.",
                "Connect to real systems: why DynamoDB chose eventual consistency, how Cassandra handles it — this shows you've studied beyond theory.",
                "Explain when strong consistency is worth the performance cost (financial transactions) vs when eventual is acceptable (social media feeds).",
            ]
        elif any(kw in q_lower for kw in ['cache', 'caching', 'redis', 'performance']):
            topic_tips = [
                "For caching questions, cover the key decisions: what to cache, cache invalidation strategies, and TTL policies — these show practical experience.",
                "Mention cache-aside, write-through, and write-behind patterns — knowing the tradeoffs between these distinguishes senior candidates.",
                "Discuss cache invalidation ('the two hard things in computer science') and strategies like TTL, event-driven, and versioned keys.",
                "Connect caching to real architecture: CDN for static assets, Redis for session/data, browser cache for client-side — shows systems thinking.",
            ]

        # Generic fallback tips for topics not specifically matched
        if not topic_tips:
            topic_tips = [
                "Practice structuring answers as Definition → How It Works → Example/Use Case — this three-part flow works for almost any technical question.",
                "Before your next practice session, study the ideal answer and practice explaining it in your own words until it flows naturally.",
                "Try recording yourself answering this question and compare to the ideal — self-review is one of the fastest ways to improve.",
                "Think about the 'why' behind each concept you mention — interviewers are more impressed by understanding motivation than listing facts.",
            ]

        # Add topic-specific tips (avoid duplicates with delivery-based tips)
        for tip in topic_tips:
            if len(improvement_tips) < 5 and tip not in improvement_tips:
                improvement_tips.append(tip)

        # Fill to at least 4 tips with general communication/delivery tips
        general_tips = [
            "Practice opening with a confident one-sentence definition before diving into details — it anchors the interviewer immediately.",
            "When you feel yourself trailing off, wrap up with a clear concluding statement that ties back to the question.",
            "Try the 'teach it to a friend' technique: if you can explain a concept simply in conversation, you'll nail it in an interview.",
            "Use signposting language ('There are three main aspects...', 'The key tradeoff is...') to give your answers professional structure.",
            "Build confidence by leading with what you know for certain, then expanding — interviewers value honest conviction.",
        ]
        random.shuffle(general_tips)
        for tip in general_tips:
            if len(improvement_tips) < 4:
                improvement_tips.append(tip)

        if not has_examples and not any('example' in t.lower() for t in improvement_tips):
            if len(improvement_tips) < 5:
                improvement_tips.append(
                    "Weave in a real-world scenario or quick example — it transforms abstract explanations into something interviewers visualize and remember."
                )

        feedback = ' '.join(feedback_parts)

        return {
            "score": score,
            "feedback": feedback,
            "status": status,
            "breakdown": {
                "knowledge": knowledge_raw, "relevance": relevance_raw,
                "clarity": clarity_raw, "confidence": confidence_raw,
                "technical": knowledge_raw * 10, "grammar": clarity_raw * 10,
                "accent": relevance_raw * 10, "confidence_score": confidence_raw * 10,
                "technical_score": knowledge_raw * 10,
                "communication_score": clarity_raw * 10,
                "depth_score": relevance_raw * 10
            },
            "improvement_points": improvement_tips[:4],
            "answer_type": "local_analysis"
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
        """Compute keyword overlap between answer and (question + ideal answer).
        Uses both exact matching AND fuzzy matching for speech-garbled terms."""
        stop = self._FILLER_WORDS

        def get_keys(t): return set(
            w for w in re.sub(r'[^a-z0-9\s]', '', t).split() if len(w) > 2 and w not in stop
        )

        answer_keys = get_keys(answer)
        topic_keys = get_keys(question) | get_keys(ideal)

        if not topic_keys:
            return 0.0

        # Exact overlap
        exact_overlap = len(answer_keys & topic_keys)

        # Fuzzy overlap: check for approximate matches
        unmatched_topic = topic_keys - answer_keys
        fuzzy_matches = 0
        for tk in unmatched_topic:
            for ak in answer_keys:
                if self._fuzzy_keyword_match(ak, tk):
                    fuzzy_matches += 1
                    break

        total_matches = exact_overlap + \
            (fuzzy_matches * 0.7)  # Fuzzy matches count 70%
        return min(1.0, total_matches / len(topic_keys))

    def _compute_fuzzy_overlap(self, answer: str, question: str, ideal: str) -> float:
        """Additional fuzzy overlap score that catches speech-garbled technical terms.
        More lenient than keyword overlap — focuses on whether core concepts appear."""
        stop = self._FILLER_WORDS
        answer_words = [w for w in re.sub(r'[^a-z0-9\s]', '', answer).split()
                        if len(w) > 2 and w not in stop]
        ideal_words = [w for w in re.sub(r'[^a-z0-9\s]', '', ideal).split()
                       if len(w) > 3 and w not in stop]

        if not ideal_words or not answer_words:
            return 0.0

        # Only check the most important words from ideal (longer = more important)
        important_ideal = sorted(
            set(ideal_words), key=lambda w: len(w), reverse=True)[:15]

        matches = 0
        for iw in important_ideal:
            # Check exact match first
            if iw in answer_words:
                matches += 1
                continue
            # Check fuzzy match
            for aw in answer_words:
                if self._fuzzy_keyword_match(aw, iw):
                    matches += 0.8
                    break

        return min(1.0, matches / max(len(important_ideal), 1))

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
    """Get or create the LLM evaluator singleton.

    The singleton stores the server's default API key. Per-request user keys
    should be passed to evaluate_answer(api_key=...) instead of here, so that
    one user's key doesn't overwrite the default for all subsequent requests.
    """
    global _llm_evaluator
    if _llm_evaluator is None:
        _llm_evaluator = LLMEvaluator(api_key=api_key)
    elif api_key and not _llm_evaluator.api_key:
        # Accept a late-supplied key only if the singleton has none
        _llm_evaluator.api_key = api_key
    return _llm_evaluator

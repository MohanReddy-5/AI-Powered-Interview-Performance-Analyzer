"""
SPEECH QUALITY ANALYZER
========================
Extracts delivery/communication metrics from interview transcripts.
These metrics are passed to the LLM so it can give feedback about
HOW the user speaks, not just WHAT they said.

Metrics extracted:
- Filler words (count, list, percentage)
- Hedging language (uncertainty markers)
- Repetition (overused words)
- Sentence structure (choppy vs. well-formed)
- Answer structure (intro/body/conclusion)
- Confidence markers vs. uncertainty markers
- Use of examples
- Vocabulary level
"""

import re
from collections import Counter
from typing import Dict, List


# ── Filler words that indicate nervousness/uncertainty ──
FILLER_WORDS = {
    'um', 'uh', 'uhh', 'umm', 'hmm', 'huh', 'er', 'erm', 'ah', 'ohh',
    'like',  # only when used as filler, not comparison
    'basically', 'literally', 'actually', 'honestly', 'obviously',
    'clearly', 'seriously', 'totally', 'absolutely', 'definitely',  # when used as fillers
    'you know', 'i mean', 'sort of', 'kind of', 'right',
    'so yeah', "that's it", 'and stuff', 'and all', 'and everything',
    'like i said', 'as i said', 'you see', 'you get it',
    'anyway', 'whatever', 'so basically', 'so essentially', 'so yeah',
}

# Single-word fillers for word-level counting
SINGLE_FILLERS = {
    'um', 'uh', 'uhh', 'umm', 'hmm', 'huh', 'er', 'erm', 'ah', 'ohh',
    'basically', 'literally', 'actually', 'honestly', 'right',
    'obviously', 'totally', 'seriously', 'anyway', 'whatever',
}

# Multi-word fillers checked as phrases
PHRASE_FILLERS = [
    'you know', 'i mean', 'sort of', 'kind of',
    'so yeah', "that's it", 'and stuff', 'and all', 'and everything',
    'like i said', 'as i said', 'you see', 'so basically', 'so essentially',
]

# ── Hedging language (signals uncertainty) ──
HEDGING_PHRASES = [
    'i think', 'i guess', 'i believe', 'i suppose', 'i feel like',
    'maybe', 'perhaps', 'probably', 'possibly', 'somewhat',
    'not sure but', 'not exactly sure', 'i might be wrong',
    'if i remember correctly', 'if i recall', 'if i\'m not mistaken',
    'something like that', 'or something', 'more or less',
    'kind of like', 'sort of like', 'in a way',
    'i assume', 'i would say', 'i\'d guess', 'roughly',
    'that might be', 'this could be', 'i\'m not 100%',
]

# ── Confidence markers (positive signals) ──
CONFIDENCE_MARKERS = [
    # Structural confidence
    'first', 'second', 'third', 'finally', 'lastly', 'to summarize',
    'in conclusion', 'the key point is', 'the main reason is',
    'the core idea is', 'essentially', 'fundamentally',
    # Explanatory confidence
    'this is because', 'the reason is', 'this means that',
    'this allows', 'this enables', 'this prevents', 'this ensures',
    'the advantage is', 'the benefit is', 'the tradeoff is',
    'specifically', 'precisely', 'clearly', 'in particular',
    # Examples (shows depth)
    'for example', 'for instance', 'such as', 'consider',
    'in practice', 'in real world', 'real-world',
    'in my experience', 'what i did was', 'the way i handled',
    'when i worked on', 'we implemented', 'in a project',
    # Technical assertion markers
    'under the hood', 'internally', 'at a high level', 'in simple terms',
    'the way it works', 'what happens is', 'the process is',
]

# ── Example indicators ──
EXAMPLE_INDICATORS = [
    'for example', 'for instance', 'such as', 'like when',
    'in my experience', 'in my previous', 'at my last',
    'a good example', 'one example', 'consider',
    'imagine', 'suppose', 'let me give',
    'i once', 'i worked on', 'we used', 'we built',
    'in practice', 'in real world', 'real-world',
]


def analyze_speech_quality(transcript: str) -> Dict:
    """
    Analyze the speech/delivery quality of an interview transcript.

    Returns a dict with:
    - filler_analysis: {count, percentage, details}
    - hedging_analysis: {count, phrases_found}
    - confidence_analysis: {score, markers_found}
    - structure_analysis: {sentence_count, avg_sentence_length, has_structure}
    - repetition_analysis: {overused_words}
    - example_usage: {used_examples, indicators_found}
    - summary_for_llm: A text summary to include in the LLM prompt
    """
    if not transcript or len(transcript.strip()) < 5:
        return _empty_analysis()

    text = transcript.strip()
    lower = text.lower()
    words = text.split()
    word_count = len(words)

    # ── 1. Filler Word Analysis ──
    filler_analysis = _analyze_fillers(lower, words, word_count)

    # ── 2. Hedging Language Analysis ──
    hedging_analysis = _analyze_hedging(lower)

    # ── 3. Confidence Markers ──
    confidence_analysis = _analyze_confidence(lower)

    # ── 4. Sentence Structure ──
    structure_analysis = _analyze_structure(text, word_count)

    # ── 5. Repetition Analysis ──
    repetition_analysis = _analyze_repetition(words)

    # ── 6. Example Usage ──
    example_usage = _analyze_examples(lower)

    # ── Build summary for LLM ──
    summary = _build_llm_summary(
        filler_analysis, hedging_analysis, confidence_analysis,
        structure_analysis, repetition_analysis, example_usage,
        word_count
    )

    return {
        'filler_analysis': filler_analysis,
        'hedging_analysis': hedging_analysis,
        'confidence_analysis': confidence_analysis,
        'structure_analysis': structure_analysis,
        'repetition_analysis': repetition_analysis,
        'example_usage': example_usage,
        'word_count': word_count,
        'summary_for_llm': summary,
    }


def _analyze_fillers(lower: str, words: List[str], word_count: int) -> Dict:
    """Count and identify filler words/phrases."""
    filler_details = {}

    # Count single-word fillers
    lower_words = [w.strip('.,!?;:') for w in lower.split()]
    for word in lower_words:
        if word in SINGLE_FILLERS:
            filler_details[word] = filler_details.get(word, 0) + 1

    # Count phrase fillers
    for phrase in PHRASE_FILLERS:
        count = lower.count(phrase)
        if count > 0:
            filler_details[phrase] = count

    # Special handling for "like" — only count as filler if used excessively
    # (more than 3 times in a short answer is likely filler usage)
    like_count = lower_words.count('like')
    if like_count >= 3 and word_count < 100:
        filler_details['like'] = like_count
    elif like_count >= 5:
        filler_details['like'] = like_count

    total_fillers = sum(filler_details.values())
    filler_percentage = (total_fillers / max(word_count, 1)) * 100

    return {
        'count': total_fillers,
        'percentage': round(filler_percentage, 1),
        'details': filler_details,
    }


def _analyze_hedging(lower: str) -> Dict:
    """Detect uncertainty/hedging language."""
    found = []
    for phrase in HEDGING_PHRASES:
        if phrase in lower:
            found.append(phrase)
    return {
        'count': len(found),
        'phrases_found': found,
    }


def _analyze_confidence(lower: str) -> Dict:
    """Detect confidence markers (positive signals)."""
    found = []
    for marker in CONFIDENCE_MARKERS:
        if marker in lower:
            found.append(marker)

    # Simple confidence score: more markers = more confident delivery
    score = min(10, len(found) * 2)

    return {
        'score': score,
        'markers_found': found,
    }


def _analyze_structure(text: str, word_count: int) -> Dict:
    """Analyze sentence structure and answer organization."""
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 3]
    sentence_count = len(sentences)

    if sentence_count == 0:
        return {
            'sentence_count': 0,
            'avg_sentence_length': 0,
            'has_structure': False,
            'issue': 'no_clear_sentences',
        }

    avg_length = word_count / sentence_count

    # Check for structural issues
    issue = None
    if sentence_count == 1 and word_count > 30:
        issue = 'single_run_on_sentence'
    elif avg_length > 40:
        issue = 'very_long_sentences'
    elif avg_length < 5 and sentence_count > 3:
        issue = 'very_choppy'

    # Check if answer has some structure (uses ordering words)
    ordering_words = ['first', 'second', 'third', 'also', 'additionally',
                      'moreover', 'furthermore', 'finally', 'in conclusion',
                      'to summarize', 'the main', 'another']
    has_ordering = any(w in text.lower() for w in ordering_words)

    return {
        'sentence_count': sentence_count,
        'avg_sentence_length': round(avg_length, 1),
        'has_structure': has_ordering,
        'issue': issue,
    }


def _analyze_repetition(words: List[str]) -> Dict:
    """Find words that are overused (repeated too many times)."""
    # Filter to meaningful words (not stop words)
    stop_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'can', 'i', 'me', 'my', 'we', 'you', 'your',
        'he', 'she', 'it', 'they', 'them', 'this', 'that', 'and', 'or',
        'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'not',
        'so', 'if', 'as', 'by', 'from', '—', 'its', 'our', 'their',
    }

    meaningful = [w.lower().strip('.,!?;:') for w in words
                  if w.lower().strip('.,!?;:') not in stop_words
                  and len(w) > 2]

    if len(meaningful) < 5:
        return {'overused_words': {}}

    counts = Counter(meaningful)
    word_count = len(meaningful)

    # A word is "overused" if it appears more than 3 times AND
    # makes up more than 8% of meaningful words
    overused = {}
    for word, count in counts.most_common(10):
        if count >= 3 and (count / word_count) > 0.08:
            overused[word] = count

    return {'overused_words': overused}


def _analyze_examples(lower: str) -> Dict:
    """Check if the user provided concrete examples."""
    found = []
    for indicator in EXAMPLE_INDICATORS:
        if indicator in lower:
            found.append(indicator)

    return {
        'used_examples': len(found) > 0,
        'indicators_found': found,
    }


def _build_llm_summary(
    fillers: Dict, hedging: Dict, confidence: Dict,
    structure: Dict, repetition: Dict, examples: Dict,
    word_count: int
) -> str:
    """Build a concise text summary of speech metrics for the LLM prompt."""
    parts = []

    parts.append(f"Word count: {word_count}.")

    # Fillers
    if fillers['count'] > 0:
        filler_list = ', '.join(
            f'"{k}" ({v}x)' for k, v in fillers['details'].items()
        )
        parts.append(
            f"Filler words detected ({fillers['count']} total, "
            f"{fillers['percentage']}% of words): {filler_list}."
        )
    else:
        parts.append("No filler words detected — clean delivery.")

    # Hedging
    if hedging['count'] > 0:
        parts.append(
            f"Hedging/uncertainty language detected ({hedging['count']}x): "
            f"{', '.join(hedging['phrases_found'])}."
        )
    else:
        parts.append("No hedging language — spoke with certainty.")

    # Confidence
    if confidence['markers_found']:
        parts.append(
            f"Confidence markers used: {', '.join(confidence['markers_found'][:5])}."
        )

    # Structure
    if structure['issue']:
        issue_descriptions = {
            'single_run_on_sentence': "The entire answer was one long run-on sentence.",
            'very_long_sentences': "Sentences are very long (avg {avg} words). Could be more concise.".format(
                avg=structure['avg_sentence_length']),
            'very_choppy': "Answer is very choppy with many very short sentences.",
            'no_clear_sentences': "No clear sentence structure detected.",
        }
        parts.append(issue_descriptions.get(
            structure['issue'], f"Structure issue: {structure['issue']}"))
    else:
        parts.append(
            f"Sentence structure: {structure['sentence_count']} sentences, "
            f"avg {structure['avg_sentence_length']} words each."
        )

    if structure['has_structure']:
        parts.append("Answer uses ordering/structure words (first, second, etc.).")

    # Repetition
    if repetition['overused_words']:
        rep_list = ', '.join(
            f'"{k}" ({v}x)' for k, v in repetition['overused_words'].items()
        )
        parts.append(f"Overused words: {rep_list}.")

    # Examples
    if examples['used_examples']:
        parts.append("Candidate provided concrete examples (good).")
    else:
        parts.append("No concrete examples or real-world scenarios were given.")

    return ' '.join(parts)


def _empty_analysis() -> Dict:
    """Return empty analysis for missing/empty transcripts."""
    return {
        'filler_analysis': {'count': 0, 'percentage': 0, 'details': {}},
        'hedging_analysis': {'count': 0, 'phrases_found': []},
        'confidence_analysis': {'score': 0, 'markers_found': []},
        'structure_analysis': {
            'sentence_count': 0, 'avg_sentence_length': 0,
            'has_structure': False, 'issue': None
        },
        'repetition_analysis': {'overused_words': {}},
        'example_usage': {'used_examples': False, 'indicators_found': []},
        'word_count': 0,
        'summary_for_llm': 'No transcript provided.',
    }

/**
 * Non-Answer Detector
 * Detects when users provide no meaningful answer
 * Returns score 0 for "I don't know", gibberish, evasive responses
 */

/**
 * Detect if the transcript is a non-answer
 * @param {string} transcript - User's answer
 * @param {string} question - The question asked
 * @returns {Object} - { isNonAnswer, reason, confidence }
 */
export const detectNonAnswer = (transcript, question) => {
    if (!transcript || transcript.trim().length === 0) {
        return { isNonAnswer: true, reason: 'empty_answer', confidence: 1.0 };
    }

    const cleanTranscript = transcript.toLowerCase().trim();
    const wordCount = cleanTranscript.split(/\s+/).length;

    // 1. EXPLICIT NON-ANSWERS - "I don't know", "I'm not sure", etc.
    // IMPORTANT: Only flag as non-answer if the answer is short (≤ 20 words).
    // Long answers that mention "I don't know" in passing (e.g. "I don't know
    // the exact syntax but responsive design uses...") should NOT be flagged —
    // the user is providing a real explanation after the caveat.
    const explicitNonAnswers = [
        /\bi\s+don'?t\s+know\b/i,
        /\bi'?m\s+not\s+sure\b/i,
        /\bno\s+idea\b/i,
        /\bi\s+have\s+no\s+clue\b/i,
        /\bcan'?t\s+answer\b/i,
        /\bdon'?t\s+remember\b/i,
        /\bi\s+forgot\b/i,
        /\bskip\s+(this\s+)?question\b/i,
        /\bpass\b/i,
        /\bnext\s+question\b/i,
        /\bi\s+don'?t\s+understand\b/i,
        /\bno\s+answer\b/i,
        /\bsorry,?\s+i\s+don'?t/i
    ];

    // Only flag if answer is short — long answers deserve content evaluation
    if (wordCount <= 20) {
        for (const pattern of explicitNonAnswers) {
            if (pattern.test(cleanTranscript)) {
                return { isNonAnswer: true, reason: 'explicit_non_answer', confidence: 0.98 };
            }
        }
    } else {
        // For long answers, only flag if the ENTIRE answer is essentially a refusal
        // (i.e., refusal phrase + ≤5 additional content words)
        for (const pattern of explicitNonAnswers) {
            if (pattern.test(cleanTranscript)) {
                // Check if after removing the refusal phrase, there's meaningful content
                const withoutRefusal = cleanTranscript.replace(pattern, '').trim();
                const remainingWords = withoutRefusal.split(/\s+/).filter(w => w.length > 2);
                if (remainingWords.length < 6) {
                    // Very little content beyond the refusal — it IS a non-answer
                    return { isNonAnswer: true, reason: 'explicit_non_answer', confidence: 0.90 };
                }
                // Otherwise: user mentioned uncertainty but continued with real content
                // Do NOT flag — let Gemini score the actual explanation
                break;
            }
        }
    }

    // 2. EVASIVE RESPONSES - Avoiding the question
    // Only flag as evasive if the answer is very short and mostly evasive
    const evasiveResponses = [
        /\bthat'?s\s+a\s+good\s+question\b/i,
        /\binteresting\s+question\b/i,
        /\bi\s+need\s+to\s+study\b/i,
        /\bi\s+should\s+review\b/i,
        /\bi'?ll\s+get\s+back\s+to\s+you\b/i,
        /\bum+\s+uh+\s+um+/i,  // Just filler words
        /\bwell+\s+um+\s+so+/i
    ];

    let evasiveCount = 0;
    for (const pattern of evasiveResponses) {
        if (pattern.test(cleanTranscript)) {
            evasiveCount++;
        }
    }

    // If mostly evasive and very short, it's a non-answer
    // Raised threshold to 2 evasives + under 15 words to avoid false positives
    if (evasiveCount >= 2 && wordCount < 15) {
        return { isNonAnswer: true, reason: 'evasive_response', confidence: 0.85 };
    }

    // 3. TOO SHORT FOR QUESTION TYPE
    const questionType = detectQuestionType(question);
    const minWords = getMinimumWords(questionType);

    if (wordCount < minWords) {
        // Allow short answers for simple questions
        if (questionType === 'simple' || questionType === 'definition') {
            // Check if it's at least trying to answer
            if (wordCount < 5) {
                return { isNonAnswer: true, reason: 'too_short', confidence: 0.75 };
            }
        } else {
            return { isNonAnswer: true, reason: 'too_short_for_complex_question', confidence: 0.80 };
        }
    }

    // 4. GIBBERISH DETECTION
    const gibberishScore = detectGibberish(cleanTranscript);
    if (gibberishScore > 0.7) {
        return { isNonAnswer: true, reason: 'gibberish', confidence: gibberishScore };
    }

    // 5. REPEATED WORDS/PHRASES (word salad)
    const repetitionScore = detectRepetition(cleanTranscript);
    if (repetitionScore > 0.6 && wordCount > 10) {
        return { isNonAnswer: true, reason: 'word_salad', confidence: repetitionScore };
    }

    // NOTE: Checks 6 (no_technical_content) and 7 (repeating_question) have been removed.
    // These regex-based heuristics incorrectly flagged valid answers as non-answers —
    // e.g., a correct plain-English explanation of HOCs would fail "no technical content"
    // because it doesn't use specific keywords, even when the candidate fully understands it.
    // Gemini's LLM scoring handles genuine quality assessment contextually.

    return { isNonAnswer: false, confidence: 0.95 };
};

/**
 * Detect question type to determine minimum answer length
 */
const detectQuestionType = (question) => {
    const q = question.toLowerCase();

    if (/^what is |^define |^what does .+ mean/i.test(q)) {
        return 'definition';
    }
    if (/^explain |^describe |^how does |^why /i.test(q)) {
        return 'explanation';
    }
    if (/^what are the (difference|benefits|advantages|disadvantages)/i.test(q)) {
        return 'comparison';
    }
    if (/^when (would|should)/i.test(q)) {
        return 'scenario';
    }
    if (/^can you (give|provide) (an )?example/i.test(q)) {
        return 'example';
    }

    return 'simple';
};

/**
 * Get minimum word count based on question type
 */
const getMinimumWords = (questionType) => {
    const minimums = {
        'simple': 5,
        'definition': 10,
        'explanation': 20,
        'comparison': 25,
        'scenario': 15,
        'example': 15
    };

    return minimums[questionType] || 10;
};

/**
 * Detect gibberish - random characters, keyboard mashing
 */
const detectGibberish = (text) => {
    // Remove spaces to check for long character sequences
    const noSpaces = text.replace(/\s+/g, '');

    // Check for very long words (likely keyboard mashing)
    const words = text.split(/\s+/);
    const longWordCount = words.filter(w => w.length > 15).length;
    if (longWordCount > 2) return 0.8;

    // Check for random character patterns
    const randomPatterns = [
        /asdf/i,
        /qwerty/i,
        /zxcv/i,
        /hjkl/i,
        /[a-z]{20,}/i,  // Very long sequences
        /(.)\1{5,}/i     // Same character repeated 5+ times
    ];

    let patternMatches = 0;
    for (const pattern of randomPatterns) {
        if (pattern.test(noSpaces)) {
            patternMatches++;
        }
    }

    if (patternMatches >= 2) return 0.9;
    if (patternMatches === 1) return 0.6;

    // Check vowel/consonant ratio (gibberish often has weird ratios)
    const vowels = (text.match(/[aeiou]/gi) || []).length;
    const consonants = (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
    const total = vowels + consonants;

    if (total > 0) {
        const vowelRatio = vowels / total;
        // Normal English is ~40% vowels
        if (vowelRatio < 0.15 || vowelRatio > 0.7) {
            return 0.65;
        }
    }

    return 0;
};

/**
 * Detect excessive repetition (word salad)
 */
const detectRepetition = (text) => {
    const words = text.split(/\s+/);
    if (words.length < 5) return 0;

    // Check for same word repeated consecutively
    let consecutiveRepeats = 0;
    for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === words[i + 1] && words[i].length > 2) {
            consecutiveRepeats++;
        }
    }

    if (consecutiveRepeats > 3) return 0.9;
    if (consecutiveRepeats > 1) return 0.6;

    // Check for same phrase repeated
    const phrases = [];
    for (let i = 0; i < words.length - 2; i++) {
        phrases.push(words.slice(i, i + 3).join(' '));
    }

    const uniquePhrases = new Set(phrases);
    const repetitionRatio = 1 - (uniquePhrases.size / phrases.length);

    if (repetitionRatio > 0.5) return 0.8;
    if (repetitionRatio > 0.3) return 0.5;

    return 0;
};

/**
 * Check if answer contains technical content relevant to the question
 */
const checkTechnicalContent = (text, question) => {
    // Extract potential technical terms (capitalized words, acronyms, technical keywords)
    const technicalPatterns = [
        /\b[A-Z]{2,}\b/,  // Acronyms: API, DOM, SQL
        /\b(function|method|class|object|array|variable|parameter|return|callback|promise|async|await)\b/i,
        /\b(database|query|index|table|schema|transaction)\b/i,
        /\b(component|state|props|hook|render|virtual|reconciliation)\b/i,
        /\b(server|client|request|response|endpoint|route)\b/i,
        /\b(algorithm|complexity|performance|optimization)\b/i,
        /\b(memory|heap|stack|garbage|collection)\b/i,
        /\b(thread|process|concurrent|parallel|synchronous|asynchronous)\b/i
    ];

    for (const pattern of technicalPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }

    // Check if answer contains any words from the question (showing engagement)
    const questionWords = question.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 4 && !['what', 'when', 'where', 'which', 'explain', 'describe'].includes(w));

    const answerWords = text.toLowerCase().split(/\s+/);
    const overlap = questionWords.filter(qw => answerWords.includes(qw));

    // If they mention key terms from question, they're at least trying
    return overlap.length > 0;
};

/**
 * Check if user is just repeating the question
 */
const checkQuestionRepetition = (text, question) => {
    const questionWords = question.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

    const answerWords = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/);

    // Count how many question words appear in answer
    const matchCount = questionWords.filter(qw => answerWords.includes(qw)).length;
    const matchRatio = matchCount / questionWords.length;

    // If >70% of question words are in answer and answer is short, likely just repeating
    return matchRatio > 0.7 && answerWords.length < questionWords.length * 1.5;
};

/**
 * Get detailed feedback for non-answers
 */
export const getNonAnswerFeedback = (reason, question) => {
    const feedbackMap = {
        'empty_answer': `You were asked: "${question}"\n\nNo answer was provided. Please attempt to answer the question.`,

        'explicit_non_answer': `You were asked: "${question}"\n\nYou indicated you don't know the answer. In a real interview, it's better to share what you do know or make an educated attempt rather than saying "I don't know."`,

        'evasive_response': `You were asked: "${question}"\n\nYour response was evasive and didn't actually answer the question. Try to provide a direct answer with specific technical details.`,

        'too_short': `You were asked: "${question}"\n\nYour answer was too brief. This question requires a more detailed explanation. Try to explain the concept thoroughly with examples.`,

        'too_short_for_complex_question': `You were asked: "${question}"\n\nThis is a complex question that requires a comprehensive answer. Your response was too short to adequately address what was asked. Aim for at least 3-4 sentences covering the key concepts.`,

        'gibberish': `You were asked: "${question}"\n\nYour response appears to be gibberish or random text. Please provide a meaningful technical answer.`,

        'word_salad': `You were asked: "${question}"\n\nYour response contains excessive repetition and doesn't form coherent technical content. Please provide a clear, structured answer.`,

        'no_technical_content': `You were asked: "${question}"\n\nYour response lacks technical content. This is a technical question that requires specific technical concepts, terminology, and explanations.`,

        'repeating_question': `You were asked: "${question}"\n\nYou appear to be repeating the question rather than answering it. Please provide your own explanation of the concept.`
    };

    return feedbackMap[reason] || `You were asked: "${question}"\n\nYour answer did not adequately address the question. Please provide a more complete response.`;
};

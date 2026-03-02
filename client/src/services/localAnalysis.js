import { detectNonAnswer } from './nonAnswerDetector';

/**
 * Local Analysis - Fallback Only
 * 
 * This is a FALLBACK for when AI is not available.
 * It only detects obvious non-answers (empty, "I don't know", gibberish).
 * 
 * For REAL evaluation, use AI (llmService.js) which understands semantic meaning.
 * 
 * IMPORTANT: This does NOT do keyword matching anymore.
 * Keyword matching was causing the "0 marks for correct answers" bug.
 */
export const analyzeLocally = async (transcript, question, domain, idealAnswer) => {
    // CRITICAL: Bulletproof empty answer detection
    // Check for: undefined, null, empty string, whitespace-only, or too short
    const cleanedTranscript = transcript ? transcript.trim() : '';

    if (!cleanedTranscript || cleanedTranscript.length === 0 || cleanedTranscript.length < 5) {
        console.log('🚫 Empty answer detected in localAnalysis - returning 0 score');
        return {
            score: 0,
            feedback: `You were asked: "${question}"\n\n❌ **No answer provided.** Please speak or type your answer to get a score.\n\n**Ideal Answer**: ${idealAnswer}`,
            ideal_answer: idealAnswer,
            status: "poor",
            improvement_points: [
                "Provide an actual spoken or written answer",
                "Review the ideal answer above",
                "Try again with a complete explanation"
            ],
            breakdown: { technical: 0, communication: 0, depth: 0 },
            confidence: 1.0,
            question_asked: question,
            is_relevant: false
        };
    }

    // Check for obvious non-answers ("I don't know", gibberish, etc.)
    const nonAnswerCheck = detectNonAnswer(transcript, question);

    if (nonAnswerCheck.isNonAnswer) {
        return {
            score: 0,
            feedback: `You were asked: "${question}"\n\nYou did not provide a meaningful answer. ${getNonAnswerGuidance(nonAnswerCheck.reason)}\n\n**Ideal Answer**: ${idealAnswer}`,
            ideal_answer: idealAnswer,
            status: "poor",
            improvement_points: [
                "Provide a meaningful technical answer",
                "Explain the concept in your own words",
                "Include key technical details"
            ],
            breakdown: { technical: 0, communication: 0, depth: 0 },
            confidence: nonAnswerCheck.confidence,
            question_asked: question,
            is_relevant: false,
            non_answer_reason: nonAnswerCheck.reason
        };
    }

    // If we reach here, they provided SOME answer
    // Use semantic brain for evaluation (works offline, no API needed)

    try {
        // Import semantic brain for offline evaluation
        const { analyzeWithSemanticBrain } = await import('./semanticBrain.js');

        // Get semantic analysis
        const analysis = analyzeWithSemanticBrain(transcript, question, idealAnswer);

        return {
            score: analysis.score,
            feedback: analysis.feedback,
            ideal_answer: idealAnswer,
            status: analysis.status,
            improvement_points: analysis.improvement_points || [],
            breakdown: analysis.breakdown || { technical: analysis.score, communication: 50, depth: 50 },
            confidence: analysis.confidence || 0.7,
            question_asked: question,
            is_relevant: analysis.is_relevant !== false,
            concepts_covered: analysis.concepts_covered || [],
            concepts_missing: analysis.concepts_missing || []
        };
    } catch (error) {
        console.error('Semantic brain error:', error);

        // Fallback if semantic brain fails - DO NOT use word count for scoring
        // This prevents rewarding long, meaningless answers
        return {
            score: 0,
            feedback: `You were asked: "${question}"\n\n⚠️ **Analysis Error**: Unable to evaluate your answer due to a technical issue. Please review the ideal answer below and compare it with what you said.\n\n**Ideal Answer**: ${idealAnswer}\n\nIf you believe you answered correctly, please try again or contact support.`,
            ideal_answer: idealAnswer,
            status: "poor",
            improvement_points: [
                "Review the ideal answer above",
                "Try answering again if you believe this is an error",
                "Ensure your answer addresses the key concepts"
            ],
            breakdown: { technical: 0, communication: 0, depth: 0 },
            confidence: 0,
            question_asked: question,
            is_relevant: false
        };
    }
};

/**
 * Get guidance for different non-answer types
 */
const getNonAnswerGuidance = (reason) => {
    const guidance = {
        'explicit_non_answer': 'In a real interview, try to share what you do know or make an educated attempt.',
        'evasive_response': 'Provide a direct, specific answer with technical details.',
        'too_short': 'This question requires a detailed explanation. Aim for at least 3-4 sentences.',
        'too_short_for_complex_question': 'This is a complex question that requires a comprehensive answer.',
        'gibberish': 'Please provide a coherent technical answer.',
        'word_salad': 'Structure your answer with clear, logical sentences.',
        'no_technical_content': 'Include specific technical concepts and terminology.',
        'repeating_question': 'Provide your own explanation, don\'t just repeat the question.'
    };

    return guidance[reason] || 'Please provide a meaningful technical answer.';
};

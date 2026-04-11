/**
 * Semantic Brain - The Orchestrator
 * Coordinates all intelligent components to truly UNDERSTAND user answers
 * This is the main entry point for advanced semantic analysis
 */

import { analyzeIntent, matchIntentWithQuestion } from './intentAnalyzer.js';
import { analyzeConceptualEquivalence, extractUserConcepts, reasonAboutEquivalence } from './semanticReasoner.js';
import { detectNonAnswer } from './nonAnswerDetector.js';
import { getQuestionConcepts } from '../data/questionConcepts.js';

/**
 * Extract key concepts from ideal answer (inlined from removed humanAnswerMatcher.js)
 */
const extractIdealConcepts = (idealAnswer) => {
    if (!idealAnswer || typeof idealAnswer !== 'string') return [];
    // Split on punctuation and conjunctions to get concept phrases
    const phrases = idealAnswer
        .split(/[.,;!?]|\band\b|\bbut\b|\bwhile\b|\bwhereas\b/i)
        .map(p => p.trim())
        .filter(p => p.length > 3);
    return phrases.slice(0, 10); // Cap at 10 key concepts
};

/**
 * Main semantic brain analysis
 * Understands MEANING, not just keywords
 * @param {string} userAnswer - What the user said
 * @param {string} question - The question asked
 * @param {string} idealAnswer - The ideal answer
 * @returns {Object} - Comprehensive intelligent analysis
 */
export const analyzeWithSemanticBrain = (userAnswer, question, idealAnswer) => {
    console.log('🧠 Semantic Brain: Starting intelligent analysis...');

    // STEP 1: Check for non-answers first
    const nonAnswerCheck = detectNonAnswer(userAnswer, question);
    if (nonAnswerCheck.isNonAnswer) {
        console.log('🧠 Detected non-answer:', nonAnswerCheck.reason);
        return {
            score: 0,
            understanding: 'none',
            isNonAnswer: true,
            nonAnswerReason: nonAnswerCheck.reason,
            feedback: `You were asked: "${question}"\n\nYou did not provide a meaningful answer. ${getNonAnswerGuidance(nonAnswerCheck.reason)}`,
            conceptsUnderstood: [],
            conceptsMissing: extractIdealConcepts(idealAnswer),
            confidence: nonAnswerCheck.confidence,
            breakdown: { technical: 0, communication: 0, depth: 0 }
        };
    }

    // STEP 2: Analyze Intent - What is the user trying to explain?
    console.log('🧠 Analyzing intent...');
    const intent = analyzeIntent(userAnswer, question);
    const intentMatch = matchIntentWithQuestion(intent, question);

    console.log('🧠 Intent:', intent.primaryIntent, 'Completeness:', intent.completeness);
    console.log('🧠 Intent Match Score:', intentMatch.matchScore);

    // STEP 3: Extract ideal concepts
    const idealConcepts = extractIdealConcepts(idealAnswer);
    console.log('🧠 Ideal concepts to look for:', idealConcepts);

    // STEP 4: Semantic Reasoning - Does user understand the concepts?
    console.log('🧠 Reasoning about conceptual equivalence...');
    const conceptualAnalysis = analyzeConceptualEquivalence(userAnswer, idealConcepts);

    console.log('🧠 Concepts understood:', conceptualAnalysis.understood);
    console.log('🧠 Concepts missing:', conceptualAnalysis.missing);
    console.log('🧠 Understanding score:', conceptualAnalysis.understandingScore);

    // STEP 5: Extract what user is actually saying
    const userConcepts = extractUserConcepts(userAnswer);
    console.log('🧠 User is talking about:', userConcepts.map(c => c.concept));

    // STEP 6: Check for examples
    const hasExamples = /for example|such as|like|e\.g\.|example:|code:|function |const |let |var |class /i.test(userAnswer);

    // STEP 7: Detect incorrect information
    const hasIncorrectInfo = detectIncorrectInformation(userAnswer, question);

    // STEP 8: Calculate intelligent score
    const intelligentScore = calculateIntelligentScore({
        intent,
        intentMatch,
        conceptualAnalysis,
        hasExamples,
        hasIncorrectInfo,
        answerLength: userAnswer.length
    });

    console.log('🧠 Final intelligent score:', intelligentScore.score);

    // STEP 9: Generate comprehensive feedback
    const feedback = generateSemanticFeedback({
        question,
        userAnswer,
        intent,
        intentMatch,
        conceptualAnalysis,
        hasExamples,
        hasIncorrectInfo,
        score: intelligentScore.score
    });

    // STEP 10: Return comprehensive analysis
    return {
        score: intelligentScore.score,
        understanding: getUnderstandingLevel(conceptualAnalysis.understandingScore),
        isNonAnswer: false,
        feedback,
        conceptsUnderstood: conceptualAnalysis.understood,
        conceptsMissing: conceptualAnalysis.missing,
        userConcepts: userConcepts.map(c => c.concept),
        confidence: 0.95, // High confidence with semantic brain
        breakdown: intelligentScore.breakdown,
        improvementPoints: generateImprovementPoints(intent, intentMatch, conceptualAnalysis, question),

        // Detailed analysis for debugging/transparency
        details: {
            intent: intent.primaryIntent,
            completeness: intent.completeness,
            intentMatchScore: intentMatch.matchScore,
            conceptCoverage: conceptualAnalysis.understandingScore,
            avgConceptConfidence: conceptualAnalysis.avgConfidence,
            hasExamples,
            hasIncorrectInfo
        }
    };
};

/**
 * Calculate intelligent score based on understanding
 * @param {Object} analysis 
 * @returns {Object} - Score and breakdown
 */
const calculateIntelligentScore = (analysis) => {
    const {
        intent,
        intentMatch,
        conceptualAnalysis,
        hasExamples,
        hasIncorrectInfo,
        answerLength
    } = analysis;

    // Only reject truly empty/micro answers (< 5 chars).
    // Short but correct answers deserve real scoring via Gemini LLM evaluation.
    // localAnalysis.js already gates anything under 5 chars before reaching here.
    if (answerLength < 5) {
        return {
            score: 0,
            breakdown: { technical: 0, communication: 0, depth: 0 }
        };
    }

    let score = 0;

    // 1. INTENT ALIGNMENT (25 points) - Reduced from 30
    // Does the answer type match what the question asked for?
    const intentScore = intentMatch.matchScore * 25;
    score += intentScore;

    // 2. CONCEPTUAL UNDERSTANDING (60 points) - INCREASED from 50
    // This is the MOST IMPORTANT - do they understand the concepts?
    // This is now the dominant factor in scoring
    const conceptScore = conceptualAnalysis.understandingScore * 60;
    score += conceptScore;

    // 3. ANSWER COMPLETENESS (10 points) - Reduced from 15
    // Is the answer comprehensive?
    const completenessScores = {
        'comprehensive': 10,
        'good': 8,
        'basic': 5,
        'minimal': 2
    };
    score += completenessScores[intent.completeness] || 0;

    // 4. CONFIDENCE BONUS (5 points)
    // How confident are we that they understand?
    score += conceptualAnalysis.avgConfidence * 5;

    // BONUSES - Only reward genuine quality, not just length
    if (hasExamples) score += 5; // Examples show deep understanding

    // Only bonus for detailed answers if they ALSO show good understanding
    // This prevents rewarding long, rambling answers
    if (answerLength > 150 && conceptualAnalysis.understandingScore > 0.75) {
        score += 3; // Detailed answer with GOOD understanding
    }

    // REMOVED: The problematic effort bonus that rewarded verbosity
    // Previously gave 15 points just for having 30+ characters
    // This was causing long, vague answers to score higher than short, correct ones

    // PENALTIES - Stricter on incorrect information
    if (hasIncorrectInfo) {
        score *= 0.7; // Stricter penalty - incorrect info is a serious issue
    }

    // Ensure score is in valid range
    score = Math.round(Math.max(0, Math.min(100, score)));

    // Calculate breakdown
    const breakdown = {
        technical: Math.round(conceptualAnalysis.understandingScore * 100),
        communication: Math.round(intentMatch.matchScore * 100),
        depth: Math.round((intent.completeness === 'comprehensive' ? 90 :
            intent.completeness === 'good' ? 75 :
                intent.completeness === 'basic' ? 50 : 30))
    };

    return { score, breakdown };
};

/**
 * Generate comprehensive semantic feedback
 * TONE: Encouraging, supportive, confidence-building
 */
const generateSemanticFeedback = (params) => {
    const {
        question,
        intent,
        intentMatch,
        conceptualAnalysis,
        hasExamples,
        hasIncorrectInfo,
        score,
        userAnswer
    } = params;

    // Look up question-specific concepts from concept map
    const questionConcepts = getQuestionConcepts(question);
    let coveredConcepts = [];
    let uncoveredConcepts = [];

    if (questionConcepts.length > 0 && userAnswer) {
        const ansLower = (userAnswer || '').toLowerCase();
        questionConcepts.forEach(concept => {
            const terms = concept.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const checkTerms = terms.length > 0 ? terms : concept.toLowerCase().split(/\s+/);
            const hits = checkTerms.filter(w => ansLower.includes(w)).length;
            if (hits >= Math.max(1, Math.floor(checkTerms.length / 2))) {
                coveredConcepts.push(concept);
            } else {
                uncoveredConcepts.push(concept);
            }
        });
    } else {
        // Fallback to semantic analysis results
        coveredConcepts = conceptualAnalysis.understood || [];
        uncoveredConcepts = conceptualAnalysis.missing || [];
    }

    let feedback = `**Question**: "${question}"\n\n`;

    // ── What Landed (concept-focused, mentor tone) ──
    if (coveredConcepts.length > 0) {
        const sample = coveredConcepts.slice(0, 3);
        const landedTemplates = [
            `You clearly get the core idea here — your coverage of ${sample.join(', ')} shows you've actually worked with these concepts, not just read about them.`,
            `What stood out was how naturally you brought in ${sample.join(', ')} — these are exactly what an interviewer wants to hear.`,
            `The way you connected ${sample.join(', ')} shows real hands-on understanding. That's the kind of practical knowledge that separates strong candidates.`,
        ];
        const landed = landedTemplates[Math.floor(Math.random() * landedTemplates.length)];
        feedback += `**What landed:** ${landed}\n\n`;
    } else if (conceptualAnalysis.understood && conceptualAnalysis.understood.length > 0) {
        feedback += `**What landed:** You showed awareness of the topic area — that's a solid starting point to build from.\n\n`;
    }

    // EXAMPLES (if provided)
    if (hasExamples) {
        feedback += `✨ **Excellent!** You provided examples, which shows deeper understanding.\n\n`;
    }

    // ── What's Missing (concept-focused + growth-framing) ──
    if (uncoveredConcepts.length >= 2) {
        const sample = uncoveredConcepts.slice(0, 3);
        const missingTemplates = [
            `The concepts worth building into this answer are ${sample.join(', ')} — mastering these would take your response from good to truly interview-ready.`,
            `Where I'd push you to grow next is around ${sample.join(', ')} — these are what separate a decent answer from one that really impresses.`,
            `To level up this answer, focus on ${sample.join(', ')} — once you've internalized these, you'll handle follow-up questions with ease.`,
            `The depth an interviewer is looking for here includes ${sample.join(', ')} — adding these to your toolkit makes this a standout answer.`,
        ];
        const missing = missingTemplates[Math.floor(Math.random() * missingTemplates.length)];
        feedback += `**What's missing:** ${missing}\n\n`;
    } else if (uncoveredConcepts.length === 1) {
        feedback += `**What's missing:** The one concept that would really complete this is ${uncoveredConcepts[0]} — it's the missing piece that ties everything together.\n\n`;
    } else if (conceptualAnalysis.missing && conceptualAnalysis.missing.length > 0) {
        feedback += `**What's missing:** Consider adding more depth around ${conceptualAnalysis.missing.slice(0, 2).join(' and ')} to round out your answer.\n\n`;
    }

    // INCORRECT INFORMATION (gentle correction)
    if (hasIncorrectInfo) {
        feedback += `📚 **Note**: Double-check some technical details - there might be a small misunderstanding. Review the concept and you'll nail it!\n\n`;
    }

    // ── Delivery (question-type-aware advice) ──
    const qLower = question.toLowerCase();
    let deliveryAdvice = '';
    if (['explain', 'what is', 'what are', 'describe'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = 'For concept-explanation questions like this, leading with a crisp one-sentence definition before elaborating helps the interviewer anchor your answer.';
    } else if (['difference', 'compare', 'versus', 'vs'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = 'For comparison questions, a structured side-by-side contrast with clear categories makes your answer much easier to follow.';
    } else if (['tell me about', 'describe a time', 'give an example'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = 'For behavioral questions, the STAR format (Situation, Task, Action, Result) gives your story a clear, memorable arc.';
    } else if (['design', 'architect', 'build'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = 'For design questions, walking through requirements then components then data flow then tradeoffs shows the structured thinking interviewers value.';
    } else if (['how do you', 'how would you', 'how does'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = 'For process-oriented questions, describing your approach step by step with reasoning behind each choice demonstrates practical experience.';
    } else if (['optimize', 'improve', 'performance'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = "For optimization questions, leading with 'profile first, then optimize' shows engineering maturity before diving into specific techniques.";
    } else if (['when', 'why', 'should'].some(kw => qLower.includes(kw))) {
        deliveryAdvice = 'For decision-making questions, showing you can reason about tradeoffs — not just list options — is what separates strong answers.';
    }

    if (deliveryAdvice) {
        // Add speech-quality comment based on answer analysis
        let speechNote = '';
        if (!hasExamples && score > 50) {
            speechNote = ' Adding a quick example or use case would make your answer even more compelling.';
        }
        feedback += `**Delivery:** ${deliveryAdvice}${speechNote}\n\n`;
    }

    // INTENT MISMATCH (gentle guidance)
    if (intentMatch.matchScore < 0.7) {
        feedback += `💭 **Helpful hint**: This question was looking for ${intentMatch.missing.join(', ')}. Your answer focused more on ${intent.primaryIntent}.\n\n`;
    }

    // OVERALL ASSESSMENT (always encouraging!)
    if (score >= 85) {
        feedback += `🎉 **Outstanding!** You really know this concept and explained it beautifully. Keep up the excellent work!`;
    } else if (score >= 70) {
        feedback += `🌟 **Great job!** You've got a solid understanding. Add those extra points above and you'll be at expert level!`;
    } else if (score >= 50) {
        feedback += `👏 **Good effort!** You're on the right track. Focus on the concepts mentioned above and you'll improve quickly!`;
    } else if (score >= 30) {
    }

    return feedback;
};

/**
 * Generate improvement points
 */
const generateImprovementPoints = (intent, intentMatch, conceptualAnalysis, question) => {
    const points = [];

    // Use concept map for question-specific improvement points
    const questionConcepts = getQuestionConcepts(question || '');
    if (questionConcepts.length > 0) {
        const missingConcepts = questionConcepts.filter(concept => {
            const terms = concept.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            return terms.length > 0;
        });
        if (missingConcepts.length > 0) {
            points.push(`Key concepts to master: ${missingConcepts.slice(0, 3).join(', ')}`);
        }
    } else if (conceptualAnalysis.missing.length > 0) {
        // Fallback to semantic analysis
        points.push(`Study these missing concepts: ${conceptualAnalysis.missing.slice(0, 3).join(', ')}`);
    }

    // Intent mismatch
    if (intentMatch.missing.length > 0) {
        points.push(`This question requires you to provide: ${intentMatch.missing.join(', ')}`);
    }

    // Completeness
    if (intent.completeness === 'minimal' || intent.completeness === 'basic') {
        points.push('Provide more comprehensive answers with definition, mechanism, and examples');
    }

    // Examples
    if (!intent.hasExample && conceptualAnalysis.understandingScore > 0.5) {
        points.push('Add code examples or real-world use cases to demonstrate understanding');
    }

    return points.slice(0, 4);
};

/**
 * Detect incorrect technical information
 */
const detectIncorrectInformation = (userAnswer, question) => {
    const incorrectPatterns = [
        { pattern: /react.*uses.*jquery/i, error: true },
        { pattern: /virtual dom.*slower/i, error: true },
        { pattern: /javascript.*compiled language/i, error: true },
        { pattern: /css.*programming language/i, error: true },
        { pattern: /html.*programming language/i, error: true },
        { pattern: /node.*js.*multi.*threaded/i, error: true },
        { pattern: /closure.*async/i, error: true }
    ];

    return incorrectPatterns.some(({ pattern }) => pattern.test(userAnswer));
};

/**
 * Get understanding level label
 */
const getUnderstandingLevel = (score) => {
    if (score >= 0.85) return 'excellent';
    if (score >= 0.70) return 'good';
    if (score >= 0.50) return 'fair';
    if (score >= 0.30) return 'limited';
    return 'poor';
};

/**
 * Get guidance for non-answers
 */
const getNonAnswerGuidance = (reason) => {
    const guidance = {
        'explicit_non_answer': 'In a real interview, try to share what you do know or make an educated attempt.',
        'evasive_response': 'Provide a direct, specific answer with technical details.',
        'too_short': 'This question requires a detailed explanation. Aim for at least 3-4 sentences.',
        'gibberish': 'Please provide a coherent technical answer.',
        'word_salad': 'Structure your answer with clear, logical sentences.',
        'no_technical_content': 'Include specific technical concepts and terminology.',
        'repeating_question': 'Provide your own explanation, don\'t just repeat the question.'
    };

    return guidance[reason] || 'Please provide a meaningful technical answer.';
};

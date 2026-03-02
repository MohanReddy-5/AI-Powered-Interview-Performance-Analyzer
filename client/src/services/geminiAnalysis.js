/**
 * HYBRID ANALYSIS SERVICE
 * ========================
 * Local-First + Gemini Enhancement
 * 
 * How it works:
 *   1. ALWAYS runs local concept-level scoring first (never crashes)
 *   2. If zero-score detected locally → returns 0 immediately (saves API quota)
 *   3. If Gemini API key available → calls Gemini for enhanced scoring
 *   4. Blends local + Gemini scores (30% local, 70% Gemini when available)
 *   5. If Gemini fails → returns local score (still meaningful, never 0 for valid answers)
 * 
 * Output format is IDENTICAL to the old version — no UI changes needed.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { scoreAnswerLocally, isZeroScoreAnswer } from './conceptMatcher.js';

// Models to try in order (first available wins)
const MODEL_CANDIDATES = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
];

/**
 * Try Gemini content generation with model fallback
 */
async function generateWithFallback(genAI, prompt, generationConfig = {}) {
    let lastError;
    for (const modelName of MODEL_CANDIDATES) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json', ...generationConfig }
            });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND')) {
                lastError = err;
                continue; // try next model
            }
            throw err; // non-404, propagate
        }
    }
    throw lastError || new Error('All Gemini model candidates failed');
}

/**
 * Strip markdown code fences from LLM response
 */
function stripFences(text) {
    return text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
}

/**
 * MAIN ANALYSIS FUNCTION — Hybrid Local + Gemini
 * 
 * This is the ONLY function called by Interview.jsx.
 * Its signature and return format are IDENTICAL to the old version.
 */
export async function analyzeWithGemini(params) {
    const { transcript, question, ideal_answer, audio_blob, apiKey } = params;

    // ══════════════════════════════════════════════════════════
    // STEP 1: Get the transcript (same as before)
    // ══════════════════════════════════════════════════════════
    let finalTranscript = (transcript || '').trim();

    // If no transcript but we have audio + API key, try to transcribe
    if (!finalTranscript && audio_blob && apiKey && apiKey.length >= 20) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            for (const modelName of ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const audioBase64 = await blobToBase64(audio_blob);
                    const transcriptionResult = await model.generateContent([
                        'Transcribe this audio. If no speech, return exactly: NO_SPEECH',
                        { inlineData: { data: audioBase64.split(',')[1], mimeType: 'audio/webm' } }
                    ]);
                    const txt = transcriptionResult.response.text().trim();
                    if (txt !== 'NO_SPEECH' && txt.length >= 5) {
                        finalTranscript = txt;
                    }
                    break;
                } catch (e) {
                    if (e.message?.includes('404')) continue;
                    break;
                }
            }
        } catch (audioErr) {
            console.warn('Audio transcription failed:', audioErr.message);
        }
    }

    // ══════════════════════════════════════════════════════════
    // STEP 2: ALWAYS run local scoring first (this never fails)
    // ══════════════════════════════════════════════════════════
    console.log('🧠 Running local concept-level analysis...');
    const localResult = scoreAnswerLocally(finalTranscript, question, ideal_answer);
    console.log(`📊 Local score: ${localResult.score}/100 (method: ${localResult.scoring_method})`);

    // If zero-score detected locally → return immediately (don't waste API)
    if (localResult.score === 0) {
        console.log('🚫 Zero-score answer detected locally — skipping API call');
        return localResult;
    }

    // ══════════════════════════════════════════════════════════
    // STEP 3: If no API key → return local score as-is
    // ══════════════════════════════════════════════════════════
    if (!apiKey || apiKey.length < 20) {
        console.log('🔑 No API key — using local score only');
        return localResult;
    }

    // ══════════════════════════════════════════════════════════
    // STEP 4: Try Gemini enhancement (optional — improves accuracy)
    // ══════════════════════════════════════════════════════════
    try {
        console.log('🤖 Calling Gemini for enhanced scoring...');
        const genAI = new GoogleGenerativeAI(apiKey);

        const prompt = `You are a PRECISE and FAIR interview evaluator. Score the answer ACCURATELY based on actual content quality. Do NOT inflate scores — differentiate clearly between weak, average, and strong answers.

**QUESTION:** ${question}

**CANDIDATE'S ANSWER:** ${finalTranscript}

**IDEAL ANSWER (reference for evaluation):** ${ideal_answer || 'Not provided'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — CHECK FOR NON-ANSWERS (mandatory, do this first):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the answer matches ANY of these → set ALL scores to 0 immediately:
  • "I don't know", "I have no idea", "I can't answer", "skip", "pass", any refusal
  • Empty response, just filler sounds ("um", "uh", "hmm"), or fewer than 3 real words
  • Single words that don't demonstrate knowledge (e.g., "yes", "no", "maybe")
  • Content COMPLETELY UNRELATED to the question (no topical connection at all)

STEP 2 — SCORE ACCURATELY WITH DIFFERENTIATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a SPOKEN exam. Be fair but not inflated.

SCORING SCALE (use the FULL range, do NOT cluster scores):
  0       → Non-answer, refusal, "I don't know", completely unrelated
  5-15    → Completely off-topic or unrelated content
  18-30   → Barely relevant, shows vague awareness but major confusion
  32-45   → Shows some understanding but misses most key concepts
  48-60   → Decent understanding, covers some key points but incomplete
  62-75   → Good answer, covers most concepts with reasonable depth
  78-88   → Strong answer, comprehensive with good technical accuracy
  90-100  → Exceptional, covers all concepts with expert-level insight

DIMENSION-SPECIFIC RULES:
• technical: Score based on ACTUAL technical accuracy. Wrong facts = low score. Vague generalities = 30-45 max.
• grammar: For spoken language, be lenient (60+ if understandable). Only penalize for truly unclear communication.
• accent: Score clarity of expression and articulation (60+ if reasonably clear).
• confidence: Score based on how structured and decisive the answer sounds.

SPECIAL CASES:
• BEHAVIORAL/SOFT SKILLS questions (teamwork, leadership, etc.): Any thoughtful personal answer = 55+. Genuine reflection = 70+.
• SHORT BUT CORRECT: A brief correct answer can score 55-70. Brevity is fine if accurate.
• PARAPHRASING: Informal explanations of concepts get FULL credit if the understanding is correct.

⚠️ CRITICAL: Do NOT score every answer 55+. Use the FULL 0-100 range. A mediocre answer should get 35-50, not 55+.

**DIMENSIONS (each 0-100):**
- overall_score: Overall quality using the scale above
- technical: Technical accuracy (be strict — wrong info = low scores)
- grammar: Language quality (lenient for spoken, 60+ baseline if understandable)
- accent: Clarity of expression
- confidence: Decisiveness and structure

**FEEDBACK:** 2-3 sentences. Start with what they got right, then specific gaps.

Return ONLY valid JSON (no markdown, no code fences):
{
  "overall_score": <0-100>,
  "technical": <0-100>,
  "grammar": <0-100>,
  "accent": <0-100>,
  "confidence": <0-100>,
  "feedback": "<2-3 specific sentences>",
  "technical_feedback": "<1 sentence on technical accuracy>",
  "grammar_feedback": "<1 sentence on communication>",
  "missing_concepts": ["concept 1", "concept 2"],
  "improvement_points": ["tip 1", "tip 2", "tip 3"],
  "status": "<excellent|good|fair|poor>"
}`;

        let responseText;
        try {
            responseText = await generateWithFallback(genAI, prompt);
        } catch (apiErr) {
            console.warn('Gemini API error — using local score:', apiErr.message);
            localResult.feedback += ' (AI enhancement unavailable — local analysis used)';
            return localResult;
        }

        // Parse JSON response
        let geminiAnalysis;
        try {
            geminiAnalysis = JSON.parse(stripFences(responseText));
        } catch (parseErr) {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
                try { geminiAnalysis = JSON.parse(match[0]); } catch { geminiAnalysis = null; }
            }
        }

        if (!geminiAnalysis || typeof geminiAnalysis.overall_score !== 'number') {
            console.warn('Gemini returned unparseable response — using local score');
            return localResult;
        }

        // ══════════════════════════════════════════════════════════
        // STEP 5: BLEND LOCAL + GEMINI SCORES
        // ══════════════════════════════════════════════════════════
        let geminiScore = Math.max(0, Math.min(100, Math.round(geminiAnalysis.overall_score)));

        // ENFORCEMENT: If Gemini scores >0 for something that's clearly a non-answer
        // (our local engine caught it as zero), enforce zero
        const zeroCheck = isZeroScoreAnswer(finalTranscript, question, ideal_answer);
        if (zeroCheck.isZero) {
            console.warn('🚫 Post-Gemini enforcement: non-answer detected, forcing 0');
            geminiScore = 0;
        }

        // BLEND: 30% local + 70% Gemini (Gemini is more nuanced when available)
        const blendedScore = Math.round(localResult.score * 0.3 + geminiScore * 0.7);

        // SANITY CHECK: If local and Gemini wildly disagree (>40 point gap),
        // trust the lower score (defensive — prevents inflation)
        const gap = Math.abs(localResult.score - geminiScore);
        let finalScore;
        if (gap > 40) {
            finalScore = Math.min(localResult.score, geminiScore);
            console.warn(`⚠️ Score disagreement (local=${localResult.score}, gemini=${geminiScore}) — using lower: ${finalScore}`);
        } else {
            finalScore = blendedScore;
        }

        const finalStatus = geminiAnalysis.status || (finalScore >= 80 ? 'excellent' : finalScore >= 60 ? 'good' : finalScore >= 40 ? 'fair' : 'poor');

        // Build breakdown with BOTH naming conventions for Results page compatibility
        const techScore = Math.round(geminiAnalysis.technical || 0);
        const grammarScore = Math.round(geminiAnalysis.grammar || 0);
        const accentScore = Math.round(geminiAnalysis.accent || 0);
        const confScore = Math.round(geminiAnalysis.confidence || 0);

        console.log(`✅ Hybrid score: ${finalScore} (local=${localResult.score}, gemini=${geminiScore}, blend=${blendedScore})`);

        return {
            score: finalScore,
            feedback: geminiAnalysis.feedback || localResult.feedback,
            technical_feedback: geminiAnalysis.technical_feedback || '',
            grammar_feedback: geminiAnalysis.grammar_feedback || '',
            status: finalStatus,
            breakdown: {
                technical: techScore,
                grammar: grammarScore,
                accent: accentScore,
                confidence: confScore,
                knowledge: techScore,
                relevance: accentScore,
                clarity: grammarScore,
                technical_score: techScore,
                communication_score: grammarScore,
                depth_score: accentScore,
                confidence_score: confScore
            },
            missing_concepts: geminiAnalysis.missing_concepts || localResult.missing_concepts || [],
            improvement_points: geminiAnalysis.improvement_points || localResult.improvement_points || [],
            transcript: finalTranscript,
            ideal_answer: ideal_answer || '',
            scoring_method: 'hybrid'
        };

    } catch (error) {
        // ══════════════════════════════════════════════════════════
        // STEP 6: Gemini failed entirely — return local score
        // ══════════════════════════════════════════════════════════
        console.error('Gemini analysis failed — using local score:', error.message);
        const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuotaError) {
            localResult.feedback += ' (AI quota exceeded — local analysis used)';
        }
        return localResult;
    }
}

/** Helper: Blob → Base64 */
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

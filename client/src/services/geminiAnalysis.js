/**
 * HYBRID ANALYSIS SERVICE
 * ========================
 * Local-First + Server-Side Gemini Enhancement
 * 
 * How it works:
 *   1. ALWAYS runs local concept-level scoring first (never crashes)
 *   2. If zero-score detected locally → returns 0 immediately (saves API quota)
 *   3. Calls server-side /api/gemini-analyze endpoint for enhanced scoring
 *      (API key stays hidden on the server — never exposed to the browser)
 *   4. Blends local + Gemini scores (30% local, 70% Gemini when available)
 *   5. If server call fails → returns local score (still meaningful, never 0 for valid answers)
 * 
 * Output format is IDENTICAL to the old version — no UI changes needed.
 */

import { scoreAnswerLocally, isZeroScoreAnswer } from './conceptMatcher.js';

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
 * MAIN ANALYSIS FUNCTION — Hybrid Local + Server-Side Gemini
 * 
 * This is the ONLY function called by Interview.jsx.
 * Its signature and return format are IDENTICAL to the old version.
 * NOTE: apiKey parameter is NO LONGER NEEDED (server uses its own key)
 *       but kept for backward compatibility — it is simply ignored.
 */
export async function analyzeWithGemini(params) {
    const { transcript, question, ideal_answer, audio_blob, apiKey } = params;

    // ══════════════════════════════════════════════════════════
    // STEP 1: Get the transcript (same as before)
    // ══════════════════════════════════════════════════════════
    let finalTranscript = (transcript || '').trim();

    // Audio transcription via Gemini is no longer available client-side
    // (API key is on the server now). If no transcript, proceed with empty.
    // The server-side submit-answer endpoint handles audio transcription if needed.

    // ══════════════════════════════════════════════════════════
    // STEP 2: ALWAYS run local scoring first (this never fails)
    // ══════════════════════════════════════════════════════════
    console.log('🧠 Running local concept-level analysis...');
    const localResult = scoreAnswerLocally(finalTranscript, question, ideal_answer);
    console.log(`📊 Local score: ${localResult.score}/100 (method: ${localResult.scoring_method})`);

    // If zero-score detected locally → only skip API call for GENUINELY empty/short answers.
    // Do NOT short-circuit if the answer is long enough that local detection may have fired
    // a false positive (e.g. user said "I don't know the exact syntax but..." and kept going).
    const wordCountForShortCircuit = finalTranscript.trim().split(/\s+/).length;
    if (localResult.score === 0 && wordCountForShortCircuit <= 20) {
        console.log('🚫 Zero-score answer detected locally (short/empty) — skipping API call');
        return localResult;
    }
    if (localResult.score === 0 && wordCountForShortCircuit > 20) {
        console.log('⚠️ Local scored 0 but answer has', wordCountForShortCircuit, 'words — still calling Gemini to evaluate content');
        // Continue to Gemini — the answer may have real content that local missed
    }

    // ══════════════════════════════════════════════════════════
    // STEP 3: Call server-side Gemini proxy for enhanced scoring
    // ══════════════════════════════════════════════════════════
    try {
        console.log('🤖 Calling server-side Gemini proxy for enhanced scoring...');

        // Get auth token for the API call
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        const response = await fetch(`${API_BASE_URL}/api/gemini-analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                transcript: finalTranscript,
                question: question,
                ideal_answer: ideal_answer || ''
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.analysis) {
            console.warn('Server Gemini proxy error:', data.error || 'Unknown error');
            console.log('🔑 Using local score only (server proxy failed)');
            return localResult;
        }

        const geminiAnalysis = data.analysis;

        if (typeof geminiAnalysis.overall_score !== 'number') {
            console.warn('Gemini returned unparseable response — using local score');
            return localResult;
        }

        // ══════════════════════════════════════════════════════════
        // STEP 4: USE GEMINI SCORE DIRECTLY (no keyword blending)
        // ══════════════════════════════════════════════════════════
        let geminiScore = Math.max(0, Math.min(100, Math.round(geminiAnalysis.overall_score)));

        // ENFORCEMENT: If Gemini scores >0 for something that's clearly a non-answer
        // (our local engine caught it as zero), enforce zero
        const zeroCheck = isZeroScoreAnswer(finalTranscript, question, ideal_answer);
        if (zeroCheck.isZero) {
            console.warn('🚫 Post-Gemini enforcement: non-answer detected, forcing 0');
            geminiScore = 0;
        }

        // Use Gemini score directly — no keyword-based blending
        let finalScore = geminiScore;

        const finalStatus = geminiAnalysis.status || (finalScore >= 80 ? 'excellent' : finalScore >= 60 ? 'good' : finalScore >= 40 ? 'fair' : 'poor');

        // Build breakdown with BOTH naming conventions for Results page compatibility
        const techScore = Math.round(geminiAnalysis.technical || 0);
        const grammarScore = Math.round(geminiAnalysis.grammar || 0);
        const accentScore = Math.round(geminiAnalysis.accent || 0);
        const confScore = Math.round(geminiAnalysis.confidence || 0);

        console.log(`✅ Score: ${finalScore} (from Gemini, local was ${localResult.score})`);

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
        // STEP 5: Server call failed — return local score
        // ══════════════════════════════════════════════════════════
        console.error('Gemini server proxy failed — using local score:', error.message);
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

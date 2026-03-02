import { GoogleGenerativeAI } from "@google/generative-ai";
import { behaviorBaseline, technicalKnowledgeBase, evaluationRubric } from "../data/referenceKnowledge";

export const analyzeContent = async (apiKey, question, idealAnswer, transcript, emotions, telemetry) => {
    if (!apiKey || apiKey.length < 20) {
        throw new Error("Invalid API Key");
    }

    // CRITICAL: Check for empty answer BEFORE calling AI
    const cleanedTranscript = transcript ? transcript.trim() : '';
    if (!cleanedTranscript || cleanedTranscript.length === 0) {
        console.log('🚫 Empty answer detected in AI analysis - returning 0 score immediately');
        return {
            score: 0,
            feedback: `You were asked: "${question}"\n\n❌ ** No answer provided.** Silence cannot be scored.\n\n ** Ideal Answer **: ${idealAnswer} `,
            ideal_answer: idealAnswer,
            status: "poor",
            breakdown: { technical: 0, communication: 0, depth: 0 },
            improvement_points: [
                "Provide an answer before stopping the recording",
                "Review the ideal answer above",
                "Ensure your microphone is working or use text input"
            ]
        };
    }

    if (!transcript || transcript.trim().length < 5) {
        return {
            score: 0,
            feedback: `You were asked: "${question}"\n\n❌ **No meaningful answer provided.** Your response was too short to evaluate.\n\n**Ideal Answer**: ${idealAnswer}`,
            ideal_answer: idealAnswer,
            status: 'poor',
            breakdown: { technical: 0, communication: 0, depth: 0 },
            improvement_points: ['Provide a complete answer', 'Review the ideal answer above']
        };
    }

    // Initialize Gemini with JSON mode enforced
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    // Construct Context
    const dominantEmotion = emotions?.dominant || "Unknown";
    const emotionHistory = JSON.stringify(emotions?.history || {});
    // Default telemetry if missing (removed destructuring as prompt now uses optional chaining directly)

    const prompt = `
    You are a Senior Technical Interviewer with advanced semantic understanding.Your primary goal is to evaluate conceptual understanding, not keyword matching.
    
    THE QUESTION YOU ASKED:
"${question}"
    
    IDEAL ANSWER(Reference for concepts, NOT exact wording required):
"${idealAnswer}"
    
    CANDIDATE'S ANSWER (Evaluate the MEANING, not exact words):
"${transcript}"
    
    TELEMETRY DATA:
- Words Per Minute: ${telemetry?.wordsPerMinute || 0} (Ideal: 120-150)
- Visual Engagement: ${telemetry?.eyeContact || 0}% (Aim for consistent focus)
    - Emotions: ${telemetry?.emotions || 'none'}
- Filler Words: ${telemetry?.fillerCount || 0}

CRITICAL: SEMANTIC EQUIVALENCE EVALUATION INSTRUCTIONS
    
    YOUR PRIMARY TASK: Understand MEANING, not match KEYWORDS
    
    Humans explain concepts in many different ways.Your job is to recognize when someone understands a concept even if they use completely different words.
    
    EXAMPLES OF SEMANTIC EQUIVALENCE:

Question: "Explain the Virtual DOM"
    
    Ideal Answer: "The Virtual DOM is a lightweight, in-memory representation of the real DOM..."
    
    THESE ARE ALL CORRECT(even with different words):
- "React keeps a copy of the DOM in memory and compares it to find changes"(85 - 90 points)
    - "It's like a JavaScript version of the real DOM that React uses to track updates"(80 - 85 points)
    - "React maintains a virtual tree structure and uses diffing to optimize rendering"(90 - 95 points)
    - "In-memory representation that gets compared with the actual DOM"(75 - 80 points)
    
    THESE ARE INCORRECT(even if they use keywords):
- "Virtual DOM makes React faster"(20 - 30 points - too vague, doesn't explain HOW)
    - "React uses Virtual DOM for styling"(10 - 20 points - wrong purpose)
    - "Virtual DOM is better than real DOM"(15 - 25 points - doesn't explain what it is)
    
    EVALUATION FRAMEWORK:

        1. CONCEPTUAL UNDERSTANDING(60 points - MOST IMPORTANT)
       
       Extract the KEY CONCEPTS from the ideal answer:
        - What are the 3 - 5 core ideas that MUST be understood ?
        - Did the candidate explain these concepts(in ANY words) ?

        GIVE CREDIT FOR:
        - Paraphrasing(saying the same thing differently)
        - Using simpler language that shows understanding
    - Explaining with analogies or examples
        - Different technical terms that mean the same thing
            - Explaining the "why" or "how" even if wording differs
       
       DON'T GIVE CREDIT FOR:
    - Using keywords without understanding
        - Vague statements that could apply to anything
            - Talking about related but different concepts
                - Repeating the question without adding value

2. COMPLETENESS(25 points)

    - Did they cover ALL major concepts from the ideal answer ?
        - Or just 1 - 2 out of 4 - 5 key points ?
            - Is the explanation comprehensive or superficial ?

                3. ACCURACY(15 points)

                    - Is the information factually correct ?
                        - Any technical errors or misconceptions ?
                            - HEAVILY penalize incorrect information

4. COMMUNICATION(Bonus / Penalty)

    - Clear explanation: +5 points
        - Examples provided: +5 points
            - Poor communication(telemetry): -5 to - 10 points

5. ACTIONABLE IMPROVEMENT PLAN(Critical)

    - Provide 3 specific, technical steps to improve.
       - USE EXACT TERMS to study(e.g., "React.memo", "Index Scan vs Seq Scan", "Flexbox gap property").
       - AVOID generic advice like "study more" or "practice".
       - Be a tough but encouraging technical coach.

    SCORING RUBRIC(SEMANTIC UNDERSTANDING FOCUSED):

90 - 100(Excellent):
- Demonstrates DEEP understanding of ALL key concepts
    - May use different words, but meaning is equivalent
        - Explains the "how" and "why", not just "what"
            - Factually accurate

70 - 89(Good):
- Understands MOST key concepts(3 - 4 out of 5)
    - Explanation shows comprehension even if incomplete
        - Minor gaps but core understanding is solid

50 - 69(Fair):
- Understands SOME concepts(2 out of 5)
    - Partial explanation that shows basic awareness
        - Missing critical components

30 - 49(Poor):
- Understands MINIMAL concepts(1 out of 5)
    - Vague or tangential answer
        - Talks about the topic but doesn't answer the question

0 - 29(Very Poor):
- No understanding demonstrated
    - Off - topic, incorrect, or non - answer

    FORMAT YOUR RESPONSE AS JSON:
{
    "score": < 0 - 100 >,
        "feedback": "<The friendly, coaching feedback>",
            "improvement_points": ["<Specific Step 1>", "<Specific Step 2>", "<Specific Step 3>"],
                "status": "<excellent|good|fair|poor>",
                    "ideal_answer": "<A perfect, concise technical answer>"
}
- Word salad or gibberish

STEP - BY - STEP EVALUATION PROCESS:
    
    STEP 1: Extract key concepts from ideal answer
    STEP 2: Check if candidate explained each concept(in ANY words)
    STEP 3: Score based on HOW MANY concepts they understood
    STEP 4: Verify factual accuracy
    STEP 5: Generate specific feedback
    
    OUTPUT FORMAT(JSON ONLY):
{
    "score": number(0 - 100, reward semantic understanding, not keywords),
        "feedback": "Provide clear, structured feedback in plain text. Start with what the question was asking for, then explain which concepts they understood and which they missed. Be specific about what was good and what needs improvement. Use simple bullet points with dashes, not special symbols.",
            "improvement_points": [
                "Specific missing concept from ideal answer",
                "Another missing concept",
                "Suggestion for improvement"
            ],
                "ideal_answer": "${idealAnswer}",
                    "status": "excellent|good|fair|poor",
                        "breakdown": {
        "technical": number(0 - 100, conceptual understanding),
            "communication": number(0 - 100, clarity and delivery),
                "depth": number(0 - 100, completeness of explanation)
    },
    "concepts_covered": ["concept they explained (even in own words)", "another concept"],
        "concepts_missing": ["concept from ideal answer they didn't cover", "another missing"],
            "is_relevant": boolean(Did they answer THIS question ?),
                "confidence": number(0 - 100, your confidence in this evaluation),
                    "question_asked": "${question}",
                        "semantic_equivalence_score": number(0 - 100, how semantically similar to ideal answer)
}

IMPORTANT: In your feedback output, do NOT use any markdown symbols like asterisks, hashtags, or special emoji characters.Use plain text with simple dashes for bullet points.Keep the feedback clean and professional.

    REMEMBER: Reward UNDERSTANDING, not MEMORIZATION
        `;

    try {
        // Create a timeout promise (30 seconds for better reliability)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), 30000)
        );

        // Race the API call against the timeout
        const result = await Promise.race([
            model.generateContent(prompt),
            timeoutPromise
        ]);

        const response = await result.response;
        const text = response.text();

        // Robust JSON extraction - find first { and last }
        let jsonText = text.trim();

        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\n ? /g, '').replace(/```/g, '').trim();

        // Extract JSON object from text (handles cases with extra surrounding text)
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        }

        try {
            const parsed = JSON.parse(jsonText);

            // CRITICAL: Ensure ideal_answer is always present
            // If AI didn't return it, use the original idealAnswer parameter
            if (!parsed.ideal_answer) {
                parsed.ideal_answer = idealAnswer;
            }

            return parsed;
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "\nRaw text:", text);
            // Fallback: return a structured error response
            return {
                score: 50,
                feedback: "AI analysis completed but formatting was invalid. Your answer was recorded.",
                ideal_answer: idealAnswer, // Always include ideal answer
                status: "fair",
                breakdown: { technical: 50, communication: 50, depth: 50 },
                improvement_points: ["Unable to parse detailed feedback"]
            };
        }

    } catch (error) {
        console.error("Gemini Error:", error);
        return {
            score: 0,
            feedback: error.message.includes("timed out")
                ? "Analysis timed out after 30s. Please check your internet connection."
                : "AI Error: " + (error.message || "Failed to generate response"),
            ideal_answer: idealAnswer, // Always include ideal answer, even on error
            status: "warning",
            breakdown: { technical: 0, communication: 0, depth: 0 },
            improvement_points: ["Review the ideal answer above", "Try again with a stable connection"]
        };
    }
};

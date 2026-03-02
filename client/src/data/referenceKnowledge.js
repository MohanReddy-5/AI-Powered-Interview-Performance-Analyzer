export const behaviorBaseline = {
    ideal_emotions: ["Neutral", "Happy"],
    warning_emotions: ["Fear", "Sadness", "Angry", "Disgusted"],
    voice_metrics: {
        ideal_pace: "130-150 words per minute",
        filler_limit: "less than 3% of total words"
    }
};

export const technicalKnowledgeBase = [
    {
        topic: "React",
        concept: "Virtual DOM",
        ideal_points: ["In-memory representation of DOM", "Reconciliation process", "Diffing algorithm", "Minimizes direct DOM manipulation"],
        senior_insight: "Mention that VDOM overhead is worth it for developer experience and predictable state, even if raw WASM might be faster in edge cases."
    },
    {
        topic: "System Design",
        concept: "Scalability",
        ideal_points: ["Horizontal vs Vertical scaling", "Load Balancing", "Database Sharding", "Caching strategies (Redis/CDN)"],
        senior_insight: "Always discuss trade-offs (CAP theorem) rather than just listing technologies."
    },
    {
        topic: "Behavioral",
        concept: "Conflict Resolution",
        ideal_points: ["STAR Method", "Empathy", "Data-driven resolution", "Company goals alignment"],
        senior_insight: "Focus on the 'Result' and what you learned. Don't blame others."
    }
];

export const evaluationRubric = `
    1. **Accuracy**: Does the answer align with the "technicalKnowledgeBase"?
    2. **Multimodal Coherence**: Do the candidate's facial expressions match their words? (e.g. Talking about a success with a "Sad" face is a mismatch).
    3. **Confidence**: Is the "Fear" emotion under 10%?
`;

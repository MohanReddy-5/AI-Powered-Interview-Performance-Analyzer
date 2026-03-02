/**
 * Intent Analyzer
 * Understands WHAT the user is trying to explain
 * Analyzes the type of explanation and concepts being discussed
 */

/**
 * Analyze the intent behind the user's answer
 * @param {string} userAnswer - What the user said
 * @param {string} question - The question asked
 * @returns {Object} - Intent analysis results
 */
export const analyzeIntent = (userAnswer, question) => {
    if (!userAnswer || userAnswer.length < 10) {
        return {
            explanationTypes: [],
            conceptCategories: [],
            confidence: 0,
            intent: 'unclear'
        };
    }

    const answer = userAnswer.toLowerCase();

    // 1. EXPLANATION TYPES - What kind of explanation are they giving?
    const explanationTypes = [];

    const explanationPatterns = {
        definition: {
            patterns: [
                /\b(is|are|means?|refers? to|called|known as)\b/i,
                /\b(basically|essentially|simply put)\b/i,
                /\b(definition|defined as)\b/i
            ],
            weight: 1.0
        },
        process: {
            patterns: [
                /\b(first|then|next|after|before|finally)\b/i,
                /\b(when.*happens?|if.*then)\b/i,
                /\b(steps?|process|procedure|workflow)\b/i,
                /\b(starts?|begins?|ends?|finishes?)\b/i
            ],
            weight: 1.2
        },
        comparison: {
            patterns: [
                /\b(versus|vs|compared to|unlike|different from)\b/i,
                /\b(difference|contrast|similar|same)\b/i,
                /\b(better|worse|faster|slower)\b/i,
                /\b(instead of|rather than|as opposed to)\b/i
            ],
            weight: 1.1
        },
        benefit: {
            patterns: [
                /\b(advantage|benefit|helps?|improves?|better)\b/i,
                /\b(useful|good for|great for|perfect for)\b/i,
                /\b(solves?|fixes?|prevents?|avoids?)\b/i,
                /\b(faster|efficient|optimiz)/i
            ],
            weight: 0.8
        },
        example: {
            patterns: [
                /\b(for example|for instance|such as|like)\b/i,
                /\b(e\.g\.|i\.e\.|example:|imagine)\b/i,
                /\b(let's say|suppose|consider)\b/i,
                /\b(function|const|let|var|class)\s+\w+/i
            ],
            weight: 0.9
        },
        mechanism: {
            patterns: [
                /\b(how it works?|works? by|mechanism|under the hood)\b/i,
                /\b(internally|behind the scenes)\b/i,
                /\b(creates?|generates?|produces?|builds?)\b/i,
                /\b(uses?|utilizes?|employs?|leverages?)\b/i
            ],
            weight: 1.3
        },
        use_case: {
            patterns: [
                /\b(used? (for|when|in)|useful when)\b/i,
                /\b(scenario|situation|case|context)\b/i,
                /\b(should use|would use|can use)\b/i
            ],
            weight: 0.7
        }
    };

    for (const [type, { patterns, weight }] of Object.entries(explanationPatterns)) {
        let matchCount = 0;
        for (const pattern of patterns) {
            if (pattern.test(answer)) {
                matchCount++;
            }
        }
        if (matchCount > 0) {
            explanationTypes.push({ type, confidence: Math.min(1.0, matchCount * 0.3 * weight) });
        }
    }

    // 2. CONCEPT CATEGORIES - What technical concepts are they discussing?
    const conceptCategories = [];

    const conceptPatterns = {
        performance: {
            patterns: [
                /\b(fast|slow|speed|performance|efficient|optimize)/i,
                /\b(quick|rapid|delay|lag|responsive)/i,
                /\b(reduce|minimize|improve|enhance)/i,
                /\b(bottleneck|overhead|cost)/i
            ],
            weight: 1.0
        },
        data_management: {
            patterns: [
                /\b(store|save|keep|persist|cache)/i,
                /\b(data|information|values?|state)/i,
                /\b(retrieve|fetch|get|load)/i,
                /\b(database|storage|memory)/i
            ],
            weight: 1.0
        },
        process_flow: {
            patterns: [
                /\b(compare|check|verify|validate)/i,
                /\b(update|change|modify|alter|transform)/i,
                /\b(create|generate|build|construct)/i,
                /\b(delete|remove|destroy|clean)/i
            ],
            weight: 1.0
        },
        architecture: {
            patterns: [
                /\b(structure|organize|design|pattern|architecture)/i,
                /\b(component|module|layer|tier)/i,
                /\b(separate|decouple|isolate)/i,
                /\b(system|framework|library)/i
            ],
            weight: 1.0
        },
        async_operations: {
            patterns: [
                /\b(async|asynchronous|await|promise)/i,
                /\b(callback|then|catch|finally)/i,
                /\b(non-blocking|concurrent|parallel)/i,
                /\b(background|queue|event)/i
            ],
            weight: 1.0
        },
        state_management: {
            patterns: [
                /\b(state|props|context)/i,
                /\b(immutable|mutable|readonly)/i,
                /\b(update|set|get|change)/i,
                /\b(redux|mobx|zustand)/i
            ],
            weight: 1.0
        },
        dom_manipulation: {
            patterns: [
                /\b(dom|element|node|tree)/i,
                /\b(render|paint|reflow|repaint)/i,
                /\b(browser|document|window)/i,
                /\b(virtual|real|actual)/i
            ],
            weight: 1.0
        },
        scope_closure: {
            patterns: [
                /\b(scope|closure|lexical)/i,
                /\b(outer|inner|parent|child)/i,
                /\b(variable|function|context)/i,
                /\b(access|remember|retain|maintain)/i
            ],
            weight: 1.0
        }
    };

    for (const [category, { patterns, weight }] of Object.entries(conceptPatterns)) {
        let matchCount = 0;
        for (const pattern of patterns) {
            if (pattern.test(answer)) {
                matchCount++;
            }
        }
        if (matchCount > 0) {
            conceptCategories.push({
                category,
                confidence: Math.min(1.0, matchCount * 0.25 * weight),
                matchCount
            });
        }
    }

    // 3. DETERMINE PRIMARY INTENT
    let primaryIntent = 'unclear';

    if (explanationTypes.length > 0) {
        // Sort by confidence
        explanationTypes.sort((a, b) => b.confidence - a.confidence);
        primaryIntent = explanationTypes[0].type;
    }

    // 4. CALCULATE OVERALL CONFIDENCE
    const totalMatches = explanationTypes.length + conceptCategories.length;
    const avgConfidence = totalMatches > 0
        ? (explanationTypes.reduce((sum, e) => sum + e.confidence, 0) +
            conceptCategories.reduce((sum, c) => sum + c.confidence, 0)) / totalMatches
        : 0;

    // 5. DETERMINE ANSWER COMPLETENESS
    const hasDefinition = explanationTypes.some(e => e.type === 'definition');
    const hasMechanism = explanationTypes.some(e => e.type === 'mechanism' || e.type === 'process');
    const hasBenefit = explanationTypes.some(e => e.type === 'benefit');
    const hasExample = explanationTypes.some(e => e.type === 'example');

    let completeness = 'minimal';
    if (hasDefinition && hasMechanism && (hasBenefit || hasExample)) {
        completeness = 'comprehensive';
    } else if ((hasDefinition && hasMechanism) || (hasMechanism && hasBenefit)) {
        completeness = 'good';
    } else if (hasDefinition || hasMechanism) {
        completeness = 'basic';
    }

    return {
        explanationTypes,
        conceptCategories,
        primaryIntent,
        confidence: avgConfidence,
        completeness,
        hasDefinition,
        hasMechanism,
        hasBenefit,
        hasExample,
        answerLength: userAnswer.split(/\s+/).length
    };
};

/**
 * Match intent with question requirements
 * @param {Object} intent - Intent analysis results
 * @param {string} question - The question asked
 * @returns {Object} - Match analysis
 */
export const matchIntentWithQuestion = (intent, question) => {
    const q = question.toLowerCase();

    // Determine what the question is asking for
    const questionRequirements = {
        needsDefinition: /\b(what is|what are|define|what does.*mean)\b/i.test(q),
        needsMechanism: /\b(how does|how do|explain.*work|describe.*process)\b/i.test(q),
        needsComparison: /\b(difference|compare|versus|vs)\b/i.test(q),
        needsBenefit: /\b(benefit|advantage|why use|when to use)\b/i.test(q),
        needsExample: /\b(example|give.*example|provide.*example)\b/i.test(q)
    };

    // Check if intent matches requirements
    const matches = {
        definition: questionRequirements.needsDefinition && intent.hasDefinition,
        mechanism: questionRequirements.needsMechanism && intent.hasMechanism,
        comparison: questionRequirements.needsComparison && intent.explanationTypes.some(e => e.type === 'comparison'),
        benefit: questionRequirements.needsBenefit && intent.hasBenefit,
        example: questionRequirements.needsExample && intent.hasExample
    };

    const totalRequired = Object.values(questionRequirements).filter(Boolean).length;
    const totalMatched = Object.values(matches).filter(Boolean).length;

    const matchScore = totalRequired > 0 ? totalMatched / totalRequired : 0.5;

    // Determine missing elements
    const missing = [];
    if (questionRequirements.needsDefinition && !intent.hasDefinition) missing.push('definition');
    if (questionRequirements.needsMechanism && !intent.hasMechanism) missing.push('mechanism/process');
    if (questionRequirements.needsComparison && !matches.comparison) missing.push('comparison');
    if (questionRequirements.needsBenefit && !intent.hasBenefit) missing.push('benefits');
    if (questionRequirements.needsExample && !intent.hasExample) missing.push('examples');

    return {
        matchScore,
        matches,
        missing,
        questionRequirements,
        intentAligned: matchScore >= 0.7
    };
};

/**
 * Generate intent-based feedback
 * @param {Object} intent - Intent analysis
 * @param {Object} match - Match analysis
 * @param {string} question - The question
 * @returns {string} - Feedback
 */
export const generateIntentFeedback = (intent, match, question) => {
    let feedback = `You were asked: "${question}"\n\n`;

    if (intent.confidence < 0.3) {
        feedback += `⚠️ Your answer lacks clear structure. Try to organize your thoughts and provide a coherent explanation.\n\n`;
        return feedback;
    }

    // Positive feedback
    if (match.matchScore >= 0.7) {
        feedback += `✅ Your answer addresses what the question asked for (${intent.primaryIntent}).\n\n`;
    } else {
        feedback += `⚠️ Your answer type (${intent.primaryIntent}) doesn't fully match what this question requires.\n\n`;
    }

    // Missing elements
    if (match.missing.length > 0) {
        feedback += `❌ This question requires you to provide: ${match.missing.join(', ')}.\n\n`;
    }

    // Completeness feedback
    if (intent.completeness === 'comprehensive') {
        feedback += `✅ Your answer is comprehensive with definition, mechanism, and examples.\n\n`;
    } else if (intent.completeness === 'good') {
        feedback += `Good structure, but could be more complete.\n\n`;
    } else {
        feedback += `Your answer is too basic. Provide more depth and detail.\n\n`;
    }

    return feedback;
};

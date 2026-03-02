/**
 * Semantic Reasoner
 * Reasons about conceptual equivalence - the BRAIN of the system
 * Understands that different words can mean the same thing
 */

/**
 * Comprehensive conceptual equivalence database
 * Maps concepts to all the ways humans might express them
 */
const CONCEPTUAL_EQUIVALENCE = {
    // Virtual DOM concepts
    'in-memory representation': {
        equivalents: [
            'javascript copy', 'js copy', 'memory copy', 'copy in memory',
            'javascript version', 'js version', 'memory version',
            'javascript object', 'js object', 'object in memory',
            'lightweight copy', 'virtual copy', 'abstract copy',
            'keeps in memory', 'stores in memory', 'holds in memory',
            'doesn\'t touch real dom', 'separate from real dom',
            'not the actual dom', 'not the real dom'
        ],
        core_meaning: 'A duplicate structure stored in memory, not the actual DOM'
    },

    'reconciliation': {
        equivalents: [
            'diffing', 'diff algorithm', 'comparison', 'comparing',
            'checks what changed', 'finds changes', 'finds differences',
            'figures out what changed', 'sees what\'s different',
            'compares old and new', 'compares versions',
            'identifies changes', 'detects changes', 'spots differences'
        ],
        core_meaning: 'Process of comparing two versions to find differences'
    },

    'selective updates': {
        equivalents: [
            'only updates what changed', 'updates specific parts',
            'updates only differences', 'partial updates',
            'targeted updates', 'minimal updates',
            'doesn\'t update everything', 'avoids full updates',
            'updates changed parts only', 'smart updates'
        ],
        core_meaning: 'Updating only the parts that changed, not everything'
    },

    'reduces reflows': {
        equivalents: [
            'less browser work', 'browser works less',
            'fewer dom manipulations', 'less dom work',
            'minimizes rendering', 'reduces rendering',
            'batches updates', 'groups updates',
            'more efficient', 'faster updates', 'optimized updates'
        ],
        core_meaning: 'Minimizing expensive browser rendering operations'
    },

    // Closure concepts
    'lexical scope': {
        equivalents: [
            'outer scope', 'parent scope', 'enclosing scope',
            'scope from outside', 'surrounding scope',
            'scope where defined', 'scope of creation',
            'variables from outside', 'outer variables',
            'parent function scope', 'enclosing function'
        ],
        core_meaning: 'The scope in which a function was defined'
    },

    'remembers variables': {
        equivalents: [
            'keeps access', 'retains access', 'maintains access',
            'still has access', 'can still use', 'can still access',
            'holds reference', 'keeps reference', 'maintains reference',
            'doesn\'t forget', 'preserves access',
            'continues to access', 'access persists'
        ],
        core_meaning: 'Function maintains access to variables after outer function returns'
    },

    // Async concepts
    'non-blocking': {
        equivalents: [
            'doesn\'t wait', 'doesn\'t block', 'asynchronous',
            'continues executing', 'keeps running',
            'runs in background', 'parallel execution',
            'doesn\'t stop', 'doesn\'t pause',
            'concurrent', 'simultaneous'
        ],
        core_meaning: 'Code continues executing without waiting'
    },

    'event loop': {
        equivalents: [
            'callback queue', 'task queue', 'message queue',
            'handles async', 'manages async', 'processes callbacks',
            'event system', 'async handler',
            'continuously checks', 'keeps checking'
        ],
        core_meaning: 'Mechanism that handles asynchronous operations'
    },

    // State concepts
    'immutable': {
        equivalents: [
            'cannot change', 'can\'t change', 'unchangeable',
            'read-only', 'readonly', 'constant',
            'fixed', 'permanent', 'static',
            'doesn\'t mutate', 'no mutation',
            'create new instead', 'replace not modify'
        ],
        core_meaning: 'Data that cannot be modified after creation'
    },

    // Performance concepts
    'optimization': {
        equivalents: [
            'improve performance', 'make faster', 'speed up',
            'more efficient', 'better performance',
            'reduce time', 'decrease time', 'quicker',
            'enhance speed', 'boost performance'
        ],
        core_meaning: 'Making something perform better or faster'
    },

    // Database concepts
    'data integrity': {
        equivalents: [
            'data safety', 'data correctness', 'data accuracy',
            'prevents corruption', 'ensures correctness',
            'maintains consistency', 'keeps data safe',
            'data doesn\'t get lost', 'data reliability',
            'trustworthy data', 'accurate data'
        ],
        core_meaning: 'Ensuring data remains accurate and uncorrupted'
    },

    'horizontal scaling': {
        equivalents: [
            'add more servers', 'more machines', 'more instances',
            'scale out', 'distribute across servers',
            'multiple servers', 'server cluster',
            'add capacity', 'more nodes'
        ],
        core_meaning: 'Adding more machines to handle load'
    },

    'vertical scaling': {
        equivalents: [
            'add more resources', 'bigger server', 'more powerful',
            'scale up', 'upgrade hardware',
            'more cpu', 'more memory', 'more ram',
            'increase capacity', 'beefier server'
        ],
        core_meaning: 'Making a single machine more powerful'
    }
};

/**
 * Reason about whether two concepts are equivalent
 * This is the CORE intelligence of the system
 * @param {string} userConcept - What the user said
 * @param {string} idealConcept - What the ideal answer says
 * @returns {Object} - Equivalence analysis
 */
export const reasonAboutEquivalence = (userConcept, idealConcept) => {
    if (!userConcept || !idealConcept) {
        return { equivalent: false, confidence: 0, reason: 'Missing input' };
    }

    const userLower = userConcept.toLowerCase().trim();
    const idealLower = idealConcept.toLowerCase().trim();

    // 1. EXACT MATCH
    if (userLower === idealLower) {
        return {
            equivalent: true,
            confidence: 1.0,
            reason: 'Exact match',
            method: 'exact'
        };
    }

    // 2. SUBSTRING MATCH (one contains the other)
    if (userLower.includes(idealLower) || idealLower.includes(userLower)) {
        return {
            equivalent: true,
            confidence: 0.95,
            reason: 'Direct substring match',
            method: 'substring'
        };
    }

    // 3. CONCEPTUAL EQUIVALENCE (the smart part!)
    for (const [concept, { equivalents, core_meaning }] of Object.entries(CONCEPTUAL_EQUIVALENCE)) {
        const conceptLower = concept.toLowerCase();

        // Check if ideal concept matches this canonical concept
        const idealMatchesConcept =
            idealLower.includes(conceptLower) ||
            conceptLower.includes(idealLower) ||
            equivalents.some(eq => idealLower.includes(eq.toLowerCase()));

        // Check if user concept matches this canonical concept
        const userMatchesConcept =
            userLower.includes(conceptLower) ||
            conceptLower.includes(userLower) ||
            equivalents.some(eq => userLower.includes(eq.toLowerCase()));

        // If BOTH match the same canonical concept, they're equivalent!
        if (idealMatchesConcept && userMatchesConcept) {
            return {
                equivalent: true,
                confidence: 0.90,
                reason: `Both refer to: ${core_meaning}`,
                canonicalConcept: concept,
                method: 'conceptual'
            };
        }
    }

    // 4. WORD OVERLAP ANALYSIS
    const userWords = userLower.split(/\s+/).filter(w => w.length > 3);
    const idealWords = idealLower.split(/\s+/).filter(w => w.length > 3);

    const commonWords = userWords.filter(uw =>
        idealWords.some(iw => uw.includes(iw) || iw.includes(uw))
    );

    const overlapRatio = commonWords.length / Math.max(userWords.length, idealWords.length);

    if (overlapRatio > 0.6) {
        return {
            equivalent: true,
            confidence: 0.70 + (overlapRatio * 0.2),
            reason: `High word overlap (${Math.round(overlapRatio * 100)}%)`,
            method: 'word_overlap'
        };
    }

    // 5. SEMANTIC SIMILARITY (last resort)
    const similarity = calculateSemanticSimilarity(userLower, idealLower);

    if (similarity > 0.65) {
        return {
            equivalent: true,
            confidence: similarity,
            reason: `Semantic similarity: ${Math.round(similarity * 100)}%`,
            method: 'semantic'
        };
    }

    // NOT EQUIVALENT
    return {
        equivalent: false,
        confidence: similarity,
        reason: 'Concepts do not match',
        method: 'none'
    };
};

/**
 * Calculate semantic similarity between two phrases
 * @param {string} phrase1 
 * @param {string} phrase2 
 * @returns {number} - Similarity score 0-1
 */
const calculateSemanticSimilarity = (phrase1, phrase2) => {
    // Tokenize
    const tokens1 = phrase1.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    const tokens2 = phrase2.toLowerCase().split(/\W+/).filter(t => t.length > 2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Calculate Jaccard similarity
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
};

/**
 * Analyze a full answer against ideal concepts
 * @param {string} userAnswer - User's full answer
 * @param {Array} idealConcepts - Array of ideal concepts
 * @returns {Object} - Comprehensive analysis
 */
export const analyzeConceptualEquivalence = (userAnswer, idealConcepts) => {
    const results = [];
    const userLower = userAnswer.toLowerCase();

    for (const idealConcept of idealConcepts) {
        // Try to find this concept in the user's answer
        let bestMatch = { equivalent: false, confidence: 0 };

        // Check direct mention
        if (userLower.includes(idealConcept.toLowerCase())) {
            bestMatch = {
                equivalent: true,
                confidence: 1.0,
                reason: 'Direct mention',
                method: 'exact'
            };
        } else {
            // Check conceptual equivalence
            const equivalence = reasonAboutEquivalence(userAnswer, idealConcept);
            if (equivalence.equivalent) {
                bestMatch = equivalence;
            }
        }

        results.push({
            idealConcept,
            ...bestMatch
        });
    }

    // Calculate overall statistics
    const understood = results.filter(r => r.equivalent);
    const missing = results.filter(r => !r.equivalent);

    const avgConfidence = understood.length > 0
        ? understood.reduce((sum, r) => sum + r.confidence, 0) / understood.length
        : 0;

    return {
        results,
        understood: understood.map(r => r.idealConcept),
        missing: missing.map(r => r.idealConcept),
        understandingScore: understood.length / idealConcepts.length,
        avgConfidence,
        totalConcepts: idealConcepts.length,
        conceptsCovered: understood.length
    };
};

/**
 * Extract what the user is actually trying to say
 * @param {string} userAnswer 
 * @returns {Array} - Concepts the user is expressing
 */
export const extractUserConcepts = (userAnswer) => {
    const concepts = [];
    const answer = userAnswer.toLowerCase();

    // Check against all known concepts
    for (const [concept, { equivalents, core_meaning }] of Object.entries(CONCEPTUAL_EQUIVALENCE)) {
        // Check if user mentioned this concept (in any form)
        const mentioned =
            answer.includes(concept.toLowerCase()) ||
            equivalents.some(eq => answer.includes(eq.toLowerCase()));

        if (mentioned) {
            concepts.push({
                concept,
                coreMeaning: core_meaning,
                confidence: 0.85
            });
        }
    }

    return concepts;
};

/**
 * Generate reasoning-based feedback
 * @param {Object} analysis - Conceptual equivalence analysis
 * @param {string} question 
 * @returns {string} - Feedback
 */
export const generateReasoningFeedback = (analysis, question) => {
    let feedback = `You were asked: "${question}"\n\n`;

    if (analysis.understood.length > 0) {
        feedback += `✅ **Concepts You Understood** (even if you used different words):\n`;
        analysis.results
            .filter(r => r.equivalent)
            .forEach(r => {
                feedback += `   • ${r.idealConcept}`;
                if (r.reason && r.method === 'conceptual') {
                    feedback += ` - ${r.reason}`;
                }
                feedback += `\n`;
            });
        feedback += `\n`;
    }

    if (analysis.missing.length > 0) {
        feedback += `❌ **Concepts You Missed**:\n`;
        analysis.missing.forEach(concept => {
            feedback += `   • ${concept}\n`;

            // Provide hints about what this means
            const conceptData = CONCEPTUAL_EQUIVALENCE[concept.toLowerCase()];
            if (conceptData) {
                feedback += `     (Meaning: ${conceptData.core_meaning})\n`;
            }
        });
        feedback += `\n`;
    }

    // Overall assessment
    if (analysis.understandingScore >= 0.8) {
        feedback += `🎉 Excellent! You demonstrated strong understanding of the core concepts, even though you explained them in your own words.`;
    } else if (analysis.understandingScore >= 0.6) {
        feedback += `👍 Good understanding of most concepts. Review the missing ones to improve further.`;
    } else if (analysis.understandingScore >= 0.4) {
        feedback += `⚠️ Partial understanding. You got some concepts but missed several important ones.`;
    } else {
        feedback += `❌ Limited understanding. Please review the ideal answer and study the core concepts.`;
    }

    return feedback;
};

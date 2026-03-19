/**
 * Semantic Reasoner
 * Reasons about conceptual equivalence - the BRAIN of the system
 * Understands that different words can mean the same thing
 */

/**
 * Comprehensive conceptual equivalence database — EXPANDED
 * Maps 38 key concepts to all the ways humans might express them.
 * This is the core intelligence: recognizing paraphrased/informal correct answers.
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
    },

    // Promise / async-await
    'promise chaining': {
        equivalents: [
            '.then()', 'then chain', 'chain of thens',
            'then and catch', 'promise chain', 'chained promises',
            'sequential async', 'async operations in sequence',
            'one after another', 'after the promise resolves'
        ],
        core_meaning: 'Executing async operations sequentially using .then()'
    },

    'async await': {
        equivalents: [
            'async function', 'await keyword', 'async/await',
            'write async like sync', 'looks like synchronous',
            'wait for promise', 'pause execution', 'syntactic sugar',
            'cleaner than promises', 'easier to read'
        ],
        core_meaning: 'Syntax for writing asynchronous code that looks synchronous'
    },

    // React hooks
    'useState hook': {
        equivalents: [
            'usestate', 'useState', 'managing component state',
            'state variable', 'state and setter', 'reactive variable',
            'triggers re-render', 'causes re-render', 'updates component',
            'local component state', 'component-level state'
        ],
        core_meaning: 'React hook for managing local component state'
    },

    'useEffect hook': {
        equivalents: [
            'useeffect', 'useEffect', 'side effects in react',
            'after render', 'runs after render', 'after mount',
            'lifecycle equivalent', 'componentdidmount equivalent',
            'fetching data hook', 'subscriptions hook',
            'cleanup function', 'dependency array'
        ],
        core_meaning: 'React hook for performing side effects after render'
    },

    'memoization': {
        equivalents: [
            'caching result', 'caches result', 'cached output',
            'remember previous result', 'stores previous output',
            'avoids recalculation', 'skip recalculation',
            'only recalculates when inputs change', 'usememo',
            'pure function caching', 'result caching'
        ],
        core_meaning: 'Caching the result of an expensive function call'
    },

    'lazy loading': {
        equivalents: [
            'load on demand', 'deferred loading', 'doesn\'t load upfront',
            'load when needed', 'split the bundle',
            'not loaded initially', 'loaded when accessed',
            'code splitting', 'dynamic import', 'on-demand loading'
        ],
        core_meaning: 'Loading resources only when they are needed'
    },

    // JavaScript concepts
    'hoisting': {
        equivalents: [
            'moved to top', 'declaration moved up', 'available before line',
            'function available anywhere', 'variable declaration raised',
            'javascript moves declarations', 'compiled phase',
            'before execution', 'declaration phase'
        ],
        core_meaning: 'JavaScript moves declarations to the top of their scope'
    },

    'prototype chain': {
        equivalents: [
            'prototype inheritance', 'inherits from prototype',
            'looks up the chain', 'prototype lookup',
            '__proto__', 'object.prototype', 'inherited methods',
            'built-in methods come from', 'chain of objects',
            'object inherits from another object'
        ],
        core_meaning: 'Mechanism by which JavaScript objects inherit properties'
    },

    // Database
    'indexing': {
        equivalents: [
            'database index', 'speeds up queries', 'faster search',
            'lookup table', 'b-tree index', 'avoids full table scan',
            'query optimization', 'indexed columns', 'faster reads'
        ],
        core_meaning: 'Data structure that improves query lookup speed'
    },

    'transactions': {
        equivalents: [
            'atomic operation', 'all or nothing', 'rollback',
            'commit', 'acid', 'atomicity', 'consistency isolation durability',
            'either all succeed or all fail', 'grouped operations',
            'undone if error', 'database transaction'
        ],
        core_meaning: 'Set of database operations executed as a single unit'
    },

    // Security
    'authentication': {
        equivalents: [
            'verify identity', 'who you are', 'logging in',
            'login process', 'verify the user', 'prove who you are',
            'username and password', 'credentials check', 'sign in',
            'jwt', 'oauth', 'session token', 'access token'
        ],
        core_meaning: 'Verifying the identity of a user'
    },

    'authorization': {
        equivalents: [
            'permissions', 'access control', 'what you can do',
            'role-based', 'rbac', 'can the user do this',
            'allowed to access', 'restricted access', 'admin vs user',
            'resource permission', 'access rights'
        ],
        core_meaning: 'Determining what actions an authenticated user can perform'
    },

    // REST API
    'stateless': {
        equivalents: [
            'no server memory', 'doesn\'t remember previous requests',
            'each request is independent', 'self-contained request',
            'no session on server', 'server forgets',
            'all info in the request', 'server stores nothing',
            'independent requests'
        ],
        core_meaning: 'Each API request contains all information needed to process it'
    },

    // OOP
    'encapsulation': {
        equivalents: [
            'hiding data', 'private fields', 'data hiding',
            'internal state hidden', 'only expose what is needed',
            'bundle data and methods', 'access modifiers',
            'getter setter', 'controlled access', 'private public'
        ],
        core_meaning: 'Bundling data and restricting direct access to it'
    },

    'inheritance': {
        equivalents: [
            'extends', 'child class', 'parent class', 'base class',
            'subclass', 'superclass', 'derives from', 'inherits from',
            'gets properties from', 'parent to child', 'is-a relationship'
        ],
        core_meaning: 'A class receiving properties and methods from another class'
    },

    'polymorphism': {
        equivalents: [
            'same interface different behavior', 'method overriding',
            'overriding', 'same method name different class',
            'different implementations', 'one interface many forms',
            'duck typing', 'runtime polymorphism', 'compile-time polymorphism'
        ],
        core_meaning: 'Objects of different types responding to the same interface'
    },

    // TypeScript
    'type safety': {
        equivalents: [
            'type checking', 'catches type errors', 'prevents type bugs',
            'static typing', 'typescript benefits', 'know the type at compile time',
            'type errors caught early', 'compile-time errors', 'type annotations',
            'reduces runtime errors', 'type enforcement'
        ],
        core_meaning: 'Ensuring variables hold only values of the correct type'
    },

    // CSS
    'flexbox': {
        equivalents: [
            'flexible box', 'display flex', 'flex container',
            'flex direction', 'justify content', 'align items',
            'one dimensional layout', '1d layout', 'flex layout',
            'flexible layout', 'flex wrap'
        ],
        core_meaning: 'CSS layout model for one-dimensional flexible layouts'
    },

    'css grid': {
        equivalents: [
            'display grid', 'grid layout', 'two-dimensional layout',
            '2d layout', 'grid columns', 'grid rows', 'grid template',
            'grid areas', 'grid lines', 'grid track'
        ],
        core_meaning: 'CSS layout system for two-dimensional grid-based layouts'
    },

    // Testing
    'unit testing': {
        equivalents: [
            'testing individual functions', 'test in isolation',
            'testing small pieces', 'jest', 'mocha', 'test a single unit',
            'isolated test', 'mock dependencies', 'pure function test'
        ],
        core_meaning: 'Testing individual functions or components in isolation'
    },

    // Git
    'version control': {
        equivalents: [
            'tracking changes', 'git', 'commit history',
            'keep track of changes', 'history of code',
            'revert changes', 'branching', 'merge', 'collaborate on code',
            'source control', 'code history'
        ],
        core_meaning: 'System for tracking changes to code over time'
    },

    // Performance
    'optimization': {
        equivalents: [
            'improve performance', 'make faster', 'speed up',
            'more efficient', 'better performance',
            'reduce time', 'decrease time', 'quicker',
            'enhance speed', 'boost performance'
        ],
        core_meaning: 'Making something perform better or faster'
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

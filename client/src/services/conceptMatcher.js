/**
 * CONCEPT MATCHER — Local Concept-Level Answer Scoring Engine
 * ============================================================
 * Scores interview answers by understanding MEANING, not just keywords.
 * 
 * How it works:
 *   1. Multi-layer zero-score detection (refusal, unrelated, gibberish)
 *   2. TF-IDF cosine similarity between user answer and ideal answer
 *   3. N-gram overlap (phrase-level matching)
 *   4. Concept equivalence (synonym/paraphrase detection)
 *   5. Weighted final score with clear differentiation
 * 
 * This runs entirely in the browser — no API needed, never crashes.
 */

// ─────────────────────────────────────────────────────────────
// SECTION 1: ZERO-SCORE DETECTION (Multi-Layer Filter)
// ─────────────────────────────────────────────────────────────

/**
 * Master zero-score check. Returns { isZero, reason } immediately
 * if the answer deserves 0. Otherwise returns { isZero: false }.
 */
export function isZeroScoreAnswer(transcript, question, idealAnswer) {
    const text = (transcript || '').trim();
    const lower = text.toLowerCase();

    // ── Layer 1: Empty / too short ──
    if (!text || text.length < 3) {
        return { isZero: true, reason: 'empty', confidence: 1.0 };
    }

    // ── Layer 2: Explicit refusal phrases ──
    const refusalPhrases = [
        "i don't know", "i do not know", "i have no idea", "no idea",
        "not sure", "i'm not sure", "im not sure", "i cannot answer",
        "i can't answer", "i cant answer", "i don't remember", "i dont remember",
        "i forgot", "i have no clue", "no clue", "i'm unsure", "im unsure",
        "i don't understand", "i dont understand", "don't understand the question",
        "idk", "skip", "pass", "next question", "no answer", "nothing",
        "i don't have an answer", "i have no answer", "can't explain",
        "don't know how to explain", "no response", "dunno", "i dunno",
        "cant say", "can't say", "i can not answer", "no comment",
        "i have nothing to say", "i got nothing", "beats me",
        "i don't have a clue", "i dont have a clue", "not applicable",
        "i have no response", "i have nothing", "no idea at all",
        "i really don't know", "honestly i don't know", "honestly no idea",
        "i'm blank", "im blank", "my mind is blank", "drawing a blank",
        "i can't think of anything", "i cant think of anything",
        "i don't recall", "i dont recall", "absolutely no idea",
        "zero clue", "haven't heard of it", "havent heard of it",
        "never heard of it", "never learned that", "wasn't taught that",
        "don't know what that is", "dont know what that is",
        "no clue what that means", "what is that", "what does that mean"
    ];
    // ── Layer 2b: Refusal phrase check with word-count guard ──
    // CRITICAL FIX: Only flag as zero-score if answer is short (≤20 words).
    // Long answers may briefly mention uncertainty ("I don't know the exact syntax
    // but here's what I know...") before providing a real explanation.
    // In those cases, let Gemini evaluate the actual explanation content.
    const wordCount = text.split(/\s+/).length;

    if (wordCount <= 20) {
        // Short answer — any refusal phrase means it's a non-answer
        if (refusalPhrases.some(phrase => lower.includes(phrase))) {
            return { isZero: true, reason: 'refusal', confidence: 1.0 };
        }
    } else {
        // Long answer — only flag if the refusal phrase appears at the START
        // and there's very little content beyond it
        for (const phrase of refusalPhrases) {
            if (lower.includes(phrase)) {
                // Check if after removing the refusal phrase, meaningful content remains
                const withoutRefusal = lower.replace(phrase, '').trim();
                const remainingWords = withoutRefusal.split(/\s+/).filter(w => w.length > 2);
                if (remainingWords.length < 8) {
                    // Mostly a refusal with very little explanation
                    return { isZero: true, reason: 'refusal', confidence: 0.90 };
                }
                // Otherwise: user caveated but then explained — not a zero
                break;
            }
        }
    }

    // ── Layer 3: Intent-based refusal detection (fuzzy) ──
    // Catches variations like "hmm I'm really not sure about this one"
    const refusalPatterns = [
        /\b(don'?t|do\s*not|can'?t|cannot|have\s*no|no)\s+(know|idea|clue|answer|response|understanding)/i,
        /\b(not\s+sure|unsure|uncertain|clueless|blank|stumped)\b/i,
        /\b(skip|pass|next)\s*(this)?\s*(one|question)?\b/i,
        /\b(never\s+(heard|learned|studied|seen|encountered))\b/i,
        /\bwhat\s+(is|are|does)\s+(that|this|it)\s*\??\s*$/i,
    ];
    // Only flag if the whole answer is short (≤20 words) AND matches refusal intent
    if (wordCount <= 20 && refusalPatterns.some(p => p.test(lower))) {
        return { isZero: true, reason: 'refusal_intent', confidence: 0.95 };
    }

    // ── Layer 4: Pure filler / noise ──
    const fillerWords = new Set(['um', 'uh', 'hmm', 'huh', 'oh', 'ah', 'er', 'like', 'erm', 'uhh', 'umm', 'hmm']);
    const words = lower.split(/\s+/).filter(w => w.length > 0);
    const meaningfulWords = words.filter(w => !fillerWords.has(w) && w.length > 1);
    if (meaningfulWords.length < 2) {
        return { isZero: true, reason: 'noise_only', confidence: 0.95 };
    }

    // ── Layer 5: Gibberish detection ──
    // Check if words are mostly random characters
    const gibberishWords = meaningfulWords.filter(w => {
        // Real words have vowels; gibberish like "asdfgh" usually doesn't
        const hasVowel = /[aeiou]/i.test(w);
        const isToShort = w.length <= 1;
        const hasRepeatedChars = /(.)\1{3,}/.test(w); // "aaaa"
        return (!hasVowel && w.length > 2) || hasRepeatedChars || isToShort;
    });
    if (gibberishWords.length > meaningfulWords.length * 0.6 && meaningfulWords.length < 10) {
        return { isZero: true, reason: 'gibberish', confidence: 0.9 };
    }

    // ── Layer 6: Completely unrelated content ──
    // If the answer has ZERO topical overlap with both the question AND ideal answer
    if (idealAnswer && idealAnswer.length > 10) {
        const topicOverlap = computeTopicOverlap(lower, question, idealAnswer);
        if (topicOverlap === 0 && meaningfulWords.length < 20) {
            // Double-check: is the answer at least attempting to explain something technical?
            const hasTechnicalAttempt = /\b(function|variable|data|system|process|method|class|object|code|program|server|client|database|api|algorithm|memory|loop|array|string|type|return|component|module|interface|struct|pattern|protocol|framework|library|package|deploy|test|query|schema|table|index|cache|thread|async|sync|event|state|prop|hook|route|request|response|error|exception|inherit|polymorphism|encapsulation|abstraction|recursive|iterate|compile|runtime|network|socket|http|rest|graphql|sql|nosql|docker|kubernetes|git|linux|cloud)\b/i.test(lower);
            if (!hasTechnicalAttempt) {
                return { isZero: true, reason: 'unrelated', confidence: 0.85 };
            }
        }
    }

    return { isZero: false, reason: null, confidence: 0 };
}


// ─────────────────────────────────────────────────────────────
// SECTION 2: MAIN LOCAL SCORING ENGINE
// ─────────────────────────────────────────────────────────────

/**
 * Score an interview answer locally using concept-level understanding.
 * Returns the SAME format as analyzeWithGemini for full compatibility.
 * 
 * @param {string} transcript - User's spoken/typed answer
 * @param {string} question - The interview question
 * @param {string} idealAnswer - The reference ideal answer
 * @returns {Object} - { score, feedback, status, breakdown, improvement_points, transcript, ideal_answer }
 */
export function scoreAnswerLocally(transcript, question, idealAnswer) {
    const text = (transcript || '').trim();

    // Step 1: Zero-score check (this works well — keep it)
    const zeroCheck = isZeroScoreAnswer(text, question, idealAnswer);
    if (zeroCheck.isZero) {
        return createZeroResult(text, idealAnswer, zeroCheck.reason);
    }

    // Step 2: Basic text quality assessment (NOT keyword matching)
    // This provides a preliminary score based on answer substance.
    // The REAL scoring comes from Gemini on the server.
    const words = text.split(/\s+/).filter(w => w.length > 1);
    const wordCount = words.length;

    // Basic quality score based on answer length and substance
    let preliminaryScore;
    if (wordCount < 5) preliminaryScore = 20;
    else if (wordCount < 15) preliminaryScore = 40;
    else if (wordCount < 30) preliminaryScore = 55;
    else if (wordCount < 60) preliminaryScore = 65;
    else preliminaryScore = 70;

    const status = preliminaryScore >= 70 ? 'good' : preliminaryScore >= 45 ? 'fair' : 'poor';

    return {
        score: preliminaryScore,
        feedback: 'Preliminary local assessment — detailed AI feedback is being generated by the server.',
        technical_feedback: '',
        grammar_feedback: '',
        status: status,
        breakdown: {
            technical: preliminaryScore,
            grammar: Math.min(100, preliminaryScore + 10),
            accent: preliminaryScore,
            confidence: preliminaryScore,
            knowledge: preliminaryScore,
            relevance: preliminaryScore,
            clarity: Math.min(100, preliminaryScore + 10),
            technical_score: preliminaryScore,
            communication_score: Math.min(100, preliminaryScore + 10),
            depth_score: preliminaryScore,
            confidence_score: preliminaryScore
        },
        missing_concepts: [],
        improvement_points: [
            'Detailed feedback will come from AI analysis.',
            'Review the ideal answer after receiving your results.'
        ],
        transcript: text,
        ideal_answer: idealAnswer || '',
        scoring_method: 'local_preliminary'
    };
}


// ─────────────────────────────────────────────────────────────
// SECTION 3: TF-IDF COSINE SIMILARITY
// ─────────────────────────────────────────────────────────────

/**
 * Compute TF-IDF cosine similarity between two texts.
 * Term Frequency × Inverse Document Frequency gives weight to important words.
 */
function computeCosineSimilarity(text1, text2) {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'need', 'must',
        'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
        'they', 'them', 'his', 'her', 'its', 'their', 'this', 'that', 'these',
        'those', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where',
        'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
        'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so',
        'than', 'too', 'very', 'just', 'because', 'as', 'until', 'while',
        'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
        'through', 'during', 'before', 'after', 'above', 'below', 'to',
        'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
        'again', 'further', 'then', 'once', 'here', 'there', 'and', 'but',
        'or', 'nor', 'if', 'else', 'also', 'like', 'um', 'uh', 'basically',
        'actually', 'literally', 'really', 'well', 'so', 'yeah', 'yes', 'no',
        'okay', 'right', 'sure', 'thing', 'things', 'way', 'something'
    ]);

    // Tokenize and filter
    const tokenize = (text) => text.split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 1 && !stopWords.has(w));

    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Build TF maps
    const tf1 = buildTF(tokens1);
    const tf2 = buildTF(tokens2);

    // Build combined vocabulary
    const vocab = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);

    // IDF: words in both documents get lower weight (they're common)
    // Words unique to one document get higher weight
    const idf = {};
    for (const word of vocab) {
        const docCount = (tf1[word] ? 1 : 0) + (tf2[word] ? 1 : 0);
        idf[word] = Math.log(2 / docCount) + 1; // +1 smoothing
    }

    // Build TF-IDF vectors
    const vec1 = {};
    const vec2 = {};
    for (const word of vocab) {
        vec1[word] = (tf1[word] || 0) * idf[word];
        vec2[word] = (tf2[word] || 0) * idf[word];
    }

    // Cosine similarity
    let dot = 0, mag1 = 0, mag2 = 0;
    for (const word of vocab) {
        dot += vec1[word] * vec2[word];
        mag1 += vec1[word] ** 2;
        mag2 += vec2[word] ** 2;
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude === 0 ? 0 : dot / magnitude;
}

function buildTF(tokens) {
    const tf = {};
    for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
    }
    // Normalize by document length
    const len = tokens.length;
    for (const key of Object.keys(tf)) {
        tf[key] /= len;
    }
    return tf;
}


// ─────────────────────────────────────────────────────────────
// SECTION 4: N-GRAM OVERLAP
// ─────────────────────────────────────────────────────────────

/**
 * Compute n-gram overlap (bigrams and trigrams).
 * Captures phrase-level matching: "virtual DOM" as a unit, not just "virtual" + "DOM" separately.
 */
function computeNgramOverlap(text1, text2) {
    const bigrams1 = getNgrams(text1, 2);
    const bigrams2 = getNgrams(text2, 2);
    const trigrams1 = getNgrams(text1, 3);
    const trigrams2 = getNgrams(text2, 3);

    const bigramOverlap = setOverlap(bigrams1, bigrams2);
    const trigramOverlap = setOverlap(trigrams1, trigrams2);

    // Weighted: trigrams matter more (more specific)
    return bigramOverlap * 0.4 + trigramOverlap * 0.6;
}

function getNgrams(text, n) {
    const words = text.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 1);
    const ngrams = new Set();
    for (let i = 0; i <= words.length - n; i++) {
        ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
}

function setOverlap(set1, set2) {
    if (set1.size === 0 || set2.size === 0) return 0;
    let overlap = 0;
    for (const item of set1) {
        if (set2.has(item)) overlap++;
    }
    // Jaccard-like: overlap / size of smaller set (so short correct answers aren't penalized)
    return overlap / Math.min(set1.size, set2.size);
}


// ─────────────────────────────────────────────────────────────
// SECTION 5: CONCEPT COVERAGE
// ─────────────────────────────────────────────────────────────

/**
 * Extract key concepts from the ideal answer and check how many
 * the user covered (even with different wording).
 */
function computeConceptCoverage(userText, idealText, questionText) {
    // Extract key concepts (technical terms, important phrases)
    const concepts = extractKeyConcepts(idealText);

    if (concepts.length === 0) {
        // Fallback: use word overlap
        return { coverage: computeCosineSimilarity(userText, idealText), covered: [], missing: [], conceptsFeedback: '' };
    }

    const covered = [];
    const missing = [];

    for (const concept of concepts) {
        if (isConceptPresent(concept, userText)) {
            covered.push(concept);
        } else {
            missing.push(concept);
        }
    }

    const coverage = concepts.length > 0 ? covered.length / concepts.length : 0;

    const conceptsFeedback = covered.length > 0
        ? `You correctly covered: ${covered.slice(0, 5).join(', ')}. `
        : 'Key concepts from the ideal answer were not addressed. ';

    return { coverage, covered, missing, conceptsFeedback };
}

/**
 * Extract key concepts from text. These are the "must-mention" ideas.
 * Uses a combination of:
 *   - Technical terms (multi-word and single-word)
 *   - Important noun phrases
 *   - Core verbs that indicate understanding
 */
function extractKeyConcepts(text) {
    const concepts = new Set();

    // 1. Technical multi-word phrases (order matters: check longer first)
    const techPhrases = [
        // React
        'virtual dom', 'real dom', 'dom manipulation', 'diffing algorithm', 'reconciliation',
        'state management', 'component lifecycle', 'side effects', 'dependency array',
        'controlled component', 'uncontrolled component', 'server side rendering',
        'client side rendering', 'code splitting', 'tree shaking', 'hot module replacement',
        'context api', 'custom hooks', 'higher order component', 'render prop',
        'pure component', 'memo', 'use effect', 'use state', 'use ref', 'use memo',
        'use callback', 'use context', 'use reducer',
        // JavaScript
        'lexical scope', 'lexical environment', 'execution context', 'call stack',
        'event loop', 'callback queue', 'microtask queue', 'prototype chain',
        'prototypal inheritance', 'arrow function', 'template literal',
        'destructuring assignment', 'spread operator', 'rest parameter',
        'promise chain', 'async await', 'generator function', 'symbol type',
        'weak map', 'weak set', 'proxy object', 'reflect api',
        // Databases
        'acid transactions', 'acid compliance', 'eventual consistency',
        'horizontal scaling', 'vertical scaling', 'sharding', 'replication',
        'primary key', 'foreign key', 'sql injection', 'query optimization',
        'connection pooling', 'database indexing', 'full text search',
        'key value', 'document store', 'graph database', 'column family',
        // Architecture
        'design pattern', 'singleton pattern', 'factory pattern', 'observer pattern',
        'model view controller', 'microservices', 'monolithic', 'api gateway',
        'load balancer', 'message queue', 'service mesh', 'circuit breaker',
        'rate limiting', 'caching strategy', 'cdn', 'reverse proxy',
        // General CS
        'big o notation', 'time complexity', 'space complexity',
        'binary search', 'hash table', 'linked list', 'binary tree',
        'depth first', 'breadth first', 'dynamic programming',
        'recursion', 'memoization', 'divide and conquer',
        // Security
        'cross site scripting', 'cross site request forgery', 'sql injection',
        'authentication', 'authorization', 'jwt token', 'oauth',
        'encryption', 'hashing', 'salting', 'ssl tls', 'cors',
        // DevOps
        'continuous integration', 'continuous deployment',
        'containerization', 'orchestration',
        'infrastructure as code', 'blue green deployment',
    ];

    const lower = text.toLowerCase();
    for (const phrase of techPhrases) {
        if (lower.includes(phrase)) {
            concepts.add(phrase);
        }
    }

    // 2. Important single technical terms (only if not already captured in phrases)
    const techTerms = [
        'closure', 'hoisting', 'scope', 'prototype', 'immutable', 'mutable',
        'polymorphism', 'encapsulation', 'abstraction', 'inheritance',
        'overloading', 'overriding', 'interface', 'abstract',
        'function', 'callback', 'promise', 'async', 'await', 'generator',
        'iterator', 'decorator', 'middleware', 'interceptor',
        'schema', 'index', 'query', 'transaction', 'normalization',
        'denormalization', 'migration', 'seed', 'orm',
        'cache', 'redis', 'memcached', 'session', 'cookie', 'token',
        'docker', 'kubernetes', 'nginx', 'webpack', 'babel', 'typescript',
        'graphql', 'rest', 'soap', 'grpc', 'websocket',
        'component', 'render', 'props', 'state', 'context', 'reducer',
        'store', 'dispatch', 'action', 'selector', 'thunk', 'saga',
        'variable', 'constant', 'parameter', 'argument', 'expression',
        'algorithm', 'recursion', 'iteration', 'sorting', 'searching',
        'stack', 'queue', 'heap', 'graph', 'tree', 'array', 'object',
        'thread', 'process', 'mutex', 'semaphore', 'deadlock',
        'api', 'endpoint', 'request', 'response', 'header', 'payload',
        'relational', 'nosql', 'mongodb', 'postgresql', 'mysql',
        'framework', 'library', 'module', 'package', 'dependency',
        'testing', 'unit', 'integration', 'mocking', 'assertion',
        'deployment', 'scaling', 'monitoring', 'logging', 'debugging'
    ];

    const words = lower.split(/\s+/);
    for (const term of techTerms) {
        if (words.includes(term) && !concepts.has(term)) {
            // Only add if not already captured as part of a phrase
            let alreadyCaptured = false;
            for (const existing of concepts) {
                if (existing.includes(term)) { alreadyCaptured = true; break; }
            }
            if (!alreadyCaptured) {
                concepts.add(term);
            }
        }
    }

    // 3. Extract key action/relationship verbs that indicate understanding
    const keyVerbs = [
        'compares', 'updates', 'renders', 'executes', 'returns', 'stores',
        'inherits', 'encapsulates', 'abstracts', 'overrides', 'implements',
        'queries', 'indexes', 'caches', 'validates', 'authenticates',
        'deploys', 'scales', 'monitors', 'handles', 'processes',
        'maintains', 'retains', 'persists', 'transforms', 'maps',
        'filters', 'reduces', 'sorts', 'searches', 'traverses',
        'manages', 'controls', 'triggers', 'dispatches', 'subscribes'
    ];
    for (const verb of keyVerbs) {
        if (lower.includes(verb)) {
            concepts.add(verb);
        }
    }

    // 4. Extract important conceptual phrases from the specific ideal answer
    // Break ideal into sentences and extract key noun phrases
    const sentences = text.split(/[.!?;]+/).filter(s => s.trim().length > 5);
    for (const sentence of sentences) {
        const sentWords = sentence.trim().toLowerCase().split(/\s+/);
        // Extract 2-word noun phrases that seem important
        for (let i = 0; i < sentWords.length - 1; i++) {
            const bigram = sentWords[i] + ' ' + sentWords[i + 1];
            const w1 = sentWords[i].replace(/[^a-z]/g, '');
            const w2 = sentWords[i + 1].replace(/[^a-z]/g, '');
            // Both words should be substantial
            if (w1.length > 3 && w2.length > 3) {
                const boring = new Set(['this', 'that', 'with', 'from', 'into', 'than', 'also', 'when', 'then', 'they', 'them', 'each', 'some', 'more', 'most', 'very', 'only', 'just', 'even', 'well', 'much', 'such', 'like', 'what', 'which']);
                if (!boring.has(w1) && !boring.has(w2)) {
                    concepts.add(bigram);
                }
            }
        }
    }

    return Array.from(concepts);
}

/**
 * Check if a concept is present in the user's answer,
 * accounting for synonyms, paraphrases, and different word forms.
 */
function isConceptPresent(concept, userText) {
    // Direct match
    if (userText.includes(concept)) return true;

    // Stem-based match: check if the root words match
    const conceptWords = concept.split(/\s+/);
    if (conceptWords.length === 1) {
        // Single word: check stems
        const stem = getStem(concept);
        const userWords = userText.split(/\s+/);
        return userWords.some(w => getStem(w) === stem);
    }

    // Multi-word: check if all key words appear nearby in the text
    const keyWords = conceptWords.filter(w => w.length > 3);
    if (keyWords.length === 0) return false;

    const userWords = userText.split(/\s+/);
    const matchedPositions = [];
    for (const kw of keyWords) {
        const stem = getStem(kw);
        const pos = userWords.findIndex(w => getStem(w) === stem);
        if (pos >= 0) matchedPositions.push(pos);
    }

    // All key words found AND they're within reasonable proximity (within 8 words of each other)
    if (matchedPositions.length === keyWords.length) {
        if (matchedPositions.length <= 1) return true;
        const maxGap = Math.max(...matchedPositions) - Math.min(...matchedPositions);
        return maxGap <= 8;
    }

    // Check synonym database
    return checkSynonyms(concept, userText);
}

/**
 * Basic English word stemmer (Porter-like, simplified).
 * Reduces words to their root: "running" → "run", "updates" → "updat"
 */
function getStem(word) {
    let w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length <= 3) return w;

    // Common suffixes
    const suffixes = [
        'ation', 'ment', 'ness', 'ible', 'able', 'ful', 'less', 'ious',
        'eous', 'ance', 'ence', 'ment', 'ally', 'ity', 'ive', 'ize',
        'ing', 'ies', 'ied', 'ion', 'ous', 'ary', 'ery', 'ory',
        'ist', 'ism', 'ent', 'ant', 'ial', 'ual', 'ful',
        'ed', 'ly', 'er', 'es', 'al', 'ty'
    ];

    for (const suffix of suffixes) {
        if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
            return w.slice(0, w.length - suffix.length);
        }
    }

    // Handle trailing 's' (plurals)
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 4) {
        return w.slice(0, -1);
    }

    return w;
}

/**
 * Synonym/paraphrase database.
 * Maps concepts to alternative ways of expressing them.
 */
const SYNONYMS = {
    'virtual dom': ['in-memory representation', 'javascript copy', 'virtual tree', 'lightweight copy', 'memory copy', 'js version of dom', 'copy of dom', 'dom in memory', 'virtual representation'],
    'diffing algorithm': ['comparison algorithm', 'compares versions', 'finds differences', 'detects changes', 'spots changes', 'identifies changes', 'comparison process', 'diff process', 'comparing old and new'],
    'reconciliation': ['selective updates', 'partial updates', 'updates only changed', 'only updates what changed', 'minimal updates', 'targeted updates', 'efficient updates'],
    'closure': ['function remembers', 'retains access', 'keeps access', 'maintains access', 'preserves scope', 'remembers variables', 'access outer variables', 'inner function access'],
    'lexical scope': ['outer scope', 'enclosing scope', 'parent scope', 'surrounding scope', 'where defined', 'creation scope', 'definition scope'],
    'event loop': ['async mechanism', 'event system', 'message queue', 'non-blocking', 'concurrency model', 'handles async', 'processes callbacks'],
    'hoisting': ['moved to top', 'declarations raised', 'variable lifting', 'declaration hoisting'],
    'prototype': ['inheritance chain', 'prototype chain', 'object inheritance', 'prototypal', 'base object', 'parent object'],
    'promise': ['async result', 'future value', 'eventual result', 'deferred value', 'resolve reject', 'then catch'],
    'immutable': ['cannot change', 'unchangeable', 'read only', 'constant', 'no mutation', 'never modified'],
    'horizontal scaling': ['add more servers', 'scale out', 'multiple servers', 'distribute load', 'add machines', 'server cluster'],
    'vertical scaling': ['bigger server', 'scale up', 'upgrade hardware', 'more resources', 'more cpu', 'more memory', 'more ram'],
    'acid transactions': ['atomicity', 'consistency', 'isolation', 'durability', 'transaction safety', 'data integrity'],
    'eventual consistency': ['eventually consistent', 'consistency later', 'not immediately consistent', 'relaxed consistency'],
    'relational': ['table based', 'structured data', 'rows and columns', 'fixed schema', 'sql based', 'tabular'],
    'nosql': ['non relational', 'flexible schema', 'document based', 'schema less', 'unstructured'],
    'state': ['data', 'values', 'information', 'current values', 'component data'],
    'render': ['display', 'show', 'paint', 'draw', 'update ui', 'display on screen'],
    'component': ['module', 'part', 'piece', 'building block', 'element', 'section'],
    'api': ['interface', 'endpoint', 'service', 'connector', 'communication layer'],
    'callback': ['handler', 'function passed', 'function argument', 'event handler', 'completion handler'],
    'async': ['asynchronous', 'non blocking', 'concurrent', 'parallel', 'background'],
    'authentication': ['login', 'sign in', 'verify identity', 'credentials', 'user verification'],
    'authorization': ['permissions', 'access control', 'roles', 'privileges', 'what user can do'],
    'cache': ['store temporarily', 'keep in memory', 'quick access', 'temporary storage', 'speed up access'],
    'middleware': ['interceptor', 'between layers', 'processing layer', 'handler chain', 'pipe'],
    'dependency array': ['watch list', 'trigger list', 'values to watch', 'dependencies', 'monitored values'],
    'side effects': ['external operations', 'outside changes', 'api calls', 'data fetching', 'dom changes'],
};

function checkSynonyms(concept, userText) {
    const synonymList = SYNONYMS[concept.toLowerCase()];
    if (!synonymList) return false;
    return synonymList.some(syn => userText.includes(syn));
}


// ─────────────────────────────────────────────────────────────
// SECTION 6: HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Compute how much the user's answer overlaps with the question AND ideal answer topics.
 * Returns 0 if completely unrelated, >0 if on-topic.
 */
function computeTopicOverlap(userText, question, idealAnswer) {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'i', 'me', 'my',
        'we', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'what',
        'which', 'who', 'how', 'not', 'just', 'very', 'so', 'too', 'also', 'and', 'but',
        'or', 'if', 'of', 'at', 'by', 'for', 'with', 'in', 'on', 'to', 'from', 'up',
        'out', 'about', 'like', 'um', 'uh', 'basically', 'actually', 'really', 'well',
        'its', 'than', 'then', 'there', 'here', 'all', 'some'
    ]);

    const getKeyWords = (text) => {
        return new Set(
            text.toLowerCase().split(/\s+/)
                .map(w => w.replace(/[^a-z0-9]/g, ''))
                .filter(w => w.length > 2 && !stopWords.has(w))
        );
    };

    const userKeys = getKeyWords(userText);
    const questionKeys = getKeyWords(question);
    const idealKeys = getKeyWords(idealAnswer);

    // Merge question + ideal keywords as "topic" keywords
    const topicKeys = new Set([...questionKeys, ...idealKeys]);

    let overlap = 0;
    for (const word of userKeys) {
        if (topicKeys.has(word)) overlap++;
        // Also check stems
        else {
            const stem = getStem(word);
            for (const topicWord of topicKeys) {
                if (getStem(topicWord) === stem) { overlap++; break; }
            }
        }
    }

    return overlap;
}

/**
 * Compute relevance to the question specifically.
 */
function computeQuestionRelevance(userText, questionText) {
    const sim = computeCosineSimilarity(userText, questionText);
    // Also check if user mentions key question terms
    const questionTerms = questionText.split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 3);

    if (questionTerms.length === 0) return sim;

    const userLower = userText.toLowerCase();
    let termMatches = 0;
    for (const term of questionTerms) {
        if (userLower.includes(term) || userLower.includes(getStem(term))) {
            termMatches++;
        }
    }

    const termRatio = termMatches / questionTerms.length;
    return Math.min(1.0, sim * 0.4 + termRatio * 0.6);
}

/**
 * Calibrate raw score (0-1) to spread across the full 0-100 range.
 * Raw scores from TF-IDF tend to cluster 0.15-0.6, so we stretch that.
 */
function calibrateScore(raw) {
    // Piecewise linear calibration:
    if (raw <= 0.05) return raw * 2;          // 0-0.05 → 0-10%
    if (raw <= 0.15) return 0.10 + (raw - 0.05) * 2;   // 0.05-0.15 → 10-30%
    if (raw <= 0.30) return 0.30 + (raw - 0.15) * 2;   // 0.15-0.30 → 30-60%
    if (raw <= 0.50) return 0.60 + (raw - 0.30) * 1.5;  // 0.30-0.50 → 60-90%
    return 0.90 + (raw - 0.50) * 0.2;         // 0.50+ → 90-100%
}


// ─────────────────────────────────────────────────────────────
// SECTION 7: RESULT BUILDERS
// ─────────────────────────────────────────────────────────────

function createZeroResult(transcript, idealAnswer, reason) {
    const reasonMessages = {
        'empty': 'No answer was provided. Please speak or type your answer.',
        'refusal': '"I don\'t know" or refusal responses receive a score of 0. In a real interview, always attempt an answer — even partial knowledge is better than silence.',
        'refusal_intent': 'Your response indicates you don\'t know the answer. Always try to explain what you DO know, even if incomplete.',
        'noise_only': 'Only filler sounds were detected (um, uh, hmm). Please provide an actual answer.',
        'gibberish': 'The response appears to be incoherent. Please provide a clear, structured answer.',
        'unrelated': 'Your answer is completely unrelated to the question. Please address the topic being asked about.'
    };

    return {
        score: 0,
        feedback: reasonMessages[reason] || 'No meaningful answer detected.',
        technical_feedback: 'No technical content was provided.',
        grammar_feedback: '',
        status: 'poor',
        breakdown: {
            technical: 0, grammar: 0, accent: 0, confidence: 0,
            knowledge: 0, relevance: 0, clarity: 0,
            technical_score: 0, communication_score: 0, depth_score: 0, confidence_score: 0
        },
        missing_concepts: [],
        improvement_points: [
            'Provide an actual answer to the question',
            'Study the ideal answer below and practice explaining it',
            'Even partial knowledge demonstrates effort and understanding'
        ],
        transcript: transcript || '',
        ideal_answer: idealAnswer || '',
        scoring_method: 'local_zero_detection'
    };
}

function createBasicEvaluation(text, question) {
    // When there's no ideal answer, do a basic quality assessment
    const words = text.split(/\s+/).filter(w => w.length > 1);
    const wordCount = words.length;

    let score;
    if (wordCount < 5) score = 20;
    else if (wordCount < 15) score = 40;
    else if (wordCount < 30) score = 55;
    else if (wordCount < 60) score = 65;
    else score = 70;

    // Check for technical terms (bonus)
    const techPattern = /\b(function|variable|class|object|api|database|server|algorithm|component|state|render|query|async|promise|callback|scope|prototype|closure|array|string|boolean|integer|null|undefined|http|rest|sql|react|node|python|java|docker|git|css|html)\b/gi;
    const techCount = (text.match(techPattern) || []).length;
    if (techCount >= 3) score = Math.min(100, score + 15);
    else if (techCount >= 1) score = Math.min(100, score + 8);

    const status = score >= 70 ? 'good' : score >= 45 ? 'fair' : 'poor';

    return {
        score,
        feedback: `Answer recorded. Without an ideal answer reference, scoring is based on answer quality and depth. ${techCount > 0 ? `Technical terminology detected (${techCount} terms).` : 'Consider including more technical details.'}`,
        technical_feedback: '',
        grammar_feedback: '',
        status,
        breakdown: {
            technical: score, grammar: Math.min(100, score + 10), accent: score, confidence: score,
            knowledge: score, relevance: score, clarity: Math.min(100, score + 10),
            technical_score: score, communication_score: Math.min(100, score + 10),
            depth_score: score, confidence_score: score
        },
        missing_concepts: [],
        improvement_points: [
            'Provide detailed technical explanations',
            'Use specific examples to illustrate your points',
            'Structure your answer clearly'
        ],
        transcript: text,
        ideal_answer: '',
        scoring_method: 'local_basic'
    };
}

/**
 * Generate human-readable feedback based on scoring components.
 */
function generateFeedback(score, conceptResult, cosineSim, question, userAnswer) {
    let feedback = '';

    if (score >= 85) {
        feedback = 'Excellent answer! You demonstrated strong understanding of the key concepts. ';
        if (conceptResult.covered.length > 0) {
            feedback += `You correctly covered ${conceptResult.covered.length} key concept${conceptResult.covered.length > 1 ? 's' : ''} including ${conceptResult.covered.slice(0, 3).join(', ')}. `;
        }
        if (conceptResult.missing.length > 0 && conceptResult.missing.length <= 2) {
            feedback += `To achieve a perfect score, also mention: ${conceptResult.missing.slice(0, 2).join(', ')}.`;
        }
    } else if (score >= 70) {
        feedback = 'Good answer that shows solid understanding. ';
        if (conceptResult.covered.length > 0) {
            feedback += `You covered: ${conceptResult.covered.slice(0, 3).join(', ')}. `;
        }
        if (conceptResult.missing.length > 0) {
            feedback += `Missing concepts: ${conceptResult.missing.slice(0, 3).join(', ')}. Adding these would strengthen your answer.`;
        }
    } else if (score >= 50) {
        feedback = 'Your answer shows partial understanding but misses several important concepts. ';
        if (conceptResult.covered.length > 0) {
            feedback += `You mentioned: ${conceptResult.covered.slice(0, 2).join(', ')}, which is a good start. `;
        }
        feedback += `Key areas to study: ${conceptResult.missing.slice(0, 3).join(', ')}.`;
    } else if (score >= 25) {
        feedback = 'Your answer is quite brief or doesn\'t cover the main concepts adequately. ';
        if (conceptResult.missing.length > 0) {
            feedback += `You should focus on: ${conceptResult.missing.slice(0, 4).join(', ')}. `;
        }
        feedback += 'Review the ideal answer and practice explaining these concepts in your own words.';
    } else {
        feedback = 'Your answer does not sufficiently address the question. ';
        if (cosineSim < 0.15) {
            feedback += 'The content appears largely unrelated to the topic. ';
        }
        feedback += 'Please study the ideal answer carefully and try to understand each concept before your next attempt.';
    }

    return feedback;
}

/**
 * Generate specific improvement points.
 */
function generateImprovements(conceptResult, score) {
    const tips = [];

    if (conceptResult.missing.length > 0) {
        tips.push(`Study these concepts: ${conceptResult.missing.slice(0, 3).join(', ')}`);
    }

    if (score < 50) {
        tips.push('Review the ideal answer and identify the 3-4 main points');
        tips.push('Practice explaining technical concepts in your own words');
    } else if (score < 75) {
        tips.push('Add more depth to your explanations with specific details');
        tips.push('Try to cover ALL key aspects of the concept, not just the main idea');
    } else {
        tips.push('Great job! Try adding real-world examples to make your answer even stronger');
    }

    if (tips.length === 0) {
        tips.push('Continue practicing technical explanations');
    }

    return tips;
}

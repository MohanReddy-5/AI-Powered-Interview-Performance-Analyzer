/**
 * Test Cases for Semantic Answer Evaluation
 * 
 * These test cases validate that the AI understands MEANING, not just keywords.
 * Run these tests to verify the system gives correct scores for paraphrased answers.
 */

export const semanticTestCases = [
    {
        question: "Explain the Virtual DOM and how it improves performance.",
        idealAnswer: "The Virtual DOM is a lightweight, in-memory representation of the real DOM. When state changes, React updates the Virtual DOM first, compares it with the previous version using a diffing algorithm, and then selectively updates only the changed elements in the real DOM through reconciliation. This minimizes expensive direct DOM manipulations, reduces reflows and repaints, and allows React to batch multiple updates together for better performance.",

        testAnswers: [
            {
                answer: "React keeps a copy of the DOM in memory and compares it to find what changed, then only updates those parts in the real DOM. This makes it faster because the browser doesn't have to do as much work.",
                expectedScoreRange: [80, 95],
                reason: "Semantically correct - explains in-memory copy, comparison, selective updates, and performance benefit",
                shouldPass: true
            },
            {
                answer: "It's like a JavaScript version of the real DOM that React uses to track updates. When something changes, React figures out the differences and only updates what's necessary instead of the whole page.",
                expectedScoreRange: [75, 90],
                reason: "Good paraphrase - covers virtual representation, diffing, and selective updates",
                shouldPass: true
            },
            {
                answer: "React maintains a virtual tree structure in memory. It uses a diffing algorithm to compare the old and new versions, then applies minimal changes to the actual DOM. This batching and selective updating reduces browser rendering work.",
                expectedScoreRange: [85, 98],
                reason: "Excellent - uses different terms but covers all concepts: virtual tree, diffing, selective updates, batching, performance",
                shouldPass: true
            },
            {
                answer: "In-memory representation that gets compared with the actual DOM to find changes. Only the differences are updated which is more efficient.",
                expectedScoreRange: [70, 85],
                reason: "Partial - covers main concepts but lacks detail on reconciliation and batching",
                shouldPass: true
            },
            {
                answer: "Virtual DOM makes React faster.",
                expectedScoreRange: [15, 30],
                reason: "Too vague - doesn't explain HOW or WHAT it is",
                shouldPass: false
            },
            {
                answer: "React uses Virtual DOM for styling and making the UI look better.",
                expectedScoreRange: [10, 25],
                reason: "Incorrect - wrong purpose entirely",
                shouldPass: false
            },
            {
                answer: "The Virtual DOM is better than the real DOM because it's virtual and uses algorithms.",
                expectedScoreRange: [20, 35],
                reason: "Keyword stuffing without understanding - mentions 'virtual' and 'algorithms' but doesn't explain",
                shouldPass: false
            }
        ]
    },

    {
        question: "What is a Closure in JavaScript?",
        idealAnswer: "A closure is a function that has access to variables from its outer (enclosing) function's scope, even after the outer function has returned. This happens because JavaScript functions form closures over their lexical environment.",

        testAnswers: [
            {
                answer: "A closure is when a function remembers variables from outside its own scope, even after the outer function has finished running.",
                expectedScoreRange: [85, 95],
                reason: "Perfect paraphrase - 'remembers variables' = 'has access to', 'finished running' = 'returned'",
                shouldPass: true
            },
            {
                answer: "It's when an inner function can still use variables from its parent function, even when the parent is done executing.",
                expectedScoreRange: [80, 92],
                reason: "Correct understanding with different wording - 'inner function' = closure, 'parent function' = outer function",
                shouldPass: true
            },
            {
                answer: "Functions in JavaScript keep access to the scope where they were created. So if you return a function from another function, it still has access to the outer function's variables.",
                expectedScoreRange: [85, 95],
                reason: "Excellent explanation with example - shows deep understanding",
                shouldPass: true
            },
            {
                answer: "Closures are used for data privacy.",
                expectedScoreRange: [25, 40],
                reason: "True but doesn't explain WHAT a closure is",
                shouldPass: false
            },
            {
                answer: "A closure is a function inside another function.",
                expectedScoreRange: [30, 45],
                reason: "Partially correct but missing the key concept of scope retention",
                shouldPass: false
            }
        ]
    },

    {
        question: "Explain the difference between SQL and NoSQL databases.",
        idealAnswer: "SQL databases are relational with fixed schemas, ACID transactions, and vertical scaling (PostgreSQL, MySQL). They use structured tables with relationships and SQL query language. NoSQL databases are non-relational with flexible schemas, eventual consistency, and horizontal scaling (MongoDB, Cassandra). They use documents, key-value pairs, or graphs.",

        testAnswers: [
            {
                answer: "SQL databases have strict table structures and relationships between data. NoSQL databases are more flexible and can store data in different formats like documents or key-value pairs. SQL is better for complex queries, NoSQL scales better horizontally.",
                expectedScoreRange: [80, 92],
                reason: "Covers key differences: structure, flexibility, use cases, scaling",
                shouldPass: true
            },
            {
                answer: "SQL uses tables with defined columns and rows, and you need to follow that structure. NoSQL lets you store data however you want, like JSON documents. SQL databases are good for when data has clear relationships, NoSQL is good for big data that needs to scale across many servers.",
                expectedScoreRange: [75, 88],
                reason: "Good explanation with examples, covers schema, format, and scaling",
                shouldPass: true
            },
            {
                answer: "SQL is relational, NoSQL is not.",
                expectedScoreRange: [20, 35],
                reason: "Technically true but way too brief, doesn't explain implications",
                shouldPass: false
            },
            {
                answer: "SQL is old and slow, NoSQL is new and fast.",
                expectedScoreRange: [10, 25],
                reason: "Oversimplified and misleading",
                shouldPass: false
            }
        ]
    },

    {
        question: "How does React's useEffect hook dependency array work?",
        idealAnswer: "The dependency array in useEffect controls when the effect runs. If the array is empty [], the effect runs only once after the initial render. If it contains values like [count, user], the effect runs whenever any of those values change. If omitted entirely, the effect runs after every render.",

        testAnswers: [
            {
                answer: "The dependency array tells React when to re-run the effect. Empty array means run once on mount. If you put variables in the array, the effect runs whenever those variables change. No array means it runs every time the component renders.",
                expectedScoreRange: [88, 98],
                reason: "Perfect - covers all three cases with clear explanations",
                shouldPass: true
            },
            {
                answer: "It's like a list of things React watches. When any of those things change, React runs the effect again. If the list is empty, it only runs the first time.",
                expectedScoreRange: [75, 88],
                reason: "Good analogy ('watches') and covers main concepts",
                shouldPass: true
            },
            {
                answer: "You put variables in the array and React checks if they changed.",
                expectedScoreRange: [40, 55],
                reason: "Partial understanding but missing empty array and no array cases",
                shouldPass: false
            },
            {
                answer: "The dependency array makes useEffect work properly.",
                expectedScoreRange: [15, 30],
                reason: "Vague, doesn't explain HOW",
                shouldPass: false
            }
        ]
    }
];

/**
 * Run a test case
 * @param {Object} testCase - Test case object
 * @param {Function} evaluationFunction - The AI evaluation function to test
 * @returns {Object} - Test results
 */
export const runTestCase = async (testCase, evaluationFunction) => {
    const results = [];

    for (const testAnswer of testCase.testAnswers) {
        const result = await evaluationFunction(
            testCase.question,
            testCase.idealAnswer,
            testAnswer.answer
        );

        const score = result.score;
        const [minExpected, maxExpected] = testAnswer.expectedScoreRange;
        const passed = score >= minExpected && score <= maxExpected;

        results.push({
            answer: testAnswer.answer,
            expectedRange: testAnswer.expectedScoreRange,
            actualScore: score,
            passed,
            reason: testAnswer.reason,
            aiReasoning: result.feedback
        });
    }

    return {
        question: testCase.question,
        results,
        passRate: (results.filter(r => r.passed).length / results.length) * 100
    };
};

/**
 * Run all test cases
 */
export const runAllTests = async (evaluationFunction) => {
    console.log('🧪 Running Semantic Understanding Tests...\n');

    const allResults = [];

    for (const testCase of semanticTestCases) {
        console.log(`\n📝 Testing: ${testCase.question}`);
        const result = await runTestCase(testCase, evaluationFunction);
        allResults.push(result);

        console.log(`   Pass Rate: ${result.passRate.toFixed(1)}%`);
        result.results.forEach((r, i) => {
            const status = r.passed ? '✅' : '❌';
            console.log(`   ${status} Test ${i + 1}: Score ${r.actualScore} (expected ${r.expectedRange[0]}-${r.expectedRange[1]})`);
        });
    }

    const overallPassRate = allResults.reduce((sum, r) => sum + r.passRate, 0) / allResults.length;

    console.log(`\n\n🎯 Overall Pass Rate: ${overallPassRate.toFixed(1)}%`);
    console.log(overallPassRate >= 90 ? '✅ EXCELLENT!' : overallPassRate >= 75 ? '⚠️ GOOD, but needs improvement' : '❌ NEEDS WORK');

    return {
        testResults: allResults,
        overallPassRate
    };
};

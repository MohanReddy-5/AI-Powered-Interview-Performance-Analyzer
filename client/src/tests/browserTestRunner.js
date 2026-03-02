/**
 * Simple Test Runner for Browser Console
 * 
 * HOW TO USE:
 * 1. Open your app in browser (npm run dev)
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire file into console
 * 4. Run: await testSemanticUnderstanding('YOUR_GEMINI_API_KEY')
 */

const testSemanticUnderstanding = async (apiKey) => {
    console.log('🧪 Starting Semantic Understanding Test...\n');
    console.log('═══════════════════════════════════════════════════════\n');

    if (!apiKey || apiKey.length < 20) {
        console.error('❌ Please provide a valid Gemini API key');
        console.log('Usage: await testSemanticUnderstanding("YOUR_API_KEY")');
        return;
    }

    // Test cases
    const tests = [
        {
            name: 'Virtual DOM - Perfect Paraphrase',
            question: 'Explain the Virtual DOM and how it improves performance.',
            idealAnswer: 'The Virtual DOM is a lightweight, in-memory representation of the real DOM. When state changes, React updates the Virtual DOM first, compares it with the previous version using a diffing algorithm, and then selectively updates only the changed elements in the real DOM through reconciliation.',
            userAnswer: 'React keeps a copy of the DOM in memory and compares it to find what changed, then only updates those parts in the real DOM. This makes it faster because the browser doesn\'t have to do as much work.',
            expectedMin: 80,
            expectedMax: 95
        },
        {
            name: 'Virtual DOM - Good Analogy',
            question: 'Explain the Virtual DOM and how it improves performance.',
            idealAnswer: 'The Virtual DOM is a lightweight, in-memory representation of the real DOM. When state changes, React updates the Virtual DOM first, compares it with the previous version using a diffing algorithm, and then selectively updates only the changed elements in the real DOM through reconciliation.',
            userAnswer: 'It\'s like a JavaScript version of the real DOM that React uses to track updates. When something changes, React figures out the differences and only updates what\'s necessary.',
            expectedMin: 75,
            expectedMax: 90
        },
        {
            name: 'Virtual DOM - Too Vague (Should Score Low)',
            question: 'Explain the Virtual DOM and how it improves performance.',
            idealAnswer: 'The Virtual DOM is a lightweight, in-memory representation of the real DOM. When state changes, React updates the Virtual DOM first, compares it with the previous version using a diffing algorithm, and then selectively updates only the changed elements in the real DOM through reconciliation.',
            userAnswer: 'Virtual DOM makes React faster.',
            expectedMin: 15,
            expectedMax: 35
        },
        {
            name: 'Closure - Perfect Understanding',
            question: 'What is a Closure in JavaScript?',
            idealAnswer: 'A closure is a function that has access to variables from its outer (enclosing) function\'s scope, even after the outer function has returned.',
            userAnswer: 'A closure is when a function remembers variables from outside its own scope, even after the outer function has finished running.',
            expectedMin: 85,
            expectedMax: 95
        },
        {
            name: 'Closure - Incomplete (Should Score Medium)',
            question: 'What is a Closure in JavaScript?',
            idealAnswer: 'A closure is a function that has access to variables from its outer (enclosing) function\'s scope, even after the outer function has returned.',
            userAnswer: 'Closures are used for data privacy.',
            expectedMin: 25,
            expectedMax: 45
        }
    ];

    let passed = 0;
    let failed = 0;

    // Mock telemetry data
    const mockTelemetry = {
        wordsPerMinute: 130,
        fillerCount: 2,
        eyeContact: 75
    };

    const mockEmotions = {
        dominant: 'neutral',
        history: { neutral: 10 }
    };

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(`\n📝 Test ${i + 1}/${tests.length}: ${test.name}`);
        console.log(`Question: "${test.question}"`);
        console.log(`User Answer: "${test.userAnswer}"`);
        console.log(`Expected Score Range: ${test.expectedMin}-${test.expectedMax}`);

        try {
            // Import the analyzeContent function
            const { analyzeContent } = await import('/src/services/llmService.js');

            // Run the analysis
            const result = await analyzeContent(
                apiKey,
                test.question,
                test.idealAnswer,
                test.userAnswer,
                mockEmotions,
                mockTelemetry
            );

            const score = result.score;
            const isPass = score >= test.expectedMin && score <= test.expectedMax;

            if (isPass) {
                console.log(`✅ PASS - Score: ${score} (within expected range)`);
                passed++;
            } else {
                console.log(`❌ FAIL - Score: ${score} (expected ${test.expectedMin}-${test.expectedMax})`);
                failed++;
            }

            console.log(`AI Feedback: ${result.feedback.substring(0, 200)}...`);

        } catch (error) {
            console.error(`❌ ERROR in test: ${error.message}`);
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`\n🎯 RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`Pass Rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

    if (passed === tests.length) {
        console.log('🎉 EXCELLENT! All tests passed!');
        console.log('✅ Your system now understands semantic meaning correctly!');
    } else if (passed >= tests.length * 0.8) {
        console.log('👍 GOOD! Most tests passed.');
        console.log('⚠️ Some edge cases may need fine-tuning.');
    } else {
        console.log('⚠️ NEEDS IMPROVEMENT');
        console.log('Some tests failed. The AI may need further prompt refinement.');
    }

    return { passed, failed, total: tests.length };
};

// Export for use
window.testSemanticUnderstanding = testSemanticUnderstanding;

console.log('✅ Test runner loaded!');
console.log('Run: await testSemanticUnderstanding("YOUR_GEMINI_API_KEY")');

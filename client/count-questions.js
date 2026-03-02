import { domains } from './src/data/questionBank.js';

console.log('='.repeat(60));
console.log('QUESTION BANK SUMMARY');
console.log('='.repeat(60));

domains.forEach(domain => {
    console.log(`\n${domain.title}: ${domain.questions.length} questions`);
    console.log(`  Domain ID: ${domain.id}`);
    console.log(`  Description: ${domain.description}`);
});

console.log('\n' + '='.repeat(60));
console.log(`TOTAL QUESTIONS: ${domains.reduce((sum, d) => sum + d.questions.length, 0)}`);
console.log('='.repeat(60));

// Test the generated variant manually
import original from './optimizeProcess.js';
import optimized from './optimizeProcess.openai.gpt-4o.js';

const testCases = [
  { input: [[]], expected: {} },
  { 
    input: [[{id: 1, status: 'active', value: 100, category: 'electronics'}]], 
    expected: {ELECTRONICS: {count: 1, total: 110, average: 110}} 
  }
];

console.log('Testing variants...\n');

for (const {input, expected} of testCases) {
  const originalResult = original(...input);
  const optimizedResult = optimized(...input);
  
  console.log('Input:', JSON.stringify(input));
  console.log('Expected:', JSON.stringify(expected));
  console.log('Original:', JSON.stringify(originalResult));
  console.log('Optimized:', JSON.stringify(optimizedResult));
  console.log('Match:', JSON.stringify(optimizedResult) === JSON.stringify(expected));
  console.log('---');
}
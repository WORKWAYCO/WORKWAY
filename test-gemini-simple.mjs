const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

console.log('Testing Gemini API integration...\n');

const response = await fetch(`${workerUrl}/rlm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: 'function add(a, b) { return a + b; }\nfunction sum(x, y) { return x + y; }',
    query: 'Are there any duplicate functions here?',
    config: {
      rootModel: 'gemini-pro',
      subModel: 'gemini-flash',
      provider: 'gemini',
      maxIterations: 5,
      useCache: false,
    },
  }),
});

if (!response.ok) {
  console.error('❌ HTTP Error:', response.status);
  const text = await response.text();
  console.error(text);
  process.exit(1);
}

const result = await response.json();

console.log('✅ Success!\n');
console.log('Answer:', result.answer || 'No answer');
console.log('Iterations:', result.iterations?.length || 0);
console.log('Sub-calls:', result.subCalls || 0);
console.log('Cost:', `$${(result.costUsd || 0).toFixed(4)}`);

if (result.error) {
  console.error('\n❌ Error:', result.error);
  process.exit(1);
}

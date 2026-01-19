/**
 * Simple test: Verify Anthropic API integration works
 */

const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

console.log('🧪 Testing Anthropic/Claude integration\n');
console.log('═'.repeat(80));

const testContext = `
function add(a, b) {
  return a + b;
}

function sum(x, y) {
  return x + y;
}

function calculateTotal(num1, num2) {
  return num1 + num2;
}
`;

const testQuery = 'Are there any duplicate functions in this code? List them and explain.';

console.log('\n📤 Sending request to RLM worker...');
console.log(`   Context: ${testContext.length} chars`);
console.log(`   Query: ${testQuery.length} chars`);
console.log(`   Provider: anthropic`);
console.log(`   Model: claude-sonnet\n`);

const startTime = Date.now();

try {
	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context: testContext,
			query: testQuery,
			config: {
				rootModel: 'claude-sonnet',
				subModel: 'claude-haiku',
				provider: 'anthropic',
				maxIterations: 5,
				useCache: false,
			},
		}),
	});

	const duration = ((Date.now() - startTime) / 1000).toFixed(1);

	if (!response.ok) {
		const error = await response.text();
		console.error(`\n❌ Error: ${response.status}`);
		console.error(error);
		process.exit(1);
	}

	const result = await response.json();

	console.log(`\n✅ Analysis complete (${duration}s)`);
	console.log(`   Success: ${result.success}`);
	console.log(`   Iterations: ${result.iterations || 0}`);
	console.log(`   Sub-calls: ${result.subCalls || 0}`);
	console.log(`   Cost: $${(result.costUsd || 0).toFixed(4)}`);

	if (result.success && result.answer) {
		console.log(`\n📋 Results:`);
		console.log('─'.repeat(80));
		console.log(result.answer);
		console.log('─'.repeat(80));
	} else if (result.error) {
		console.error(`\n❌ Error: ${result.error}`);
		process.exit(1);
	}

	console.log('\n✅ Anthropic integration test PASSED');
} catch (error) {
	console.error(`\n❌ Fatal error:`, error.message);
	process.exit(1);
}

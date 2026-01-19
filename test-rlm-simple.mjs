/**
 * Simple RLM test with minimal context
 */

async function runCloudflareRLM(context, query) {
	const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

	console.log('📤 Sending request to RLM worker...');
	console.log(`   Context length: ${context.length} chars`);
	console.log(`   Query length: ${query.length} chars`);

	const requestBody = {
		context,
		query,
		config: {
			rootModel: 'llama-3.1-8b',
			subModel: 'llama-3.1-8b',
			maxIterations: 20,
			maxSubCalls: 100,
			useCache: false, // Disable cache for testing
		},
	};

	console.log('\n📦 Request body:');
	console.log(JSON.stringify(requestBody, null, 2).slice(0, 500) + '...\n');

	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(`RLM failed: ${error.error || response.statusText}`);
	}

	return await response.json();
}

async function main() {
	// Simple test context with obvious duplication
	const context = `
File: file1.ts
function fetchData(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed');
  return await response.json();
}

File: file2.ts
function loadData(endpoint: string) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Failed');
  return await response.json();
}

File: file3.ts
function getData(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Failed');
  return await response.json();
}
`.trim();

	const query = `Find duplicated code patterns in these files.`;

	console.log('🚀 Testing Cloudflare RLM\n');

	const result = await runCloudflareRLM(context, query);

	console.log('✅ Result received\n');
	console.log('═'.repeat(80));
	console.log('RESPONSE:');
	console.log('═'.repeat(80));
	console.log(result.answer || 'No answer');
	console.log('═'.repeat(80));
	console.log(`\nIterations: ${result.iterations?.length || 0}`);
	console.log(`Sub-calls: ${result.subCalls || 0}`);
}

main().catch((error) => {
	console.error('❌ Error:', error.message);
	process.exit(1);
});

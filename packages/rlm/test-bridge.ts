/**
 * Quick test of RLM TypeScript bridge
 *
 * Usage: ts-node test-bridge.ts
 */

import { runRLM, checkPythonRLM } from './dist/index.js';

async function main() {
	console.log('🔍 RLM Bridge Test\n');

	// Check if Python + RLM are available
	console.log('Step 1: Checking Python + workway_rlm...');
	const available = await checkPythonRLM();

	if (!available) {
		console.error('❌ Python or workway_rlm not available');
		console.error('   Run: cd packages/rlm && pip install -e .');
		process.exit(1);
	}

	console.log('✅ Python + workway_rlm available\n');

	// Create test context
	const context = `
Document 1: Authentication System
The system uses JWT tokens with RS256 signing.
Users can authenticate via email/password or OAuth.
Session tokens expire after 24 hours.

Document 2: Rate Limiting
Rate limits: 100 requests/minute per user.
Enterprise accounts: 1000 rpm.
Rate limit headers included in responses.

Document 3: Security Audit
Finding 1: Password hashing uses bcrypt (cost factor 12).
Finding 2: All endpoints require authentication.
Finding 3: SQL injection prevented via parameterized queries.
`.trim();

	// Run RLM query
	console.log('Step 2: Running RLM session...');
	console.log(`Context length: ${context.length} chars`);
	console.log(`Query: "What security measures are implemented?"\n`);

	try {
		const result = await runRLM(context, 'What security measures are implemented across all documents? List them.', {
			rootModel: 'sonnet',
			subModel: 'haiku',
			maxIterations: 10,
			maxSubCalls: 20,
		});

		console.log('✅ RLM session completed\n');
		console.log(`Success: ${result.success}`);
		console.log(`Iterations: ${result.iterations}`);
		console.log(`Sub-calls: ${result.subCalls}`);
		console.log(`Cost: $${result.costUsd.toFixed(4)}`);
		console.log(`\nAnswer:\n${result.answer}\n`);

		if (result.error) {
			console.error(`Error: ${result.error}`);
		}

		// Success
		console.log('✅ Bridge test passed!');
		process.exit(0);
	} catch (error) {
		console.error('❌ RLM session failed:', error);
		process.exit(1);
	}
}

main();

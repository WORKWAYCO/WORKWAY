/**
 * Test LLM for SEARCH-based DRY analysis (v2 - simplified)
 *
 * Ask Claude to generate patterns, then we use Grep tool to verify
 */

const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

async function askLLMForPatterns() {
	const query = `Generate 5-8 regex patterns that would help find DRY violations in TypeScript CLI commands.

DO NOT analyze specific code - just suggest patterns to search for.
DO NOT quote or generate code examples.

For each pattern, provide ONLY:
1. Pattern name
2. Regex pattern (simple, for grep)
3. Why it finds duplicates
4. Priority (high/medium/low)

Format:
## [Pattern Name]
**Regex:** \`pattern-here\`
**Why:** Explanation
**Priority:** high/medium/low

Examples of DRY violation patterns to search for:
- Repeated error handling (try-catch blocks)
- Duplicated configuration loading (loadConfig, process.env)
- Similar API client initialization
- Repeated validation logic
- Duplicated file operations
- Similar output formatting

Keep regex patterns SIMPLE (literal strings preferred over complex regex).`;

	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			context: '',
			query,
			config: {
				rootModel: 'claude-sonnet',
				subModel: 'claude-haiku',
				provider: 'anthropic',
				maxIterations: 3,
				useCache: false,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`RLM failed: ${response.statusText}`);
	}

	return await response.json();
}

async function main() {
	console.log('🔍 Testing LLM Search-Based Approach (v2)\n');
	console.log('═'.repeat(80));

	console.log('\n🔵 Asking Claude to generate search patterns...\n');

	const startTime = Date.now();
	const result = await askLLMForPatterns();
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);

	console.log(`✅ Got patterns (${duration}s, $${(result.costUsd || 0).toFixed(4)})`);
	console.log('\n📋 LLM-Generated Patterns:');
	console.log('─'.repeat(80));
	console.log(result.answer);
	console.log('─'.repeat(80));

	// Extract patterns from response
	const patternMatches = result.answer.matchAll(/\*\*Regex:\*\*\s*`([^`]+)`/g);
	const patterns = [...patternMatches].map((m) => m[1]);

	console.log(`\n\n📊 SUMMARY`);
	console.log('═'.repeat(80));
	console.log(`\n✅ Patterns Generated: ${patterns.length}`);
	console.log(`💰 Cost: $${(result.costUsd || 0).toFixed(4)}`);

	if (patterns.length > 0) {
		console.log(`\n📌 Extracted Patterns:\n`);
		patterns.forEach((p, i) => {
			console.log(`${i + 1}. ${p}`);
		});

		console.log(`\n💡 Next Steps:`);
		console.log(`   1. Use Grep tool with these patterns`);
		console.log(`   2. Review actual matches (no hallucination possible)`);
		console.log(`   3. Confirm real DRY violations`);
		console.log(`\n   Example:`);
		console.log(`   Grep.search({ pattern: "${patterns[0]}", path: "packages/cli/src/commands" })`);
	}

	console.log('\n' + '═'.repeat(80));
	console.log('🎯 Key Insight: Search > Generation');
	console.log('═'.repeat(80));
	console.log('\n❌ Generation approach:');
	console.log('   "Find DRY violations and show me the code"');
	console.log('   → LLM hallucinates code examples');
	console.log('\n✅ Search approach:');
	console.log('   "Generate patterns I can search for"');
	console.log('   → LLM suggests patterns, we verify');
	console.log('   → No hallucination - we see only real matches');
	console.log('\n' + '═'.repeat(80));
}

main().catch((error) => {
	console.error('❌ Fatal error:', error.message);
	process.exit(1);
});

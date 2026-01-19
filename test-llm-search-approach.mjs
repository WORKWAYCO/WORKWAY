/**
 * Test LLM for SEARCH-based DRY analysis instead of generation-based
 *
 * Instead of asking LLM to find and quote code violations,
 * ask it to generate search queries that we run ourselves.
 *
 * This avoids hallucination by keeping LLM in search/retrieval mode,
 * not generation mode.
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

async function findTSFiles(dir, files = []) {
	try {
		const entries = await readdir(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);

			if (stats.isDirectory()) {
				if (!['node_modules', 'dist', 'build', '.git', '.next'].includes(entry)) {
					await findTSFiles(fullPath, files);
				}
			} else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
				files.push(fullPath);
			}
		}
	} catch (err) {
		// Skip directories we can't read
	}

	return files;
}

async function askLLMForSearchQueries(fileList, provider = 'anthropic') {
	const context = `TypeScript files in WORKWAY codebase:

${fileList.map((f) => `- ${f}`).join('\n')}`;

	const query = `Based on these file paths, suggest grep/ripgrep search patterns to find DRY violations.

DO NOT analyze the code itself (you don't have access to file contents).
DO NOT quote or generate code examples.
DO generate search patterns that would help find duplicated code.

Focus on common DRY violation patterns:
1. Repeated error handling (try-catch blocks)
2. Duplicated configuration loading
3. Similar API client patterns
4. Repeated validation logic

For each pattern, provide:

## Pattern: [Brief description]
**Search query (ripgrep):**
\`\`\`bash
rg "regex-pattern" path/to/search
\`\`\`

**Why this finds duplicates:** [Explanation]

**Priority:** [high/medium/low]

Generate 5-8 search queries that would help find DRY violations.`;

	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context,
			query,
			config: {
				rootModel: provider === 'anthropic' ? 'claude-sonnet' : 'gemini-pro',
				subModel: provider === 'anthropic' ? 'claude-haiku' : 'gemini-flash',
				provider,
				maxIterations: 5,
				useCache: false,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`RLM failed: ${response.statusText}`);
	}

	return await response.json();
}

function executeSearchQuery(query, cwd = '.') {
	try {
		const result = execSync(query, {
			cwd,
			encoding: 'utf-8',
			maxBuffer: 1024 * 1024 * 10, // 10MB
		});
		return result.trim();
	} catch (error) {
		// ripgrep returns exit code 1 when no matches found
		if (error.status === 1) {
			return '';
		}
		throw error;
	}
}

async function main() {
	console.log('🔍 Testing LLM Search-Based Approach for DRY Analysis\n');
	console.log('═'.repeat(80));

	// Analyze CLI commands directory
	const targetDir = 'packages/cli/src/commands';
	const files = await findTSFiles(targetDir);

	console.log(`\n📁 Found ${files.length} TypeScript files in ${targetDir}\n`);

	// Test with Claude first (better at following instructions)
	console.log('─'.repeat(80));
	console.log('🔵 Asking Claude to generate search queries (NOT code)');
	console.log('─'.repeat(80));

	const startTime = Date.now();
	const result = await askLLMForSearchQueries(files, 'anthropic');
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);

	console.log(`\n✅ Got search queries (${duration}s, $${(result.costUsd || 0).toFixed(4)})`);
	console.log('\n📋 LLM-Generated Search Queries:');
	console.log('─'.repeat(80));
	console.log(result.answer);
	console.log('─'.repeat(80));

	// Extract search queries from LLM response
	const queryMatches = result.answer.matchAll(/```bash\s*\n(.*?)\n```/gs);
	const searchQueries = [...queryMatches].map((m) => m[1].trim());

	if (searchQueries.length === 0) {
		console.log('\n⚠️  No search queries found in LLM response');
		return;
	}

	console.log(`\n\n🔍 Executing ${searchQueries.length} search queries...\n`);
	console.log('═'.repeat(80));

	const results = [];

	for (let i = 0; i < searchQueries.length; i++) {
		const query = searchQueries[i];
		console.log(`\n${i + 1}. ${query}`);

		try {
			const output = executeSearchQuery(query);

			if (output) {
				const lineCount = output.split('\n').length;
				console.log(`   ✅ Found ${lineCount} matches`);
				results.push({
					query,
					matches: lineCount,
					output: output.slice(0, 500), // Preview
				});
			} else {
				console.log(`   ❌ No matches`);
			}
		} catch (error) {
			console.log(`   ⚠️  Error: ${error.message}`);
		}
	}

	console.log('\n\n' + '═'.repeat(80));
	console.log('📊 SUMMARY');
	console.log('═'.repeat(80));

	console.log(`\n🔍 Search Queries Generated: ${searchQueries.length}`);
	console.log(`✅ Queries with Matches: ${results.length}`);
	console.log(`💰 Cost: $${(result.costUsd || 0).toFixed(4)}`);

	if (results.length > 0) {
		console.log(`\n📌 Top Results:\n`);

		results
			.sort((a, b) => b.matches - a.matches)
			.slice(0, 3)
			.forEach((r, i) => {
				console.log(`${i + 1}. ${r.matches} matches for:`);
				console.log(`   ${r.query}`);
				console.log(`   Preview: ${r.output.slice(0, 200)}...`);
				console.log();
			});

		console.log('💡 Next Step: Manually review matched files to confirm DRY violations');
		console.log('   LLM helped us FIND candidates, not GENERATE code');
	} else {
		console.log('\n⚠️  No matches found for any queries');
		console.log('   This might mean:');
		console.log('   1. LLM-generated queries were too specific');
		console.log('   2. No DRY violations in this directory');
		console.log('   3. Queries need refinement');
	}

	console.log('\n' + '═'.repeat(80));
	console.log('🎯 Key Difference: Search vs Generation');
	console.log('═'.repeat(80));
	console.log('\n❌ Generation approach (previous tests):');
	console.log('   - LLM quotes code examples');
	console.log('   - Hallucinated 100% of specific code');
	console.log('   - Required manual verification of everything');
	console.log('\n✅ Search approach (this test):');
	console.log('   - LLM generates search patterns');
	console.log('   - We run queries on actual codebase');
	console.log('   - Only real matches returned (no hallucination possible)');
	console.log('   - LLM assists discovery, human verifies results');
	console.log('\n' + '═'.repeat(80));
}

main().catch((error) => {
	console.error('❌ Fatal error:', error.message);
	process.exit(1);
});

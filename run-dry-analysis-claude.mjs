/**
 * Run DRY violation analysis on WORKWAY codebase using Claude RLM
 *
 * This tests Claude Sonnet at scale to verify it doesn't hallucinate
 * like Gemini did on the same 144 files.
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

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

async function loadFiles(paths) {
	const contents = await Promise.all(
		paths.map(async (path) => {
			const content = await readFile(path, 'utf-8');
			return `=== ${path} ===\n${content}\n`;
		}),
	);

	return contents.join('\n');
}

async function runCloudflareRLM(context, query, config = {}) {
	const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

	console.log('\n📤 Sending request to RLM worker...');
	console.log(`   Context: ${context.length.toLocaleString()} chars`);
	console.log(`   Query: ${query.length} chars`);
	console.log(`   Provider: ${config.provider || 'anthropic'}`);
	console.log(`   Model: ${config.rootModel || 'claude-sonnet'}\\n`);

	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context,
			query,
			config: {
				rootModel: config.rootModel || 'claude-sonnet',
				subModel: config.subModel || 'claude-haiku',
				provider: config.provider || 'anthropic',
				maxIterations: config.maxIterations || 20,
				maxSubCalls: config.maxSubCalls || 100,
				chunkSize: config.chunkSize || 50000,
				useCache: config.useCache !== false,
			},
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(`RLM failed: ${error.error || response.statusText}`);
	}

	return await response.json();
}

async function main() {
	console.log('🔍 WORKWAY DRY Violation Analysis (Claude Sonnet)\\n');
	console.log('═'.repeat(80));

	// Same targets as Gemini test
	const targets = [
		'packages/cli/src/commands',
		'packages/harness/src',
		'packages/sdk/src',
	];

	let allFiles = [];
	for (const target of targets) {
		const files = await findTSFiles(target);
		allFiles = allFiles.concat(files);
	}

	console.log(`\\n📁 Found ${allFiles.length} TypeScript files\\n`);

	// Same batch size as Gemini test
	const batchSize = 15;
	const batches = [];
	for (let i = 0; i < allFiles.length; i += batchSize) {
		batches.push(allFiles.slice(i, i + batchSize));
	}

	console.log(`📦 Processing ${batches.length} batches of ~${batchSize} files each\\n`);

	const allViolations = [];
	let totalCost = 0;
	let totalTime = 0;

	for (let i = 0; i < batches.length; i++) {
		console.log(`\\n${'─'.repeat(80)}`);
		console.log(`📊 Batch ${i + 1}/${batches.length}`);
		console.log(`${'─'.repeat(80)}`);

		const batch = batches[i];
		console.log(`\\nFiles in this batch:`);
		batch.forEach((f) => console.log(`  • ${f}`));

		const context = await loadFiles(batch);
		console.log(`\\n📦 Context: ${context.length.toLocaleString()} chars`);

		const query = `Analyze these TypeScript files for DRY (Don't Repeat Yourself) violations.

FILES IN THIS BATCH:
${batch.map((f) => `- ${f}`).join('\\n')}

CRITICAL RULES:
1. ONLY report violations in the files listed above
2. Do NOT invent or reference file paths not in this batch
3. Do NOT assume files from other frameworks (SvelteKit, Next.js App Router, etc.)
4. Use EXACT file paths from the list above
5. Include ACTUAL CODE SNIPPETS from the files to prove the pattern exists

Focus on:
1. **Identical or near-identical functions** across multiple files IN THIS BATCH
2. **Duplicated logic patterns** repeated 3+ times IN THIS BATCH
3. **Copy-pasted code blocks** that should be utilities IN THIS BATCH

For each violation found, provide:

## Violation: [Brief description]
**Files:**
- [MUST be from the FILES IN THIS BATCH list above]
- [MUST be from the FILES IN THIS BATCH list above]

**Pattern:** [What code is duplicated - INCLUDE ACTUAL CODE SNIPPETS]

**Example from [filename]:**
\`\`\`typescript
[actual code from the file]
\`\`\`

**Recommendation:** [How to consolidate - be specific about where to extract it]

**Priority:** [critical/high/medium/low]

If no significant violations in THIS BATCH, respond with "No significant DRY violations in this batch."`;

		try {
			const startTime = Date.now();
			const result = await runCloudflareRLM(context, query, {
				rootModel: 'claude-sonnet',
				subModel: 'claude-haiku',
				provider: 'anthropic',
				useCache: false,
				maxIterations: 20,
				maxSubCalls: 100,
			});

			const duration = ((Date.now() - startTime) / 1000).toFixed(1);
			totalTime += parseFloat(duration);
			totalCost += result.costUsd || 0;

			console.log(`\\n✅ Analysis complete (${duration}s)`);
			console.log(`   Iterations: ${result.iterations?.length || 0}`);
			console.log(`   Sub-calls: ${result.subCalls || 0}`);
			console.log(`   Cost: $${(result.costUsd || 0).toFixed(4)}`);

			if (result.success && result.answer) {
				console.log(`\\n📋 Results:`);
				console.log('─'.repeat(80));
				console.log(result.answer);
				console.log('─'.repeat(80));

				if (!result.answer.includes('No significant DRY violations')) {
					allViolations.push({
						batch: i + 1,
						files: batch,
						violations: result.answer,
						cost: result.costUsd,
					});
				}
			} else {
				console.log(`\\n⚠️  No answer returned`);
				if (result.error) {
					console.log(`   Error: ${result.error}`);
				}
			}

			// Brief pause between batches
			if (i < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		} catch (error) {
			console.error(`\\n❌ Error analyzing batch ${i + 1}:`, error.message);
		}
	}

	console.log('\\n\\n' + '═'.repeat(80));
	console.log('📊 FINAL SUMMARY');
	console.log('═'.repeat(80));

	console.log(`\\n💰 Total Cost: $${totalCost.toFixed(4)}`);
	console.log(`⏱️  Total Time: ${(totalTime / 60).toFixed(1)} minutes`);
	console.log(`📦 Batches Processed: ${batches.length}`);
	console.log(`📄 Files Analyzed: ${allFiles.length}`);

	if (allViolations.length === 0) {
		console.log('\\n✅ No significant DRY violations detected across all batches!');
	} else {
		console.log(`\\n🔴 Found violations in ${allViolations.length} batch(es):\\n`);

		let violationCount = 0;
		allViolations.forEach((v) => {
			// Count number of "## Violation:" headers
			const matches = v.violations.match(/## Violation:/g);
			const count = matches ? matches.length : 0;
			violationCount += count;

			console.log(`\\nBatch ${v.batch}: ${count} violation(s) ($${v.cost.toFixed(4)})`);
		});

		console.log(`\\n📊 Total Violations Found: ${violationCount}`);
		console.log(`\\n💡 Next Step: Manually verify these violations exist in actual code`);
		console.log(`   Compare to Gemini results (100% hallucination rate)`);
	}

	console.log('\\n' + '═'.repeat(80));
}

main().catch((error) => {
	console.error('❌ Fatal error:', error.message);
	process.exit(1);
});

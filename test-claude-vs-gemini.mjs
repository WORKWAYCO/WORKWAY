/**
 * Comparison test: Claude vs Gemini on DRY violation detection
 *
 * Tests both providers on the same batch of files to compare accuracy
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

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

async function loadFiles(paths) {
	const contents = await Promise.all(
		paths.map(async (path) => {
			const content = await readFile(path, 'utf-8');
			return `=== ${path} ===\n${content}\n`;
		}),
	);

	return contents.join('\n');
}

async function runRLM(context, query, provider, rootModel, subModel) {
	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context,
			query,
			config: {
				rootModel,
				subModel,
				provider,
				maxIterations: 20,
				maxSubCalls: 100,
				useCache: false,
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
	console.log('🔬 CLAUDE vs GEMINI: DRY Analysis Accuracy Test\n');
	console.log('═'.repeat(80));

	// Test on a small batch - harness audit files (known patterns)
	const testFiles = await findTSFiles('packages/harness/src/audits');
	const batch = testFiles.slice(0, 6); // 6 audit files

	console.log(`\n📁 Testing on ${batch.length} files:`);
	batch.forEach((f) => console.log(`  • ${f}`));

	const context = await loadFiles(batch);
	console.log(`\n📦 Context: ${context.length.toLocaleString()} chars\n`);

	const query = `Analyze these TypeScript files for DRY (Don't Repeat Yourself) violations.

FILES IN THIS BATCH:
${batch.map((f) => `- ${f}`).join('\n')}

CRITICAL RULES:
1. ONLY report violations in the files listed above
2. Do NOT invent or reference file paths not in this batch
3. Use EXACT file paths from the list above
4. Provide specific code examples from the actual files

Focus on:
1. **Identical or near-identical functions** across multiple files IN THIS BATCH
2. **Duplicated logic patterns** repeated 2+ times IN THIS BATCH
3. **Copy-pasted code blocks** that should be utilities IN THIS BATCH

For each violation found, provide:

## Violation: [Brief description]
**Files:**
- [MUST be from the FILES IN THIS BATCH list above]

**Pattern:** [What code is duplicated - INCLUDE ACTUAL CODE SNIPPETS]

**Recommendation:** [How to consolidate]

**Priority:** [critical/high/medium/low]

If no significant violations in THIS BATCH, respond with "No significant DRY violations in this batch."`;

	// Test Gemini
	console.log('─'.repeat(80));
	console.log('🟡 Testing GEMINI PRO');
	console.log('─'.repeat(80));

	const geminiStart = Date.now();
	let geminiResult;
	try {
		geminiResult = await runRLM(context, query, 'gemini', 'gemini-pro', 'gemini-flash');
		const geminiDuration = ((Date.now() - geminiStart) / 1000).toFixed(1);

		console.log(`\n✅ Gemini complete (${geminiDuration}s)`);
		console.log(`   Cost: $${(geminiResult.costUsd || 0).toFixed(4)}`);
		console.log(`   Iterations: ${geminiResult.iterations || 0}`);

		console.log(`\n📋 Gemini Results:`);
		console.log('─'.repeat(80));
		console.log(geminiResult.answer || geminiResult.error);
		console.log('─'.repeat(80));
	} catch (error) {
		console.error(`\n❌ Gemini error:`, error.message);
	}

	// Test Claude
	console.log('\n\n' + '─'.repeat(80));
	console.log('🔵 Testing CLAUDE SONNET');
	console.log('─'.repeat(80));

	const claudeStart = Date.now();
	let claudeResult;
	try {
		claudeResult = await runRLM(context, query, 'anthropic', 'claude-sonnet', 'claude-haiku');
		const claudeDuration = ((Date.now() - claudeStart) / 1000).toFixed(1);

		console.log(`\n✅ Claude complete (${claudeDuration}s)`);
		console.log(`   Cost: $${(claudeResult.costUsd || 0).toFixed(4)}`);
		console.log(`   Iterations: ${claudeResult.iterations || 0}`);

		console.log(`\n📋 Claude Results:`);
		console.log('─'.repeat(80));
		console.log(claudeResult.answer || claudeResult.error);
		console.log('─'.repeat(80));
	} catch (error) {
		console.error(`\n❌ Claude error:`, error.message);
	}

	// Comparison
	console.log('\n\n' + '═'.repeat(80));
	console.log('📊 COMPARISON');
	console.log('═'.repeat(80));

	if (geminiResult && claudeResult) {
		console.log(`\n| Metric | Gemini Pro | Claude Sonnet |`);
		console.log(`|--------|------------|---------------|`);
		console.log(
			`| Cost | $${(geminiResult.costUsd || 0).toFixed(4)} | $${(claudeResult.costUsd || 0).toFixed(4)} |`,
		);
		console.log(
			`| Iterations | ${geminiResult.iterations || 0} | ${claudeResult.iterations || 0} |`,
		);
		console.log(
			`| Cost Ratio | 1x | ${((claudeResult.costUsd || 0) / (geminiResult.costUsd || 0)).toFixed(1)}x |`,
		);

		console.log(`\n\n🔍 NEXT STEPS:`);
		console.log(`1. Manually verify violations reported by each model`);
		console.log(`2. Check if code patterns actually exist in the files`);
		console.log(`3. Compare accuracy vs cost trade-off`);
	}
}

main().catch((error) => {
	console.error('❌ Fatal error:', error.message);
	process.exit(1);
});

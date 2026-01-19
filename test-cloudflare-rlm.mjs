/**
 * Test Cloudflare RLM for DRY violation detection
 *
 * Uses the deployed RLM worker to analyze codebase for code duplication
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Recursively find all TypeScript files
 */
async function findTSFiles(dir, files = []) {
	const entries = await readdir(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stats = await stat(fullPath);

		if (stats.isDirectory()) {
			// Skip node_modules, dist, .git
			if (!['node_modules', 'dist', 'build', '.git', '.next'].includes(entry)) {
				await findTSFiles(fullPath, files);
			}
		} else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Load file contents
 */
async function loadFiles(paths) {
	const contents = await Promise.all(
		paths.map(async (path) => {
			const content = await readFile(path, 'utf-8');
			return `\n=== ${path} ===\n${content}`;
		}),
	);

	return contents.join('\n\n');
}

/**
 * Call Cloudflare RLM Worker
 */
async function runCloudflareRLM(context, query, config = {}) {
	const workerUrl = 'https://rlm-worker.half-dozen.workers.dev';

	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context,
			query,
			config: {
				rootModel: config.rootModel || 'gemini-pro',
				subModel: config.subModel || 'gemini-flash',
				provider: 'gemini',
				maxIterations: config.maxIterations || 20,
				maxSubCalls: config.maxSubCalls || 100,
				chunkSize: config.chunkSize || 50000,
				useCache: config.useCache !== false,
			},
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(`Cloudflare RLM failed: ${error.error || response.statusText}`);
	}

	return await response.json();
}

/**
 * Main test
 */
async function main() {
	console.log('🔍 Finding TypeScript files in packages/...\n');

	// Focus on packages directory for faster analysis
	const files = await findTSFiles('packages');

	console.log(`Found ${files.length} TypeScript files\n`);

	// Load a subset of files to avoid overwhelming the RLM
	const targetFiles = files
		.filter((f) => f.includes('harness') || f.includes('cli') || f.includes('rlm'))
		.slice(0, 20); // Limit to 20 files

	console.log(`Analyzing ${targetFiles.length} files for DRY violations:\n`);
	targetFiles.forEach((f) => console.log(`  - ${f}`));

	const context = await loadFiles(targetFiles);

	console.log(`\n📦 Context size: ${context.length} characters\n`);

	const query = `
You are analyzing TypeScript code files for DRY (Don't Repeat Yourself) violations.

The code files are provided below with markers like "=== filepath ===" to separate them.

Please identify:
1. Functions duplicated across multiple files (same logic, different locations)
2. Similar code patterns repeated 3+ times
3. Copy-pasted logic that should be extracted to shared utilities

For each violation, provide:
- The specific files where duplication occurs
- What code pattern is duplicated
- Recommendation for how to consolidate

Use this output format:

## DRY Violation 1: [Brief description]
**Files:** packages/path/file1.ts, packages/path/file2.ts
**Pattern:** [Describe the duplicated code]
**Recommendation:** [How to consolidate it]

If no violations are found, respond with "No significant DRY violations detected."

Begin analysis:
`.trim();

	console.log('🚀 Running Cloudflare RLM analysis...\n');

	const startTime = Date.now();
	const result = await runCloudflareRLM(context, query, {
		rootModel: 'gemini-pro',
		subModel: 'gemini-flash',
		maxIterations: 20,
		maxSubCalls: 100,
		useCache: false, // Disable cache for fresh analysis
	});

	const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

	console.log('✅ RLM Analysis Complete\n');
	console.log('═'.repeat(80));
	console.log('📊 METRICS');
	console.log('═'.repeat(80));
	console.log(`Iterations:        ${result.iterations?.length || 0}`);
	console.log(`Sub-calls:         ${result.subCalls || 0}`);
	console.log(`Duration:          ${durationSec}s`);
	console.log(`Cost:              $${result.costUsd?.toFixed(4) || '0.0000'}`);
	console.log(`Cache Hit:         ${result.cacheHit ? 'Yes' : 'No'}`);
	console.log('═'.repeat(80));
	console.log('\n');

	console.log('═'.repeat(80));
	console.log('📋 DRY VIOLATION FINDINGS');
	console.log('═'.repeat(80));
	console.log(result.answer || 'No violations found');
	console.log('═'.repeat(80));

	// Check if RLM actually recursed
	if (result.subCalls === 0 && result.iterations?.length === 1) {
		console.log('\n⚠️  Note: RLM completed in 1 iteration with 0 sub-calls.');
		console.log(
			'This suggests the context was small enough for the root model to handle directly.',
		);
		console.log('For larger codebases, RLM will automatically chunk and recurse.');
	}
}

main().catch((error) => {
	console.error('❌ Error:', error.message);
	process.exit(1);
});

/**
 * Find DRY Violations - Specific File Analysis
 *
 * Uses RLM with improved prompting to find ACTUAL duplicated code with specific file references.
 */

import { runRLM } from '../packages/rlm/dist/index.js';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, relative } from 'path';

async function findTypeScriptFiles(dir, maxFiles = 30) {
	const files = [];

	async function walk(currentDir) {
		if (files.length >= maxFiles) return;

		const entries = await readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			if (files.length >= maxFiles) break;

			const fullPath = join(currentDir, entry.name);

			if (entry.isDirectory()) {
				if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
					continue;
				}
				await walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
				files.push(fullPath);
			}
		}
	}

	await walk(dir);
	return files;
}

async function analyzeDRYViolations(scope) {
	console.log('🔍 Finding DRY Violations with RLM\n');

	// Load files
	console.log(`📂 Scanning: ${scope}...`);
	const files = await findTypeScriptFiles(scope, 30);

	let context = `# DRY Violation Analysis\n\nAnalyze these ${files.length} TypeScript files for code duplication.\n\n`;

	for (const file of files) {
		const content = await readFile(file, 'utf-8');
		const relativePath = relative(process.cwd(), file);

		context += `\n${'='.repeat(80)}\n`;
		context += `FILE: ${relativePath}\n`;
		context += `${'='.repeat(80)}\n\n`;
		context += content;
		context += '\n\n';
	}

	console.log(`   Loaded ${files.length} files (${context.length.toLocaleString()} characters)\n`);

	const query = `
Your task: Find SPECIFIC instances of duplicated code across these files.

Look for:
1. Functions with similar implementations (>10 lines)
2. Classes with duplicated methods
3. Similar error handling blocks
4. Repeated utility functions
5. Copy-pasted logic with minor variations

CRITICAL: You MUST provide SPECIFIC file paths and actual code snippets.

For each violation, output:
{
  "severity": "critical|high|medium|low",
  "pattern": "Brief description",
  "locations": ["EXACT file path 1", "EXACT file path 2"],
  "codeSnippet": "First few lines of duplicated code",
  "recommendation": "How to fix",
  "effort": "Low|Medium|High"
}

Example of what I want:
{
  "severity": "high",
  "pattern": "Beads issue fetching logic duplicated",
  "locations": [
    "packages/harness/src/coordinator.ts",
    "packages/harness/src/worker.ts"
  ],
  "codeSnippet": "const issues = await beads.list({ status: 'open', ... });",
  "recommendation": "Extract to packages/harness/src/lib/beads-queries.ts",
  "effort": "Low"
}

Output ONLY violations where you can cite SPECIFIC files from the context above.
If no significant duplications exist, return an empty violations array.

Output as JSON:
{
  "violations": [...],
  "summary": {
    "totalViolations": 0,
    "filesAnalyzed": ${files.length}
  }
}
`.trim();

	console.log('🤖 Running RLM analysis...\n');

	const startTime = Date.now();
	const result = await runRLM(context, query, {
		rootModel: 'sonnet',
		subModel: 'haiku',
		maxIterations: 25,
		maxSubCalls: 120,
	});

	const duration = ((Date.now() - startTime) / 1000).toFixed(1);

	if (!result.success || !result.answer) {
		console.error('❌ Failed:', result.error);
		process.exit(1);
	}

	console.log(`✅ Complete (${duration}s)`);
	console.log(`   Iterations: ${result.iterations}, Sub-calls: ${result.subCalls}`);
	console.log(`   Cost: $${result.costUsd.toFixed(4)}\n`);

	// Parse results
	let analysis;
	try {
		// Try to extract JSON from the response
		const jsonMatch = result.answer.match(/\{[\s\S]*"violations"[\s\S]*\}/);
		if (jsonMatch) {
			analysis = JSON.parse(jsonMatch[0]);
		} else {
			analysis = JSON.parse(result.answer);
		}
	} catch (error) {
		console.log('⚠️  Raw output (not JSON):\n');
		console.log(result.answer);
		return;
	}

	console.log('='.repeat(80));
	console.log('DRY VIOLATIONS FOUND');
	console.log('='.repeat(80));
	console.log('');

	const violations = analysis.violations || [];

	if (violations.length === 0) {
		console.log('✅ No significant DRY violations found!\n');
	} else {
		console.log(`Found ${violations.length} violations:\n`);

		for (const v of violations) {
			const icon = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟠' : v.severity === 'medium' ? '🟡' : '⚪';

			console.log(`${icon} [${v.severity?.toUpperCase()}] ${v.pattern}`);
			console.log('');
			console.log('   Files:');
			for (const loc of (v.locations || [])) {
				console.log(`   - ${loc}`);
			}
			if (v.codeSnippet) {
				console.log('');
				console.log('   Code:');
				console.log('   ```');
				console.log('   ' + v.codeSnippet.split('\n').join('\n   '));
				console.log('   ```');
			}
			console.log('');
			console.log(`   Fix: ${v.recommendation}`);
			console.log(`   Effort: ${v.effort}`);
			console.log('');
			console.log('-'.repeat(80));
			console.log('');
		}
	}

	await writeFile('DRY_VIOLATIONS_DETAILED.json', JSON.stringify(analysis, null, 2));
	console.log('💾 Saved: DRY_VIOLATIONS_DETAILED.json\n');
}

const scope = process.argv[2] || 'packages/harness';

if (!process.env.ANTHROPIC_API_KEY) {
	console.error('❌ Set ANTHROPIC_API_KEY first');
	process.exit(1);
}

analyzeDRYViolations(scope).catch(console.error);

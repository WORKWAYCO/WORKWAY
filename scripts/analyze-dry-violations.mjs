/**
 * DRY Violation Analysis using RLM
 *
 * Uses RLM to analyze the entire codebase for Don't Repeat Yourself violations.
 * Finds duplicated code patterns, repeated logic, and opportunities for abstraction.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/analyze-dry-violations.mjs [packages/harness]
 */

import { runRLM } from '../packages/rlm/dist/index.js';
import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { relative } from 'path';

async function loadCodebaseContext(scope) {
	const pattern = scope
		? `${scope}/**/*.ts`
		: 'packages/{harness,cli,sdk,rlm,integrations}/**/*.ts';

	// Exclude test files, dist, node_modules
	const files = (await glob(pattern, {
		ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
	})).slice(0, 50); // Limit to 50 files to keep context manageable

	let context = '# Codebase Analysis for DRY Violations\n\n';
	context += `Analyzing ${files.length} TypeScript files\n\n`;

	for (const file of files) {
		const content = await readFile(file, 'utf-8');
		const relativePath = relative(process.cwd(), file);

		context += `\n${'='.repeat(80)}\n`;
		context += `FILE: ${relativePath}\n`;
		context += `LINES: ${content.split('\n').length}\n`;
		context += `${'='.repeat(80)}\n\n`;
		context += content;
		context += '\n\n';
	}

	return { context, fileCount: files.length };
}

async function analyzeDRYViolations(scope) {
	console.log('🔍 DRY Violation Analysis with RLM\n');

	// Load codebase
	console.log('📂 Loading codebase...');
	const { context, fileCount } = await loadCodebaseContext(scope);
	console.log(`   Loaded ${fileCount} files (${context.length.toLocaleString()} characters)\n`);

	// Construct RLM query
	const query = `
Analyze this TypeScript codebase for DRY (Don't Repeat Yourself) violations.

Find patterns of:
1. **Duplicated Code Blocks**: Same or very similar code in multiple files
2. **Repeated Logic**: Same business logic implemented multiple times
3. **Copy-Paste Patterns**: Functions/classes that differ only in minor details
4. **Extractable Abstractions**: Code that could be unified into shared utilities

For each violation, provide:
- **Severity**: critical (3+ duplications, core logic), high (2+ duplications, significant logic), medium (2 duplications, minor logic), low (potential abstractions)
- **Pattern**: What code is repeated (brief description)
- **Locations**: Which files contain the duplication (with approximate line numbers)
- **Recommendation**: How to fix (create shared utility, extract base class, etc.)
- **Effort**: Low/Medium/High estimate to fix
- **Example**: Show a small snippet of the duplicated code

Focus on:
- Actual code duplication (not just similar names)
- Logic that appears in 2+ files
- Patterns worth abstracting (not one-liners)
- Significant violations only (>10 lines duplicated)

Output as JSON:
{
  "violations": [
    {
      "severity": "high",
      "pattern": "OAuth token refresh logic",
      "locations": ["packages/sdk/oauth.ts:45-67", "packages/cli/oauth-flow.ts:121-143"],
      "duplicatedLines": 23,
      "recommendation": "Extract to @workwayco/sdk/oauth-helpers.ts",
      "effort": "Low",
      "example": "async function refreshToken() { ... }"
    }
  ],
  "summary": {
    "totalViolations": 12,
    "criticalViolations": 2,
    "highViolations": 4,
    "estimatedEffortHours": 6
  }
}
`.trim();

	// Run RLM analysis
	console.log('🤖 Running RLM analysis...');
	console.log('   Model: Sonnet (root) + Haiku (chunks)');
	console.log('   Max iterations: 20\n');

	const startTime = Date.now();
	const result = await runRLM(context, query, {
		rootModel: 'sonnet',
		subModel: 'haiku',
		maxIterations: 20,
		maxSubCalls: 100,
	});

	const duration = ((Date.now() - startTime) / 1000).toFixed(1);

	if (!result.success || !result.answer) {
		console.error('❌ RLM analysis failed');
		console.error(`   Error: ${result.error || 'Unknown error'}`);
		process.exit(1);
	}

	console.log(`✅ Analysis complete (${duration}s)\n`);
	console.log(`   Iterations: ${result.iterations}`);
	console.log(`   Sub-calls: ${result.subCalls}`);
	console.log(`   Cost: $${result.costUsd.toFixed(4)}\n`);

	// Parse and display results
	try {
		const analysis = JSON.parse(result.answer);

		console.log('='.repeat(80));
		console.log('DRY VIOLATION REPORT');
		console.log('='.repeat(80));
		console.log('');

		// Summary
		console.log('📊 Summary:');
		console.log(`   Total Violations: ${analysis.summary.totalViolations}`);
		console.log(`   Critical: ${analysis.summary.criticalViolations || 0}`);
		console.log(`   High: ${analysis.summary.highViolations || 0}`);
		console.log(`   Estimated Effort: ${analysis.summary.estimatedEffortHours || 'N/A'} hours`);
		console.log('');

		// Display violations
		const violations = analysis.violations || [];
		for (const violation of violations) {
			const icon =
				violation.severity === 'critical'
					? '🔴'
					: violation.severity === 'high'
					  ? '🟠'
					  : violation.severity === 'medium'
					    ? '🟡'
					    : '⚪';

			console.log(`${icon} [${violation.severity.toUpperCase()}] ${violation.pattern}`);
			console.log('');
			console.log(`   Locations (${violation.locations.length} files):`);
			for (const loc of violation.locations) {
				console.log(`   - ${loc}`);
			}
			console.log('');
			console.log(`   📝 Recommendation: ${violation.recommendation}`);
			console.log(`   ⏱️  Effort: ${violation.effort}`);
			if (violation.duplicatedLines) {
				console.log(`   📏 Duplicated Lines: ${violation.duplicatedLines}`);
			}
			if (violation.example) {
				console.log(`   💡 Example:\n      ${violation.example.replace(/\n/g, '\n      ')}`);
			}
			console.log('');
			console.log('-'.repeat(80));
			console.log('');
		}

		// Save full report
		const reportPath = 'DRY_VIOLATIONS_REPORT.json';
		await writeFile(reportPath, JSON.stringify(analysis, null, 2), 'utf-8');
		console.log(`💾 Full report saved to: ${reportPath}`);
		console.log('');

	} catch (error) {
		console.log('⚠️  Could not parse as JSON. Raw output:\n');
		console.log(result.answer);
	}
}

// Parse CLI arguments
const scope = process.argv[2];

// Validate API key
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('❌ ANTHROPIC_API_KEY environment variable not set');
	console.error('');
	console.error('Usage:');
	console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
	console.error('  node scripts/analyze-dry-violations.mjs [packages/harness]');
	process.exit(1);
}

// Run analysis
analyzeDRYViolations(scope).catch((error) => {
	console.error('❌ Analysis failed:', error);
	process.exit(1);
});

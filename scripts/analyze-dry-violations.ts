/**
 * DRY Violation Analysis using RLM
 *
 * Uses RLM to analyze the entire codebase for Don't Repeat Yourself violations.
 * Finds duplicated code patterns, repeated logic, and opportunities for abstraction.
 *
 * Usage: tsx scripts/analyze-dry-violations.ts [--scope packages/harness]
 */

import { runRLM } from '../packages/rlm/dist/index.js';
import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { relative } from 'path';

interface DRYAnalysisOptions {
	scope?: string;
	minSeverity?: 'low' | 'medium' | 'high' | 'critical';
	maxFiles?: number;
}

async function loadCodebaseContext(scope?: string): Promise<{ context: string; fileCount: number }> {
	const pattern = scope
		? `${scope}/**/*.ts`
		: 'packages/{harness,cli,sdk,rlm,integrations}/**/*.ts';

	// Exclude test files, dist, node_modules
	const files = (await glob(pattern, {
		ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
	})).slice(0, 100); // Limit to 100 files for initial analysis

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

async function analyzeDRYViolations(options: DRYAnalysisOptions = {}): Promise<void> {
	console.log('🔍 DRY Violation Analysis with RLM\n');

	// Load codebase
	console.log('📂 Loading codebase...');
	const { context, fileCount } = await loadCodebaseContext(options.scope);
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
- **Pattern**: What code is repeated
- **Locations**: Which files contain the duplication (with approximate line numbers)
- **Recommendation**: How to fix (create shared utility, extract base class, etc.)
- **Effort**: Low/Medium/High estimate to fix

Focus on:
- Actual code duplication (not just similar names)
- Logic that appears in 2+ files
- Patterns worth abstracting (not one-liners)

Output as JSON:
{
  "violations": [
    {
      "severity": "high",
      "pattern": "OAuth token refresh logic",
      "locations": ["packages/sdk/oauth.ts:45-67", "packages/cli/oauth-flow.ts:121-143"],
      "duplicatedLines": 23,
      "recommendation": "Extract to @workwayco/sdk/oauth-helpers.ts",
      "effort": "Low"
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

		console.log('=' .repeat(80));
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

		// Filter by severity if requested
		let violations = analysis.violations || [];
		if (options.minSeverity) {
			const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
			const minLevel = severityOrder[options.minSeverity];
			violations = violations.filter(
				(v: any) => severityOrder[v.severity as keyof typeof severityOrder] >= minLevel
			);
		}

		// Display violations
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
const args = process.argv.slice(2);
const options: DRYAnalysisOptions = {};

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--scope' && args[i + 1]) {
		options.scope = args[i + 1];
		i++;
	} else if (args[i] === '--min-severity' && args[i + 1]) {
		options.minSeverity = args[i + 1] as any;
		i++;
	} else if (args[i] === '--max-files' && args[i + 1]) {
		options.maxFiles = parseInt(args[i + 1]);
		i++;
	}
}

// Run analysis
analyzeDRYViolations(options).catch((error) => {
	console.error('❌ Analysis failed:', error);
	process.exit(1);
});

/**
 * DRY Violation Analysis using RLM
 *
 * Simple version using built-in Node.js modules only.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/analyze-dry-violations-simple.mjs packages/harness
 */

import { runRLM } from '../packages/rlm/dist/index.js';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

async function findTypeScriptFiles(dir, maxFiles = 50) {
	const files = [];

	async function walk(currentDir) {
		if (files.length >= maxFiles) return;

		const entries = await readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			if (files.length >= maxFiles) break;

			const fullPath = join(currentDir, entry.name);

			// Skip node_modules, dist, and hidden directories
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

async function loadCodebaseContext(scope) {
	console.log(`📂 Scanning directory: ${scope}...`);
	const files = await findTypeScriptFiles(scope, 50);

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
- **Locations**: Which files contain the duplication
- **Recommendation**: How to fix (create shared utility, extract base class, etc.)
- **Effort**: Low/Medium/High estimate to fix

Focus on:
- Actual code duplication (not just similar names)
- Logic that appears in 2+ files
- Patterns worth abstracting (not trivial one-liners)
- Significant violations (>10 lines duplicated or important business logic)

Output as JSON:
{
  "violations": [
    {
      "severity": "high",
      "pattern": "Brief description of duplicated code",
      "locations": ["file1.ts", "file2.ts"],
      "duplicatedLines": 23,
      "recommendation": "How to fix",
      "effort": "Low"
    }
  ],
  "summary": {
    "totalViolations": 5,
    "criticalViolations": 0,
    "highViolations": 2,
    "estimatedEffortHours": 4
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

		if (violations.length === 0) {
			console.log('✅ No significant DRY violations found!\n');
		} else {
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
				console.log(`   Locations (${violation.locations?.length || 0} files):`);
				for (const loc of (violation.locations || [])) {
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
		}

		// Save full report
		const reportPath = 'DRY_VIOLATIONS_REPORT.json';
		await writeFile(reportPath, JSON.stringify(analysis, null, 2), 'utf-8');
		console.log(`💾 Full report saved to: ${reportPath}`);
		console.log('');

	} catch (error) {
		console.log('⚠️  Could not parse as JSON. Raw output:\n');
		console.log(result.answer);
		console.log('\n');
	}
}

// Parse CLI arguments
const scope = process.argv[2] || 'packages/harness';

// Validate API key
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('❌ ANTHROPIC_API_KEY environment variable not set');
	console.error('');
	console.error('Usage:');
	console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
	console.error('  node scripts/analyze-dry-violations-simple.mjs [packages/harness]');
	process.exit(1);
}

// Run analysis
analyzeDRYViolations(scope).catch((error) => {
	console.error('❌ Analysis failed:', error);
	console.error(error.stack);
	process.exit(1);
});

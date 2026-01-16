/**
 * Diagnose Command
 *
 * AI-powered workflow diagnosis. Analyzes workflow code for common issues,
 * anti-patterns, and suggests improvements based on WORKWAY best practices.
 *
 * Zuhandenheit: Developer describes intent, tool reveals clarity.
 *
 * @example
 * ```bash
 * workway diagnose ./workflow.ts
 * workway diagnose --verbose ./workflow.ts
 * workway diagnose --json ./workflow.ts
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosisIssue {
	severity: 'error' | 'warning' | 'info';
	message: string;
	line?: number;
	suggestion?: string;
}

interface DiagnosisResult {
	file: string;
	score: number;
	issues: DiagnosisIssue[];
	suggestions: string[];
	patterns: {
		found: string[];
		missing: string[];
	};
	summary: string;
}

interface DiagnoseOptions {
	verbose?: boolean;
	json?: boolean;
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

const PATTERN_CHECKS = [
	{
		id: 'defineWorkflow',
		name: 'defineWorkflow()',
		regex: /defineWorkflow\s*\(/,
		required: true,
	},
	{
		id: 'execute',
		name: 'execute function',
		regex: /async\s+execute\s*\(/,
		required: true,
	},
	{
		id: 'error-handling',
		name: 'Error handling',
		regex: /onError\s*[:(]/,
		required: false,
	},
	{
		id: 'version',
		name: 'Version (semver)',
		regex: /version:\s*['"`]\d+\.\d+\.\d+['"`]/,
		required: true,
	},
	{
		id: 'inputs',
		name: 'Input schema',
		regex: /inputs:\s*\{/,
		required: false,
	},
	{
		id: 'integrations',
		name: 'Integrations',
		regex: /integrations:\s*\[/,
		required: false,
	},
	{
		id: 'trigger',
		name: 'Trigger',
		regex: /trigger:\s*(webhook|cron|schedule|manual)/,
		required: true,
	},
	{
		id: 'workers-ai',
		name: 'Workers AI',
		regex: /createAIClient|workers-ai/,
		required: false,
	},
];

const ANTI_PATTERNS = [
	{
		id: 'hardcoded-id',
		regex: /['"`](db|wf|user|team|wksp)_[a-zA-Z0-9]{10,}['"`]/g,
		message: 'Hardcoded ID detected. Use inputs for user-configurable values.',
		severity: 'warning' as const,
	},
	{
		id: 'console-log',
		regex: /console\.(log|warn|error)\(/g,
		message: 'Using console.log. Consider using context.log for structured logging.',
		severity: 'info' as const,
	},
	{
		id: 'any-type',
		regex: /:\s*any\b/g,
		message: 'Using `any` type. Consider using specific types for better AI generation.',
		severity: 'info' as const,
	},
	{
		id: 'api-key-env',
		regex: /process\.env\.[A-Z_]*KEY/g,
		message: 'Direct API key access. WORKWAY manages OAuth - use integrations instead.',
		severity: 'warning' as const,
	},
	{
		id: 'fetch-direct',
		regex: /\bfetch\s*\(/g,
		message: 'Direct fetch call. Consider using SDK http module or integrations.',
		severity: 'info' as const,
	},
];

const ZUHANDENHEIT_CHECKS = [
	{
		id: 'tool-name',
		check: (code: string) => {
			const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/);
			if (nameMatch) {
				const name = nameMatch[1].toLowerCase();
				const toolPatterns = ['sync', 'api', 'webhook', 'integration', 'connector', 'pipeline'];
				return toolPatterns.some(p => name.includes(p));
			}
			return false;
		},
		message: 'Workflow name is tool-focused. Describe the outcome, not the mechanism.',
		suggestion: 'Example: "Meeting notes that write themselves" instead of "Zoom-Notion Sync"',
	},
	{
		id: 'too-many-inputs',
		check: (code: string) => {
			const inputsMatch = code.match(/inputs:\s*\{([^}]+)\}/s);
			if (inputsMatch) {
				const requiredCount = (inputsMatch[1].match(/required:\s*true/g) || []).length;
				return requiredCount > 3;
			}
			return false;
		},
		message: 'Too many required inputs (>3). Weniger, aber besser: can any be optional with defaults?',
		suggestion: 'Aim for 0-2 required fields. Use sensible defaults.',
	},
];

// ============================================================================
// DIAGNOSIS ENGINE
// ============================================================================

function diagnoseWorkflow(code: string, filePath: string): DiagnosisResult {
	const issues: DiagnosisIssue[] = [];
	const suggestions: string[] = [];
	const patternsFound: string[] = [];
	const patternsMissing: string[] = [];

	// Check required patterns
	for (const pattern of PATTERN_CHECKS) {
		if (pattern.regex.test(code)) {
			patternsFound.push(pattern.name);
		} else if (pattern.required) {
			issues.push({
				severity: 'error',
				message: `Missing required: ${pattern.name}`,
			});
			patternsMissing.push(pattern.name);
		} else {
			patternsMissing.push(pattern.name);
		}
	}

	// Check anti-patterns
	for (const antiPattern of ANTI_PATTERNS) {
		const matches = code.match(antiPattern.regex);
		if (matches) {
			issues.push({
				severity: antiPattern.severity,
				message: `${antiPattern.message} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
			});
		}
	}

	// Zuhandenheit checks
	for (const check of ZUHANDENHEIT_CHECKS) {
		if (check.check(code)) {
			issues.push({
				severity: 'warning',
				message: check.message,
				suggestion: check.suggestion,
			});
			if (check.suggestion) {
				suggestions.push(check.suggestion);
			}
		}
	}

	// Missing error handling suggestion
	if (!code.includes('onError')) {
		suggestions.push('Consider adding onError handler for graceful failure and debugging.');
	}

	// Calculate score
	const errorCount = issues.filter(i => i.severity === 'error').length;
	const warningCount = issues.filter(i => i.severity === 'warning').length;
	const infoCount = issues.filter(i => i.severity === 'info').length;
	const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10 - infoCount * 2);

	// Generate summary
	let summary: string;
	if (score >= 90) {
		summary = '✅ Excellent! Workflow follows WORKWAY patterns well.';
	} else if (score >= 70) {
		summary = '🟡 Good workflow with minor improvements suggested.';
	} else if (score >= 50) {
		summary = '⚠️ Workflow has issues to address before publishing.';
	} else {
		summary = '❌ Workflow needs significant improvements.';
	}

	return {
		file: filePath,
		score,
		issues,
		suggestions,
		patterns: { found: patternsFound, missing: patternsMissing },
		summary,
	};
}

// ============================================================================
// COMMAND
// ============================================================================

export async function diagnoseCommand(
	filePath?: string,
	options?: DiagnoseOptions
): Promise<void> {
	Logger.header('Workflow Diagnosis');
	Logger.blank();

	// Determine file to analyze
	let targetFile = filePath;
	if (!targetFile) {
		// Try common workflow file names
		const candidates = ['workflow.ts', 'src/workflow.ts', 'index.ts'];
		for (const candidate of candidates) {
			try {
				await fs.access(candidate);
				targetFile = candidate;
				break;
			} catch {
				// Continue
			}
		}
	}

	if (!targetFile) {
		Logger.error('No workflow file specified or found.');
		Logger.log('Usage: workway diagnose [file]');
		Logger.log('');
		Logger.log('If no file specified, looks for workflow.ts, src/workflow.ts, or index.ts');
		process.exit(1);
	}

	// Read file
	const spinner = Logger.spinner(`Analyzing ${targetFile}...`);

	let code: string;
	try {
		code = await fs.readFile(targetFile, 'utf-8');
	} catch (error) {
		spinner.fail(`Could not read file: ${targetFile}`);
		process.exit(1);
	}

	// Run diagnosis
	const result = diagnoseWorkflow(code, targetFile);
	spinner.succeed('Analysis complete');
	Logger.blank();

	// Output
	if (options?.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	// Summary
	Logger.log(result.summary);
	Logger.log(`Score: ${result.score}/100`);
	Logger.blank();

	// Issues
	if (result.issues.length > 0) {
		Logger.section('Issues');

		const errors = result.issues.filter(i => i.severity === 'error');
		const warnings = result.issues.filter(i => i.severity === 'warning');
		const infos = result.issues.filter(i => i.severity === 'info');

		if (errors.length > 0) {
			for (const issue of errors) {
				Logger.error(`❌ ${issue.message}`);
			}
		}

		if (warnings.length > 0) {
			for (const issue of warnings) {
				Logger.warn(`⚠️  ${issue.message}`);
			}
		}

		if (infos.length > 0 && options?.verbose) {
			for (const issue of infos) {
				Logger.info(`ℹ️  ${issue.message}`);
			}
		}

		Logger.blank();
	}

	// Patterns
	if (options?.verbose) {
		Logger.section('Patterns Detected');
		Logger.log(`Found: ${result.patterns.found.join(', ') || 'none'}`);
		Logger.log(`Missing: ${result.patterns.missing.join(', ') || 'none'}`);
		Logger.blank();
	}

	// Suggestions
	if (result.suggestions.length > 0) {
		Logger.section('Suggestions');
		for (const suggestion of result.suggestions) {
			Logger.listItem(suggestion);
		}
		Logger.blank();
	}

	// Next steps
	if (result.score < 100) {
		Logger.section('Next Steps');
		if (result.issues.filter(i => i.severity === 'error').length > 0) {
			Logger.listItem('Fix errors before publishing');
		}
		Logger.listItem('Run `workway workflow validate` for structural validation');
		Logger.listItem('Run `workway workflow test --mock` to test execution');
	}
}

export default diagnoseCommand;

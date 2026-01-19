/**
 * RLM-Powered Gas Town Worker Assessment
 *
 * Uses RLM (Recursive Language Model) to comprehensively assess worker outputs.
 * Processes ALL worker files (vs sampling) for quality, completeness, security.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';
import { runRLM, type RLMResult } from '@workwayco/rlm';

/**
 * Quality assessment for a single worker
 */
export interface WorkerQualityAssessment {
	workerId: string;
	overallScore: number; // 0-100
	codeQuality: number; // 0-100
	completeness: number; // 0-100
	security: number; // 0-100
	gitHygiene: number; // 0-100
	issues: Array<{
		severity: 'critical' | 'high' | 'medium' | 'low';
		category: 'code' | 'completeness' | 'security' | 'git';
		message: string;
		location?: string;
	}>;
	summary: string;
}

/**
 * Aggregate assessment across all workers
 */
export interface WorkersAssessmentResult {
	success: boolean;
	workers: WorkerQualityAssessment[];
	aggregateFindings: {
		totalIssues: number;
		criticalIssues: number;
		commonPatterns: string[];
		recommendations: string[];
	};
	rlmMetrics: {
		iterations: number;
		subCalls: number;
		costUsd: number;
		durationMs: number;
	};
	error?: string;
}

/**
 * Load all output files for a worker
 */
async function loadWorkerOutputs(
	workerId: string,
	outputDir: string,
): Promise<string> {
	const pattern = join(outputDir, `${workerId}*.output`);
	const files = await glob(pattern);

	if (files.length === 0) {
		throw new Error(`No output files found for worker ${workerId}`);
	}

	let combined = `=== Worker ${workerId} Outputs ===\n\n`;

	for (const file of files) {
		const content = await readFile(file, 'utf-8');
		combined += `\n--- File: ${file} ---\n${content}\n`;
	}

	return combined;
}

/**
 * Load all outputs for multiple workers
 */
async function loadAllWorkerOutputs(
	workerIds: string[],
	outputDir: string,
): Promise<string> {
	const outputs = await Promise.all(
		workerIds.map((id) => loadWorkerOutputs(id, outputDir)),
	);

	return outputs.join('\n\n' + '='.repeat(80) + '\n\n');
}

/**
 * Parse RLM assessment result into structured format
 */
function parseAssessmentResult(
	rlmAnswer: string,
	workerIds: string[],
): WorkerQualityAssessment[] {
	const assessments: WorkerQualityAssessment[] = [];

	// Try to parse as JSON first (if RLM returned structured data)
	try {
		const parsed = JSON.parse(rlmAnswer);
		if (Array.isArray(parsed.workers)) {
			return parsed.workers;
		}
	} catch {
		// Not JSON, parse as text
	}

	// Fallback: parse text-based assessment
	const workerSections = rlmAnswer.split(/Worker (\w+):/i);

	for (let i = 1; i < workerSections.length; i += 2) {
		const workerId = workerSections[i].trim();
		const content = workerSections[i + 1] || '';

		// Extract scores (look for patterns like "Score: 85/100" or "Quality: 90")
		const scoreMatch = content.match(/overall.*?(\d+)/i);
		const codeMatch = content.match(/code quality.*?(\d+)/i);
		const completeMatch = content.match(/completeness.*?(\d+)/i);
		const securityMatch = content.match(/security.*?(\d+)/i);
		const gitMatch = content.match(/git.*?(\d+)/i);

		// Extract issues
		const issues: WorkerQualityAssessment['issues'] = [];
		const issueMatches = content.matchAll(
			/\[(critical|high|medium|low)\].*?:(.*?)(?=\[|$)/gis,
		);

		for (const match of issueMatches) {
			const severity = match[1].toLowerCase() as
				| 'critical'
				| 'high'
				| 'medium'
				| 'low';
			const message = match[2].trim();

			issues.push({
				severity,
				category: 'code', // Default, could be smarter
				message,
			});
		}

		// Extract summary (first paragraph or sentence)
		const summaryMatch = content.match(/^([^.\n]+\.[^.\n]*)/);

		assessments.push({
			workerId,
			overallScore: scoreMatch ? parseInt(scoreMatch[1]) : 50,
			codeQuality: codeMatch ? parseInt(codeMatch[1]) : 50,
			completeness: completeMatch ? parseInt(completeMatch[1]) : 50,
			security: securityMatch ? parseInt(securityMatch[1]) : 50,
			gitHygiene: gitMatch ? parseInt(gitMatch[1]) : 50,
			issues,
			summary: summaryMatch
				? summaryMatch[1]
				: 'Assessment completed. See detailed output.',
		});
	}

	return assessments.length > 0
		? assessments
		: workerIds.map((id) => ({
				workerId: id,
				overallScore: 50,
				codeQuality: 50,
				completeness: 50,
				security: 50,
				gitHygiene: 50,
				issues: [],
				summary: 'Unable to parse assessment. See RLM output.',
		  }));
}

/**
 * Assess all Gas Town worker outputs using RLM
 *
 * @param workerIds - Array of worker IDs to assess
 * @param outputDir - Directory containing worker output files (default: /private/tmp/claude/...)
 * @returns Comprehensive assessment result
 */
export async function assessWorkers(
	workerIds: string[],
	outputDir: string = '/private/tmp/claude/-Users-micahjohnson-Documents-Github-WORKWAY/tasks',
): Promise<WorkersAssessmentResult> {
	const startTime = Date.now();

	try {
		// Load all worker outputs
		const context = await loadAllWorkerOutputs(workerIds, outputDir);

		// Construct assessment query
		const query = `
Evaluate all Gas Town worker outputs comprehensively.

For each worker, assess:

1. **Code Quality** (0-100):
   - DRY violations (repeated code patterns)
   - Proper use of existing patterns
   - TypeScript best practices
   - Error handling

2. **Completeness** (0-100):
   - Acceptance criteria met
   - All requested features implemented
   - Edge cases handled
   - Tests written

3. **Security** (0-100):
   - Authentication patterns correct
   - Input validation present
   - No secret leaks
   - SQL injection prevention

4. **Git Hygiene** (0-100):
   - Commit messages clear and descriptive
   - File organization proper
   - No unnecessary files committed
   - Commit granularity appropriate

For each issue found, categorize by severity:
- **[CRITICAL]**: Security vulnerabilities, data loss risks, breaking changes
- **[HIGH]**: Major bugs, missing acceptance criteria, bad patterns
- **[MEDIUM]**: DRY violations, minor bugs, incomplete tests
- **[LOW]**: Code style, minor improvements, documentation

Provide per-worker scores and aggregate findings.

Output format (JSON preferred):
{
  "workers": [
    {
      "workerId": "a548b2a",
      "overallScore": 85,
      "codeQuality": 90,
      "completeness": 80,
      "security": 95,
      "gitHygiene": 75,
      "issues": [
        {"severity": "high", "category": "completeness", "message": "Missing Phase 3.3 implementation"}
      ],
      "summary": "Strong implementation with comprehensive observability infrastructure."
    }
  ],
  "aggregateFindings": {
    "commonPatterns": ["Excellent error handling across all workers"],
    "recommendations": ["Add integration tests for Phase 3 implementations"]
  }
}
`.trim();

		// Run RLM assessment
		const rlmResult: RLMResult = await runRLM(context, query, {
			rootModel: 'sonnet',
			subModel: 'haiku',
			maxIterations: 15,
			maxSubCalls: 80,
		});

		const durationMs = Date.now() - startTime;

		if (!rlmResult.success || !rlmResult.answer) {
			return {
				success: false,
				workers: [],
				aggregateFindings: {
					totalIssues: 0,
					criticalIssues: 0,
					commonPatterns: [],
					recommendations: [],
				},
				rlmMetrics: {
					iterations: rlmResult.iterations,
					subCalls: rlmResult.subCalls,
					costUsd: rlmResult.costUsd,
					durationMs,
				},
				error: rlmResult.error || 'RLM session failed without error message',
			};
		}

		// Parse assessment
		const workers = parseAssessmentResult(rlmResult.answer, workerIds);

		// Calculate aggregate findings
		const allIssues = workers.flatMap((w) => w.issues);
		const criticalIssues = allIssues.filter((i) => i.severity === 'critical');

		// Extract common patterns from RLM answer
		const commonPatterns: string[] = [];
		const recommendations: string[] = [];

		const patternsMatch = rlmResult.answer.match(
			/common patterns?:?\s*\n?(.*?)(?=\n\n|recommendations?:|$)/is,
		);
		if (patternsMatch) {
			const patterns = patternsMatch[1]
				.split('\n')
				.map((p) => p.replace(/^[-*]\s*/, '').trim())
				.filter((p) => p.length > 0);
			commonPatterns.push(...patterns);
		}

		const recsMatch = rlmResult.answer.match(
			/recommendations?:?\s*\n?(.*?)(?=\n\n|$)/is,
		);
		if (recsMatch) {
			const recs = recsMatch[1]
				.split('\n')
				.map((r) => r.replace(/^[-*]\s*/, '').trim())
				.filter((r) => r.length > 0);
			recommendations.push(...recs);
		}

		return {
			success: true,
			workers,
			aggregateFindings: {
				totalIssues: allIssues.length,
				criticalIssues: criticalIssues.length,
				commonPatterns,
				recommendations,
			},
			rlmMetrics: {
				iterations: rlmResult.iterations,
				subCalls: rlmResult.subCalls,
				costUsd: rlmResult.costUsd,
				durationMs,
			},
		};
	} catch (error) {
		const durationMs = Date.now() - startTime;

		return {
			success: false,
			workers: [],
			aggregateFindings: {
				totalIssues: 0,
				criticalIssues: 0,
				commonPatterns: [],
				recommendations: [],
			},
			rlmMetrics: {
				iterations: 0,
				subCalls: 0,
				costUsd: 0,
				durationMs,
			},
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Format assessment result for console output
 */
export function formatAssessmentResult(
	result: WorkersAssessmentResult,
): string {
	if (!result.success) {
		return `❌ Assessment failed: ${result.error}`;
	}

	let output = '📊 Gas Town Worker Assessment\n\n';

	// Per-worker results
	for (const worker of result.workers) {
		output += `\n${'='.repeat(60)}\n`;
		output += `Worker: ${worker.workerId}\n`;
		output += `Overall Score: ${worker.overallScore}/100\n`;
		output += `  Code Quality:  ${worker.codeQuality}/100\n`;
		output += `  Completeness:  ${worker.completeness}/100\n`;
		output += `  Security:      ${worker.security}/100\n`;
		output += `  Git Hygiene:   ${worker.gitHygiene}/100\n`;
		output += `\nSummary: ${worker.summary}\n`;

		if (worker.issues.length > 0) {
			output += `\nIssues (${worker.issues.length}):\n`;
			for (const issue of worker.issues) {
				const icon =
					issue.severity === 'critical'
						? '🔴'
						: issue.severity === 'high'
						  ? '🟠'
						  : issue.severity === 'medium'
						    ? '🟡'
						    : '⚪';
				output += `  ${icon} [${issue.severity.toUpperCase()}] ${issue.message}\n`;
			}
		}
	}

	// Aggregate findings
	output += `\n${'='.repeat(60)}\n`;
	output += 'Aggregate Findings\n';
	output += `Total Issues: ${result.aggregateFindings.totalIssues}\n`;
	output += `Critical Issues: ${result.aggregateFindings.criticalIssues}\n`;

	if (result.aggregateFindings.commonPatterns.length > 0) {
		output += '\nCommon Patterns:\n';
		for (const pattern of result.aggregateFindings.commonPatterns) {
			output += `  ✓ ${pattern}\n`;
		}
	}

	if (result.aggregateFindings.recommendations.length > 0) {
		output += '\nRecommendations:\n';
		for (const rec of result.aggregateFindings.recommendations) {
			output += `  → ${rec}\n`;
		}
	}

	// RLM metrics
	output += `\n${'='.repeat(60)}\n`;
	output += 'RLM Metrics\n';
	output += `Iterations: ${result.rlmMetrics.iterations}\n`;
	output += `Sub-calls: ${result.rlmMetrics.subCalls}\n`;
	output += `Cost: $${result.rlmMetrics.costUsd.toFixed(4)}\n`;
	output += `Duration: ${(result.rlmMetrics.durationMs / 1000).toFixed(1)}s\n`;

	return output;
}

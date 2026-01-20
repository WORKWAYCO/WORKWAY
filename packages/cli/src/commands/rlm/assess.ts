/**
 * RLM Assessment Command
 *
 * Assess Gas Town worker outputs using RLM for comprehensive quality analysis.
 */

import { Logger } from '../../utils/logger.js';

// Dynamic import to make harness optional
let assessWorkers: any;
let formatAssessmentResult: any;

async function loadHarness() {
	try {
		const harness = await import('@workwayco/harness');
		assessWorkers = harness.assessWorkers;
		formatAssessmentResult = harness.formatAssessmentResult;
		return true;
	} catch {
		return false;
	}
}

export interface RLMAssessOptions {
	workers?: string;
	json?: boolean;
	verbose?: boolean;
	outputDir?: string;
}

/**
 * Assess Gas Town worker outputs using RLM
 *
 * @example
 * workway rlm assess --workers a548b2a,aaca4cf,a40570f
 * workway rlm assess --json
 * workway rlm assess --verbose
 */
export async function rlmAssessCommand(options: RLMAssessOptions): Promise<void> {
	try {
		// Load harness module (optional dependency)
		const harnessLoaded = await loadHarness();
		if (!harnessLoaded) {
			Logger.error('RLM assessment requires @workwayco/harness package');
			Logger.log('Install with: pnpm add @workwayco/harness');
			process.exit(1);
		}

		// Parse worker IDs
		let workerIds: string[] = [];

		if (options.workers) {
			workerIds = options.workers.split(',').map((id) => id.trim());
		} else {
			// Auto-detect from Gas Town output directory
			const { glob } = await import('glob');
			const outputDir =
				options.outputDir ||
				'/private/tmp/claude/-Users-micahjohnson-Documents-Github-WORKWAY/tasks';

			const files = await glob(`${outputDir}/*.output`);
			if (files.length === 0) {
				Logger.error('No worker output files found');
				Logger.log('');
				Logger.log('Searched directory: ' + outputDir);
				Logger.log('');
				Logger.log('Specify workers manually with --workers:');
				Logger.log('  workway rlm assess --workers a548b2a,aaca4cf');
				process.exit(1);
			}

			// Extract unique worker IDs from filenames
			const idSet = new Set<string>();
			for (const file of files) {
				const match = file.match(/([a-f0-9]{7,}).*\.output$/);
				if (match) {
					idSet.add(match[1]);
				}
			}

			workerIds = Array.from(idSet);
			Logger.log(`Auto-detected ${workerIds.length} workers: ${workerIds.join(', ')}`);
			Logger.blank();
		}

		if (workerIds.length === 0) {
			Logger.error('No worker IDs provided');
			Logger.log('');
			Logger.log('Usage: workway rlm assess --workers <id1>,<id2>,...');
			process.exit(1);
		}

		// Run RLM assessment
		Logger.header('RLM Worker Assessment');
		Logger.blank();
		Logger.log(`Assessing ${workerIds.length} workers...`);
		Logger.log(`Workers: ${workerIds.join(', ')}`);
		Logger.blank();

		const startTime = Date.now();
		const result = await assessWorkers(workerIds, options.outputDir);
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		// Output results
		if (options.json) {
			// JSON output
			console.log(JSON.stringify(result, null, 2));
		} else {
			// Formatted output
			const formatted = formatAssessmentResult(result);
			console.log(formatted);

			// Summary
			Logger.blank();
			if (result.success) {
				Logger.success(`Assessment completed in ${duration}s`);

				if (result.aggregateFindings.criticalIssues > 0) {
					Logger.warn(
						`Found ${result.aggregateFindings.criticalIssues} critical issues that require immediate attention`
					);
				}
			} else {
				Logger.error(`Assessment failed: ${result.error}`);
				process.exit(1);
			}
		}

		// Verbose mode: show RLM details
		if (options.verbose && result.success) {
			Logger.blank();
			Logger.header('RLM Details');
			Logger.blank();
			Logger.log(`Total Iterations: ${result.rlmMetrics.iterations}`);
			Logger.log(`Sub-calls Made: ${result.rlmMetrics.subCalls}`);
			Logger.log(`Cost: $${result.rlmMetrics.costUsd.toFixed(4)}`);
			Logger.log(`Duration: ${(result.rlmMetrics.durationMs / 1000).toFixed(1)}s`);
		}
	} catch (error: any) {
		Logger.error('RLM assessment failed');
		Logger.blank();
		Logger.log(error.message);

		if (error.message.includes('Python') || error.message.includes('workway_rlm')) {
			Logger.blank();
			Logger.log('RLM requires Python 3.11+ with workway_rlm package:');
			Logger.log('  cd packages/rlm');
			Logger.log('  pip install -e .');
			Logger.blank();
			Logger.log('Also ensure ANTHROPIC_API_KEY is set:');
			Logger.log('  export ANTHROPIC_API_KEY=sk-...');
		}

		throw error;
	}
}

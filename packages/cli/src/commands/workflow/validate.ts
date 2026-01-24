/**
 * Workflow Validate Command
 *
 * Validates a workflow against the WORKWAY schema without building.
 * Useful for CI/CD pipelines and quick checks.
 *
 * Use --benchmark to see timing information for validator performance.
 * Use --wasm to force WASM validator (or --no-wasm to force TypeScript).
 */

import path from 'path';
import { Logger } from '../../utils/logger.js';
import { validateWorkflowFile, formatValidationResults, benchmarkValidation } from '../../lib/workflow-validator.js';
import { isBenchmarkEnabled } from '../../lib/benchmark.js';
import {
	validateWorkflowFileHybrid,
	getValidatorInfo,
	benchmarkValidators,
	isWasmAvailable,
} from '../../lib/wasm-validator.js';

interface ValidateOptions {
	strict?: boolean;
	json?: boolean;
	benchmark?: boolean;
	iterations?: number;
	wasm?: boolean;
	compareValidators?: boolean;
}

export async function workflowValidateCommand(
	workflowPath: string = 'workflow.ts',
	options: ValidateOptions = {}
): Promise<void> {
	try {
		const absolutePath = path.resolve(process.cwd(), workflowPath);

		// Enable benchmark mode via flag or env var
		if (options.benchmark) {
			process.env.WORKWAY_BENCHMARK = '1';
		}

		// Get validator info
		const validatorInfo = await getValidatorInfo();

		if (!options.json) {
			Logger.header('Validate Workflow');
			Logger.listItem(`File: ${workflowPath}`);
			Logger.listItem(`Validator: ${validatorInfo.type}${validatorInfo.version ? ` v${validatorInfo.version}` : ''}`);
			if (options.benchmark || isBenchmarkEnabled()) {
				Logger.listItem(`Benchmark: enabled`);
			}
			Logger.blank();
		}

		// Compare validators if requested
		if (options.compareValidators) {
			const comparison = await benchmarkValidators(absolutePath, options.iterations || 10);

			if (options.json) {
				console.log(JSON.stringify(comparison, null, 2));
				return;
			}

			Logger.section('Validator Comparison');
			Logger.listItem(`WASM available: ${comparison.wasmAvailable}`);
			if (comparison.wasm) {
				Logger.listItem(`WASM avg: ${comparison.wasm.avgMs.toFixed(3)}ms`);
			}
			Logger.listItem(`TypeScript avg: ${comparison.typescript.avgMs.toFixed(3)}ms`);
			if (comparison.speedup) {
				Logger.listItem(`Speedup: ${comparison.speedup.toFixed(1)}x faster with WASM`);
			}
			Logger.blank();
			return;
		}

		// If benchmarking with iterations, run the full benchmark
		if (options.benchmark && options.iterations && options.iterations > 1) {
			const benchResult = await benchmarkValidation([absolutePath], options.iterations);

			if (options.json) {
				console.log(JSON.stringify(benchResult, null, 2));
				return;
			}

			Logger.section('Benchmark Results');
			Logger.listItem(`Iterations: ${benchResult.totalIterations}`);
			Logger.listItem(`Total time: ${benchResult.totalMs.toFixed(2)}ms`);
			Logger.listItem(`Avg per validation: ${benchResult.avgPerFile.toFixed(2)}ms`);
			Logger.blank();

			// Still show validation result for the last run
			const lastResult = benchResult.results[benchResult.results.length - 1];
			Logger.log(lastResult.valid ? '✅ Workflow is valid' : '❌ Workflow has errors');
			return;
		}

		// Use hybrid validator (WASM with TS fallback) unless --no-wasm
		const result = options.wasm === false
			? await validateWorkflowFile(absolutePath)
			: await validateWorkflowFileHybrid(absolutePath);

		// JSON output mode
		if (options.json) {
			console.log(JSON.stringify(result, null, 2));
			process.exit(result.valid ? 0 : 1);
		}

		// Display validation results
		if (result.errors.length > 0) {
			Logger.error(`Validation failed with ${result.errors.length} error(s)`);
			Logger.blank();

			for (const error of result.errors) {
				Logger.error(`${error.code}: ${error.message}`);
				if (error.suggestion) {
					Logger.log(`        💡 ${error.suggestion}`);
				}
			}

			if (result.warnings.length > 0) {
				Logger.blank();
				Logger.warn(`Also found ${result.warnings.length} warning(s)`);
				for (const warning of result.warnings) {
					Logger.warn(`${warning.code}: ${warning.message}`);
					if (warning.suggestion) {
						Logger.log(`        💡 ${warning.suggestion}`);
					}
				}
			}

			process.exit(1);
		}

		// In strict mode, warnings are treated as errors
		if (options.strict && result.warnings.length > 0) {
			Logger.error('Validation failed (strict mode)');
			Logger.blank();
			for (const warning of result.warnings) {
				Logger.error(`${warning.code}: ${warning.message}`);
				if (warning.suggestion) {
					Logger.log(`        💡 ${warning.suggestion}`);
				}
			}
			process.exit(1);
		}

		// Display warnings
		if (result.warnings.length > 0) {
			Logger.warn(`Validation passed with ${result.warnings.length} warning(s)`);
			Logger.blank();
			for (const warning of result.warnings) {
				Logger.warn(`${warning.code}: ${warning.message}`);
				if (warning.suggestion) {
					Logger.log(`        💡 ${warning.suggestion}`);
				}
			}
		} else {
			Logger.success('Validation passed');
		}

		// Display metadata
		Logger.blank();
		Logger.section('Workflow Metadata');
		if (result.metadata?.name) {
			Logger.listItem(`Name: ${result.metadata.name}`);
		}
		if (result.metadata?.type) {
			Logger.listItem(`Type: ${result.metadata.type}`);
		}
		if (result.metadata?.trigger) {
			Logger.listItem(`Trigger: ${result.metadata.trigger}`);
		}
		if (result.metadata?.integrations?.length) {
			Logger.listItem(`Integrations: ${result.metadata.integrations.join(', ')}`);
		}
		if (result.metadata?.hasAI) {
			Logger.listItem(`AI: Workers AI enabled`);
		}
		if (result.metadata?.pricing) {
			const pricing = result.metadata.pricing;
			Logger.listItem(`Pricing: ${pricing.model || 'unknown'} - $${pricing.price || 0}`);
		}

		// Display benchmark timing if enabled
		if (result.benchmark) {
			Logger.blank();
			Logger.section('Performance Benchmark');
			Logger.listItem(`Total: ${result.benchmark.totalMs.toFixed(2)}ms`);

			// Sort phases by duration
			const sortedPhases = Object.entries(result.benchmark.phases)
				.sort((a, b) => b[1] - a[1]);

			for (const [phase, duration] of sortedPhases) {
				const pct = ((duration / result.benchmark.totalMs) * 100).toFixed(1);
				Logger.listItem(`${phase}: ${duration.toFixed(2)}ms (${pct}%)`);
			}
		}

	} catch (error: any) {
		if (options.json) {
			console.log(JSON.stringify({
				valid: false,
				errors: [{ code: 'UNEXPECTED_ERROR', message: error.message }],
				warnings: [],
			}));
		} else {
			Logger.error(error.message);
		}
		process.exit(1);
	}
}

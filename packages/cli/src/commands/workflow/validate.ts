/**
 * Workflow Validate Command
 *
 * Validates a workflow against the WORKWAY schema without building.
 * Useful for CI/CD pipelines and quick checks.
 */

import path from 'path';
import { Logger } from '../../utils/logger.js';
import { validateWorkflowFile, formatValidationResults } from '../../lib/workflow-validator.js';

interface ValidateOptions {
	strict?: boolean;
	json?: boolean;
}

export async function workflowValidateCommand(
	workflowPath: string = 'workflow.ts',
	options: ValidateOptions = {}
): Promise<void> {
	try {
		const absolutePath = path.resolve(process.cwd(), workflowPath);

		if (!options.json) {
			Logger.header('Validate Workflow');
			Logger.listItem(`File: ${workflowPath}`);
			Logger.blank();
		}

		const result = await validateWorkflowFile(absolutePath);

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

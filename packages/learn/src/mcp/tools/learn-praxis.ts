/**
 * learn_praxis Tool
 *
 * Execute workflow building exercises with validation.
 * Local validation provides detailed feedback; API submission syncs progress.
 */

import { readFileSync, existsSync } from 'node:fs';
import { isAuthenticated } from '../../api/auth.js';
import { getClient } from '../../api/client.js';
import type { PraxisSubmission } from '../../types/index.js';

export const definition = {
	name: 'learn_praxis',
	description: 'Execute workflow building exercises with pattern validation',
	inputSchema: {
		type: 'object' as const,
		properties: {
			praxisId: {
				type: 'string',
				description: 'The praxis exercise ID (lesson ID like "first-workflow")'
			},
			workflowCode: {
				type: 'string',
				description: 'The workflow code to validate (inline)'
			},
			workflowPath: {
				type: 'string',
				description: 'Path to a local workflow file to validate'
			},
			evidence: {
				type: 'string',
				description: 'Evidence of completion for non-code exercises'
			},
			reflection: {
				type: 'string',
				description: 'Personal reflection on what you learned'
			},
			validateOnly: {
				type: 'boolean',
				description: 'Only validate locally, do not submit to API'
			}
		},
		required: ['praxisId']
	}
};

export interface LearnPraxisInput {
	praxisId: string;
	workflowCode?: string;
	workflowPath?: string;
	evidence?: string;
	reflection?: string;
	validateOnly?: boolean;
}

export interface LocalPraxisResult {
	valid: boolean;
	score?: number;
	feedback: {
		overall: string;
		strengths: string[];
		improvements: string[];
		patterns: {
			zuhandenheit: { score: number; notes: string };
			integrationUsage: { correct: boolean; notes: string };
			configSchema: { valid: boolean; notes: string };
		};
	};
	submitted: boolean;
	serverFeedback?: string;
	nextSteps?: string[];
}

export async function handler(input: LearnPraxisInput): Promise<LocalPraxisResult> {
	const { praxisId, workflowCode, workflowPath, evidence, reflection, validateOnly } = input;

	// Get code from file if path provided
	let code = workflowCode;
	if (workflowPath && !code) {
		if (!existsSync(workflowPath)) {
			return {
				valid: false,
				feedback: {
					overall: `File not found: ${workflowPath}`,
					strengths: [],
					improvements: ['Provide a valid file path or inline code'],
					patterns: {
						zuhandenheit: { score: 0, notes: 'Could not analyze' },
						integrationUsage: { correct: false, notes: 'Could not analyze' },
						configSchema: { valid: false, notes: 'Could not analyze' }
					}
				},
				submitted: false
			};
		}
		code = readFileSync(workflowPath, 'utf-8');
	}

	// Validate the code locally
	const validation = validateWorkflowCode(code || '');

	// Build result with local validation
	const result: LocalPraxisResult = {
		valid: validation.valid,
		score: validation.score,
		feedback: {
			overall: validation.overall,
			strengths: validation.strengths,
			improvements: validation.improvements,
			patterns: validation.patterns
		},
		submitted: false
	};

	// Submit to API if not validate-only and authenticated
	if (!validateOnly && isAuthenticated()) {
		try {
			const client = getClient();

			// Build evidence string for API
			const evidenceText = evidence || code
				? `Validated workflow code:\n\`\`\`typescript\n${code?.slice(0, 500)}${code && code.length > 500 ? '...' : ''}\n\`\`\``
				: 'Completed exercise';

			const submission: PraxisSubmission = {
				evidence: evidenceText,
				reflection
			};

			const serverResult = await client.submitPraxis(praxisId, submission);
			result.submitted = true;
			result.serverFeedback = serverResult.feedback;
			result.nextSteps = serverResult.nextSteps;
		} catch {
			// Submission failed, keep local validation only
		}
	}

	return result;
}

interface ValidationResult {
	valid: boolean;
	score: number;
	overall: string;
	strengths: string[];
	improvements: string[];
	patterns: {
		zuhandenheit: { score: number; notes: string };
		integrationUsage: { correct: boolean; notes: string };
		configSchema: { valid: boolean; notes: string };
	};
}

/**
 * Validate workflow code against WORKWAY patterns
 */
function validateWorkflowCode(code: string): ValidationResult {
	const result: ValidationResult = {
		valid: false,
		score: 0,
		overall: '',
		strengths: [],
		improvements: [],
		patterns: {
			zuhandenheit: { score: 0, notes: '' },
			integrationUsage: { correct: false, notes: '' },
			configSchema: { valid: false, notes: '' }
		}
	};

	if (!code.trim()) {
		result.overall = 'No code provided';
		result.improvements.push('Provide workflow code to validate');
		return result;
	}

	let score = 0;
	const maxScore = 100;

	// Check for defineWorkflow pattern
	const hasDefineWorkflow = /defineWorkflow\s*\(/i.test(code);
	if (hasDefineWorkflow) {
		score += 20;
		result.strengths.push('Uses defineWorkflow() pattern');
	} else {
		result.improvements.push('Use defineWorkflow() to define your workflow');
	}

	// Check for export default
	const hasExportDefault = /export\s+default/i.test(code);
	if (hasExportDefault) {
		score += 10;
		result.strengths.push('Exports workflow as default');
	} else {
		result.improvements.push('Export your workflow as default');
	}

	// Check for integrations array
	const hasIntegrations = /integrations\s*:\s*\[/i.test(code);
	if (hasIntegrations) {
		score += 15;
		result.strengths.push('Declares integrations');
		result.patterns.integrationUsage = { correct: true, notes: 'Integration array present' };
	} else {
		result.improvements.push('Declare integrations array');
		result.patterns.integrationUsage = { correct: false, notes: 'Missing integrations array' };
	}

	// Check for configSchema
	const hasConfigSchema = /configSchema\s*:\s*\{/i.test(code);
	if (hasConfigSchema) {
		score += 15;
		result.strengths.push('Has configuration schema');
		result.patterns.configSchema = { valid: true, notes: 'Config schema present' };
	} else {
		result.improvements.push('Add configSchema for user configuration');
		result.patterns.configSchema = { valid: false, notes: 'Missing configSchema' };
	}

	// Check for execute function
	const hasExecute = /execute\s*:\s*(async\s*)?\(?.*\)?\s*=>/i.test(code) || /async\s+execute\s*\(/i.test(code);
	if (hasExecute) {
		score += 15;
		result.strengths.push('Has execute function');
	} else {
		result.improvements.push('Implement execute function');
	}

	// Check for error handling
	const hasErrorHandling = /try\s*\{|\.catch\s*\(|onError\s*:/i.test(code);
	if (hasErrorHandling) {
		score += 10;
		result.strengths.push('Includes error handling');
	} else {
		result.improvements.push('Add error handling (try/catch or onError)');
	}

	// Zuhandenheit check: outcome-focused naming
	const hasOutcomeName = /name\s*:\s*['"][^'"]*(?:after|when|follow|sync|save|notify|update|create)[^'"]*['"]/i.test(code);
	if (hasOutcomeName) {
		result.patterns.zuhandenheit = { score: 80, notes: 'Name suggests outcome, not mechanism' };
		score += 10;
		result.strengths.push('Outcome-focused naming');
	} else {
		result.patterns.zuhandenheit = { score: 40, notes: 'Consider naming for outcomes, not mechanisms' };
		result.improvements.push('Use outcome-focused naming (what happens, not how)');
	}

	// Check for sensible defaults
	const hasDefaults = /default\s*:/i.test(code);
	if (hasDefaults) {
		score += 5;
		result.strengths.push('Uses sensible defaults');
	}

	// Final score and validity
	result.score = Math.min(score, maxScore);
	result.valid = result.score >= 60;

	// Generate overall message
	if (result.score >= 80) {
		result.overall = 'Excellent! Your workflow follows WORKWAY patterns well.';
	} else if (result.score >= 60) {
		result.overall = 'Good structure. A few improvements would make it even better.';
	} else if (result.score >= 40) {
		result.overall = 'Basic structure present. Review the defineWorkflow() pattern.';
	} else {
		result.overall = 'Needs work. Start with the defineWorkflow() pattern tutorial.';
	}

	return result;
}

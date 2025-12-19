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
	exerciseType: 'workflow' | 'setup' | 'conceptual' | 'configuration';
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

	// Determine exercise type based on praxisId
	const exerciseType = detectExerciseType(praxisId);

	// Get code from file if path provided
	let code = workflowCode;
	if (workflowPath && !code) {
		if (!existsSync(workflowPath)) {
			return {
				valid: false,
				exerciseType,
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

	// Validate based on exercise type
	let validation: ValidationResult;

	switch (exerciseType) {
		case 'workflow':
			// Full workflow code validation
			validation = validateWorkflowCode(code || '');
			break;

		case 'setup':
			// Setup exercises - validate evidence of tool installation
			validation = validateSetupExercise(praxisId, evidence, code);
			break;

		case 'configuration':
			// Configuration exercises - validate config/schema code
			validation = validateConfigurationExercise(praxisId, code, evidence);
			break;

		case 'conceptual':
		default:
			// Conceptual exercises - validate reflection/understanding
			validation = validateConceptualExercise(praxisId, evidence, reflection);
			break;
	}

	// Build result with local validation
	const result: LocalPraxisResult = {
		valid: validation.valid,
		score: validation.score,
		exerciseType,
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

			// Build evidence string for API based on exercise type
			let evidenceText = evidence || '';
			if (exerciseType === 'workflow' && code) {
				evidenceText = `Validated workflow code:\n\`\`\`typescript\n${code.slice(0, 500)}${code.length > 500 ? '...' : ''}\n\`\`\``;
			} else if (exerciseType === 'configuration' && code) {
				evidenceText = `Configuration:\n\`\`\`typescript\n${code.slice(0, 500)}${code.length > 500 ? '...' : ''}\n\`\`\``;
			} else if (!evidenceText) {
				evidenceText = 'Completed exercise';
			}

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

/**
 * Detect exercise type based on praxisId
 * Maps lesson IDs to exercise categories
 */
function detectExerciseType(praxisId: string): 'workflow' | 'setup' | 'conceptual' | 'configuration' {
	// Workflow exercises (building actual workflows)
	const workflowExercises = [
		'first-workflow',
		'working-with-integrations',
		'workers-ai',
		'error-handling',
		'common-pitfalls',
		'compound-workflows',
		'private-workflows',
		'agency-patterns'
	];

	// Setup exercises (tool installation)
	const setupExercises = [
		'wezterm-setup',
		'claude-code-setup',
		'neomutt-setup',
		'workway-cli',
		'essential-commands',
		'local-testing'
	];

	// Configuration exercises (schema design, config artifacts)
	const configExercises = [
		'config-schemas',
		'triggers',
		'performance-rate-limiting',
		'monitoring-debugging'
	];

	// Conceptual exercises (understanding, philosophy)
	const conceptualExercises = [
		'what-is-workflow',
		'define-workflow-pattern',
		'integrations-oauth',
		'design-philosophy'
	];

	if (workflowExercises.includes(praxisId)) return 'workflow';
	if (setupExercises.includes(praxisId)) return 'setup';
	if (configExercises.includes(praxisId)) return 'configuration';
	if (conceptualExercises.includes(praxisId)) return 'conceptual';

	// Default: if code provided, treat as workflow; otherwise conceptual
	return 'conceptual';
}

/**
 * Validate setup exercises (tool installation)
 */
function validateSetupExercise(praxisId: string, evidence?: string, code?: string): ValidationResult {
	const result: ValidationResult = {
		valid: false,
		score: 0,
		overall: '',
		strengths: [],
		improvements: [],
		patterns: {
			zuhandenheit: { score: 50, notes: 'Setup exercise - tool configuration' },
			integrationUsage: { correct: true, notes: 'N/A for setup' },
			configSchema: { valid: true, notes: 'N/A for setup' }
		}
	};

	// Check for evidence
	if (!evidence && !code) {
		result.overall = 'Provide evidence of tool installation (screenshot description, config file content, or command output)';
		result.improvements.push('Run the setup command and share the output or config');
		return result;
	}

	let score = 0;
	const evidenceText = (evidence || '') + (code || '');

	// Exercise-specific validation
	switch (praxisId) {
		case 'wezterm-setup':
			if (/wezterm|\.lua|config|font|color|background/i.test(evidenceText)) {
				score += 50;
				result.strengths.push('Evidence of WezTerm configuration');
			}
			if (/black|#000|monochrome/i.test(evidenceText)) {
				score += 30;
				result.strengths.push('Pure black theme configured');
			}
			if (/font|JetBrains|mono/i.test(evidenceText)) {
				score += 20;
				result.strengths.push('Monospace font configured');
			}
			break;

		case 'claude-code-setup':
			if (/claude|anthropic|authenticated|logged in/i.test(evidenceText)) {
				score += 50;
				result.strengths.push('Claude Code authentication confirmed');
			}
			if (/pattern|workflow|packages/i.test(evidenceText)) {
				score += 50;
				result.strengths.push('Successfully explored codebase with Claude Code');
			}
			break;

		case 'neomutt-setup':
			if (/neomutt|\.neomuttrc|muttrc/i.test(evidenceText)) {
				score += 40;
				result.strengths.push('Neomutt configuration present');
			}
			if (/gmail|imap|smtp/i.test(evidenceText)) {
				score += 30;
				result.strengths.push('Email account configured');
			}
			if (/j\/k|navigation|search/i.test(evidenceText)) {
				score += 30;
				result.strengths.push('Keyboard navigation practiced');
			}
			break;

		case 'workway-cli':
			if (/workway|version|login|whoami/i.test(evidenceText)) {
				score += 60;
				result.strengths.push('WORKWAY CLI commands executed');
			}
			if (/init|project|workflow/i.test(evidenceText)) {
				score += 40;
				result.strengths.push('Project initialized');
			}
			break;

		case 'essential-commands':
			if (/alias|wd|wdp|wl|gs|cc/i.test(evidenceText)) {
				score += 50;
				result.strengths.push('Shell aliases configured');
			}
			if (/shortcut|keybinding|keyboard/i.test(evidenceText)) {
				score += 50;
				result.strengths.push('Shortcuts practiced');
			}
			break;

		case 'local-testing':
			if (/wrangler|dev|test|mock/i.test(evidenceText)) {
				score += 50;
				result.strengths.push('Local testing environment set up');
			}
			if (/curl|request|response/i.test(evidenceText)) {
				score += 30;
				result.strengths.push('Manual testing performed');
			}
			if (/test suite|describe|it\(|expect/i.test(evidenceText)) {
				score += 20;
				result.strengths.push('Test suite created');
			}
			break;

		default:
			// Generic setup validation
			if (evidenceText.length > 50) {
				score += 60;
				result.strengths.push('Setup evidence provided');
			}
	}

	result.score = Math.min(score, 100);
	result.valid = result.score >= 50;
	result.overall = result.valid
		? 'Setup complete! Tool is ready for use.'
		: 'More evidence needed. Share your config file or command output.';

	if (!result.valid) {
		result.improvements.push('Provide more specific evidence of installation');
	}

	return result;
}

/**
 * Validate configuration exercises (schema design, settings)
 */
function validateConfigurationExercise(praxisId: string, code?: string, evidence?: string): ValidationResult {
	const result: ValidationResult = {
		valid: false,
		score: 0,
		overall: '',
		strengths: [],
		improvements: [],
		patterns: {
			zuhandenheit: { score: 50, notes: 'Configuration exercise' },
			integrationUsage: { correct: true, notes: 'N/A' },
			configSchema: { valid: false, notes: '' }
		}
	};

	const content = (code || '') + (evidence || '');

	if (!content.trim()) {
		result.overall = 'Provide your configuration code or design';
		result.improvements.push('Share your configSchema, trigger definition, or configuration artifact');
		return result;
	}

	let score = 0;

	switch (praxisId) {
		case 'config-schemas':
			// Check for Zod or inputs pattern
			if (/z\.\w+|configSchema|inputs\s*:\s*\{/i.test(content)) {
				score += 30;
				result.strengths.push('Schema definition present');
				result.patterns.configSchema = { valid: true, notes: 'Schema defined' };
			}
			if (/default\s*:/i.test(content)) {
				score += 25;
				result.strengths.push('Sensible defaults included');
			}
			if (/required\s*:\s*(true|false)/i.test(content)) {
				score += 20;
				result.strengths.push('Required fields specified');
			}
			if (/description\s*:/i.test(content)) {
				score += 15;
				result.strengths.push('Field descriptions included');
			}
			if (/type\s*:\s*['"`](text|number|boolean|select)/i.test(content)) {
				score += 10;
				result.strengths.push('Typed input fields');
			}
			break;

		case 'triggers':
			// Check for trigger patterns
			if (/cron\s*\(|schedule\s*\(/i.test(content)) {
				score += 30;
				result.strengths.push('Schedule/cron trigger defined');
			}
			if (/webhook\s*\(|webhooks\s*:/i.test(content)) {
				score += 30;
				result.strengths.push('Webhook trigger defined');
			}
			if (/manual\s*\(/i.test(content)) {
				score += 25;
				result.strengths.push('Manual trigger defined');
			}
			if (/poll\s*\(/i.test(content)) {
				score += 25;
				result.strengths.push('Poll trigger defined');
			}
			if (/\d+\s+\d+\s+\*|\*\/\d+/i.test(content)) {
				score += 20;
				result.strengths.push('Valid cron expression');
			}
			if (/timezone\s*:/i.test(content)) {
				score += 10;
				result.strengths.push('Timezone specified (best practice)');
			}
			if (/trigger\.type\s*===?\s*['"`](webhook|schedule|manual|poll)['"`]/i.test(content)) {
				score += 15;
				result.strengths.push('Differentiates trigger types in execute');
			}
			break;

		case 'performance-rate-limiting':
			// SDK retry utilities (preferred patterns)
			if (/withRetry|fetchWithRetry|@workwayco\/sdk.*retry/i.test(content)) {
				score += 30;
				result.strengths.push('Uses SDK retry utilities (withRetry/fetchWithRetry)');
			}
			if (/createRateLimitAwareRetry|parseRetryAfter/i.test(content)) {
				score += 25;
				result.strengths.push('Rate limit header handling with SDK utilities');
			}
			if (/extractRateLimitInfo/i.test(content)) {
				score += 15;
				result.strengths.push('Extracts rate limit info from headers');
			}
			// BaseAPIClient pattern
			if (/BaseAPIClient|extends.*BaseAPIClient/i.test(content)) {
				score += 20;
				result.strengths.push('Uses BaseAPIClient pattern (automatic rate limiting)');
			}
			// Caching patterns
			if (/cache|storage\.get|storage\.put/i.test(content)) {
				score += 25;
				result.strengths.push('Caching implemented');
			}
			// Manual rate limiting (acceptable but less preferred)
			if (/chunk|batch|rate.*limit|processInChunks/i.test(content)) {
				score += 20;
				result.strengths.push('Rate limiting/batching considered');
			}
			// Performance metrics
			if (/metric|duration|performance|Date\.now\(\)|timings/i.test(content)) {
				score += 15;
				result.strengths.push('Performance metrics included');
			}
			// Exponential backoff
			if (/exponential|backoff|jitter|maxDelay/i.test(content)) {
				score += 15;
				result.strengths.push('Exponential backoff configured');
			}
			break;

		case 'monitoring-debugging':
			// Cloudflare-native logging
			if (/console\.(log|error|warn|info)/i.test(content)) {
				score += 25;
				result.strengths.push('Console logging implemented');
			}
			// Wrangler tail usage
			if (/wrangler\s+tail|--status\s+error|--format\s+json/i.test(content)) {
				score += 25;
				result.strengths.push('Wrangler tail for live debugging');
			}
			// Structured context in logs
			if (/triggerId|meetingId|userId|executionId|context/i.test(content)) {
				score += 20;
				result.strengths.push('Context included in logs');
			}
			// Cloudflare Dashboard or analytics reference
			if (/dashboard|analytics|workers.*pages|cpu.*time|success.*rate/i.test(content)) {
				score += 15;
				result.strengths.push('Cloudflare analytics referenced');
			}
			// Alerting configuration
			if (/alert|threshold|error.*rate|latency/i.test(content)) {
				score += 15;
				result.strengths.push('Alerting considered');
			}
			break;

		default:
			if (content.length > 100) {
				score += 60;
				result.strengths.push('Configuration artifact provided');
			}
	}

	result.score = Math.min(score, 100);
	result.valid = result.score >= 50;
	result.overall = result.valid
		? 'Good configuration design!'
		: 'Configuration needs more detail.';

	if (result.score < 50) {
		result.improvements.push('Add more configuration elements');
	}
	if (result.score >= 50 && result.score < 80) {
		result.improvements.push('Consider edge cases and defaults');
	}

	return result;
}

/**
 * Validate conceptual exercises (understanding, philosophy)
 */
function validateConceptualExercise(praxisId: string, evidence?: string, reflection?: string): ValidationResult {
	const result: ValidationResult = {
		valid: false,
		score: 0,
		overall: '',
		strengths: [],
		improvements: [],
		patterns: {
			zuhandenheit: { score: 50, notes: 'Conceptual exercise - understanding' },
			integrationUsage: { correct: true, notes: 'N/A' },
			configSchema: { valid: true, notes: 'N/A' }
		}
	};

	const content = (evidence || '') + (reflection || '');

	if (!content.trim()) {
		result.overall = 'Share your understanding through evidence and reflection';
		result.improvements.push('Write a brief reflection on what you learned');
		return result;
	}

	let score = 0;

	// Minimum content length check
	if (content.length >= 50) score += 20;
	if (content.length >= 150) score += 20;
	if (content.length >= 300) score += 10;

	switch (praxisId) {
		case 'what-is-workflow':
			// Check for outcome-focused thinking
			if (/outcome|result|happens|automatic/i.test(content)) {
				score += 25;
				result.strengths.push('Outcome-focused thinking demonstrated');
				result.patterns.zuhandenheit.score = 70;
			}
			if (/zuhandenheit|recede|invisible|tool.*disappear/i.test(content)) {
				score += 25;
				result.strengths.push('Understanding of Zuhandenheit philosophy');
				result.patterns.zuhandenheit.score = 90;
			}
			if (/task|manual|automat/i.test(content)) {
				score += 15;
				result.strengths.push('Tasks identified for automation');
			}
			break;

		case 'define-workflow-pattern':
			if (/defineWorkflow|pattern|structure/i.test(content)) {
				score += 25;
				result.strengths.push('Pattern recognition demonstrated');
			}
			if (/integrations?|execute|trigger/i.test(content)) {
				score += 25;
				result.strengths.push('Key components identified');
			}
			if (/example|packages\/workflows/i.test(content)) {
				score += 15;
				result.strengths.push('Explored real workflow examples');
			}
			break;

		case 'integrations-oauth':
			if (/BaseAPIClient|oauth|token/i.test(content)) {
				score += 30;
				result.strengths.push('Understanding of integration patterns');
			}
			if (/scope|permission|auth/i.test(content)) {
				score += 20;
				result.strengths.push('OAuth concepts understood');
			}
			if (/packages\/integrations/i.test(content)) {
				score += 15;
				result.strengths.push('Explored integration implementations');
			}
			break;

		case 'design-philosophy':
			if (/zuhandenheit|recede|invisible|disappear/i.test(content)) {
				score += 30;
				result.strengths.push('Understanding of Zuhandenheit philosophy');
				result.patterns.zuhandenheit.score = 90;
			}
			if (/rams|weniger|besser|less.*but.*better/i.test(content)) {
				score += 25;
				result.strengths.push('Dieter Rams principles understood');
			}
			if (/default|simplif|remov|audit/i.test(content)) {
				score += 20;
				result.strengths.push('Applied simplification thinking');
			}
			if (/unnecessary|abstraction|config/i.test(content)) {
				score += 15;
				result.strengths.push('Identified opportunities to remove complexity');
			}
			break;

		default:
			// Generic conceptual validation
			if (content.length >= 100) {
				score += 30;
				result.strengths.push('Thoughtful response provided');
			}
	}

	// Bonus for reflection
	if (reflection && reflection.length >= 50) {
		score += 10;
		result.strengths.push('Personal reflection included');
	}

	result.score = Math.min(score, 100);
	result.valid = result.score >= 40;
	result.overall = result.valid
		? 'Good understanding demonstrated!'
		: 'Expand your reflection to show deeper understanding.';

	if (!result.valid) {
		result.improvements.push('Add more detail to your response');
		result.improvements.push('Connect concepts to practical applications');
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
 *
 * Based on actual patterns from packages/workflows/src/ and packages/sdk/src/workflow-sdk.ts:
 * - defineWorkflow() with name, description, version
 * - integrations array with { service, scopes, optional? }
 * - inputs object (preferred over configSchema)
 * - trigger configuration (cron, webhook, manual)
 * - async execute({ trigger, inputs, integrations, env })
 * - optional onError handler
 * - pathway metadata for discovery (advanced)
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

	// ====================
	// CORE STRUCTURE (40 points)
	// ====================

	// Check for defineWorkflow pattern with import
	// Accept @workwayco/sdk (current package name)
	const hasWorkwaycoImport = /@workwayco\/sdk/.test(code);
	const hasDefineWorkflow = /defineWorkflow\s*\(\s*\{/i.test(code);

	if (hasDefineWorkflow) {
		score += 15;
		result.strengths.push('Uses defineWorkflow() pattern');
		if (hasWorkwaycoImport) {
			score += 5;
			result.strengths.push('Correctly imports from @workwayco/sdk');
		} else {
			result.improvements.push("Import defineWorkflow from '@workwayco/sdk'");
		}
	} else {
		result.improvements.push('Use defineWorkflow({ ... }) to define your workflow');
	}

	// Check for export default
	const hasExportDefault = /export\s+default\s+defineWorkflow/i.test(code);
	if (hasExportDefault) {
		score += 10;
		result.strengths.push('Exports workflow as default');
	} else if (/export\s+default/i.test(code)) {
		score += 5;
		result.improvements.push('Use: export default defineWorkflow({ ... })');
	} else {
		result.improvements.push('Export your workflow: export default defineWorkflow({ ... })');
	}

	// Check for workflow metadata (name, description, version)
	const hasName = /name\s*:\s*['"`]/i.test(code);
	const hasDescription = /description\s*:\s*['"`]/i.test(code);
	const hasVersion = /version\s*:\s*['"`]\d+\.\d+\.\d+['"`]/i.test(code);

	if (hasName && hasDescription) {
		score += 10;
		result.strengths.push('Has name and description');
	} else {
		if (!hasName) result.improvements.push('Add workflow name');
		if (!hasDescription) result.improvements.push('Add workflow description');
	}

	// ====================
	// INTEGRATIONS (20 points)
	// ====================

	// Check for integrations array with extended format
	const hasIntegrationsArray = /integrations\s*:\s*\[/i.test(code);
	const hasExtendedIntegrations = /\{\s*service\s*:\s*['"`]\w+['"`]/i.test(code);
	const hasScopesInIntegration = /scopes\s*:\s*\[/i.test(code);

	if (hasIntegrationsArray) {
		score += 10;
		result.strengths.push('Declares integrations array');
		result.patterns.integrationUsage = { correct: true, notes: 'Integration array present' };

		if (hasExtendedIntegrations && hasScopesInIntegration) {
			score += 10;
			result.strengths.push('Uses extended integration format with scopes');
			result.patterns.integrationUsage.notes = 'Extended format with scopes - excellent!';
		} else if (hasExtendedIntegrations) {
			score += 5;
			result.improvements.push('Add scopes to integrations for explicit permissions');
		}
	} else {
		result.improvements.push('Declare integrations: [{ service: "zoom", scopes: [...] }]');
		result.patterns.integrationUsage = { correct: false, notes: 'Missing integrations array' };
	}

	// ====================
	// INPUTS/CONFIG (15 points)
	// ====================

	// Check for inputs (modern pattern - preferred over configSchema)
	const hasInputs = /inputs\s*:\s*\{/i.test(code);
	const hasInputTypes = /type\s*:\s*['"`](text|number|boolean|select|multiselect)['"`]/i.test(code);
	const hasRequiredInputs = /required\s*:\s*true/i.test(code);
	const hasDefaults = /default\s*:/i.test(code);

	if (hasInputs) {
		score += 10;
		result.strengths.push('Has inputs configuration (modern pattern)');
		result.patterns.configSchema = { valid: true, notes: 'Using inputs object' };

		if (hasInputTypes) {
			score += 3;
			result.strengths.push('Input fields have type definitions');
		}
		if (hasDefaults) {
			score += 2;
			result.strengths.push('Uses sensible defaults');
		}
	} else {
		// Legacy pattern - configSchema
		const hasConfigSchema = /configSchema\s*:\s*z\./i.test(code);
		if (hasConfigSchema) {
			score += 8;
			result.strengths.push('Has configSchema (legacy pattern)');
			result.patterns.configSchema = { valid: true, notes: 'Using Zod schema' };
			result.improvements.push('Consider migrating to inputs object for better UI generation');
		} else {
			result.improvements.push('Add inputs object for user configuration');
			result.patterns.configSchema = { valid: false, notes: 'Missing inputs/configSchema' };
		}
	}

	// ====================
	// EXECUTION (15 points)
	// ====================

	// Check for async execute function with correct signature
	const hasAsyncExecute = /async\s+execute\s*\(/i.test(code) || /execute\s*:\s*async\s*\(/i.test(code);
	const hasCorrectParams = /\{\s*(trigger|inputs|integrations|env|context)/i.test(code);

	if (hasAsyncExecute) {
		score += 10;
		result.strengths.push('Has async execute function');
		if (hasCorrectParams) {
			score += 5;
			result.strengths.push('Execute uses destructured params');
		} else {
			result.improvements.push('Use: async execute({ trigger, inputs, integrations, env })');
		}
	} else {
		result.improvements.push('Implement: async execute({ trigger, inputs, integrations, env })');
	}

	// ====================
	// ERROR HANDLING (15 points)
	// ====================

	// Check for onError handler (WORKWAY pattern)
	const hasOnError = /onError\s*:\s*async/i.test(code);
	const hasTryCatch = /try\s*\{[\s\S]*catch\s*\(/i.test(code);

	// SDK retry utilities (preferred patterns)
	const hasWithRetry = /withRetry\s*\(/i.test(code);
	const hasFetchWithRetry = /fetchWithRetry\s*\(/i.test(code);
	const hasRetryImport = /import\s*\{[^}]*(?:withRetry|fetchWithRetry)[^}]*\}\s*from\s*['"]@workwayco\/sdk['"]/i.test(code);

	// IntegrationError handling
	const hasIntegrationError = /IntegrationError/i.test(code);
	const hasIsIntegrationError = /isIntegrationError\s*\(/i.test(code);
	const hasErrorCode = /ErrorCode\./i.test(code);
	const hasIsRetryable = /\.isRetryable\s*\(\)/i.test(code);
	const hasGetUserMessage = /\.getUserMessage\s*\(\)/i.test(code);

	// Graceful degradation patterns
	const hasOptionalStep = /optional.*step|continue.*don't fail|log.*but continue/i.test(code);
	const hasGracefulDegradation = /graceful|degrad|fallback/i.test(code);

	if (hasOnError) {
		score += 5;
		result.strengths.push('Has onError handler for workflow-level errors');
	}

	if (hasTryCatch) {
		score += 3;
		result.strengths.push('Uses try/catch for granular error handling');
	}

	if (hasWithRetry || hasFetchWithRetry) {
		score += 5;
		result.strengths.push('Uses SDK retry utilities (withRetry/fetchWithRetry)');
	}

	if (hasIntegrationError || hasIsIntegrationError) {
		score += 3;
		result.strengths.push('Uses IntegrationError for typed error handling');
	}

	if (hasIsRetryable || hasGetUserMessage) {
		score += 2;
		result.strengths.push('Uses IntegrationError helper methods');
	}

	if (hasOptionalStep || hasGracefulDegradation) {
		score += 2;
		result.strengths.push('Implements graceful degradation for optional steps');
	}

	// Suggest improvements based on what's missing
	if (!hasOnError && !hasTryCatch) {
		result.improvements.push('Add error handling (onError handler or try/catch)');
	} else if (!hasOnError) {
		result.improvements.push('Consider adding onError handler for workflow-level error notifications');
	}

	if (!hasWithRetry && !hasFetchWithRetry) {
		result.improvements.push('Consider using withRetry() for transient failures');
	}

	if (!hasIntegrationError && !hasIsIntegrationError) {
		result.improvements.push('Use isIntegrationError() for typed error handling');
	}

	// ====================
	// AGENCY PATTERNS (bonus points for agency-patterns praxis)
	// ====================

	const agencyIndicators = {
		// Template factory pattern (function that returns workflow)
		hasTemplateFactory: /function\s+\w+\([^)]*\)\s*\{[\s\S]*defineWorkflow/i.test(code),
		// Private visibility
		hasPrivateVisibility: /visibility\s*:\s*['"`]private['"`]/i.test(code),
		// Access grants for email domain
		hasAccessGrants: /accessGrants\s*:\s*\[/i.test(code),
		hasEmailDomainGrant: /type\s*:\s*['"`]email_domain['"`]/i.test(code),
		// Agency tagging
		hasAgencyTags: /tags\s*:\s*\[[\s\S]*agency:/i.test(code),
		hasClientTags: /tags\s*:\s*\[[\s\S]*client:/i.test(code),
		// Parameterized client name
		hasClientNameParam: /clientName|client.*name/i.test(code),
		// Pricing configuration
		hasPricing: /pricing\s*:\s*\{/i.test(code),
	};

	// Award bonus points for agency-specific patterns
	if (agencyIndicators.hasTemplateFactory) {
		score += 5;
		result.strengths.push('Uses template factory pattern (agency best practice)');
	}

	if (agencyIndicators.hasPrivateVisibility) {
		score += 3;
		result.strengths.push('Configures private visibility for client workflows');
	}

	if (agencyIndicators.hasAccessGrants && agencyIndicators.hasEmailDomainGrant) {
		score += 3;
		result.strengths.push('Uses email domain access grants');
	}

	if (agencyIndicators.hasAgencyTags || agencyIndicators.hasClientTags) {
		score += 2;
		result.strengths.push('Uses agency/client tagging for portfolio management');
	}

	if (agencyIndicators.hasPricing) {
		score += 2;
		result.strengths.push('Configures pricing model');
	}

	// ====================
	// ZUHANDENHEIT (5 points)
	// ====================

	// Check for outcome-focused patterns
	const zuhandenheitIndicators = {
		// Pathway metadata (advanced - Heideggerian discovery)
		hasPathway: /pathway\s*:\s*\{/i.test(code),
		hasOutcomeFrame: /outcomeFrame\s*:/i.test(code),
		hasOutcomeStatement: /outcomeStatement\s*:/i.test(code),
		// Smart defaults for one-click activation
		hasSmartDefaults: /smartDefaults\s*:/i.test(code),
		hasEssentialFields: /essentialFields\s*:/i.test(code),
		// Graceful degradation
		hasOptionalIntegration: /optional\s*:\s*true/i.test(code),
		// Outcome-focused naming
		hasOutcomeName: /name\s*:\s*['"][^'"]*(?:Intelligence|Autopilot|Digest|Sync|Tracker|Hub|Engine|Bot|Pipeline)[^'"]*['"]/i.test(code)
	};

	let zuhandenheitScore = 40; // Base score

	if (zuhandenheitIndicators.hasPathway) {
		zuhandenheitScore += 30;
		result.strengths.push('Has pathway metadata (Heideggerian discovery)');
		score += 3;
	}

	if (zuhandenheitIndicators.hasSmartDefaults || zuhandenheitIndicators.hasEssentialFields) {
		zuhandenheitScore += 15;
		result.strengths.push('Supports one-click activation');
		score += 2;
	}

	if (zuhandenheitIndicators.hasOptionalIntegration) {
		zuhandenheitScore += 10;
		result.strengths.push('Has optional integrations (graceful degradation)');
	}

	if (zuhandenheitIndicators.hasOutcomeName) {
		zuhandenheitScore += 5;
	}

	result.patterns.zuhandenheit = {
		score: Math.min(zuhandenheitScore, 100),
		notes: zuhandenheitScore >= 70
			? 'Strong Zuhandenheit - tool recedes, outcome remains'
			: zuhandenheitScore >= 50
				? 'Good outcome focus. Consider adding pathway metadata.'
				: 'Consider: Does this workflow describe outcomes or mechanisms?'
	};

	// ====================
	// FINAL SCORING
	// ====================

	result.score = Math.min(score, maxScore);
	result.valid = result.score >= 50;

	// Generate overall message
	if (result.score >= 85) {
		result.overall = 'Excellent! Your workflow follows WORKWAY patterns exceptionally well.';
	} else if (result.score >= 70) {
		result.overall = 'Good workflow structure. Ready for review.';
	} else if (result.score >= 50) {
		result.overall = 'Basic structure present. A few improvements recommended.';
	} else if (result.score >= 30) {
		result.overall = 'Partial implementation. Review the defineWorkflow() documentation.';
	} else {
		result.overall = 'Getting started. See packages/workflows/src/ for examples.';
	}

	return result;
}

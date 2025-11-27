/**
 * Workflow Schema Validator
 *
 * Validates workflow definitions against the WORKWAY schema.
 * Catches errors before deployment to prevent broken workflows.
 */

import fs from 'fs-extra';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
	metadata?: WorkflowMetadata;
}

export interface ValidationError {
	type: 'error';
	code: string;
	message: string;
	line?: number;
	suggestion?: string;
}

export interface ValidationWarning {
	type: 'warning';
	code: string;
	message: string;
	line?: number;
	suggestion?: string;
}

export interface WorkflowMetadata {
	name?: string;
	type?: string;
	integrations?: string[];
	trigger?: string;
	hasAI?: boolean;
	pricing?: {
		model?: string;
		price?: number;
	};
}

// ============================================================================
// KNOWN INTEGRATIONS
// ============================================================================

const KNOWN_INTEGRATIONS = [
	'gmail',
	'slack',
	'notion',
	'stripe',
	'github',
	'salesforce',
	'airtable',
	'zendesk',
	'hubspot',
	'linear',
	'discord',
	'telegram',
	'sendgrid',
	'resend',
	'mailchimp',
	'paypal',
	'square',
	'pipedrive',
	'gitlab',
	'google-workspace',
	'google-calendar',
	'google-drive',
	'google-sheets',
];

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validate a workflow file
 */
export async function validateWorkflowFile(workflowPath: string): Promise<ValidationResult> {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];
	const metadata: WorkflowMetadata = {};

	// Read file content
	let content: string;
	try {
		content = await fs.readFile(workflowPath, 'utf-8');
	} catch (error) {
		return {
			valid: false,
			errors: [{
				type: 'error',
				code: 'FILE_NOT_FOUND',
				message: `Cannot read workflow file: ${workflowPath}`,
			}],
			warnings: [],
		};
	}

	// Check for required imports
	validateImports(content, errors, warnings, metadata);

	// Check for workflow definition
	validateWorkflowDefinition(content, errors, warnings, metadata);

	// Check for execute function
	validateExecuteFunction(content, errors, warnings);

	// Validate integrations
	validateIntegrations(content, errors, warnings, metadata);

	// Validate trigger
	validateTrigger(content, errors, warnings, metadata);

	// Validate pricing
	validatePricing(content, errors, warnings, metadata);

	// Check for AI usage
	validateAIUsage(content, errors, warnings, metadata);

	// Check for common mistakes
	validateCommonMistakes(content, errors, warnings);

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		metadata,
	};
}

/**
 * Validate imports
 */
function validateImports(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for SDK import
	const hasSDKImport = /@workway\/sdk/.test(content);
	if (!hasSDKImport) {
		errors.push({
			type: 'error',
			code: 'MISSING_SDK_IMPORT',
			message: 'Workflow must import from @workway/sdk',
			suggestion: "Add: import { defineWorkflow } from '@workway/sdk'",
		});
	}

	// Check for Workers AI import if using AI
	const hasAIUsage = /createAIClient|AIModels|env\.AI|workers-ai/.test(content);
	const hasWorkersAIImport = /@workway\/sdk\/workers-ai/.test(content);

	if (hasAIUsage && !hasWorkersAIImport) {
		warnings.push({
			type: 'warning',
			code: 'MISSING_AI_IMPORT',
			message: 'AI usage detected but no workers-ai import found',
			suggestion: "Add: import { createAIClient, AIModels } from '@workway/sdk/workers-ai'",
		});
	}

	metadata.hasAI = hasAIUsage;
}

/**
 * Validate workflow definition structure
 */
function validateWorkflowDefinition(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for defineWorkflow or export default
	const hasDefineWorkflow = /defineWorkflow\s*\(/.test(content);
	const hasExportDefault = /export\s+default/.test(content);

	if (!hasDefineWorkflow && !hasExportDefault) {
		errors.push({
			type: 'error',
			code: 'NO_WORKFLOW_EXPORT',
			message: 'Workflow must use defineWorkflow() or export default',
			suggestion: 'Wrap your workflow in defineWorkflow({ ... })',
		});
	}

	// Extract workflow name
	const nameMatch = content.match(/name:\s*['"`]([^'"`]+)['"`]/);
	if (nameMatch) {
		metadata.name = nameMatch[1];
	} else {
		warnings.push({
			type: 'warning',
			code: 'MISSING_NAME',
			message: 'Workflow should have a name property',
			suggestion: "Add: name: 'My Workflow'",
		});
	}

	// Extract workflow type
	const typeMatch = content.match(/type:\s*['"`](integration|ai-enhanced|ai-native)['"`]/);
	if (typeMatch) {
		metadata.type = typeMatch[1];
	}
}

/**
 * Validate execute function
 */
function validateExecuteFunction(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[]
): void {
	// Check for execute function
	const hasExecute = /execute\s*[:(]|async\s+execute/.test(content);
	const hasRun = /run\s*[:(]|async\s+run/.test(content);

	if (!hasExecute && !hasRun) {
		errors.push({
			type: 'error',
			code: 'MISSING_EXECUTE',
			message: 'Workflow must have an execute or run function',
			suggestion: 'Add: async execute({ trigger, actions }) { ... }',
		});
	}

	// Check for return statement in execute
	const executeMatch = content.match(/execute\s*\([^)]*\)\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s);
	if (executeMatch) {
		const executeBody = executeMatch[1];
		if (!executeBody.includes('return')) {
			warnings.push({
				type: 'warning',
				code: 'NO_RETURN',
				message: 'Execute function should return a result',
				suggestion: 'Add: return { success: true, data: ... }',
			});
		}
	}
}

/**
 * Validate integrations
 */
function validateIntegrations(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Extract integrations array
	const integrationsMatch = content.match(/integrations:\s*\[([\s\S]*?)\]/);
	if (!integrationsMatch) {
		return; // No integrations defined (might be valid for some workflows)
	}

	const integrationsBlock = integrationsMatch[1];
	const integrations: string[] = [];

	// Extract service names
	const serviceMatches = integrationsBlock.matchAll(/service:\s*['"`]([^'"`]+)['"`]/g);
	for (const match of serviceMatches) {
		integrations.push(match[1].toLowerCase());
	}

	// Also check for shorthand: ['gmail', 'slack']
	const shorthandMatches = integrationsBlock.matchAll(/['"`]([a-z-]+)['"`]/g);
	for (const match of shorthandMatches) {
		const name = match[1].toLowerCase();
		if (KNOWN_INTEGRATIONS.includes(name) && !integrations.includes(name)) {
			integrations.push(name);
		}
	}

	metadata.integrations = integrations;

	// Validate each integration
	for (const integration of integrations) {
		if (!KNOWN_INTEGRATIONS.includes(integration)) {
			warnings.push({
				type: 'warning',
				code: 'UNKNOWN_INTEGRATION',
				message: `Unknown integration: ${integration}`,
				suggestion: `Valid integrations: ${KNOWN_INTEGRATIONS.slice(0, 5).join(', ')}...`,
			});
		}
	}

	// Check for scope definitions
	if (integrations.length > 0 && !integrationsBlock.includes('scopes')) {
		warnings.push({
			type: 'warning',
			code: 'MISSING_SCOPES',
			message: 'Integrations should specify required scopes',
			suggestion: "Add: scopes: ['read_data', 'write_data']",
		});
	}
}

/**
 * Validate trigger configuration
 */
function validateTrigger(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for trigger definition
	const hasTrigger = /trigger:\s*/.test(content);
	if (!hasTrigger) {
		errors.push({
			type: 'error',
			code: 'MISSING_TRIGGER',
			message: 'Workflow must define a trigger',
			suggestion: "Add: trigger: webhook({ service: 'stripe', event: 'payment.succeeded' })",
		});
		return;
	}

	// Extract trigger type
	const triggerMatch = content.match(/trigger:\s*(webhook|schedule|manual|poll)\s*\(/);
	if (triggerMatch) {
		metadata.trigger = triggerMatch[1];
	} else {
		// Check for object-style trigger
		const triggerTypeMatch = content.match(/trigger:\s*{\s*type:\s*['"`]([^'"`]+)['"`]/);
		if (triggerTypeMatch) {
			metadata.trigger = triggerTypeMatch[1];
		}
	}

	// Validate webhook trigger
	if (content.includes('webhook(')) {
		const webhookMatch = content.match(/webhook\s*\(\s*{([^}]+)}/);
		if (webhookMatch) {
			const webhookConfig = webhookMatch[1];
			if (!webhookConfig.includes('service') && !webhookConfig.includes('event')) {
				warnings.push({
					type: 'warning',
					code: 'INCOMPLETE_WEBHOOK',
					message: 'Webhook trigger should specify service and event',
					suggestion: "Add: service: 'stripe', event: 'payment.succeeded'",
				});
			}
		}
	}

	// Validate schedule trigger
	if (content.includes('schedule(')) {
		const scheduleMatch = content.match(/schedule\s*\(\s*['"`]([^'"`]+)['"`]/);
		if (scheduleMatch) {
			const cronExpr = scheduleMatch[1];
			if (!isValidCron(cronExpr)) {
				errors.push({
					type: 'error',
					code: 'INVALID_CRON',
					message: `Invalid cron expression: ${cronExpr}`,
					suggestion: "Use format: '0 8 * * *' (minute hour day month weekday)",
				});
			}
		}
	}
}

/**
 * Validate pricing configuration
 */
function validatePricing(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	const hasPricing = /pricing:\s*{/.test(content);
	if (!hasPricing) {
		warnings.push({
			type: 'warning',
			code: 'MISSING_PRICING',
			message: 'Workflow should define pricing for marketplace',
			suggestion: "Add: pricing: { model: 'subscription', price: 10, executions: 100 }",
		});
		return;
	}

	// Extract pricing model
	const modelMatch = content.match(/model:\s*['"`](subscription|usage|one-time)['"`]/);
	if (modelMatch) {
		metadata.pricing = { model: modelMatch[1] };
	}

	// Extract price
	const priceMatch = content.match(/price:\s*(\d+(?:\.\d+)?)/);
	if (priceMatch) {
		metadata.pricing = metadata.pricing || {};
		metadata.pricing.price = parseFloat(priceMatch[1]);
	}

	// Validate subscription pricing has executions
	if (modelMatch?.[1] === 'subscription') {
		const hasExecutions = /executions:\s*(\d+|'unlimited')/.test(content);
		if (!hasExecutions) {
			warnings.push({
				type: 'warning',
				code: 'MISSING_EXECUTIONS',
				message: 'Subscription pricing should specify executions limit',
				suggestion: 'Add: executions: 100',
			});
		}
	}
}

/**
 * Validate AI usage
 */
function validateAIUsage(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for external AI providers (not allowed)
	const hasExternalAI = /claude|gpt-4|openai|anthropic|gemini/i.test(content);
	if (hasExternalAI) {
		warnings.push({
			type: 'warning',
			code: 'EXTERNAL_AI_DETECTED',
			message: 'External AI providers detected. WORKWAY uses Cloudflare Workers AI only.',
			suggestion: "Use: createAIClient(env) with AIModels.LLAMA_3_8B or AIModels.MISTRAL_7B",
		});
	}

	// Check for proper AI client usage
	if (metadata.hasAI) {
		const hasEnvAccess = /env\s*[,})]|context\.env|{ env }/.test(content);
		if (!hasEnvAccess) {
			warnings.push({
				type: 'warning',
				code: 'MISSING_ENV_ACCESS',
				message: 'AI usage requires env parameter in execute function',
				suggestion: 'Update: async execute({ trigger, actions, env }) { ... }',
			});
		}
	}
}

/**
 * Validate common mistakes
 */
function validateCommonMistakes(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[]
): void {
	// Check for console.log (should use logging service)
	const consoleMatches = content.match(/console\.(log|error|warn)/g);
	if (consoleMatches && consoleMatches.length > 3) {
		warnings.push({
			type: 'warning',
			code: 'EXCESSIVE_LOGGING',
			message: `Found ${consoleMatches.length} console statements`,
			suggestion: 'Consider reducing logging in production builds',
		});
	}

	// Check for hardcoded secrets
	const secretPatterns = [
		/api[_-]?key\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
		/secret\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
		/password\s*[:=]\s*['"`][^'"`]+['"`]/i,
		/token\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
	];

	for (const pattern of secretPatterns) {
		if (pattern.test(content)) {
			errors.push({
				type: 'error',
				code: 'HARDCODED_SECRET',
				message: 'Possible hardcoded secret detected',
				suggestion: 'Use environment variables or secrets manager instead',
			});
			break;
		}
	}

	// Check for await inside loops (potential performance issue)
	const awaitInLoop = /for\s*\([^)]+\)\s*{[^}]*await[^}]*}/s.test(content) ||
		/while\s*\([^)]+\)\s*{[^}]*await[^}]*}/s.test(content);
	if (awaitInLoop) {
		warnings.push({
			type: 'warning',
			code: 'AWAIT_IN_LOOP',
			message: 'Await inside loop detected (may affect performance)',
			suggestion: 'Consider using Promise.all() for parallel execution',
		});
	}

	// Check for empty catch blocks
	if (/catch\s*\([^)]*\)\s*{\s*}/s.test(content)) {
		warnings.push({
			type: 'warning',
			code: 'EMPTY_CATCH',
			message: 'Empty catch block detected',
			suggestion: 'Handle or re-throw errors properly',
		});
	}
}

/**
 * Validate cron expression
 */
function isValidCron(expr: string): boolean {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return false;

	const patterns = [
		/^(\*|[0-9]|[1-5][0-9])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/,  // minute
		/^(\*|[0-9]|1[0-9]|2[0-3])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // hour
		/^(\*|[1-9]|[12][0-9]|3[01])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // day
		/^(\*|[1-9]|1[0-2])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // month
		/^(\*|[0-6])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // weekday
	];

	for (let i = 0; i < 5; i++) {
		// Allow wildcards and ranges
		const part = parts[i];
		if (part === '*') continue;
		if (/^\*\/\d+$/.test(part)) continue;
		if (/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(part)) continue;
		if (!patterns[i].test(part)) return false;
	}

	return true;
}

/**
 * Format validation results for CLI output
 */
export function formatValidationResults(result: ValidationResult): string[] {
	const lines: string[] = [];

	for (const error of result.errors) {
		lines.push(`[ERROR] ${error.code}: ${error.message}`);
		if (error.suggestion) {
			lines.push(`        Suggestion: ${error.suggestion}`);
		}
	}

	for (const warning of result.warnings) {
		lines.push(`[WARN]  ${warning.code}: ${warning.message}`);
		if (warning.suggestion) {
			lines.push(`        Suggestion: ${warning.suggestion}`);
		}
	}

	return lines;
}

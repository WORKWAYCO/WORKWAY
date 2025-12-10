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
 * Node.js modules that don't work in Cloudflare Workers
 * See docs/WORKERS_RUNTIME_GUIDE.md for details
 */
const BLOCKED_NODE_MODULES = [
	'fs',
	'path',
	'child_process',
	'os',
	'net',
	'http',
	'https',
	'stream',
	'buffer',
	'crypto',        // Use Web Crypto API instead
	'util',
	'events',
	'cluster',
	'dns',
	'readline',
	'tty',
	'vm',
	'zlib',
	'worker_threads',
	'perf_hooks',
	'async_hooks',
];

/**
 * npm packages known to not work in Workers
 */
const BLOCKED_NPM_PACKAGES = [
	'axios',         // Use fetch() instead
	'request',       // Use fetch() instead
	'node-fetch',    // Native fetch() available
	'express',       // Not applicable
	'bcrypt',        // Use bcryptjs instead
	'sharp',         // Use Cloudflare Images
	'puppeteer',     // Use external service
	'mongoose',      // No MongoDB in Workers
	'pg',            // Use D1 instead
	'mysql',         // Use D1 instead
	'redis',         // Use KV instead
];

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

	// Check for Node.js stdlib imports (BLOCKED in Workers)
	for (const mod of BLOCKED_NODE_MODULES) {
		// Match: import x from 'fs', import { x } from 'fs', require('fs')
		const importPattern = new RegExp(`(import\\s+.*from\\s+['"\`]${mod}['"\`])|(require\\s*\\(\\s*['"\`]${mod}['"\`]\\s*\\))`, 'g');
		if (importPattern.test(content)) {
			const suggestions: Record<string, string> = {
				'fs': 'Cloudflare Workers have no filesystem. Store data in KV or R2.',
				'path': 'Use string manipulation or URL API instead.',
				'child_process': 'Workers cannot spawn processes. Use external services.',
				'crypto': 'Use Web Crypto API: crypto.subtle.digest(), crypto.randomUUID()',
				'http': 'Use native fetch() instead.',
				'https': 'Use native fetch() instead.',
				'buffer': 'Use ArrayBuffer/Uint8Array instead.',
				'stream': 'Use Web Streams API (ReadableStream, WritableStream).',
			};

			errors.push({
				type: 'error',
				code: 'BLOCKED_NODE_MODULE',
				message: `Node.js module '${mod}' is not available in Cloudflare Workers`,
				suggestion: suggestions[mod] || 'See docs/WORKERS_RUNTIME_GUIDE.md for alternatives.',
			});
		}
	}

	// Check for npm packages known to not work
	for (const pkg of BLOCKED_NPM_PACKAGES) {
		const importPattern = new RegExp(`(import\\s+.*from\\s+['"\`]${pkg}['"\`])|(require\\s*\\(\\s*['"\`]${pkg}['"\`]\\s*\\))`, 'g');
		if (importPattern.test(content)) {
			const suggestions: Record<string, string> = {
				'axios': 'Use native fetch() - it works identically in Workers.',
				'request': 'Use native fetch() - request is deprecated anyway.',
				'node-fetch': 'Native fetch() is available - no polyfill needed.',
				'express': 'Workers use event-driven model, not HTTP servers.',
				'bcrypt': 'Use bcryptjs (pure JS) or Web Crypto API.',
				'sharp': 'Use Cloudflare Images for image processing.',
				'puppeteer': 'Use an external browser service or Cloudflare Browser Rendering.',
				'mongoose': 'Use Cloudflare D1 (SQLite) or external API.',
				'pg': 'Use Cloudflare D1 or Hyperdrive for PostgreSQL.',
				'mysql': 'Use Cloudflare D1 or Hyperdrive.',
				'redis': 'Use Cloudflare KV for key-value storage.',
			};

			warnings.push({
				type: 'warning',
				code: 'INCOMPATIBLE_NPM_PACKAGE',
				message: `npm package '${pkg}' is incompatible with Cloudflare Workers`,
				suggestion: suggestions[pkg] || 'See docs/WORKERS_RUNTIME_GUIDE.md for alternatives.',
			});
		}
	}
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

/**
 * Workflow Schema Validator
 *
 * Validates workflow definitions against the WORKWAY schema.
 * Catches errors before deployment to prevent broken workflows.
 *
 * Performance: All regex patterns are compiled once at module load time
 * to avoid repeated compilation during validation.
 *
 * Benchmarking: Set WORKWAY_BENCHMARK=1 to see timing information.
 */

import fs from 'fs-extra';
import path from 'path';
import { createEnvBenchmark, type Benchmark } from './benchmark.js';

// ============================================================================
// CACHED REGEX PATTERNS (compiled once at module load)
// ============================================================================

/**
 * Pre-compiled patterns for common validation checks.
 * Creating RegExp objects is expensive - compile once, use many times.
 */
const PATTERNS = {
	// Import checks
	sdkImport: /@workway\/sdk/,
	aiUsage: /createAIClient|AIModels|env\.AI|workers-ai/,
	workersAIImport: /@workway\/sdk\/workers-ai/,

	// Workflow definition
	defineWorkflow: /defineWorkflow\s*\(/,
	exportDefault: /export\s+default/,
	workflowName: /name:\s*['"`]([^'"`]+)['"`]/,
	workflowType: /type:\s*['"`](integration|ai-enhanced|ai-native)['"`]/,

	// Execute function
	hasExecute: /execute\s*[:(]|async\s+execute/,
	hasRun: /run\s*[:(]|async\s+run/,
	executeBody: /execute\s*\([^)]*\)\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s,

	// Integrations
	integrationsBlock: /integrations:\s*\[([\s\S]*?)\]/,
	serviceNames: /service:\s*['"`]([^'"`]+)['"`]/g,
	shorthandIntegrations: /['"`]([a-z-]+)['"`]/g,

	// Trigger
	hasTrigger: /trigger:\s*/,
	triggerType: /trigger:\s*(webhook|schedule|manual|poll)\s*\(/,
	triggerObjectType: /trigger:\s*{\s*type:\s*['"`]([^'"`]+)['"`]/,
	webhookConfig: /webhook\s*\(\s*{([^}]+)}/,
	scheduleExpr: /schedule\s*\(\s*['"`]([^'"`]+)['"`]/,

	// Pricing
	hasPricing: /pricing:\s*{/,
	pricingModel: /model:\s*['"`](subscription|usage|one-time)['"`]/,
	pricingPrice: /price:\s*(\d+(?:\.\d+)?)/,
	hasExecutions: /executions:\s*(\d+|'unlimited')/,

	// AI usage
	externalAI: /claude|gpt-4|openai|anthropic|gemini/i,
	envAccess: /env\s*[,})]|context\.env|{ env }/,

	// Common mistakes
	consoleStatements: /console\.(log|error|warn)/g,
	awaitInForLoop: /for\s*\([^)]+\)\s*{[^}]*await[^}]*}/s,
	awaitInWhileLoop: /while\s*\([^)]+\)\s*{[^}]*await[^}]*}/s,
	emptyCatch: /catch\s*\([^)]*\)\s*{\s*}/s,

	// Cron validation helpers
	cronStepWildcard: /^\*\/\d+$/,
	cronRangeList: /^\d+(-\d+)?(,\d+(-\d+)?)*$/,
} as const;

/**
 * Pre-compiled secret detection patterns
 */
const SECRET_PATTERNS = [
	/api[_-]?key\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
	/secret\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
	/password\s*[:=]\s*['"`][^'"`]+['"`]/i,
	/token\s*[:=]\s*['"`][^'"`]{20,}['"`]/i,
] as const;

/**
 * Pre-compiled cron field validation patterns
 */
const CRON_PATTERNS = [
	/^(\*|[0-9]|[1-5][0-9])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/,  // minute
	/^(\*|[0-9]|1[0-9]|2[0-3])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // hour
	/^(\*|[1-9]|[12][0-9]|3[01])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // day
	/^(\*|[1-9]|1[0-2])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // month
	/^(\*|[0-6])(\/(0|[1-9][0-9]?))?$|^\*\/[0-9]+$/, // weekday
] as const;

/**
 * Pre-compiled import patterns for blocked modules and packages.
 * Map from module/package name to compiled regex.
 */
const BLOCKED_MODULE_PATTERNS: Map<string, RegExp> = new Map();
const BLOCKED_PACKAGE_PATTERNS: Map<string, RegExp> = new Map();

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
	metadata?: WorkflowMetadata;
	/** Benchmark timing data (only present when WORKWAY_BENCHMARK=1) */
	benchmark?: {
		totalMs: number;
		phases: Record<string, number>;
	};
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
 *
 * Set WORKWAY_BENCHMARK=1 to see timing information for each validation phase.
 */
export async function validateWorkflowFile(workflowPath: string): Promise<ValidationResult> {
	const bench = createEnvBenchmark();
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];
	const metadata: WorkflowMetadata = {};

	// Read file content
	bench.start('file-read');
	let content: string;
	try {
		content = await fs.readFile(workflowPath, 'utf-8');
	} catch (error) {
		bench.end('file-read');
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
	bench.end('file-read');

	// Check for required imports
	bench.time('validate-imports', () => {
		validateImports(content, errors, warnings, metadata);
	});

	// Check for workflow definition
	bench.time('validate-definition', () => {
		validateWorkflowDefinition(content, errors, warnings, metadata);
	});

	// Check for execute function
	bench.time('validate-execute', () => {
		validateExecuteFunction(content, errors, warnings);
	});

	// Validate integrations
	bench.time('validate-integrations', () => {
		validateIntegrations(content, errors, warnings, metadata);
	});

	// Validate trigger
	bench.time('validate-trigger', () => {
		validateTrigger(content, errors, warnings, metadata);
	});

	// Validate pricing
	bench.time('validate-pricing', () => {
		validatePricing(content, errors, warnings, metadata);
	});

	// Check for AI usage
	bench.time('validate-ai', () => {
		validateAIUsage(content, errors, warnings, metadata);
	});

	// Check for common mistakes
	bench.time('validate-mistakes', () => {
		validateCommonMistakes(content, errors, warnings);
	});

	// Build result with optional benchmark data
	const result: ValidationResult = {
		valid: errors.length === 0,
		errors,
		warnings,
		metadata,
	};

	// Include benchmark data if enabled
	const report = bench.getReport();
	if (report.totalDuration > 0 && Object.keys(report.summary).length > 0) {
		result.benchmark = {
			totalMs: report.totalDuration,
			phases: report.summary,
		};
	}

	return result;
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

// Initialize cached patterns for blocked modules/packages at module load
for (const mod of BLOCKED_NODE_MODULES) {
	BLOCKED_MODULE_PATTERNS.set(
		mod,
		new RegExp(`(import\\s+.*from\\s+['"\`]${mod}['"\`])|(require\\s*\\(\\s*['"\`]${mod}['"\`]\\s*\\))`, 'g')
	);
}

for (const pkg of BLOCKED_NPM_PACKAGES) {
	BLOCKED_PACKAGE_PATTERNS.set(
		pkg,
		new RegExp(`(import\\s+.*from\\s+['"\`]${pkg}['"\`])|(require\\s*\\(\\s*['"\`]${pkg}['"\`]\\s*\\))`, 'g')
	);
}

/**
 * Suggestions for blocked Node.js modules
 */
const NODE_MODULE_SUGGESTIONS: Record<string, string> = {
	'fs': 'Cloudflare Workers have no filesystem. Store data in KV or R2.',
	'path': 'Use string manipulation or URL API instead.',
	'child_process': 'Workers cannot spawn processes. Use external services.',
	'crypto': 'Use Web Crypto API: crypto.subtle.digest(), crypto.randomUUID()',
	'http': 'Use native fetch() instead.',
	'https': 'Use native fetch() instead.',
	'buffer': 'Use ArrayBuffer/Uint8Array instead.',
	'stream': 'Use Web Streams API (ReadableStream, WritableStream).',
};

/**
 * Suggestions for blocked npm packages
 */
const NPM_PACKAGE_SUGGESTIONS: Record<string, string> = {
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

/**
 * Validate imports - uses pre-compiled patterns for performance
 */
function validateImports(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for SDK import (using cached pattern)
	if (!PATTERNS.sdkImport.test(content)) {
		errors.push({
			type: 'error',
			code: 'MISSING_SDK_IMPORT',
			message: 'Workflow must import from @workway/sdk',
			suggestion: "Add: import { defineWorkflow } from '@workway/sdk'",
		});
	}

	// Check for Workers AI import if using AI (using cached patterns)
	const hasAIUsage = PATTERNS.aiUsage.test(content);
	const hasWorkersAIImport = PATTERNS.workersAIImport.test(content);

	if (hasAIUsage && !hasWorkersAIImport) {
		warnings.push({
			type: 'warning',
			code: 'MISSING_AI_IMPORT',
			message: 'AI usage detected but no workers-ai import found',
			suggestion: "Add: import { createAIClient, AIModels } from '@workway/sdk/workers-ai'",
		});
	}

	metadata.hasAI = hasAIUsage;

	// Check for Node.js stdlib imports (using pre-compiled patterns)
	for (const mod of BLOCKED_NODE_MODULES) {
		const pattern = BLOCKED_MODULE_PATTERNS.get(mod);
		if (pattern) {
			// Reset lastIndex for global patterns before testing
			pattern.lastIndex = 0;
			if (pattern.test(content)) {
				errors.push({
					type: 'error',
					code: 'BLOCKED_NODE_MODULE',
					message: `Node.js module '${mod}' is not available in Cloudflare Workers`,
					suggestion: NODE_MODULE_SUGGESTIONS[mod] || 'See docs/WORKERS_RUNTIME_GUIDE.md for alternatives.',
				});
			}
		}
	}

	// Check for npm packages known to not work (using pre-compiled patterns)
	for (const pkg of BLOCKED_NPM_PACKAGES) {
		const pattern = BLOCKED_PACKAGE_PATTERNS.get(pkg);
		if (pattern) {
			// Reset lastIndex for global patterns before testing
			pattern.lastIndex = 0;
			if (pattern.test(content)) {
				warnings.push({
					type: 'warning',
					code: 'INCOMPATIBLE_NPM_PACKAGE',
					message: `npm package '${pkg}' is incompatible with Cloudflare Workers`,
					suggestion: NPM_PACKAGE_SUGGESTIONS[pkg] || 'See docs/WORKERS_RUNTIME_GUIDE.md for alternatives.',
				});
			}
		}
	}
}

/**
 * Validate workflow definition structure - uses pre-compiled patterns
 */
function validateWorkflowDefinition(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for defineWorkflow or export default (using cached patterns)
	const hasDefineWorkflow = PATTERNS.defineWorkflow.test(content);
	const hasExportDefault = PATTERNS.exportDefault.test(content);

	if (!hasDefineWorkflow && !hasExportDefault) {
		errors.push({
			type: 'error',
			code: 'NO_WORKFLOW_EXPORT',
			message: 'Workflow must use defineWorkflow() or export default',
			suggestion: 'Wrap your workflow in defineWorkflow({ ... })',
		});
	}

	// Extract workflow name (using cached pattern)
	const nameMatch = content.match(PATTERNS.workflowName);
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

	// Extract workflow type (using cached pattern)
	const typeMatch = content.match(PATTERNS.workflowType);
	if (typeMatch) {
		metadata.type = typeMatch[1];
	}
}

/**
 * Validate execute function - uses pre-compiled patterns
 */
function validateExecuteFunction(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[]
): void {
	// Check for execute function (using cached patterns)
	const hasExecute = PATTERNS.hasExecute.test(content);
	const hasRun = PATTERNS.hasRun.test(content);

	if (!hasExecute && !hasRun) {
		errors.push({
			type: 'error',
			code: 'MISSING_EXECUTE',
			message: 'Workflow must have an execute or run function',
			suggestion: 'Add: async execute({ trigger, actions }) { ... }',
		});
	}

	// Check for return statement in execute (using cached pattern)
	const executeMatch = content.match(PATTERNS.executeBody);
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
 * Validate integrations - uses pre-compiled patterns
 */
function validateIntegrations(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Extract integrations array (using cached pattern)
	const integrationsMatch = content.match(PATTERNS.integrationsBlock);
	if (!integrationsMatch) {
		return; // No integrations defined (might be valid for some workflows)
	}

	const integrationsBlock = integrationsMatch[1];
	const integrations: string[] = [];

	// Extract service names (using cached pattern - create fresh instance for matchAll)
	const servicePattern = new RegExp(PATTERNS.serviceNames.source, 'g');
	const serviceMatches = integrationsBlock.matchAll(servicePattern);
	for (const match of serviceMatches) {
		integrations.push(match[1].toLowerCase());
	}

	// Also check for shorthand: ['gmail', 'slack'] (using cached pattern)
	const shorthandPattern = new RegExp(PATTERNS.shorthandIntegrations.source, 'g');
	const shorthandMatches = integrationsBlock.matchAll(shorthandPattern);
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
 * Validate trigger configuration - uses pre-compiled patterns
 */
function validateTrigger(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for trigger definition (using cached pattern)
	if (!PATTERNS.hasTrigger.test(content)) {
		errors.push({
			type: 'error',
			code: 'MISSING_TRIGGER',
			message: 'Workflow must define a trigger',
			suggestion: "Add: trigger: webhook({ service: 'stripe', event: 'payment.succeeded' })",
		});
		return;
	}

	// Extract trigger type (using cached patterns)
	const triggerMatch = content.match(PATTERNS.triggerType);
	if (triggerMatch) {
		metadata.trigger = triggerMatch[1];
	} else {
		// Check for object-style trigger
		const triggerTypeMatch = content.match(PATTERNS.triggerObjectType);
		if (triggerTypeMatch) {
			metadata.trigger = triggerTypeMatch[1];
		}
	}

	// Validate webhook trigger (using cached pattern)
	if (content.includes('webhook(')) {
		const webhookMatch = content.match(PATTERNS.webhookConfig);
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

	// Validate schedule trigger (using cached pattern)
	if (content.includes('schedule(')) {
		const scheduleMatch = content.match(PATTERNS.scheduleExpr);
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
 * Validate pricing configuration - uses pre-compiled patterns
 */
function validatePricing(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Using cached pattern
	if (!PATTERNS.hasPricing.test(content)) {
		warnings.push({
			type: 'warning',
			code: 'MISSING_PRICING',
			message: 'Workflow should define pricing for marketplace',
			suggestion: "Add: pricing: { model: 'subscription', price: 10, executions: 100 }",
		});
		return;
	}

	// Extract pricing model (using cached pattern)
	const modelMatch = content.match(PATTERNS.pricingModel);
	if (modelMatch) {
		metadata.pricing = { model: modelMatch[1] };
	}

	// Extract price (using cached pattern)
	const priceMatch = content.match(PATTERNS.pricingPrice);
	if (priceMatch) {
		metadata.pricing = metadata.pricing || {};
		metadata.pricing.price = parseFloat(priceMatch[1]);
	}

	// Validate subscription pricing has executions (using cached pattern)
	if (modelMatch?.[1] === 'subscription') {
		if (!PATTERNS.hasExecutions.test(content)) {
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
 * Validate AI usage - uses pre-compiled patterns
 */
function validateAIUsage(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[],
	metadata: WorkflowMetadata
): void {
	// Check for external AI providers (using cached pattern)
	if (PATTERNS.externalAI.test(content)) {
		warnings.push({
			type: 'warning',
			code: 'EXTERNAL_AI_DETECTED',
			message: 'External AI providers detected. WORKWAY uses Cloudflare Workers AI only.',
			suggestion: "Use: createAIClient(env) with AIModels.LLAMA_3_8B or AIModels.MISTRAL_7B",
		});
	}

	// Check for proper AI client usage (using cached pattern)
	if (metadata.hasAI) {
		if (!PATTERNS.envAccess.test(content)) {
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
 * Validate common mistakes - uses pre-compiled patterns
 */
function validateCommonMistakes(
	content: string,
	errors: ValidationError[],
	warnings: ValidationWarning[]
): void {
	// Check for console.log (using cached pattern - create fresh for matchAll)
	const consolePattern = new RegExp(PATTERNS.consoleStatements.source, 'g');
	const consoleMatches = content.match(consolePattern);
	if (consoleMatches && consoleMatches.length > 3) {
		warnings.push({
			type: 'warning',
			code: 'EXCESSIVE_LOGGING',
			message: `Found ${consoleMatches.length} console statements`,
			suggestion: 'Consider reducing logging in production builds',
		});
	}

	// Check for hardcoded secrets (using pre-compiled patterns)
	for (const pattern of SECRET_PATTERNS) {
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

	// Check for await inside loops (using cached patterns)
	const awaitInLoop = PATTERNS.awaitInForLoop.test(content) ||
		PATTERNS.awaitInWhileLoop.test(content);
	if (awaitInLoop) {
		warnings.push({
			type: 'warning',
			code: 'AWAIT_IN_LOOP',
			message: 'Await inside loop detected (may affect performance)',
			suggestion: 'Consider using Promise.all() for parallel execution',
		});
	}

	// Check for empty catch blocks (using cached pattern)
	if (PATTERNS.emptyCatch.test(content)) {
		warnings.push({
			type: 'warning',
			code: 'EMPTY_CATCH',
			message: 'Empty catch block detected',
			suggestion: 'Handle or re-throw errors properly',
		});
	}
}

/**
 * Validate cron expression - uses pre-compiled patterns
 */
function isValidCron(expr: string): boolean {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return false;

	for (let i = 0; i < 5; i++) {
		// Allow wildcards and ranges (using cached patterns)
		const part = parts[i];
		if (part === '*') continue;
		if (PATTERNS.cronStepWildcard.test(part)) continue;
		if (PATTERNS.cronRangeList.test(part)) continue;
		if (!CRON_PATTERNS[i].test(part)) return false;
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

	// Include benchmark data if present
	if (result.benchmark) {
		lines.push('');
		lines.push(`[BENCHMARK] Total: ${result.benchmark.totalMs.toFixed(2)}ms`);

		// Sort phases by duration
		const sortedPhases = Object.entries(result.benchmark.phases)
			.sort((a, b) => b[1] - a[1]);

		for (const [phase, duration] of sortedPhases) {
			const pct = ((duration / result.benchmark.totalMs) * 100).toFixed(1);
			lines.push(`            ${phase}: ${duration.toFixed(2)}ms (${pct}%)`);
		}
	}

	return lines;
}

/**
 * Run a batch validation benchmark on multiple files
 * Useful for measuring overall validator performance.
 */
export async function benchmarkValidation(
	workflowPaths: string[],
	iterations = 1
): Promise<{
	totalFiles: number;
	totalIterations: number;
	totalMs: number;
	avgPerFile: number;
	avgPerIteration: number;
	results: Array<{ path: string; ms: number; valid: boolean }>;
}> {
	const start = performance.now();
	const results: Array<{ path: string; ms: number; valid: boolean }> = [];

	for (let i = 0; i < iterations; i++) {
		for (const workflowPath of workflowPaths) {
			const fileStart = performance.now();
			const result = await validateWorkflowFile(workflowPath);
			const fileEnd = performance.now();

			results.push({
				path: workflowPath,
				ms: fileEnd - fileStart,
				valid: result.valid,
			});
		}
	}

	const end = performance.now();
	const totalMs = end - start;

	return {
		totalFiles: workflowPaths.length,
		totalIterations: iterations,
		totalMs,
		avgPerFile: totalMs / (workflowPaths.length * iterations),
		avgPerIteration: totalMs / iterations,
		results,
	};
}

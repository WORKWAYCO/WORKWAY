/**
 * Agentic Explain Command
 *
 * Explain workflow functionality in plain English.
 * Zuhandenheit: Complex code becomes accessible understanding.
 *
 * @example
 * ```bash
 * workway explain workflow.ts
 * workway explain examples/meeting-intelligence/workflow.ts
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

/**
 * Parse workflow metadata from code
 */
function parseWorkflowMetadata(code: string): {
	name: string;
	description: string;
	version: string;
	integrations: string[];
	trigger: string;
	inputs: string[];
	hasOnError: boolean;
} {
	// Extract name
	const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/);
	const name = nameMatch?.[1] || 'Unnamed Workflow';

	// Extract description
	const descMatch = code.match(/description:\s*['"`]([^'"`]+)['"`]/);
	const description = descMatch?.[1] || 'No description';

	// Extract version
	const versionMatch = code.match(/version:\s*['"`]([^'"`]+)['"`]/);
	const version = versionMatch?.[1] || '1.0.0';

	// Extract integrations
	const integrations: string[] = [];
	const intMatch = code.match(/integrations:\s*\[([\s\S]*?)\]/);
	if (intMatch) {
		const serviceMatches = intMatch[1].matchAll(/service:\s*['"`]([^'"`]+)['"`]/g);
		for (const match of serviceMatches) {
			integrations.push(match[1]);
		}
	}

	// Extract trigger type
	let trigger = 'manual';
	if (code.includes('webhook(')) {
		const webhookMatch = code.match(/webhook\(\s*\{\s*service:\s*['"`]([^'"`]+)['"`],\s*event:\s*['"`]([^'"`]+)['"`]/);
		if (webhookMatch) {
			trigger = `webhook: ${webhookMatch[1]}.${webhookMatch[2]}`;
		} else {
			trigger = 'webhook';
		}
	} else if (code.includes('schedule(')) {
		const scheduleMatch = code.match(/schedule\(\s*['"`]([^'"`]+)['"`]/);
		trigger = scheduleMatch ? `schedule: ${scheduleMatch[1]}` : 'schedule';
	}

	// Extract inputs
	const inputs: string[] = [];
	const inputsMatch = code.match(/inputs:\s*\{([\s\S]*?)\n\s*\},?\n/);
	if (inputsMatch) {
		const inputNames = inputsMatch[1].matchAll(/(\w+):\s*\{/g);
		for (const match of inputNames) {
			inputs.push(match[1]);
		}
	}

	// Check for onError handler
	const hasOnError = code.includes('onError:');

	return { name, description, version, integrations, trigger, inputs, hasOnError };
}

/**
 * Analyze workflow execution flow
 */
function analyzeExecutionFlow(code: string): string[] {
	const steps: string[] = [];

	// Look for common patterns
	if (code.includes('ai.transcribe') || code.includes('transcribeAudio')) {
		steps.push('Transcribes audio content');
	}
	if (code.includes('ai.synthesize') || code.includes('extractStructured')) {
		steps.push('Analyzes and extracts structured insights using AI');
	}
	if (code.includes('ai.generateContent') || code.includes('generateText')) {
		steps.push('Generates content using AI');
	}
	if (code.includes('ai.seoOptimize')) {
		steps.push('Extracts SEO metadata');
	}
	if (code.includes('ai.generateStyledImage') || code.includes('generateImage')) {
		steps.push('Generates images');
	}
	if (code.includes('ai.translateBatch') || code.includes('translateText')) {
		steps.push('Translates content to multiple languages');
	}
	if (code.includes('ai.createSocialVariants')) {
		steps.push('Creates social media variants');
	}

	// Integration actions
	if (code.includes('notion.createDocument') || code.includes('notion.pages.create')) {
		steps.push('Saves to Notion');
	}
	if (code.includes('slack.sendMessage')) {
		steps.push('Sends Slack notifications');
	}
	if (code.includes('slack.sendDirectMessage')) {
		steps.push('Sends Slack direct messages');
	}
	if (code.includes('linear.issues.create') || code.includes('linear.createIssue')) {
		steps.push('Creates Linear tasks');
	}
	if (code.includes('gmail.messages') || code.includes('gmail.send')) {
		steps.push('Interacts with Gmail');
	}
	if (code.includes('stripe.')) {
		steps.push('Processes Stripe payments');
	}
	if (code.includes('sheets.') || code.includes('spreadsheet')) {
		steps.push('Updates Google Sheets');
	}

	// Control flow
	if (code.includes('for (') || code.includes('forEach')) {
		steps.push('Processes items in batches');
	}
	if (code.includes('if (') && code.includes('else')) {
		steps.push('Routes based on conditions');
	}

	return steps;
}

/**
 * Estimate workflow cost
 */
function estimateCost(code: string): { perExecution: string; monthly: string; notes: string[] } {
	const notes: string[] = [];
	let baseCost = 0.05;

	// AI usage increases cost
	if (code.includes('ai.synthesize') || code.includes('ai.generateText') || code.includes('ai.generateContent')) {
		baseCost += 0.05;
		notes.push('AI text generation included');
	}
	if (code.includes('ai.generateImage') || code.includes('ai.generateStyledImage')) {
		baseCost += 0.10;
		notes.push('AI image generation included');
	}
	if (code.includes('ai.transcribe')) {
		baseCost += 0.10;
		notes.push('Audio transcription included');
	}
	if (code.includes('ai.translateBatch')) {
		baseCost += 0.05;
		notes.push('Multi-language translation included');
	}

	// Check for explicit pricing
	const priceMatch = code.match(/pricePerExecution:\s*([\d.]+)/);
	if (priceMatch) {
		baseCost = parseFloat(priceMatch[1]);
	}

	return {
		perExecution: `$${baseCost.toFixed(2)}`,
		monthly: `$${(baseCost * 100).toFixed(2)} (at 100 executions)`,
		notes,
	};
}

/**
 * Explain workflow command
 */
export async function explainCommand(filePath?: string): Promise<void> {
	Logger.header('Workflow Explanation');
	Logger.blank();

	// Find workflow file
	let targetPath = filePath;
	if (!targetPath) {
		// Look for workflow.ts in current directory or subdirectories
		const candidates = [
			'workflow.ts',
			'src/workflow.ts',
			'workflows/workflow.ts',
		];

		for (const candidate of candidates) {
			try {
				await fs.access(candidate);
				targetPath = candidate;
				break;
			} catch {
				// Continue searching
			}
		}

		if (!targetPath) {
			Logger.error('No workflow file found. Please specify a path:');
			Logger.log('  workway explain path/to/workflow.ts');
			process.exit(1);
		}
	}

	// Read file
	const fullPath = path.resolve(targetPath);
	let code: string;

	try {
		code = await fs.readFile(fullPath, 'utf-8');
	} catch (error) {
		Logger.error(`Cannot read file: ${fullPath}`);
		process.exit(1);
	}

	// Parse metadata
	const metadata = parseWorkflowMetadata(code);
	const steps = analyzeExecutionFlow(code);
	const cost = estimateCost(code);

	// Display explanation
	Logger.log(`📋 ${metadata.name}`);
	Logger.log(`   ${metadata.description}`);
	Logger.blank();

	// Overview box
	Logger.log('┌─────────────────────────────────────────────────────────────┐');
	Logger.log(`│ Version: ${metadata.version.padEnd(51)}│`);
	Logger.log(`│ Trigger: ${metadata.trigger.padEnd(51)}│`);
	Logger.log(`│ Integrations: ${metadata.integrations.join(', ').padEnd(46)}│`);
	Logger.log(`│ Error Handling: ${(metadata.hasOnError ? 'Yes' : 'No').padEnd(43)}│`);
	Logger.log('└─────────────────────────────────────────────────────────────┘');
	Logger.blank();

	// Inputs
	if (metadata.inputs.length > 0) {
		Logger.info('Required Inputs:');
		for (const input of metadata.inputs) {
			Logger.log(`  - ${input}`);
		}
		Logger.blank();
	}

	// Execution flow
	if (steps.length > 0) {
		Logger.info('Execution Flow:');
		for (let i = 0; i < steps.length; i++) {
			Logger.log(`  ${i + 1}. ${steps[i]}`);
		}
		Logger.blank();
	}

	// Cost estimate
	Logger.info('Cost Estimate:');
	Logger.log(`  Per execution: ${cost.perExecution}`);
	Logger.log(`  Monthly (100 runs): ${cost.monthly}`);
	if (cost.notes.length > 0) {
		for (const note of cost.notes) {
			Logger.log(`  - ${note}`);
		}
	}
	Logger.blank();

	// Integrations detail
	if (metadata.integrations.length > 0) {
		Logger.info('Integration Requirements:');
		for (const int of metadata.integrations) {
			const scopes = getIntegrationScopes(int, code);
			Logger.log(`  ${int}: ${scopes.join(', ')}`);
		}
		Logger.blank();
	}

	Logger.success(`Analyzed: ${fullPath}`);
}

/**
 * Get scopes for an integration
 */
function getIntegrationScopes(integration: string, code: string): string[] {
	const defaultScopes: Record<string, string[]> = {
		slack: ['read_messages', 'send_messages'],
		notion: ['read_pages', 'write_pages'],
		linear: ['read_issues', 'write_issues'],
		github: ['read_repos', 'write_repos'],
		gmail: ['read_emails', 'send_emails'],
		stripe: ['read_payments', 'write_payments'],
		zoom: ['read_recordings'],
		sheets: ['read_sheets', 'write_sheets'],
		airtable: ['read_records', 'write_records'],
	};

	// Try to extract from code
	const scopeMatch = code.match(
		new RegExp(`service:\\s*['"]${integration}['"][^}]*scopes:\\s*\\[([^\\]]+)\\]`)
	);

	if (scopeMatch) {
		const scopes = scopeMatch[1].match(/['"]([^'"]+)['"]/g);
		if (scopes) {
			return scopes.map((s) => s.replace(/['"]/g, ''));
		}
	}

	return defaultScopes[integration] || ['read', 'write'];
}

export default explainCommand;

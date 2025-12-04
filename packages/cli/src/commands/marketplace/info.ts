/**
 * Marketplace Info Command
 *
 * View detailed information about a workflow in the marketplace.
 * Zuhandenheit: Understanding before action.
 *
 * @example
 * ```bash
 * workway marketplace info meeting-intelligence
 * workway marketplace info alexchen/meeting-intelligence
 * workway marketplace info wf_abc123
 * ```
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';

/**
 * Detailed workflow information
 */
interface WorkflowDetails {
	id: string;
	name: string;
	description: string;
	longDescription: string;
	developer: {
		id: string;
		name: string;
		verified: boolean;
	};
	category: string;
	version: string;
	activeInstalls: number;
	rating: number;
	reviewCount: number;
	allowForks: boolean;
	forkCount: number;
	price: {
		type: 'free' | 'paid' | 'usage';
		amount?: number;
		currency?: string;
	};
	integrations: string[];
	triggers: string[];
	createdAt: string;
	updatedAt: string;
	lineage?: {
		originalId: string;
		originalName: string;
		forkDepth: number;
	};
}

/**
 * Mock workflow lookup
 */
function lookupWorkflow(identifier: string): WorkflowDetails | null {
	// Normalize identifier
	const normalized = identifier.toLowerCase().replace(/^wf_/, '');

	// Mock database
	const workflows: Record<string, WorkflowDetails> = {
		'meeting-intelligence': {
			id: 'wf_meeting_intel',
			name: 'meeting-intelligence',
			description: 'AI-powered meeting transcription, summarization, and action item extraction',
			longDescription: `Meeting Intelligence automatically joins your scheduled meetings, transcribes them in real-time, and uses AI to extract key insights.

Features:
• Real-time transcription with speaker identification
• AI-generated meeting summaries
• Automatic action item extraction
• Integration with Notion, Slack, and email
• Support for Zoom, Google Meet, and Teams`,
			developer: { id: 'dev_alex', name: 'alexchen', verified: true },
			category: 'productivity',
			version: '2.1.0',
			activeInstalls: 1247,
			rating: 4.8,
			reviewCount: 89,
			allowForks: true,
			forkCount: 23,
			price: { type: 'usage' },
			integrations: ['zoom', 'google-meet', 'slack', 'notion', 'gmail'],
			triggers: ['calendar_event', 'webhook', 'manual'],
			createdAt: '2024-06-15',
			updatedAt: '2024-11-28',
		},
		'email-automation': {
			id: 'wf_email_auto',
			name: 'email-automation',
			description: 'Smart email routing, auto-responses, and inbox management',
			longDescription: `Email Automation helps you manage your inbox intelligently with AI-powered routing and responses.

Features:
• Smart email categorization
• Auto-draft responses for common inquiries
• Priority inbox management
• Scheduled follow-up reminders
• Integration with CRM systems`,
			developer: { id: 'dev_sarah', name: 'sarahdev', verified: true },
			category: 'productivity',
			version: '1.5.2',
			activeInstalls: 892,
			rating: 4.6,
			reviewCount: 67,
			allowForks: true,
			forkCount: 15,
			price: { type: 'free' },
			integrations: ['gmail', 'outlook', 'slack', 'notion'],
			triggers: ['email_received', 'scheduled', 'manual'],
			createdAt: '2024-08-22',
			updatedAt: '2024-11-15',
		},
		'notion-github-sync': {
			id: 'wf_notion_sync',
			name: 'notion-github-sync',
			description: 'Bi-directional sync between Notion and GitHub issues',
			longDescription: `Keep your Notion project boards and GitHub issues in sync automatically.

Features:
• Two-way sync between Notion databases and GitHub issues
• Automatic status updates
• Comment synchronization
• Label and tag mapping
• Customizable field mappings`,
			developer: { id: 'dev_alex', name: 'alexchen', verified: true },
			category: 'development',
			version: '1.2.0',
			activeInstalls: 521,
			rating: 4.7,
			reviewCount: 38,
			allowForks: true,
			forkCount: 8,
			price: { type: 'paid', amount: 9, currency: 'USD' },
			integrations: ['notion', 'github'],
			triggers: ['notion_updated', 'github_issue', 'scheduled'],
			createdAt: '2024-09-10',
			updatedAt: '2024-11-20',
		},
	};

	// Try exact match
	if (workflows[normalized]) {
		return workflows[normalized];
	}

	// Try with developer prefix stripped
	const withoutDeveloper = normalized.split('/').pop() || normalized;
	if (workflows[withoutDeveloper]) {
		return workflows[withoutDeveloper];
	}

	return null;
}

/**
 * Format price display
 */
function formatPrice(price: WorkflowDetails['price']): string {
	switch (price.type) {
		case 'free':
			return 'Free';
		case 'paid':
			return `$${price.amount}/${price.currency === 'USD' ? 'mo' : price.currency}`;
		case 'usage':
			return 'Usage-based pricing';
		default:
			return 'Unknown';
	}
}

/**
 * Marketplace info command
 */
export async function marketplaceInfoCommand(workflowIdentifier?: string): Promise<void> {
	Logger.header('Workflow Details');
	Logger.blank();

	// Get workflow identifier if not provided
	let targetId = workflowIdentifier;
	if (!targetId) {
		Logger.info('View detailed information about a marketplace workflow.');
		Logger.blank();
		Logger.log('Enter a workflow identifier:');
		Logger.log('  - Name: meeting-intelligence');
		Logger.log('  - Developer/name: alexchen/meeting-intelligence');
		Logger.log('  - ID: wf_abc123');
		Logger.blank();

		const answer = await inquirer.prompt([
			{
				type: 'input',
				name: 'workflow',
				message: 'Workflow:',
				validate: (input: string) => input.length > 0 || 'Please enter a workflow name or ID',
			},
		]);
		targetId = answer.workflow;
	}

	// Lookup workflow
	const spinner = Logger.spinner('Fetching workflow details...');
	await new Promise((resolve) => setTimeout(resolve, 500));

	const workflow = lookupWorkflow(targetId!);

	if (!workflow) {
		spinner.fail('Workflow not found');
		Logger.blank();
		Logger.log(`Could not find: ${targetId}`);
		Logger.log('');
		Logger.log('Try searching the marketplace:');
		Logger.log('  workway marketplace search <query>');
		return;
	}

	spinner.succeed(`Found: ${workflow.name}`);
	Logger.blank();

	// Display workflow details
	const verifiedBadge = workflow.developer.verified ? ' ✓' : '';

	Logger.info(`${workflow.developer.name}/${workflow.name}${verifiedBadge}`);
	Logger.log(`  ${workflow.description}`);
	Logger.blank();

	// Stats row
	Logger.log(`  ⭐ ${workflow.rating.toFixed(1)} (${workflow.reviewCount} reviews)`);
	Logger.log(`  📦 ${workflow.activeInstalls.toLocaleString()} active installs`);
	Logger.log(`  🔀 ${workflow.forkCount} forks`);
	Logger.log(`  💰 ${formatPrice(workflow.price)}`);
	Logger.blank();

	// Metadata
	Logger.info('Details:');
	Logger.log(`  Category: ${workflow.category}`);
	Logger.log(`  Version: ${workflow.version}`);
	Logger.log(`  Updated: ${workflow.updatedAt}`);
	Logger.log(`  Forking: ${workflow.allowForks ? 'Allowed' : 'Not allowed'}`);
	Logger.blank();

	// Integrations
	if (workflow.integrations.length > 0) {
		Logger.info('Integrations:');
		Logger.log(`  ${workflow.integrations.join(', ')}`);
		Logger.blank();
	}

	// Triggers
	if (workflow.triggers.length > 0) {
		Logger.info('Triggers:');
		Logger.log(`  ${workflow.triggers.join(', ')}`);
		Logger.blank();
	}

	// Long description
	Logger.info('About:');
	const lines = workflow.longDescription.split('\n');
	for (const line of lines) {
		Logger.log(`  ${line}`);
	}
	Logger.blank();

	// Lineage info if forked
	if (workflow.lineage) {
		Logger.info('Lineage:');
		Logger.log(`  Forked from: ${workflow.lineage.originalName}`);
		Logger.log(`  Fork depth: ${workflow.lineage.forkDepth}`);
		Logger.blank();
	}

	// Actions
	const choices = [
		{ name: '🔀 Fork this workflow', value: 'fork' },
		{ name: '📦 Install this workflow', value: 'install' },
		{ name: '🌐 View on web', value: 'web' },
		{ name: '✕ Exit', value: 'exit' },
	];

	if (!workflow.allowForks) {
		choices.shift(); // Remove fork option
	}

	const action = await inquirer.prompt([
		{
			type: 'list',
			name: 'action',
			message: 'What would you like to do?',
			choices,
		},
	]);

	switch (action.action) {
		case 'fork':
			Logger.blank();
			Logger.info(`Run: workway workflow fork ${workflow.developer.name}/${workflow.name}`);
			break;
		case 'install':
			Logger.blank();
			Logger.info(`Run: workway workflow install ${workflow.developer.name}/${workflow.name}`);
			break;
		case 'web':
			Logger.blank();
			Logger.info(`Visit: https://workway.ai/marketplace/${workflow.developer.name}/${workflow.name}`);
			break;
		case 'exit':
		default:
			break;
	}
}

export default marketplaceInfoCommand;

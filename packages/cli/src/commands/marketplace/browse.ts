/**
 * Marketplace Browse Command
 *
 * @deprecated Use `workway needs` instead for outcome-based discovery.
 *
 * This command uses the legacy category-based browsing model.
 * The pathway model (workway needs) provides better discovery by
 * surfacing ONE workflow at moments of relevance, rather than
 * forcing users to browse and compare.
 *
 * See: docs/MARKETPLACE_CURATION.md (The Pathway Model)
 *
 * @example
 * ```bash
 * # New way (recommended):
 * workway needs --from zoom --to notion
 * workway needs --after meetings
 *
 * # Old way (deprecated):
 * workway marketplace browse
 * workway marketplace browse --category=productivity
 * ```
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';

/**
 * Category definition
 */
interface Category {
	id: string;
	name: string;
	description: string;
	workflowCount: number;
}

/**
 * Workflow summary for browse
 */
interface WorkflowSummary {
	id: string;
	name: string;
	developer: string;
	description: string;
	activeInstalls: number;
	rating: number;
	allowForks: boolean;
}

/**
 * Browse options
 */
interface BrowseOptions {
	category?: string;
	featured?: boolean;
	limit?: number;
}

/**
 * Mock categories
 */
const CATEGORIES: Category[] = [
	{ id: 'productivity', name: 'Productivity', description: 'Automate daily tasks and workflows', workflowCount: 47 },
	{ id: 'communication', name: 'Communication', description: 'Email, Slack, and messaging automation', workflowCount: 32 },
	{ id: 'development', name: 'Development', description: 'CI/CD, GitHub, and code workflows', workflowCount: 28 },
	{ id: 'marketing', name: 'Marketing', description: 'Social media and campaign automation', workflowCount: 23 },
	{ id: 'finance', name: 'Finance', description: 'Invoicing, payments, and accounting', workflowCount: 19 },
	{ id: 'analytics', name: 'Analytics', description: 'Data processing and reporting', workflowCount: 15 },
];

/**
 * Mock workflows by category
 */
const WORKFLOWS_BY_CATEGORY: Record<string, WorkflowSummary[]> = {
	productivity: [
		{ id: 'wf_meeting', name: 'meeting-intelligence', developer: 'alexchen', description: 'AI meeting transcription & summaries', activeInstalls: 1247, rating: 4.8, allowForks: true },
		{ id: 'wf_email', name: 'email-automation', developer: 'sarahdev', description: 'Smart email routing & auto-responses', activeInstalls: 892, rating: 4.6, allowForks: true },
		{ id: 'wf_task', name: 'task-scheduler', developer: 'prodtools', description: 'Intelligent task scheduling', activeInstalls: 567, rating: 4.5, allowForks: true },
	],
	communication: [
		{ id: 'wf_slack', name: 'slack-daily-digest', developer: 'mikebuilds', description: 'Summarize channels daily', activeInstalls: 634, rating: 4.5, allowForks: true },
		{ id: 'wf_notif', name: 'notification-hub', developer: 'alertsdev', description: 'Unified notifications', activeInstalls: 423, rating: 4.4, allowForks: true },
	],
	development: [
		{ id: 'wf_notion', name: 'notion-github-sync', developer: 'alexchen', description: 'Sync Notion with GitHub issues', activeInstalls: 521, rating: 4.7, allowForks: true },
		{ id: 'wf_deploy', name: 'deploy-notifier', developer: 'devops', description: 'Deployment notifications', activeInstalls: 389, rating: 4.6, allowForks: true },
	],
	marketing: [
		{ id: 'wf_social', name: 'social-scheduler', developer: 'socialtools', description: 'Cross-platform posting', activeInstalls: 378, rating: 4.3, allowForks: true },
	],
	finance: [
		{ id: 'wf_invoice', name: 'invoice-generator', developer: 'financetools', description: 'Auto-generate invoices', activeInstalls: 445, rating: 4.4, allowForks: false },
	],
	analytics: [
		{ id: 'wf_report', name: 'weekly-reports', developer: 'datatools', description: 'Automated weekly reports', activeInstalls: 312, rating: 4.5, allowForks: true },
	],
};

/**
 * Featured workflows
 */
const FEATURED_WORKFLOWS: WorkflowSummary[] = [
	{ id: 'wf_meeting', name: 'meeting-intelligence', developer: 'alexchen', description: 'AI meeting transcription & summaries', activeInstalls: 1247, rating: 4.8, allowForks: true },
	{ id: 'wf_email', name: 'email-automation', developer: 'sarahdev', description: 'Smart email routing & auto-responses', activeInstalls: 892, rating: 4.6, allowForks: true },
	{ id: 'wf_notion', name: 'notion-github-sync', developer: 'alexchen', description: 'Sync Notion with GitHub issues', activeInstalls: 521, rating: 4.7, allowForks: true },
];

/**
 * Display workflow list
 */
function displayWorkflows(workflows: WorkflowSummary[]): void {
	for (const w of workflows) {
		const forkBadge = w.allowForks ? '' : ' [no-fork]';
		Logger.log(`  ${w.developer}/${w.name}${forkBadge}`);
		Logger.log(`    ${w.description}`);
		Logger.log(`    ⭐ ${w.rating.toFixed(1)} · ${w.activeInstalls.toLocaleString()} installs`);
		Logger.blank();
	}
}

/**
 * Marketplace browse command
 * @deprecated Use marketplaceNeedsCommand instead
 */
export async function marketplaceBrowseCommand(options: BrowseOptions = {}): Promise<void> {
	Logger.header('Marketplace Browse');
	Logger.blank();

	// Deprecation notice
	Logger.warn('This command is deprecated. Use "workway needs" instead.');
	Logger.log('  workway needs --from zoom --to notion');
	Logger.log('  workway needs --after meetings');
	Logger.blank();

	// If featured flag, show featured workflows
	if (options.featured) {
		Logger.info('Featured Workflows');
		Logger.blank();

		const spinner = Logger.spinner('Loading featured workflows...');
		await new Promise((resolve) => setTimeout(resolve, 400));
		spinner.succeed('Featured workflows');
		Logger.blank();

		displayWorkflows(FEATURED_WORKFLOWS);

		// Prompt for action
		const choices = FEATURED_WORKFLOWS.map((w) => ({
			name: `${w.developer}/${w.name}`,
			value: w.id,
		}));
		choices.push({ name: '← Browse categories', value: 'categories' });
		choices.push({ name: '✕ Exit', value: 'exit' });

		const action = await inquirer.prompt([
			{
				type: 'list',
				name: 'workflow',
				message: 'Select a workflow:',
				choices,
			},
		]);

		if (action.workflow === 'exit') return;
		if (action.workflow === 'categories') {
			await marketplaceBrowseCommand({});
			return;
		}

		const selected = FEATURED_WORKFLOWS.find((w) => w.id === action.workflow);
		if (selected) {
			Logger.blank();
			Logger.info(`To view: workway marketplace info ${selected.developer}/${selected.name}`);
			Logger.info(`To fork: workway workflow fork ${selected.developer}/${selected.name}`);
		}
		return;
	}

	// If category specified, show workflows in that category
	if (options.category) {
		const category = CATEGORIES.find((c) => c.id.toLowerCase() === options.category?.toLowerCase());
		if (!category) {
			Logger.error(`Unknown category: ${options.category}`);
			Logger.log('');
			Logger.log('Available categories:');
			for (const c of CATEGORIES) {
				Logger.log(`  ${c.id} - ${c.name}`);
			}
			return;
		}

		Logger.info(`Category: ${category.name}`);
		Logger.log(`  ${category.description}`);
		Logger.blank();

		const spinner = Logger.spinner('Loading workflows...');
		await new Promise((resolve) => setTimeout(resolve, 400));

		const workflows = WORKFLOWS_BY_CATEGORY[category.id] || [];
		spinner.succeed(`${workflows.length} workflow${workflows.length === 1 ? '' : 's'} in ${category.name}`);
		Logger.blank();

		if (workflows.length === 0) {
			Logger.log('  No workflows in this category yet.');
			Logger.log('  Be the first to publish!');
			return;
		}

		displayWorkflows(workflows);

		// Prompt for action
		const choices = workflows.map((w) => ({
			name: `${w.developer}/${w.name}`,
			value: w.id,
		}));
		choices.push({ name: '← Browse categories', value: 'categories' });
		choices.push({ name: '✕ Exit', value: 'exit' });

		const action = await inquirer.prompt([
			{
				type: 'list',
				name: 'workflow',
				message: 'Select a workflow:',
				choices,
			},
		]);

		if (action.workflow === 'exit') return;
		if (action.workflow === 'categories') {
			await marketplaceBrowseCommand({});
			return;
		}

		const selected = workflows.find((w) => w.id === action.workflow);
		if (selected) {
			Logger.blank();
			Logger.info(`To view: workway marketplace info ${selected.developer}/${selected.name}`);
			Logger.info(`To fork: workway workflow fork ${selected.developer}/${selected.name}`);
		}
		return;
	}

	// Show category picker
	Logger.info('Browse by Category');
	Logger.blank();

	const spinner = Logger.spinner('Loading categories...');
	await new Promise((resolve) => setTimeout(resolve, 300));
	spinner.succeed('Categories loaded');
	Logger.blank();

	const categoryChoices = CATEGORIES.map((c) => ({
		name: `${c.name} (${c.workflowCount})`,
		value: c.id,
	}));
	categoryChoices.push({ name: '⭐ Featured workflows', value: 'featured' });
	categoryChoices.push({ name: '🔍 Search instead', value: 'search' });
	categoryChoices.push({ name: '✕ Exit', value: 'exit' });

	const answer = await inquirer.prompt([
		{
			type: 'list',
			name: 'category',
			message: 'Select a category:',
			choices: categoryChoices,
		},
	]);

	if (answer.category === 'exit') return;
	if (answer.category === 'search') {
		Logger.blank();
		Logger.info('Use: workway marketplace search <query>');
		return;
	}
	if (answer.category === 'featured') {
		await marketplaceBrowseCommand({ featured: true });
		return;
	}

	// Recurse with selected category
	await marketplaceBrowseCommand({ category: answer.category });
}

export default marketplaceBrowseCommand;

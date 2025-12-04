/**
 * Marketplace Search Command
 *
 * Search workflows in the WORKWAY marketplace from the terminal.
 * Zuhandenheit: The tool recedes, discovery emerges.
 *
 * @example
 * ```bash
 * workway marketplace search "email automation"
 * workway marketplace search --category=productivity
 * workway marketplace search --developer=alexchen
 * ```
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';

/**
 * Search result workflow
 */
interface SearchResult {
	id: string;
	name: string;
	description: string;
	developer: {
		id: string;
		name: string;
	};
	category: string;
	activeInstalls: number;
	rating: number;
	reviewCount: number;
	allowForks: boolean;
	price: {
		type: 'free' | 'paid' | 'usage';
		amount?: number;
	};
}

/**
 * Search options
 */
interface SearchOptions {
	category?: string;
	developer?: string;
	sortBy?: 'relevance' | 'popular' | 'recent' | 'rating';
	limit?: number;
}

/**
 * Mock search results (replace with API calls in production)
 */
function mockSearch(query: string, options: SearchOptions): SearchResult[] {
	// Simulated marketplace data
	const allWorkflows: SearchResult[] = [
		{
			id: 'wf_meeting_intel',
			name: 'meeting-intelligence',
			description: 'AI-powered meeting transcription, summarization, and action item extraction',
			developer: { id: 'dev_alex', name: 'alexchen' },
			category: 'productivity',
			activeInstalls: 1247,
			rating: 4.8,
			reviewCount: 89,
			allowForks: true,
			price: { type: 'usage' },
		},
		{
			id: 'wf_email_auto',
			name: 'email-automation',
			description: 'Smart email routing, auto-responses, and inbox management',
			developer: { id: 'dev_sarah', name: 'sarahdev' },
			category: 'productivity',
			activeInstalls: 892,
			rating: 4.6,
			reviewCount: 67,
			allowForks: true,
			price: { type: 'free' },
		},
		{
			id: 'wf_slack_digest',
			name: 'slack-daily-digest',
			description: 'Summarize Slack channels and send daily digests',
			developer: { id: 'dev_mike', name: 'mikebuilds' },
			category: 'communication',
			activeInstalls: 634,
			rating: 4.5,
			reviewCount: 42,
			allowForks: true,
			price: { type: 'free' },
		},
		{
			id: 'wf_notion_sync',
			name: 'notion-github-sync',
			description: 'Bi-directional sync between Notion and GitHub issues',
			developer: { id: 'dev_alex', name: 'alexchen' },
			category: 'development',
			activeInstalls: 521,
			rating: 4.7,
			reviewCount: 38,
			allowForks: true,
			price: { type: 'paid', amount: 9 },
		},
		{
			id: 'wf_invoice_gen',
			name: 'invoice-generator',
			description: 'Auto-generate invoices from time tracking and send to clients',
			developer: { id: 'dev_finance', name: 'financetools' },
			category: 'finance',
			activeInstalls: 445,
			rating: 4.4,
			reviewCount: 31,
			allowForks: false,
			price: { type: 'paid', amount: 19 },
		},
		{
			id: 'wf_social_post',
			name: 'social-scheduler',
			description: 'Schedule and cross-post to multiple social platforms',
			developer: { id: 'dev_social', name: 'socialtools' },
			category: 'marketing',
			activeInstalls: 378,
			rating: 4.3,
			reviewCount: 28,
			allowForks: true,
			price: { type: 'usage' },
		},
	];

	// Filter by query
	let results = allWorkflows;
	if (query) {
		const q = query.toLowerCase();
		results = results.filter(
			(w) =>
				w.name.toLowerCase().includes(q) ||
				w.description.toLowerCase().includes(q) ||
				w.category.toLowerCase().includes(q)
		);
	}

	// Filter by category
	if (options.category) {
		results = results.filter((w) => w.category.toLowerCase() === options.category?.toLowerCase());
	}

	// Filter by developer
	if (options.developer) {
		results = results.filter((w) => w.developer.name.toLowerCase() === options.developer?.toLowerCase());
	}

	// Sort
	switch (options.sortBy) {
		case 'popular':
			results.sort((a, b) => b.activeInstalls - a.activeInstalls);
			break;
		case 'recent':
			// Mock: reverse order for "recent"
			results.reverse();
			break;
		case 'rating':
			results.sort((a, b) => b.rating - a.rating);
			break;
		default:
			// relevance - keep original order
			break;
	}

	// Limit
	if (options.limit) {
		results = results.slice(0, options.limit);
	}

	return results;
}

/**
 * Format price display
 */
function formatPrice(price: SearchResult['price']): string {
	switch (price.type) {
		case 'free':
			return 'Free';
		case 'paid':
			return `$${price.amount}/mo`;
		case 'usage':
			return 'Usage-based';
		default:
			return 'Unknown';
	}
}

/**
 * Marketplace search command
 */
export async function marketplaceSearchCommand(query?: string, options: SearchOptions = {}): Promise<void> {
	Logger.header('Marketplace Search');
	Logger.blank();

	// Get search query if not provided
	let searchQuery = query || '';
	if (!searchQuery && !options.category && !options.developer) {
		const answer = await inquirer.prompt([
			{
				type: 'input',
				name: 'query',
				message: 'Search workflows:',
				validate: (input: string) => input.length > 0 || 'Please enter a search term',
			},
		]);
		searchQuery = answer.query;
	}

	// Show search parameters
	if (searchQuery) {
		Logger.info(`Searching for: "${searchQuery}"`);
	}
	if (options.category) {
		Logger.log(`  Category: ${options.category}`);
	}
	if (options.developer) {
		Logger.log(`  Developer: ${options.developer}`);
	}
	Logger.blank();

	// Perform search
	const spinner = Logger.spinner('Searching marketplace...');

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 600));

	const results = mockSearch(searchQuery, options);

	if (results.length === 0) {
		spinner.fail('No workflows found');
		Logger.blank();
		Logger.log('Try a different search term or browse categories:');
		Logger.log('  workway marketplace browse --category=productivity');
		return;
	}

	spinner.succeed(`Found ${results.length} workflow${results.length === 1 ? '' : 's'}`);
	Logger.blank();

	// Display results
	for (const workflow of results) {
		const forkBadge = workflow.allowForks ? '' : ' [no-fork]';
		const priceBadge = formatPrice(workflow.price);

		Logger.log(`  ${workflow.developer.name}/${workflow.name}${forkBadge}`);
		Logger.log(`    ${workflow.description}`);
		Logger.log(
			`    ⭐ ${workflow.rating.toFixed(1)} (${workflow.reviewCount}) · ${workflow.activeInstalls.toLocaleString()} installs · ${priceBadge}`
		);
		Logger.blank();
	}

	// Prompt for action
	const choices = results.map((w) => ({
		name: `${w.developer.name}/${w.name}`,
		value: w.id,
	}));

	choices.push({ name: '← Back to search', value: 'search' });
	choices.push({ name: '✕ Exit', value: 'exit' });

	const action = await inquirer.prompt([
		{
			type: 'list',
			name: 'workflow',
			message: 'Select a workflow for details:',
			choices,
		},
	]);

	if (action.workflow === 'exit') {
		return;
	}

	if (action.workflow === 'search') {
		await marketplaceSearchCommand();
		return;
	}

	// Show workflow info
	const selected = results.find((w) => w.id === action.workflow);
	if (selected) {
		Logger.blank();
		Logger.info(`To view details: workway marketplace info ${selected.developer.name}/${selected.name}`);
		Logger.info(`To fork: workway workflow fork ${selected.developer.name}/${selected.name}`);
	}
}

export default marketplaceSearchCommand;

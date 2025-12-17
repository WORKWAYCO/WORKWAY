/**
 * MCP Resources Index
 *
 * Read-only resources for the MCP server.
 */

import { loadEthos } from '../../ethos/defaults.js';
import { isAuthenticated, getCurrentUser } from '../../api/auth.js';

/**
 * All resource definitions for MCP server registration
 */
export const RESOURCES = [
	{
		uri: 'workway-learn://ethos',
		name: 'Workflow Principles (Ethos)',
		description: 'Your personal workflow development principles',
		mimeType: 'application/json'
	},
	{
		uri: 'workway-learn://paths',
		name: 'Learning Paths',
		description: 'Available WORKWAY learning paths and lessons',
		mimeType: 'application/json'
	},
	{
		uri: 'workway-learn://status',
		name: 'Learning Status',
		description: 'Quick authentication and progress status',
		mimeType: 'application/json'
	}
];

/**
 * Learning paths definition
 */
const PATHS = {
	'getting-started': {
		title: 'Getting Started',
		description: "Set up Claude Code. Everything else, you'll build with Claude Code.",
		difficulty: 'beginner',
		estimatedHours: 1,
		lessons: [
			{ id: 'claude-code-setup', title: 'Claude Code Setup', duration: '15 min' },
			{ id: 'workway-cli', title: 'WORKWAY CLI Installation', duration: '10 min' },
			{ id: 'essential-commands', title: 'Essential Commands & Shortcuts', duration: '10 min' },
			{ id: 'wezterm-setup', title: 'WezTerm (Optional)', duration: '15 min' },
			{ id: 'neomutt-setup', title: 'Neomutt (Optional)', duration: '20 min' }
		]
	},
	'workflow-foundations': {
		title: 'Workflow Foundations',
		description: 'Understand outcomes over mechanisms. Use Claude Code to explore WORKWAY patterns.',
		difficulty: 'beginner',
		estimatedHours: 2,
		lessons: [
			{ id: 'what-is-workflow', title: 'What is a Workflow?', duration: '15 min' },
			{ id: 'define-workflow-pattern', title: 'The defineWorkflow() Pattern', duration: '20 min' },
			{ id: 'integrations-oauth', title: 'Integrations & OAuth', duration: '20 min' },
			{ id: 'config-schemas', title: 'Configuration Schemas', duration: '20 min' },
			{ id: 'triggers', title: 'Triggers', duration: '15 min' }
		]
	},
	'building-workflows': {
		title: 'Building Workflows',
		description: 'Build real workflows with Claude Code. Gmail, Slack, Zoom, Workers AI.',
		difficulty: 'intermediate',
		estimatedHours: 3,
		lessons: [
			{ id: 'first-workflow', title: 'Your First Workflow', duration: '30 min' },
			{ id: 'working-with-integrations', title: 'Working with Integrations', duration: '30 min' },
			{ id: 'workers-ai', title: 'Workers AI', duration: '25 min' },
			{ id: 'error-handling', title: 'Error Handling', duration: '20 min' },
			{ id: 'local-testing', title: 'Local Testing', duration: '20 min' }
		]
	},
	'systems-thinking': {
		title: 'Systems Thinking',
		description: 'Compound workflows, private deployments, agency patterns. Advanced architecture.',
		difficulty: 'advanced',
		estimatedHours: 3,
		lessons: [
			{ id: 'compound-workflows', title: 'Compound Workflows', duration: '35 min' },
			{ id: 'private-workflows', title: 'Private Workflows', duration: '30 min' },
			{ id: 'agency-patterns', title: 'Agency Patterns', duration: '35 min' },
			{ id: 'performance-rate-limiting', title: 'Performance & Rate Limiting', duration: '25 min' },
			{ id: 'monitoring-debugging', title: 'Monitoring & Debugging', duration: '20 min' }
		]
	}
};

/**
 * Handle resource read requests
 */
export async function handleResourceRead(uri: string): Promise<string> {
	switch (uri) {
		case 'workway-learn://ethos': {
			const ethos = loadEthos();
			return JSON.stringify(ethos, null, 2);
		}

		case 'workway-learn://paths': {
			return JSON.stringify(PATHS, null, 2);
		}

		case 'workway-learn://status': {
			const authenticated = isAuthenticated();
			const user = getCurrentUser();

			return JSON.stringify(
				{
					authenticated,
					user: user
						? {
								email: user.email,
								tier: user.tier
							}
						: null,
					message: authenticated
						? `Authenticated as ${user?.email}`
						: 'Not authenticated. Use learn_authenticate to sign in.'
				},
				null,
				2
			);
		}

		default:
			return JSON.stringify({ error: `Resource not found: ${uri}` });
	}
}

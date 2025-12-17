/**
 * learn_complete Tool
 *
 * Mark a lesson as complete with optional reflection.
 */

import { isAuthenticated } from '../../api/auth.js';
import { getClient } from '../../api/client.js';
import { queueCompletion, syncPendingCompletions } from '../../cache/progress-cache.js';

export const definition = {
	name: 'learn_complete',
	description: 'Mark a lesson as complete with optional reflection',
	inputSchema: {
		type: 'object' as const,
		properties: {
			pathId: {
				type: 'string',
				description: 'The learning path ID'
			},
			lessonId: {
				type: 'string',
				description: 'The lesson ID to mark complete'
			},
			reflection: {
				type: 'string',
				description: 'Optional reflection on what you learned'
			},
			timeSpentSeconds: {
				type: 'number',
				description: 'Optional time spent on the lesson in seconds'
			}
		},
		required: ['pathId', 'lessonId']
	}
};

export interface LearnCompleteInput {
	pathId: string;
	lessonId: string;
	reflection?: string;
	timeSpentSeconds?: number;
}

export interface LearnCompleteOutput {
	success: boolean;
	progress: {
		lessonStatus: string;
		pathProgress: {
			completed: number;
			total: number;
			percentComplete: number;
		};
	};
	nextLesson?: {
		id: string;
		title: string;
		description: string;
	};
	pathCompleted?: boolean;
	celebration?: string;
	offline?: boolean;
}

// Path and lesson totals
const PATH_TOTALS: Record<string, number> = {
	'getting-started': 5,
	'workflow-foundations': 5,
	'building-workflows': 5,
	'systems-thinking': 5
};

// Next lesson mappings
const NEXT_LESSONS: Record<string, Record<string, { id: string; title: string; description: string } | null>> = {
	'getting-started': {
		'claude-code-setup': {
			id: 'workway-cli',
			title: 'WORKWAY CLI Installation',
			description: 'Use Claude Code to install and configure the WORKWAY CLI.'
		},
		'workway-cli': {
			id: 'essential-commands',
			title: 'Essential Commands & Shortcuts',
			description: 'Reference for terminal navigation, git, and Claude Code commands.'
		},
		'essential-commands': {
			id: 'wezterm-setup',
			title: 'WezTerm (Optional)',
			description: 'Modern terminal setup. Skip if you already have a terminal you like.'
		},
		'wezterm-setup': {
			id: 'neomutt-setup',
			title: 'Neomutt (Optional)',
			description: 'Terminal email for workflow-driven developers. Advanced setup.'
		},
		'neomutt-setup': null
	},
	'workflow-foundations': {
		'what-is-workflow': {
			id: 'define-workflow-pattern',
			title: 'The defineWorkflow() Pattern',
			description: 'Anatomy of a WORKWAY workflow.'
		},
		'define-workflow-pattern': {
			id: 'integrations-oauth',
			title: 'Integrations & OAuth',
			description: 'BaseAPIClient pattern. How WORKWAY handles authentication.'
		},
		'integrations-oauth': {
			id: 'config-schemas',
			title: 'Configuration Schemas',
			description: 'Inputs, pickers, validation. Sensible defaults.'
		},
		'config-schemas': {
			id: 'triggers',
			title: 'Triggers',
			description: 'Webhooks, cron, manual. When workflows run.'
		},
		'triggers': null
	},
	'building-workflows': {
		'first-workflow': {
			id: 'working-with-integrations',
			title: 'Working with Integrations',
			description: 'Slack, Zoom, Stripe patterns.'
		},
		'working-with-integrations': {
			id: 'workers-ai',
			title: 'Workers AI',
			description: 'Add intelligence: summarization, classification, extraction.'
		},
		'workers-ai': {
			id: 'error-handling',
			title: 'Error Handling',
			description: 'Graceful degradation, retries, circuit breakers.'
		},
		'error-handling': {
			id: 'local-testing',
			title: 'Local Testing',
			description: 'wrangler dev, mocking, debugging.'
		},
		'local-testing': null
	},
	'systems-thinking': {
		'compound-workflows': {
			id: 'private-workflows',
			title: 'Private Workflows',
			description: 'Organization-specific workflows. Access control, BYOO.'
		},
		'private-workflows': {
			id: 'agency-patterns',
			title: 'Agency Patterns',
			description: 'Build once, deploy many.'
		},
		'agency-patterns': {
			id: 'performance-rate-limiting',
			title: 'Performance & Rate Limiting',
			description: 'Cloudflare Workers constraints. Batching, caching.'
		},
		'performance-rate-limiting': {
			id: 'monitoring-debugging',
			title: 'Monitoring & Debugging',
			description: 'Production observability. Logs, metrics, alerts.'
		},
		'monitoring-debugging': null
	}
};

// Celebrations for milestones
const CELEBRATIONS: Record<string, string> = {
	'getting-started': "🎉 You've completed Getting Started! You're ready to learn workflows.",
	'workflow-foundations': "🏗️ Workflow Foundations complete! Now you understand the patterns.",
	'building-workflows': "🚀 Building Workflows done! You can create real automations.",
	'systems-thinking': "🎓 Systems Thinking mastered! You're a WORKWAY expert."
};

export async function handler(input: LearnCompleteInput): Promise<LearnCompleteOutput> {
	const { pathId, lessonId, reflection, timeSpentSeconds } = input;

	const authenticated = isAuthenticated();
	const pathTotal = PATH_TOTALS[pathId] || 5;
	const nextLesson = NEXT_LESSONS[pathId]?.[lessonId];

	// Try to sync to server
	let serverResult: { pathProgress?: { completed: number; total: number } } | null = null;
	let offline = false;

	if (authenticated) {
		try {
			const client = getClient();
			serverResult = await client.completeLesson({
				pathId,
				lessonId,
				reflection,
				timeSpentSeconds
			});

			// Also sync any pending completions
			await syncPendingCompletions();
		} catch {
			// Offline - queue for later
			queueCompletion({ pathId, lessonId, reflection, timeSpentSeconds });
			offline = true;
		}
	} else {
		// Not authenticated - just queue
		queueCompletion({ pathId, lessonId, reflection, timeSpentSeconds });
		offline = true;
	}

	// Calculate progress
	const completed = serverResult?.pathProgress?.completed ?? 1;
	const total = serverResult?.pathProgress?.total ?? pathTotal;
	const pathCompleted = completed === total;

	const output: LearnCompleteOutput = {
		success: true,
		progress: {
			lessonStatus: 'completed',
			pathProgress: {
				completed,
				total,
				percentComplete: Math.round((completed / total) * 100)
			}
		},
		pathCompleted,
		offline
	};

	if (nextLesson) {
		output.nextLesson = nextLesson;
	}

	if (pathCompleted) {
		output.celebration = CELEBRATIONS[pathId];
	}

	return output;
}

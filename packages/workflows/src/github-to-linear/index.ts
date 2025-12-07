/**
 * GitHub to Linear Issue Sync
 *
 * Automatically creates Linear issues when GitHub issues are created.
 * Keeps them in sync with bi-directional status updates.
 *
 * Zuhandenheit: Issues created on GitHub appear in Linear automatically.
 * The developer doesn't think about syncing - it just happens.
 *
 * Integrations: GitHub, Linear
 * Trigger: GitHub webhook (issues.opened, issues.edited, issues.closed)
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

// Priority mapping from GitHub labels to Linear priority
const PRIORITY_LABELS: Record<string, 0 | 1 | 2 | 3 | 4> = {
	'priority: critical': 1,
	'priority: high': 2,
	'priority: medium': 3,
	'priority: low': 4,
	urgent: 1,
	critical: 1,
	high: 2,
	medium: 3,
	low: 4,
};

// Status mapping from GitHub to Linear state types
const STATUS_MAP = {
	open: 'backlog',
	closed: 'completed',
} as const;

export default defineWorkflow({
	name: 'GitHub to Linear Issue Sync',
	description: 'Automatically sync GitHub issues to Linear for unified project management',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_issues_arrive',

		outcomeStatement: {
			suggestion: 'Sync GitHub issues to Linear automatically?',
			explanation: 'When issues are created on GitHub, we\'ll create matching Linear issues with labels, assignees, and priority.',
			outcome: 'Issues synced to Linear',
		},

		primaryPair: {
			from: 'github',
			to: 'linear',
			workflowId: 'github-to-linear',
			outcome: 'Issues that sync themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['github', 'linear'],
				workflowId: 'github-to-linear',
				priority: 90,
			},
			{
				trigger: 'event_received',
				eventType: 'github.issues.opened',
				integrations: ['github', 'linear'],
				workflowId: 'github-to-linear',
				priority: 90,
			},
		],

		smartDefaults: {
			syncComments: { value: true },
			syncAssignees: { value: true },
			labelPrefix: { value: 'github:' },
		},

		essentialFields: ['linearTeamId'],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 5,
		trialDays: 14,
		description: 'Free for first 50 issues/month, then $5/month',
	},

	integrations: [
		{ service: 'github', scopes: ['repo:read', 'issues:read', 'webhooks'] },
		{ service: 'linear', scopes: ['issues:write', 'issues:read'] },
	],

	inputs: {
		linearTeamId: {
			type: 'linear_team_picker',
			label: 'Linear Team',
			required: true,
			description: 'Select the Linear team where issues will be created',
		},
		linearProjectId: {
			type: 'linear_project_picker',
			label: 'Linear Project (optional)',
			required: false,
			description: 'Optionally assign issues to a specific project',
		},
		syncComments: {
			type: 'boolean',
			label: 'Sync Comments',
			default: true,
			description: 'Sync GitHub issue comments to Linear',
		},
		syncAssignees: {
			type: 'boolean',
			label: 'Sync Assignees',
			default: true,
			description: 'Attempt to match GitHub assignees to Linear users by email',
		},
		labelPrefix: {
			type: 'string',
			label: 'Label Prefix',
			default: 'github:',
			description: 'Prefix added to GitHub labels when synced to Linear',
		},
		filterLabels: {
			type: 'multi_select',
			label: 'Filter by Labels (optional)',
			required: false,
			description: 'Only sync issues with these labels. Leave empty to sync all.',
		},
	},

	trigger: webhook({
		service: 'github',
		events: ['issues.opened', 'issues.edited', 'issues.closed', 'issues.reopened', 'issue_comment.created'],
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;
		const action = event.action;
		const issue = event.issue;
		const repo = event.repository;

		// Check label filter if configured
		if (inputs.filterLabels?.length > 0) {
			const issueLabels = issue.labels.map((l: { name: string }) => l.name.toLowerCase());
			const filterLabels = inputs.filterLabels.map((l: string) => l.toLowerCase());
			const hasMatchingLabel = issueLabels.some((l: string) => filterLabels.includes(l));

			if (!hasMatchingLabel) {
				return {
					success: true,
					skipped: true,
					reason: 'Issue does not have required labels',
					issueNumber: issue.number,
				};
			}
		}

		// Generate storage key for tracking synced issues
		const storageKey = `github-issue:${repo.full_name}:${issue.number}`;

		// Handle different event types
		if (action === 'opened') {
			return await handleIssueCreated({
				issue,
				repo,
				inputs,
				integrations,
				storage,
				storageKey,
			});
		}

		if (action === 'edited' || action === 'closed' || action === 'reopened') {
			return await handleIssueUpdated({
				issue,
				repo,
				action,
				inputs,
				integrations,
				storage,
				storageKey,
			});
		}

		if (event.comment && action === 'created') {
			return await handleCommentCreated({
				issue,
				repo,
				comment: event.comment,
				inputs,
				integrations,
				storage,
				storageKey,
			});
		}

		return {
			success: true,
			skipped: true,
			reason: `Unhandled action: ${action}`,
		};
	},

	onError: async ({ error, trigger }) => {
		console.error('GitHub to Linear sync failed:', error.message);
		console.error('Event:', trigger.data.action, trigger.data.issue?.number);
	},
});

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

interface HandlerContext {
	issue: any;
	repo: any;
	inputs: any;
	integrations: any;
	storage: any;
	storageKey: string;
}

/**
 * Handle new GitHub issue - create Linear issue
 */
async function handleIssueCreated(ctx: HandlerContext) {
	const { issue, repo, inputs, integrations, storage, storageKey } = ctx;

	// Idempotency check: see if we've already synced this issue
	const existingSync = await storage.get(storageKey);
	if (existingSync?.linearIssueId) {
		return {
			success: true,
			skipped: true,
			reason: 'Issue already synced (idempotency check)',
			linearIssueId: existingSync.linearIssueId,
			githubIssue: issue.number,
		};
	}

	// Extract priority from labels
	const priority = extractPriority(issue.labels);

	// Build labels for Linear (with prefix)
	const labels = issue.labels
		.filter((l: { name: string }) => !Object.keys(PRIORITY_LABELS).includes(l.name.toLowerCase()))
		.map((l: { name: string }) => `${inputs.labelPrefix}${l.name}`);

	// Build description with GitHub link
	const description = `${issue.body || ''}\n\n---\n[View on GitHub](${issue.html_url})`;

	// Try to resolve assignee
	let assigneeByName: string | undefined;
	if (inputs.syncAssignees && issue.assignee) {
		// Try to find by login (GitHub username often matches Linear display name)
		assigneeByName = issue.assignee.login;
	}

	// Create Linear issue
	const linearIssue = await integrations.linear.issues.create({
		teamId: inputs.linearTeamId,
		title: `[${repo.name}#${issue.number}] ${issue.title}`,
		description,
		priority,
		projectId: inputs.linearProjectId || undefined,
		assigneeByName,
		labels,
	});

	if (!linearIssue.success) {
		throw new Error(`Failed to create Linear issue: ${linearIssue.error?.message}`);
	}

	// Store mapping for future updates
	await storage.set(storageKey, {
		linearIssueId: linearIssue.data.id,
		linearIdentifier: linearIssue.data.identifier,
		githubIssue: issue.number,
		createdAt: Date.now(),
	});

	// Comment back on GitHub with Linear link
	await integrations.github.issues.comment({
		owner: repo.owner.login,
		repo: repo.name,
		issueNumber: issue.number,
		body: `Synced to Linear: [${linearIssue.data.identifier}](${linearIssue.data.url})`,
	});

	return {
		success: true,
		action: 'created',
		githubIssue: issue.number,
		githubUrl: issue.html_url,
		linearIssueId: linearIssue.data.id,
		linearIdentifier: linearIssue.data.identifier,
		linearUrl: linearIssue.data.url,
	};
}

/**
 * Handle GitHub issue update - update Linear issue
 */
async function handleIssueUpdated(ctx: HandlerContext & { action: string }) {
	const { issue, repo, action, inputs, integrations, storage, storageKey } = ctx;

	// Get existing sync mapping
	const existingSync = await storage.get(storageKey);
	if (!existingSync?.linearIssueId) {
		// Issue wasn't synced - create it now
		return await handleIssueCreated(ctx);
	}

	// Determine what to update
	const updateData: Record<string, any> = {};

	if (action === 'edited') {
		updateData.title = `[${repo.name}#${issue.number}] ${issue.title}`;
		updateData.description = `${issue.body || ''}\n\n---\n[View on GitHub](${issue.html_url})`;

		// Update priority from labels
		const priority = extractPriority(issue.labels);
		if (priority > 0) {
			updateData.priority = priority;
		}
	}

	if (action === 'closed') {
		// Get the team's "completed" state
		const team = await integrations.linear.teams.get(inputs.linearTeamId);
		if (team.success) {
			const completedState = team.data.states.nodes.find(
				(s: { type: string }) => s.type === 'completed'
			);
			if (completedState) {
				updateData.stateId = completedState.id;
			}
		}
	}

	if (action === 'reopened') {
		// Get the team's "backlog" or "unstarted" state
		const team = await integrations.linear.teams.get(inputs.linearTeamId);
		if (team.success) {
			const unstartedState = team.data.states.nodes.find(
				(s: { type: string }) => s.type === 'unstarted' || s.type === 'backlog'
			);
			if (unstartedState) {
				updateData.stateId = unstartedState.id;
			}
		}
	}

	// Update Linear issue
	if (Object.keys(updateData).length > 0) {
		const updated = await integrations.linear.issues.update({
			issueId: existingSync.linearIssueId,
			...updateData,
		});

		if (!updated.success) {
			throw new Error(`Failed to update Linear issue: ${updated.error?.message}`);
		}
	}

	return {
		success: true,
		action: 'updated',
		updateAction: action,
		githubIssue: issue.number,
		linearIssueId: existingSync.linearIssueId,
		linearIdentifier: existingSync.linearIdentifier,
		updatedFields: Object.keys(updateData),
	};
}

/**
 * Handle new GitHub comment - add comment to Linear
 */
async function handleCommentCreated(ctx: HandlerContext & { comment: any }) {
	const { issue, comment, inputs, integrations, storage, storageKey } = ctx;

	// Skip if comment sync disabled
	if (!inputs.syncComments) {
		return {
			success: true,
			skipped: true,
			reason: 'Comment sync disabled',
		};
	}

	// Get existing sync mapping
	const existingSync = await storage.get(storageKey);
	if (!existingSync?.linearIssueId) {
		return {
			success: true,
			skipped: true,
			reason: 'Parent issue not synced to Linear',
			githubIssue: issue.number,
		};
	}

	// Create comment on Linear issue
	const body = `**${comment.user.login}** commented on GitHub:\n\n${comment.body}\n\n---\n[View comment](${comment.html_url})`;

	const linearComment = await integrations.linear.issues.comment(
		existingSync.linearIssueId,
		body
	);

	if (!linearComment.success) {
		throw new Error(`Failed to create Linear comment: ${linearComment.error?.message}`);
	}

	return {
		success: true,
		action: 'comment_synced',
		githubIssue: issue.number,
		githubCommentId: comment.id,
		linearIssueId: existingSync.linearIssueId,
		linearCommentId: linearComment.data.id,
	};
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract Linear priority from GitHub labels
 */
function extractPriority(labels: Array<{ name: string }>): 0 | 1 | 2 | 3 | 4 {
	for (const label of labels) {
		const priority = PRIORITY_LABELS[label.name.toLowerCase()];
		if (priority !== undefined) {
			return priority;
		}
	}
	return 0; // No priority
}

export const metadata = {
	id: 'github-to-linear',
	category: 'developer-tools',
	featured: true,
	stats: { rating: 4.8, users: 834, reviews: 52 },
};

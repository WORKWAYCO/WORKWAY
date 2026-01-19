/**
 * PR Review Notifier
 *
 * Notifies team members when PRs need review, and escalates stale PRs.
 * Integrates with Slack and Discord for notifications.
 *
 * Zuhandenheit: Developers get notified about PRs that need attention.
 * No more PRs languishing in the queue - the system surfaces what matters.
 *
 * Integrations: GitHub, Slack, Discord
 * Trigger: GitHub webhook (pull_request, pull_request_review)
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

// Review request states
const PR_STATES = {
	NEEDS_REVIEW: 'needs_review',
	CHANGES_REQUESTED: 'changes_requested',
	APPROVED: 'approved',
	MERGED: 'merged',
} as const;

export default defineWorkflow({
	name: 'PR Review Notifier',
	description: 'Smart notifications for pull request reviews with stale PR escalation',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_code_changes',

		outcomeStatement: {
			suggestion: 'Never miss a PR review again?',
			explanation: 'Get notified in Slack or Discord when PRs need review, and escalate stale ones automatically.',
			outcome: 'PRs that get reviewed faster',
		},

		primaryPair: {
			from: 'github',
			to: 'slack',
			workflowId: 'pr-review-notifier',
			outcome: 'PRs that get reviewed faster',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['github', 'slack'],
				workflowId: 'pr-review-notifier',
				priority: 85,
			},
			{
				trigger: 'integration_connected',
				integrations: ['github', 'discord'],
				workflowId: 'pr-review-notifier',
				priority: 85,
			},
			{
				trigger: 'event_received',
				eventType: 'github.pull_request.opened',
				integrations: ['github', 'slack'],
				workflowId: 'pr-review-notifier',
				priority: 90,
			},
		],

		smartDefaults: {
			staleThresholdHours: { value: 24 },
			notifyOnApproval: { value: true },
			notifyOnChangesRequested: { value: true },
		},

		essentialFields: ['notificationChannel'],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 8,
		trialDays: 14,
		description: 'Free for up to 50 PRs/month, then $8/month',
	},

	integrations: [
		{ service: 'github', scopes: ['repo:read', 'pull_requests:read', 'webhooks'] },
		{ service: 'slack', scopes: ['chat:write'], optional: true },
		{ service: 'discord', scopes: ['bot', 'messages.write'], optional: true },
	],

	config: {
		notification_platform: {
			type: 'select',
			label: 'Notification Platform',
			options: ['slack', 'discord', 'both'],
			default: 'slack',
			description: 'Where to send PR notifications',
		},
		slack_channel_id: {
			type: 'text',
			label: 'Slack Channel',
			required: false,
			description: 'Slack channel for PR notifications',
		},
		discord_channel_id: {
			type: 'text',
			label: 'Discord Channel',
			required: false,
			description: 'Discord channel for PR notifications',
		},
		notify_on_open: {
			type: 'boolean',
			label: 'Notify on PR Open',
			default: true,
			description: 'Send notification when a PR is opened',
		},
		notify_on_review_request: {
			type: 'boolean',
			label: 'Notify on Review Request',
			default: true,
			description: 'Send notification when review is requested',
		},
		notify_on_approval: {
			type: 'boolean',
			label: 'Notify on Approval',
			default: true,
			description: 'Send notification when PR is approved',
		},
		notify_on_changes_requested: {
			type: 'boolean',
			label: 'Notify on Changes Requested',
			default: true,
			description: 'Send notification when changes are requested',
		},
		notify_on_merge: {
			type: 'boolean',
			label: 'Notify on Merge',
			default: false,
			description: 'Send notification when PR is merged',
		},
		stale_threshold_hours: {
			type: 'number',
			label: 'Stale PR Threshold (hours)',
			default: 24,
			description: 'Hours before a PR is considered stale',
		},
		user_mapping: {
			type: 'key_value_list',
			label: 'GitHub to Slack/Discord User Mapping',
			required: false,
			description: 'Map GitHub usernames to Slack/Discord user IDs for @mentions',
		},
		exclude_draft: {
			type: 'boolean',
			label: 'Exclude Draft PRs',
			default: true,
			description: 'Don\'t notify for draft PRs',
		},
		filter_labels: {
			type: 'multi_select',
			label: 'Filter by Labels',
			required: false,
			description: 'Only notify for PRs with these labels (empty = all)',
		},
	},

	trigger: webhook({
		service: 'github',
		events: [
			'pull_request.opened',
			'pull_request.closed',
			'pull_request.ready_for_review',
			'pull_request.review_requested',
			'pull_request_review.submitted',
		],
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;
		const action = event.action;
		const pr = event.pull_request;
		const repo = event.repository;

		// Skip draft PRs if configured
		if (inputs.excludeDraft && pr.draft) {
			return {
				success: true,
				skipped: true,
				reason: 'Draft PR excluded',
				prNumber: pr.number,
			};
		}

		// Check label filter
		if (inputs.filterLabels?.length > 0) {
			const prLabels = pr.labels.map((l: { name: string }) => l.name.toLowerCase());
			const filterLabels = inputs.filterLabels.map((l: string) => l.toLowerCase());
			const hasMatchingLabel = prLabels.some((l: string) => filterLabels.includes(l));

			if (!hasMatchingLabel) {
				return {
					success: true,
					skipped: true,
					reason: 'PR does not have required labels',
					prNumber: pr.number,
				};
			}
		}

		// Determine notification type
		const notification = determineNotification(event, action, inputs);

		if (!notification) {
			return {
				success: true,
				skipped: true,
				reason: 'Notification not configured for this event',
				action,
			};
		}

		// Build the message
		const message = buildNotificationMessage({
			notification,
			pr,
			repo,
			event,
			inputs,
		});

		// Send to configured platforms
		const results: any = {};

		if (inputs.notificationPlatform === 'slack' || inputs.notificationPlatform === 'both') {
			if (inputs.slackChannelId) {
				results.slack = await sendSlackNotification({
					channelId: inputs.slackChannelId,
					message,
					notification,
					pr,
					integrations,
				});
			}
		}

		if (inputs.notificationPlatform === 'discord' || inputs.notificationPlatform === 'both') {
			if (inputs.discordChannelId) {
				results.discord = await sendDiscordNotification({
					channelId: inputs.discordChannelId,
					message,
					notification,
					pr,
					integrations,
				});
			}
		}

		// Track PR state for stale detection
		const storageKey = `pr:${repo.full_name}:${pr.number}`;
		await storage.set(storageKey, {
			number: pr.number,
			title: pr.title,
			author: pr.user.login,
			state: pr.state,
			draft: pr.draft,
			reviewers: pr.requested_reviewers?.map((r: any) => r.login) || [],
			lastActivityAt: Date.now(),
			createdAt: new Date(pr.created_at).getTime(),
			url: pr.html_url,
		});

		return {
			success: true,
			notificationType: notification.type,
			prNumber: pr.number,
			prTitle: pr.title,
			platforms: Object.keys(results),
			...results,
		};
	},

	onError: async ({ error, trigger }) => {
		console.error('PR Review Notifier failed:', error.message);
		console.error('Event:', trigger.data.action, trigger.data.pull_request?.number);
	},
});

// ============================================================================
// NOTIFICATION LOGIC
// ============================================================================

interface Notification {
	type: 'opened' | 'review_requested' | 'approved' | 'changes_requested' | 'merged' | 'ready_for_review';
	emoji: string;
	color: string;
	title: string;
}

function determineNotification(event: any, action: string, inputs: any): Notification | null {
	// PR events
	if (action === 'opened' && inputs.notifyOnOpen) {
		return {
			type: 'opened',
			emoji: '🆕',
			color: '#2DA44E', // Green
			title: 'New Pull Request',
		};
	}

	if (action === 'ready_for_review' && inputs.notifyOnOpen) {
		return {
			type: 'ready_for_review',
			emoji: '✅',
			color: '#2DA44E',
			title: 'PR Ready for Review',
		};
	}

	if (action === 'review_requested' && inputs.notifyOnReviewRequest) {
		return {
			type: 'review_requested',
			emoji: '👀',
			color: '#BF8700', // Yellow
			title: 'Review Requested',
		};
	}

	if (action === 'closed' && event.pull_request.merged && inputs.notifyOnMerge) {
		return {
			type: 'merged',
			emoji: '🎉',
			color: '#8250DF', // Purple
			title: 'PR Merged',
		};
	}

	// Review events
	if (action === 'submitted') {
		const reviewState = event.review?.state;

		if (reviewState === 'approved' && inputs.notifyOnApproval) {
			return {
				type: 'approved',
				emoji: '✅',
				color: '#2DA44E',
				title: 'PR Approved',
			};
		}

		if (reviewState === 'changes_requested' && inputs.notifyOnChangesRequested) {
			return {
				type: 'changes_requested',
				emoji: '🔄',
				color: '#CF222E', // Red
				title: 'Changes Requested',
			};
		}
	}

	return null;
}

interface MessageContext {
	notification: Notification;
	pr: any;
	repo: any;
	event: any;
	inputs: any;
}

function buildNotificationMessage(ctx: MessageContext): string {
	const { notification, pr, repo, event, inputs } = ctx;

	let message = `${notification.emoji} **${notification.title}**\n\n`;
	message += `[${repo.full_name}#${pr.number}](${pr.html_url}): ${pr.title}\n`;
	message += `Author: @${pr.user.login}\n`;

	// Add context based on notification type
	if (notification.type === 'review_requested' && event.requested_reviewer) {
		const reviewer = event.requested_reviewer.login;
		const mappedUser = inputs.userMapping?.[reviewer];
		message += `Requested reviewer: ${mappedUser ? `<@${mappedUser}>` : `@${reviewer}`}\n`;
	}

	if (notification.type === 'approved' && event.review) {
		message += `Approved by: @${event.review.user.login}\n`;
	}

	if (notification.type === 'changes_requested' && event.review) {
		message += `Requested by: @${event.review.user.login}\n`;
		if (event.review.body) {
			message += `\n> ${event.review.body.substring(0, 200)}${event.review.body.length > 200 ? '...' : ''}\n`;
		}
	}

	// Add stats
	message += `\n📊 +${pr.additions} / -${pr.deletions} | ${pr.changed_files} files`;

	return message;
}

// ============================================================================
// PLATFORM SENDERS
// ============================================================================

async function sendSlackNotification(ctx: {
	channelId: string;
	message: string;
	notification: Notification;
	pr: any;
	integrations: any;
}): Promise<{ success: boolean; messageTs?: string }> {
	const { channelId, message, notification, pr, integrations } = ctx;

	const result = await integrations.slack.chat.postMessage({
		channel: channelId,
		text: message,
		blocks: [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: message,
				},
			},
			{
				type: 'actions',
				elements: [
					{
						type: 'button',
						text: {
							type: 'plain_text',
							text: 'View PR',
							emoji: true,
						},
						url: pr.html_url,
					},
				],
			},
		],
		attachments: [
			{
				color: notification.color,
				fallback: `${notification.title}: ${pr.title}`,
			},
		],
	});

	return {
		success: result.success,
		messageTs: result.data?.ts,
	};
}

async function sendDiscordNotification(ctx: {
	channelId: string;
	message: string;
	notification: Notification;
	pr: any;
	integrations: any;
}): Promise<{ success: boolean; messageId?: string }> {
	const { channelId, message, notification, pr, integrations } = ctx;

	// Convert hex color to integer
	const colorInt = parseInt(notification.color.replace('#', ''), 16);

	const result = await integrations.discord.channels.sendMessage({
		channelId,
		embeds: [{
			title: `${notification.emoji} ${notification.title}`,
			description: message,
			color: colorInt,
			url: pr.html_url,
			author: {
				name: pr.user.login,
				icon_url: pr.user.avatar_url,
				url: pr.user.html_url,
			},
			footer: {
				text: `${pr.base.repo.full_name} | +${pr.additions} -${pr.deletions}`,
			},
			timestamp: new Date().toISOString(),
		}],
	});

	return {
		success: result.success,
		messageId: result.data?.id,
	};
}

export const metadata = {
	id: 'pr-review-notifier',
	category: 'developer-tools',
	featured: true,
	stats: { rating: 4.9, users: 1156, reviews: 73 },
};

/**
 * Error Incident Manager
 *
 * Heideggerian Design: Errors that document themselves.
 *
 * When a breakdown occurs (Vorhandenheit), it surfaces — creating
 * documentation, alerting the team, and tracking resolution so
 * developers can return to flow (Zuhandenheit).
 *
 * This is WORKWAY dogfooding WORKWAY:
 * - Sentry captures the breakdown
 * - Notion documents the incident (public database)
 * - Slack alerts the team
 * - Claude Code Agent creates a PR to fix
 * - The PR is reviewed, merged, and the incident auto-closes
 *
 * Integrations: Sentry, Notion, Slack
 * Trigger: Sentry webhook (issue.created, alert.triggered)
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Error Incident Manager',
	description: 'Errors that document themselves. When breakdowns occur, automatically create incident pages in Notion and alert the team in Slack.',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_errors_happen',

		outcomeStatement: {
			suggestion: 'Document errors automatically?',
			explanation: 'When Sentry captures an error, automatically create an incident page in Notion and alert your team in Slack.',
			outcome: 'Errors that document themselves',
		},

		primaryPair: {
			from: 'sentry',
			to: 'notion',
			workflowId: 'error-incident-manager',
			outcome: 'Incidents that track themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['sentry'],
				workflowId: 'error-incident-manager',
				priority: 95, // High priority — this is the natural next step after connecting Sentry
			},
			{
				trigger: 'integration_connected',
				integrations: ['sentry', 'notion'],
				workflowId: 'error-incident-manager',
				priority: 100, // Highest when both are connected
			},
		],

		smartDefaults: {
			severityFilter: { value: 'error' }, // Only track errors and above
			autoResolve: { value: true }, // Auto-close Notion page when Sentry resolves
		},

		essentialFields: ['notionDatabase', 'slackChannel'],

		zuhandenheit: {
			timeToValue: 2, // Immediate value after setup
			worksOutOfBox: true, // Minimal config needed
			gracefulDegradation: true, // Works without Slack (just Notion)
			automaticTrigger: true, // Webhook-driven
		},
	},

	pricing: {
		model: 'free', // Dogfooding — free for demonstration
		pricePerMonth: 0,
		description: 'Free forever. WORKWAY uses this internally.',
	},

	integrations: [
		{ service: 'sentry', scopes: ['event:read', 'issue:read', 'issue:write'] },
		{ service: 'notion', scopes: ['read_content', 'insert_content', 'update_content'] },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	inputs: {
		notionDatabase: {
			type: 'text',
			label: 'Incident Database',
			required: true,
			description: 'Notion database where incident pages will be created',
		},
		slackChannel: {
			type: 'text',
			label: 'Alert Channel',
			required: false,
			description: 'Slack channel for incident alerts (optional)',
		},
		severityFilter: {
			type: 'select',
			label: 'Minimum Severity',
			options: ['debug', 'info', 'warning', 'error', 'fatal'],
			default: 'error',
			description: 'Only create incidents for issues at this level or higher',
		},
		autoResolve: {
			type: 'boolean',
			label: 'Auto-resolve Incidents',
			default: true,
			description: 'Automatically update Notion page when issue is resolved in Sentry',
		},
		includeStackTrace: {
			type: 'boolean',
			label: 'Include Stack Trace',
			default: true,
			description: 'Add full stack trace to Notion page',
		},
	},

	trigger: webhook({
		service: 'sentry',
		event: 'issue.created',
	}),

	async execute({ trigger, inputs, integrations }) {
		const payload = trigger.data;
		const issue = payload.data?.issue;

		if (!issue) {
			return { success: false, reason: 'No issue data in webhook payload' };
		}

		// Severity filtering
		const severityOrder = ['debug', 'info', 'warning', 'error', 'fatal'];
		const minIndex = severityOrder.indexOf(inputs.severityFilter || 'error');
		const issueIndex = severityOrder.indexOf(issue.level);

		if (issueIndex < minIndex) {
			return {
				success: true,
				skipped: true,
				reason: `Issue severity (${issue.level}) below threshold (${inputs.severityFilter})`,
			};
		}

		// Step 1: Create Notion incident page
		const notionPage = await integrations.notion.pages.create({
			parent: { database_id: inputs.notionDatabase },
			properties: {
				// Assuming standard incident database schema
				Name: {
					title: [{ text: { content: `[${issue.shortId}] ${issue.title}` } }],
				},
				Status: {
					select: { name: 'Open' },
				},
				Severity: {
					select: { name: issue.level.charAt(0).toUpperCase() + issue.level.slice(1) },
				},
				'First Seen': {
					date: { start: issue.firstSeen },
				},
				'Last Seen': {
					date: { start: issue.lastSeen },
				},
				'Occurrences': {
					number: parseInt(issue.count, 10),
				},
				'Users Affected': {
					number: issue.userCount,
				},
				'Sentry Link': {
					url: issue.permalink,
				},
				Project: {
					select: { name: issue.project.name },
				},
			},
			children: [
				{
					object: 'block',
					type: 'heading_2',
					heading_2: {
						rich_text: [{ type: 'text', text: { content: 'Error Details' } }],
					},
				},
				{
					object: 'block',
					type: 'callout',
					callout: {
						icon: { emoji: issue.level === 'fatal' ? '🔴' : issue.level === 'error' ? '🟠' : '🟡' },
						rich_text: [
							{
								type: 'text',
								text: { content: issue.culprit || 'Unknown culprit' },
							},
						],
					},
				},
				{
					object: 'block',
					type: 'paragraph',
					paragraph: {
						rich_text: [
							{ type: 'text', text: { content: 'Sentry Issue: ' } },
							{
								type: 'text',
								text: { content: issue.shortId, link: { url: issue.permalink } },
								annotations: { bold: true },
							},
						],
					},
				},
				{
					object: 'block',
					type: 'divider',
					divider: {},
				},
				{
					object: 'block',
					type: 'heading_3',
					heading_3: {
						rich_text: [{ type: 'text', text: { content: 'Resolution' } }],
					},
				},
				{
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ type: 'text', text: { content: 'Investigate root cause' } }],
						checked: false,
					},
				},
				{
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ type: 'text', text: { content: 'Create fix PR' } }],
						checked: false,
					},
				},
				{
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ type: 'text', text: { content: 'Deploy fix' } }],
						checked: false,
					},
				},
				{
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ type: 'text', text: { content: 'Verify resolution in Sentry' } }],
						checked: false,
					},
				},
			],
		});

		const notionPageId = notionPage.data?.id;
		const notionPageUrl = notionPage.data?.url;

		// Step 2: Alert in Slack (if configured)
		let slackMessageTs;
		if (inputs.slackChannel) {
			const severityEmoji = {
				fatal: '🔴',
				error: '🟠',
				warning: '🟡',
				info: '🔵',
				debug: '⚪',
			};

			const slackMessage = await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `${severityEmoji[issue.level] || '🔴'} New ${issue.level} in ${issue.project.name}: ${issue.title}`,
				blocks: [
					{
						type: 'header',
						text: {
							type: 'plain_text',
							text: `${severityEmoji[issue.level] || '🔴'} New Error: ${issue.shortId}`,
						},
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: `*${issue.title}*\n\`${issue.culprit || 'Unknown location'}\``,
						},
					},
					{
						type: 'section',
						fields: [
							{ type: 'mrkdwn', text: `*Project:*\n${issue.project.name}` },
							{ type: 'mrkdwn', text: `*Severity:*\n${issue.level.toUpperCase()}` },
							{ type: 'mrkdwn', text: `*Occurrences:*\n${issue.count}` },
							{ type: 'mrkdwn', text: `*Users Affected:*\n${issue.userCount}` },
						],
					},
					{
						type: 'actions',
						elements: [
							{
								type: 'button',
								text: { type: 'plain_text', text: 'View in Sentry' },
								url: issue.permalink,
							},
							{
								type: 'button',
								text: { type: 'plain_text', text: 'View Incident' },
								url: notionPageUrl,
								style: 'primary',
							},
						],
					},
				],
			});

			slackMessageTs = slackMessage.data?.ts;
		}

		return {
			success: true,
			incident: {
				id: notionPageId,
				url: notionPageUrl,
				sentryIssue: issue.shortId,
				severity: issue.level,
				title: issue.title,
			},
			notifications: {
				notion: true,
				slack: !!slackMessageTs,
				slackMessageTs,
			},
		};
	},
});

export const metadata = {
	id: 'error-incident-manager',
	category: 'developer-tools',
	featured: true,
	stats: { rating: 5.0, users: 1, reviews: 1 }, // WORKWAY dogfooding!
};

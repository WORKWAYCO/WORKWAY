/**
 * Team Digest Generator
 *
 * Daily digest of team activity across all tools.
 * Aggregates Slack and Notion activity.
 *
 * Integrations: Slack, Notion
 * Trigger: Scheduled (daily)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Team Digest Generator',
	description: 'Daily digest of team activity across all tools',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'every_morning',

		outcomeStatement: {
			suggestion: 'Want a daily team activity digest?',
			explanation: 'Every morning, we\'ll summarize your team\'s Slack and Notion activity.',
			outcome: 'Daily team digest in Slack',
		},

		primaryPair: {
			from: 'slack',
			to: 'slack',
			workflowId: 'team-digest',
			outcome: 'Team updates that compile themselves',
		},

		additionalPairs: [
			{ from: 'notion', to: 'slack', workflowId: 'team-digest', outcome: 'Notion updates in Slack' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['slack', 'notion'],
				workflowId: 'team-digest',
				priority: 50, // Lower priority - scheduled, not event-driven
			},
			{
				trigger: 'time_based',
				integrations: ['slack'],
				workflowId: 'team-digest',
				priority: 40,
			},
		],

		smartDefaults: {
			digestTime: { value: '09:00' },
			timezone: { inferFrom: 'user_timezone' },
		},

		essentialFields: ['digestChannel'],

		zuhandenheit: {
			timeToValue: 1440, // 24 hours until first digest
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 12,
		trialDays: 14,
		description: 'Free for teams up to 5, then $12/month',
	},

	integrations: [
		{ service: 'slack', scopes: ['read_messages', 'send_messages'] },
		{ service: 'notion', scopes: ['read_pages', 'read_databases'] },
	],

	inputs: {
		digestChannel: {
			type: 'slack_channel_picker',
			label: 'Digest Channel',
			required: true,
			description: 'Where to post the daily digest',
		},
		digestTime: {
			type: 'time',
			label: 'Digest Time',
			default: '09:00',
			description: 'When to send the daily digest',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
		slackChannels: {
			type: 'array',
			label: 'Channels to Monitor',
			items: { type: 'slack_channel_picker' },
			description: 'Which Slack channels to include in digest',
		},
		notionDatabase: {
			type: 'notion_database_picker',
			label: 'Notion Tasks Database',
			description: 'Track task updates from this database',
		},
	},

	trigger: schedule({
		cron: '0 {{inputs.digestTime.hour}} * * 1-5', // Weekdays only
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations }) {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		// Gather Slack activity
		const slackActivity: Array<{
			channel: string;
			messageCount: number;
			activeUsers: number;
		}> = [];
		for (const channel of inputs.slackChannels || []) {
			const messages = await integrations.slack.conversations.history({
				channel,
				oldest: (yesterday.getTime() / 1000).toString(),
				limit: 100,
			});

			if (messages.success && messages.data?.messages) {
				const nonBotMessages = messages.data.messages.filter((m: any) => !m.bot_id);
				slackActivity.push({
					channel,
					messageCount: nonBotMessages.length,
					activeUsers: [...new Set(nonBotMessages.map((m: any) => m.user))].length,
				});
			}
		}

		// Gather Notion activity
		let notionUpdates = [];
		if (inputs.notionDatabase) {
			const recentPages = await integrations.notion.databases.query({
				database_id: inputs.notionDatabase,
				filter: {
					timestamp: 'last_edited_time',
					last_edited_time: { after: yesterday.toISOString() },
				},
				sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
				page_size: 20,
			});

			if (recentPages.success) {
				notionUpdates = recentPages.data.map((page: any) => ({
					title: page.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
					status: page.properties?.Status?.select?.name || 'Unknown',
					url: page.url,
				}));
			}
		}

		// Build digest message
		const digestBlocks = [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: `📊 Team Digest - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
				},
			},
			{ type: 'divider' },
		];

		// Slack section
		if (slackActivity.length > 0) {
			const totalMessages = slackActivity.reduce((sum, c) => sum + c.messageCount, 0);
			const totalUsers = new Set(slackActivity.flatMap((c) => c.activeUsers)).size;

			digestBlocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*💬 Slack Activity*\n${totalMessages} messages across ${slackActivity.length} channels\n${totalUsers} active team members`,
				},
			});
		}

		// Notion section
		if (notionUpdates.length > 0) {
			const taskList = notionUpdates
				.slice(0, 5)
				.map((t: any) => `• <${t.url}|${t.title}> - ${t.status}`)
				.join('\n');

			digestBlocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*📝 Notion Updates*\n${notionUpdates.length} tasks updated\n${taskList}`,
				},
			});
		}

		// Post digest
		const posted = await integrations.slack.chat.postMessage({
			channel: inputs.digestChannel,
			text: 'Daily Team Digest',
			blocks: digestBlocks,
		});

		return {
			success: true,
			digestPosted: posted.success,
			stats: {
				slackChannels: slackActivity.length,
				notionUpdates: notionUpdates.length,
			},
		};
	},
});

export const metadata = {
	id: 'team-digest-generator',
	category: 'communication',
	featured: false,
	stats: { rating: 4.6, users: 543, reviews: 28 },
};

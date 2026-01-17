/**
 * Standup Reminder Bot
 *
 * Collect and share daily standups in Slack.
 * Stores standup history in Notion for tracking.
 *
 * Integrations: Slack, Notion
 * Trigger: Scheduled (daily on weekdays)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Standup Reminder Bot',
	description: 'Collect and share daily standups in Slack',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'every_morning',

		outcomeStatement: {
			suggestion: 'Automate daily standups?',
			explanation: 'Every morning, we\'ll prompt your team for updates and share a summary in Slack.',
			outcome: 'Daily standups in Slack',
		},

		primaryPair: {
			from: 'slack',
			to: 'slack',
			workflowId: 'standup-bot',
			outcome: 'Standups that run themselves',
		},

		additionalPairs: [
			{ from: 'slack', to: 'notion', workflowId: 'standup-bot', outcome: 'Standup history in Notion' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['slack'],
				workflowId: 'standup-bot',
				priority: 40, // Lower priority - team specific
			},
		],

		smartDefaults: {
			standupTime: { value: '09:00' },
			summaryTime: { value: '10:00' },
			timezone: { inferFrom: 'user_timezone' },
			promptQuestions: { value: [
				'What did you accomplish yesterday?',
				'What are you working on today?',
				'Any blockers?',
			]},
		},

		essentialFields: ['standup_channel'],

		zuhandenheit: {
			timeToValue: 1440, // 24 hours until first standup
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'free',
		description: 'Free for all teams',
	},

	integrations: [
		{ service: 'slack', scopes: ['send_messages', 'read_messages'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'] },
	],

	config: {
		standup_channel: {
			type: 'text',
			label: 'Standup Channel',
			required: true,
			description: 'Channel for daily standups',
		},
		standup_time: {
			type: 'time',
			label: 'Standup Prompt Time',
			default: '09:00',
		},
		summary_time: {
			type: 'time',
			label: 'Summary Post Time',
			default: '10:00',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
		standup_database: {
			type: 'text',
			label: 'Standup Archive (Notion)',
			description: 'Optional: Archive standups in Notion',
		},
		prompt_questions: {
			type: 'array',
			label: 'Standup Questions',
			items: { type: 'string' },
			default: [
				"What did you accomplish yesterday?",
				"What are you working on today?",
				"Any blockers or things you need help with?",
			],
		},
		exclude_weekends: {
			type: 'boolean',
			label: 'Skip Weekends',
			default: true,
		},
	},

	trigger: schedule({
		cron: '0 {{inputs.standupTime.hour}} * * 1-5', // Weekdays
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations }) {
		const today = new Date();
		const dateStr = today.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
		});

		// Build standup prompt
		const questionsFormatted = inputs.promptQuestions
			.map((q: string, i: number) => `${i + 1}. ${q}`)
			.join('\n');

		// Post standup prompt
		const promptMessage = await integrations.slack.chat.postMessage({
			channel: inputs.standupChannel,
			text: `☀️ Good morning! Time for standup - ${dateStr}`,
			blocks: [
				{
					type: 'header',
					text: { type: 'plain_text', text: `☀️ Daily Standup - ${dateStr}` },
				},
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `Good morning team! Please share your standup update in a thread below.\n\n*Today's questions:*\n${questionsFormatted}`,
					},
				},
				{
					type: 'context',
					elements: [
						{
							type: 'mrkdwn',
							text: `💡 Reply in the thread to keep the channel organized. Summary will be posted at ${inputs.summaryTime}.`,
						},
					],
				},
			],
		});

		if (!promptMessage.success) {
			throw new Error('Failed to post standup prompt');
		}

		// Store standup thread info for later summary
		// In a real implementation, this would use KV or D1 storage
		const standupData = {
			date: today.toISOString().split('T')[0],
			threadTs: promptMessage.data?.ts,
			channel: inputs.standupChannel,
		};

		// If Notion database is configured, create a page for today's standup
		if (inputs.standupDatabase) {
			await integrations.notion.pages.create({
				parent: { database_id: inputs.standupDatabase },
				properties: {
					Name: {
						title: [{ text: { content: `Standup - ${dateStr}` } }],
					},
					Date: {
						date: { start: today.toISOString().split('T')[0] },
					},
					Status: {
						select: { name: 'In Progress' },
					},
					'Thread Link': {
						url: `https://slack.com/archives/${inputs.standupChannel}/p${promptMessage.data?.ts?.replace('.', '')}`,
					},
				},
				children: [
					{
						object: 'block',
						type: 'heading_2',
						heading_2: {
							rich_text: [{ text: { content: '📋 Standup Responses' } }],
						},
					},
					{
						object: 'block',
						type: 'paragraph',
						paragraph: {
							rich_text: [
								{
									text: {
										content: 'Responses will be collected from the Slack thread.',
									},
								},
							],
						},
					},
				],
			});
		}

		return {
			success: true,
			date: dateStr,
			promptPosted: true,
			threadTs: promptMessage.data?.ts,
			notionPageCreated: !!inputs.standupDatabase,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		// Notify channel about standup failure
		if (inputs.standupChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.standupChannel,
				text: `⚠️ Standup automation encountered an issue: ${error.message}. Please share your updates manually today.`,
			});
		}
	},
});

// Additional workflow for collecting and summarizing responses
export const standupSummary = defineWorkflow({
	name: 'Standup Summary',
	description: 'Collect standup responses and post summary',
	version: '1.0.0',

	pricing: { model: 'free' },

	integrations: [
		{ service: 'slack', scopes: ['read_messages', 'send_messages'] },
		{ service: 'notion', scopes: ['write_pages'] },
	],

	config: {
		standup_channel: {
			type: 'text',
			label: 'Standup Channel',
			required: true,
		},
		summary_time: {
			type: 'time',
			label: 'Summary Time',
			default: '10:00',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
	},

	trigger: schedule({
		cron: '0 {{inputs.summaryTime.hour}} * * 1-5',
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations }) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Get today's standup thread
		// Find the most recent standup message from today
		const history = await integrations.slack.conversations.history({
			channel: inputs.standupChannel,
			oldest: (today.getTime() / 1000).toString(),
			limit: 10,
		});

		if (!history.success || !history.data?.messages) {
			return { success: true, skipped: true, reason: 'No standup found for today' };
		}

		// Find the standup prompt message
		const standupMessage = history.data.messages.find(
			(m: any) => m.text?.includes('Daily Standup') && !m.thread_ts
		);

		if (!standupMessage) {
			return { success: true, skipped: true, reason: 'Standup prompt not found' };
		}

		// Get thread replies
		const replies = await integrations.slack.conversations.replies({
			channel: inputs.standupChannel,
			ts: standupMessage.ts,
		});

		if (!replies.success || !replies.data?.messages) {
			return { success: true, skipped: true, reason: 'No replies to standup' };
		}

		// Filter out the original message and bot messages
		const responses = replies.data.messages.filter(
			(m: any) => m.ts !== standupMessage.ts && !m.bot_id
		);

		if (responses.length === 0) {
			// Post reminder if no responses
			await integrations.slack.chat.postMessage({
				channel: inputs.standupChannel,
				thread_ts: standupMessage.ts,
				text: "👀 Looks like no one has posted their standup yet. Don't forget to share your update!",
			});

			return {
				success: true,
				responses: 0,
				reminder: true,
			};
		}

		// Create summary
		const participantCount = new Set(responses.map((r: any) => r.user)).size;
		const participantList = [...new Set(responses.map((r: any) => `<@${r.user}>`))]
			.join(', ');

		// Post summary
		await integrations.slack.chat.postMessage({
			channel: inputs.standupChannel,
			text: `📊 Standup Summary - ${participantCount} team members checked in`,
			blocks: [
				{
					type: 'header',
					text: { type: 'plain_text', text: '📊 Standup Summary' },
				},
				{
					type: 'section',
					fields: [
						{
							type: 'mrkdwn',
							text: `*Participants:*\n${participantCount} team members`,
						},
						{
							type: 'mrkdwn',
							text: `*Responses:*\n${responses.length} updates`,
						},
					],
				},
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `*Who checked in:*\n${participantList}`,
					},
				},
				{
					type: 'actions',
					elements: [
						{
							type: 'button',
							text: { type: 'plain_text', text: 'View Full Thread' },
							url: `https://slack.com/archives/${inputs.standupChannel}/p${standupMessage.ts.replace('.', '')}`,
						},
					],
				},
			],
		});

		return {
			success: true,
			responses: responses.length,
			participants: participantCount,
		};
	},
});

export const metadata = {
	id: 'standup-reminder-bot',
	category: 'team-management',
	featured: false,
	stats: { rating: 4.7, users: 892, reviews: 48 },
};

/**
 * Content Calendar Automation
 *
 * Compound workflow: Airtable → Slack + Gmail
 *
 * Automates content publishing reminders:
 * 1. Monitors Airtable content calendar
 * 2. Posts daily publishing schedule to Slack
 * 3. Sends reminder emails to content owners
 * 4. AI generates content briefs for upcoming pieces
 *
 * Zuhandenheit: "Content reminders appear automatically"
 * not "manually check calendar and ping team members"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Content Calendar Automation',
	description:
		'Get daily publishing reminders in Slack, automatic owner notifications, and AI-generated content briefs from your Airtable calendar',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'every_morning',

		outcomeStatement: {
			suggestion: 'Want content reminders that send themselves?',
			explanation: 'Every morning, we\'ll post today\'s publishing schedule to Slack and notify content owners.',
			outcome: 'Content calendar on autopilot',
		},

		primaryPair: {
			from: 'airtable',
			to: 'slack',
			workflowId: 'content-calendar',
			outcome: 'Content schedule in Slack every morning',
		},

		additionalPairs: [
			{ from: 'airtable', to: 'gmail', workflowId: 'content-calendar', outcome: 'Owner reminders via email' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['airtable', 'slack'],
				workflowId: 'content-calendar',
				priority: 75,
			},
		],

		smartDefaults: {
			scheduleHour: { value: 8 },
			sendOwnerReminders: { value: true },
			lookAheadDays: { value: 1 },
		},

		essentialFields: ['airtableBaseId', 'airtableTableId', 'slackChannel'],

		zuhandenheit: {
			timeToValue: 1440, // Next morning
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 12,
		trialDays: 14,
		description: 'Free for 20 content pieces/month, $12/month unlimited',
	},

	integrations: [
		{ service: 'airtable', scopes: ['data.records:read'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'gmail', scopes: ['gmail.compose'], optional: true },
	],

	inputs: {
		airtableBaseId: {
			type: 'airtable_base_picker',
			label: 'Content Calendar Base',
			required: true,
			description: 'Airtable base with your content calendar',
		},
		airtableTableId: {
			type: 'airtable_table_picker',
			label: 'Content Table',
			required: true,
			description: 'Table containing content items',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Content Updates Channel',
			required: true,
			description: 'Channel for daily content reminders',
		},
		dateFieldName: {
			type: 'text',
			label: 'Publish Date Field',
			required: true,
			default: 'Publish Date',
			description: 'Name of the date field in Airtable',
		},
		titleFieldName: {
			type: 'text',
			label: 'Title Field',
			required: true,
			default: 'Title',
			description: 'Name of the title field',
		},
		ownerFieldName: {
			type: 'text',
			label: 'Owner Field',
			required: false,
			default: 'Owner',
			description: 'Name of the owner/assignee field (email)',
		},
		statusFieldName: {
			type: 'text',
			label: 'Status Field',
			required: false,
			default: 'Status',
			description: 'Name of the status field',
		},
		scheduleHour: {
			type: 'number',
			label: 'Reminder Hour (24h)',
			default: 8,
			min: 0,
			max: 23,
			description: 'Hour to send daily reminder',
		},
		lookAheadDays: {
			type: 'number',
			label: 'Look Ahead Days',
			default: 1,
			min: 1,
			max: 7,
			description: 'How many days ahead to include',
		},
		sendOwnerReminders: {
			type: 'boolean',
			label: 'Email Owner Reminders',
			default: true,
			description: 'Send email reminders to content owners',
		},
		enableAIBriefs: {
			type: 'boolean',
			label: 'AI Content Briefs',
			default: true,
			description: 'Generate AI content briefs for upcoming pieces',
		},
	},

	trigger: schedule({
		cron: '0 8 * * *', // Daily at 8am
		timezone: 'America/New_York',
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + inputs.lookAheadDays);

		// 1. Fetch content from Airtable
		const recordsData = await integrations.airtable.records.list({
			baseId: inputs.airtableBaseId,
			tableId: inputs.airtableTableId,
			filterByFormula: `AND(
				IS_AFTER({${inputs.dateFieldName}}, '${formatAirtableDate(today, -1)}'),
				IS_BEFORE({${inputs.dateFieldName}}, '${formatAirtableDate(endDate, 1)}')
			)`,
			sort: [{ field: inputs.dateFieldName, direction: 'asc' }],
		});

		if (!recordsData.success) {
			return { success: false, error: 'Failed to fetch content calendar' };
		}

		const records = recordsData.data;

		// Group by date
		const contentByDate: Record<string, ContentItem[]> = {};
		for (const record of records) {
			const publishDate = record.fields[inputs.dateFieldName];
			if (!publishDate) continue;

			const dateKey = new Date(publishDate as string).toISOString().split('T')[0];
			if (!contentByDate[dateKey]) {
				contentByDate[dateKey] = [];
			}

			contentByDate[dateKey].push({
				id: record.id,
				title: record.fields[inputs.titleFieldName] as string || 'Untitled',
				status: record.fields[inputs.statusFieldName] as string || 'Unknown',
				owner: record.fields[inputs.ownerFieldName] as string,
				date: dateKey,
				fields: record.fields,
			});
		}

		// 2. Generate AI briefs for today's content (optional)
		const aiBriefs: Record<string, string> = {};
		const todayKey = today.toISOString().split('T')[0];
		if (inputs.enableAIBriefs && env.AI && contentByDate[todayKey]) {
			for (const item of contentByDate[todayKey].slice(0, 3)) {
				const brief = await generateContentBrief(env.AI, item);
				if (brief) {
					aiBriefs[item.id] = brief;
				}
			}
		}

		// 3. Post to Slack
		const slackBlocks = buildSlackBlocks(contentByDate, aiBriefs, inputs);

		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			blocks: slackBlocks,
			text: `Content Calendar: ${records.length} items scheduled`,
		});

		// 4. Send owner reminders (optional)
		let emailsSent = 0;
		if (inputs.sendOwnerReminders && integrations.gmail && contentByDate[todayKey]) {
			const ownerContent: Record<string, ContentItem[]> = {};

			for (const item of contentByDate[todayKey]) {
				if (item.owner && item.owner.includes('@')) {
					if (!ownerContent[item.owner]) {
						ownerContent[item.owner] = [];
					}
					ownerContent[item.owner].push(item);
				}
			}

			for (const [owner, items] of Object.entries(ownerContent)) {
				const emailBody = buildReminderEmail(items, aiBriefs);
				const result = await integrations.gmail.messages.send({
					to: owner,
					subject: `📅 Content Due Today: ${items.map(i => i.title).join(', ')}`,
					body: emailBody,
				});

				if (result.success) {
					emailsSent++;
				}
			}
		}

		return {
			success: true,
			content: {
				total: records.length,
				today: contentByDate[todayKey]?.length || 0,
				byDate: Object.fromEntries(
					Object.entries(contentByDate).map(([date, items]) => [date, items.length])
				),
			},
			notifications: {
				slack: true,
				emailsSent,
			},
			aiBriefs: Object.keys(aiBriefs).length,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Content Calendar Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface ContentItem {
	id: string;
	title: string;
	status: string;
	owner?: string;
	date: string;
	fields: Record<string, any>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatAirtableDate(date: Date, offset: number = 0): string {
	const d = new Date(date);
	d.setDate(d.getDate() + offset);
	return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
	const date = new Date(dateStr);
	const today = new Date();
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	if (dateStr === today.toISOString().split('T')[0]) {
		return 'Today';
	} else if (dateStr === tomorrow.toISOString().split('T')[0]) {
		return 'Tomorrow';
	}
	return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function generateContentBrief(ai: any, item: ContentItem): Promise<string | null> {
	try {
		const prompt = `Generate a brief 2-3 sentence content brief for this piece:

Title: ${item.title}
Status: ${item.status}
${Object.entries(item.fields)
	.filter(([k, v]) => typeof v === 'string' && v.length < 200)
	.map(([k, v]) => `${k}: ${v}`)
	.slice(0, 5)
	.join('\n')}

Write a helpful brief that reminds the author of key points to cover. Keep it under 50 words.`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 100,
		});

		return result.response || null;
	} catch (e) {
		return null;
	}
}

function buildSlackBlocks(
	contentByDate: Record<string, ContentItem[]>,
	aiBriefs: Record<string, string>,
	inputs: any
): any[] {
	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: '📅 Content Calendar' },
		},
	];

	const sortedDates = Object.keys(contentByDate).sort();

	for (const dateKey of sortedDates) {
		const items = contentByDate[dateKey];
		const displayDate = formatDisplayDate(dateKey);
		const isToday = displayDate === 'Today';

		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${isToday ? '🔴' : '📌'} *${displayDate}* (${items.length} ${items.length === 1 ? 'piece' : 'pieces'})`,
			},
		});

		for (const item of items.slice(0, 5)) {
			const statusEmoji = getStatusEmoji(item.status);
			const ownerText = item.owner ? ` • @${item.owner.split('@')[0]}` : '';
			const briefText = aiBriefs[item.id] ? `\n_${aiBriefs[item.id]}_` : '';

			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `${statusEmoji} *${item.title}*\n_${item.status}_${ownerText}${briefText}`,
				},
			});
		}

		if (items.length > 5) {
			blocks.push({
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: `_...and ${items.length - 5} more items_`,
					},
				],
			});
		}

		blocks.push({ type: 'divider' });
	}

	if (sortedDates.length === 0) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `✅ No content scheduled for the next ${inputs.lookAheadDays} day(s)`,
			},
		});
	}

	return blocks;
}

function getStatusEmoji(status: string): string {
	const lower = status.toLowerCase();
	if (lower.includes('draft')) return '📝';
	if (lower.includes('review')) return '👀';
	if (lower.includes('approved') || lower.includes('ready')) return '✅';
	if (lower.includes('publish')) return '🚀';
	if (lower.includes('late') || lower.includes('overdue')) return '🔴';
	return '📋';
}

function buildReminderEmail(items: ContentItem[], aiBriefs: Record<string, string>): string {
	let body = `Hi,\n\nThis is a reminder that you have content scheduled for today:\n\n`;

	for (const item of items) {
		body += `📝 ${item.title}\n`;
		body += `   Status: ${item.status}\n`;
		if (aiBriefs[item.id]) {
			body += `   Brief: ${aiBriefs[item.id]}\n`;
		}
		body += '\n';
	}

	body += `\nPlease make sure to complete and publish your content today.\n\nBest,\nContent Calendar Bot`;

	return body;
}

export const metadata = {
	id: 'content-calendar',
	category: 'marketing-social',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};

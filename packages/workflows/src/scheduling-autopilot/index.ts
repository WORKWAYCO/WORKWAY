/**
 * Scheduling Autopilot
 *
 * Compound workflow: Calendly → Notion + Slack
 *
 * Automates meeting scheduling:
 * 1. When meetings are booked via Calendly
 * 2. Creates/updates Notion database entry
 * 3. Notifies team in Slack
 * 4. Tracks meeting history and attendee info
 *
 * Zuhandenheit: "My calendar manages itself"
 * not "manually log each booking and notify team"
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { Calendly } from '@workwayco/integrations';

export default defineWorkflow({
	name: 'Scheduling Autopilot',
	description:
		'When meetings are booked on Calendly, automatically log them to Notion and notify your team in Slack',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_meetings_booked',

		outcomeStatement: {
			suggestion: 'Want your calendar to manage itself?',
			explanation:
				'When someone books a meeting, we\'ll log it to Notion and alert your team in Slack.',
			outcome: 'Scheduling on autopilot',
		},

		primaryPair: {
			from: 'calendly',
			to: 'notion',
			workflowId: 'scheduling-autopilot',
			outcome: 'Meetings logged automatically',
		},

		additionalPairs: [
			{
				from: 'calendly',
				to: 'slack',
				workflowId: 'scheduling-autopilot',
				outcome: 'Booking alerts in Slack',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['calendly', 'notion'],
				workflowId: 'scheduling-autopilot',
				priority: 90,
			},
			{
				trigger: 'integration_connected',
				integrations: ['calendly', 'slack'],
				workflowId: 'scheduling-autopilot',
				priority: 80,
			},
		],

		smartDefaults: {
			notifyOnBooking: { value: true },
			notifyOnCancellation: { value: true },
		},

		essentialFields: ['notionDatabaseId'],

		zuhandenheit: {
			timeToValue: 1, // Instant on booking
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 10,
		trialDays: 14,
		description: 'Free for 25 bookings/month, $10/month unlimited',
	},

	integrations: [
		{ service: 'calendly', scopes: ['default'] },
		{ service: 'notion', scopes: ['insert_content', 'read_content'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'], optional: true },
	],

	inputs: {
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Meetings Database',
			required: true,
			description: 'Notion database to log meetings',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Notification Channel',
			required: false,
			description: 'Channel for booking notifications',
		},
		notifyOnBooking: {
			type: 'boolean',
			label: 'Notify on Booking',
			default: true,
			description: 'Send Slack notification when meeting is booked',
		},
		notifyOnCancellation: {
			type: 'boolean',
			label: 'Notify on Cancellation',
			default: true,
			description: 'Send Slack notification when meeting is canceled',
		},
		includeQuestionsInNotion: {
			type: 'boolean',
			label: 'Include Form Answers',
			default: true,
			description: 'Add booking form answers to Notion page',
		},
	},

	trigger: webhook({
		path: '/calendly',
		events: ['invitee.created', 'invitee.canceled'],
	}),

	async execute({ trigger, inputs, integrations }) {
		const event = trigger.payload;
		const isBooking = event.event === 'invitee.created';
		const isCancellation = event.event === 'invitee.canceled';

		// Extract meeting details using Calendly helper
		const details = Calendly.extractMeetingDetails(event);

		// 1. Create or update Notion page
		const existingPages = await integrations.notion.databases.query({
			database_id: inputs.notionDatabaseId,
			filter: {
				property: 'Calendly URI',
				rich_text: { equals: event.payload.uri || '' },
			},
		});

		const notionProperties = buildNotionProperties(details, event, inputs);

		let notionPageId: string;
		if (existingPages.success && existingPages.data?.results?.length > 0) {
			// Update existing
			notionPageId = existingPages.data.results[0].id;
			await integrations.notion.pages.update({
				page_id: notionPageId,
				properties: notionProperties,
			});
		} else {
			// Create new
			const newPage = await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: notionProperties,
				children: buildNotionContent(details, event, inputs),
			});
			notionPageId = newPage.data?.id || '';
		}

		// 2. Send Slack notification
		let slackSent = false;
		if (inputs.slackChannel) {
			const shouldNotify =
				(isBooking && inputs.notifyOnBooking) ||
				(isCancellation && inputs.notifyOnCancellation);

			if (shouldNotify) {
				await integrations.slack?.chat.postMessage({
					channel: inputs.slackChannel,
					blocks: buildSlackBlocks(details, isBooking),
					text: isBooking
						? `New meeting booked: ${details.eventName} with ${details.inviteeName}`
						: `Meeting canceled: ${details.eventName} with ${details.inviteeName}`,
				});
				slackSent = true;
			}
		}

		return {
			success: true,
			event: isBooking ? 'booking' : 'cancellation',
			meeting: {
				name: details.eventName,
				invitee: details.inviteeName,
				email: details.inviteeEmail,
				time: details.startTime,
			},
			notion: {
				pageId: notionPageId,
				updated: existingPages.data?.results?.length > 0,
			},
			slack: {
				sent: slackSent,
			},
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Scheduling Autopilot Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildNotionProperties(details: any, event: any, inputs: any): Record<string, any> {
	const properties: Record<string, any> = {
		Name: {
			title: [
				{
					text: {
						content: `${details.eventName || 'Meeting'} - ${details.inviteeName}`,
					},
				},
			],
		},
		'Invitee Name': {
			rich_text: [{ text: { content: details.inviteeName || '' } }],
		},
		'Invitee Email': {
			email: details.inviteeEmail || null,
		},
		Status: {
			select: { name: details.isCanceled ? 'Canceled' : 'Scheduled' },
		},
		'Calendly URI': {
			rich_text: [{ text: { content: event.payload.uri || '' } }],
		},
	};

	if (details.startTime) {
		properties['Meeting Time'] = {
			date: {
				start: details.startTime,
				end: details.endTime || undefined,
			},
		};
	}

	if (details.timezone) {
		properties['Timezone'] = {
			rich_text: [{ text: { content: details.timezone } }],
		};
	}

	if (details.joinUrl) {
		properties['Meeting Link'] = {
			url: details.joinUrl,
		};
	}

	return properties;
}

function buildNotionContent(details: any, event: any, inputs: any): any[] {
	const blocks: any[] = [];

	// Meeting info header
	blocks.push({
		type: 'callout',
		callout: {
			icon: { emoji: details.isCanceled ? '❌' : '📅' },
			rich_text: [
				{
					type: 'text',
					text: {
						content: details.isCanceled
							? 'This meeting was canceled'
							: `Scheduled for ${formatTime(details.startTime)}`,
					},
				},
			],
		},
	});

	// Attendee info
	blocks.push({
		type: 'heading_3',
		heading_3: {
			rich_text: [{ type: 'text', text: { content: 'Attendee' } }],
		},
	});

	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{ type: 'text', text: { content: 'Name: ' }, annotations: { bold: true } },
				{ type: 'text', text: { content: details.inviteeName || 'Unknown' } },
			],
		},
	});

	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{ type: 'text', text: { content: 'Email: ' }, annotations: { bold: true } },
				{ type: 'text', text: { content: details.inviteeEmail || 'Unknown' } },
			],
		},
	});

	// Q&A from booking form
	if (inputs.includeQuestionsInNotion && Object.keys(details.questionsAndAnswers).length > 0) {
		blocks.push({
			type: 'heading_3',
			heading_3: {
				rich_text: [{ type: 'text', text: { content: 'Booking Questions' } }],
			},
		});

		for (const [question, answer] of Object.entries(details.questionsAndAnswers)) {
			blocks.push({
				type: 'paragraph',
				paragraph: {
					rich_text: [
						{ type: 'text', text: { content: `${question}: ` }, annotations: { bold: true } },
						{ type: 'text', text: { content: String(answer) } },
					],
				},
			});
		}
	}

	// Links
	if (details.joinUrl || details.cancelUrl || details.rescheduleUrl) {
		blocks.push({
			type: 'heading_3',
			heading_3: {
				rich_text: [{ type: 'text', text: { content: 'Links' } }],
			},
		});

		if (details.joinUrl) {
			blocks.push({
				type: 'bookmark',
				bookmark: { url: details.joinUrl },
			});
		}
	}

	return blocks;
}

function buildSlackBlocks(details: any, isBooking: boolean): any[] {
	const emoji = isBooking ? ':calendar:' : ':x:';
	const action = isBooking ? 'booked' : 'canceled';

	const blocks: any[] = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${emoji} *Meeting ${action}*\n*${details.eventName || 'Meeting'}* with ${details.inviteeName}`,
			},
		},
		{
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Email:*\n${details.inviteeEmail || 'N/A'}`,
				},
				{
					type: 'mrkdwn',
					text: `*Time:*\n${details.startTime ? formatTime(details.startTime) : 'N/A'}`,
				},
			],
		},
	];

	if (details.joinUrl && isBooking) {
		blocks.push({
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: { type: 'plain_text', text: 'Join Meeting' },
					url: details.joinUrl,
				},
			],
		});
	}

	if (details.isCanceled && details.cancellationReason) {
		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `_Reason: ${details.cancellationReason}_`,
				},
			],
		});
	}

	return blocks;
}

function formatTime(isoTime: string): string {
	const date = new Date(isoTime);
	return date.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

export const metadata = {
	id: 'scheduling-autopilot',
	category: 'productivity-utilities',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};

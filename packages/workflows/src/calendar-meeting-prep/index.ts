/**
 * Calendar Meeting Prep Workflow
 *
 * Automatically prepare for upcoming meetings by gathering context
 * from Notion, surfacing talking points in Slack, and ensuring
 * you never walk into a meeting unprepared.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My meetings brief themselves"
 *
 * Integrations: Google Calendar, Notion, Slack
 * Trigger: 15 minutes before each calendar event
 */

import { defineWorkflow, cron } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Calendar Meeting Prep',
	description: 'Meetings that brief themselves - context gathered automatically before every call',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'before_meetings',

		outcomeStatement: {
			suggestion: 'Want meeting briefs automatically?',
			explanation: 'Before each meeting, we gather context from Notion and surface talking points in Slack.',
			outcome: 'Meetings that brief themselves',
		},

		primaryPair: {
			from: 'google-calendar',
			to: 'notion',
			workflowId: 'calendar-meeting-prep',
			outcome: 'Meetings that brief themselves',
		},

		additionalPairs: [
			{ from: 'google-calendar', to: 'slack', workflowId: 'calendar-meeting-prep', outcome: 'Meeting briefs in Slack' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['google-calendar', 'notion'],
				workflowId: 'calendar-meeting-prep',
				priority: 100,
			},
		],

		smartDefaults: {
			minutesBefore: { value: 15 },
			includeAttendeeContext: { value: true },
			searchNotionForContext: { value: true },
			postToSlack: { value: true },
		},

		essentialFields: ['notionWorkspaceId'],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.10,
		freeExecutions: 50,
		description: 'Per meeting briefed (includes AI context gathering)',
	},

	integrations: [
		{ service: 'google-calendar', scopes: ['calendar.readonly', 'calendar.events'] },
		{ service: 'notion', scopes: ['read_pages', 'read_databases', 'search'] },
		{ service: 'slack', scopes: ['send_messages', 'read_channels'] },
	],

	inputs: {
		// Core configuration
		notionWorkspaceId: {
			type: 'text',
			label: 'Notion Workspace',
			required: true,
			description: 'We\'ll search this workspace for meeting context',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Brief Delivery Channel',
			required: false,
			description: 'Where to post meeting briefs (defaults to DM)',
		},

		// Timing
		minutesBefore: {
			type: 'number',
			label: 'Minutes Before Meeting',
			default: 15,
			description: 'When to deliver the brief',
		},

		// Context gathering
		includeAttendeeContext: {
			type: 'boolean',
			label: 'Include Attendee Context',
			default: true,
			description: 'Search Notion for pages mentioning attendees',
		},
		searchNotionForContext: {
			type: 'boolean',
			label: 'Search Notion for Meeting Context',
			default: true,
			description: 'Find related Notion pages by meeting title/description',
		},
		maxContextPages: {
			type: 'number',
			label: 'Max Context Pages',
			default: 5,
			description: 'Maximum Notion pages to include in brief',
		},

		// AI settings
		enableAI: {
			type: 'boolean',
			label: 'AI-Generated Talking Points',
			default: true,
			description: 'Generate talking points from gathered context',
		},

		// Filtering
		excludeAllDayEvents: {
			type: 'boolean',
			label: 'Exclude All-Day Events',
			default: true,
			description: 'Skip all-day events (holidays, OOO)',
		},
		excludeRecurring: {
			type: 'boolean',
			label: 'Exclude Recurring 1:1s',
			default: false,
			description: 'Skip recurring meetings (usually have established context)',
		},
		minimumAttendees: {
			type: 'number',
			label: 'Minimum Attendees',
			default: 2,
			description: 'Only brief meetings with at least this many attendees',
		},
	},

	// Run every 5 minutes to check for upcoming meetings
	trigger: cron({
		schedule: '*/5 * * * *',
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			meeting: { id: string; title: string; start: string };
			contextFound: number;
			briefPosted: boolean;
			talkingPoints: string[];
		}> = [];

		const now = new Date();
		const checkWindowStart = new Date(now.getTime() + (inputs.minutesBefore - 2) * 60 * 1000);
		const checkWindowEnd = new Date(now.getTime() + (inputs.minutesBefore + 3) * 60 * 1000);

		// 1. Get upcoming calendar events
		const calendarResult = await integrations['google-calendar'].events.list({
			timeMin: checkWindowStart.toISOString(),
			timeMax: checkWindowEnd.toISOString(),
			singleEvents: true,
			orderBy: 'startTime',
		});

		if (!calendarResult.success || !calendarResult.data?.length) {
			return { success: true, briefed: 0, message: 'No upcoming meetings in window' };
		}

		for (const event of calendarResult.data) {
			// Filter checks
			if (inputs.excludeAllDayEvents && event.allDay) continue;
			if (inputs.excludeRecurring && event.recurringEventId) continue;
			if ((event.attendees?.length || 1) < inputs.minimumAttendees) continue;

			// Check if we've already briefed this meeting (idempotency)
			const briefKey = `brief:${event.id}:${event.start}`;
			const alreadyBriefed = await env.KV?.get(briefKey);
			if (alreadyBriefed) continue;

			// 2. Gather context from Notion
			const context = await gatherMeetingContext({
				event,
				inputs,
				integrations,
			});

			// 3. Generate talking points with AI (if enabled)
			let talkingPoints: string[] = [];
			if (inputs.enableAI && context.pages.length > 0) {
				talkingPoints = await generateTalkingPoints({
					event,
					context,
					integrations,
					env,
				});
			}

			// 4. Post brief to Slack
			let briefPosted = false;
			if (inputs.slackChannel || context.pages.length > 0 || talkingPoints.length > 0) {
				briefPosted = await postMeetingBrief({
					event,
					context,
					talkingPoints,
					channel: inputs.slackChannel,
					integrations,
				});
			}

			// 5. Mark as briefed (TTL: 24 hours)
			await env.KV?.put(briefKey, 'true', { expirationTtl: 86400 });

			results.push({
				meeting: { id: event.id, title: event.summary || 'Untitled', start: event.start },
				contextFound: context.pages.length,
				briefPosted,
				talkingPoints,
			});
		}

		return {
			success: true,
			briefed: results.length,
			results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `Meeting prep failed: ${error.message}`,
			});
		}
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface MeetingContext {
	pages: Array<{
		id: string;
		title: string;
		url: string;
		excerpt: string;
		relevance: 'attendee' | 'topic' | 'company';
	}>;
	attendees: Array<{
		email: string;
		name?: string;
		notionMentions: number;
	}>;
}

async function gatherMeetingContext(params: {
	event: any;
	inputs: any;
	integrations: any;
}): Promise<MeetingContext> {
	const { event, inputs, integrations } = params;
	const context: MeetingContext = { pages: [], attendees: [] };

	const searchQueries: string[] = [];

	// Build search queries from meeting title
	if (inputs.searchNotionForContext && event.summary) {
		searchQueries.push(event.summary);

		// Extract company names from title (common patterns)
		const companyMatch = event.summary.match(/(?:with|@|for)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
		if (companyMatch) {
			searchQueries.push(companyMatch[1]);
		}
	}

	// Build search queries from attendees
	if (inputs.includeAttendeeContext && event.attendees) {
		for (const attendee of event.attendees.slice(0, 5)) {
			const name = attendee.displayName || attendee.email?.split('@')[0];
			if (name) {
				searchQueries.push(name);
				context.attendees.push({
					email: attendee.email,
					name,
					notionMentions: 0,
				});
			}

			// Extract company from email domain
			const domain = attendee.email?.split('@')[1]?.split('.')[0];
			if (domain && !['gmail', 'outlook', 'yahoo', 'hotmail'].includes(domain)) {
				searchQueries.push(domain);
			}
		}
	}

	// Search Notion for each query
	const seenPageIds = new Set<string>();

	for (const query of searchQueries.slice(0, 8)) {
		try {
			const searchResult = await integrations.notion.search({
				query,
				filter: { property: 'object', value: 'page' },
				page_size: 3,
			});

			if (searchResult.success && searchResult.data?.results) {
				for (const page of searchResult.data.results) {
					if (seenPageIds.has(page.id)) continue;
					if (context.pages.length >= inputs.maxContextPages) break;

					seenPageIds.add(page.id);

					// Extract title
					const title = page.properties?.title?.title?.[0]?.plain_text ||
						page.properties?.Name?.title?.[0]?.plain_text ||
						'Untitled';

					// Determine relevance
					let relevance: 'attendee' | 'topic' | 'company' = 'topic';
					const queryLower = query.toLowerCase();
					if (context.attendees.some(a => a.name?.toLowerCase() === queryLower)) {
						relevance = 'attendee';
					} else if (queryLower.length <= 15 && !query.includes(' ')) {
						relevance = 'company';
					}

					context.pages.push({
						id: page.id,
						title,
						url: page.url,
						excerpt: `Found by searching "${query}"`,
						relevance,
					});
				}
			}
		} catch {
			// Continue on search errors
		}
	}

	return context;
}

async function generateTalkingPoints(params: {
	event: any;
	context: MeetingContext;
	integrations: any;
	env: any;
}): Promise<string[]> {
	const { event, context, integrations, env } = params;

	if (context.pages.length === 0) return [];

	const pagesSummary = context.pages
		.map(p => `- "${p.title}" (${p.relevance})`)
		.join('\n');

	const attendeesList = context.attendees
		.map(a => a.name || a.email)
		.join(', ');

	try {
		const result = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a meeting prep assistant. Generate 3-5 concise talking points for an upcoming meeting.
Focus on:
- Questions to ask
- Topics to cover
- Context to remember

Return ONLY a JSON array of strings, no other text.
Example: ["Ask about Q4 timeline", "Follow up on pricing discussion", "Mention the new feature"]`,
			prompt: `Meeting: ${event.summary || 'Untitled meeting'}
Attendees: ${attendeesList || 'Not specified'}
Related Notion pages:
${pagesSummary}

Generate talking points:`,
			temperature: 0.5,
			max_tokens: 300,
		});

		const responseText = result.data?.response || '[]';
		const jsonMatch = responseText.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const points = JSON.parse(jsonMatch[0]);
			return Array.isArray(points) ? points.slice(0, 5) : [];
		}

		return [];
	} catch {
		return [];
	}
}

async function postMeetingBrief(params: {
	event: any;
	context: MeetingContext;
	talkingPoints: string[];
	channel?: string;
	integrations: any;
}): Promise<boolean> {
	const { event, context, talkingPoints, channel, integrations } = params;

	const startTime = new Date(event.start);
	const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: `Prep: ${event.summary || 'Upcoming Meeting'}`, emoji: true },
		},
		{
			type: 'context',
			elements: [
				{ type: 'mrkdwn', text: `Starting at *${timeStr}* with ${event.attendees?.length || 0} attendees` },
			],
		},
	];

	// Add talking points
	if (talkingPoints.length > 0) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Talking Points:*\n${talkingPoints.map(p => `• ${p}`).join('\n')}`,
			},
		});
	}

	// Add context links
	if (context.pages.length > 0) {
		const links = context.pages
			.slice(0, 3)
			.map(p => `• <${p.url}|${p.title}> _(${p.relevance})_`)
			.join('\n');

		blocks.push({
			type: 'section',
			text: { type: 'mrkdwn', text: `*Related Context:*\n${links}` },
		});
	}

	// Add calendar link
	if (event.htmlLink) {
		blocks.push({
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: { type: 'plain_text', text: 'Open in Calendar', emoji: true },
					url: event.htmlLink,
				},
			],
		});
	}

	try {
		await integrations.slack.chat.postMessage({
			channel: channel || 'me', // DM if no channel specified
			text: `Meeting prep: ${event.summary}`,
			blocks,
		});
		return true;
	} catch {
		return false;
	}
}

export const metadata = {
	id: 'calendar-meeting-prep',
	category: 'productivity',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};

/**
 * Meeting Intelligence (Quick Start)
 *
 * Meetings that document themselves in Notion.
 * Start immediately - no app approvals, no waiting.
 *
 * ## Outcome
 *
 * After every meeting:
 * - AI summary with key decisions
 * - Action items extracted automatically
 * - Full transcript preserved
 * - Searchable in your Notion workspace
 *
 * ## Setup (30 seconds)
 *
 * 1. Connect Notion
 * 2. Add the "Sync Zoom" bookmark to your browser
 * 3. Click it once while logged into Zoom
 *
 * That's it. Your meetings now document themselves.
 *
 * ## Philosophy
 *
 * "The tool should recede; the outcome should remain."
 * You think: "My meetings are documented"
 * Not: "I need to sync sessions and manage connections"
 */

import { defineWorkflow, cron } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// Schema for AI meeting analysis
const MeetingAnalysisSchema = {
	summary: 'string',
	decisions: 'string[]',
	actionItems: 'Array<{ task: string; assignee?: string; dueDate?: string }>',
	followUps: 'string[]',
	keyTopics: 'string[]',
	sentiment: "'positive' | 'neutral' | 'concerned'",
} as const;

// Infrastructure URL (hardcoded - not user-configurable)
const ZOOM_CONNECTION_URL = 'https://zoom-cookie-sync.half-dozen.workers.dev';

export default defineWorkflow({
	name: 'Meeting Intelligence (Quick Start)',
	description: 'Meetings that document themselves in Notion. Start in 30 seconds.',
	version: '1.1.0',

	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want your meetings to document themselves?',
			explanation:
				'After every Zoom meeting, a Notion page appears with the transcript, AI summary, and action items. Ready in 30 seconds.',
			outcome: 'Meetings that document themselves',
		},

		primaryPair: {
			from: 'zoom-quick',
			to: 'notion',
			workflowId: 'meeting-intelligence-private',
			outcome: 'Meetings documented automatically',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'meeting-intelligence-private',
				priority: 50,
			},
		],

		smartDefaults: {
			lookbackDays: { value: 1 },
			enableAI: { value: true },
			analysisDepth: { value: 'standard' },
		},

		essentialFields: ['notionDatabaseId'],

		zuhandenheit: {
			timeToValue: 0.5, // 30 seconds to first outcome
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.15,
		freeExecutions: 30,
		description: 'Per meeting documented',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	inputs: {
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Meeting Notes Database',
			required: true,
			description: 'Where your meeting notes will appear',
		},

		lookbackDays: {
			type: 'number',
			label: 'Days to Look Back',
			default: 1,
			description: 'How many days of meetings to include',
		},

		enableAI: {
			type: 'boolean',
			label: 'AI Analysis',
			default: true,
			description: 'Extract action items, decisions, and key topics',
		},

		analysisDepth: {
			type: 'select',
			label: 'Analysis Depth',
			options: ['brief', 'standard', 'detailed'],
			default: 'standard',
		},
	},

	// Daily cron trigger only (no webhooks without OAuth)
	trigger: cron({
		schedule: '0 7 * * *', // 7 AM UTC daily
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env, user }) {
		const results: Array<{
			meeting: { id: string; topic: string; date: string };
			notionPageUrl?: string;
			actionItemCount: number;
		}> = [];

		// Check Zoom connection status
		const connectionStatus = await checkZoomConnection(user.id);

		if (!connectionStatus.connected) {
			return {
				success: false,
				error: 'Your Zoom connection needs a quick refresh.',
				action: 'refresh_connection',
				actionLabel: 'Refresh Connection',
				actionUrl: `${ZOOM_CONNECTION_URL}/setup/${user.id}`,
				upgradeHint: 'Want to skip this step? Upgrade to the full Meeting Intelligence workflow with automatic OAuth.',
			};
		}

		// Fetch meetings
		const meetings = await fetchMeetings(user.id, inputs.lookbackDays || 1);

		if (!meetings.success || meetings.data.length === 0) {
			return {
				success: true,
				synced: 0,
				message: 'No meetings found in the specified time range',
				results: [],
			};
		}

		// Process each meeting
		for (const meeting of meetings.data) {
			// Skip if already documented (deduplication)
			const alreadyDocumented = await checkExistingPage(
				integrations.notion,
				inputs.notionDatabaseId,
				meeting.id
			);

			if (alreadyDocumented) {
				continue;
			}

			// Get transcript
			const transcript = await fetchTranscript(user.id, meeting.id, meeting.share_url);

			// AI Analysis (if enabled)
			let analysis: any = null;
			if (inputs.enableAI && transcript && transcript.length > 100) {
				analysis = await analyzeMeeting(
					transcript,
					meeting.topic,
					inputs.analysisDepth || 'standard',
					integrations,
					env
				);
			}

			// Create Notion page
			const notionPage = await createNotionMeetingPage({
				databaseId: inputs.notionDatabaseId,
				topic: meeting.topic,
				startTime: meeting.start_time,
				transcript,
				speakers: meeting.speakers || [],
				analysis,
				sourceId: meeting.id,
				sourceType: 'meeting',
				sourceUrl: meeting.share_url,
				integrations,
			});

			results.push({
				meeting: { id: meeting.id, topic: meeting.topic, date: meeting.start_time },
				notionPageUrl: notionPage?.url,
				actionItemCount: analysis?.actionItems?.length || 0,
			});
		}

		const totalActionItems = results.reduce((sum, r) => sum + r.actionItemCount, 0);

		return {
			success: true,
			synced: results.length,
			actionItems: totalActionItems,
			results,
		};
	},

	onError: async ({ error, inputs, user }) => {
		console.error(`Meeting Intelligence Private failed for user ${user.id}:`, error);
		// Could send email notification here if configured
	},
});

// ============================================================================
// ZOOM CONNECTION HELPERS
// ============================================================================

/**
 * Check if user's Zoom connection is active
 * (Uses outcome language - "connected" not "has cookies")
 */
async function checkZoomConnection(userId: string): Promise<{
	connected: boolean;
	refreshSoon?: boolean;
}> {
	try {
		const response = await fetch(`${ZOOM_CONNECTION_URL}/health/${userId}`);
		if (!response.ok) {
			return { connected: false };
		}
		const data = (await response.json()) as {
			hasCookies: boolean;
			expiresIn?: number;
		};
		return {
			connected: data.hasCookies,
			refreshSoon: data.expiresIn ? data.expiresIn < 3600000 : false,
		};
	} catch {
		return { connected: false };
	}
}

/**
 * Fetch user's meetings from Zoom
 */
async function fetchMeetings(
	userId: string,
	days: number
): Promise<{
	success: boolean;
	data: Array<{
		id: string;
		topic: string;
		start_time: string;
		duration: number;
		share_url?: string;
		speakers?: string[];
	}>;
}> {
	try {
		const response = await fetch(
			`${ZOOM_CONNECTION_URL}/scrape-meetings/${userId}?days=${days}`
		);
		if (!response.ok) {
			return { success: false, data: [] };
		}
		const data = await response.json();
		return { success: true, data: data.meetings || [] };
	} catch {
		return { success: false, data: [] };
	}
}

/**
 * Fetch transcript for a specific meeting
 */
async function fetchTranscript(
	userId: string,
	meetingId: string,
	shareUrl?: string
): Promise<string | null> {
	try {
		const response = await fetch(`${ZOOM_CONNECTION_URL}/scrape-transcript/${userId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ meetingId, shareUrl }),
		});
		if (!response.ok) {
			return null;
		}
		const data = (await response.json()) as { transcript?: string };
		return data.transcript || null;
	} catch {
		return null;
	}
}

/**
 * Check if a page already exists in Notion (deduplication)
 */
async function checkExistingPage(
	notion: any,
	databaseId: string,
	sourceId: string
): Promise<boolean> {
	try {
		const result = await notion.databases.query({
			database_id: databaseId,
			filter: {
				property: 'Source ID',
				rich_text: { equals: sourceId },
			},
			page_size: 1,
		});
		return result.success && result.data?.length > 0;
	} catch {
		return false;
	}
}

/**
 * Analyze meeting transcript with AI
 */
async function analyzeMeeting(
	transcript: string,
	topic: string,
	depth: string,
	integrations: any,
	env: any
) {
	const depthInstructions: Record<string, string> = {
		brief: 'Keep summary to 2-3 sentences. List only the most critical items.',
		standard: 'Provide thorough summary in 4-6 sentences. Include all notable items.',
		detailed: 'Comprehensive analysis with full context. Include all items discussed.',
	};

	try {
		const result = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a meeting analyst. Analyze the transcript and extract structured insights.

${depthInstructions[depth] || depthInstructions.standard}

Return ONLY valid JSON in this format:
{
  "summary": "Brief summary of the meeting",
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    {"task": "Task description", "assignee": "Person name or null"},
    {"task": "Another task", "assignee": null}
  ],
  "followUps": ["Follow-up item 1", "Follow-up item 2"],
  "keyTopics": ["Topic 1", "Topic 2"],
  "sentiment": "positive" | "neutral" | "concerned"
}`,
			prompt: `Meeting: ${topic}\n\nTranscript:\n${transcript.slice(0, 8000)}`,
			temperature: 0.3,
			max_tokens: 1000,
		});

		const responseText = result.data?.response || '{}';
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}
		return null;
	} catch (error) {
		console.error('AI analysis failed:', error);
		return null;
	}
}

/**
 * Create a Notion page with meeting data
 */
interface CreateNotionPageParams {
	databaseId: string;
	topic: string;
	startTime: string;
	transcript: string | null;
	speakers: string[];
	analysis: any;
	sourceId: string;
	sourceType: 'meeting' | 'clip';
	sourceUrl?: string;
	integrations: any;
}

async function createNotionMeetingPage(params: CreateNotionPageParams) {
	const {
		databaseId,
		topic,
		startTime,
		transcript,
		speakers,
		analysis,
		sourceId,
		sourceType,
		sourceUrl,
		integrations,
	} = params;

	// Build properties
	const properties: Record<string, any> = {
		Title: {
			title: [{ text: { content: topic } }],
		},
		Date: {
			date: { start: startTime.split('T')[0] },
		},
		Type: {
			select: { name: sourceType === 'meeting' ? 'Meeting' : 'Clip' },
		},
		'Source ID': {
			rich_text: [{ text: { content: sourceId } }],
		},
		Status: {
			select: { name: 'Synced' },
		},
		Source: {
			select: { name: 'Quick Start' },
		},
	};

	if (sourceUrl) {
		properties['Source URL'] = { url: sourceUrl };
	}

	if (analysis?.sentiment) {
		properties['Sentiment'] = { select: { name: analysis.sentiment } };
	}

	// Build content blocks
	const children: any[] = [];

	// Meeting info callout
	children.push({
		object: 'block',
		type: 'callout',
		callout: {
			rich_text: [
				{
					text: {
						content: `Meeting on ${new Date(startTime).toLocaleDateString()}${speakers.length > 0 ? ` • Speakers: ${speakers.join(', ')}` : ''}`,
					},
				},
			],
			icon: { emoji: '📅' },
			color: 'blue_background',
		},
	});

	// AI Summary
	if (analysis?.summary) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Summary' } }] },
		});
		children.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: analysis.summary } }] },
		});
	}

	// Decisions
	if (analysis?.decisions?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Decisions' } }] },
		});
		for (const decision of analysis.decisions) {
			children.push({
				object: 'block',
				type: 'numbered_list_item',
				numbered_list_item: { rich_text: [{ text: { content: decision } }] },
			});
		}
	}

	// Action Items
	if (analysis?.actionItems?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Action Items' } }] },
		});
		for (const item of analysis.actionItems) {
			const text = item.assignee ? `${item.task} (@${item.assignee})` : item.task;
			children.push({
				object: 'block',
				type: 'to_do',
				to_do: {
					rich_text: [{ text: { content: text } }],
					checked: false,
				},
			});
		}
	}

	// Follow-ups
	if (analysis?.followUps?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Follow-ups' } }] },
		});
		for (const followUp of analysis.followUps) {
			children.push({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: { rich_text: [{ text: { content: followUp } }] },
			});
		}
	}

	// Key Topics
	if (analysis?.keyTopics?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Key Topics' } }] },
		});
		for (const keyTopic of analysis.keyTopics) {
			children.push({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: { rich_text: [{ text: { content: keyTopic } }] },
			});
		}
	}

	// Full Transcript (in toggle)
	if (transcript) {
		children.push({
			object: 'block',
			type: 'divider',
			divider: {},
		});
		children.push({
			object: 'block',
			type: 'toggle',
			toggle: {
				rich_text: [{ text: { content: 'Full Transcript' } }],
				children: splitTranscriptIntoBlocks(transcript),
			},
		});
	}

	// Create page
	try {
		const result = await integrations.notion.pages.create({
			parent: { database_id: databaseId },
			properties,
			children,
		});
		return result.success ? { url: result.data?.url } : null;
	} catch (error) {
		console.error('Failed to create Notion page:', error);
		return null;
	}
}

/**
 * Split transcript into Notion-compatible blocks (max 1900 chars each)
 */
function splitTranscriptIntoBlocks(transcript: string): any[] {
	const blocks: any[] = [];
	const maxChars = 1900;

	const segments = transcript.split(/\n\n|\n(?=[A-Z][a-z]+:)/);
	let currentBlock = '';

	for (const segment of segments) {
		if (currentBlock.length + segment.length + 1 > maxChars) {
			if (currentBlock) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: currentBlock } }] },
				});
			}
			currentBlock = segment;
		} else {
			currentBlock = currentBlock ? `${currentBlock}\n${segment}` : segment;
		}
	}

	if (currentBlock) {
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: currentBlock } }] },
		});
	}

	return blocks.length > 0
		? blocks
		: [
				{
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: 'No transcript available' } }] },
				},
			];
}

export const metadata = {
	id: 'meeting-intelligence-private',
	category: 'productivity',
	featured: false,
	quickStart: true, // Indicates browser-based quick start version
	upgradeTarget: 'meeting-intelligence', // OAuth version for full automation
	stats: { rating: 0, users: 0, reviews: 0 },
};

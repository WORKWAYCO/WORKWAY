/**
 * Meeting Intelligence Private Workflow
 *
 * A Private Workflow that uses bookmarklet-synced cookies instead of Zoom OAuth.
 * This bypasses the need for Zoom OAuth app approval while providing full
 * transcript extraction with speaker attribution.
 *
 * ## Delivery Mechanism: Bookmarklet
 *
 * The bookmarklet approach embodies Zuhandenheit - zero installation, 5 seconds daily:
 *
 * 1. User visits /workflows/meeting-intelligence-private/setup
 * 2. Drags personalized bookmarklet to bookmarks bar (once)
 * 3. Daily: Login to Zoom → Click bookmark → Done (5 seconds)
 *
 * ## Architecture
 *
 * Unlike standard workflows that use OAuth, this workflow:
 * - Uses browser cookies synced via bookmarklet
 * - Stores cookies per-user in Durable Objects (24-hour TTL)
 * - Scrapes Zoom using Cloudflare Browser Rendering API
 * - Still uses Notion OAuth for page creation
 *
 * ## Philosophy
 *
 * "The tool should recede; the outcome should remain."
 * User thinks: "My meetings are documented in Notion"
 * Not: "I need to manage cookies and OAuth tokens"
 *
 * @example Setup (once)
 * ```
 * 1. Connect Notion in WORKWAY
 * 2. Visit /workflows/meeting-intelligence-private/setup
 * 3. Drag bookmarklet to browser
 * 4. Login to Zoom, click bookmarklet
 * ```
 *
 * @example Daily (5 seconds)
 * ```
 * 1. Login to Zoom (if session expired)
 * 2. Click bookmarklet
 * 3. Continue with your day
 * ```
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

export default defineWorkflow({
	name: 'Meeting Intelligence (Private)',
	description:
		'Sync Zoom meetings to Notion using bookmarklet authentication. No OAuth app required.',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want meeting notes in Notion without OAuth complexity?',
			explanation:
				"After Zoom meetings, we'll create a Notion page with transcript and AI summary. Uses a simple bookmarklet for authentication - no Zoom app approval needed.",
			outcome: 'Meeting notes in Notion (via bookmarklet)',
		},

		primaryPair: {
			from: 'zoom-cookies',
			to: 'notion',
			workflowId: 'meeting-intelligence-private',
			outcome: 'Zoom meetings documented automatically (bookmarklet auth)',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'meeting-intelligence-private',
				priority: 50, // Lower priority than OAuth-based workflow
			},
		],

		// Smart defaults - infer from context, don't ask
		smartDefaults: {
			lookbackDays: { value: 1 },
			enableAI: { value: true },
			analysisDepth: { value: 'standard' },
		},

		// Only the Notion database is required
		essentialFields: ['notionDatabaseId'],

		zuhandenheit: {
			timeToValue: 5, // Minutes to first outcome (includes bookmarklet setup)
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true, // Daily cron
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.15, // Slightly cheaper than OAuth version (no OAuth overhead)
		freeExecutions: 30,
		description: 'Per meeting synced (includes transcription + AI analysis)',
	},

	// Note: No Zoom OAuth integration - uses cookies via bookmarklet
	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	inputs: {
		// Core configuration
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Meeting Notes Database',
			required: true,
			description: 'Where to store meeting notes',
		},

		// Sync settings
		lookbackDays: {
			type: 'number',
			label: 'Days to Look Back',
			default: 1,
			description: 'How many days of meetings to sync',
		},

		// AI settings
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

		// Cookie sync worker URL (internal - set by system)
		cookieSyncWorkerUrl: {
			type: 'text',
			label: 'Cookie Sync Worker URL',
			default: 'https://zoom-cookie-sync.half-dozen.workers.dev',
			description: 'Internal: Cloudflare Worker for cookie-based Zoom access',
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

		// 1. Check if user has valid cookies
		const cookieStatus = await checkCookieHealth(inputs.cookieSyncWorkerUrl, user.id);

		if (!cookieStatus.hasCookies) {
			return {
				success: false,
				error: 'No valid Zoom cookies found. Please use the bookmarklet to sync your Zoom session.',
				needsBookmarkletSync: true,
				setupUrl: `/workflows/meeting-intelligence-private/setup`,
			};
		}

		if (cookieStatus.expiresIn < 3600000) {
			// Less than 1 hour remaining
			console.log(
				`Warning: Cookies expire in ${Math.round(cookieStatus.expiresIn / 60000)} minutes`
			);
		}

		// 2. Fetch meetings using browser scraper with user's cookies
		const meetings = await fetchMeetingsWithCookies(
			inputs.cookieSyncWorkerUrl,
			user.id,
			inputs.lookbackDays || 1
		);

		if (!meetings.success || meetings.data.length === 0) {
			return {
				success: true,
				synced: 0,
				message: 'No meetings found in the specified time range',
				results: [],
			};
		}

		// 3. Process each meeting
		for (const meeting of meetings.data) {
			// Check if already synced (deduplication)
			const existingPage = await checkExistingPage(
				integrations.notion,
				inputs.notionDatabaseId,
				meeting.id
			);

			if (existingPage) {
				continue;
			}

			// Get transcript
			const transcript = await fetchTranscriptWithCookies(
				inputs.cookieSyncWorkerUrl,
				user.id,
				meeting.id,
				meeting.share_url
			);

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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check cookie health for a user
 */
async function checkCookieHealth(
	workerUrl: string,
	userId: string
): Promise<{
	hasCookies: boolean;
	age?: number;
	expiresIn?: number;
}> {
	try {
		const response = await fetch(`${workerUrl}/health/${userId}`);
		if (!response.ok) {
			return { hasCookies: false };
		}
		const data = (await response.json()) as {
			hasCookies: boolean;
			age?: number;
			expiresIn?: number;
		};
		return data;
	} catch {
		return { hasCookies: false };
	}
}

/**
 * Fetch meetings using cookies-based browser scraping
 */
async function fetchMeetingsWithCookies(
	workerUrl: string,
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
	error?: string;
}> {
	try {
		const response = await fetch(`${workerUrl}/scrape-meetings/${userId}?days=${days}`);
		if (!response.ok) {
			const error = await response.text();
			return { success: false, data: [], error };
		}
		const data = await response.json();
		return { success: true, data: data.meetings || [] };
	} catch (error: any) {
		return { success: false, data: [], error: error.message };
	}
}

/**
 * Fetch transcript using cookies-based browser scraping
 */
async function fetchTranscriptWithCookies(
	workerUrl: string,
	userId: string,
	meetingId: string,
	shareUrl?: string
): Promise<string | null> {
	try {
		const response = await fetch(`${workerUrl}/scrape-transcript/${userId}`, {
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
			select: { name: 'Private Workflow (Bookmarklet)' },
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
	featured: false, // Not featured - prefer OAuth version when available
	private: true, // Indicates this uses private/bookmarklet auth
	stats: { rating: 0, users: 0, reviews: 0 },
};

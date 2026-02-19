/**
 * Meeting Intelligence - Private (Half Dozen Internal)
 *
 * Organization-specific workflow for @halfdozen.co team.
 * Uses browser-based transcript extraction via meetings.workway.co.
 *
 * ## Architecture
 *
 * - Transcript source: meetings.workway.co (Cloudflare Puppeteer)
 * - Storage: Half Dozen's central Notion database
 * - Auth: Chrome extension syncs Zoom cookies (auto-refreshes every 6 hours)
 *
 * ## Capabilities
 *
 * - Zoom Meetings: AI Companion transcripts with speaker attribution
 * - Zoom Clips: Full transcript extraction via virtual scroll
 * - Deduplication: Two-tier (Source URL primary, Source ID fallback)
 * - AI Analysis: Summary, decisions, action items, follow-ups
 *
 * ## vs. meeting-intelligence (Public)
 *
 * | Feature | Private | Public |
 * |---------|---------|--------|
 * | Transcript source | Browser scraper | Zoom OAuth API |
 * | Speaker attribution | Full | Limited |
 * | Clips support | Yes | OAuth-dependent |
 * | Configuration | Hardcoded | User-configurable |
 *
 * @see /packages/workflows/src/meeting-intelligence - Public marketplace version
 * @see /apps/zoom-clips - Browser scraper infrastructure
 * @private For @halfdozen.co team only
 */

import { defineWorkflow, cron, manual } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';
import { analyzeMeeting, splitTranscriptIntoBlocks } from '../meeting-intelligence/utils.js';

// ============================================================================
// HALF DOZEN INTERNAL CONSTANTS
// These are organization-specific. Do NOT use this workflow as a template.
// ============================================================================

/** Infrastructure URL - Half Dozen's zoom-cookie-sync worker */
const ZOOM_CONNECTION_URL = 'https://meetings.workway.co';

/**
 * Half Dozen's central LLM database in Notion
 * All meeting intelligence data for @halfdozen.co goes here.
 * This is intentionally NOT configurable - it's internal infrastructure.
 */
const HALFDOZEN_INTERNAL_LLM_DATABASE = '27a019187ac580b797fec563c98afbbc';

// Cache for database schema (avoid repeated API calls)
let cachedTitleProperty: string | null = null;

// Track workflow execution for dashboard visibility
// This POSTs to the same zoom-cookie-sync worker that stores the user's session
async function trackExecution(
	zoomUserId: string,
	apiSecret: string,
	data: {
		status: 'running' | 'success' | 'failed';
		meetingsSynced?: number;
		clipsSynced?: number;
		actionItemsFound?: number;
		resultSummary?: string;
		errorMessage?: string;
		startedAt?: string;
		completedAt?: string;
		executionTimeMs?: number;
	}
) {
	try {
		await fetch(`${ZOOM_CONNECTION_URL}/executions/${zoomUserId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiSecret}`,
			},
			body: JSON.stringify({
				workflow_id: 'meeting-intelligence-private',
				trigger_type: 'schedule',
				status: data.status,
				meetings_synced: data.meetingsSynced || 0,
				clips_synced: data.clipsSynced || 0,
				action_items_found: data.actionItemsFound || 0,
				result_summary: data.resultSummary,
				error_message: data.errorMessage,
				started_at: data.startedAt,
				completed_at: data.completedAt,
				execution_time_ms: data.executionTimeMs,
			}),
		});
	} catch (error) {
		// Don't fail the workflow if tracking fails
		console.error('[Workflow] Failed to track execution:', error);
	}
}

export default defineWorkflow({
	name: 'Meeting Intelligence (Half Dozen Internal)',
	description: 'Internal workflow for @halfdozen.co. Meetings sync to central database via browser scraping. Requires daily bookmarklet refresh.',
	version: '3.5.0',

	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want your meetings and clips to document themselves?',
			explanation:
				'After every Zoom meeting or clip, a Notion page appears with the transcript, AI summary, and action items. Requires daily bookmarklet refresh (24-hour session expiration).',
			outcome: 'Meetings and clips that document themselves (with daily maintenance)',
		},

		primaryPair: {
			from: 'zoom-browser',
			to: 'notion',
			workflowId: 'meeting-intelligence-private',
			outcome: 'Meetings documented (requires daily refresh)',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'meeting-intelligence-private',
				priority: 25, // Lower than OAuth version (priority 50)
			},
		],

		smartDefaults: {
			lookbackDays: { value: 1 },
			enableAI: { value: true },
			analysisDepth: { value: 'standard' },
		},

		essentialFields: ['zoom_connection_id'],

		zuhandenheit: {
			timeToValue: 5, // Minutes, not seconds - be honest
			worksOutOfBox: false, // Requires bookmarklet setup
			gracefulDegradation: true,
			automaticTrigger: false, // Requires manual session refresh
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

	config: {
		zoom_connection_id: {
			type: 'string',
			label: 'Zoom Connection ID',
			required: true,
			description: 'Your unique identifier for the Zoom cookie sync (set during setup)',
		},

		// Database is hardcoded to Internal LLM for @halfdozen.co users
		// notionDatabaseId removed - all data goes to central hub

		lookback_days: {
			type: 'number',
			label: 'Days to Look Back',
			default: 1,
			description: 'How many days of meetings to include',
		},

		enable_a_i: {
			type: 'boolean',
			label: 'AI Analysis',
			default: true,
			description: 'Extract action items, decisions, and key topics',
		},

		analysis_depth: {
			type: 'select',
			label: 'Analysis Depth',
			options: ['brief', 'standard', 'detailed'],
			default: 'standard',
		},
	},

	// Dual triggers: Daily cron + manual trigger from extension
	trigger: cron({
		schedule: '0 7 * * *', // 7 AM UTC daily
		timezone: 'UTC',
	}),

	// Support manual trigger from browser extension
	webhooks: [
		manual({ description: 'Manual sync triggered from browser extension' })
	],

	async execute({ trigger, inputs, integrations, env }) {
		const startTime = Date.now();
		const startedAt = new Date().toISOString();

		const meetingResults: Array<{
			item: { id: string; title: string; date: string; type: 'meeting' | 'clip' };
			notionPageUrl?: string;
			actionItemCount: number;
		}> = [];

		const clipResults: Array<{
			item: { id: string; title: string; date: string; type: 'meeting' | 'clip' };
			notionPageUrl?: string;
			actionItemCount: number;
		}> = [];

		const failedNotionWrites: Array<{
			item: { id: string; title: string; type: 'meeting' | 'clip' };
			sourceUrl?: string;
		}> = [];

		// Determine if data was pre-fetched (manual trigger) or needs fetching (cron)
		const isManualTrigger = trigger.type === 'manual';
		const preFetchedData = isManualTrigger ? (trigger as any).data : null;

		// Get user identifier (from inputs - set during setup)
		const userId = inputs.zoomConnectionId;
		const apiSecret = (env as any).ZOOM_API_SECRET || '';

		if (!userId) {
			return {
				success: false,
				error: 'Missing Zoom connection ID. Please complete setup.',
				action: 'setup_required',
				actionLabel: 'Complete Setup',
				actionUrl: `${ZOOM_CONNECTION_URL}/setup`,
			};
		}

		// Track execution start
		await trackExecution(userId, apiSecret, {
			status: 'running',
			startedAt,
		});

		// Skip connection check if data already fetched
		if (!isManualTrigger) {
			// Check Zoom connection status
			const connectionStatus = await checkZoomConnection(userId);

			if (!connectionStatus.connected) {
				// Track failed execution (connection expired)
				await trackExecution(userId, apiSecret, {
					status: 'failed',
					startedAt,
					completedAt: new Date().toISOString(),
					executionTimeMs: Date.now() - startTime,
					errorMessage: 'Zoom session expired',
				});

				return {
					success: false,
					error: 'Zoom session expired. Please refresh your connection.',
					action: 'refresh_connection',
					actionLabel: 'Refresh Connection',
					actionUrl: `${ZOOM_CONNECTION_URL}/setup/${userId}`,
					upgradeHint:
						'Want automatic sync without manual refresh? Use the Meeting Intelligence workflow with Zoom OAuth.',
					upgradeWorkflowId: 'meeting-intelligence',
				};
			}
		}

		// ========================================================================
		// PROCESS MEETINGS
		// ========================================================================
		// Use pre-fetched data if available (manual trigger), otherwise fetch fresh (cron)
		const meetings = preFetchedData?.meetings
			? { success: true, data: preFetchedData.meetings }
			: await fetchMeetings(userId, inputs.lookbackDays || 1);

		if (meetings.success && meetings.data.length > 0) {
			for (const meeting of meetings.data) {
				// Skip if already documented (deduplication)
				const alreadyDocumented = await checkExistingPage(
					integrations.notion,
					HALFDOZEN_INTERNAL_LLM_DATABASE,
					meeting.id,
					meeting.share_url
				);

				if (alreadyDocumented) {
					continue;
				}

				// Get transcript
				const transcript = await fetchTranscript(userId, meeting.id, meeting.share_url);

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
					databaseId: HALFDOZEN_INTERNAL_LLM_DATABASE,
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

				if (!notionPage?.url) {
					failedNotionWrites.push({
						item: { id: meeting.id, title: meeting.topic, type: 'meeting' },
						sourceUrl: meeting.share_url,
					});
					continue;
				}

				meetingResults.push({
					item: { id: meeting.id, title: meeting.topic, date: meeting.start_time, type: 'meeting' },
					notionPageUrl: notionPage.url,
					actionItemCount: analysis?.actionItems?.length || 0,
				});
			}
		}

		// ========================================================================
		// PROCESS CLIPS
		// ========================================================================
		// Use pre-fetched data if available (manual trigger), otherwise fetch fresh (cron)
		const clips = preFetchedData?.clips
			? { success: true, data: preFetchedData.clips }
			: await fetchClips(userId, inputs.lookbackDays || 7);

		if (clips.success && clips.data.length > 0) {
			for (const clip of clips.data) {
				// Skip if already documented (deduplication by share_url)
				const alreadyDocumented = await checkExistingPageByUrl(
					integrations.notion,
					HALFDOZEN_INTERNAL_LLM_DATABASE,
					clip.share_url
				);

				if (alreadyDocumented) {
					continue;
				}

				// Get clip transcript
				const transcript = await fetchClipTranscript(userId, clip.id, clip.share_url);

				// AI Analysis (if enabled)
				let analysis: any = null;
				if (inputs.enableAI && transcript && transcript.length > 100) {
					analysis = await analyzeMeeting(
						transcript,
						clip.title,
						inputs.analysisDepth || 'standard',
						integrations,
						env
					);
				}

				// Create Notion page for clip
				const notionPage = await createNotionMeetingPage({
					databaseId: HALFDOZEN_INTERNAL_LLM_DATABASE,
					topic: clip.title,
					startTime: clip.created_at,
					transcript,
					speakers: [],
					analysis,
					sourceId: clip.id,
					sourceType: 'clip',
					sourceUrl: clip.share_url,
					integrations,
				});

				if (!notionPage?.url) {
					failedNotionWrites.push({
						item: { id: clip.id, title: clip.title, type: 'clip' },
						sourceUrl: clip.share_url,
					});
					continue;
				}

				clipResults.push({
					item: { id: clip.id, title: clip.title, date: clip.created_at, type: 'clip' },
					notionPageUrl: notionPage.url,
					actionItemCount: analysis?.actionItems?.length || 0,
				});
			}
		}

		// Combine results
		const allResults = [...meetingResults, ...clipResults];
		const totalActionItems = allResults.reduce((sum, r) => sum + r.actionItemCount, 0);

		if (failedNotionWrites.length > 0) {
			const failedSample = failedNotionWrites
				.slice(0, 3)
				.map((item) => item.sourceUrl || item.item.id)
				.join(', ');
			const failureSummary = `Failed to write ${failedNotionWrites.length} items to Notion`;

			await trackExecution(userId, apiSecret, {
				status: 'failed',
				meetingsSynced: meetingResults.length,
				clipsSynced: clipResults.length,
				actionItemsFound: totalActionItems,
				resultSummary: failureSummary,
				startedAt,
				completedAt: new Date().toISOString(),
				executionTimeMs: Date.now() - startTime,
				errorMessage: `Notion write failures: ${failedSample}`,
			});

			return {
				success: false,
				error: failureSummary,
				synced: allResults.length,
				meetings: meetingResults.length,
				clips: clipResults.length,
				actionItems: totalActionItems,
				failedNotionWrites,
				results: allResults,
				analyticsUrl: 'https://workway.co/workflows/private/meeting-intelligence-private/analytics',
			};
		}

		// Track successful execution
		await trackExecution(userId, apiSecret, {
			status: 'success',
			meetingsSynced: meetingResults.length,
			clipsSynced: clipResults.length,
			actionItemsFound: totalActionItems,
			resultSummary: `Synced ${meetingResults.length} meetings, ${clipResults.length} clips`,
			startedAt,
			completedAt: new Date().toISOString(),
			executionTimeMs: Date.now() - startTime,
		});

		return {
			success: true,
			synced: allResults.length,
			meetings: meetingResults.length,
			clips: clipResults.length,
			actionItems: totalActionItems,
			results: allResults,
			analyticsUrl: 'https://workway.co/workflows/private/meeting-intelligence-private/analytics',
		};
	},

	onError: async ({ error, inputs }) => {
		const userId = inputs.zoomConnectionId || 'unknown';
		console.error(`Meeting Intelligence Workaround failed for user ${userId}:`, error);

		// Note: We can't track failed executions in onError because env is not available.
		// The execute function already tracks failures when they occur.
	},
});

// ============================================================================
// ZOOM CONNECTION HELPERS
// ============================================================================

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
			`${ZOOM_CONNECTION_URL}/meetings/${userId}?days=${days}`
		);
		if (!response.ok) {
			return { success: false, data: [] };
		}
		const data = (await response.json()) as { meetings?: Array<any> };
		return { success: true, data: data.meetings || [] };
	} catch {
		return { success: false, data: [] };
	}
}

async function fetchTranscript(
	userId: string,
	meetingId: string,
	shareUrl?: string
): Promise<string | null> {
	try {
		const response = await fetch(`${ZOOM_CONNECTION_URL}/transcript/${userId}`, {
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

// ============================================================================
// CLIPS HELPERS
// ============================================================================

async function fetchClips(
	userId: string,
	days: number
): Promise<{
	success: boolean;
	data: Array<{
		id: string;
		title: string;
		created_at: string;
		duration: number;
		share_url: string;
		thumbnail_url?: string;
	}>;
}> {
	try {
		const response = await fetch(
			`${ZOOM_CONNECTION_URL}/clips/${userId}?days=${days}`
		);
		if (!response.ok) {
			return { success: false, data: [] };
		}
		const data = (await response.json()) as { clips?: Array<any> };
		return { success: true, data: data.clips || [] };
	} catch {
		return { success: false, data: [] };
	}
}

async function fetchClipTranscript(
	userId: string,
	clipId: string,
	shareUrl?: string
): Promise<string | null> {
	try {
		const response = await fetch(`${ZOOM_CONNECTION_URL}/clip-transcript/${userId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ clipId, shareUrl }),
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

async function checkExistingPageByUrl(
	notion: any,
	databaseId: string,
	sourceUrl: string
): Promise<boolean> {
	try {
		const result = await notion.databases.query({
			database_id: databaseId,
			filter: {
				property: 'Source URL',
				url: { equals: sourceUrl },
			},
			page_size: 1,
		});
		return result.success && result.data?.length > 0;
	} catch {
		return false;
	}
}

async function checkExistingPage(
	notion: any,
	databaseId: string,
	sourceId: string,
	sourceUrl?: string
): Promise<boolean> {
	// Try URL-based deduplication first (most reliable)
	if (sourceUrl) {
		return checkExistingPageByUrl(notion, databaseId, sourceUrl);
	}
	// Fallback: check by Source ID if URL not available
	// The worker generates deterministic IDs from topic+date
	if (sourceId) {
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
			// Property might not exist - that's ok, continue without deduplication
			return false;
		}
	}
	return false;
}

// analyzeMeeting is now imported from ../meeting-intelligence/utils.js

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

	// Dynamically detect title property from database schema (like original workflow)
	let titleProperty = cachedTitleProperty;

	if (!titleProperty) {
		try {
			const dbResult = await integrations.notion.getDatabase(databaseId);
			if (dbResult.success && dbResult.data?.properties) {
				// Find the property with type 'title' (every database has exactly one)
				for (const [propName, propConfig] of Object.entries(dbResult.data.properties)) {
					if ((propConfig as any).type === 'title') {
						titleProperty = propName;
						cachedTitleProperty = propName;
						console.log(`[Workflow] Detected title property: "${titleProperty}"`);
						break;
					}
				}
			}
		} catch (error) {
			console.error('[Workflow] Failed to fetch database schema:', error);
		}

		// Fallback if detection fails
		if (!titleProperty) {
			titleProperty = 'Item'; // Known title property for Internal LLM database
			console.log(`[Workflow] Using fallback title property: "${titleProperty}"`);
		}
	}

	// Build properties dynamically based on detected schema
	const properties: Record<string, any> = {
		[titleProperty]: {
			title: [{ text: { content: topic } }],
		},
		Date: {
			date: { start: startTime.split('T')[0] },
		},
		Type: {
			select: { name: sourceType === 'meeting' ? 'Meeting' : 'Clip' },
		},
		Status: {
			select: { name: 'Active' },
		},
		Source: {
			select: { name: 'Internal' },
		},
	};

	if (sourceUrl) {
		properties['Source URL'] = { url: sourceUrl };
	}

	// Always add Source ID for deduplication (even without URL)
	if (sourceId) {
		properties['Source ID'] = {
			rich_text: [{ text: { content: sourceId } }],
		};
	}

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

	try {
		const result = await integrations.notion.pages.create({
			parent: { database_id: databaseId },
			properties,
			children,
		});

		if (!result.success) {
			console.error('Failed to create Notion page:', {
				topic,
				sourceId,
				sourceType,
				sourceUrl,
				error: result.error || 'unknown error',
			});
			return null;
		}

		if (!result.data?.url) {
			console.error('Failed to create Notion page: missing URL in response', {
				topic,
				sourceId,
				sourceType,
				sourceUrl,
			});
			return null;
		}

		return { url: result.data.url };
	} catch (error) {
		console.error('Failed to create Notion page:', error);
		return null;
	}
}

// splitTranscriptIntoBlocks is now imported from ../meeting-intelligence/utils.js

/**
 * Workflow metadata - Private workflow for @halfdozen.co
 */
export const metadata = {
	id: 'meeting-intelligence-private',
	category: 'productivity',
	featured: false,

	// Private workflow - requires WORKWAY login
	visibility: 'private' as const,
	accessGrants: [
		{ type: 'email_domain' as const, value: 'halfdozen.co' },
	],

	// Honest flags
	experimental: true,
	requiresCustomInfrastructure: true,
	canonicalAlternative: 'meeting-intelligence',

	// Why this exists
	workaroundReason: 'Zoom OAuth API does not provide transcript access',
	infrastructureRequired: ['zoom-cookie-sync worker', 'Durable Objects', 'Puppeteer'],

	// Upgrade path
	upgradeTarget: 'meeting-intelligence',
	upgradeCondition: 'When Zoom OAuth provides transcript access',

	// Analytics URL - unified at workway.co/workflows
	// Private workflow analytics are accessible at /workflows/private/{workflow-id}/analytics
	analyticsUrl: 'https://workway.co/workflows/private/meeting-intelligence-private/analytics',

	// Setup URL - initial connection setup
	setupUrl: `${ZOOM_CONNECTION_URL}/setup`,

	stats: { rating: 0, users: 0, reviews: 0 },
};

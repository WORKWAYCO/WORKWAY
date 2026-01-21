/**
 * YouTube Playlist to Notion Sync - Private (Half Dozen Internal)
 *
 * Organization-specific workflow for @halfdozen.co team.
 * Syncs YouTube playlist videos to the team's Notion database with transcripts.
 *
 * ## Architecture
 *
 * - Video source: YouTube Data API v3 (via BYOO OAuth)
 * - Transcript source: youtube-transcript (scraping public captions)
 * - Storage: Half Dozen's central Notion database
 * - Auth: BYOO (Bring Your Own OAuth) - organization's Google Cloud app
 *
 * ## Capabilities
 *
 * - Playlist Monitoring: Polls for new videos on configurable schedule
 * - Video Metadata: Title, channel, duration, views, thumbnail
 * - Transcripts: Auto-fetched with graceful degradation if unavailable
 * - Notion Integration: Creates rich pages with embedded video + transcript
 * - Deduplication: Tracks processed videos by ID in KV storage
 *
 * ## vs. youtube-playlist-sync (Public)
 *
 * | Feature | Private | Public |
 * |---------|---------|--------|
 * | OAuth | BYOO (org app) | WORKWAY verified app |
 * | Database | Team-configurable | User-configurable |
 * | Verification | Not required | Google verification required |
 * | Access | @halfdozen.co only | Anyone |
 *
 * ## Why BYOO?
 *
 * YouTube OAuth scopes require Google app verification for public apps.
 * Using BYOO with the organization's own Google Cloud app allows
 * unverified apps for internal organizational use.
 *
 * ## Notion Schema (Videos Database)
 *
 * Required properties:
 * - Name (title): Video title
 * - URL (url): YouTube video URL
 * - Channel (rich_text): Channel name
 * - Published (date): Video publish date
 * - Video ID (rich_text): YouTube video ID for deduplication
 *
 * @see /packages/workflows/src/youtube-playlist-sync - Public version
 * @see /packages/workflows/src/private-emails-documented - Pattern reference
 * @private For @halfdozen.co team only
 */

import { defineWorkflow, cron } from '@workwayco/sdk';
import { extractPlaylistId } from '@workwayco/integrations';
import {
	NOTION_BLOCK_CHAR_LIMIT,
	NOTION_BLOCKS_PER_REQUEST,
	type PlaylistSyncState,
	type VideoData,
	type TranscriptData,
	getPollIntervalMs,
	formatDuration,
	splitTextIntoBlocks,
	checkVideoExistsInNotion,
	appendBlocksInBatches,
	createNotionVideoPage,
} from '../youtube-playlist-sync/utils.js';

// ============================================================================
// ORGANIZATION CONFIGURATION
// ============================================================================

/**
 * Get organization-specific configuration from workflow context.
 * Falls back to environment variables if available.
 */
function getOrgConfig(config?: Record<string, unknown>) {
	return {
		/** Notion database ID for video entries */
		videosDatabase:
			(config?.notionVideosDatabase as string) ||
			(typeof process !== 'undefined' ? process.env.NOTION_VIDEOS_DATABASE : undefined) ||
			'', // Must be configured per-organization

		/** YouTube playlist ID to monitor */
		playlistId:
			(config?.youtubePlaylistId as string) ||
			(typeof process !== 'undefined' ? process.env.YOUTUBE_PLAYLIST_ID : undefined) ||
			'',

		/** Poll frequency: '15min' | 'hourly' | 'daily' */
		pollFrequency: (config?.pollFrequency as string) || 'hourly',

		/** Whether to fetch and include transcripts */
		includeTranscripts: (config?.includeTranscripts as boolean) ?? true,

		/** Preferred transcript language */
		transcriptLanguage: (config?.transcriptLanguage as string) || 'en',

		/** YouTube connection URL for BYOO setup */
		connectionUrl:
			(config?.connectionUrl as string) ||
			(typeof process !== 'undefined' ? process.env.YOUTUBE_CONNECTION_URL : undefined) ||
			'https://api.workway.co',
	};
}

// ============================================================================
// CONSTANTS (shared types imported from ../youtube-playlist-sync/utils.js)
// ============================================================================

/** State key prefix for KV storage (unique for private version) */
const STATE_KEY_PREFIX = 'youtube-playlist-sync-private:';

// Types (VideoData, TranscriptData, PlaylistSyncState) imported from ../youtube-playlist-sync/utils.js

// ============================================================================
// EXECUTION TRACKING (matches private-emails-documented pattern)
// ============================================================================

/**
 * Track workflow execution for dashboard visibility
 */
async function trackExecution(
	userId: string,
	apiSecret: string,
	connectionUrl: string,
	data: {
		status: 'running' | 'success' | 'failed';
		videosSynced?: number;
		resultSummary?: string;
		errorMessage?: string;
		startedAt?: string;
		completedAt?: string;
		executionTimeMs?: number;
	}
) {
	try {
		await fetch(`${connectionUrl}/executions/${userId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Secret': apiSecret,
			},
			body: JSON.stringify({
				workflowId: 'youtube-playlist-sync-private',
				...data,
			}),
		});
	} catch (error) {
		console.error('Failed to track execution:', error);
	}
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'YouTube to Notion (Private)',
	description: 'Your YouTube research, documented automatically. Add a video to your playlist—the title, description, and full transcript appear in Notion. Internal version with BYOO.',
	version: '1.0.0',

	// Pathway metadata for discovery (private workflows have limited discovery)
	pathway: {
		outcomeFrame: 'content_research',

		outcomeStatement: {
			suggestion: 'Want YouTube videos documented in Notion automatically?',
			explanation:
				"When you add videos to a YouTube playlist, we'll create Notion pages with video details and full transcripts.",
			outcome: 'YouTube research in Notion',
		},

		primaryPair: {
			from: 'youtube',
			to: 'notion',
			workflowId: 'youtube-playlist-sync-private',
			outcome: 'YouTube videos that document themselves',
		},

		// Private workflows have limited discovery (not in marketplace)
		discoveryMoments: [],

		smartDefaults: {
			pollFrequency: { value: 'hourly' },
			includeTranscript: { value: true },
			transcriptLanguage: { value: 'en' },
		},

		essentialFields: ['playlist_id', 'notion_database_id'],

		zuhandenheit: {
			timeToValue: 5, // Minutes to first outcome
			worksOutOfBox: true,
			gracefulDegradation: true, // Works without transcript if unavailable
			automaticTrigger: true, // Cron-triggered
		},

		walkthrough: {
			scenes: [
				{
					title: 'The Problem',
					text: "You're watching a video that explains exactly what you need. The perfect tutorial, the right interview, the answer you've been looking for. You think, 'I should save this.' Maybe you'll remember to come back to it. Except you won't. The video disappears into your watch history. The insight vanishes into your memory. Later, when you actually need it, you're scrolling, searching, trying to remember which video it was.",
				},
				{
					title: 'What YouTube to Notion Does',
					text: "This workflow turns your YouTube playlist into a research library. You add a video to your playlist. That's it. Three things happen automatically. First, the video appears in your Notion database. Title, channel, thumbnail—all captured. Second, the description is added. Links, timestamps, everything the creator included. Third, the full transcript gets pulled. Every word, searchable, ready for your notes. You didn't copy and paste. You didn't switch tabs. You didn't forget. The workflow captured it.",
				},
				{
					title: 'How It Looks',
					text: "Your Notion database fills up as you research. Each video is a page. The video embedded at the top, so you can rewatch without leaving Notion. Below that, the details. Channel name, duration, view count, publish date. And then the transcript. Searchable. Highlightable. Ready for the notes only you can add. The capture happened automatically. The thinking is still yours.",
				},
				{
					title: 'The Setup',
					text: "Setup takes two minutes. Connect your YouTube account. This gives the workflow permission to see your playlists. Then connect Notion. Pick the database where you want videos captured. If you don't have one, you can create it in seconds. Choose a playlist to watch. Any playlist works—a new one for research, or one you already use. That's it. Every video you add gets documented.",
				},
				{
					title: 'Close',
					text: "YouTube to Notion doesn't change how you watch videos. It captures what you watch. Add to playlist, documented in Notion, transcript included. The tool disappears. And your research builds itself.",
				},
			],
		},
	},

	// No pricing for private workflows - internal use
	pricing: {
		model: 'free',
		description: 'Internal workflow - no usage fees',
	},

	integrations: [
		{ service: 'youtube', scopes: ['youtube.readonly'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	config: {
		// YouTube Configuration
		playlist_id: {
			type: 'text',
			label: 'YouTube Playlist ID',
			required: true,
			description: 'The playlist to monitor (e.g., PLxxx or full URL)',
		},

		// Notion Configuration
		notion_database_id: {
			type: 'text',
			label: 'Notion Database ID',
			required: true,
			description: 'Where to store video entries',
		},

		// Polling settings
		poll_frequency: {
			type: 'select',
			label: 'Check Frequency',
			options: ['15min', 'hourly', 'daily'],
			default: 'hourly',
			description: 'How often to check for new videos',
		},

		// Transcript settings
		include_transcript: {
			type: 'boolean',
			label: 'Include Transcript',
			default: true,
			description: 'Add video transcript to Notion page',
		},
		transcript_language: {
			type: 'text',
			label: 'Transcript Language',
			default: 'en',
			description: 'Preferred language code (e.g., en, es, fr)',
		},

		// Notion property names (allow customization)
		notion_title_property: {
			type: 'text',
			label: 'Title Property Name',
			default: 'Name',
			description: 'Notion database property for video title',
		},
		notion_url_property: {
			type: 'text',
			label: 'URL Property Name',
			default: 'URL',
			description: 'Notion database property for video URL',
		},
		notion_channel_property: {
			type: 'text',
			label: 'Channel Property Name',
			default: 'Channel',
			description: 'Notion database property for channel name',
		},
		notion_date_property: {
			type: 'text',
			label: 'Date Property Name',
			default: 'Published',
			description: 'Notion database property for publish date',
		},

		// BYOO connection ID (for Half Dozen's YouTube OAuth)
		youtube_connection_id: {
			type: 'text',
			label: 'YouTube Connection ID',
			required: true,
			description: 'Your BYOO YouTube connection ID (from setup)',
		},
	},

	// Cron trigger - polls playlist for new videos
	trigger: cron({
		schedule: '0 * * * *', // Default: hourly
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env, installationId, userId }) {
		const startedAt = new Date().toISOString();
		const startTime = Date.now();

		const {
			playlist_id,
			notion_database_id,
			poll_frequency = 'hourly',
			include_transcript = true,
			transcript_language = 'en',
			notion_title_property = 'Name',
			notion_url_property = 'URL',
			notion_channel_property = 'Channel',
			notion_date_property = 'Published',
			youtube_connection_id,
		} = inputs;

		// Track execution start
		const apiSecret = env.WORKFLOW_API_SECRET || '';
		const connectionUrl = 'https://api.workway.co';

		if (youtube_connection_id && apiSecret) {
			await trackExecution(youtube_connection_id, apiSecret, connectionUrl, {
				status: 'running',
				startedAt,
			});
		}

		try {
			// Extract playlist ID from URL if needed
			const playlistId = extractPlaylistId(playlist_id);
			if (!playlistId) {
				throw new Error('Invalid playlist ID or URL');
			}

			// Load state from KV - use installation ID + playlist ID for user isolation
			// This ensures each user's sync state is independent
			const instanceId = installationId || userId || youtube_connection_id || 'default';
			const stateKey = `${STATE_KEY_PREFIX}${instanceId}:${playlistId}`;
			let state: PlaylistSyncState = (await env.KV?.get(stateKey, 'json')) || {
				playlistId,
				lastChecked: new Date(0).toISOString(),
				processedVideoIds: [],
			};

			// Check poll frequency - skip if not enough time has passed
			// The underlying cron runs hourly, but users can configure less frequent checks
			const pollIntervalMs = getPollIntervalMs(poll_frequency);
			const lastCheckedTime = new Date(state.lastChecked).getTime();
			const timeSinceLastCheck = Date.now() - lastCheckedTime;

			if (timeSinceLastCheck < pollIntervalMs) {
				const executionTimeMs = Date.now() - startTime;

				if (youtube_connection_id && apiSecret) {
					await trackExecution(youtube_connection_id, apiSecret, connectionUrl, {
						status: 'success',
						videosSynced: 0,
						resultSummary: `Skipped - next check in ${Math.ceil((pollIntervalMs - timeSinceLastCheck) / 60000)} minutes`,
						startedAt,
						completedAt: new Date().toISOString(),
						executionTimeMs,
					});
				}

				return {
					success: true,
					message: `Skipped - next check in ${Math.ceil((pollIntervalMs - timeSinceLastCheck) / 60000)} minutes`,
					videosProcessed: 0,
					skippedReason: 'poll_frequency',
				};
			}

			// Fetch ALL playlist items with pagination
			const allPlaylistItems: Array<{ videoId: string; title: string }> = [];
			let nextPageToken: string | undefined;

			do {
				const playlistResult = await integrations.youtube.getPlaylistItems({
					playlistId,
					maxResults: 50,
					pageToken: nextPageToken,
				});

				if (!playlistResult.success) {
					throw new Error(`Failed to fetch playlist: ${playlistResult.error?.message}`);
				}

				allPlaylistItems.push(...playlistResult.data.items);
				nextPageToken = playlistResult.data.nextPageToken;

				// Safety limit: don't process more than 500 videos in one run
				if (allPlaylistItems.length >= 500) {
					break;
				}
			} while (nextPageToken);

			// Find new videos (not in processedVideoIds)
			const newVideos = allPlaylistItems.filter(
				(item: any) => !state.processedVideoIds.includes(item.videoId)
			);

			if (newVideos.length === 0) {
				// Update last checked time
				state.lastChecked = new Date().toISOString();
				await env.KV?.put(stateKey, JSON.stringify(state));

				const executionTimeMs = Date.now() - startTime;

				if (youtube_connection_id && apiSecret) {
					await trackExecution(youtube_connection_id, apiSecret, connectionUrl, {
						status: 'success',
						videosSynced: 0,
						resultSummary: 'No new videos found',
						startedAt,
						completedAt: new Date().toISOString(),
						executionTimeMs,
					});
				}

				return {
					success: true,
					message: 'No new videos found',
					videosProcessed: 0,
				};
			}

			// Get full video details for new videos
			const videoIds = newVideos.map((v: any) => v.videoId);
			const videosResult = await integrations.youtube.getVideos({ videoIds });

			if (!videosResult.success) {
				throw new Error(`Failed to fetch video details: ${videosResult.error?.message}`);
			}

			// Process each new video
			const results: Array<{ videoId: string; notionUrl?: string; error?: string; skipped?: boolean }> = [];

			for (const video of videosResult.data) {
				try {
					// Fetch transcript if enabled
					let transcript: TranscriptData | null = null;
					if (include_transcript) {
						const transcriptResult = await integrations.youtube.getTranscript({
							videoId: video.id,
							language: transcript_language,
						});

						if (transcriptResult.success) {
							transcript = transcriptResult.data;
						}
						// Graceful degradation: continue without transcript if unavailable
					}

					// Create Notion page (includes duplicate check)
					const notionPage = await createNotionVideoPage({
						video: {
							id: video.id,
							title: video.title,
							description: video.description,
							publishedAt: video.publishedAt,
							channelTitle: video.channelTitle,
							thumbnailUrl: video.thumbnails?.high?.url,
							duration: video.duration,
							viewCount: video.viewCount,
						},
						transcript,
						databaseId: notion_database_id,
						propertyNames: {
							title: notion_title_property,
							url: notion_url_property,
							channel: notion_channel_property,
							date: notion_date_property,
						},
						integrations,
					});

					// Mark as processed (even if skipped due to duplicate)
					state.processedVideoIds.push(video.id);

					if (notionPage?.skipped) {
						results.push({
							videoId: video.id,
							skipped: true,
						});
					} else {
						results.push({
							videoId: video.id,
							notionUrl: notionPage?.url,
						});
					}
				} catch (error) {
					results.push({
						videoId: video.id,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
					// Continue processing other videos
				}
			}

			// Update state
			state.lastChecked = new Date().toISOString();

			// Prune old IDs (keep last 1000 to prevent unbounded growth)
			if (state.processedVideoIds.length > 1000) {
				state.processedVideoIds = state.processedVideoIds.slice(-1000);
			}

			await env.KV?.put(stateKey, JSON.stringify(state));

			const successCount = results.filter((r) => !r.error && !r.skipped).length;
			const skippedCount = results.filter((r) => r.skipped).length;
			const failCount = results.filter((r) => r.error).length;
			const executionTimeMs = Date.now() - startTime;

			let message = `Processed ${successCount} videos`;
			if (skippedCount > 0) message += `, ${skippedCount} already existed`;
			if (failCount > 0) message += `, ${failCount} failed`;

			// Track successful execution
			if (youtube_connection_id && apiSecret) {
				await trackExecution(youtube_connection_id, apiSecret, connectionUrl, {
					status: 'success',
					videosSynced: successCount,
					resultSummary: message,
					startedAt,
					completedAt: new Date().toISOString(),
					executionTimeMs,
				});
			}

			return {
				success: true,
				message,
				videosProcessed: successCount,
				videosSkipped: skippedCount,
				videosFailed: failCount,
				results,
			};
		} catch (error) {
			const executionTimeMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Track failed execution
			if (youtube_connection_id && apiSecret) {
				await trackExecution(youtube_connection_id, apiSecret, connectionUrl, {
					status: 'failed',
					errorMessage,
					startedAt,
					completedAt: new Date().toISOString(),
					executionTimeMs,
				});
			}

			return {
				success: false,
				error: errorMessage,
			};
		}
	},

	onError: async ({ error, inputs }) => {
		const connectionId = inputs.youtube_connection_id || 'unknown';
		console.error(`YouTube Playlist Sync failed for connection ${connectionId}:`, error);
	},
});

// ============================================================================
// METADATA
// ============================================================================

/**
 * Workflow metadata - Private workflow for @halfdozen.co
 */
export const metadata = {
	id: 'youtube-playlist-sync-private',
	category: 'content_research',
	featured: false,

	// Private workflow - requires WORKWAY login
	visibility: 'private' as const,
	accessGrants: [{ type: 'email_domain' as const, value: 'halfdozen.co' }],

	// BYOO configuration - links to Half Dozen developer profile
	// This enables credential resolution from developer_oauth_apps table
	developerId: 'dev_halfdozen',
	byooProvider: 'youtube',

	// Honest flags (matches private-emails-documented pattern)
	experimental: true,
	requiresCustomInfrastructure: true,
	canonicalAlternative: 'youtube-playlist-sync', // Public version

	// Why this exists
	workaroundReason: 'YouTube OAuth scopes require Google app verification for public apps',
	infrastructureRequired: ['BYOO Google OAuth app for YouTube'],

	// Upgrade path (when Google verification completes)
	upgradeTarget: 'youtube-playlist-sync',
	upgradeCondition: 'When WORKWAY YouTube OAuth app is verified',

	// Analytics URL - unified at workway.co/workflows
	analyticsUrl: 'https://workway.co/workflows/private/youtube-playlist-sync-private/analytics',

	// Setup URL - BYOO connection setup
	setupUrl: 'https://api.workway.co/oauth/youtube/authorize',

	stats: { rating: 0, users: 0, reviews: 0 },
};

// Helper functions are now imported from ../youtube-playlist-sync/utils.js

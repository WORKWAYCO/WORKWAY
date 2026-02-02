/**
 * YouTube Playlist to Notion Sync Workflow
 *
 * Monitors PUBLIC YouTube playlists and syncs video metadata + transcripts to Notion.
 * When a user adds a video to a playlist, the video details are added to a
 * Notion database and the transcript is added to the page content.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My YouTube research is automatically documented"
 *
 * ## Simplified Architecture (v3 - InnerTube)
 *
 * - NO YouTube OAuth required - works with public playlists only
 * - NO API key required - uses YouTube InnerTube (Android client)
 * - Playlist items: InnerTube browse endpoint
 * - Video metadata: InnerTube player endpoint
 * - Transcripts: InnerTube player + timedtext API
 * - Only Notion OAuth required for writing pages
 *
 * This makes setup much simpler - users just need to:
 * 1. Connect Notion
 * 2. Paste a public playlist URL
 * 3. Done!
 *
 * Trigger: Polling cron (configurable: 15min/hourly/daily)
 *
 * ## Technical Constraints
 * - Notion: 2000 chars per block (we use 1900 buffer)
 * - Notion: 100 blocks per API call (batched appends)
 * - YouTube Data API: Public data only (no private playlists)
 * - Transcripts: Only available if video has captions enabled
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
	findSplitPoint,
	splitTextIntoBlocks,
	checkVideoExistsInNotion,
	appendBlocksInBatches,
	createNotionVideoPage,
	// YouTube Data API functions (uses API key, no user OAuth required)
	fetchPlaylistItems,
	fetchVideoDetails,
	fetchTranscript,
} from './utils.js';

/** State key prefix for KV storage */
const STATE_KEY_PREFIX = 'youtube-playlist-sync:';

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'YouTube to Notion',
	description: 'Your YouTube research, documented automatically. Add a video to your playlist—the title, description, and full transcript appear in Notion.',
	version: '1.0.0',

	// Pathway metadata for discovery
	pathway: {
		outcomeFrame: 'content_research',

		outcomeStatement: {
			suggestion: 'Watch videos for research? Let them document themselves.',
			explanation:
				'Paste a public YouTube playlist URL. WORKWAY creates Notion pages with each video, transcript, and all the details—ready for your notes. No YouTube login required.',
			outcome: 'Research that captures itself',
		},

		primaryPair: {
			from: 'youtube',
			to: 'notion',
			workflowId: 'youtube-playlist-sync',
			outcome: 'Videos that document themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'youtube-playlist-sync',
				priority: 90,
			},
		],

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
					text: "Setup takes one minute. Connect Notion and pick a database where you want videos captured. If you don't have one, you can create it in seconds. Paste any public YouTube playlist URL. That's it—no YouTube login required. Every video you add to that playlist gets documented automatically.",
				},
				{
					title: 'Close',
					text: "YouTube to Notion doesn't change how you watch videos. It captures what you watch. Add to playlist, documented in Notion, transcript included. The tool disappears. And your research builds itself.",
				},
			],
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.05, // Light tier: API calls only
		freeExecutions: 100,
		description: 'Per video synced to Notion',
	},

	// Only Notion OAuth required - YouTube uses public API (no user auth needed)
	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	config: {
		// Core configuration
		playlist_id: {
			type: 'text',
			label: 'YouTube Playlist URL',
			required: true,
			description: 'Any public YouTube playlist URL (e.g., https://youtube.com/playlist?list=PLxxx)',
		},
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

		// Notion page settings
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
	},

	// Cron trigger - polls playlist for new videos
	trigger: cron({
		schedule: '0 * * * *', // Default: hourly
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env, installationId, userId }) {
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
		} = inputs;

		// Extract playlist ID from URL if needed
		const playlistId = extractPlaylistId(playlist_id);
		if (!playlistId) {
			return {
				success: false,
				error: 'Invalid playlist ID or URL. Please provide a valid public YouTube playlist URL.',
			};
		}

		// Load state from KV - use installation ID + playlist ID for user isolation
		// This ensures each user's sync state is independent
		const instanceId = installationId || userId || 'default';
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
			return {
				success: true,
				message: `Skipped - next check in ${Math.ceil((pollIntervalMs - timeSinceLastCheck) / 60000)} minutes`,
				videosProcessed: 0,
				skippedReason: 'poll_frequency',
			};
		}

		// Fetch playlist items via InnerTube (no API key required)
		const playlistResult = await fetchPlaylistItems(playlistId);

		if (!playlistResult.success || !playlistResult.items) {
			return {
				success: false,
				error: `Failed to fetch playlist: ${playlistResult.error}. Make sure the playlist is public.`,
			};
		}

		const allPlaylistItems = playlistResult.items;

		// Find new videos (not in processedVideoIds)
		const newVideos = allPlaylistItems.filter(
			(item) => !state.processedVideoIds.includes(item.videoId)
		);

		if (newVideos.length === 0) {
			// Update last checked time
			state.lastChecked = new Date().toISOString();
			await env.KV?.put(stateKey, JSON.stringify(state));

			return {
				success: true,
				message: 'No new videos found',
				videosProcessed: 0,
			};
		}

		// Process each new video
		const results: Array<{ videoId: string; notionUrl?: string; error?: string; skipped?: boolean }> = [];

		for (const item of newVideos) {
			try {
				// Fetch video details via YouTube Data API
				const videoResult = await fetchVideoDetails(item.videoId);
				if (!videoResult.success || !videoResult.data) {
					results.push({
						videoId: item.videoId,
						error: videoResult.error || 'Failed to fetch video details',
					});
					continue;
				}

				const video = videoResult.data;

				// Fetch transcript if enabled (via Android client + timedtext API)
				let transcript: TranscriptData | null = null;
				if (include_transcript) {
					const transcriptResult = await fetchTranscript(video.id, transcript_language);
					if (transcriptResult.success && transcriptResult.data) {
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
						thumbnailUrl: video.thumbnailUrl,
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
					videoId: item.videoId,
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

		let message = `Processed ${successCount} videos`;
		if (skippedCount > 0) message += `, ${skippedCount} already existed`;
		if (failCount > 0) message += `, ${failCount} failed`;

		return {
			success: true,
			message,
			videosProcessed: successCount,
			videosSkipped: skippedCount,
			videosFailed: failCount,
			results,
		};
	},
});

// Helper functions are now imported from ./utils.js

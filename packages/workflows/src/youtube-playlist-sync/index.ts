/**
 * YouTube Playlist to Notion Sync Workflow
 *
 * Monitors YouTube playlists and syncs video metadata + transcripts to Notion.
 * When a user adds a video to a playlist, the video details are added to a
 * Notion database and the transcript is added to the page content.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My YouTube research is automatically documented"
 *
 * Integrations: YouTube, Notion
 * Trigger: Polling cron (configurable: 15min/hourly/daily)
 *
 * ## Technical Constraints
 * - Notion: 2000 chars per block (we use 1900 buffer)
 * - Notion: 100 blocks per API call (batched appends)
 * - YouTube: 10,000 API units/day quota
 * - YouTube: No official transcript API (uses youtube-transcript scraping)
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Notion block character limit (2000 - 100 buffer) */
const NOTION_BLOCK_CHAR_LIMIT = 1900;

/** Notion API blocks per request limit */
const NOTION_BLOCKS_PER_REQUEST = 100;

/** State key prefix for KV storage */
const STATE_KEY_PREFIX = 'youtube-playlist-sync:';

// ============================================================================
// TYPES
// ============================================================================

interface PlaylistSyncState {
	playlistId: string;
	lastChecked: string; // ISO timestamp
	processedVideoIds: string[];
	etag?: string; // YouTube API ETag for efficient polling
}

interface VideoData {
	id: string;
	title: string;
	description: string;
	publishedAt: string;
	channelTitle: string;
	thumbnailUrl?: string;
	duration?: string;
	viewCount?: number;
}

interface TranscriptData {
	text: string;
	segments: Array<{
		text: string;
		offset: number;
		duration: number;
	}>;
	language?: string;
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'YouTube Playlist Sync',
	description: 'Sync YouTube playlist videos to Notion with transcripts',
	version: '1.0.0',

	// Pathway metadata for discovery
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
			workflowId: 'youtube-playlist-sync',
			outcome: 'YouTube videos that document themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['youtube', 'notion'],
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
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.05, // Light tier: API calls only
		freeExecutions: 100,
		description: 'Per video synced to Notion',
	},

	integrations: [
		{ service: 'youtube', scopes: ['youtube.readonly'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	config: {
		// Core configuration
		playlist_id: {
			type: 'text',
			label: 'YouTube Playlist ID',
			required: true,
			description: 'The playlist to monitor (e.g., PLxxx or full URL)',
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

	async execute({ trigger, inputs, integrations, env }) {
		const {
			playlist_id,
			notion_database_id,
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
				error: 'Invalid playlist ID or URL',
			};
		}

		// Load state from KV - use playlist ID as instance identifier
		const stateKey = `${STATE_KEY_PREFIX}${playlistId}`;
		let state: PlaylistSyncState = (await env.KV?.get(stateKey, 'json')) || {
			playlistId,
			lastChecked: new Date(0).toISOString(),
			processedVideoIds: [],
		};

		// Fetch playlist items from YouTube
		const playlistResult = await integrations.youtube.getPlaylistItems({
			playlistId,
			maxResults: 50,
		});

		if (!playlistResult.success) {
			return {
				success: false,
				error: `Failed to fetch playlist: ${playlistResult.error?.message}`,
			};
		}

		// Find new videos (not in processedVideoIds)
		const newVideos = playlistResult.data.items.filter(
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

		// Get full video details for new videos
		const videoIds = newVideos.map((v) => v.videoId);
		const videosResult = await integrations.youtube.getVideos({ videoIds });

		if (!videosResult.success) {
			return {
				success: false,
				error: `Failed to fetch video details: ${videosResult.error?.message}`,
			};
		}

		// Process each new video
		const results: Array<{ videoId: string; notionUrl?: string; error?: string }> = [];

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

				// Create Notion page
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

				// Mark as processed
				state.processedVideoIds.push(video.id);

				results.push({
					videoId: video.id,
					notionUrl: notionPage?.url,
				});
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

		const successCount = results.filter((r) => !r.error).length;
		const failCount = results.filter((r) => r.error).length;

		return {
			success: true,
			message: `Processed ${successCount} videos${failCount > 0 ? `, ${failCount} failed` : ''}`,
			videosProcessed: successCount,
			videosFailed: failCount,
			results,
		};
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract playlist ID from URL or return as-is if already an ID
 */
function extractPlaylistId(urlOrId: string): string | null {
	// Already a playlist ID (starts with PL, UU, LL, etc.)
	if (/^(PL|UU|LL|FL|RD|OL)[a-zA-Z0-9_-]+$/.test(urlOrId)) {
		return urlOrId;
	}

	// youtube.com/playlist?list=PLAYLIST_ID
	const listMatch = urlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
	if (listMatch) return listMatch[1];

	return null;
}

/**
 * Create a Notion page for a YouTube video
 */
async function createNotionVideoPage(params: {
	video: VideoData;
	transcript: TranscriptData | null;
	databaseId: string;
	propertyNames: {
		title: string;
		url: string;
		channel: string;
		date: string;
	};
	integrations: any;
}): Promise<{ url: string } | null> {
	const { video, transcript, databaseId, propertyNames, integrations } = params;

	// Build page properties
	const properties: Record<string, any> = {
		[propertyNames.title]: {
			title: [{ text: { content: video.title } }],
		},
		[propertyNames.url]: {
			url: `https://www.youtube.com/watch?v=${video.id}`,
		},
		[propertyNames.channel]: {
			rich_text: [{ text: { content: video.channelTitle } }],
		},
	};

	// Add date if available
	if (video.publishedAt) {
		properties[propertyNames.date] = {
			date: { start: video.publishedAt.split('T')[0] },
		};
	}

	// Build page content blocks
	const children: any[] = [];

	// Video embed
	children.push({
		object: 'block',
		type: 'video',
		video: {
			type: 'external',
			external: { url: `https://www.youtube.com/watch?v=${video.id}` },
		},
	});

	// Video info callout
	const infoLines: string[] = [];
	if (video.channelTitle) infoLines.push(`📺 Channel: ${video.channelTitle}`);
	if (video.duration) infoLines.push(`⏱️ Duration: ${formatDuration(video.duration)}`);
	if (video.viewCount) infoLines.push(`👁️ Views: ${video.viewCount.toLocaleString()}`);
	if (video.publishedAt) infoLines.push(`📅 Published: ${video.publishedAt.split('T')[0]}`);

	if (infoLines.length > 0) {
		children.push({
			object: 'block',
			type: 'callout',
			callout: {
				icon: { emoji: '📹' },
				rich_text: [{ text: { content: infoLines.join('\n') } }],
			},
		});
	}

	// Description
	if (video.description) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Description' } }] },
		});

		const descriptionBlocks = splitTextIntoBlocks(video.description);
		children.push(...descriptionBlocks);
	}

	// Transcript
	if (transcript && transcript.text) {
		children.push({
			object: 'block',
			type: 'divider',
			divider: {},
		});

		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Transcript' } }] },
		});

		if (transcript.language) {
			children.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [
						{
							text: { content: `Language: ${transcript.language}` },
							annotations: { italic: true, color: 'gray' },
						},
					],
				},
			});
		}

		const transcriptBlocks = splitTextIntoBlocks(transcript.text);
		children.push(...transcriptBlocks);
	}

	// Create the page (Notion limits children to 100 blocks on create)
	const initialChildren = children.slice(0, NOTION_BLOCKS_PER_REQUEST);
	const remainingChildren = children.slice(NOTION_BLOCKS_PER_REQUEST);

	const createResult = await integrations.notion.createPage({
		parentDatabaseId: databaseId,
		properties,
		children: initialChildren,
	});

	if (!createResult.success) {
		throw new Error(`Failed to create Notion page: ${createResult.error?.message}`);
	}

	const pageId = createResult.data.id;
	const pageUrl = createResult.data.url;

	// Append remaining blocks in batches
	if (remainingChildren.length > 0) {
		await appendBlocksInBatches(pageId, remainingChildren, integrations);
	}

	return { url: pageUrl };
}

/**
 * Split text into Notion paragraph blocks respecting character limit
 */
function splitTextIntoBlocks(text: string): any[] {
	const blocks: any[] = [];

	// Split by paragraphs (double newlines)
	const paragraphs = text.split(/\n\n+/);

	for (const para of paragraphs) {
		if (!para.trim()) continue;

		const trimmed = para.trim();

		// If paragraph fits in one block, add it
		if (trimmed.length <= NOTION_BLOCK_CHAR_LIMIT) {
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: { rich_text: [{ text: { content: trimmed } }] },
			});
			continue;
		}

		// Split long paragraphs by sentences or words
		let remaining = trimmed;
		while (remaining.length > 0) {
			let chunk: string;

			if (remaining.length <= NOTION_BLOCK_CHAR_LIMIT) {
				chunk = remaining;
				remaining = '';
			} else {
				// Try to split at sentence boundary
				const cutPoint = findSplitPoint(remaining, NOTION_BLOCK_CHAR_LIMIT);
				chunk = remaining.slice(0, cutPoint).trim();
				remaining = remaining.slice(cutPoint).trim();
			}

			if (chunk) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: chunk } }] },
				});
			}
		}
	}

	return blocks.length > 0
		? blocks
		: [
				{
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: '' } }] },
				},
		  ];
}

/**
 * Find a good split point (sentence or word boundary) within maxLength
 */
function findSplitPoint(text: string, maxLength: number): number {
	// Try to split at sentence boundary
	const sentenceEnd = text.slice(0, maxLength).lastIndexOf('. ');
	if (sentenceEnd > maxLength * 0.5) {
		return sentenceEnd + 2; // Include the period and space
	}

	// Fall back to word boundary
	const wordEnd = text.slice(0, maxLength).lastIndexOf(' ');
	if (wordEnd > maxLength * 0.5) {
		return wordEnd + 1;
	}

	// Last resort: hard cut
	return maxLength;
}

/**
 * Append blocks to a Notion page in batches
 */
async function appendBlocksInBatches(
	pageId: string,
	blocks: any[],
	integrations: any
): Promise<void> {
	for (let i = 0; i < blocks.length; i += NOTION_BLOCKS_PER_REQUEST) {
		const batch = blocks.slice(i, i + NOTION_BLOCKS_PER_REQUEST);

		// Use the Notion API to append blocks
		// Note: This requires the appendBlockChildren method on the integration
		const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${integrations.notion.accessToken}`,
				'Notion-Version': '2022-06-28',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ children: batch }),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			console.error(`Failed to append blocks (batch ${Math.floor(i / NOTION_BLOCKS_PER_REQUEST) + 1}):`, error);
		}

		// Rate limiting - small delay between batches
		if (i + NOTION_BLOCKS_PER_REQUEST < blocks.length) {
			await new Promise((r) => setTimeout(r, 350));
		}
	}
}

/**
 * Format ISO 8601 duration to human-readable string
 */
function formatDuration(duration: string): string {
	const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
	if (!match) return duration;

	const hours = parseInt(match[1] || '0', 10);
	const minutes = parseInt(match[2] || '0', 10);
	const seconds = parseInt(match[3] || '0', 10);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * YouTube Playlist Sync - Shared Utilities
 *
 * Common functions used by both public and private workflow versions.
 * Extracted to reduce duplication and improve maintainability.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Notion block character limit (2000 - 100 buffer) */
export const NOTION_BLOCK_CHAR_LIMIT = 1900;

/** Notion API blocks per request limit */
export const NOTION_BLOCKS_PER_REQUEST = 100;

// ============================================================================
// TYPES
// ============================================================================

export interface VideoData {
	id: string;
	title: string;
	description: string;
	publishedAt: string;
	channelTitle: string;
	thumbnailUrl?: string;
	duration?: string;
	viewCount?: number;
}

export interface TranscriptData {
	text: string;
	segments: Array<{
		text: string;
		offset: number;
		duration: number;
	}>;
	language?: string;
}

export interface PlaylistSyncState {
	playlistId: string;
	lastChecked: string; // ISO timestamp
	processedVideoIds: string[];
	etag?: string; // YouTube API ETag for efficient polling
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get poll interval in milliseconds based on frequency setting
 */
export function getPollIntervalMs(frequency: string): number {
	switch (frequency) {
		case '15min':
			return 15 * 60 * 1000; // 15 minutes
		case 'hourly':
			return 60 * 60 * 1000; // 1 hour
		case 'daily':
			return 24 * 60 * 60 * 1000; // 24 hours
		default:
			return 60 * 60 * 1000; // Default to hourly
	}
}

// extractPlaylistId is now imported from @workwayco/integrations

/**
 * Format ISO 8601 duration to human-readable string
 */
export function formatDuration(duration: string): string {
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

/**
 * Find a good split point (sentence or word boundary) within maxLength
 */
export function findSplitPoint(text: string, maxLength: number): number {
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
 * Split text into Notion paragraph blocks respecting character limit
 */
export function splitTextIntoBlocks(text: string): any[] {
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
 * Check if a video already exists in the Notion database
 * Provides fallback duplicate detection if KV state is lost
 */
export async function checkVideoExistsInNotion(params: {
	videoId: string;
	databaseId: string;
	urlPropertyName: string;
	integrations: any;
}): Promise<boolean> {
	const { videoId, databaseId, urlPropertyName, integrations } = params;
	const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

	try {
		// Query the database for pages with matching URL
		const result = await integrations.notion.queryDatabase({
			databaseId,
			filter: {
				property: urlPropertyName,
				url: {
					equals: videoUrl,
				},
			},
			page_size: 1,
		});

		if (result.success && result.data && result.data.length > 0) {
			return true; // Video already exists
		}
	} catch (error) {
		// If the query fails (e.g., property doesn't exist), proceed with creation
		// This maintains graceful degradation
		console.warn(`Failed to check for duplicate video ${videoId}:`, error);
	}

	return false;
}

/**
 * Append blocks to a Notion page in batches
 *
 * Uses the Notion integration's appendBlocksInBatches method which handles:
 * - Automatic batching (100 blocks per request)
 * - Rate limiting between batches
 * - Proper error handling
 */
export async function appendBlocksInBatches(
	pageId: string,
	blocks: any[],
	integrations: any
): Promise<void> {
	// Use the Notion integration's batch append method
	const result = await integrations.notion.appendBlocksInBatches(pageId, blocks);

	if (!result.success) {
		console.error(`Failed to append blocks to page ${pageId}:`, result.error?.message);
	}
}

/**
 * Build video info callout content
 */
export function buildVideoInfoLines(video: VideoData): string[] {
	const infoLines: string[] = [];
	if (video.channelTitle) infoLines.push(`📺 Channel: ${video.channelTitle}`);
	if (video.duration) infoLines.push(`⏱️ Duration: ${formatDuration(video.duration)}`);
	if (video.viewCount) infoLines.push(`👁️ Views: ${video.viewCount.toLocaleString()}`);
	if (video.publishedAt) infoLines.push(`📅 Published: ${video.publishedAt.split('T')[0]}`);
	return infoLines;
}

/**
 * Build Notion page blocks for a YouTube video
 */
export function buildVideoBlocks(video: VideoData, transcript: TranscriptData | null): any[] {
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
	const infoLines = buildVideoInfoLines(video);
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

	return children;
}

/**
 * Create a Notion page for a YouTube video
 */
export async function createNotionVideoPage(params: {
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
	skipDuplicateCheck?: boolean;
}): Promise<{ url: string; skipped?: boolean } | null> {
	const { video, transcript, databaseId, propertyNames, integrations, skipDuplicateCheck } = params;

	// Check for existing video in Notion (fallback if KV state is lost)
	if (!skipDuplicateCheck) {
		const exists = await checkVideoExistsInNotion({
			videoId: video.id,
			databaseId,
			urlPropertyName: propertyNames.url,
			integrations,
		});

		if (exists) {
			console.log(`Video ${video.id} already exists in Notion, skipping`);
			return { url: '', skipped: true };
		}
	}

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
	const children = buildVideoBlocks(video, transcript);

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

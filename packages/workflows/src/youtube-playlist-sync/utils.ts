/**
 * YouTube Playlist Sync - Shared Utilities
 *
 * Common functions used by both public and private workflow versions.
 * Extracted to reduce duplication and improve maintainability.
 *
 * ## Scraping vs API
 *
 * For public playlists, this module provides scraping functions that work
 * without OAuth. This is simpler for users (no YouTube connection required)
 * and works reliably for public content.
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

/** Playlist item from scraping */
export interface ScrapedPlaylistItem {
	videoId: string;
	title: string;
}

/** Result from playlist scraping */
export interface ScrapePlaylistResult {
	success: boolean;
	items?: ScrapedPlaylistItem[];
	error?: string;
}

/** Result from video scraping */
export interface ScrapeVideoResult {
	success: boolean;
	data?: VideoData;
	error?: string;
}

/** Result from transcript scraping */
export interface ScrapeTranscriptResult {
	success: boolean;
	data?: TranscriptData;
	error?: string;
}

// ============================================================================
// YOUTUBE DATA API (Public Data with API Key - No OAuth Required)
// ============================================================================

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Fetch playlist items using YouTube Data API
 *
 * Uses API key authentication for public playlist data.
 * No user OAuth required.
 */
export async function fetchPlaylistItems(
	playlistId: string,
	apiKey: string
): Promise<ScrapePlaylistResult> {
	try {
		const items: ScrapedPlaylistItem[] = [];
		let nextPageToken: string | undefined;

		// Paginate through all playlist items
		do {
			const params = new URLSearchParams({
				part: 'snippet,contentDetails',
				playlistId,
				maxResults: '50',
				key: apiKey,
			});
			if (nextPageToken) {
				params.set('pageToken', nextPageToken);
			}

			const response = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`);

			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				return {
					success: false,
					error: `YouTube API error: ${error?.error?.message || response.status}`,
				};
			}

			const data = (await response.json()) as {
				items?: Array<{
					contentDetails?: { videoId?: string };
					snippet?: { title?: string };
				}>;
				nextPageToken?: string;
			};

			for (const item of data.items || []) {
				if (item.contentDetails?.videoId) {
					items.push({
						videoId: item.contentDetails.videoId,
						title: item.snippet?.title || 'Untitled',
					});
				}
			}

			nextPageToken = data.nextPageToken;

			// Safety limit
			if (items.length >= 500) break;
		} while (nextPageToken);

		return { success: true, items };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error fetching playlist',
		};
	}
}

/**
 * Fetch video details using YouTube Data API
 *
 * Uses API key authentication for public video data.
 * No user OAuth required.
 */
export async function fetchVideoDetails(
	videoId: string,
	apiKey: string
): Promise<ScrapeVideoResult> {
	try {
		const params = new URLSearchParams({
			part: 'snippet,contentDetails,statistics',
			id: videoId,
			key: apiKey,
		});

		const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			return {
				success: false,
				error: `YouTube API error: ${error?.error?.message || response.status}`,
			};
		}

		const data = (await response.json()) as {
			items?: Array<{
				id: string;
				snippet?: {
					title?: string;
					description?: string;
					publishedAt?: string;
					channelTitle?: string;
					thumbnails?: { high?: { url?: string } };
				};
				contentDetails?: { duration?: string };
				statistics?: { viewCount?: string };
			}>;
		};

		const video = data.items?.[0];
		if (!video) {
			return { success: false, error: 'Video not found' };
		}

		return {
			success: true,
			data: {
				id: video.id,
				title: video.snippet?.title || 'Untitled',
				description: video.snippet?.description || '',
				publishedAt: video.snippet?.publishedAt || new Date().toISOString(),
				channelTitle: video.snippet?.channelTitle || 'Unknown',
				thumbnailUrl: video.snippet?.thumbnails?.high?.url,
				duration: video.contentDetails?.duration,
				viewCount: parseInt(video.statistics?.viewCount || '0', 10),
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error fetching video',
		};
	}
}

/**
 * Fetch transcript from a public YouTube video
 *
 * Uses the Android player endpoint to get caption track URLs, then fetches
 * the captions from the timedtext API. This approach is more reliable than
 * the WEB client or Innertube transcript endpoints.
 */
export async function fetchTranscript(
	videoId: string,
	language: string = 'en'
): Promise<ScrapeTranscriptResult> {
	const ANDROID_USER_AGENT = 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip';
	const ANDROID_API_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

	try {
		// Use Android player endpoint to get caption tracks
		const playerRequestBody = {
			context: {
				client: {
					hl: language,
					gl: 'US',
					clientName: 'ANDROID',
					clientVersion: '19.09.37',
					androidSdkVersion: 30,
					userAgent: ANDROID_USER_AGENT,
				},
			},
			videoId,
		};

		const playerResponse = await fetch(
			`https://www.youtube.com/youtubei/v1/player?key=${ANDROID_API_KEY}&prettyPrint=false`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': ANDROID_USER_AGENT,
				},
				body: JSON.stringify(playerRequestBody),
			}
		);

		if (!playerResponse.ok) {
			return { success: false, error: `Player API error: ${playerResponse.status}` };
		}

		const playerData = (await playerResponse.json()) as {
			captions?: {
				playerCaptionsTracklistRenderer?: {
					captionTracks?: Array<{
						baseUrl?: string;
						name?: { simpleText?: string };
						languageCode?: string;
						kind?: string;
					}>;
				};
			};
		};

		// Get caption tracks
		const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

		if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
			return { success: false, error: 'No captions available for this video' };
		}

		// Find the best matching caption track
		// Priority: exact language match (non-auto) > language prefix match > auto-generated > first
		let selectedTrack = captionTracks.find((t) => t.languageCode === language && !t.kind);
		if (!selectedTrack) {
			selectedTrack = captionTracks.find(
				(t) => t.languageCode?.startsWith(language.split('-')[0]) && !t.kind
			);
		}
		if (!selectedTrack) {
			selectedTrack = captionTracks.find(
				(t) => t.languageCode === language || t.languageCode?.startsWith(language.split('-')[0])
			);
		}
		if (!selectedTrack) {
			selectedTrack = captionTracks[0];
		}

		const baseUrl = selectedTrack?.baseUrl;
		if (!baseUrl) {
			return { success: false, error: 'No caption URL found' };
		}

		// Fetch the captions (default XML format)
		const captionResponse = await fetch(baseUrl, {
			headers: {
				'User-Agent': ANDROID_USER_AGENT,
			},
		});

		if (!captionResponse.ok) {
			return { success: false, error: `Caption fetch error: ${captionResponse.status}` };
		}

		const captionXml = await captionResponse.text();

		if (!captionXml || captionXml.length === 0) {
			return { success: false, error: 'Empty caption response' };
		}

		// Parse the XML caption format
		const segments: TranscriptData['segments'] = [];
		const textParts: string[] = [];

		// Extract <p> elements with timing and text
		// Format: <p t="320" d="14260" w="1">text or <s> segments</p>
		const paragraphRegex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([^<]*(?:<s[^>]*>[^<]*<\/s>)*[^<]*)<\/p>/g;
		let match;

		while ((match = paragraphRegex.exec(captionXml)) !== null) {
			const startMs = parseInt(match[1], 10);
			const durationMs = parseInt(match[2] || '0', 10);
			let content = match[3];

			// Extract text from <s> segments if present, otherwise use raw content
			const segmentTexts: string[] = [];
			const segmentRegex = /<s[^>]*>([^<]*)<\/s>/g;
			let segMatch;

			while ((segMatch = segmentRegex.exec(content)) !== null) {
				segmentTexts.push(segMatch[1]);
			}

			// If no <s> segments, use the content directly (remove any remaining tags)
			let text =
				segmentTexts.length > 0 ? segmentTexts.join('') : content.replace(/<[^>]+>/g, '');

			// Decode HTML entities
			text = text
				.replace(/&#39;/g, "'")
				.replace(/&quot;/g, '"')
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.trim();

			if (text) {
				segments.push({
					text,
					offset: startMs,
					duration: durationMs,
				});
				textParts.push(text);
			}
		}

		if (segments.length === 0) {
			return { success: false, error: 'Could not parse transcript from response' };
		}

		// Get actual language from selected track
		const actualLanguage =
			selectedTrack?.name?.simpleText || selectedTrack?.languageCode || language;

		return {
			success: true,
			data: {
				text: textParts.join(' '),
				segments,
				language: actualLanguage,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error fetching transcript',
		};
	}
}

// Legacy aliases for backward compatibility
export const scrapePlaylistItems = fetchPlaylistItems;
export const scrapeVideoDetails = fetchVideoDetails;
export const scrapeTranscript = fetchTranscript;

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

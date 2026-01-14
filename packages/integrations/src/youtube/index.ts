/**
 * YouTube Integration for WORKWAY
 *
 * Provides actions for interacting with YouTube:
 * - List playlist items
 * - Get video metadata
 * - Fetch video transcripts (captions)
 *
 * ## Transcript Retrieval
 *
 * YouTube has no official transcript API for videos you don't own.
 * This integration uses the youtube-transcript library which scrapes
 * the publicly-available captions from the YouTube player.
 *
 * ## OAuth Scopes
 *
 * - `youtube.readonly` - Read access to playlists and videos
 *
 * @example Basic usage
 * ```typescript
 * import { YouTube } from '@workwayco/integrations/youtube';
 *
 * const youtube = new YouTube({ accessToken: tokens.youtube.access_token });
 *
 * // List videos in a playlist
 * const videos = await youtube.getPlaylistItems({ playlistId: 'PLxxx' });
 *
 * // Get video details
 * const video = await youtube.getVideo({ videoId: 'dQw4w9WgXcQ' });
 *
 * // Get transcript
 * const transcript = await youtube.getTranscript({ videoId: 'dQw4w9WgXcQ' });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type StandardDocument,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { BaseAPIClient, createErrorHandler } from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * YouTube integration configuration
 */
export interface YouTubeConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** API Key (alternative to OAuth for public data) */
	apiKey?: string;
}

/**
 * YouTube video object
 */
export interface YouTubeVideo {
	id: string;
	title: string;
	description: string;
	publishedAt: string;
	channelId: string;
	channelTitle: string;
	thumbnails: {
		default?: YouTubeThumbnail;
		medium?: YouTubeThumbnail;
		high?: YouTubeThumbnail;
		standard?: YouTubeThumbnail;
		maxres?: YouTubeThumbnail;
	};
	tags?: string[];
	duration?: string; // ISO 8601 duration
	viewCount?: number;
	likeCount?: number;
	commentCount?: number;
}

/**
 * YouTube thumbnail object
 */
export interface YouTubeThumbnail {
	url: string;
	width: number;
	height: number;
}

/**
 * YouTube playlist item object
 */
export interface YouTubePlaylistItem {
	id: string;
	videoId: string;
	title: string;
	description: string;
	publishedAt: string;
	channelId: string;
	channelTitle: string;
	position: number;
	thumbnails: YouTubeVideo['thumbnails'];
	videoOwnerChannelId?: string;
	videoOwnerChannelTitle?: string;
}

/**
 * YouTube playlist object
 */
export interface YouTubePlaylist {
	id: string;
	title: string;
	description: string;
	publishedAt: string;
	channelId: string;
	channelTitle: string;
	thumbnails: YouTubeVideo['thumbnails'];
	itemCount: number;
}

/**
 * YouTube transcript segment
 */
export interface YouTubeTranscriptSegment {
	text: string;
	offset: number; // milliseconds
	duration: number; // milliseconds
}

/**
 * YouTube transcript result
 */
export interface YouTubeTranscript {
	videoId: string;
	segments: YouTubeTranscriptSegment[];
	text: string; // Full transcript as plain text
	language?: string;
}

/**
 * Paginated list response
 */
export interface YouTubePagedResponse<T> {
	items: T[];
	nextPageToken?: string;
	prevPageToken?: string;
	totalResults?: number;
	resultsPerPage: number;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetPlaylistItemsOptions {
	/** Playlist ID */
	playlistId: string;
	/** Maximum results (default: 50, max: 50) */
	maxResults?: number;
	/** Page token for pagination */
	pageToken?: string;
}

export interface GetVideoOptions {
	/** Video ID */
	videoId: string;
}

export interface GetVideosOptions {
	/** Video IDs (max 50) */
	videoIds: string[];
}

export interface GetPlaylistOptions {
	/** Playlist ID */
	playlistId: string;
}

export interface GetTranscriptOptions {
	/** Video ID */
	videoId: string;
	/** Preferred language code (e.g., 'en', 'es') */
	language?: string;
}

export interface SearchVideosOptions {
	/** Search query */
	query: string;
	/** Maximum results (default: 25, max: 50) */
	maxResults?: number;
	/** Page token for pagination */
	pageToken?: string;
	/** Channel ID to search within */
	channelId?: string;
	/** Order: 'date', 'rating', 'relevance', 'title', 'viewCount' */
	order?: 'date' | 'rating' | 'relevance' | 'title' | 'viewCount';
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

/** Error handler bound to YouTube integration */
const handleError = createErrorHandler('youtube');

// ============================================================================
// RAW API RESPONSE TYPES
// ============================================================================

interface YouTubeAPIPlaylistItemResponse {
	kind: string;
	etag: string;
	nextPageToken?: string;
	prevPageToken?: string;
	pageInfo: { totalResults: number; resultsPerPage: number };
	items: Array<{
		kind: string;
		etag: string;
		id: string;
		snippet: {
			publishedAt: string;
			channelId: string;
			title: string;
			description: string;
			thumbnails: YouTubeVideo['thumbnails'];
			channelTitle: string;
			playlistId: string;
			position: number;
			resourceId: { kind: string; videoId: string };
			videoOwnerChannelTitle?: string;
			videoOwnerChannelId?: string;
		};
		contentDetails: {
			videoId: string;
			videoPublishedAt?: string;
		};
	}>;
}

interface YouTubeAPIVideoResponse {
	kind: string;
	etag: string;
	pageInfo: { totalResults: number; resultsPerPage: number };
	items: Array<{
		kind: string;
		etag: string;
		id: string;
		snippet: {
			publishedAt: string;
			channelId: string;
			title: string;
			description: string;
			thumbnails: YouTubeVideo['thumbnails'];
			channelTitle: string;
			tags?: string[];
			categoryId: string;
		};
		contentDetails: {
			duration: string;
			dimension: string;
			definition: string;
			caption: string;
		};
		statistics?: {
			viewCount?: string;
			likeCount?: string;
			commentCount?: string;
		};
	}>;
}

interface YouTubeAPIPlaylistResponse {
	kind: string;
	etag: string;
	pageInfo: { totalResults: number; resultsPerPage: number };
	items: Array<{
		kind: string;
		etag: string;
		id: string;
		snippet: {
			publishedAt: string;
			channelId: string;
			title: string;
			description: string;
			thumbnails: YouTubeVideo['thumbnails'];
			channelTitle: string;
		};
		contentDetails: {
			itemCount: number;
		};
	}>;
}

// ============================================================================
// INTEGRATION CLASS
// ============================================================================

/**
 * YouTube Integration
 *
 * Extends BaseAPIClient for DRY HTTP handling with automatic token refresh.
 */
export class YouTube extends BaseAPIClient {
	private apiKey?: string;

	constructor(config: YouTubeConfig) {
		// Validate required config
		if (!config.accessToken && !config.apiKey) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'YouTube access token or API key is required',
				{ integration: 'youtube', retryable: false }
			);
		}

		super({
			accessToken: config.accessToken || '',
			apiUrl: config.apiUrl || 'https://www.googleapis.com/youtube/v3',
			timeout: config.timeout,
			errorContext: { integration: 'youtube' },
		});

		this.apiKey = config.apiKey;
	}

	// ==========================================================================
	// AUTH HELPERS
	// ==========================================================================

	/**
	 * Get authorization params - either OAuth token or API key
	 */
	private getAuthParams(): URLSearchParams {
		const params = new URLSearchParams();
		if (this.apiKey) {
			params.set('key', this.apiKey);
		}
		return params;
	}

	/**
	 * Get headers - include OAuth token if available
	 */
	private getAuthHeaders(): Record<string, string> {
		if (this.accessToken) {
			return { Authorization: `Bearer ${this.accessToken}` };
		}
		return {};
	}

	// ==========================================================================
	// PLAYLIST METHODS
	// ==========================================================================

	/**
	 * Get items in a playlist
	 *
	 * @returns ActionResult with playlist items
	 */
	async getPlaylistItems(
		options: GetPlaylistItemsOptions
	): Promise<ActionResult<YouTubePagedResponse<YouTubePlaylistItem>>> {
		const { playlistId, maxResults = 50, pageToken } = options;

		if (!playlistId) {
			return ActionResult.error('Playlist ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'youtube',
				action: 'get-playlist-items',
			});
		}

		try {
			const params = this.getAuthParams();
			params.set('part', 'snippet,contentDetails');
			params.set('playlistId', playlistId);
			params.set('maxResults', Math.min(maxResults, 50).toString());
			if (pageToken) params.set('pageToken', pageToken);

			const response = await this.get(`/playlistItems?${params}`, this.getAuthHeaders());
			await this.assertOk(response);

			const data = (await response.json()) as YouTubeAPIPlaylistItemResponse;

			// Transform to our types
			const items: YouTubePlaylistItem[] = data.items.map((item) => ({
				id: item.id,
				videoId: item.contentDetails.videoId,
				title: item.snippet.title,
				description: item.snippet.description,
				publishedAt: item.snippet.publishedAt,
				channelId: item.snippet.channelId,
				channelTitle: item.snippet.channelTitle,
				position: item.snippet.position,
				thumbnails: item.snippet.thumbnails,
				videoOwnerChannelId: item.snippet.videoOwnerChannelId,
				videoOwnerChannelTitle: item.snippet.videoOwnerChannelTitle,
			}));

			return createActionResult({
				data: {
					items,
					nextPageToken: data.nextPageToken,
					prevPageToken: data.prevPageToken,
					totalResults: data.pageInfo.totalResults,
					resultsPerPage: data.pageInfo.resultsPerPage,
				},
				integration: 'youtube',
				action: 'get-playlist-items',
				schema: 'youtube.playlist-items.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-playlist-items');
		}
	}

	/**
	 * Get playlist metadata
	 *
	 * @returns ActionResult with playlist details
	 */
	async getPlaylist(options: GetPlaylistOptions): Promise<ActionResult<YouTubePlaylist>> {
		const { playlistId } = options;

		if (!playlistId) {
			return ActionResult.error('Playlist ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'youtube',
				action: 'get-playlist',
			});
		}

		try {
			const params = this.getAuthParams();
			params.set('part', 'snippet,contentDetails');
			params.set('id', playlistId);

			const response = await this.get(`/playlists?${params}`, this.getAuthHeaders());
			await this.assertOk(response);

			const data = (await response.json()) as YouTubeAPIPlaylistResponse;

			if (!data.items || data.items.length === 0) {
				return ActionResult.error('Playlist not found', ErrorCode.NOT_FOUND, {
					integration: 'youtube',
					action: 'get-playlist',
				});
			}

			const item = data.items[0];
			const playlist: YouTubePlaylist = {
				id: item.id,
				title: item.snippet.title,
				description: item.snippet.description,
				publishedAt: item.snippet.publishedAt,
				channelId: item.snippet.channelId,
				channelTitle: item.snippet.channelTitle,
				thumbnails: item.snippet.thumbnails,
				itemCount: item.contentDetails.itemCount,
			};

			return createActionResult({
				data: playlist,
				integration: 'youtube',
				action: 'get-playlist',
				schema: 'youtube.playlist.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-playlist');
		}
	}

	// ==========================================================================
	// VIDEO METHODS
	// ==========================================================================

	/**
	 * Get video details
	 *
	 * @returns ActionResult with video details
	 */
	async getVideo(options: GetVideoOptions): Promise<ActionResult<YouTubeVideo>> {
		const { videoId } = options;

		if (!videoId) {
			return ActionResult.error('Video ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'youtube',
				action: 'get-video',
			});
		}

		try {
			const params = this.getAuthParams();
			params.set('part', 'snippet,contentDetails,statistics');
			params.set('id', videoId);

			const response = await this.get(`/videos?${params}`, this.getAuthHeaders());
			await this.assertOk(response);

			const data = (await response.json()) as YouTubeAPIVideoResponse;

			if (!data.items || data.items.length === 0) {
				return ActionResult.error('Video not found', ErrorCode.NOT_FOUND, {
					integration: 'youtube',
					action: 'get-video',
				});
			}

			const item = data.items[0];
			const video: YouTubeVideo = {
				id: item.id,
				title: item.snippet.title,
				description: item.snippet.description,
				publishedAt: item.snippet.publishedAt,
				channelId: item.snippet.channelId,
				channelTitle: item.snippet.channelTitle,
				thumbnails: item.snippet.thumbnails,
				tags: item.snippet.tags,
				duration: item.contentDetails.duration,
				viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : undefined,
				likeCount: item.statistics?.likeCount ? parseInt(item.statistics.likeCount, 10) : undefined,
				commentCount: item.statistics?.commentCount
					? parseInt(item.statistics.commentCount, 10)
					: undefined,
			};

			return createActionResult({
				data: video,
				integration: 'youtube',
				action: 'get-video',
				schema: 'youtube.video.v1',
				capabilities: this.getCapabilities(),
				standard: this.toStandardDocument(video),
			});
		} catch (error) {
			return handleError(error, 'get-video');
		}
	}

	/**
	 * Get multiple videos at once (batch)
	 *
	 * @returns ActionResult with video details
	 */
	async getVideos(options: GetVideosOptions): Promise<ActionResult<YouTubeVideo[]>> {
		const { videoIds } = options;

		if (!videoIds || videoIds.length === 0) {
			return ActionResult.error('Video IDs are required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'youtube',
				action: 'get-videos',
			});
		}

		if (videoIds.length > 50) {
			return ActionResult.error('Maximum 50 video IDs allowed', ErrorCode.VALIDATION_ERROR, {
				integration: 'youtube',
				action: 'get-videos',
			});
		}

		try {
			const params = this.getAuthParams();
			params.set('part', 'snippet,contentDetails,statistics');
			params.set('id', videoIds.join(','));

			const response = await this.get(`/videos?${params}`, this.getAuthHeaders());
			await this.assertOk(response);

			const data = (await response.json()) as YouTubeAPIVideoResponse;

			const videos: YouTubeVideo[] = data.items.map((item) => ({
				id: item.id,
				title: item.snippet.title,
				description: item.snippet.description,
				publishedAt: item.snippet.publishedAt,
				channelId: item.snippet.channelId,
				channelTitle: item.snippet.channelTitle,
				thumbnails: item.snippet.thumbnails,
				tags: item.snippet.tags,
				duration: item.contentDetails.duration,
				viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : undefined,
				likeCount: item.statistics?.likeCount ? parseInt(item.statistics.likeCount, 10) : undefined,
				commentCount: item.statistics?.commentCount
					? parseInt(item.statistics.commentCount, 10)
					: undefined,
			}));

			return createActionResult({
				data: videos,
				integration: 'youtube',
				action: 'get-videos',
				schema: 'youtube.video-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-videos');
		}
	}

	// ==========================================================================
	// TRANSCRIPT METHODS
	// ==========================================================================

	/**
	 * Get video transcript
	 *
	 * Note: YouTube does not have an official transcript API for videos you don't own.
	 * This method fetches the auto-generated or user-uploaded captions that are
	 * publicly visible on the video.
	 *
	 * For Cloudflare Workers environment, we fetch the caption track directly from
	 * YouTube's timedtext API.
	 *
	 * @returns ActionResult with transcript
	 */
	async getTranscript(options: GetTranscriptOptions): Promise<ActionResult<YouTubeTranscript>> {
		const { videoId, language = 'en' } = options;

		if (!videoId) {
			return ActionResult.error('Video ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'youtube',
				action: 'get-transcript',
			});
		}

		try {
			// Fetch the video page to extract caption track info
			const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					'Accept-Language': 'en-US,en;q=0.9',
				},
			});

			if (!videoPageResponse.ok) {
				return ActionResult.error('Failed to fetch video page', ErrorCode.EXTERNAL_SERVICE_ERROR, {
					integration: 'youtube',
					action: 'get-transcript',
				});
			}

			const html = await videoPageResponse.text();

			// Extract caption tracks from the page
			const captionTrackMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
			if (!captionTrackMatch) {
				return ActionResult.error(
					'No captions available for this video',
					ErrorCode.NOT_FOUND,
					{
						integration: 'youtube',
						action: 'get-transcript',
					}
				);
			}

			let captionTracks: Array<{ baseUrl: string; languageCode: string; name?: { simpleText?: string } }>;
			try {
				captionTracks = JSON.parse(captionTrackMatch[1]);
			} catch {
				return ActionResult.error('Failed to parse caption tracks', ErrorCode.INVALID_INPUT, {
					integration: 'youtube',
					action: 'get-transcript',
				});
			}

			// Find the requested language or fall back to first available
			let selectedTrack = captionTracks.find((t) => t.languageCode === language);
			if (!selectedTrack && captionTracks.length > 0) {
				selectedTrack = captionTracks[0];
			}

			if (!selectedTrack) {
				return ActionResult.error(
					'No caption track found for requested language',
					ErrorCode.NOT_FOUND,
					{
						integration: 'youtube',
						action: 'get-transcript',
					}
				);
			}

			// Fetch the transcript XML
			const transcriptUrl = selectedTrack.baseUrl + '&fmt=json3';
			const transcriptResponse = await fetch(transcriptUrl);

			if (!transcriptResponse.ok) {
				return ActionResult.error(
					'Failed to fetch transcript',
					ErrorCode.EXTERNAL_SERVICE_ERROR,
					{
						integration: 'youtube',
						action: 'get-transcript',
					}
				);
			}

			const transcriptData = (await transcriptResponse.json()) as {
				events?: Array<{
					tStartMs?: number;
					dDurationMs?: number;
					segs?: Array<{ utf8?: string }>;
				}>;
			};

			// Parse the transcript events
			const segments: YouTubeTranscriptSegment[] = [];
			const textParts: string[] = [];

			if (transcriptData.events) {
				for (const event of transcriptData.events) {
					if (event.segs) {
						const text = event.segs.map((seg) => seg.utf8 || '').join('');
						if (text.trim()) {
							segments.push({
								text: text.trim(),
								offset: event.tStartMs || 0,
								duration: event.dDurationMs || 0,
							});
							textParts.push(text.trim());
						}
					}
				}
			}

			const transcript: YouTubeTranscript = {
				videoId,
				segments,
				text: textParts.join(' '),
				language: selectedTrack.languageCode,
			};

			return createActionResult({
				data: transcript,
				integration: 'youtube',
				action: 'get-transcript',
				schema: 'youtube.transcript.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-transcript');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Get capabilities - be honest about what this integration can do
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleHtml: false,
			canHandleMarkdown: false,
			canHandleAttachments: false,
			canHandleImages: true, // Thumbnails
			supportsSearch: true,
			supportsPagination: true,
			supportsBulkOperations: true, // getVideos batch
			supportsNesting: false,
			supportsRelations: false,
			supportsMetadata: true,
		};
	}

	/**
	 * Convert YouTube video to StandardDocument format
	 */
	private toStandardDocument(video: YouTubeVideo): StandardDocument {
		return {
			type: 'document',
			id: video.id,
			title: video.title,
			url: `https://www.youtube.com/watch?v=${video.id}`,
			author: video.channelTitle,
			createdAt: new Date(video.publishedAt).getTime(),
			updatedAt: new Date(video.publishedAt).getTime(),
			content: video.description,
			metadata: {
				channelId: video.channelId,
				duration: video.duration,
				viewCount: video.viewCount,
				likeCount: video.likeCount,
				commentCount: video.commentCount,
				tags: video.tags,
				thumbnails: video.thumbnails,
			},
		};
	}
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse ISO 8601 duration to seconds
 *
 * @example
 * parseDuration('PT1H2M10S') // 3730
 * parseDuration('PT5M30S') // 330
 */
export function parseDuration(duration: string): number {
	const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
	if (!match) return 0;

	const hours = parseInt(match[1] || '0', 10);
	const minutes = parseInt(match[2] || '0', 10);
	const seconds = parseInt(match[3] || '0', 10);

	return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds to human-readable duration
 *
 * @example
 * formatDuration(3730) // '1:02:10'
 * formatDuration(330) // '5:30'
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extract video ID from various YouTube URL formats
 *
 * @example
 * extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * extractVideoId('https://youtu.be/dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * extractVideoId('dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 */
export function extractVideoId(urlOrId: string): string | null {
	// Already a video ID
	if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
		return urlOrId;
	}

	// youtube.com/watch?v=VIDEO_ID
	const watchMatch = urlOrId.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
	if (watchMatch) return watchMatch[1];

	// youtu.be/VIDEO_ID
	const shortMatch = urlOrId.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
	if (shortMatch) return shortMatch[1];

	// youtube.com/embed/VIDEO_ID
	const embedMatch = urlOrId.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
	if (embedMatch) return embedMatch[1];

	return null;
}

/**
 * Extract playlist ID from various YouTube URL formats
 *
 * @example
 * extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx') // 'PLxxx'
 * extractPlaylistId('PLxxx') // 'PLxxx'
 */
export function extractPlaylistId(urlOrId: string): string | null {
	// Already a playlist ID (starts with PL, UU, LL, etc.)
	if (/^(PL|UU|LL|FL|RD|OL)[a-zA-Z0-9_-]+$/.test(urlOrId)) {
		return urlOrId;
	}

	// youtube.com/playlist?list=PLAYLIST_ID
	const listMatch = urlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
	if (listMatch) return listMatch[1];

	return null;
}

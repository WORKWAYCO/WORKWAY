/**
 * Zoom Integration for WORKWAY
 *
 * Unified client for Zoom Meetings, Clips, and Transcripts.
 * Supports both OAuth API transcripts and browser scraper fallback
 * for full speaker attribution.
 *
 * @example
 * ```typescript
 * import { Zoom } from '@workwayco/integrations/zoom';
 *
 * const zoom = new Zoom({ accessToken: tokens.zoom.access_token });
 *
 * // Get recent meetings
 * const meetings = await zoom.getMeetings({ days: 1 });
 *
 * // Get meeting with transcript
 * const transcript = await zoom.getTranscript({ meetingId: '123456' });
 *
 * // Get clips
 * const clips = await zoom.getClips({ days: 7 });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	type StandardDocument,
	type StandardList,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	BaseAPIClient,
	buildQueryString,
	validateAccessToken,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Zoom integration configuration
 */
export interface ZoomConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Browser scraper URL for transcript fallback */
	browserScraperUrl?: string;
}

/**
 * Zoom meeting object
 */
export interface ZoomMeeting {
	id: number;
	uuid?: string;
	topic: string;
	agenda?: string;
	start_time: string;
	duration: number;
	timezone?: string;
	created_at: string;
	host_id: string;
	join_url?: string;
	/** Meeting type: 1=instant, 2=scheduled, 3=recurring no fixed time, 8=recurring fixed time */
	type?: 1 | 2 | 3 | 8;
}

/**
 * Zoom recording object
 */
export interface ZoomRecording {
	id: string;
	meeting_id: string;
	recording_start: string;
	recording_end: string;
	duration: number;
	total_size: number;
	recording_count: number;
	share_url?: string;
	topic?: string;
	recording_files: ZoomRecordingFile[];
}

/**
 * Zoom recording file
 */
export interface ZoomRecordingFile {
	id: string;
	meeting_id: string;
	recording_start: string;
	recording_end: string;
	/** File type: 'MP4', 'TRANSCRIPT', 'CHAT', 'AUDIO', etc. */
	file_type: 'MP4' | 'TRANSCRIPT' | 'CHAT' | 'AUDIO' | 'CC' | string;
	file_size: number;
	download_url: string;
	status: string;
	recording_type?: string;
}

/**
 * Zoom clip object
 */
export interface ZoomClip {
	id: string;
	title: string;
	description?: string;
	duration: number;
	created_at: string;
	status: string;
	download_url?: string;
	share_url?: string;
	thumbnail_url?: string;
	file_size?: number;
	host_id?: string;
}

/**
 * Transcript result with source information
 */
export interface TranscriptResult {
	/** Plain text transcript */
	transcript_text: string;
	/** Raw WebVTT content (if available) */
	webvtt_raw?: string;
	/** Source of the transcript */
	source: 'oauth_api' | 'browser_scraper';
	/** Whether speaker names are included */
	has_speaker_attribution: boolean;
	/** Detected speaker names */
	speakers?: string[];
	/** Associated recording (if from recordings API) */
	recording?: ZoomRecording;
}

/**
 * Paginated response for meetings
 */
export interface MeetingsResponse {
	meetings: ZoomMeeting[];
	next_page_token?: string;
	page_count: number;
	page_size: number;
	total_records: number;
}

/**
 * Paginated response for clips
 */
export interface ClipsResponse {
	clips: ZoomClip[];
	next_page_token?: string;
	page_size: number;
	total_records?: number;
}

// ============================================================================
// OPTIONS
// ============================================================================

/**
 * Options for getting meetings
 */
export interface GetMeetingsOptions {
	/** User ID or 'me' for current user */
	userId?: string;
	/** Meeting type filter */
	type?: 'scheduled' | 'live' | 'upcoming' | 'upcoming_meetings' | 'previous_meetings';
	/** Number of days to look back */
	days?: number;
	/** From date (YYYY-MM-DD or Date object) */
	from?: string | Date;
	/** To date (YYYY-MM-DD or Date object) */
	to?: string | Date;
	/** Page size (max 300) */
	pageSize?: number;
	/** Pagination token */
	nextPageToken?: string;
}

/**
 * Options for getting a single meeting
 */
export interface GetMeetingOptions {
	/** Meeting ID */
	meetingId: string | number;
}

/**
 * Options for getting recordings
 */
export interface GetRecordingsOptions {
	/** Meeting ID */
	meetingId: string | number;
}

/**
 * Options for getting transcript
 */
export interface GetTranscriptOptions {
	/** Meeting ID */
	meetingId: string | number;
	/** Fall back to browser scraper if OAuth transcript lacks speaker attribution */
	fallbackToBrowser?: boolean;
	/** Share URL for browser scraper (required if fallbackToBrowser is true) */
	shareUrl?: string;
}

/**
 * Options for getting clips
 */
export interface GetClipsOptions {
	/** User ID or 'me' for current user */
	userId?: string;
	/** Number of days to look back */
	days?: number;
	/** From date */
	from?: string | Date;
	/** To date */
	to?: string | Date;
	/** Page size (max 300) */
	pageSize?: number;
	/** Pagination token */
	nextPageToken?: string;
}

/**
 * Options for getting clip transcript
 */
export interface GetClipTranscriptOptions {
	/** Clip share URL */
	shareUrl: string;
}

// ============================================================================
// ZOOM INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Zoom integration */
const handleError = createErrorHandler('zoom');

/**
 * Zoom Integration
 *
 * Weniger, aber besser: Unified client for meetings, clips, and transcripts.
 * Extends BaseAPIClient for shared HTTP logic.
 */
export class Zoom extends BaseAPIClient {
	private browserScraperUrl?: string;

	constructor(config: ZoomConfig) {
		validateAccessToken(config.accessToken, 'zoom');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.zoom.us/v2',
			timeout: config.timeout,
		});
		this.browserScraperUrl = config.browserScraperUrl;
	}

	// ==========================================================================
	// MEETINGS
	// ==========================================================================

	/**
	 * Get meetings for a user
	 *
	 * @returns ActionResult with meetings list
	 */
	async getMeetings(options: GetMeetingsOptions = {}): Promise<ActionResult<ZoomMeeting[]>> {
		const {
			userId = 'me',
			type = 'previous_meetings',
			days,
			pageSize = 300,
			nextPageToken,
		} = options;

		let { from, to } = options;

		// Calculate date range if days is specified
		if (days && !from && !to) {
			const now = new Date();
			to = now;
			from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
		}

		try {
			const query = buildQueryString({
				type,
				page_size: Math.min(pageSize, 300),
				next_page_token: nextPageToken,
				from: from ? this.formatDate(from) : undefined,
				to: to ? this.formatDate(to) : undefined,
			});

			const response = await this.get(`/users/${userId}/meetings${query}`);
			await assertResponseOk(response, { integration: 'zoom', action: 'get-meetings' });

			const data = (await response.json()) as MeetingsResponse;

			const standard: StandardList = {
				type: 'list',
				items: data.meetings.map((meeting) => ({
					id: String(meeting.id),
					title: meeting.topic,
					description: meeting.agenda,
					url: meeting.join_url,
					metadata: {
						start_time: meeting.start_time,
						duration: meeting.duration,
						host_id: meeting.host_id,
					},
				})),
				metadata: {
					total: data.total_records,
					hasMore: !!data.next_page_token,
					cursor: data.next_page_token,
				},
			};

			return createActionResult({
				data: data.meetings,
				integration: 'zoom',
				action: 'get-meetings',
				schema: 'zoom.meetings.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'get-meetings');
		}
	}

	/**
	 * Get a specific meeting
	 *
	 * @returns ActionResult with meeting details
	 */
	async getMeeting(options: GetMeetingOptions): Promise<ActionResult<ZoomMeeting>> {
		const { meetingId } = options;

		if (!meetingId) {
			return ActionResult.error('Meeting ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'zoom',
				action: 'get-meeting',
			});
		}

		try {
			const response = await this.get(`/meetings/${meetingId}`);
			await assertResponseOk(response, { integration: 'zoom', action: 'get-meeting' });

			const meeting = (await response.json()) as ZoomMeeting;

			return createActionResult({
				data: meeting,
				integration: 'zoom',
				action: 'get-meeting',
				schema: 'zoom.meeting.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-meeting');
		}
	}

	// ==========================================================================
	// RECORDINGS
	// ==========================================================================

	/**
	 * Get recordings for a meeting
	 *
	 * @returns ActionResult with recording data (null if no recordings)
	 */
	async getRecordings(options: GetRecordingsOptions): Promise<ActionResult<ZoomRecording | null>> {
		const { meetingId } = options;

		if (!meetingId) {
			return ActionResult.error('Meeting ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'zoom',
				action: 'get-recordings',
			});
		}

		try {
			const response = await this.get(`/meetings/${meetingId}/recordings`);

			// 404 means no recordings - this is valid, not an error
			if (response.status === 404) {
				return createActionResult({
					data: null,
					integration: 'zoom',
					action: 'get-recordings',
					schema: 'zoom.recording.v1',
					capabilities: this.getCapabilities(),
				});
			}

			await assertResponseOk(response, { integration: 'zoom', action: 'get-recordings' });

			const recording = (await response.json()) as ZoomRecording;

			return createActionResult({
				data: recording,
				integration: 'zoom',
				action: 'get-recordings',
				schema: 'zoom.recording.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-recordings');
		}
	}

	// ==========================================================================
	// TRANSCRIPTS
	// ==========================================================================

	/**
	 * Get transcript for a meeting
	 *
	 * Uses a hybrid approach:
	 * 1. First tries the OAuth API /meetings/{id}/transcript endpoint
	 * 2. Falls back to recordings API for download URL
	 * 3. Optionally falls back to browser scraper for speaker attribution
	 *
	 * @returns ActionResult with transcript data
	 */
	async getTranscript(options: GetTranscriptOptions): Promise<ActionResult<TranscriptResult | null>> {
		const { meetingId, fallbackToBrowser = false, shareUrl } = options;

		if (!meetingId) {
			return ActionResult.error('Meeting ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'zoom',
				action: 'get-transcript',
			});
		}

		try {
			// TIER 1: Try the transcript API endpoint first
			const transcriptMeta = await this.getTranscriptMetadata(meetingId);

			if (transcriptMeta && transcriptMeta.download_url) {
				const webvtt = await this.downloadFile(transcriptMeta.download_url);
				const { text, speakers } = this.parseWebVTT(webvtt);

				const result: TranscriptResult = {
					transcript_text: text,
					webvtt_raw: webvtt,
					source: 'oauth_api',
					has_speaker_attribution: speakers.length > 0,
					speakers: speakers.length > 0 ? speakers : undefined,
				};

				// If we got speakers or don't need fallback, return
				if (speakers.length > 0 || !fallbackToBrowser) {
					return createActionResult({
						data: result,
						integration: 'zoom',
						action: 'get-transcript',
						schema: 'zoom.transcript.v1',
						capabilities: this.getCapabilities(),
					});
				}
			}

			// TIER 2: Try recordings API for transcript file
			const recordingsResult = await this.getRecordings({ meetingId });

			if (recordingsResult.success && recordingsResult.data) {
				const recording = recordingsResult.data;
				const transcriptFile = recording.recording_files.find(
					(f) => f.file_type === 'TRANSCRIPT'
				);

				if (transcriptFile) {
					const webvtt = await this.downloadFile(transcriptFile.download_url);
					const { text, speakers } = this.parseWebVTT(webvtt);

					const result: TranscriptResult = {
						transcript_text: text,
						webvtt_raw: webvtt,
						source: 'oauth_api',
						has_speaker_attribution: speakers.length > 0,
						speakers: speakers.length > 0 ? speakers : undefined,
						recording,
					};

					// If we got speakers or don't need fallback, return
					if (speakers.length > 0 || !fallbackToBrowser) {
						return createActionResult({
							data: result,
							integration: 'zoom',
							action: 'get-transcript',
							schema: 'zoom.transcript.v1',
							capabilities: this.getCapabilities(),
						});
					}
				}
			}

			// TIER 3: Browser scraper fallback for speaker attribution
			if (fallbackToBrowser && shareUrl && this.browserScraperUrl) {
				const scraperResult = await this.fetchFromBrowserScraper(shareUrl);

				if (scraperResult) {
					return createActionResult({
						data: scraperResult,
						integration: 'zoom',
						action: 'get-transcript',
						schema: 'zoom.transcript.v1',
						capabilities: this.getCapabilities(),
					});
				}
			}

			// No transcript found
			return createActionResult({
				data: null,
				integration: 'zoom',
				action: 'get-transcript',
				schema: 'zoom.transcript.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-transcript');
		}
	}

	/**
	 * Get transcript metadata from the dedicated transcript endpoint
	 */
	private async getTranscriptMetadata(meetingId: string | number): Promise<{
		meeting_id: string;
		meeting_topic: string;
		download_url: string;
		transcript_created_time?: string;
	} | null> {
		try {
			const response = await this.get(`/meetings/${meetingId}/transcript`);

			if (response.status === 404) {
				return null;
			}

			if (!response.ok) {
				return null;
			}

			return (await response.json()) as {
				meeting_id: string;
				meeting_topic: string;
				download_url: string;
				transcript_created_time?: string;
			};
		} catch {
			return null;
		}
	}

	/**
	 * Download a file (transcript, recording, etc.)
	 */
	private async downloadFile(url: string): Promise<string> {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to download file: ${response.statusText}`);
		}

		return response.text();
	}

	/**
	 * Parse WebVTT format to plain text with speaker extraction
	 */
	private parseWebVTT(webvtt: string): { text: string; speakers: string[] } {
		const lines = webvtt.split('\n');
		const textLines: string[] = [];
		const speakers = new Set<string>();

		let isTextLine = false;

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip WEBVTT header
			if (trimmed.startsWith('WEBVTT')) {
				continue;
			}

			// Skip empty lines
			if (trimmed.length === 0) {
				isTextLine = false;
				continue;
			}

			// Skip timestamp lines
			if (trimmed.includes('-->')) {
				isTextLine = true;
				continue;
			}

			// Capture text lines
			if (isTextLine && trimmed.length > 0) {
				textLines.push(trimmed);

				// Extract speaker if format is "Speaker Name: text"
				const speakerMatch = trimmed.match(/^([^:]+):/);
				if (speakerMatch) {
					speakers.add(speakerMatch[1].trim());
				}
			}
		}

		return {
			text: textLines.join('\n'),
			speakers: Array.from(speakers),
		};
	}

	/**
	 * Fetch transcript from browser scraper (for speaker attribution)
	 */
	private async fetchFromBrowserScraper(shareUrl: string): Promise<TranscriptResult | null> {
		if (!this.browserScraperUrl) {
			return null;
		}

		try {
			const response = await fetch(this.browserScraperUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ zoomUrl: shareUrl }),
			});

			if (!response.ok) {
				return null;
			}

			const result = (await response.json()) as {
				transcript?: string;
				segments_count?: number;
				error?: string;
			};

			if (result.error || !result.transcript) {
				return null;
			}

			// Extract speakers from transcript
			const speakers = new Set<string>();
			const speakerRegex = /^([^:]+):/gm;
			let match: RegExpExecArray | null;
			while ((match = speakerRegex.exec(result.transcript)) !== null) {
				speakers.add(match[1].trim());
			}

			return {
				transcript_text: result.transcript,
				source: 'browser_scraper',
				has_speaker_attribution: speakers.size > 0,
				speakers: Array.from(speakers),
			};
		} catch {
			return null;
		}
	}

	// ==========================================================================
	// CLIPS
	// ==========================================================================

	/**
	 * Get clips for a user
	 *
	 * @returns ActionResult with clips list
	 */
	async getClips(options: GetClipsOptions = {}): Promise<ActionResult<ZoomClip[]>> {
		const { userId = 'me', days, pageSize = 300, nextPageToken } = options;

		let { from, to } = options;

		// Calculate date range if days is specified
		if (days && !from && !to) {
			const now = new Date();
			to = now;
			from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
		}

		try {
			const query = buildQueryString({
				user_id: userId,
				page_size: Math.min(pageSize, 300),
				next_page_token: nextPageToken,
				from: from ? this.formatDateISO(from) : undefined,
				to: to ? this.formatDateISO(to) : undefined,
			});

			const response = await this.get(`/clips${query}`);
			await assertResponseOk(response, { integration: 'zoom', action: 'get-clips' });

			const data = (await response.json()) as {
				data?: Array<{
					clip_id: string;
					title?: string;
					description?: string;
					duration: number;
					created_date: string;
					status: string;
					download_url?: string;
					share_url?: string;
					share_link?: string;
					thumbnail_link?: string;
					file_size?: number;
					owner_id?: string;
				}>;
				next_page_token?: string;
				page_size: number;
				total_records?: number;
			};

			// Map to standardized clip format
			const clips: ZoomClip[] = (data.data || []).map((clip) => ({
				id: clip.clip_id,
				title: clip.title || 'Untitled Clip',
				description: clip.description,
				duration: clip.duration,
				created_at: clip.created_date,
				status: clip.status,
				download_url: clip.download_url || clip.share_link,
				share_url: clip.share_url || clip.share_link,
				thumbnail_url: clip.thumbnail_link,
				file_size: clip.file_size,
				host_id: clip.owner_id,
			}));

			const standard: StandardList = {
				type: 'list',
				items: clips.map((clip) => ({
					id: clip.id,
					title: clip.title,
					description: clip.description,
					url: clip.share_url,
					metadata: {
						duration: clip.duration,
						status: clip.status,
						created_at: clip.created_at,
					},
				})),
				metadata: {
					total: data.total_records,
					hasMore: !!data.next_page_token,
					cursor: data.next_page_token,
				},
			};

			return createActionResult({
				data: clips,
				integration: 'zoom',
				action: 'get-clips',
				schema: 'zoom.clips.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'get-clips');
		}
	}

	/**
	 * Get transcript for a clip using browser scraper
	 *
	 * Note: Clips don't have OAuth transcript API, so this always uses the scraper
	 *
	 * @returns ActionResult with transcript data
	 */
	async getClipTranscript(options: GetClipTranscriptOptions): Promise<ActionResult<TranscriptResult | null>> {
		const { shareUrl } = options;

		if (!shareUrl) {
			return ActionResult.error('Share URL is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'zoom',
				action: 'get-clip-transcript',
			});
		}

		if (!this.browserScraperUrl) {
			return ActionResult.error(
				'Browser scraper URL not configured',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'zoom', action: 'get-clip-transcript' }
			);
		}

		try {
			const result = await this.fetchFromBrowserScraper(shareUrl);

			return createActionResult({
				data: result,
				integration: 'zoom',
				action: 'get-clip-transcript',
				schema: 'zoom.transcript.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-clip-transcript');
		}
	}

	// ==========================================================================
	// COMPOUND METHODS (for workflows)
	// ==========================================================================

	/**
	 * Get meetings with transcripts for a date range
	 *
	 * This is the main method for the Meeting Intelligence workflow.
	 * Fetches meetings and their transcripts in a single operation.
	 *
	 * @returns ActionResult with meetings and their transcripts
	 */
	async getMeetingsWithTranscripts(options: GetMeetingsOptions & {
		fallbackToBrowser?: boolean;
	} = {}): Promise<ActionResult<Array<{
		meeting: ZoomMeeting;
		transcript: TranscriptResult | null;
	}>>> {
		const { fallbackToBrowser = false, ...meetingsOptions } = options;

		try {
			const meetingsResult = await this.getMeetings(meetingsOptions);

			if (!meetingsResult.success) {
				return ActionResult.error(
					meetingsResult.error || 'Failed to fetch meetings',
					ErrorCode.API_ERROR,
					{ integration: 'zoom', action: 'get-meetings-with-transcripts' }
				);
			}

			const results: Array<{ meeting: ZoomMeeting; transcript: TranscriptResult | null }> = [];

			for (const meeting of meetingsResult.data) {
				let transcript: TranscriptResult | null = null;

				const transcriptResult = await this.getTranscript({
					meetingId: meeting.id,
					fallbackToBrowser,
					shareUrl: meeting.join_url,
				});

				if (transcriptResult.success) {
					transcript = transcriptResult.data;
				}

				results.push({ meeting, transcript });
			}

			return createActionResult({
				data: results,
				integration: 'zoom',
				action: 'get-meetings-with-transcripts',
				schema: 'zoom.meetings-with-transcripts.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-meetings-with-transcripts');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Format date to YYYY-MM-DD
	 */
	private formatDate(date: string | Date): string {
		if (typeof date === 'string') {
			return date;
		}
		return date.toISOString().split('T')[0];
	}

	/**
	 * Format date to ISO string
	 */
	private formatDateISO(date: string | Date): string {
		if (typeof date === 'string') {
			return date;
		}
		return date.toISOString();
	}

	/**
	 * Get capabilities for Zoom actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true,
			supportsSearch: false,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: false,
			supportsMetadata: true,
		};
	}
}

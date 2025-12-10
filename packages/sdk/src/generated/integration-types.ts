/**
 * Generated Integration Types for WORKWAY
 *
 * These types provide type safety for `integrations.*` calls in workflows.
 * Generated from actual integration implementations.
 *
 * Usage:
 * ```typescript
 * export default defineWorkflow<{
 *   inputs: { notionDb: string },
 *   integrations: { zoom: ZoomIntegration, notion: NotionIntegration }
 * }>({
 *   integrations: ['zoom', 'notion'],
 *   async execute({ integrations }) {
 *     // integrations.zoom and integrations.notion are now typed
 *     const meetings = await integrations.zoom.getMeetings({ days: 1 });
 *   }
 * });
 * ```
 */

import type { ActionResult } from '../sdk';

// ============================================================================
// ZOOM INTEGRATION TYPES
// ============================================================================

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
	type?: 1 | 2 | 3 | 8;
}

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

export interface ZoomRecordingFile {
	id: string;
	meeting_id: string;
	recording_start: string;
	recording_end: string;
	file_type: 'MP4' | 'TRANSCRIPT' | 'CHAT' | 'AUDIO' | 'CC' | string;
	file_size: number;
	download_url: string;
	status: string;
}

export interface ZoomClip {
	id: string;
	title: string;
	description?: string;
	duration: number;
	created_at: string;
	status: string;
	download_url?: string;
	share_url?: string;
}

export interface TranscriptResult {
	transcript_text: string;
	webvtt_raw?: string;
	source: 'oauth_api' | 'browser_scraper';
	has_speaker_attribution: boolean;
	speakers?: string[];
	recording?: ZoomRecording;
}

export interface ZoomIntegration {
	getMeetings(options?: {
		userId?: string;
		type?: 'scheduled' | 'live' | 'upcoming' | 'upcoming_meetings' | 'previous_meetings';
		days?: number;
		from?: string | Date;
		to?: string | Date;
		pageSize?: number;
		nextPageToken?: string;
	}): Promise<ActionResult<ZoomMeeting[]>>;

	getMeeting(options: { meetingId: string | number }): Promise<ActionResult<ZoomMeeting>>;

	getRecordings(options: {
		meetingId: string | number;
	}): Promise<ActionResult<ZoomRecording | null>>;

	getTranscript(options: {
		meetingId: string | number;
		fallbackToBrowser?: boolean;
		shareUrl?: string;
	}): Promise<ActionResult<TranscriptResult | null>>;

	getClips(options?: {
		userId?: string;
		days?: number;
		from?: string | Date;
		to?: string | Date;
		pageSize?: number;
		nextPageToken?: string;
	}): Promise<ActionResult<ZoomClip[]>>;

	getClipTranscript(options: {
		shareUrl: string;
	}): Promise<ActionResult<TranscriptResult | null>>;

	getMeetingsWithTranscripts(options?: {
		userId?: string;
		days?: number;
		fallbackToBrowser?: boolean;
	}): Promise<ActionResult<Array<{ meeting: ZoomMeeting; transcript: TranscriptResult | null }>>>;
}

// ============================================================================
// NOTION INTEGRATION TYPES
// ============================================================================

export interface NotionPage {
	object: 'page';
	id: string;
	created_time: string;
	last_edited_time: string;
	archived: boolean;
	properties: Record<string, NotionProperty>;
	url: string;
	icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } } | null;
	cover?: { type: 'external'; external: { url: string } } | null;
}

export interface NotionDatabase {
	object: 'database';
	id: string;
	title: NotionRichText[];
	description: NotionRichText[];
	created_time: string;
	last_edited_time: string;
	properties: Record<string, NotionPropertySchema>;
	url: string;
	archived: boolean;
}

export interface NotionRichText {
	type: 'text' | 'mention' | 'equation';
	text?: { content: string; link?: { url: string } | null };
	plain_text: string;
	href?: string | null;
}

export interface NotionProperty {
	id: string;
	type: string;
	title?: NotionRichText[];
	rich_text?: NotionRichText[];
	number?: number | null;
	select?: { id: string; name: string; color: string } | null;
	multi_select?: Array<{ id: string; name: string; color: string }>;
	date?: { start: string; end?: string | null } | null;
	checkbox?: boolean;
	url?: string | null;
	email?: string | null;
	status?: { id: string; name: string; color: string } | null;
	people?: Array<{ object: 'user'; id: string }>;
	files?: Array<{ name: string; type: string; file?: { url: string }; external?: { url: string } }>;
	relation?: Array<{ id: string }>;
}

export interface NotionPropertySchema {
	id: string;
	name: string;
	type: string;
}

export interface NotionBlock {
	object: 'block';
	id: string;
	type: string;
	created_time: string;
	last_edited_time: string;
	has_children: boolean;
	archived: boolean;
}

export interface NotionIntegration {
	search(options?: {
		query?: string;
		filter?: { property: 'object'; value: 'page' | 'database' };
		sort?: { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' };
		start_cursor?: string;
		page_size?: number;
	}): Promise<ActionResult<Array<NotionPage | NotionDatabase>>>;

	getPage(options: { pageId: string }): Promise<ActionResult<NotionPage>>;

	createPage(options: {
		parentDatabaseId?: string;
		parentPageId?: string;
		properties: Record<string, unknown>;
		children?: NotionBlock[];
		icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } };
		cover?: { type: 'external'; external: { url: string } };
	}): Promise<ActionResult<NotionPage>>;

	updatePage(options: {
		pageId: string;
		properties?: Record<string, unknown>;
		archived?: boolean;
		icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } } | null;
		cover?: { type: 'external'; external: { url: string } } | null;
	}): Promise<ActionResult<NotionPage>>;

	queryDatabase(options: {
		databaseId: string;
		filter?: Record<string, unknown>;
		sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>;
		start_cursor?: string;
		page_size?: number;
	}): Promise<ActionResult<NotionPage[]>>;

	getDatabase(databaseId: string): Promise<ActionResult<NotionDatabase>>;

	getBlockChildren(options: {
		blockId: string;
		start_cursor?: string;
		page_size?: number;
	}): Promise<ActionResult<NotionBlock[]>>;

	createDocument(options: {
		database: string;
		template: 'summary' | 'report' | 'notes' | 'article' | 'meeting' | 'feedback' | 'custom';
		data: {
			title: string;
			summary?: string;
			date?: string;
			mood?: 'positive' | 'neutral' | 'concerned';
			properties?: Record<string, unknown>;
			sections?: Record<string, string[]>;
			content?: string;
			metadata?: Record<string, unknown>;
		};
		customBlocks?: unknown[];
	}): Promise<ActionResult<NotionPage>>;
}

// ============================================================================
// SLACK INTEGRATION TYPES
// ============================================================================

export interface SlackChannel {
	id: string;
	name: string;
	is_channel: boolean;
	is_private: boolean;
	is_archived: boolean;
	is_member: boolean;
	topic?: { value: string };
	purpose?: { value: string };
	num_members?: number;
}

export interface SlackMessage {
	type: string;
	ts: string;
	user?: string;
	bot_id?: string;
	subtype?: string;
	text: string;
	thread_ts?: string;
	reply_count?: number;
	reactions?: Array<{ name: string; count: number; users: string[] }>;
	attachments?: Array<{ id: number; fallback?: string; title?: string; text?: string }>;
	files?: Array<{ id: string; name: string; mimetype: string; size: number; url_private?: string }>;
}

export interface SlackUser {
	id: string;
	name: string;
	real_name?: string;
	profile?: { email?: string; display_name?: string; image_72?: string };
}

export interface SlackIntegration {
	listChannels(options?: {
		limit?: number;
		cursor?: string;
		excludeArchived?: boolean;
		types?: string;
	}): Promise<ActionResult<SlackChannel[]>>;

	getMessages(options: {
		channel: string;
		limit?: number;
		cursor?: string;
		since?: string | Date;
		oldest?: string;
		latest?: string;
		inclusive?: boolean;
		humanOnly?: boolean;
	}): Promise<ActionResult<SlackMessage[]>>;

	getMessage(channel: string, ts: string): Promise<ActionResult<SlackMessage>>;

	sendMessage(options: {
		channel: string;
		text: string;
		thread_ts?: string;
		reply_broadcast?: boolean;
		unfurl_links?: boolean;
		unfurl_media?: boolean;
	}): Promise<ActionResult<{ ts: string; channel: string }>>;

	getUser(options: { user: string }): Promise<ActionResult<SlackUser>>;

	searchMessages(
		query: string,
		options?: { count?: number; sort?: 'score' | 'timestamp' }
	): Promise<ActionResult<SlackMessage[]>>;
}

// ============================================================================
// STRIPE INTEGRATION TYPES (Simplified)
// ============================================================================

export interface StripeCustomer {
	id: string;
	email?: string;
	name?: string;
	phone?: string;
	created: number;
	metadata?: Record<string, string>;
}

export interface StripePaymentIntent {
	id: string;
	amount: number;
	currency: string;
	status: string;
	customer?: string;
	created: number;
	metadata?: Record<string, string>;
}

export interface StripeSubscription {
	id: string;
	customer: string;
	status: string;
	current_period_start: number;
	current_period_end: number;
	items: { data: Array<{ price: { id: string; product: string } }> };
}

export interface StripeIntegration {
	getCustomer(customerId: string): Promise<ActionResult<StripeCustomer>>;
	listCustomers(options?: { limit?: number; email?: string }): Promise<ActionResult<StripeCustomer[]>>;
	listPaymentIntents(options?: {
		limit?: number;
		customer?: string;
	}): Promise<ActionResult<StripePaymentIntent[]>>;
	listSubscriptions(options?: {
		limit?: number;
		customer?: string;
		status?: string;
	}): Promise<ActionResult<StripeSubscription[]>>;
}

// ============================================================================
// LINEAR INTEGRATION TYPES (Simplified)
// ============================================================================

export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	description?: string;
	priority: number;
	state: { id: string; name: string };
	assignee?: { id: string; name: string };
	createdAt: string;
	updatedAt: string;
}

export interface LinearTeam {
	id: string;
	name: string;
	key: string;
}

export interface LinearIntegration {
	createIssue(options: {
		teamId: string;
		title: string;
		description?: string;
		priority?: number;
		assigneeId?: string;
		labelIds?: string[];
	}): Promise<ActionResult<LinearIssue>>;

	getIssue(issueId: string): Promise<ActionResult<LinearIssue>>;

	updateIssue(
		issueId: string,
		options: {
			title?: string;
			description?: string;
			priority?: number;
			stateId?: string;
			assigneeId?: string;
		}
	): Promise<ActionResult<LinearIssue>>;

	listIssues(options?: {
		teamId?: string;
		assigneeId?: string;
		stateId?: string;
		limit?: number;
	}): Promise<ActionResult<LinearIssue[]>>;

	listTeams(): Promise<ActionResult<LinearTeam[]>>;
}

// ============================================================================
// GMAIL INTEGRATION TYPES (Simplified)
// ============================================================================

export interface GmailMessage {
	id: string;
	threadId: string;
	labelIds?: string[];
	snippet: string;
	payload?: {
		headers?: Array<{ name: string; value: string }>;
		body?: { data?: string };
		parts?: Array<{ mimeType: string; body?: { data?: string } }>;
	};
	internalDate?: string;
}

export interface GmailIntegration {
	listMessages(options?: {
		query?: string;
		maxResults?: number;
		labelIds?: string[];
		pageToken?: string;
	}): Promise<ActionResult<GmailMessage[]>>;

	getMessage(messageId: string): Promise<ActionResult<GmailMessage>>;

	sendMessage(options: {
		to: string | string[];
		subject: string;
		body: string;
		cc?: string | string[];
		bcc?: string | string[];
		replyTo?: string;
	}): Promise<ActionResult<{ id: string; threadId: string }>>;

	createDraft(options: {
		to: string | string[];
		subject: string;
		body: string;
	}): Promise<ActionResult<{ id: string }>>;
}

// ============================================================================
// WORKERS AI INTEGRATION TYPES
// ============================================================================

export interface AIIntegration {
	generateText(options: {
		model: string;
		prompt: string;
		max_tokens?: number;
		temperature?: number;
		system?: string;
	}): Promise<ActionResult<{ text: string; usage?: { input_tokens: number; output_tokens: number } }>>;

	embeddings(options: {
		model: string;
		text: string | string[];
	}): Promise<ActionResult<{ embeddings: number[][] }>>;
}

// ============================================================================
// COMBINED INTEGRATIONS MAP
// ============================================================================

/**
 * Map of all available integrations
 * Use this to type the integrations parameter in execute()
 */
export interface IntegrationsMap {
	zoom: ZoomIntegration;
	notion: NotionIntegration;
	slack: SlackIntegration;
	stripe: StripeIntegration;
	linear: LinearIntegration;
	gmail: GmailIntegration;
	ai: AIIntegration;
	// Add more integrations as they're documented
	[key: string]: unknown;
}

/**
 * Helper type to pick integrations for a workflow
 *
 * @example
 * ```typescript
 * type MyIntegrations = PickIntegrations<'zoom' | 'notion'>;
 * // Results in: { zoom: ZoomIntegration, notion: NotionIntegration }
 * ```
 */
export type PickIntegrations<K extends keyof IntegrationsMap> = Pick<IntegrationsMap, K>;

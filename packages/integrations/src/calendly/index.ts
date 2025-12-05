/**
 * Calendly Integration for WORKWAY
 *
 * Enables scheduling automation: sync booked meetings to Notion,
 * alert teams on Slack, create CRM contacts, and compound workflows.
 *
 * Key use cases:
 * - Meeting Scheduled → Notion log + Slack alert + CRM contact
 * - Meeting Canceled → Update records + notify team
 * - Available times → Dynamic scheduling links
 *
 * @example
 * ```typescript
 * import { Calendly } from '@workwayco/integrations/calendly';
 *
 * const calendly = new Calendly({ accessToken: tokens.calendly.access_token });
 *
 * // Get current user
 * const user = await calendly.getCurrentUser();
 *
 * // List scheduled events
 * const events = await calendly.listScheduledEvents({
 *   userUri: user.data.uri,
 *   status: 'active',
 * });
 *
 * // Verify webhook signature
 * const event = await calendly.verifyWebhook(payload, signature, signingKey);
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
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
 * Calendly integration configuration
 */
export interface CalendlyConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * Calendly user
 */
export interface CalendlyUser {
	uri: string;
	name: string;
	slug: string;
	email: string;
	scheduling_url: string;
	timezone: string;
	avatar_url: string | null;
	created_at: string;
	updated_at: string;
	current_organization: string;
	resource_type: 'User';
}

/**
 * Organization membership
 */
export interface CalendlyOrganizationMembership {
	uri: string;
	role: 'user' | 'admin' | 'owner';
	user: CalendlyUser;
	organization: string;
	updated_at: string;
	created_at: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event type (the template for scheduling)
 */
export interface CalendlyEventType {
	uri: string;
	name: string;
	active: boolean;
	booking_method: 'instant' | 'poll';
	slug: string;
	scheduling_url: string;
	duration: number;
	kind: 'solo' | 'group';
	pooling_type: 'round_robin' | 'collective' | null;
	type: 'StandardEventType' | 'AdhocEventType';
	color: string;
	created_at: string;
	updated_at: string;
	internal_note: string | null;
	description_plain: string | null;
	description_html: string | null;
	profile: {
		type: 'User' | 'Team';
		name: string;
		owner: string;
	};
	secret: boolean;
	admin_managed: boolean;
	custom_questions: CalendlyCustomQuestion[];
}

/**
 * Custom question on event type
 */
export interface CalendlyCustomQuestion {
	uuid: string;
	name: string;
	type: 'string' | 'text' | 'phone_number' | 'single_select' | 'multi_select';
	position: number;
	enabled: boolean;
	required: boolean;
	answer_choices?: string[];
	include_other?: boolean;
}

// ============================================================================
// SCHEDULED EVENT TYPES
// ============================================================================

/**
 * A scheduled event (a booked meeting)
 */
export interface CalendlyScheduledEvent {
	uri: string;
	name: string;
	meeting_notes_plain: string | null;
	meeting_notes_html: string | null;
	status: 'active' | 'canceled';
	start_time: string;
	end_time: string;
	event_type: string;
	location: CalendlyLocation | null;
	invitees_counter: {
		total: number;
		active: number;
		limit: number;
	};
	created_at: string;
	updated_at: string;
	event_memberships: CalendlyEventMembership[];
	event_guests: CalendlyEventGuest[];
	calendar_event: CalendlyCalendarEvent | null;
	cancellation?: CalendlyCancellation;
}

/**
 * Event location
 */
export interface CalendlyLocation {
	type: 'physical' | 'outbound_call' | 'inbound_call' | 'google_conference' | 'zoom' | 'microsoft_teams_conference' | 'webex_conference' | 'gotomeeting_conference' | 'custom';
	location?: string;
	additional_info?: string;
	join_url?: string;
	status?: 'initiated' | 'processing' | 'pushed' | 'failed';
	data?: Record<string, unknown>;
}

/**
 * Event membership (host)
 */
export interface CalendlyEventMembership {
	user: string;
	user_email: string;
	user_name: string;
}

/**
 * Event guest
 */
export interface CalendlyEventGuest {
	email: string;
	created_at: string;
	updated_at: string;
}

/**
 * Calendar event sync info
 */
export interface CalendlyCalendarEvent {
	kind: 'google' | 'outlook' | 'office365' | 'exchange' | 'icloud';
	external_id: string;
}

/**
 * Cancellation info
 */
export interface CalendlyCancellation {
	canceled_by: string;
	reason: string | null;
	canceler_type: 'host' | 'invitee';
	created_at: string;
}

// ============================================================================
// INVITEE TYPES
// ============================================================================

/**
 * Event invitee (the person who booked)
 */
export interface CalendlyInvitee {
	uri: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	name: string;
	status: 'active' | 'canceled';
	questions_and_answers: CalendlyQuestionAnswer[];
	timezone: string | null;
	event: string;
	created_at: string;
	updated_at: string;
	tracking: CalendlyTracking | null;
	text_reminder_number: string | null;
	rescheduled: boolean;
	old_invitee: string | null;
	new_invitee: string | null;
	cancel_url: string;
	reschedule_url: string;
	routing_form_submission: string | null;
	payment: CalendlyPayment | null;
	no_show: CalendlyNoShow | null;
	reconfirmation: CalendlyReconfirmation | null;
	cancellation?: CalendlyCancellation;
}

/**
 * Question and answer from booking
 */
export interface CalendlyQuestionAnswer {
	question: string;
	answer: string;
	position: number;
}

/**
 * UTM tracking parameters
 */
export interface CalendlyTracking {
	utm_campaign: string | null;
	utm_source: string | null;
	utm_medium: string | null;
	utm_content: string | null;
	utm_term: string | null;
	salesforce_uuid: string | null;
}

/**
 * Payment info
 */
export interface CalendlyPayment {
	external_id: string;
	provider: 'stripe' | 'paypal';
	amount: number;
	currency: string;
	terms: string | null;
	successful: boolean;
}

/**
 * No-show info
 */
export interface CalendlyNoShow {
	uri: string;
	created_at: string;
}

/**
 * Reconfirmation info
 */
export interface CalendlyReconfirmation {
	created_at: string;
	confirmed_at: string | null;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

/**
 * Webhook subscription
 */
export interface CalendlyWebhook {
	uri: string;
	callback_url: string;
	created_at: string;
	updated_at: string;
	retry_started_at: string | null;
	state: 'active' | 'disabled';
	events: CalendlyWebhookEventType[];
	scope: 'user' | 'organization';
	organization: string;
	user: string | null;
	creator: string;
}

/**
 * Webhook event types
 */
export type CalendlyWebhookEventType =
	| 'invitee.created'
	| 'invitee.canceled'
	| 'invitee_no_show.created'
	| 'routing_form_submission.created';

/**
 * Webhook event payload
 */
export interface CalendlyWebhookEvent {
	event: CalendlyWebhookEventType;
	created_at: string;
	created_by: string;
	payload: CalendlyWebhookPayload;
}

/**
 * Webhook payload (varies by event type)
 */
export interface CalendlyWebhookPayload {
	// For invitee events
	uri?: string;
	email?: string;
	name?: string;
	first_name?: string | null;
	last_name?: string | null;
	status?: 'active' | 'canceled';
	timezone?: string | null;
	event?: string;
	created_at?: string;
	updated_at?: string;
	questions_and_answers?: CalendlyQuestionAnswer[];
	tracking?: CalendlyTracking | null;
	cancel_url?: string;
	reschedule_url?: string;
	cancellation?: CalendlyCancellation;
	payment?: CalendlyPayment | null;
	no_show?: CalendlyNoShow | null;
	reconfirmation?: CalendlyReconfirmation | null;
	rescheduled?: boolean;
	old_invitee?: string | null;
	new_invitee?: string | null;
	routing_form_submission?: string | null;
	scheduled_event?: CalendlyScheduledEvent;
	// For routing form submissions
	submission_time?: string;
	submitter?: string;
	submitter_type?: 'ExternalUser';
	questions_and_responses?: Array<{
		question_uuid: string;
		question: string;
		answer: string;
	}>;
	routing_form?: string;
	result?: {
		type: 'event_type' | 'external_url' | 'custom_message';
		value?: string;
	};
}

// ============================================================================
// AVAILABLE TIMES TYPES
// ============================================================================

/**
 * Available time slot
 */
export interface CalendlyAvailableTime {
	status: 'available' | 'unavailable';
	invitees_remaining: number;
	start_time: string;
	scheduling_url: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

/**
 * Options for listing event types
 */
export interface ListEventTypesOptions {
	/** Filter by active status */
	active?: boolean;
	/** Organization URI */
	organization?: string;
	/** User URI */
	user?: string;
	/** Sort order */
	sort?: 'name:asc' | 'name:desc';
	/** Number of results (default: 20, max: 100) */
	count?: number;
	/** Pagination token */
	pageToken?: string;
}

/**
 * Options for listing scheduled events
 */
export interface ListScheduledEventsOptions {
	/** User URI (required if no organization) */
	user?: string;
	/** Organization URI (required if no user) */
	organization?: string;
	/** Filter by invitee email */
	inviteeEmail?: string;
	/** Event status filter */
	status?: 'active' | 'canceled';
	/** Min start time (ISO 8601) */
	minStartTime?: string;
	/** Max start time (ISO 8601) */
	maxStartTime?: string;
	/** Sort order */
	sort?: 'start_time:asc' | 'start_time:desc';
	/** Number of results (default: 20, max: 100) */
	count?: number;
	/** Pagination token */
	pageToken?: string;
}

/**
 * Options for listing invitees
 */
export interface ListInviteesOptions {
	/** Scheduled event UUID (required) */
	eventUuid: string;
	/** Filter by status */
	status?: 'active' | 'canceled';
	/** Sort order */
	sort?: 'created_at:asc' | 'created_at:desc';
	/** Filter by email */
	email?: string;
	/** Number of results (default: 20, max: 100) */
	count?: number;
	/** Pagination token */
	pageToken?: string;
}

/**
 * Options for getting available times
 */
export interface GetAvailableTimesOptions {
	/** Event type URI (required) */
	eventType: string;
	/** Start of range (ISO 8601) */
	startTime: string;
	/** End of range (ISO 8601) */
	endTime: string;
}

/**
 * Options for creating a webhook
 */
export interface CreateWebhookOptions {
	/** URL to receive webhook events */
	url: string;
	/** Events to subscribe to */
	events: CalendlyWebhookEventType[];
	/** Organization URI */
	organization: string;
	/** User URI (for user-scoped webhooks) */
	user?: string;
	/** Scope: 'user' or 'organization' */
	scope: 'user' | 'organization';
	/** Signing key for signature verification */
	signingKey?: string;
}

// ============================================================================
// PAGINATION TYPE
// ============================================================================

/**
 * Paginated response
 */
export interface CalendlyPaginatedResponse<T> {
	collection: T[];
	pagination: {
		count: number;
		next_page: string | null;
		previous_page: string | null;
		next_page_token: string | null;
		previous_page_token: string | null;
	};
}

// ============================================================================
// CALENDLY INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Calendly integration */
const handleError = createErrorHandler('calendly');

/**
 * Calendly Integration
 *
 * Weniger, aber besser: Scheduling data and webhooks for compound workflows.
 */
export class Calendly extends BaseAPIClient {
	constructor(config: CalendlyConfig) {
		validateAccessToken(config.accessToken, 'calendly');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.calendly.com',
			timeout: config.timeout,
		});
	}

	// ==========================================================================
	// USERS
	// ==========================================================================

	/**
	 * Get the current authenticated user
	 */
	async getCurrentUser(): Promise<ActionResult<CalendlyUser>> {
		try {
			const response = await this.get('/users/me');
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-current-user',
			});

			const data = (await response.json()) as { resource: CalendlyUser };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'get-current-user',
				schema: 'calendly.user.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-current-user');
		}
	}

	/**
	 * Get a user by URI
	 */
	async getUser(userUri: string): Promise<ActionResult<CalendlyUser>> {
		try {
			// Extract UUID from URI if full URI provided
			const uuid = this.extractUuid(userUri, 'users');
			const response = await this.get(`/users/${uuid}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-user',
			});

			const data = (await response.json()) as { resource: CalendlyUser };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'get-user',
				schema: 'calendly.user.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-user');
		}
	}

	// ==========================================================================
	// EVENT TYPES
	// ==========================================================================

	/**
	 * List event types
	 */
	async listEventTypes(
		options: ListEventTypesOptions = {}
	): Promise<ActionResult<CalendlyPaginatedResponse<CalendlyEventType>>> {
		try {
			const queryString = buildQueryString({
				active: options.active,
				organization: options.organization,
				user: options.user,
				sort: options.sort,
				count: options.count,
				page_token: options.pageToken,
			});

			const response = await this.get(`/event_types${queryString}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'list-event-types',
			});

			const data = (await response.json()) as CalendlyPaginatedResponse<CalendlyEventType>;

			return createActionResult({
				data,
				integration: 'calendly',
				action: 'list-event-types',
				schema: 'calendly.event-types.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-event-types');
		}
	}

	/**
	 * Get an event type by URI
	 */
	async getEventType(eventTypeUri: string): Promise<ActionResult<CalendlyEventType>> {
		try {
			const uuid = this.extractUuid(eventTypeUri, 'event_types');
			const response = await this.get(`/event_types/${uuid}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-event-type',
			});

			const data = (await response.json()) as { resource: CalendlyEventType };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'get-event-type',
				schema: 'calendly.event-type.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-event-type');
		}
	}

	// ==========================================================================
	// SCHEDULED EVENTS
	// ==========================================================================

	/**
	 * List scheduled events (booked meetings)
	 */
	async listScheduledEvents(
		options: ListScheduledEventsOptions = {}
	): Promise<ActionResult<CalendlyPaginatedResponse<CalendlyScheduledEvent>>> {
		if (!options.user && !options.organization) {
			return ActionResult.error(
				'Either user or organization URI is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'calendly', action: 'list-scheduled-events' }
			);
		}

		try {
			const queryString = buildQueryString({
				user: options.user,
				organization: options.organization,
				invitee_email: options.inviteeEmail,
				status: options.status,
				min_start_time: options.minStartTime,
				max_start_time: options.maxStartTime,
				sort: options.sort,
				count: options.count,
				page_token: options.pageToken,
			});

			const response = await this.get(`/scheduled_events${queryString}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'list-scheduled-events',
			});

			const data = (await response.json()) as CalendlyPaginatedResponse<CalendlyScheduledEvent>;

			return createActionResult({
				data,
				integration: 'calendly',
				action: 'list-scheduled-events',
				schema: 'calendly.scheduled-events.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-scheduled-events');
		}
	}

	/**
	 * Get a scheduled event by URI
	 */
	async getScheduledEvent(eventUri: string): Promise<ActionResult<CalendlyScheduledEvent>> {
		try {
			const uuid = this.extractUuid(eventUri, 'scheduled_events');
			const response = await this.get(`/scheduled_events/${uuid}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-scheduled-event',
			});

			const data = (await response.json()) as { resource: CalendlyScheduledEvent };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'get-scheduled-event',
				schema: 'calendly.scheduled-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-scheduled-event');
		}
	}

	/**
	 * Cancel a scheduled event
	 */
	async cancelScheduledEvent(
		eventUri: string,
		reason?: string
	): Promise<ActionResult<{ canceled: boolean }>> {
		try {
			const uuid = this.extractUuid(eventUri, 'scheduled_events');
			const response = await this.post(`/scheduled_events/${uuid}/cancellation`, {
				reason: reason || null,
			});
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'cancel-scheduled-event',
			});

			return createActionResult({
				data: { canceled: true },
				integration: 'calendly',
				action: 'cancel-scheduled-event',
				schema: 'calendly.cancel-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'cancel-scheduled-event');
		}
	}

	// ==========================================================================
	// INVITEES
	// ==========================================================================

	/**
	 * List invitees for a scheduled event
	 */
	async listInvitees(
		options: ListInviteesOptions
	): Promise<ActionResult<CalendlyPaginatedResponse<CalendlyInvitee>>> {
		if (!options.eventUuid) {
			return ActionResult.error(
				'Event UUID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'calendly', action: 'list-invitees' }
			);
		}

		try {
			const uuid = this.extractUuid(options.eventUuid, 'scheduled_events');
			const queryString = buildQueryString({
				status: options.status,
				sort: options.sort,
				email: options.email,
				count: options.count,
				page_token: options.pageToken,
			});

			const response = await this.get(`/scheduled_events/${uuid}/invitees${queryString}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'list-invitees',
			});

			const data = (await response.json()) as CalendlyPaginatedResponse<CalendlyInvitee>;

			return createActionResult({
				data,
				integration: 'calendly',
				action: 'list-invitees',
				schema: 'calendly.invitees.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-invitees');
		}
	}

	/**
	 * Get an invitee by URI
	 */
	async getInvitee(inviteeUri: string): Promise<ActionResult<CalendlyInvitee>> {
		try {
			// Invitee URIs have a different format: /scheduled_events/{event_uuid}/invitees/{invitee_uuid}
			const uri = inviteeUri.startsWith('http') ? new URL(inviteeUri).pathname : inviteeUri;
			const response = await this.get(uri);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-invitee',
			});

			const data = (await response.json()) as { resource: CalendlyInvitee };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'get-invitee',
				schema: 'calendly.invitee.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-invitee');
		}
	}

	/**
	 * Mark an invitee as a no-show
	 */
	async markNoShow(inviteeUri: string): Promise<ActionResult<CalendlyNoShow>> {
		try {
			const response = await this.post('/invitee_no_shows', {
				invitee: inviteeUri,
			});
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'mark-no-show',
			});

			const data = (await response.json()) as { resource: CalendlyNoShow };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'mark-no-show',
				schema: 'calendly.no-show.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'mark-no-show');
		}
	}

	/**
	 * Remove a no-show marking
	 */
	async removeNoShow(noShowUri: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const uuid = this.extractUuid(noShowUri, 'invitee_no_shows');
			const response = await this.delete(`/invitee_no_shows/${uuid}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'remove-no-show',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'calendly',
				action: 'remove-no-show',
				schema: 'calendly.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'remove-no-show');
		}
	}

	// ==========================================================================
	// AVAILABLE TIMES
	// ==========================================================================

	/**
	 * Get available times for an event type
	 */
	async getAvailableTimes(
		options: GetAvailableTimesOptions
	): Promise<ActionResult<CalendlyAvailableTime[]>> {
		if (!options.eventType) {
			return ActionResult.error(
				'Event type URI is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'calendly', action: 'get-available-times' }
			);
		}

		try {
			const queryString = buildQueryString({
				event_type: options.eventType,
				start_time: options.startTime,
				end_time: options.endTime,
			});

			const response = await this.get(`/event_type_available_times${queryString}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-available-times',
			});

			const data = (await response.json()) as { collection: CalendlyAvailableTime[] };

			return createActionResult({
				data: data.collection,
				integration: 'calendly',
				action: 'get-available-times',
				schema: 'calendly.available-times.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-available-times');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * List webhook subscriptions
	 */
	async listWebhooks(
		options: { organization: string; user?: string; scope: 'user' | 'organization' }
	): Promise<ActionResult<CalendlyPaginatedResponse<CalendlyWebhook>>> {
		try {
			const queryString = buildQueryString({
				organization: options.organization,
				user: options.user,
				scope: options.scope,
			});

			const response = await this.get(`/webhook_subscriptions${queryString}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'list-webhooks',
			});

			const data = (await response.json()) as CalendlyPaginatedResponse<CalendlyWebhook>;

			return createActionResult({
				data,
				integration: 'calendly',
				action: 'list-webhooks',
				schema: 'calendly.webhooks.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-webhooks');
		}
	}

	/**
	 * Get a webhook by URI
	 */
	async getWebhook(webhookUri: string): Promise<ActionResult<CalendlyWebhook>> {
		try {
			const uuid = this.extractUuid(webhookUri, 'webhook_subscriptions');
			const response = await this.get(`/webhook_subscriptions/${uuid}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'get-webhook',
			});

			const data = (await response.json()) as { resource: CalendlyWebhook };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'get-webhook',
				schema: 'calendly.webhook.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-webhook');
		}
	}

	/**
	 * Create a webhook subscription
	 */
	async createWebhook(options: CreateWebhookOptions): Promise<ActionResult<CalendlyWebhook>> {
		if (!options.url) {
			return ActionResult.error(
				'Webhook URL is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'calendly', action: 'create-webhook' }
			);
		}

		if (!options.events?.length) {
			return ActionResult.error(
				'At least one event type is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'calendly', action: 'create-webhook' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				url: options.url,
				events: options.events,
				organization: options.organization,
				scope: options.scope,
			};

			if (options.user) {
				body.user = options.user;
			}

			if (options.signingKey) {
				body.signing_key = options.signingKey;
			}

			const response = await this.post('/webhook_subscriptions', body);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'create-webhook',
			});

			const data = (await response.json()) as { resource: CalendlyWebhook };

			return createActionResult({
				data: data.resource,
				integration: 'calendly',
				action: 'create-webhook',
				schema: 'calendly.webhook.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-webhook');
		}
	}

	/**
	 * Delete a webhook subscription
	 */
	async deleteWebhook(webhookUri: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const uuid = this.extractUuid(webhookUri, 'webhook_subscriptions');
			const response = await this.delete(`/webhook_subscriptions/${uuid}`);
			await assertResponseOk(response, {
				integration: 'calendly',
				action: 'delete-webhook',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'calendly',
				action: 'delete-webhook',
				schema: 'calendly.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-webhook');
		}
	}

	// ==========================================================================
	// WEBHOOK VERIFICATION
	// ==========================================================================

	/**
	 * Verify and parse a webhook event
	 *
	 * Calendly signs webhooks with HMAC SHA-256.
	 * Header: Calendly-Webhook-Signature
	 * Format: t={timestamp},v1={signature}
	 *
	 * @param payload - Raw request body as string
	 * @param signature - Value of Calendly-Webhook-Signature header
	 * @param signingKey - Webhook signing key from webhook creation
	 */
	async verifyWebhook(
		payload: string,
		signature: string,
		signingKey: string
	): Promise<ActionResult<CalendlyWebhookEvent>> {
		try {
			// 1. Validate inputs
			if (!payload) {
				return ActionResult.error(
					'Webhook payload is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}

			if (!signature) {
				return ActionResult.error(
					'Webhook signature is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}

			if (!signingKey) {
				return ActionResult.error(
					'Signing key is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}

			// 2. Parse signature header (format: t={timestamp},v1={signature})
			const parts = signature.split(',');
			let timestamp: string | null = null;
			let providedSignature: string | null = null;

			for (const part of parts) {
				const [key, value] = part.split('=');
				if (key === 't') timestamp = value;
				if (key === 'v1') providedSignature = value;
			}

			if (!timestamp || !providedSignature) {
				return ActionResult.error(
					'Invalid signature format - expected t={timestamp},v1={signature}',
					ErrorCode.AUTH_INVALID,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}

			// 3. Check timestamp (within 3 minutes to prevent replay attacks)
			const timestampMs = parseInt(timestamp, 10) * 1000;
			const tolerance = 3 * 60 * 1000; // 3 minutes
			if (Math.abs(Date.now() - timestampMs) > tolerance) {
				return ActionResult.error(
					'Webhook timestamp is too old',
					ErrorCode.AUTH_INVALID,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}

			// 4. Compute expected signature
			// Calendly: signature = HMAC-SHA256(timestamp + '.' + payload)
			const signedPayload = `${timestamp}.${payload}`;
			const expectedSignature = await this.computeHmacSha256Hex(signedPayload, signingKey);

			// 5. Compare signatures (constant time)
			if (!this.secureCompare(providedSignature, expectedSignature)) {
				return ActionResult.error(
					'Invalid webhook signature',
					ErrorCode.AUTH_INVALID,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}

			// 6. Parse and return event
			const event = JSON.parse(payload) as CalendlyWebhookEvent;

			return createActionResult({
				data: event,
				integration: 'calendly',
				action: 'verify-webhook',
				schema: 'calendly.webhook-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			if (error instanceof SyntaxError) {
				return ActionResult.error(
					'Invalid webhook payload JSON',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'calendly', action: 'verify-webhook' }
				);
			}
			return handleError(error, 'verify-webhook');
		}
	}

	/**
	 * Parse webhook event without verification
	 * Use only for development/testing
	 */
	parseWebhookUnsafe(payload: string): ActionResult<CalendlyWebhookEvent> {
		try {
			const event = JSON.parse(payload) as CalendlyWebhookEvent;

			return createActionResult({
				data: event,
				integration: 'calendly',
				action: 'parse-webhook-unsafe',
				schema: 'calendly.webhook-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			if (error instanceof SyntaxError) {
				return ActionResult.error(
					'Invalid webhook payload JSON',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'calendly', action: 'parse-webhook-unsafe' }
				);
			}
			return handleError(error, 'parse-webhook-unsafe');
		}
	}

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	/**
	 * Extract meeting details from a webhook event for easy consumption
	 *
	 * Zuhandenheit: Developer thinks "get meeting details"
	 * not "navigate nested webhook payload structure"
	 */
	static extractMeetingDetails(event: CalendlyWebhookEvent): {
		eventType: CalendlyWebhookEventType;
		inviteeName: string;
		inviteeEmail: string;
		eventName: string | null;
		startTime: string | null;
		endTime: string | null;
		location: string | null;
		joinUrl: string | null;
		cancelUrl: string | null;
		rescheduleUrl: string | null;
		questionsAndAnswers: Record<string, string>;
		timezone: string | null;
		isCanceled: boolean;
		cancellationReason: string | null;
	} {
		const payload = event.payload;
		const scheduledEvent = payload.scheduled_event;

		// Extract Q&A as simple object
		const questionsAndAnswers: Record<string, string> = {};
		if (payload.questions_and_answers) {
			for (const qa of payload.questions_and_answers) {
				questionsAndAnswers[qa.question] = qa.answer;
			}
		}

		return {
			eventType: event.event,
			inviteeName: payload.name || '',
			inviteeEmail: payload.email || '',
			eventName: scheduledEvent?.name || null,
			startTime: scheduledEvent?.start_time || null,
			endTime: scheduledEvent?.end_time || null,
			location: scheduledEvent?.location?.location || null,
			joinUrl: scheduledEvent?.location?.join_url || null,
			cancelUrl: payload.cancel_url || null,
			rescheduleUrl: payload.reschedule_url || null,
			questionsAndAnswers,
			timezone: payload.timezone || null,
			isCanceled: payload.status === 'canceled' || event.event === 'invitee.canceled',
			cancellationReason: payload.cancellation?.reason || null,
		};
	}

	/**
	 * Format meeting time for display
	 */
	static formatMeetingTime(startTime: string, endTime: string, timezone?: string): string {
		const start = new Date(startTime);
		const end = new Date(endTime);

		const options: Intl.DateTimeFormatOptions = {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: timezone || 'UTC',
		};

		const endOptions: Intl.DateTimeFormatOptions = {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: timezone || 'UTC',
		};

		return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleTimeString('en-US', endOptions)}`;
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Extract UUID from Calendly URI
	 * URIs are formatted as: https://api.calendly.com/{resource}/{uuid}
	 */
	private extractUuid(uriOrUuid: string, expectedResource: string): string {
		if (!uriOrUuid.includes('/')) {
			return uriOrUuid; // Already a UUID
		}

		const url = uriOrUuid.startsWith('http') ? new URL(uriOrUuid) : null;
		const path = url ? url.pathname : uriOrUuid;
		const parts = path.split('/').filter(Boolean);

		// Expected format: /{resource}/{uuid}
		const resourceIndex = parts.indexOf(expectedResource);
		if (resourceIndex >= 0 && parts[resourceIndex + 1]) {
			return parts[resourceIndex + 1];
		}

		// Fallback: return last segment
		return parts[parts.length - 1];
	}

	/**
	 * Compute HMAC SHA-256 signature in hex (Calendly's format)
	 */
	private async computeHmacSha256Hex(payload: string, secret: string): Promise<string> {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const signatureBuffer = await crypto.subtle.sign(
			'HMAC',
			key,
			encoder.encode(payload)
		);

		// Convert to hex
		const bytes = new Uint8Array(signatureBuffer);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Constant-time string comparison to prevent timing attacks
	 */
	private secureCompare(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}
		return result === 0;
	}

	/**
	 * Get capabilities for Calendly actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: false,
			supportsSearch: false,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true, // Events have invitees
			supportsMetadata: true,
		};
	}
}

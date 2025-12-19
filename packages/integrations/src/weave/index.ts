/**
 * Weave Integration for WORKWAY
 *
 * Patient communication platform for dental and medical practices.
 * Designed for automated patient outreach - SMS reminders, review requests,
 * and missed call follow-ups.
 *
 * Zuhandenheit: "Reviews that request themselves" not "POST /messages endpoint"
 *
 * @example
 * ```typescript
 * import { Weave } from '@workwayco/integrations/weave';
 *
 * const weave = new Weave({
 *   apiKey: env.WEAVE_API_KEY,
 *   locationId: 'loc_123',
 * });
 *
 * // Send appointment reminder
 * await weave.sendAppointmentReminder({
 *   patientPhone: '+15551234567',
 *   patientName: 'John',
 *   appointmentTime: '2024-01-15T10:00:00Z',
 *   practiceName: 'Smile Dental',
 * });
 *
 * // Request review after visit
 * await weave.requestReview({
 *   patientPhone: '+15551234567',
 *   patientName: 'John',
 *   reviewUrl: 'https://g.page/r/...',
 * });
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
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Weave integration configuration
 */
export interface WeaveConfig {
	/** API key */
	apiKey: string;
	/** Location ID */
	locationId: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Weave Message
 */
export interface WVMessage {
	id: string;
	location_id: string;
	thread_id: string;
	direction: 'inbound' | 'outbound';
	body: string;
	status: WVMessageStatus;
	phone_number: string;
	patient_id?: string;
	created_at: string;
	updated_at: string;
	delivered_at?: string;
	read_at?: string;
}

/**
 * Weave Message Status
 */
export type WVMessageStatus =
	| 'queued'
	| 'sending'
	| 'sent'
	| 'delivered'
	| 'failed'
	| 'received';

/**
 * Weave Thread (conversation)
 */
export interface WVThread {
	id: string;
	location_id: string;
	phone_number: string;
	patient_id?: string;
	patient_name?: string;
	last_message_at: string;
	unread_count: number;
	status: 'active' | 'archived';
}

/**
 * Weave Review Request
 */
export interface WVReviewRequest {
	id: string;
	location_id: string;
	patient_phone: string;
	patient_name?: string;
	review_url: string;
	status: 'pending' | 'sent' | 'clicked' | 'completed' | 'failed';
	sent_at?: string;
	clicked_at?: string;
	completed_at?: string;
	created_at: string;
}

/**
 * Weave Call Log
 */
export interface WVCallLog {
	id: string;
	location_id: string;
	direction: 'inbound' | 'outbound';
	phone_number: string;
	caller_id?: string;
	status: 'answered' | 'missed' | 'voicemail' | 'busy' | 'failed';
	duration?: number;
	recording_url?: string;
	patient_id?: string;
	started_at: string;
	ended_at?: string;
}

/**
 * Weave Patient (contact)
 */
export interface WVPatient {
	id: string;
	location_id: string;
	first_name: string;
	last_name: string;
	phone_number: string;
	email?: string;
	date_of_birth?: string;
	external_id?: string;
	tags?: string[];
	created_at: string;
	updated_at: string;
}

/**
 * Weave Location
 */
export interface WVLocation {
	id: string;
	name: string;
	phone_number: string;
	address?: {
		line1?: string;
		city?: string;
		state?: string;
		zip?: string;
	};
	timezone: string;
	review_url?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface SendMessageOptions {
	/** Recipient phone number (E.164 format) */
	phoneNumber: string;
	/** Message body */
	body: string;
	/** Patient ID (optional, for linking) */
	patientId?: string;
}

export interface SendAppointmentReminderOptions {
	/** Patient phone number */
	patientPhone: string;
	/** Patient first name */
	patientName: string;
	/** Appointment time (ISO string) */
	appointmentTime: string;
	/** Practice name */
	practiceName: string;
	/** Provider name (optional) */
	providerName?: string;
	/** Custom message (optional, uses template if not provided) */
	customMessage?: string;
	/** Include confirmation reply option */
	includeConfirmation?: boolean;
}

export interface RequestReviewOptions {
	/** Patient phone number */
	patientPhone: string;
	/** Patient first name */
	patientName: string;
	/** Review URL (Google, Yelp, etc.) */
	reviewUrl?: string;
	/** Practice name */
	practiceName?: string;
	/** Custom message (optional) */
	customMessage?: string;
	/** Delay before sending (minutes) */
	delayMinutes?: number;
}

export interface ListMessagesOptions {
	/** Filter by phone number */
	phoneNumber?: string;
	/** Filter by thread ID */
	threadId?: string;
	/** Filter by direction */
	direction?: 'inbound' | 'outbound';
	/** Start date (ISO string) */
	startDate?: string;
	/** End date (ISO string) */
	endDate?: string;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

export interface ListCallsOptions {
	/** Filter by phone number */
	phoneNumber?: string;
	/** Filter by status */
	status?: 'answered' | 'missed' | 'voicemail';
	/** Start date (ISO string) */
	startDate?: string;
	/** End date (ISO string) */
	endDate?: string;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

export interface GetMissedCallsOptions {
	/** Time window in hours (default: 24) */
	hoursBack?: number;
	/** Only return calls not yet followed up */
	unfollowedOnly?: boolean;
}

// ============================================================================
// WEAVE INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Weave integration */
const handleError = createErrorHandler('weave');

/**
 * Weave Patient Communication Integration
 *
 * Weniger, aber besser: Unified patient messaging for practice automation.
 */
export class Weave extends BaseAPIClient {
	private readonly locationId: string;

	constructor(config: WeaveConfig) {
		if (!config.apiKey) {
			throw new Error('Weave API key is required');
		}

		if (!config.locationId) {
			throw new Error('Weave location ID is required');
		}

		super({
			accessToken: config.apiKey,
			apiUrl: config.apiUrl || 'https://api.getweave.com/v1',
			timeout: config.timeout,
			errorContext: { integration: 'weave' },
		});

		this.locationId = config.locationId;
	}

	// ==========================================================================
	// MESSAGES
	// ==========================================================================

	/**
	 * Send a text message
	 */
	async sendMessage(options: SendMessageOptions): Promise<ActionResult<WVMessage>> {
		const { phoneNumber, body, patientId } = options;

		if (!phoneNumber || !body) {
			return ActionResult.error('Phone number and message body are required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'weave',
				action: 'send-message',
			});
		}

		try {
			const messageData: Record<string, unknown> = {
				location_id: this.locationId,
				phone_number: this.normalizePhone(phoneNumber),
				body,
			};

			if (patientId) {
				messageData.patient_id = patientId;
			}

			const response = await this.post('/messages', messageData);
			await assertResponseOk(response, { integration: 'weave', action: 'send-message' });

			const data = (await response.json()) as { data: WVMessage };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'send-message',
				schema: 'weave.message.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'send-message');
		}
	}

	/**
	 * Send appointment reminder (Zuhandenheit API)
	 *
	 * Outcome-focused: "Remind patient about their appointment"
	 */
	async sendAppointmentReminder(options: SendAppointmentReminderOptions): Promise<ActionResult<WVMessage>> {
		const {
			patientPhone,
			patientName,
			appointmentTime,
			practiceName,
			providerName,
			customMessage,
			includeConfirmation = true,
		} = options;

		const appointmentDate = new Date(appointmentTime);
		const dateStr = appointmentDate.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
		});
		const timeStr = appointmentDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
		});

		let message = customMessage;

		if (!message) {
			message = `Hi ${patientName}! This is a reminder about your appointment at ${practiceName}`;
			if (providerName) {
				message += ` with ${providerName}`;
			}
			message += ` on ${dateStr} at ${timeStr}.`;

			if (includeConfirmation) {
				message += ' Reply YES to confirm or call us to reschedule.';
			}
		}

		return this.sendMessage({
			phoneNumber: patientPhone,
			body: message,
		});
	}

	/**
	 * Send no-show follow-up (Zuhandenheit API)
	 *
	 * Outcome-focused: "Follow up with patient who missed appointment"
	 */
	async sendNoShowFollowUp(options: {
		patientPhone: string;
		patientName: string;
		practiceName: string;
		customMessage?: string;
	}): Promise<ActionResult<WVMessage>> {
		const { patientPhone, patientName, practiceName, customMessage } = options;

		const message = customMessage ||
			`Hi ${patientName}, we missed you at your appointment today at ${practiceName}. ` +
			`Please call us to reschedule - your oral health is important to us!`;

		return this.sendMessage({
			phoneNumber: patientPhone,
			body: message,
		});
	}

	/**
	 * List messages with optional filters
	 */
	async listMessages(options: ListMessagesOptions = {}): Promise<ActionResult<WVMessage[]>> {
		const { phoneNumber, threadId, direction, startDate, endDate, page = 1, perPage = 50 } = options;

		try {
			const params: Record<string, string | number | undefined> = {
				location_id: this.locationId,
				page,
				per_page: perPage,
			};

			if (phoneNumber) params.phone_number = this.normalizePhone(phoneNumber);
			if (threadId) params.thread_id = threadId;
			if (direction) params.direction = direction;
			if (startDate) params.start_date = startDate;
			if (endDate) params.end_date = endDate;

			const response = await this.get(`/messages${buildQueryString(params)}`);
			await assertResponseOk(response, { integration: 'weave', action: 'list-messages' });

			const data = (await response.json()) as { data: WVMessage[] };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'list-messages',
				schema: 'weave.message-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-messages');
		}
	}

	/**
	 * Get message threads (conversations)
	 */
	async listThreads(options: { page?: number; perPage?: number } = {}): Promise<ActionResult<WVThread[]>> {
		const { page = 1, perPage = 50 } = options;

		try {
			const response = await this.get(
				`/threads${buildQueryString({ location_id: this.locationId, page, per_page: perPage })}`
			);
			await assertResponseOk(response, { integration: 'weave', action: 'list-threads' });

			const data = (await response.json()) as { data: WVThread[] };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'list-threads',
				schema: 'weave.thread-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-threads');
		}
	}

	/**
	 * Get unread message count (Zuhandenheit API)
	 *
	 * Outcome-focused: "Do I have messages to respond to?"
	 */
	async getUnreadCount(): Promise<ActionResult<{ count: number; threads: WVThread[] }>> {
		try {
			const result = await this.listThreads({ perPage: 100 });
			if (!result.success) {
				return ActionResult.error(
					result.error?.message || 'Failed to get threads',
					result.error?.code || ErrorCode.API_ERROR,
					{ integration: 'weave', action: 'get-unread-count' }
				);
			}

			const unreadThreads = result.data.filter(t => t.unread_count > 0);
			const totalUnread = unreadThreads.reduce((sum, t) => sum + t.unread_count, 0);

			return createActionResult({
				data: { count: totalUnread, threads: unreadThreads },
				integration: 'weave',
				action: 'get-unread-count',
				schema: 'weave.unread-summary.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-unread-count');
		}
	}

	// ==========================================================================
	// REVIEWS
	// ==========================================================================

	/**
	 * Request a review (Zuhandenheit API)
	 *
	 * Outcome-focused: "Ask satisfied patient for a review"
	 */
	async requestReview(options: RequestReviewOptions): Promise<ActionResult<WVReviewRequest>> {
		const { patientPhone, patientName, reviewUrl, practiceName, customMessage, delayMinutes } = options;

		if (!patientPhone || !patientName) {
			return ActionResult.error('Patient phone and name are required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'weave',
				action: 'request-review',
			});
		}

		try {
			const requestData: Record<string, unknown> = {
				location_id: this.locationId,
				patient_phone: this.normalizePhone(patientPhone),
				patient_name: patientName,
			};

			if (reviewUrl) {
				requestData.review_url = reviewUrl;
			}

			if (customMessage) {
				requestData.custom_message = customMessage;
			} else if (practiceName) {
				requestData.custom_message =
					`Hi ${patientName}! Thank you for visiting ${practiceName} today. ` +
					`We'd love to hear about your experience. Would you mind leaving us a quick review?`;
			}

			if (delayMinutes) {
				requestData.send_at = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
			}

			const response = await this.post('/review_requests', requestData);
			await assertResponseOk(response, { integration: 'weave', action: 'request-review' });

			const data = (await response.json()) as { data: WVReviewRequest };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'request-review',
				schema: 'weave.review-request.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'request-review');
		}
	}

	/**
	 * List review requests
	 */
	async listReviewRequests(options: {
		status?: 'pending' | 'sent' | 'clicked' | 'completed';
		page?: number;
		perPage?: number;
	} = {}): Promise<ActionResult<WVReviewRequest[]>> {
		const { status, page = 1, perPage = 50 } = options;

		try {
			const params: Record<string, string | number | undefined> = {
				location_id: this.locationId,
				page,
				per_page: perPage,
			};

			if (status) params.status = status;

			const response = await this.get(`/review_requests${buildQueryString(params)}`);
			await assertResponseOk(response, { integration: 'weave', action: 'list-review-requests' });

			const data = (await response.json()) as { data: WVReviewRequest[] };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'list-review-requests',
				schema: 'weave.review-request-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-review-requests');
		}
	}

	/**
	 * Get review request stats (Zuhandenheit API)
	 *
	 * Outcome-focused: "How are our review requests performing?"
	 */
	async getReviewStats(days = 30): Promise<ActionResult<{
		sent: number;
		clicked: number;
		completed: number;
		clickRate: number;
		completionRate: number;
	}>> {
		try {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			const result = await this.listReviewRequests({ perPage: 1000 });
			if (!result.success) {
				return ActionResult.error(
					result.error?.message || 'Failed to get review requests',
					result.error?.code || ErrorCode.API_ERROR,
					{ integration: 'weave', action: 'get-review-stats' }
				);
			}

			// Filter to date range
			const requests = result.data.filter(r => {
				const createdAt = new Date(r.created_at);
				return createdAt >= startDate;
			});

			const sent = requests.filter(r => r.status !== 'pending').length;
			const clicked = requests.filter(r => r.clicked_at).length;
			const completed = requests.filter(r => r.status === 'completed').length;

			return createActionResult({
				data: {
					sent,
					clicked,
					completed,
					clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
					completionRate: sent > 0 ? Math.round((completed / sent) * 100) : 0,
				},
				integration: 'weave',
				action: 'get-review-stats',
				schema: 'weave.review-stats.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-review-stats');
		}
	}

	// ==========================================================================
	// CALLS
	// ==========================================================================

	/**
	 * List call logs
	 */
	async listCalls(options: ListCallsOptions = {}): Promise<ActionResult<WVCallLog[]>> {
		const { phoneNumber, status, startDate, endDate, page = 1, perPage = 50 } = options;

		try {
			const params: Record<string, string | number | undefined> = {
				location_id: this.locationId,
				page,
				per_page: perPage,
			};

			if (phoneNumber) params.phone_number = this.normalizePhone(phoneNumber);
			if (status) params.status = status;
			if (startDate) params.start_date = startDate;
			if (endDate) params.end_date = endDate;

			const response = await this.get(`/calls${buildQueryString(params)}`);
			await assertResponseOk(response, { integration: 'weave', action: 'list-calls' });

			const data = (await response.json()) as { data: WVCallLog[] };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'list-calls',
				schema: 'weave.call-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-calls');
		}
	}

	/**
	 * Get missed calls (Zuhandenheit API)
	 *
	 * Outcome-focused: "Who do I need to call back?"
	 */
	async getMissedCalls(options: GetMissedCallsOptions = {}): Promise<ActionResult<WVCallLog[]>> {
		const { hoursBack = 24 } = options;

		const startDate = new Date();
		startDate.setHours(startDate.getHours() - hoursBack);

		const result = await this.listCalls({
			status: 'missed',
			startDate: startDate.toISOString(),
			perPage: 100,
		});

		if (!result.success) return result;

		return createActionResult({
			data: result.data,
			integration: 'weave',
			action: 'get-missed-calls',
			schema: 'weave.call-list.v1',
			capabilities: this.getCapabilities(),
		});
	}

	/**
	 * Send missed call follow-up (Zuhandenheit API)
	 *
	 * Outcome-focused: "Follow up with caller we missed"
	 */
	async sendMissedCallFollowUp(options: {
		phoneNumber: string;
		practiceName: string;
		customMessage?: string;
	}): Promise<ActionResult<WVMessage>> {
		const { phoneNumber, practiceName, customMessage } = options;

		const message = customMessage ||
			`Hi! We missed your call at ${practiceName}. How can we help you today? ` +
			`Reply to this message or call us back at your convenience.`;

		return this.sendMessage({
			phoneNumber,
			body: message,
		});
	}

	// ==========================================================================
	// PATIENTS (CONTACTS)
	// ==========================================================================

	/**
	 * Get patient by phone number
	 */
	async getPatientByPhone(phoneNumber: string): Promise<ActionResult<WVPatient | null>> {
		try {
			const response = await this.get(
				`/patients${buildQueryString({
					location_id: this.locationId,
					phone_number: this.normalizePhone(phoneNumber),
				})}`
			);
			await assertResponseOk(response, { integration: 'weave', action: 'get-patient-by-phone' });

			const data = (await response.json()) as { data: WVPatient[] };

			return createActionResult({
				data: data.data[0] || null,
				integration: 'weave',
				action: 'get-patient-by-phone',
				schema: 'weave.patient.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-patient-by-phone');
		}
	}

	/**
	 * Search patients
	 */
	async searchPatients(query: string): Promise<ActionResult<WVPatient[]>> {
		try {
			const response = await this.get(
				`/patients${buildQueryString({
					location_id: this.locationId,
					query,
				})}`
			);
			await assertResponseOk(response, { integration: 'weave', action: 'search-patients' });

			const data = (await response.json()) as { data: WVPatient[] };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'search-patients',
				schema: 'weave.patient-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'search-patients');
		}
	}

	// ==========================================================================
	// LOCATION
	// ==========================================================================

	/**
	 * Get location details
	 */
	async getLocation(): Promise<ActionResult<WVLocation>> {
		try {
			const response = await this.get(`/locations/${this.locationId}`);
			await assertResponseOk(response, { integration: 'weave', action: 'get-location' });

			const data = (await response.json()) as { data: WVLocation };

			return createActionResult({
				data: data.data,
				integration: 'weave',
				action: 'get-location',
				schema: 'weave.location.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-location');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * Verify Weave webhook signature
	 */
	async verifyWebhook(
		payload: string,
		signature: string,
		secret: string
	): Promise<ActionResult<{ valid: boolean; event: WVWebhookEvent | null }>> {
		try {
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(secret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
			const computedSignature = Array.from(new Uint8Array(signatureBuffer))
				.map(b => b.toString(16).padStart(2, '0'))
				.join('');

			if (computedSignature !== signature) {
				return createActionResult({
					data: { valid: false, event: null },
					integration: 'weave',
					action: 'verify-webhook',
					schema: 'weave.webhook-result.v1',
					capabilities: this.getCapabilities(),
				});
			}

			const event = JSON.parse(payload) as WVWebhookEvent;

			return createActionResult({
				data: { valid: true, event },
				integration: 'weave',
				action: 'verify-webhook',
				schema: 'weave.webhook-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'verify-webhook');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Normalize phone number to E.164 format
	 */
	private normalizePhone(phone: string): string {
		// Remove all non-digits
		const digits = phone.replace(/\D/g, '');

		// Add +1 if US number without country code
		if (digits.length === 10) {
			return `+1${digits}`;
		}

		// Add + if missing
		if (!phone.startsWith('+')) {
			return `+${digits}`;
		}

		return phone;
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: false,
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WVWebhookEvent {
	event: string;
	location_id: string;
	data: {
		message?: WVMessage;
		call?: WVCallLog;
		review_request?: WVReviewRequest;
	};
	created_at: string;
}

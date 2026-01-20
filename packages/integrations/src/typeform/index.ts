/**
 * Typeform Integration for WORKWAY
 *
 * Enables form response syncing to Notion, Slack notifications on submissions,
 * and compound workflows that go beyond Typeform's native one-form-per-workspace limit.
 *
 * Key differentiators over native Typeform → Notion integration:
 * - Multiple forms per Notion workspace
 * - Connect to existing databases
 * - Compound workflows (Notion + Slack + CRM + Email)
 * - Conditional routing based on response content
 *
 * @example
 * ```typescript
 * import { Typeform } from '@workwayco/integrations/typeform';
 *
 * const typeform = new Typeform({ accessToken: tokens.typeform.access_token });
 *
 * // List all forms
 * const forms = await typeform.listForms();
 *
 * // Get responses for a form
 * const responses = await typeform.getResponses({
 *   formId: 'abc123',
 *   since: '2024-01-01T00:00:00Z',
 * });
 *
 * // Verify webhook signature
 * const event = await typeform.verifyWebhook(payload, signature, secret);
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
	secureCompare,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Typeform integration configuration
 */
export interface TypeformConfig {
	/** OAuth access token or personal access token */
	accessToken: string;
	/** Optional: Override API endpoint (for EU data center: https://api.eu.typeform.com) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ============================================================================
// FORM TYPES
// ============================================================================

/**
 * Typeform form (typeform) object
 */
export interface TypeformForm {
	id: string;
	title: string;
	type: 'quiz' | 'form';
	workspace: {
		href: string;
	};
	theme: {
		href: string;
	};
	settings: TypeformSettings;
	fields?: TypeformField[];
	created_at: string;
	last_updated_at: string;
	published_at?: string;
	_links: {
		display: string;
	};
}

/**
 * Form settings
 */
export interface TypeformSettings {
	language: string;
	progress_bar: 'percentage' | 'proportion';
	meta: {
		title?: string;
		description?: string;
		allow_indexing?: boolean;
	};
	hide_navigation?: boolean;
	is_public?: boolean;
	is_trial?: boolean;
	show_progress_bar?: boolean;
	show_typeform_branding?: boolean;
	are_uploads_public?: boolean;
	show_time_to_complete?: boolean;
	show_number_of_submissions?: boolean;
	show_cookie_consent?: boolean;
	show_question_number?: boolean;
	show_key_hint_on_choices?: boolean;
	autosave_progress?: boolean;
	free_form_navigation?: boolean;
	pro_subdomain_enabled?: boolean;
	capabilities?: {
		e2e_encryption?: boolean;
	};
}

/**
 * Form field definition
 */
export interface TypeformField {
	id: string;
	ref: string;
	title: string;
	type: TypeformFieldType;
	properties?: Record<string, unknown>;
	validations?: {
		required?: boolean;
		max_length?: number;
		min_value?: number;
		max_value?: number;
	};
	attachment?: {
		type: 'image' | 'video';
		href: string;
	};
}

/**
 * Supported field types
 */
export type TypeformFieldType =
	| 'short_text'
	| 'long_text'
	| 'email'
	| 'number'
	| 'dropdown'
	| 'multiple_choice'
	| 'yes_no'
	| 'legal'
	| 'rating'
	| 'opinion_scale'
	| 'ranking'
	| 'picture_choice'
	| 'date'
	| 'file_upload'
	| 'payment'
	| 'website'
	| 'phone_number'
	| 'calendly'
	| 'group'
	| 'statement'
	| 'matrix';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Form response (submission)
 */
export interface TypeformResponse {
	/** Response ID (also called token) */
	response_id: string;
	/** Unique submission identifier */
	token: string;
	/** When respondent landed on the form */
	landed_at: string;
	/** When response was submitted */
	submitted_at: string;
	/** Response metadata */
	metadata: TypeformResponseMetadata;
	/** Answers to questions */
	answers: TypeformAnswer[];
	/** Hidden field values */
	hidden?: Record<string, string>;
	/** Calculated fields (e.g., quiz score) */
	calculated?: {
		score?: number;
	};
	/** Variables */
	variables?: TypeformVariable[];
}

/**
 * Response metadata
 */
export interface TypeformResponseMetadata {
	user_agent: string;
	platform: 'mobile' | 'tablet' | 'desktop' | 'other';
	referer: string;
	network_id?: string;
	browser?: string;
}

/**
 * Answer object
 */
export interface TypeformAnswer {
	field: {
		id: string;
		ref: string;
		type: TypeformFieldType;
	};
	type: TypeformAnswerType;
	// Value depends on type
	text?: string;
	email?: string;
	number?: number;
	boolean?: boolean;
	date?: string;
	file_url?: string;
	url?: string;
	phone_number?: string;
	choice?: TypeformChoice;
	choices?: {
		ids?: string[];
		labels?: string[];
		refs?: string[];
		other?: string;
	};
	payment?: {
		amount: string;
		last4: string;
		name: string;
		success: boolean;
	};
}

/**
 * Answer types
 */
export type TypeformAnswerType =
	| 'text'
	| 'email'
	| 'number'
	| 'boolean'
	| 'date'
	| 'file_url'
	| 'url'
	| 'phone_number'
	| 'choice'
	| 'choices'
	| 'payment';

/**
 * Choice answer
 */
export interface TypeformChoice {
	id?: string;
	label: string;
	ref?: string;
	other?: string;
}

/**
 * Variable
 */
export interface TypeformVariable {
	key: string;
	type: 'number' | 'text';
	number?: number;
	text?: string;
}

/**
 * List responses result
 */
export interface TypeformResponsesResult {
	total_items: number;
	page_count: number;
	items: TypeformResponse[];
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

/**
 * Webhook configuration
 */
export interface TypeformWebhook {
	id: string;
	form_id: string;
	tag: string;
	url: string;
	enabled: boolean;
	secret?: string;
	verify_ssl?: boolean;
	created_at: string;
	updated_at: string;
}

/**
 * Webhook event payload
 */
export interface TypeformWebhookEvent {
	event_id: string;
	event_type: 'form_response';
	form_response: {
		form_id: string;
		token: string;
		landed_at: string;
		submitted_at: string;
		definition: {
			id: string;
			title: string;
			fields: TypeformField[];
		};
		answers: TypeformAnswer[];
		hidden?: Record<string, string>;
		calculated?: {
			score?: number;
		};
		variables?: TypeformVariable[];
	};
}

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

/**
 * Workspace
 */
export interface TypeformWorkspace {
	id: string;
	name: string;
	default: boolean;
	shared: boolean;
	forms: {
		count: number;
		href: string;
	};
	self: {
		href: string;
	};
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

/**
 * Options for listing forms
 */
export interface ListFormsOptions {
	/** Filter by workspace ID */
	workspaceId?: string;
	/** Search query */
	search?: string;
	/** Page number (starts at 1) */
	page?: number;
	/** Results per page (default: 10, max: 200) */
	pageSize?: number;
}

/**
 * Options for getting responses
 */
export interface GetResponsesOptions {
	/** Form ID (required) */
	formId: string;
	/** Max responses per request (default: 25, max: 1000) */
	pageSize?: number;
	/** Filter responses after this date (ISO 8601 or Unix timestamp) */
	since?: string;
	/** Filter responses before this date (ISO 8601 or Unix timestamp) */
	until?: string;
	/** Pagination cursor - get responses after this token */
	after?: string;
	/** Pagination cursor - get responses before this token */
	before?: string;
	/** Filter by response type */
	responseType?: 'started' | 'partial' | 'completed';
	/** Specific response IDs to include */
	includedResponseIds?: string[];
	/** Specific response IDs to exclude */
	excludedResponseIds?: string[];
	/** Search query across all answers */
	query?: string;
	/** Only return answers for these field IDs */
	fields?: string[];
	/** Only include responses that answered these fields */
	answeredFields?: string[];
	/** Sort order: field_id,asc or field_id,desc */
	sort?: string;
}

/**
 * Options for creating a webhook
 */
export interface CreateWebhookOptions {
	/** Form ID */
	formId: string;
	/** Webhook tag (identifier) */
	tag: string;
	/** URL to receive webhook events */
	url: string;
	/** Enable/disable webhook (default: true) */
	enabled?: boolean;
	/** Secret for signature verification */
	secret?: string;
	/** Verify SSL certificate (default: true) */
	verifySsl?: boolean;
}

// ============================================================================
// TYPEFORM INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Typeform integration */
const handleError = createErrorHandler('typeform');

/**
 * Typeform Integration
 *
 * Weniger, aber besser: Forms and responses API with webhook support
 * for compound workflows.
 */
export class Typeform extends BaseAPIClient {
	constructor(config: TypeformConfig) {
		validateAccessToken(config.accessToken, 'typeform');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.typeform.com',
			timeout: config.timeout,
		});
	}

	// ==========================================================================
	// FORMS
	// ==========================================================================

	/**
	 * List all forms
	 */
	async listForms(
		options: ListFormsOptions = {}
	): Promise<ActionResult<TypeformForm[]>> {
		try {
			const queryString = buildQueryString({
				workspace_id: options.workspaceId,
				search: options.search,
				page: options.page,
				page_size: options.pageSize,
			});

			const response = await this.get(`/forms${queryString}`);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'list-forms',
			});

			const data = (await response.json()) as { items: TypeformForm[] };

			return createActionResult({
				data: data.items,
				integration: 'typeform',
				action: 'list-forms',
				schema: 'typeform.forms.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-forms');
		}
	}

	/**
	 * Get a form by ID
	 */
	async getForm(formId: string): Promise<ActionResult<TypeformForm>> {
		try {
			const response = await this.get(`/forms/${formId}`);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'get-form',
			});

			const form = (await response.json()) as TypeformForm;

			return createActionResult({
				data: form,
				integration: 'typeform',
				action: 'get-form',
				schema: 'typeform.form.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-form');
		}
	}

	// ==========================================================================
	// RESPONSES
	// ==========================================================================

	/**
	 * Get responses for a form
	 *
	 * Note: Very recent submissions (within ~30 minutes) may not be included.
	 * For real-time responses, use webhooks.
	 */
	async getResponses(
		options: GetResponsesOptions
	): Promise<ActionResult<TypeformResponsesResult>> {
		const { formId, ...params } = options;

		if (!formId) {
			return ActionResult.error(
				'Form ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'get-responses' }
			);
		}

		try {
			const queryString = buildQueryString({
				page_size: params.pageSize,
				since: params.since,
				until: params.until,
				after: params.after,
				before: params.before,
				response_type: params.responseType,
				included_response_ids: params.includedResponseIds?.join(','),
				excluded_response_ids: params.excludedResponseIds?.join(','),
				query: params.query,
				fields: params.fields?.join(','),
				answered_fields: params.answeredFields?.join(','),
				sort: params.sort,
			});

			const response = await this.get(`/forms/${formId}/responses${queryString}`);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'get-responses',
			});

			const data = (await response.json()) as TypeformResponsesResult;

			return createActionResult({
				data,
				integration: 'typeform',
				action: 'get-responses',
				schema: 'typeform.responses.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-responses');
		}
	}

	/**
	 * Delete responses from a form
	 */
	async deleteResponses(
		formId: string,
		responseIds: string[]
	): Promise<ActionResult<{ deleted: boolean }>> {
		if (!formId) {
			return ActionResult.error(
				'Form ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'delete-responses' }
			);
		}

		if (!responseIds.length) {
			return ActionResult.error(
				'At least one response ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'delete-responses' }
			);
		}

		try {
			const queryString = buildQueryString({
				included_response_ids: responseIds.join(','),
			});

			const response = await this.delete(
				`/forms/${formId}/responses${queryString}`
			);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'delete-responses',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'typeform',
				action: 'delete-responses',
				schema: 'typeform.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-responses');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * List webhooks for a form
	 */
	async listWebhooks(formId: string): Promise<ActionResult<TypeformWebhook[]>> {
		if (!formId) {
			return ActionResult.error(
				'Form ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'list-webhooks' }
			);
		}

		try {
			const response = await this.get(`/forms/${formId}/webhooks`);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'list-webhooks',
			});

			const data = (await response.json()) as { items: TypeformWebhook[] };

			return createActionResult({
				data: data.items,
				integration: 'typeform',
				action: 'list-webhooks',
				schema: 'typeform.webhooks.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-webhooks');
		}
	}

	/**
	 * Get a specific webhook
	 */
	async getWebhook(
		formId: string,
		tag: string
	): Promise<ActionResult<TypeformWebhook>> {
		if (!formId) {
			return ActionResult.error(
				'Form ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'get-webhook' }
			);
		}

		try {
			const response = await this.get(`/forms/${formId}/webhooks/${tag}`);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'get-webhook',
			});

			const webhook = (await response.json()) as TypeformWebhook;

			return createActionResult({
				data: webhook,
				integration: 'typeform',
				action: 'get-webhook',
				schema: 'typeform.webhook.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-webhook');
		}
	}

	/**
	 * Create or update a webhook
	 */
	async createWebhook(
		options: CreateWebhookOptions
	): Promise<ActionResult<TypeformWebhook>> {
		const { formId, tag, url, enabled = true, secret, verifySsl = true } = options;

		if (!formId) {
			return ActionResult.error(
				'Form ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'create-webhook' }
			);
		}

		if (!tag) {
			return ActionResult.error(
				'Webhook tag is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'create-webhook' }
			);
		}

		if (!url) {
			return ActionResult.error(
				'Webhook URL is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'create-webhook' }
			);
		}

		try {
			// Typeform uses PUT for create/update
			const response = await this.request(
				`/forms/${formId}/webhooks/${tag}`,
				{
					method: 'PUT',
					body: JSON.stringify({
						url,
						enabled,
						secret,
						verify_ssl: verifySsl,
					}),
				}
			);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'create-webhook',
			});

			const webhook = (await response.json()) as TypeformWebhook;

			return createActionResult({
				data: webhook,
				integration: 'typeform',
				action: 'create-webhook',
				schema: 'typeform.webhook.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-webhook');
		}
	}

	/**
	 * Delete a webhook
	 */
	async deleteWebhook(
		formId: string,
		tag: string
	): Promise<ActionResult<{ deleted: boolean }>> {
		if (!formId) {
			return ActionResult.error(
				'Form ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'typeform', action: 'delete-webhook' }
			);
		}

		try {
			const response = await this.delete(`/forms/${formId}/webhooks/${tag}`);
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'delete-webhook',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'typeform',
				action: 'delete-webhook',
				schema: 'typeform.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-webhook');
		}
	}

	// ==========================================================================
	// WORKSPACES
	// ==========================================================================

	/**
	 * List workspaces
	 */
	async listWorkspaces(): Promise<ActionResult<TypeformWorkspace[]>> {
		try {
			const response = await this.get('/workspaces');
			await assertResponseOk(response, {
				integration: 'typeform',
				action: 'list-workspaces',
			});

			const data = (await response.json()) as { items: TypeformWorkspace[] };

			return createActionResult({
				data: data.items,
				integration: 'typeform',
				action: 'list-workspaces',
				schema: 'typeform.workspaces.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-workspaces');
		}
	}

	// ==========================================================================
	// WEBHOOK VERIFICATION
	// ==========================================================================

	/**
	 * Verify and parse a webhook event
	 *
	 * Typeform signs webhooks with HMAC SHA-256 in base64.
	 * Header format: sha256={base64_signature}
	 *
	 * @param payload - Raw request body as string
	 * @param signature - Value of Typeform-Signature header
	 * @param secret - Webhook secret configured when creating the webhook
	 */
	async verifyWebhook(
		payload: string,
		signature: string,
		secret: string
	): Promise<ActionResult<TypeformWebhookEvent>> {
		try {
			// 1. Validate inputs
			if (!payload) {
				return ActionResult.error(
					'Webhook payload is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'typeform', action: 'verify-webhook' }
				);
			}

			if (!signature) {
				return ActionResult.error(
					'Webhook signature is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'typeform', action: 'verify-webhook' }
				);
			}

			if (!secret) {
				return ActionResult.error(
					'Webhook secret is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'typeform', action: 'verify-webhook' }
				);
			}

			// 2. Extract signature from header (format: sha256=xxx)
			if (!signature.startsWith('sha256=')) {
				return ActionResult.error(
					'Invalid signature format - expected sha256=...',
					ErrorCode.AUTH_INVALID,
					{ integration: 'typeform', action: 'verify-webhook' }
				);
			}

			const providedSignature = signature.slice(7); // Remove 'sha256=' prefix

			// 3. Compute expected signature
			const expectedSignature = await this.computeHmacSha256Base64(
				payload,
				secret
			);

			// 4. Compare signatures (constant time)
			if (!secureCompare(providedSignature, expectedSignature)) {
				return ActionResult.error(
					'Invalid webhook signature',
					ErrorCode.AUTH_INVALID,
					{ integration: 'typeform', action: 'verify-webhook' }
				);
			}

			// 5. Parse and return event
			const event = JSON.parse(payload) as TypeformWebhookEvent;

			return createActionResult({
				data: event,
				integration: 'typeform',
				action: 'verify-webhook',
				schema: 'typeform.webhook-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			if (error instanceof SyntaxError) {
				return ActionResult.error(
					'Invalid webhook payload JSON',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'typeform', action: 'verify-webhook' }
				);
			}
			return handleError(error, 'verify-webhook');
		}
	}

	/**
	 * Parse webhook event without verification
	 * Use only for development/testing
	 */
	parseWebhookUnsafe(payload: string): ActionResult<TypeformWebhookEvent> {
		try {
			const event = JSON.parse(payload) as TypeformWebhookEvent;

			return createActionResult({
				data: event,
				integration: 'typeform',
				action: 'parse-webhook-unsafe',
				schema: 'typeform.webhook-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			if (error instanceof SyntaxError) {
				return ActionResult.error(
					'Invalid webhook payload JSON',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'typeform', action: 'parse-webhook-unsafe' }
				);
			}
			return handleError(error, 'parse-webhook-unsafe');
		}
	}

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	/**
	 * Extract answers as a simple key-value object
	 *
	 * Zuhandenheit: Developer thinks "get form data as object"
	 * not "iterate answers, check types, extract values"
	 */
	static extractAnswers(
		response: TypeformResponse | TypeformWebhookEvent['form_response']
	): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		for (const answer of response.answers) {
			const key = answer.field.ref || answer.field.id;

			switch (answer.type) {
				case 'text':
					result[key] = answer.text;
					break;
				case 'email':
					result[key] = answer.email;
					break;
				case 'number':
					result[key] = answer.number;
					break;
				case 'boolean':
					result[key] = answer.boolean;
					break;
				case 'date':
					result[key] = answer.date;
					break;
				case 'file_url':
					result[key] = answer.file_url;
					break;
				case 'url':
					result[key] = answer.url;
					break;
				case 'phone_number':
					result[key] = answer.phone_number;
					break;
				case 'choice':
					result[key] = answer.choice?.label || answer.choice?.other;
					break;
				case 'choices':
					result[key] = answer.choices?.labels || answer.choices?.other;
					break;
				case 'payment':
					result[key] = answer.payment;
					break;
				default:
					result[key] = answer;
			}
		}

		// Include hidden fields
		if (response.hidden) {
			for (const [key, value] of Object.entries(response.hidden)) {
				result[`hidden_${key}`] = value;
			}
		}

		// Include calculated score
		if (response.calculated?.score !== undefined) {
			result['_score'] = response.calculated.score;
		}

		return result;
	}

	/**
	 * Get a specific answer by field ref or ID
	 */
	static getAnswer(
		response: TypeformResponse | TypeformWebhookEvent['form_response'],
		fieldRefOrId: string
	): TypeformAnswer | undefined {
		return response.answers.find(
			(a) => a.field.ref === fieldRefOrId || a.field.id === fieldRefOrId
		);
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Compute HMAC SHA-256 signature in base64 (Typeform's format)
	 */
	private async computeHmacSha256Base64(
		payload: string,
		secret: string
	): Promise<string> {
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

		// Convert to base64
		const bytes = new Uint8Array(signatureBuffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	// secureCompare is now imported from ../core/security.js

	/**
	 * Get capabilities for Typeform actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true, // File uploads
			supportsSearch: true, // Query parameter
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: false,
			supportsMetadata: true,
		};
	}
}

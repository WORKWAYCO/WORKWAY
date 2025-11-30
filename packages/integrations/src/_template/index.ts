/**
 * [SERVICE_NAME] Integration for WORKWAY
 *
 * [Brief description of what this integration enables]
 *
 * Implements the SDK patterns:
 * - ActionResult narrow waist for output
 * - IntegrationError narrow waist for errors
 * - Configurable timeout via AbortController
 * - Honest ActionCapabilities declaration
 *
 * @example
 * ```typescript
 * import { ServiceName } from '@workwayco/integrations/service-name';
 *
 * const client = new ServiceName({ apiKey: env.SERVICE_API_KEY });
 *
 * // Example operation
 * const result = await client.getResource('resource-id');
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */

import {
	ActionResult,
	createActionResult,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { IntegrationError, ErrorCode } from '@workwayco/sdk';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Integration configuration
 */
export interface ServiceNameConfig {
	/** API key or access token */
	apiKey: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Example resource type - replace with actual types
 */
export interface ServiceResource {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	metadata: Record<string, unknown>;
}

/**
 * List response wrapper
 */
export interface ServiceList<T> {
	items: T[];
	hasMore: boolean;
	cursor?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface CreateResourceOptions {
	name: string;
	description?: string;
	metadata?: Record<string, unknown>;
}

export interface ListResourcesOptions {
	/** Maximum number of results (default: 10, max: 100) */
	limit?: number;
	/** Pagination cursor */
	cursor?: string;
}

// ============================================================================
// INTEGRATION CLASS
// ============================================================================

/**
 * [SERVICE_NAME] Integration
 *
 * Implements the WORKWAY SDK patterns for [SERVICE_NAME] API access.
 */
export class ServiceName {
	private apiKey: string;
	private apiUrl: string;
	private timeout: number;

	constructor(config: ServiceNameConfig) {
		// Validate required config - throw in constructor (can't return)
		if (!config.apiKey) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'[SERVICE_NAME] API key is required',
				{ integration: 'service-name', retryable: false }
			);
		}

		this.apiKey = config.apiKey;
		this.apiUrl = config.apiUrl || 'https://api.service.com/v1';
		this.timeout = config.timeout ?? 30000;
	}

	// ==========================================================================
	// PUBLIC METHODS
	// ==========================================================================

	/**
	 * Get a resource by ID
	 */
	async getResource(id: string): Promise<ActionResult<ServiceResource>> {
		try {
			const response = await this.request(`/resources/${id}`);

			if (!response.ok) {
				return this.handleApiError(response, 'get-resource');
			}

			const resource = (await response.json()) as ServiceResource;

			return createActionResult({
				data: resource,
				integration: 'service-name',
				action: 'get-resource',
				schema: 'service-name.resource.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-resource');
		}
	}

	/**
	 * Create a new resource
	 */
	async createResource(
		options: CreateResourceOptions
	): Promise<ActionResult<ServiceResource>> {
		try {
			// Validate input - return error (don't throw)
			if (!options.name) {
				return ActionResult.error(
					'Name is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'service-name', action: 'create-resource' }
				);
			}

			const response = await this.request('/resources', {
				method: 'POST',
				body: JSON.stringify(options),
			});

			if (!response.ok) {
				return this.handleApiError(response, 'create-resource');
			}

			const resource = (await response.json()) as ServiceResource;

			return createActionResult({
				data: resource,
				integration: 'service-name',
				action: 'create-resource',
				schema: 'service-name.resource.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-resource');
		}
	}

	/**
	 * List resources with pagination
	 */
	async listResources(
		options: ListResourcesOptions = {}
	): Promise<ActionResult<ServiceList<ServiceResource>>> {
		try {
			const params = new URLSearchParams();
			if (options.limit) params.append('limit', options.limit.toString());
			if (options.cursor) params.append('cursor', options.cursor);

			const url = `/resources${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleApiError(response, 'list-resources');
			}

			const list = (await response.json()) as ServiceList<ServiceResource>;

			return createActionResult({
				data: list,
				integration: 'service-name',
				action: 'list-resources',
				schema: 'service-name.resource-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'list-resources');
		}
	}

	/**
	 * Delete a resource
	 */
	async deleteResource(id: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.request(`/resources/${id}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				return this.handleApiError(response, 'delete-resource');
			}

			return createActionResult({
				data: { deleted: true },
				integration: 'service-name',
				action: 'delete-resource',
				schema: 'service-name.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'delete-resource');
		}
	}

	// ==========================================================================
	// WEBHOOK HANDLING (if applicable)
	// ==========================================================================

	/**
	 * Parse and verify a webhook event
	 *
	 * @param payload - Raw request body
	 * @param signature - Signature header from webhook
	 * @param webhookSecret - Webhook secret for verification
	 */
	async parseWebhookEvent(
		payload: string,
		signature: string,
		webhookSecret: string
	): Promise<ActionResult<{ type: string; data: unknown }>> {
		try {
			// 1. Parse signature header
			// (Adjust based on service's signature format)
			const [timestamp, sig] = signature.split(',');
			if (!timestamp || !sig) {
				return ActionResult.error(
					'Invalid signature format',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'service-name', action: 'parse-webhook' }
				);
			}

			// 2. Check timestamp for replay attack protection
			const timestampValue = parseInt(timestamp.replace('t=', ''), 10);
			const age = Math.floor(Date.now() / 1000) - timestampValue;
			if (age > 300) {
				// 5 minute tolerance
				return ActionResult.error(
					'Webhook timestamp too old',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'service-name', action: 'parse-webhook' }
				);
			}

			// 3. Verify signature (HMAC-SHA256)
			const signedPayload = `${timestampValue}.${payload}`;
			const expectedSig = await this.computeHmac(signedPayload, webhookSecret);
			const actualSig = sig.replace('v1=', '');

			if (expectedSig !== actualSig) {
				return ActionResult.error(
					'Invalid webhook signature',
					ErrorCode.AUTH_INVALID,
					{ integration: 'service-name', action: 'parse-webhook' }
				);
			}

			// 4. Parse and return event
			const event = JSON.parse(payload);

			return createActionResult({
				data: event,
				integration: 'service-name',
				action: 'parse-webhook',
				schema: 'service-name.webhook-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'parse-webhook');
		}
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Make authenticated request with timeout
	 */
	private async request(
		endpoint: string,
		options: RequestInit = {}
	): Promise<Response> {
		const url = `${this.apiUrl}${endpoint}`;

		// Add timeout via AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(url, {
				...options,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
					...options.headers,
				},
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Get capabilities - be honest about what this integration can do
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false, // Set to true only if actually supported
			canHandleHtml: false,
			canHandleMarkdown: false,
			canHandleAttachments: false, // Don't overstate!
			canHandleImages: false,
			supportsSearch: false,
			supportsPagination: true,
			supportsBulkOperations: false,
			supportsNesting: false,
			supportsRelations: false,
			supportsMetadata: true,
		};
	}

	/**
	 * Handle API errors - map status codes to ErrorCode
	 */
	private async handleApiError<T>(
		response: Response,
		action: string
	): Promise<ActionResult<T>> {
		try {
			const errorData = (await response.json()) as {
				error?: { message?: string; code?: string };
				message?: string;
			};
			const message =
				errorData.error?.message || errorData.message || 'API error';
			const code = this.mapStatusToErrorCode(response.status);

			return ActionResult.error(message, code, {
				integration: 'service-name',
				action,
			});
		} catch {
			return ActionResult.error(
				`API error: ${response.status}`,
				ErrorCode.API_ERROR,
				{ integration: 'service-name', action }
			);
		}
	}

	/**
	 * Map HTTP status to ErrorCode
	 */
	private mapStatusToErrorCode(status: number): string {
		switch (status) {
			case 400:
				return ErrorCode.VALIDATION_ERROR;
			case 401:
				return ErrorCode.AUTH_INVALID;
			case 403:
				return ErrorCode.AUTH_INSUFFICIENT_SCOPE;
			case 404:
				return ErrorCode.NOT_FOUND;
			case 409:
				return ErrorCode.CONFLICT;
			case 429:
				return ErrorCode.RATE_LIMITED;
			case 500:
			case 502:
			case 503:
			case 504:
				return ErrorCode.PROVIDER_DOWN;
			default:
				return ErrorCode.API_ERROR;
		}
	}

	/**
	 * Handle general errors - convert to ActionResult
	 */
	private handleError<T>(error: unknown, action: string): ActionResult<T> {
		// Handle timeout
		if (error instanceof DOMException && error.name === 'AbortError') {
			return ActionResult.error('Request timeout', ErrorCode.TIMEOUT, {
				integration: 'service-name',
				action,
			});
		}

		// Handle IntegrationError
		if (error instanceof IntegrationError) {
			const integrationErr = error as IntegrationError;
			return ActionResult.error(integrationErr.message, integrationErr.code, {
				integration: 'service-name',
				action,
			});
		}

		// Handle generic errors
		const message = error instanceof Error ? error.message : 'Unknown error';
		return ActionResult.error(message, ErrorCode.UNKNOWN, {
			integration: 'service-name',
			action,
		});
	}

	/**
	 * Compute HMAC-SHA256 signature for webhook verification
	 */
	private async computeHmac(payload: string, secret: string): Promise<string> {
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
		return Array.from(new Uint8Array(signatureBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}
}

/**
 * [SERVICE_NAME] Integration for WORKWAY
 *
 * [Brief description of what this integration enables]
 *
 * Implements the SDK patterns:
 * - Extends BaseAPIClient for DRY HTTP handling
 * - ActionResult narrow waist for output
 * - IntegrationError narrow waist for errors
 * - Automatic token refresh support
 * - Honest ActionCapabilities declaration
 *
 * @example
 * ```typescript
 * import { ServiceName } from '@workwayco/integrations/service-name';
 *
 * const client = new ServiceName({ accessToken: env.SERVICE_API_KEY });
 *
 * // Get a resource (uses getJson helper)
 * const result = await client.getResource('resource-id');
 * if (result.success) {
 *   console.log(result.data);
 * }
 *
 * // Update a resource (uses patchJson helper)
 * const updated = await client.updateResource('resource-id', { name: 'New Name' });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	type ActionCapabilities,
	IntegrationError,
	ErrorCode,
} from '@workwayco/sdk';
import { BaseAPIClient, createErrorHandler } from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Integration configuration
 */
export interface ServiceNameConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Optional: OAuth refresh token for automatic token refresh */
	refreshToken?: string;
	/** Optional: OAuth client ID for token refresh */
	clientId?: string;
	/** Optional: OAuth client secret for token refresh */
	clientSecret?: string;
	/** Optional: Callback to update tokens after refresh */
	onTokenRefreshed?: (newAccessToken: string, newRefreshToken?: string) => void | Promise<void>;
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
// ERROR HANDLER
// ============================================================================

/** Error handler bound to ServiceName integration */
const handleError = createErrorHandler('service-name');

// ============================================================================
// INTEGRATION CLASS
// ============================================================================

/**
 * [SERVICE_NAME] Integration
 *
 * Extends BaseAPIClient for DRY HTTP handling with automatic token refresh.
 */
export class ServiceName extends BaseAPIClient {
	constructor(config: ServiceNameConfig) {
		// Validate required config - throw in constructor (can't return)
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'[SERVICE_NAME] access token is required',
				{ integration: 'service-name', retryable: false }
			);
		}

		// Call parent constructor with BaseAPIClient config
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.service.com/v1',
			timeout: config.timeout,
			errorContext: { integration: 'service-name' },
			tokenRefresh: config.refreshToken && config.clientId && config.clientSecret && config.onTokenRefreshed
				? {
					refreshToken: config.refreshToken,
					tokenEndpoint: 'https://api.service.com/oauth/token', // Replace with actual endpoint
					clientId: config.clientId,
					clientSecret: config.clientSecret,
					onTokenRefreshed: config.onTokenRefreshed,
				}
				: undefined,
		});
	}

	// ==========================================================================
	// PUBLIC METHODS
	// ==========================================================================

	/**
	 * Get a resource by ID
	 */
	async getResource(id: string): Promise<ActionResult<ServiceResource>> {
		try {
			const resource = await this.getJson<ServiceResource>(`/resources/${id}`);

			return createActionResult({
				data: resource,
				integration: 'service-name',
				action: 'get-resource',
				schema: 'service-name.resource.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-resource');
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

			const resource = await this.postJson<ServiceResource>('/resources', options);

			return createActionResult({
				data: resource,
				integration: 'service-name',
				action: 'create-resource',
				schema: 'service-name.resource.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-resource');
		}
	}

	/**
	 * Update a resource
	 */
	async updateResource(
		id: string,
		updates: Partial<CreateResourceOptions>
	): Promise<ActionResult<ServiceResource>> {
		try {
			const resource = await this.patchJson<ServiceResource>(
				`/resources/${id}`,
				updates
			);

			return createActionResult({
				data: resource,
				integration: 'service-name',
				action: 'update-resource',
				schema: 'service-name.resource.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-resource');
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
			const list = await this.getJson<ServiceList<ServiceResource>>(url);

			return createActionResult({
				data: list,
				integration: 'service-name',
				action: 'list-resources',
				schema: 'service-name.resource-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-resources');
		}
	}

	/**
	 * Delete a resource
	 */
	async deleteResource(id: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			await this.deleteJson(`/resources/${id}`);

			return createActionResult({
				data: { deleted: true },
				integration: 'service-name',
				action: 'delete-resource',
				schema: 'service-name.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-resource');
		}
	}

	// ==========================================================================
	// WEBHOOK HANDLING (template-specific helper)
	// ==========================================================================
	// Note: Webhook verification logic is service-specific and should remain
	// in the template. BaseAPIClient handles HTTP requests, but webhook signature
	// verification varies by service (Stripe uses HMAC-SHA256, Slack uses different
	// headers, etc.). Keep this section as-is when using this template.

	/**
	 * Parse and verify a webhook event
	 *
	 * This is a template-specific helper. Adjust signature verification
	 * based on your service's webhook signature format.
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
			return handleError(error, 'parse-webhook');
		}
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

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
	 * Compute HMAC-SHA256 signature for webhook verification
	 *
	 * Template-specific helper: Keep this method when using this template.
	 * Different services use different signature algorithms (HMAC-SHA256,
	 * HMAC-SHA1, etc.). Adjust as needed for your service.
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

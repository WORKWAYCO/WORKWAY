/**
 * Composio Adapter for WORKWAY
 *
 * Invisible plumbing: wraps Composio's API behind the BaseAPIClient + ActionResult
 * contract. The rest of the system doesn't know (or care) whether the integration
 * is custom-built or Composio-backed.
 *
 * This adapter talks to Composio's REST API directly via fetch() — no SDK dependency
 * required. This guarantees Workers compatibility since we control the HTTP calls.
 *
 * Architecture:
 *   Client MCP Request
 *     → CREATE SOMETHING MCP Server (Workers)
 *       → Intelligence Layer (Skills, Agents, Three-Tier)
 *         → ComposioAdapter (this file)
 *           → Composio REST API
 *             → External SaaS API (Slack, HubSpot, Jira, etc.)
 *
 * The adapter can be swapped out for a custom BaseAPIClient subclass at any time
 * without changing callers. This is the "wrap pattern" — Composio is plumbing,
 * CREATE SOMETHING is the visible layer.
 *
 * @example
 * ```typescript
 * import { ComposioAdapter } from '@workwayco/integrations/composio';
 *
 * const adapter = new ComposioAdapter({
 *   composioApiKey: env.COMPOSIO_API_KEY,
 *   appName: 'slack',
 * });
 *
 * // Execute any Composio action — returns ActionResult<T>
 * const result = await adapter.executeAction('SLACK_SEND_MESSAGE', {
 *   channel: '#general',
 *   text: 'Hello from WORKWAY',
 * });
 *
 * if (result.success) {
 *   console.log(result.data);
 * }
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
 * Configuration for ComposioAdapter
 */
export interface ComposioAdapterConfig {
	/** Composio API key */
	composioApiKey: string;
	/** Composio app name (e.g., 'slack', 'hubspot', 'jira') */
	appName: string;
	/** Optional: Override Composio API base URL */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Optional: Connected account ID for authenticated actions */
	connectedAccountId?: string;
	/** Optional: Entity ID for user-scoped operations */
	entityId?: string;
}

/**
 * Composio action parameter schema
 */
export interface ComposioActionParam {
	name: string;
	type: string;
	description?: string;
	required?: boolean;
	default?: unknown;
}

/**
 * Composio action definition (returned from actions listing)
 */
export interface ComposioAction {
	name: string;
	display_name?: string;
	description?: string;
	parameters?: {
		properties?: Record<string, ComposioActionParam>;
		required?: string[];
	};
	response?: {
		properties?: Record<string, { type: string; description?: string }>;
	};
	tags?: string[];
	appName?: string;
}

/**
 * Composio action execution result
 */
export interface ComposioExecutionResult {
	execution_output?: unknown;
	response_data?: unknown;
	successfull?: boolean;
	error?: string;
}

/**
 * Composio app info
 */
export interface ComposioApp {
	name: string;
	key: string;
	description?: string;
	logo?: string;
	categories?: string[];
	auth_schemes?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPOSIO_API_BASE = 'https://backend.composio.dev/api/v2';

// ============================================================================
// ADAPTER CLASS
// ============================================================================

/**
 * ComposioAdapter — Invisible Plumbing
 *
 * Extends BaseAPIClient so it's interchangeable with any custom integration.
 * Returns ActionResult<T> for every operation. The system sees a standard
 * WORKWAY integration; Composio is the hidden implementation detail.
 *
 * Zuhandenheit: The mechanism recedes. The outcome remains.
 */
export class ComposioAdapter extends BaseAPIClient {
	private readonly composioApiKey: string;
	private readonly composioAppName: string;
	private readonly connectedAccountId?: string;
	private readonly entityId?: string;
	private readonly handleError: ReturnType<typeof createErrorHandler>;

	constructor(config: ComposioAdapterConfig) {
		if (!config.composioApiKey) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'Composio API key is required',
				{ integration: 'composio', retryable: false }
			);
		}

		if (!config.appName) {
			throw new IntegrationError(
				ErrorCode.VALIDATION_ERROR,
				'Composio app name is required (e.g., "slack", "hubspot", "jira")',
				{ integration: 'composio', retryable: false }
			);
		}

		super({
			accessToken: config.composioApiKey,
			apiUrl: config.apiUrl || COMPOSIO_API_BASE,
			timeout: config.timeout,
			errorContext: { integration: `composio:${config.appName}` },
		});

		this.composioApiKey = config.composioApiKey;
		this.composioAppName = config.appName;
		this.connectedAccountId = config.connectedAccountId;
		this.entityId = config.entityId;
		this.handleError = createErrorHandler(`composio:${config.appName}`);
	}

	// ==========================================================================
	// PUBLIC METHODS — Action Discovery
	// ==========================================================================

	/**
	 * List available actions for this app
	 *
	 * Use this to discover what Composio can do for a specific service.
	 * Useful for evaluating depth before committing to Composio-backed integration.
	 */
	async listActions(options: {
		limit?: number;
		useCase?: string;
		tags?: string[];
	} = {}): Promise<ActionResult<ComposioAction[]>> {
		try {
			const params = new URLSearchParams();
			params.append('appNames', this.composioAppName);
			if (options.limit) params.append('limit', options.limit.toString());
			if (options.useCase) params.append('useCase', options.useCase);
			if (options.tags?.length) params.append('tags', options.tags.join(','));

			const actions = await this.getJson<ComposioAction[]>(
				`/actions?${params.toString()}`
			);

			return createActionResult({
				data: actions,
				integration: `composio:${this.composioAppName}`,
				action: 'list-actions',
				schema: `composio.${this.composioAppName}.action-list.v1`,
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'list-actions');
		}
	}

	/**
	 * Get details for a specific action
	 */
	async getAction(actionName: string): Promise<ActionResult<ComposioAction>> {
		try {
			const action = await this.getJson<ComposioAction>(
				`/actions/${actionName}`
			);

			return createActionResult({
				data: action,
				integration: `composio:${this.composioAppName}`,
				action: 'get-action',
				schema: `composio.${this.composioAppName}.action.v1`,
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-action');
		}
	}

	// ==========================================================================
	// PUBLIC METHODS — Action Execution
	// ==========================================================================

	/**
	 * Execute a Composio action
	 *
	 * This is the core method. It wraps Composio's action execution in the
	 * ActionResult envelope, making it indistinguishable from a custom integration.
	 *
	 * @param actionName - Composio action name (e.g., 'SLACK_SEND_MESSAGE')
	 * @param params - Action parameters (varies by action)
	 * @returns ActionResult with the execution output
	 */
	async executeAction<T = unknown>(
		actionName: string,
		params: Record<string, unknown> = {}
	): Promise<ActionResult<T>> {
		try {
			if (!actionName) {
				return ActionResult.error(
					'Action name is required',
					ErrorCode.VALIDATION_ERROR,
					{ integration: `composio:${this.composioAppName}`, action: 'execute-action' }
				);
			}

			const body: Record<string, unknown> = {
				input: params,
			};

			// Include connected account or entity if configured
			if (this.connectedAccountId) {
				body.connectedAccountId = this.connectedAccountId;
			}
			if (this.entityId) {
				body.entityId = this.entityId;
			}

			const result = await this.postJson<ComposioExecutionResult>(
				`/actions/${actionName}/execute`,
				body
			);

			// Check Composio's own success indicator
			if (result.successfull === false || result.error) {
				return ActionResult.error(
					result.error || 'Action execution failed',
					ErrorCode.API_ERROR,
					{ integration: `composio:${this.composioAppName}`, action: actionName }
				);
			}

			// Extract the actual data from Composio's response envelope
			const data = (result.execution_output ?? result.response_data ?? result) as T;

			return createActionResult({
				data,
				integration: `composio:${this.composioAppName}`,
				action: actionName,
				schema: `composio.${this.composioAppName}.${this.normalizeActionName(actionName)}.v1`,
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, actionName);
		}
	}

	// ==========================================================================
	// PUBLIC METHODS — App & Auth Info
	// ==========================================================================

	/**
	 * Get app information (auth schemes, categories, etc.)
	 */
	async getAppInfo(): Promise<ActionResult<ComposioApp>> {
		try {
			const app = await this.getJson<ComposioApp>(
				`/apps/${this.composioAppName}`
			);

			return createActionResult({
				data: app,
				integration: `composio:${this.composioAppName}`,
				action: 'get-app-info',
				schema: `composio.app-info.v1`,
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-app-info');
		}
	}

	/**
	 * Check if a connected account exists for this app + entity
	 */
	async checkConnection(): Promise<ActionResult<{ connected: boolean; accountId?: string }>> {
		try {
			if (!this.entityId) {
				return ActionResult.error(
					'Entity ID required to check connection',
					ErrorCode.VALIDATION_ERROR,
					{ integration: `composio:${this.composioAppName}`, action: 'check-connection' }
				);
			}

			const params = new URLSearchParams();
			params.append('user_uuid', this.entityId);

			const accounts = await this.getJson<Array<{ id: string; appName: string; status: string }>>(
				`/connectedAccounts?${params.toString()}`
			);

			const match = accounts.find(
				(a) => a.appName === this.composioAppName && a.status === 'active'
			);

			return createActionResult({
				data: {
					connected: !!match,
					accountId: match?.id,
				},
				integration: `composio:${this.composioAppName}`,
				action: 'check-connection',
				schema: `composio.connection-status.v1`,
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'check-connection');
		}
	}

	// ==========================================================================
	// PUBLIC METHODS — OAuth Initiation
	// ==========================================================================

	/**
	 * Initiate OAuth connection for this app
	 *
	 * Returns a redirect URL that the user should be sent to.
	 * After OAuth completes, Composio stores the tokens and provides a
	 * connected account ID for future action execution.
	 */
	async initiateConnection(options: {
		entityId: string;
		redirectUrl?: string;
	}): Promise<ActionResult<{ redirectUrl: string; connectionId: string }>> {
		try {
			const result = await this.postJson<{ redirectUrl: string; connectedAccountId: string }>(
				'/connectedAccounts',
				{
					integrationId: this.composioAppName,
					userUuid: options.entityId,
					redirectUri: options.redirectUrl,
				}
			);

			return createActionResult({
				data: {
					redirectUrl: result.redirectUrl,
					connectionId: result.connectedAccountId,
				},
				integration: `composio:${this.composioAppName}`,
				action: 'initiate-connection',
				schema: `composio.connection-initiation.v1`,
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'initiate-connection');
		}
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Override getJson to add Composio auth header
	 *
	 * BaseAPIClient sends Authorization: Bearer <token>, but Composio
	 * expects X-API-Key header. We override to add both.
	 */
	override async getJson<T = unknown>(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.getJson<T>(path, {
			'X-API-Key': this.composioApiKey,
			...additionalHeaders,
		});
	}

	/**
	 * Override postJson to add Composio auth header
	 */
	override async postJson<T = unknown>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.postJson<T>(path, body, {
			'X-API-Key': this.composioApiKey,
			...additionalHeaders,
		});
	}

	/**
	 * Normalize action name for schema strings
	 * SLACK_SEND_MESSAGE → send-message
	 */
	private normalizeActionName(actionName: string): string {
		return actionName
			.replace(new RegExp(`^${this.composioAppName.toUpperCase()}_`), '')
			.toLowerCase()
			.replace(/_/g, '-');
	}

	/**
	 * Capabilities — honest about what Composio-backed integrations can do
	 *
	 * Composio provides CRUD-level access. Deep capabilities (rich text,
	 * attachments, bulk operations) depend on the specific app and action.
	 * We default to conservative declarations.
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleHtml: false,
			canHandleMarkdown: false,
			canHandleAttachments: false,
			canHandleImages: false,
			supportsSearch: false,
			supportsPagination: false,
			supportsBulkOperations: false,
			supportsNesting: false,
			supportsRelations: false,
			supportsMetadata: true,
		};
	}
}

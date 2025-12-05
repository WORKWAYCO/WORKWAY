/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * ActionResult - Narrow Waist for Integration Output Data
 *
 * This is the "Internet Protocol" equivalent for integration data.
 * All actions return ActionResult<T>, enabling O(M + N) instead of O(M × N) complexity.
 *
 * Pattern Reference: OAuth.ts (lines 82-129) - single interface for all providers
 */

import { ErrorCode } from './integration-error';

// ============================================================================
// STANDARD DATA TYPES
// ============================================================================

/**
 * Standard Message - Email, chat message, SMS, etc.
 */
export interface StandardMessage {
	type: 'message';
	id: string;
	title: string; // Subject line, or first line of content
	body?: string; // Full content
	bodyText?: string; // Plain text version
	bodyHtml?: string; // HTML version
	from?: string;
	to?: string[];
	cc?: string[];
	timestamp: number;
	attachments?: Array<{
		id: string;
		name: string;
		mimeType: string;
		size: number;
		url?: string;
	}>;
	metadata: Record<string, unknown>;
}

/**
 * Standard Task - Todo, ticket, issue, etc.
 */
export interface StandardTask {
	type: 'task';
	id: string;
	title: string;
	description?: string;
	status: 'todo' | 'in_progress' | 'done' | 'cancelled';
	assignee?: string;
	dueDate?: number;
	priority?: 'low' | 'medium' | 'high' | 'urgent';
	labels?: string[];
	timestamp: number;
	metadata: Record<string, unknown>;
}

/**
 * Standard Document - Page, note, file, etc.
 */
export interface StandardDocument {
	type: 'document';
	id: string;
	title: string;
	content?: string;
	contentHtml?: string;
	contentMarkdown?: string;
	url?: string;
	author?: string;
	createdAt: number;
	updatedAt: number;
	tags?: string[];
	metadata: Record<string, unknown>;
}

/**
 * Standard Event - Calendar event, webhook event, etc.
 */
export interface StandardEvent {
	type: 'event';
	id: string;
	title: string;
	description?: string;
	startTime: number;
	endTime?: number;
	location?: string;
	attendees?: string[];
	timestamp: number;
	metadata: Record<string, unknown>;
}

/**
 * Default list item type for StandardList
 */
export interface StandardListItem {
	id: string;
	title: string;
	description?: string;
	url?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Standard List - List of items (channels, users, files, etc.)
 * Generic type parameter allows typed items while maintaining StandardData compatibility
 *
 * Supports two formats:
 * 1. Full format with metadata: { type: 'list', items, metadata: { total, hasMore, cursor } }
 * 2. Simple format: { type?: 'list', items, hasMore?, cursor?, total? }
 */
export interface StandardList<T = StandardListItem> {
	type?: 'list';
	items: T[];
	// Full metadata format
	metadata?: {
		total?: number;
		hasMore?: boolean;
		cursor?: string;
	};
	// Simple flat format (for convenience)
	total?: number;
	hasMore?: boolean;
	cursor?: string;
}

/**
 * Union of all standard data types
 */
export type StandardData = StandardMessage | StandardTask | StandardDocument | StandardEvent | StandardList;

// ============================================================================
// ACTION CAPABILITIES
// ============================================================================

/**
 * Describes what an action can consume or produce
 * Enables capability-based routing and validation
 */
export interface ActionCapabilities {
	// Data type capabilities
	canHandleText?: boolean;
	canHandleRichText?: boolean;
	canHandleHtml?: boolean;
	canHandleMarkdown?: boolean;
	canHandleAttachments?: boolean;
	canHandleImages?: boolean;

	// Operation capabilities
	supportsSearch?: boolean;
	supportsPagination?: boolean;
	supportsBulkOperations?: boolean;

	// Data structure capabilities
	supportsNesting?: boolean; // Can handle hierarchical data
	supportsRelations?: boolean; // Can link to other entities
	supportsMetadata?: boolean; // Can handle arbitrary metadata
}

// ============================================================================
// ACTION RESULT ENVELOPE
// ============================================================================

/**
 * ActionResult<T> - The Narrow Waist
 *
 * ALL actions must return this format. This eliminates M × N translation complexity.
 *
 * Benefits:
 * - Uniform data access: result.data, result.metadata
 * - Capability introspection: result.capabilities
 * - Schema versioning: result.metadata.schema
 * - Provider-agnostic processing in WorkflowExecutor
 *
 * Tradeoff (per narrow waist principle):
 * - Some provider-specific richness lost in standardization
 * - But system becomes feasible at scale
 */
export interface ActionResult<T = unknown> {
	/**
	 * Whether the operation succeeded
	 */
	success: boolean;

	/**
	 * The actual data returned by the action
	 * Can be provider-specific (T) or standardized (StandardData)
	 */
	data: T;

	/**
	 * Error information (only present when success is false)
	 */
	error?: {
		message: string;
		code: string;
	};

	/**
	 * Metadata about the result
	 */
	metadata: {
		/**
		 * Source of this data
		 */
		source: {
			integration: string; // 'gmail', 'notion', 'slack'
			action: string; // 'send-email', 'create-page', 'post-message'
		};

		/**
		 * Schema version for this data format
		 * Format: "{integration}.{type}.v{version}"
		 * Examples: "gmail.email.v1", "notion.page.v1", "slack.message.v1"
		 *
		 * Enables:
		 * - Schema evolution without breaking changes
		 * - Validation and type checking
		 * - Documentation generation
		 */
		schema: string;

		/**
		 * When this result was created (Unix timestamp in ms)
		 */
		timestamp: number;

		/**
		 * Optional rate limit information
		 */
		rateLimit?: {
			remaining: number;
			reset: number; // Unix timestamp
			limit: number;
		};

		/**
		 * Optional cost information (for usage-based pricing)
		 */
		cost?: {
			credits: number;
			operations: number;
		};
	};

	/**
	 * Capabilities of this result
	 * Enables intelligent routing and transformation
	 */
	capabilities: ActionCapabilities;

	/**
	 * Optional: Standardized version of the data
	 * Integrations can provide this for easier interop
	 */
	standard?: StandardData;
}

// ============================================================================
// ACTIONRESULT FACTORY METHODS (Static-like pattern)
// ============================================================================

/**
 * ActionResult namespace provides factory methods for creating results
 *
 * Usage:
 * ```typescript
 * // Success
 * return ActionResult.success({ id: '123' });
 *
 * // Success with metadata
 * return ActionResult.success({ id: '123' }, { metadata: { cached: true } });
 *
 * // Error
 * return ActionResult.error('Not found', ErrorCode.NOT_FOUND);
 * ```
 */
export const ActionResult = {
	/**
	 * Create a successful ActionResult
	 */
	success<T>(
		data: T,
		options?: {
			metadata?: Record<string, unknown>;
			capabilities?: ActionCapabilities;
			integration?: string;
			action?: string;
			schema?: string;
		}
	): ActionResult<T> {
		return {
			success: true,
			data,
			metadata: {
				source: {
					integration: options?.integration || 'sdk',
					action: options?.action || 'unknown',
				},
				schema: options?.schema || 'sdk.result.v1',
				timestamp: Date.now(),
				...(options?.metadata as Record<string, unknown>),
			},
			capabilities: options?.capabilities || {},
		};
	},

	/**
	 * Create a failed ActionResult
	 */
	error<T = never>(
		message: string,
		code: string,
		options?: {
			data?: T;
			integration?: string;
			action?: string;
		}
	): ActionResult<T> {
		return {
			success: false,
			data: (options?.data ?? null) as T,
			error: { message, code },
			metadata: {
				source: {
					integration: options?.integration || 'sdk',
					action: options?.action || 'unknown',
				},
				schema: 'sdk.error.v1',
				timestamp: Date.now(),
			},
			capabilities: {},
		};
	},
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create an ActionResult with proper structure
 *
 * Usage:
 * ```typescript
 * return createActionResult({
 *   data: { id: '123', subject: 'Hello' },
 *   integration: 'gmail',
 *   action: 'fetch-email',
 *   schema: 'gmail.email.v1',
 *   capabilities: { canHandleText: true, canHandleHtml: true }
 * });
 * ```
 */
// Overload: Simplified success result
export function createActionResult<T>(params: {
	success: true;
	data: T;
}): ActionResult<T>;

// Overload: Simplified failure result
export function createActionResult<T>(params: {
	success: false;
	error: { message: string; code: string | ErrorCode };
}): ActionResult<T>;

// Overload: Full result with metadata
export function createActionResult<T>(params: {
	data: T;
	integration: string;
	action: string;
	schema: string;
	capabilities: ActionCapabilities;
	standard?: StandardData;
	rateLimit?: ActionResult<T>['metadata']['rateLimit'];
	cost?: ActionResult<T>['metadata']['cost'];
}): ActionResult<T>;

// Implementation
export function createActionResult<T>(params: any): ActionResult<T> {
	// Simplified success pattern: { success: true, data }
	if (params.success === true && 'data' in params && !('integration' in params)) {
		return ActionResult.success(params.data);
	}

	// Simplified failure pattern: { success: false, error }
	if (params.success === false && 'error' in params) {
		return ActionResult.error(params.error.message, params.error.code);
	}

	// Full pattern with all metadata
	return {
		success: true,
		data: params.data,
		metadata: {
			source: {
				integration: params.integration,
				action: params.action,
			},
			schema: params.schema,
			timestamp: Date.now(),
			rateLimit: params.rateLimit,
			cost: params.cost,
		},
		capabilities: params.capabilities,
		standard: params.standard,
	};
}

/**
 * Type guard to check if a value is an ActionResult
 */
export function isActionResult<T>(value: unknown): value is ActionResult<T> {
	if (!value || typeof value !== 'object') return false;

	const result = value as Partial<ActionResult>;

	return (
		typeof result.success === 'boolean' &&
		result.data !== undefined &&
		result.metadata?.source?.integration !== undefined &&
		result.metadata?.source?.action !== undefined &&
		result.metadata?.schema !== undefined &&
		result.metadata?.timestamp !== undefined &&
		result.capabilities !== undefined
	);
}

/**
 * Extract just the data from an ActionResult (for backward compatibility)
 */
export function unwrapResult<T>(result: ActionResult<T> | T): T {
	if (isActionResult<T>(result)) {
		return result.data;
	}
	return result as T;
}

/**
 * Check if two results are compatible for data flow
 * (e.g., can output of Action A flow into input of Action B?)
 */
export function areResultsCompatible(
	output: ActionCapabilities,
	input: ActionCapabilities
): {
	compatible: boolean;
	reason?: string;
} {
	// If input requires text and output can't provide it
	if (input.canHandleText && !output.canHandleText) {
		return { compatible: false, reason: 'Output does not provide text capability' };
	}

	// If input requires rich text and output can't provide it
	if (input.canHandleRichText && !output.canHandleRichText) {
		return { compatible: false, reason: 'Output does not provide rich text capability' };
	}

	// If input requires attachments and output can't provide them
	if (input.canHandleAttachments && !output.canHandleAttachments) {
		return { compatible: false, reason: 'Output does not provide attachments capability' };
	}

	// Compatible!
	return { compatible: true };
}

// ============================================================================
// ERROR ACCESS HELPERS (DX Improvement)
// ============================================================================

/**
 * Get the error message from an ActionResult
 * Returns undefined if result was successful
 *
 * @example
 * ```typescript
 * const result = await stripe.createPayment(options);
 * if (!result.success) {
 *   console.log(getErrorMessage(result)); // "Invalid card number"
 * }
 * ```
 */
export function getErrorMessage<T>(result: ActionResult<T>): string | undefined {
	return result.error?.message;
}

/**
 * Get the error code from an ActionResult
 * Returns undefined if result was successful
 *
 * @example
 * ```typescript
 * const result = await stripe.createPayment(options);
 * if (!result.success && getErrorCode(result) === ErrorCode.RATE_LIMITED) {
 *   // Handle rate limiting
 * }
 * ```
 */
export function getErrorCode<T>(result: ActionResult<T>): string | undefined {
	return result.error?.code;
}

/**
 * Check if a result failed with a specific error code
 *
 * @example
 * ```typescript
 * if (hasErrorCode(result, ErrorCode.AUTH_EXPIRED)) {
 *   await refreshOAuthToken();
 * }
 * ```
 */
export function hasErrorCode<T>(result: ActionResult<T>, code: string): boolean {
	return !result.success && result.error?.code === code;
}

/**
 * Check if a result is a failure (type guard)
 * Narrows the type to ensure error is present
 *
 * @example
 * ```typescript
 * const result = await stripe.createPayment(options);
 * if (isFailure(result)) {
 *   // TypeScript knows result.error is defined here
 *   console.log(result.error.message);
 * }
 * ```
 */
export function isFailure<T>(
	result: ActionResult<T>
): result is ActionResult<T> & { success: false; error: { message: string; code: string } } {
	return !result.success && result.error !== undefined;
}

/**
 * Check if a result is a success (type guard)
 * Narrows the type to ensure data is valid
 *
 * @example
 * ```typescript
 * const result = await stripe.createPayment(options);
 * if (isSuccess(result)) {
 *   // TypeScript knows result.data is the expected type
 *   console.log(result.data.id);
 * }
 * ```
 */
export function isSuccess<T>(
	result: ActionResult<T>
): result is ActionResult<T> & { success: true; error: undefined } {
	return result.success === true;
}

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
 * Response Utilities - Weniger, aber besser
 *
 * Common response parsing and transformation patterns used across integrations.
 * Eliminates ~100 lines of duplicate code.
 *
 * Features:
 * - StandardList builder for pagination
 * - Success response wrapper for consistent API responses
 * - Response metadata extraction
 * - Rate limit parsing
 *
 * ## Success Response Pattern
 *
 * Use the standardized success wrapper for consistent API responses:
 *
 * ```typescript
 * // For data responses
 * return buildSuccessResponse({ users: [...] });
 * // Returns: { success: true, data: { users: [...] } }
 *
 * // For empty success (mutations)
 * return buildSuccessResponse();
 * // Returns: { success: true }
 *
 * // For responses with metadata
 * return buildSuccessResponse(data, { cached: true, ttl: 3600 });
 * // Returns: { success: true, data: {...}, meta: { cached: true, ttl: 3600 } }
 * ```
 */

import type { StandardList, ActionCapabilities } from './action-result';

// ============================================================================
// SUCCESS RESPONSE UTILITIES
// ============================================================================

/**
 * Standard success response envelope
 *
 * Provides consistent structure for all API success responses.
 * Use this instead of returning raw data or ad-hoc { success: true } objects.
 */
export interface SuccessResponse<T = undefined> {
	/** Always true for success responses */
	success: true;

	/** The response payload (omitted for empty success responses) */
	data?: T;

	/** Optional metadata about the response */
	meta?: ResponseMeta;
}

/**
 * Response metadata for success responses
 */
export interface ResponseMeta {
	/** Whether the response was served from cache */
	cached?: boolean;

	/** Cache TTL in seconds */
	ttl?: number;

	/** Request ID for tracing */
	requestId?: string;

	/** Processing time in milliseconds */
	durationMs?: number;

	/** Any additional metadata */
	[key: string]: unknown;
}

/**
 * Standard error response envelope
 *
 * Mirrors the success response structure for consistency.
 * Prefer using IntegrationError.toJSON() for error responses.
 */
export interface ErrorResponse {
	/** Always false for error responses */
	success: false;

	/** Human-readable error message */
	error: string;

	/** Machine-parseable error code */
	code: string;

	/** Optional additional error details */
	details?: Record<string, unknown>;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = undefined> = SuccessResponse<T> | ErrorResponse;

/**
 * Build a standardized success response
 *
 * Weniger, aber besser: One function for all success response needs.
 *
 * @param data - Optional response payload
 * @param meta - Optional response metadata
 * @returns Standardized success response envelope
 *
 * @example Empty success (mutations, deletes)
 * ```typescript
 * return buildSuccessResponse();
 * // { success: true }
 * ```
 *
 * @example Data response
 * ```typescript
 * return buildSuccessResponse({ user: { id: '123', name: 'Alice' } });
 * // { success: true, data: { user: { id: '123', name: 'Alice' } } }
 * ```
 *
 * @example With metadata
 * ```typescript
 * return buildSuccessResponse(data, { cached: true, durationMs: 42 });
 * // { success: true, data: {...}, meta: { cached: true, durationMs: 42 } }
 * ```
 */
export function buildSuccessResponse<T = undefined>(
	data?: T,
	meta?: ResponseMeta
): SuccessResponse<T> {
	const response: SuccessResponse<T> = { success: true };

	if (data !== undefined) {
		response.data = data;
	}

	if (meta !== undefined && Object.keys(meta).length > 0) {
		response.meta = meta;
	}

	return response;
}

/**
 * Build a standardized error response
 *
 * Prefer using IntegrationError for throwing errors.
 * Use this only when you need to return an error response without throwing.
 *
 * @param error - Error message
 * @param code - Error code (from ErrorCode enum)
 * @param details - Optional additional details
 * @returns Standardized error response envelope
 *
 * @example
 * ```typescript
 * return buildErrorResponse('User not found', 'not_found');
 * // { success: false, error: 'User not found', code: 'not_found' }
 * ```
 */
export function buildErrorResponse(
	error: string,
	code: string,
	details?: Record<string, unknown>
): ErrorResponse {
	const response: ErrorResponse = {
		success: false,
		error,
		code,
	};

	if (details !== undefined && Object.keys(details).length > 0) {
		response.details = details;
	}

	return response;
}

/**
 * Type guard to check if a response is a success response
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
	return response.success === true;
}

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: ApiResponse<unknown>): response is ErrorResponse {
	return response.success === false;
}

/**
 * Unwrap a success response, throwing if it's an error
 *
 * @param response - API response to unwrap
 * @returns The data from a success response
 * @throws Error if response is an error response
 *
 * @example
 * ```typescript
 * const response = await api.getUser();
 * const data = unwrapResponse(response);
 * // data is typed as the success response data
 * ```
 */
export function unwrapResponse<T>(response: ApiResponse<T>): T | undefined {
	if (isErrorResponse(response)) {
		throw new Error(`API Error [${response.code}]: ${response.error}`);
	}
	return response.data;
}

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

/**
 * Options for building a StandardList
 */
export interface StandardListOptions<T> {
	/** The raw items from the API response */
	items: T[];

	/** Function to transform each item to the standard format */
	mapper: (item: T) => {
		id: string;
		title: string;
		description?: string;
		url?: string;
		metadata?: Record<string, unknown>;
	};

	/** Total count of items (if known) */
	total?: number;

	/** Whether there are more items available */
	hasMore?: boolean;

	/** Cursor for fetching the next page */
	cursor?: string;
}

/**
 * Build a StandardList from API response data
 *
 * Weniger, aber besser: One function for all pagination needs.
 * Eliminates duplicated StandardList construction across 5+ integrations.
 *
 * @example
 * ```typescript
 * // Slack channels
 * const standard = buildStandardList({
 *   items: channels,
 *   mapper: (ch) => ({
 *     id: ch.id,
 *     title: ch.name,
 *     description: ch.purpose?.value,
 *     metadata: { memberCount: ch.num_members }
 *   }),
 *   hasMore: response.response_metadata?.next_cursor !== undefined,
 *   cursor: response.response_metadata?.next_cursor
 * });
 *
 * // Notion pages
 * const standard = buildStandardList({
 *   items: results,
 *   mapper: (page) => ({
 *     id: page.id,
 *     title: extractTitle(page),
 *     url: page.url
 *   }),
 *   hasMore: response.has_more,
 *   cursor: response.next_cursor
 * });
 * ```
 */
export function buildStandardList<T>(options: StandardListOptions<T>): StandardList {
	const { items, mapper, total, hasMore, cursor } = options;

	return {
		type: 'list',
		items: items.map(mapper),
		metadata: {
			total: total ?? items.length,
			hasMore,
			cursor,
		},
	};
}

/**
 * Pagination metadata extracted from a response
 */
export interface PaginationMetadata {
	total: number;
	hasMore: boolean;
	cursor?: string;
	page?: number;
	limit?: number;
}

/**
 * Extract pagination metadata from common API response patterns
 *
 * Handles various pagination conventions:
 * - Slack: response_metadata.next_cursor
 * - Notion: has_more, next_cursor
 * - Standard: pagination.total, pagination.hasMore
 */
export function extractPaginationMetadata(response: any): PaginationMetadata {
	// Slack pattern
	if (response.response_metadata?.next_cursor !== undefined) {
		return {
			total: response.items?.length || response.channels?.length || 0,
			hasMore: response.response_metadata.next_cursor !== '',
			cursor: response.response_metadata.next_cursor || undefined,
		};
	}

	// Notion pattern
	if (response.has_more !== undefined) {
		return {
			total: response.results?.length || 0,
			hasMore: response.has_more,
			cursor: response.next_cursor || undefined,
		};
	}

	// HubSpot pattern
	if (response.paging?.next?.after !== undefined) {
		return {
			total: response.total || response.results?.length || 0,
			hasMore: response.paging.next !== undefined,
			cursor: response.paging.next.after,
		};
	}

	// Standard pagination pattern
	if (response.pagination) {
		return {
			total: response.pagination.total || 0,
			hasMore: response.pagination.hasMore || false,
			cursor: response.pagination.cursor,
			page: response.pagination.page,
			limit: response.pagination.limit,
		};
	}

	// Fallback
	return {
		total: Array.isArray(response) ? response.length : 0,
		hasMore: false,
	};
}

// ============================================================================
// RATE LIMIT UTILITIES
// ============================================================================

/**
 * Rate limit information extracted from response headers
 */
export interface RateLimitInfo {
	/** Remaining requests in the current window */
	remaining: number;

	/** When the rate limit resets (Unix timestamp in ms) */
	reset: number;

	/** Maximum requests per window */
	limit: number;
}

/**
 * Extract rate limit information from response headers
 *
 * Handles various header conventions:
 * - X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Limit
 * - RateLimit-Remaining, RateLimit-Reset, RateLimit-Limit
 * - X-Rate-Limit-Remaining, X-Rate-Limit-Reset, X-Rate-Limit-Limit
 * - Retry-After (for 429 responses)
 */
export function extractRateLimitInfo(response: Response): RateLimitInfo | undefined {
	const headers = response.headers;

	// Common header name variations
	const headerVariants = [
		{ remaining: 'X-RateLimit-Remaining', reset: 'X-RateLimit-Reset', limit: 'X-RateLimit-Limit' },
		{ remaining: 'RateLimit-Remaining', reset: 'RateLimit-Reset', limit: 'RateLimit-Limit' },
		{ remaining: 'X-Rate-Limit-Remaining', reset: 'X-Rate-Limit-Reset', limit: 'X-Rate-Limit-Limit' },
	];

	for (const variant of headerVariants) {
		const remaining = headers.get(variant.remaining);
		const reset = headers.get(variant.reset);
		const limit = headers.get(variant.limit);

		if (remaining !== null) {
			return {
				remaining: parseInt(remaining, 10),
				reset: parseResetHeader(reset),
				limit: limit ? parseInt(limit, 10) : 0,
			};
		}
	}

	// Handle Retry-After for 429 responses
	if (response.status === 429) {
		const retryAfter = headers.get('Retry-After');
		if (retryAfter) {
			return {
				remaining: 0,
				reset: parseRetryAfterHeader(retryAfter),
				limit: 0,
			};
		}
	}

	return undefined;
}

/**
 * Parse a rate limit reset header value
 * Can be Unix timestamp or date string
 */
function parseResetHeader(value: string | null): number {
	if (!value) return Date.now() + 60000; // Default: 1 minute from now

	const parsed = parseInt(value, 10);

	// If it's a small number, assume it's seconds from now
	if (parsed < 10000000000) {
		return Date.now() + parsed * 1000;
	}

	// Otherwise assume it's a Unix timestamp (seconds)
	return parsed * 1000;
}

/**
 * Parse a Retry-After header value
 * Can be seconds or date string
 */
function parseRetryAfterHeader(value: string): number {
	// Try parsing as seconds
	const seconds = parseInt(value, 10);
	if (!isNaN(seconds)) {
		return Date.now() + seconds * 1000;
	}

	// Try parsing as date
	const date = Date.parse(value);
	if (!isNaN(date)) {
		return date;
	}

	// Default: 60 seconds
	return Date.now() + 60000;
}

// ============================================================================
// COMMON CAPABILITIES
// ============================================================================

/**
 * Common capability presets for integrations
 *
 * Weniger, aber besser: Reusable capability configurations.
 */
export const CommonCapabilities = {
	/** Capabilities for list/search operations */
	list: {
		supportsSearch: true,
		supportsPagination: true,
		supportsMetadata: true,
	} as ActionCapabilities,

	/** Capabilities for document operations (Notion, Google Docs) */
	document: {
		canHandleText: true,
		canHandleRichText: true,
		canHandleMarkdown: true,
		supportsMetadata: true,
		supportsNesting: true,
	} as ActionCapabilities,

	/** Capabilities for message operations (Slack, Email) */
	message: {
		canHandleText: true,
		canHandleHtml: true,
		canHandleAttachments: true,
		supportsMetadata: true,
	} as ActionCapabilities,

	/** Capabilities for task operations (Todoist, Linear) */
	task: {
		canHandleText: true,
		supportsMetadata: true,
		supportsRelations: true,
	} as ActionCapabilities,

	/** Capabilities for CRM operations (HubSpot, Salesforce) */
	crm: {
		canHandleText: true,
		supportsSearch: true,
		supportsPagination: true,
		supportsMetadata: true,
		supportsRelations: true,
	} as ActionCapabilities,

	/** Basic read-only capabilities */
	readonly: {
		canHandleText: true,
		supportsMetadata: true,
	} as ActionCapabilities,
};

// ============================================================================
// RESPONSE TRANSFORMATION HELPERS
// ============================================================================

/**
 * Safely extract a nested property from an object
 *
 * @example
 * ```typescript
 * const title = safeGet(page, 'properties.Name.title.0.plain_text', 'Untitled');
 * ```
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
	const keys = path.split('.');
	let current = obj;

	for (const key of keys) {
		if (current === null || current === undefined) {
			return defaultValue;
		}
		current = current[key];
	}

	return current ?? defaultValue;
}

/**
 * Extract first non-empty string from multiple paths
 *
 * @example
 * ```typescript
 * const title = extractFirstString(page, [
 *   'properties.Name.title.0.plain_text',
 *   'properties.Title.title.0.plain_text',
 *   'id'
 * ], 'Untitled');
 * ```
 */
export function extractFirstString(obj: any, paths: string[], defaultValue: string): string {
	for (const path of paths) {
		const value = safeGet<string | null>(obj, path, null);
		if (value !== null && value.trim() !== '') {
			return value;
		}
	}
	return defaultValue;
}

/**
 * Convert snake_case or kebab-case keys to camelCase
 */
export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		const camelKey = key.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());

		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			result[camelKey] = toCamelCase(value as Record<string, unknown>);
		} else {
			result[camelKey] = value;
		}
	}

	return result;
}

/**
 * Cloudflare KV Operations
 *
 * List keys, get values, and inspect KV namespaces.
 * Progressive disclosure: read this file when you need KV operations.
 *
 * @example
 * ```typescript
 * import { kv } from './servers/cloudflare';
 *
 * // List keys with prefix filtering
 * const keys = await kv.list({ namespace: 'ns_id', prefix: 'tokens:' });
 * console.log(`Found ${keys.length} token keys`);
 *
 * // Get a specific value
 * const token = await kv.get({ namespace: 'ns_id', key: 'tokens:user123' });
 * ```
 */

import { getConfig } from '../../config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface KVKey {
	name: string;
	expiration?: number;
	metadata?: Record<string, unknown>;
}

export interface KVListInput {
	/** KV namespace ID */
	namespace: string;
	/** Optional key prefix to filter results */
	prefix?: string;
	/** Maximum number of keys to return (default: 100, max: 1000) */
	limit?: number;
	/** Cursor for pagination */
	cursor?: string;
}

export interface KVListResult {
	keys: KVKey[];
	cursor?: string;
	complete: boolean;
}

export interface KVGetInput {
	/** KV namespace ID */
	namespace: string;
	/** The key to retrieve */
	key: string;
}

export interface KVPutInput {
	/** KV namespace ID */
	namespace: string;
	/** The key to store */
	key: string;
	/** The value to store */
	value: string;
	/** Optional expiration TTL in seconds */
	expirationTtl?: number;
	/** Optional metadata */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * List keys in a KV namespace
 *
 * @example
 * ```typescript
 * // List all OAuth tokens
 * const tokens = await kv.list({ namespace: 'ns_id', prefix: 'tokens:' });
 * tokens.keys.forEach(k => console.log(k.name));
 *
 * // Paginate through large results
 * let cursor: string | undefined;
 * do {
 *   const result = await kv.list({ namespace: 'ns_id', cursor });
 *   console.log(`Batch: ${result.keys.length} keys`);
 *   cursor = result.cursor;
 * } while (cursor);
 * ```
 */
export async function list(input: KVListInput): Promise<KVListResult> {
	const config = getConfig();

	const params = new URLSearchParams();
	if (input.prefix) params.set('prefix', input.prefix);
	if (input.limit) params.set('limit', String(Math.min(input.limit, 1000)));
	if (input.cursor) params.set('cursor', input.cursor);

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${input.namespace}/keys?${params}`,
		{
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
			},
		}
	);

	if (!response.ok) {
		throw new Error(`KV list failed: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as {
		result: KVKey[];
		result_info?: { cursor?: string };
		success: boolean;
	};

	return {
		keys: data.result || [],
		cursor: data.result_info?.cursor,
		complete: !data.result_info?.cursor,
	};
}

/**
 * Get a value from KV
 *
 * @example
 * ```typescript
 * // Get OAuth token
 * const tokenJson = await kv.get({ namespace: 'ns_id', key: 'tokens:user123:zoom' });
 * if (tokenJson) {
 *   const token = JSON.parse(tokenJson);
 *   console.log(`Token expires: ${new Date(token.expiresAt)}`);
 * }
 * ```
 */
export async function get(input: KVGetInput): Promise<string | null> {
	const config = getConfig();

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${input.namespace}/values/${encodeURIComponent(input.key)}`,
		{
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
			},
		}
	);

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`KV get failed: ${response.status} ${response.statusText}`);
	}

	return response.text();
}

/**
 * Get a value from KV and parse as JSON
 *
 * @example
 * ```typescript
 * const token = await kv.getJson<OAuthToken>({ namespace: 'ns_id', key: 'tokens:user123:zoom' });
 * if (token) {
 *   console.log(`Connected account: ${token.email}`);
 * }
 * ```
 */
export async function getJson<T>(input: KVGetInput): Promise<T | null> {
	const value = await get(input);
	if (!value) return null;
	return JSON.parse(value) as T;
}

/**
 * Put a value into KV
 *
 * @example
 * ```typescript
 * await kv.put({
 *   namespace: 'ns_id',
 *   key: 'cache:workflow:123',
 *   value: JSON.stringify({ status: 'running' }),
 *   expirationTtl: 3600 // 1 hour
 * });
 * ```
 */
export async function put(input: KVPutInput): Promise<void> {
	const config = getConfig();

	const url = new URL(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${input.namespace}/values/${encodeURIComponent(input.key)}`
	);

	if (input.expirationTtl) {
		url.searchParams.set('expiration_ttl', String(input.expirationTtl));
	}

	const response = await fetch(url.toString(), {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
			'Content-Type': 'text/plain',
		},
		body: input.value,
	});

	if (!response.ok) {
		throw new Error(`KV put failed: ${response.status} ${response.statusText}`);
	}
}

/**
 * Delete a key from KV
 *
 * @example
 * ```typescript
 * await kv.del({ namespace: 'ns_id', key: 'tokens:user123:zoom' });
 * console.log('Token revoked');
 * ```
 */
export async function del(input: KVGetInput): Promise<void> {
	const config = getConfig();

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${input.namespace}/values/${encodeURIComponent(input.key)}`,
		{
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
			},
		}
	);

	if (!response.ok) {
		throw new Error(`KV delete failed: ${response.status} ${response.statusText}`);
	}
}

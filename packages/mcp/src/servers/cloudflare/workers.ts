/**
 * Cloudflare Workers Operations
 *
 * List workers, get logs, and inspect worker state.
 * Progressive disclosure: read this file when you need Worker operations.
 *
 * @example
 * ```typescript
 * import { workers } from './servers/cloudflare';
 *
 * // List all workers
 * const list = await workers.list();
 * list.forEach(w => console.log(`${w.id}: ${w.modified_on}`));
 *
 * // Get worker analytics
 * const analytics = await workers.analytics({ name: 'workway-api' });
 * console.log(`Requests: ${analytics.requests}, Errors: ${analytics.errors}`);
 * ```
 */

import { getConfig } from '../../config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface Worker {
	id: string;
	etag: string;
	handlers: string[];
	modified_on: string;
	created_on: string;
	usage_model: string;
}

export interface WorkerAnalytics {
	requests: number;
	errors: number;
	subrequests: number;
	cpuTime: number;
	duration: number;
}

export interface WorkerLogEntry {
	timestamp: string;
	level: 'log' | 'warn' | 'error' | 'debug';
	message: string[];
	scriptName: string;
}

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * List all Workers in the account
 *
 * @example
 * ```typescript
 * const workers = await workers.list();
 * console.log(`Found ${workers.length} workers`);
 *
 * // Find WORKWAY workers
 * const workway = workers.filter(w => w.id.includes('workway'));
 * workway.forEach(w => console.log(`${w.id}: modified ${w.modified_on}`));
 * ```
 */
export async function list(): Promise<Worker[]> {
	const config = getConfig();

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/scripts`,
		{
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
			},
		}
	);

	if (!response.ok) {
		throw new Error(`Workers list failed: ${response.status}`);
	}

	const data = (await response.json()) as { result: Worker[] };
	return data.result || [];
}

/**
 * Get worker analytics for a time period
 *
 * @example
 * ```typescript
 * // Last hour analytics
 * const analytics = await workers.analytics({
 *   name: 'workway-api',
 *   since: new Date(Date.now() - 60 * 60 * 1000).toISOString()
 * });
 *
 * console.log(`Requests: ${analytics.requests}`);
 * console.log(`Error rate: ${(analytics.errors / analytics.requests * 100).toFixed(2)}%`);
 * console.log(`Avg CPU: ${(analytics.cpuTime / analytics.requests).toFixed(2)}ms`);
 * ```
 */
export async function analytics(input: {
	name: string;
	since?: string;
	until?: string;
}): Promise<WorkerAnalytics> {
	const config = getConfig();

	const since = input.since || new Date(Date.now() - 15 * 60 * 1000).toISOString();
	const until = input.until || new Date().toISOString();

	// Use GraphQL Analytics API
	const query = `
    query WorkerAnalytics($accountTag: String!, $scriptName: String!, $since: Time!, $until: Time!) {
      viewer {
        accounts(filter: {accountTag: $accountTag}) {
          workersInvocationsAdaptive(
            limit: 1000
            filter: {
              scriptName: $scriptName
              datetime_geq: $since
              datetime_leq: $until
            }
          ) {
            sum {
              requests
              errors
              subrequests
            }
            quantiles {
              cpuTimeP50
              durationP50
            }
          }
        }
      }
    }
  `;

	const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query,
			variables: {
				accountTag: config.accountId,
				scriptName: input.name,
				since,
				until,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Analytics query failed: ${response.status}`);
	}

	const data = (await response.json()) as {
		data?: {
			viewer?: {
				accounts?: Array<{
					workersInvocationsAdaptive?: Array<{
						sum?: { requests?: number; errors?: number; subrequests?: number };
						quantiles?: { cpuTimeP50?: number; durationP50?: number };
					}>;
				}>;
			};
		};
	};

	const stats = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0];

	return {
		requests: stats?.sum?.requests || 0,
		errors: stats?.sum?.errors || 0,
		subrequests: stats?.sum?.subrequests || 0,
		cpuTime: stats?.quantiles?.cpuTimeP50 || 0,
		duration: stats?.quantiles?.durationP50 || 0,
	};
}

/**
 * Get worker environment variables (names only, not values)
 *
 * @example
 * ```typescript
 * const bindings = await workers.bindings({ name: 'workway-api' });
 * console.log('KV Namespaces:', bindings.kv.map(b => b.name));
 * console.log('D1 Databases:', bindings.d1.map(b => b.name));
 * console.log('Secrets:', bindings.secrets.map(b => b.name));
 * ```
 */
export async function bindings(input: { name: string }): Promise<{
	kv: Array<{ name: string; namespace_id: string }>;
	d1: Array<{ name: string; database_id: string }>;
	secrets: Array<{ name: string }>;
	vars: Array<{ name: string; value: string }>;
}> {
	const config = getConfig();

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/scripts/${input.name}/settings`,
		{
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
			},
		}
	);

	if (!response.ok) {
		throw new Error(`Worker settings failed: ${response.status}`);
	}

	const data = (await response.json()) as {
		result?: {
			bindings?: Array<{
				type: string;
				name: string;
				namespace_id?: string;
				id?: string;
				text?: string;
			}>;
		};
	};

	const bindings = data.result?.bindings || [];

	return {
		kv: bindings
			.filter(b => b.type === 'kv_namespace')
			.map(b => ({ name: b.name, namespace_id: b.namespace_id! })),
		d1: bindings
			.filter(b => b.type === 'd1')
			.map(b => ({ name: b.name, database_id: b.id! })),
		secrets: bindings.filter(b => b.type === 'secret_text').map(b => ({ name: b.name })),
		vars: bindings
			.filter(b => b.type === 'plain_text')
			.map(b => ({ name: b.name, value: b.text! })),
	};
}

/**
 * Instructions for tailing worker logs
 *
 * Note: Real-time log tailing requires wrangler CLI or WebSocket connection.
 * This function provides the command to run.
 *
 * @example
 * ```typescript
 * const cmd = workers.tailCommand({ name: 'workway-api' });
 * console.log('Run this command to tail logs:');
 * console.log(cmd);
 * ```
 */
export function tailCommand(input: { name: string; format?: 'json' | 'pretty' }): string {
	const format = input.format || 'pretty';
	return `wrangler tail ${input.name} --format ${format}`;
}

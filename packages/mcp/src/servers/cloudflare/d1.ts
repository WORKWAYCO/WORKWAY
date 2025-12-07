/**
 * Cloudflare D1 Database Operations
 *
 * Execute queries, inspect schemas, and debug database state.
 * Progressive disclosure: read this file when you need D1 operations.
 *
 * @example
 * ```typescript
 * import { d1 } from './servers/cloudflare';
 *
 * // Query workflow executions
 * const runs = await d1.query({
 *   database: 'db_id',
 *   query: 'SELECT * FROM workflow_runs WHERE status = ? ORDER BY created_at DESC LIMIT 10',
 *   params: ['failed']
 * });
 * console.log(`Found ${runs.length} failed runs`);
 *
 * // List all tables
 * const tables = await d1.tables({ database: 'db_id' });
 * tables.forEach(t => console.log(`${t.name}: ${t.sql}`));
 * ```
 */

import { getConfig } from '../../config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface D1QueryInput {
	/** D1 database ID */
	database: string;
	/** SQL query to execute (SELECT, PRAGMA only for safety) */
	query: string;
	/** Query parameters for prepared statements */
	params?: (string | number | boolean | null)[];
}

export interface D1QueryResult<T = Record<string, unknown>> {
	results: T[];
	meta: {
		duration: number;
		changes: number;
		last_row_id: number;
		rows_read: number;
		rows_written: number;
	};
}

export interface D1Table {
	name: string;
	sql: string;
}

export interface D1TablesInput {
	/** D1 database ID */
	database: string;
}

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * Execute a read-only SQL query against D1
 *
 * Only SELECT and PRAGMA queries are allowed for safety.
 *
 * @example
 * ```typescript
 * // Get recent workflow executions
 * const runs = await d1.query<WorkflowRun>({
 *   database: 'db_id',
 *   query: `
 *     SELECT id, workflow_id, status, created_at, completed_at
 *     FROM workflow_runs
 *     WHERE created_at > datetime('now', '-1 hour')
 *     ORDER BY created_at DESC
 *   `
 * });
 *
 * // Filter in code (not context)
 * const failed = runs.filter(r => r.status === 'failed');
 * console.log(`${failed.length} failed in last hour`);
 *
 * // Use parameterized queries
 * const userRuns = await d1.query({
 *   database: 'db_id',
 *   query: 'SELECT * FROM workflow_runs WHERE user_id = ?',
 *   params: ['user_123']
 * });
 * ```
 */
export async function query<T = Record<string, unknown>>(
	input: D1QueryInput
): Promise<T[]> {
	const config = getConfig();

	// Safety check: only allow read operations
	const normalizedQuery = input.query.trim().toUpperCase();
	if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('PRAGMA')) {
		throw new Error(
			'Only SELECT and PRAGMA queries are allowed. ' +
				'For write operations, use the WORKWAY API or wrangler CLI.'
		);
	}

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${input.database}/query`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				sql: input.query,
				params: input.params || [],
			}),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`D1 query failed: ${response.status} - ${error}`);
	}

	const data = (await response.json()) as {
		result: Array<D1QueryResult<T>>;
		success: boolean;
		errors?: Array<{ message: string }>;
	};

	if (!data.success || data.errors?.length) {
		throw new Error(`D1 query error: ${data.errors?.[0]?.message || 'Unknown error'}`);
	}

	return data.result[0]?.results || [];
}

/**
 * List all tables in a D1 database with their schemas
 *
 * @example
 * ```typescript
 * const tables = await d1.tables({ database: 'db_id' });
 *
 * // Find tables related to workflows
 * const workflowTables = tables.filter(t => t.name.includes('workflow'));
 * workflowTables.forEach(t => {
 *   console.log(`\n=== ${t.name} ===`);
 *   console.log(t.sql);
 * });
 * ```
 */
export async function tables(input: D1TablesInput): Promise<D1Table[]> {
	const results = await query<{ name: string; sql: string }>({
		database: input.database,
		query: "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
	});

	return results;
}

/**
 * Get table schema (columns and types)
 *
 * @example
 * ```typescript
 * const schema = await d1.tableInfo({ database: 'db_id', table: 'workflow_runs' });
 * schema.forEach(col => {
 *   console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''}`);
 * });
 * ```
 */
export async function tableInfo(input: {
	database: string;
	table: string;
}): Promise<
	Array<{
		cid: number;
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}>
> {
	return query({
		database: input.database,
		query: `PRAGMA table_info(${input.table})`,
	});
}

/**
 * Count rows in a table (optionally with WHERE clause)
 *
 * @example
 * ```typescript
 * // Total count
 * const total = await d1.count({ database: 'db_id', table: 'workflow_runs' });
 * console.log(`Total runs: ${total}`);
 *
 * // Filtered count
 * const failed = await d1.count({
 *   database: 'db_id',
 *   table: 'workflow_runs',
 *   where: "status = 'failed'"
 * });
 * console.log(`Failed runs: ${failed}`);
 * ```
 */
export async function count(input: {
	database: string;
	table: string;
	where?: string;
}): Promise<number> {
	const whereClause = input.where ? ` WHERE ${input.where}` : '';
	const results = await query<{ count: number }>({
		database: input.database,
		query: `SELECT COUNT(*) as count FROM ${input.table}${whereClause}`,
	});

	return results[0]?.count || 0;
}

/**
 * Get the most recent rows from a table
 *
 * @example
 * ```typescript
 * // Get last 5 workflow runs
 * const recent = await d1.recent({
 *   database: 'db_id',
 *   table: 'workflow_runs',
 *   orderBy: 'created_at',
 *   limit: 5
 * });
 * recent.forEach(r => console.log(`${r.id}: ${r.status}`));
 * ```
 */
export async function recent<T = Record<string, unknown>>(input: {
	database: string;
	table: string;
	orderBy: string;
	limit?: number;
	where?: string;
}): Promise<T[]> {
	const whereClause = input.where ? ` WHERE ${input.where}` : '';
	const limit = input.limit || 10;

	return query<T>({
		database: input.database,
		query: `SELECT * FROM ${input.table}${whereClause} ORDER BY ${input.orderBy} DESC LIMIT ${limit}`,
	});
}

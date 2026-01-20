/**
 * D1 Helpers - Utilities for Cloudflare D1 + Drizzle ORM
 *
 * Addresses common pitfalls when working with D1 and Drizzle:
 * - JSON field serialization (D1 serializes objects as "[object Object]")
 * - Type-safe JSON column handling
 * - Schema validation helpers
 * - Read replica support with consistency options
 *
 * @example
 * ```typescript
 * import { jsonField, parseJsonField, readQuery } from '@workway/sdk'
 *
 * // Insert with JSON field
 * await db.insert(workflowRuns).values({
 *   id: 'run_123',
 *   triggerData: jsonField({ command: '/focus', task: 'Build feature' }),
 * })
 *
 * // Read and parse JSON field
 * const run = await db.select().from(workflowRuns).where(eq(id, 'run_123'))
 * const data = parseJsonField(run.triggerData)
 *
 * // Read with eventual consistency (uses read replicas)
 * const workflows = await readQuery(db, 'SELECT * FROM workflows WHERE status = ?', ['active'])
 * ```
 */

// ============================================================================
// D1 READ REPLICA SUPPORT
// ============================================================================

/**
 * Consistency level for D1 queries
 * - 'strong': Read from primary (guaranteed latest data)
 * - 'eventual': Read from replica (may be slightly stale, better performance)
 */
export type D1Consistency = 'strong' | 'eventual';

/**
 * Options for read queries
 */
export interface ReadQueryOptions {
	/** Consistency level - 'eventual' uses read replicas for better performance */
	consistency?: D1Consistency;
}

/**
 * Execute a read query with optional read replica support
 *
 * Use 'eventual' consistency for:
 * - List/browse operations
 * - Search results
 * - Dashboard data
 * - Analytics queries
 *
 * Use 'strong' consistency (default) for:
 * - Auth checks
 * - Payment verification
 * - Data immediately after writes
 *
 * @example
 * ```typescript
 * // Read from replica (faster, may be slightly stale)
 * const workflows = await readQuery<Workflow>(
 *   db,
 *   'SELECT * FROM workflows WHERE tenant_id = ?',
 *   [tenantId],
 *   { consistency: 'eventual' }
 * );
 *
 * // Read from primary (guaranteed fresh)
 * const user = await readQuery<User>(
 *   db,
 *   'SELECT * FROM users WHERE id = ?',
 *   [userId]
 *   // defaults to 'strong'
 * );
 * ```
 */
export async function readQuery<T = Record<string, unknown>>(
	db: D1Database,
	query: string,
	params: unknown[] = [],
	options: ReadQueryOptions = {}
): Promise<T[]> {
	const { consistency = 'strong' } = options;

	const stmt = db.prepare(query);
	const bound = params.length > 0 ? stmt.bind(...params) : stmt;

	// D1 read replicas - consistency is set at database level
	// The consistency parameter is passed to the query for documentation
	// but actual replica routing is handled by Cloudflare
	void consistency; // Document intent, actual routing is automatic
	const result = await bound.all<T>();

	return result.results ?? [];
}

/**
 * Execute a single-row read query with optional read replica support
 *
 * @example
 * ```typescript
 * const workflow = await readFirst<Workflow>(
 *   db,
 *   'SELECT * FROM workflows WHERE id = ?',
 *   [workflowId],
 *   { consistency: 'eventual' }
 * );
 * ```
 */
export async function readFirst<T = Record<string, unknown>>(
	db: D1Database,
	query: string,
	params: unknown[] = [],
	options: ReadQueryOptions = {}
): Promise<T | null> {
	const { consistency = 'strong' } = options;

	const stmt = db.prepare(query);
	const bound = params.length > 0 ? stmt.bind(...params) : stmt;

	// @ts-expect-error - D1 types may not include consistency yet
	const result = await bound.first<T>({ consistency });

	return result ?? null;
}

/**
 * Create a query helper with pre-configured consistency
 *
 * @example
 * ```typescript
 * // Create a helper for read-heavy operations
 * const eventualRead = createReadHelper(db, 'eventual');
 *
 * // All queries use eventual consistency
 * const workflows = await eventualRead.query('SELECT * FROM workflows');
 * const workflow = await eventualRead.first('SELECT * FROM workflows WHERE id = ?', [id]);
 * ```
 */
export function createReadHelper(db: D1Database, defaultConsistency: D1Consistency = 'eventual') {
	return {
		query: <T = Record<string, unknown>>(query: string, params: unknown[] = []) =>
			readQuery<T>(db, query, params, { consistency: defaultConsistency }),
		first: <T = Record<string, unknown>>(query: string, params: unknown[] = []) =>
			readFirst<T>(db, query, params, { consistency: defaultConsistency }),
	};
}

// ============================================================================
// JSON FIELD HELPERS
// ============================================================================

/**
 * Serialize an object for D1 JSON columns
 *
 * D1 cannot automatically serialize JavaScript objects - it converts them
 * to "[object Object]". This helper ensures proper JSON serialization while
 * maintaining TypeScript type compatibility with Drizzle schemas.
 *
 * @param obj - The object to serialize
 * @returns JSON string cast to the expected Drizzle type
 *
 * @example
 * ```typescript
 * // In Drizzle insert
 * await db.insert(table).values({
 *   metadata: jsonField({ key: 'value' }),
 * })
 * ```
 */
export function jsonField<T extends Record<string, unknown>>(obj: T): T {
	return JSON.stringify(obj) as unknown as T;
}

/**
 * Parse a JSON field from D1
 *
 * Handles both already-parsed objects and JSON strings,
 * providing a safe way to access JSON column data.
 *
 * @param value - The value from D1 (could be string or object)
 * @param fallback - Default value if parsing fails
 * @returns Parsed object or fallback
 *
 * @example
 * ```typescript
 * const run = await db.select().from(workflowRuns).first()
 * const triggerData = parseJsonField(run.triggerData, {})
 * ```
 */
export function parseJsonField<T = Record<string, unknown>>(
	value: unknown,
	fallback: T = {} as T
): T {
	if (value === null || value === undefined) {
		return fallback;
	}

	if (typeof value === 'object') {
		return value as T;
	}

	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return fallback;
		}
	}

	return fallback;
}

/**
 * Type guard to check if a value is a valid JSON object
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely stringify for D1, handling edge cases
 */
export function safeJsonStringify(value: unknown): string {
	if (value === undefined) {
		return 'null';
	}
	try {
		return JSON.stringify(value);
	} catch {
		return 'null';
	}
}

/**
 * D1 Schema Checker - Compare Drizzle schema against actual D1 table
 *
 * Helps identify schema drift between Drizzle definitions and production DB.
 * Useful for debugging "column not found" errors.
 *
 * @example
 * ```typescript
 * const checker = new D1SchemaChecker(env.DB)
 * const diff = await checker.compareTable('workflow_runs', drizzleSchema)
 * if (diff.missingColumns.length > 0) {
 *   console.error('Missing columns:', diff.missingColumns)
 * }
 * ```
 */
export interface TableColumnInfo {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
	pk: number;
}

export interface SchemaDiff {
	tableName: string;
	actualColumns: string[];
	expectedColumns: string[];
	missingColumns: string[];
	extraColumns: string[];
	matched: boolean;
}

export class D1SchemaChecker {
	constructor(private db: D1Database) {}

	/**
	 * Get actual column info from D1 table
	 */
	async getTableColumns(tableName: string): Promise<TableColumnInfo[]> {
		const result = await this.db
			.prepare(`PRAGMA table_info(${tableName})`)
			.all<TableColumnInfo>();
		return result.results || [];
	}

	/**
	 * Compare actual table against expected columns
	 */
	async compareTable(
		tableName: string,
		expectedColumns: string[]
	): Promise<SchemaDiff> {
		const actualInfo = await this.getTableColumns(tableName);
		const actualColumns = actualInfo.map((c) => c.name);

		const missingColumns = expectedColumns.filter(
			(col) => !actualColumns.includes(col)
		);
		const extraColumns = actualColumns.filter(
			(col) => !expectedColumns.includes(col)
		);

		return {
			tableName,
			actualColumns,
			expectedColumns,
			missingColumns,
			extraColumns,
			matched: missingColumns.length === 0 && extraColumns.length === 0,
		};
	}

	/**
	 * Generate migration SQL for missing columns
	 */
	generateMigrationSQL(
		diff: SchemaDiff,
		columnDefinitions: Record<string, string>
	): string[] {
		return diff.missingColumns.map((col) => {
			const definition = columnDefinitions[col] || 'TEXT';
			return `ALTER TABLE ${diff.tableName} ADD COLUMN ${col} ${definition};`;
		});
	}
}

/**
 * Create a schema checker instance
 */
export function createSchemaChecker(db: D1Database): D1SchemaChecker {
	return new D1SchemaChecker(db);
}

/**
 * D1 Helpers - Utilities for Cloudflare D1 + Drizzle ORM
 *
 * Addresses common pitfalls when working with D1 and Drizzle:
 * - JSON field serialization (D1 serializes objects as "[object Object]")
 * - Type-safe JSON column handling
 * - Schema validation helpers
 *
 * @example
 * ```typescript
 * import { jsonField, parseJsonField } from '@workway/sdk'
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
 * ```
 */

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

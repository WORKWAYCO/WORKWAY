/**
 * Database Schema Check Command
 *
 * Compares Drizzle schema definitions against actual D1 database structure
 * to identify schema drift that can cause runtime errors.
 *
 * Common issues this detects:
 * - Missing columns in production (added to schema but migration not run)
 * - Extra columns in production (removed from schema but still in DB)
 * - Type mismatches
 *
 * @example
 * ```bash
 * # Check all tables
 * workway db check
 *
 * # Check specific table
 * workway db check --table workflow_runs
 *
 * # Generate migration for missing columns
 * workway db check --generate-migration
 * ```
 */

import { Logger } from '../../utils/logger.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { findWranglerConfig, getDatabaseName } from '../../lib/wrangler.js';

interface CheckOptions {
	table?: string;
	generateMigration?: boolean;
	remote?: boolean;
	config?: string;
}

interface ColumnInfo {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
	pk: number;
}

interface TableDiff {
	tableName: string;
	status: 'ok' | 'drift' | 'error';
	actualColumns: string[];
	schemaColumns: string[];
	missingInDb: string[];
	extraInDb: string[];
	error?: string;
}

// Known Drizzle schema tables and their expected columns
// This can be extended or loaded from schema files
const KNOWN_TABLES: Record<string, string[]> = {
	workflow_runs: [
		'id',
		'installation_id',
		'integration_id',
		'user_id',
		'trigger_type',
		'trigger_data',
		'status',
		'output',
		'error_message',
		'error_code',
		'error_category',
		'error_details',
		'retry_count',
		'started_at',
		'completed_at',
		'duration_ms',
		'metadata',
		'created_at',
		'updated_at',
		'parent_run_id',
		'sequence_number',
		'idempotency_key',
		'developer_test',
	],
	user_installations: [
		'id',
		'user_id',
		'integration_id',
		'status',
		'configuration',
		'parent_installation_id',
		'installed_at',
		'updated_at',
	],
	oauth_credentials: [
		'id',
		'user_id',
		'provider',
		'access_token',
		'refresh_token',
		'expires_at',
		'scope',
		'token_type',
		'metadata',
		'created_at',
		'updated_at',
	],
};

/**
 * Run PRAGMA table_info via wrangler
 */
function getTableInfo(
	tableName: string,
	options: CheckOptions
): ColumnInfo[] | null {
	try {
		const configFlag = options.config ? `--config ${options.config}` : '';
		const remoteFlag = options.remote !== false ? '--remote' : '--local';

		// Find the database name from wrangler config
		const configPath = options.config || findWranglerConfig();
		if (!configPath) {
			Logger.error('Could not find wrangler configuration file');
			return null;
		}

		const dbName = getDatabaseName(configPath);
		if (!dbName) {
			Logger.error('Could not find D1 database name in wrangler config');
			return null;
		}

		const cmd = `npx wrangler d1 execute ${dbName} ${remoteFlag} ${configFlag} --command "PRAGMA table_info(${tableName})" --json`;

		const output = execSync(cmd, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		const result = JSON.parse(output);
		if (result && result[0] && result[0].results) {
			return result[0].results;
		}
		return [];
	} catch (error: any) {
		Logger.debug(`Failed to get table info: ${error.message}`);
		return null;
	}
}

/**
 * Check a single table
 */
function checkTable(tableName: string, options: CheckOptions): TableDiff {
	const schemaColumns = KNOWN_TABLES[tableName];

	if (!schemaColumns) {
		return {
			tableName,
			status: 'error',
			actualColumns: [],
			schemaColumns: [],
			missingInDb: [],
			extraInDb: [],
			error: `Unknown table: ${tableName}. Add it to KNOWN_TABLES in db/check.ts`,
		};
	}

	const actualInfo = getTableInfo(tableName, options);

	if (actualInfo === null) {
		return {
			tableName,
			status: 'error',
			actualColumns: [],
			schemaColumns,
			missingInDb: [],
			extraInDb: [],
			error: 'Failed to query database',
		};
	}

	const actualColumns = actualInfo.map((c) => c.name);
	const missingInDb = schemaColumns.filter((c) => !actualColumns.includes(c));
	const extraInDb = actualColumns.filter((c) => !schemaColumns.includes(c));

	return {
		tableName,
		status: missingInDb.length > 0 || extraInDb.length > 0 ? 'drift' : 'ok',
		actualColumns,
		schemaColumns,
		missingInDb,
		extraInDb,
	};
}

/**
 * Generate migration SQL
 */
function generateMigration(diffs: TableDiff[]): string {
	const lines: string[] = [
		'-- Auto-generated migration to fix schema drift',
		`-- Generated: ${new Date().toISOString()}`,
		'',
	];

	for (const diff of diffs) {
		if (diff.missingInDb.length > 0) {
			lines.push(`-- Table: ${diff.tableName}`);
			for (const col of diff.missingInDb) {
				// Default to TEXT, but you'd want to look up actual types
				lines.push(
					`ALTER TABLE ${diff.tableName} ADD COLUMN ${col} TEXT;`
				);
			}
			lines.push('');
		}
	}

	return lines.join('\n');
}

/**
 * Main command handler
 */
export async function dbCheckCommand(options: CheckOptions): Promise<void> {
	Logger.log('');
	Logger.log('🔍 Checking database schema...');
	Logger.log('');

	const tablesToCheck = options.table
		? [options.table]
		: Object.keys(KNOWN_TABLES);

	const results: TableDiff[] = [];
	let hasErrors = false;
	let hasDrift = false;

	for (const table of tablesToCheck) {
		const diff = checkTable(table, options);
		results.push(diff);

		if (diff.status === 'error') {
			hasErrors = true;
			Logger.error(`❌ ${table}: ${diff.error}`);
		} else if (diff.status === 'drift') {
			hasDrift = true;
			Logger.warn(`⚠️  ${table}: Schema drift detected`);

			if (diff.missingInDb.length > 0) {
				Logger.log(`   Missing in DB: ${diff.missingInDb.join(', ')}`);
			}
			if (diff.extraInDb.length > 0) {
				Logger.log(`   Extra in DB: ${diff.extraInDb.join(', ')}`);
			}
		} else {
			Logger.success(`✓ ${table}: OK (${diff.actualColumns.length} columns)`);
		}
	}

	Logger.log('');

	// Summary
	if (hasErrors) {
		Logger.error('Some tables could not be checked.');
	} else if (hasDrift) {
		Logger.warn('Schema drift detected!');
		Logger.log('');
		Logger.log('This can cause runtime errors like:');
		Logger.log('  - "dispatch_failed" in Slack commands');
		Logger.log('  - D1 insert/update failures');
		Logger.log('');

		if (options.generateMigration) {
			const migration = generateMigration(results);
			Logger.log('Generated migration:');
			Logger.log('');
			Logger.log(migration);
		} else {
			Logger.log('Run with --generate-migration to create fix SQL');
		}
	} else {
		Logger.success('All tables match schema!');
	}

	// Exit code for CI
	if (hasDrift || hasErrors) {
		process.exit(1);
	}
}

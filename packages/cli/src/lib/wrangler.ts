/**
 * Wrangler Config Utilities
 *
 * Shared utilities for finding and parsing wrangler configuration files.
 * DRY Fix: Consolidated from db/sync-workflows.ts and db/check.ts
 */

import { existsSync, readFileSync } from 'node:fs';

/**
 * Default candidates for wrangler config file locations
 */
const DEFAULT_CANDIDATES = [
	'wrangler.jsonc',
	'wrangler.json',
	'wrangler.toml',
	'../api/wrangler.jsonc',
	'apps/api/wrangler.jsonc',
];

/**
 * Find wrangler config file
 *
 * Searches for wrangler configuration in common locations.
 *
 * @param candidates - Optional custom list of paths to check
 * @returns Path to config file, or null if not found
 *
 * @example
 * ```typescript
 * const configPath = findWranglerConfig();
 * if (configPath) {
 *   const dbName = getDatabaseName(configPath);
 * }
 * ```
 */
export function findWranglerConfig(candidates: string[] = DEFAULT_CANDIDATES): string | null {
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

/**
 * Extract database name from wrangler config
 *
 * Parses JSONC, JSON, or TOML wrangler config files to extract
 * the D1 database name.
 *
 * @param configPath - Path to wrangler config file
 * @returns Database name, or null if not found
 *
 * @example
 * ```typescript
 * const dbName = getDatabaseName('wrangler.jsonc');
 * // Returns: 'workway-db' or null
 * ```
 */
export function getDatabaseName(configPath: string): string | null {
	try {
		const content = readFileSync(configPath, 'utf-8');

		// Handle JSONC and JSON
		if (configPath.endsWith('.jsonc') || configPath.endsWith('.json')) {
			// Strip comments for parsing
			const jsonContent = content
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*/g, '');
			const config = JSON.parse(jsonContent);

			if (config.d1_databases && config.d1_databases[0]) {
				return config.d1_databases[0].database_name;
			}
		}

		// Handle TOML
		if (configPath.endsWith('.toml')) {
			const match = content.match(/database_name\s*=\s*"([^"]+)"/);
			if (match) {
				return match[1];
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get database ID from wrangler config
 *
 * @param configPath - Path to wrangler config file
 * @returns Database ID, or null if not found
 */
export function getDatabaseId(configPath: string): string | null {
	try {
		const content = readFileSync(configPath, 'utf-8');

		// Handle JSONC and JSON
		if (configPath.endsWith('.jsonc') || configPath.endsWith('.json')) {
			const jsonContent = content
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*/g, '');
			const config = JSON.parse(jsonContent);

			if (config.d1_databases && config.d1_databases[0]) {
				return config.d1_databases[0].database_id;
			}
		}

		// Handle TOML
		if (configPath.endsWith('.toml')) {
			const match = content.match(/database_id\s*=\s*"([^"]+)"/);
			if (match) {
				return match[1];
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Config Utilities
 *
 * Shared configuration directory management for the learn package.
 * DRY Fix: Consolidated from progress-cache.ts, defaults.ts, and auth.ts
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Base configuration directory (~/.workway)
 */
export const CONFIG_DIR = join(homedir(), '.workway');

/**
 * Ensure config directory exists
 *
 * Creates ~/.workway if it doesn't exist.
 * Safe to call multiple times.
 */
export function ensureConfigDir(): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

/**
 * Get path to a config file
 *
 * @param filename - Name of the config file
 * @returns Full path to the config file
 *
 * @example
 * ```typescript
 * const credentialsPath = getConfigPath('learn-credentials.json');
 * // Returns: ~/.workway/learn-credentials.json
 * ```
 */
export function getConfigPath(filename: string): string {
	return join(CONFIG_DIR, filename);
}

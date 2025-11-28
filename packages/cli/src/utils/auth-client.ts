/**
 * Authenticated API Client Utility
 *
 * DRY utility to create an authenticated API client with consistent
 * error handling for unauthenticated users.
 */

import { Logger } from './logger.js';
import { loadConfig, getAuthToken } from '../lib/config.js';
import { createAPIClient, type WorkwayAPIClient } from '../lib/api-client.js';
import type { CLIConfig } from '../types/index.js';

export interface AuthenticatedClientOptions {
	/**
	 * Custom message when not authenticated
	 * @default 'Not authenticated'
	 */
	errorMessage?: string;

	/**
	 * Custom hint for how to authenticate
	 * @default 'Run `workway login` to authenticate'
	 */
	hint?: string;

	/**
	 * Exit process on auth failure (default: true)
	 * Set to false to return null instead
	 */
	exitOnFailure?: boolean;
}

export interface AuthenticatedClientResult {
	apiClient: WorkwayAPIClient;
	token: string;
	apiUrl: string;
	config: CLIConfig;
}

/**
 * Create an authenticated API client
 *
 * Consolidates the common pattern:
 * 1. Check for auth token
 * 2. Exit with helpful message if not authenticated
 * 3. Load config
 * 4. Create and return API client
 *
 * @example
 * ```typescript
 * // Simple usage - exits if not authenticated
 * const { apiClient } = await createAuthenticatedClient();
 *
 * // Custom error message
 * const { apiClient } = await createAuthenticatedClient({
 *   errorMessage: 'You must be logged in to publish workflows',
 *   hint: 'Run: workway login'
 * });
 *
 * // Don't exit, handle null
 * const result = await createAuthenticatedClient({ exitOnFailure: false });
 * if (!result) {
 *   // Handle unauthenticated case
 * }
 * ```
 */
export async function createAuthenticatedClient(
	options: AuthenticatedClientOptions & { exitOnFailure: false }
): Promise<AuthenticatedClientResult | null>;
export async function createAuthenticatedClient(
	options?: AuthenticatedClientOptions
): Promise<AuthenticatedClientResult>;
export async function createAuthenticatedClient(
	options: AuthenticatedClientOptions = {}
): Promise<AuthenticatedClientResult | null> {
	const {
		errorMessage = 'Not authenticated',
		hint = 'Run `workway login` to authenticate',
		exitOnFailure = true,
	} = options;

	// Check for auth token
	const token = await getAuthToken();
	if (!token) {
		Logger.error(errorMessage);
		Logger.log('');
		Logger.log(`💡 ${hint}`);

		if (exitOnFailure) {
			process.exit(1);
		}
		return null;
	}

	// Load config and create client
	const config = await loadConfig();
	const apiClient = createAPIClient(config.apiUrl, token);

	return {
		apiClient,
		token,
		apiUrl: config.apiUrl,
		config,
	};
}

/**
 * Require authentication or exit
 *
 * Simpler version when you just need to verify auth exists
 * without creating a client.
 */
export async function requireAuth(options: Omit<AuthenticatedClientOptions, 'exitOnFailure'> = {}): Promise<string> {
	const { errorMessage = 'Not authenticated', hint = 'Run `workway login` to authenticate' } = options;

	const token = await getAuthToken();
	if (!token) {
		Logger.error(errorMessage);
		Logger.log('');
		Logger.log(`💡 ${hint}`);
		process.exit(1);
	}

	return token;
}

/**
 * WORKWAY MCP Configuration
 *
 * Centralized configuration for API endpoints and credentials.
 */

export interface WorkwayConfig {
	/** WORKWAY API URL */
	apiUrl: string;
	/** Cloudflare Account ID */
	accountId: string;
	/** Cloudflare API Token */
	apiToken: string;
}

let cachedConfig: WorkwayConfig | null = null;

/**
 * Load configuration from environment variables
 */
export function getConfig(): WorkwayConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_API_TOKEN;

	if (!accountId) {
		throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
	}

	cachedConfig = {
		apiUrl: process.env.WORKWAY_API_URL || 'https://api.workway.co',
		accountId,
		apiToken: apiToken || '',
	};

	return cachedConfig;
}

/**
 * Check if Cloudflare API is configured
 */
export function hasCloudflareCredentials(): boolean {
	try {
		const config = getConfig();
		return !!config.accountId && !!config.apiToken;
	} catch {
		return false;
	}
}

/**
 * Clear cached configuration (for testing)
 */
export function clearConfig(): void {
	cachedConfig = null;
}

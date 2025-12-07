/**
 * BYOO: Bring Your Own OAuth
 *
 * Enables developers to use their own OAuth app credentials for integrations,
 * isolated from WORKWAY's system credentials.
 *
 * Benefits:
 * 1. Development velocity - Test with custom scopes without waiting for WORKWAY verification
 * 2. Enterprise compliance - Corporate OAuth apps for security requirements
 * 3. Rate limit isolation - Developer's app has separate rate limits
 * 4. Production pathway - Graduate from dev credentials to marketplace
 *
 * @example
 * ```typescript
 * import { resolveCredentials, CredentialSource } from '@workwayco/sdk/byoo';
 *
 * const credentials = await resolveCredentials(env, {
 *   userId: 'user_123',
 *   provider: 'zoom',
 *   integrationId: 'int_abc',
 * });
 *
 * // Use credentials.clientId, credentials.clientSecret for OAuth flow
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Source of OAuth credentials
 */
export type CredentialSource = 'system' | 'developer';

/**
 * Credential mode for integrations
 */
export type CredentialMode = 'system' | 'developer' | 'hybrid';

/**
 * Status lifecycle for developer OAuth apps
 */
export type OAuthAppStatus =
	| 'development' // Initial state, developer testing
	| 'testing' // Self-serve promotion for broader testing
	| 'pending_review' // Submitted for WORKWAY review
	| 'production' // Approved for marketplace use
	| 'suspended' // Temporarily disabled
	| 'rejected'; // Review rejected

/**
 * Health status for developer OAuth apps
 */
export type OAuthAppHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Resolved OAuth credentials ready for use
 */
export interface OAuthCredentials {
	/** OAuth client ID */
	clientId: string;
	/** OAuth client secret (decrypted) */
	clientSecret: string;
	/** Redirect URI for OAuth callback */
	redirectUri: string;
	/** OAuth scopes to request */
	scopes: string[];
	/** Where these credentials came from */
	source: CredentialSource;
	/** Developer ID if using developer credentials */
	developerId?: string;
	/** OAuth app ID if using developer credentials */
	oauthAppId?: string;
}

/**
 * Developer OAuth app record from database
 */
export interface DeveloperOAuthApp {
	id: string;
	developerId: string;
	integrationId: string | null;
	provider: string;
	clientId: string;
	/** Encrypted client secret - must be decrypted before use */
	clientSecretEncrypted: string;
	encryptionKeyId: string;
	redirectUri: string | null;
	scopes: string[];
	webhookSecretEncrypted: string | null;
	status: OAuthAppStatus;
	healthStatus: OAuthAppHealthStatus;
	lastHealthCheckAt: string | null;
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Options for creating a developer OAuth app
 */
export interface CreateOAuthAppOptions {
	developerId: string;
	provider: string;
	clientId: string;
	clientSecret: string;
	integrationId?: string;
	redirectUri?: string;
	scopes?: string[];
	webhookSecret?: string;
}

/**
 * Options for updating a developer OAuth app
 */
export interface UpdateOAuthAppOptions {
	clientId?: string;
	clientSecret?: string;
	redirectUri?: string;
	scopes?: string[];
	webhookSecret?: string;
	status?: OAuthAppStatus;
}

/**
 * Options for credential resolution
 */
export interface CredentialResolverOptions {
	/** User ID making the OAuth request */
	userId: string;
	/** OAuth provider (zoom, notion, slack, etc.) */
	provider: string;
	/** Integration ID if workflow-specific */
	integrationId?: string;
	/** Installation ID if user-specific */
	installationId?: string;
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
	/** Provider identifier */
	id: string;
	/** Display name */
	name: string;
	/** Authorization endpoint */
	authorizationUrl: string;
	/** Token endpoint */
	tokenUrl: string;
	/** Default redirect URI */
	redirectUri: string;
	/** Default scopes */
	scopes: string[];
	/** Whether provider supports PKCE */
	supportsPKCE: boolean;
	/** Token endpoint auth method */
	tokenAuthMethod: 'client_secret_post' | 'client_secret_basic';
	/** Documentation URL for creating OAuth app */
	developerDocsUrl: string;
}

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

/**
 * OAuth provider configurations for BYOO
 */
export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
	zoom: {
		id: 'zoom',
		name: 'Zoom',
		authorizationUrl: 'https://zoom.us/oauth/authorize',
		tokenUrl: 'https://zoom.us/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/zoom/callback',
		scopes: ['meeting:read', 'recording:read', 'user:read'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_basic',
		developerDocsUrl: 'https://developers.zoom.us/docs/integrations/create/',
	},
	notion: {
		id: 'notion',
		name: 'Notion',
		authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
		tokenUrl: 'https://api.notion.com/v1/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/notion/callback',
		scopes: [], // Notion uses capability-based permissions
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_basic',
		developerDocsUrl: 'https://developers.notion.com/docs/authorization',
	},
	slack: {
		id: 'slack',
		name: 'Slack',
		authorizationUrl: 'https://slack.com/oauth/v2/authorize',
		tokenUrl: 'https://slack.com/api/oauth.v2.access',
		redirectUri: 'https://api.workway.co/oauth/slack/callback',
		scopes: ['chat:write', 'channels:read', 'users:read'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://api.slack.com/authentication/oauth-v2',
	},
	hubspot: {
		id: 'hubspot',
		name: 'HubSpot',
		authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
		tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
		redirectUri: 'https://api.workway.co/oauth/hubspot/callback',
		scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developers.hubspot.com/docs/api/oauth-quickstart-guide',
	},
	calendly: {
		id: 'calendly',
		name: 'Calendly',
		authorizationUrl: 'https://auth.calendly.com/oauth/authorize',
		tokenUrl: 'https://auth.calendly.com/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/calendly/callback',
		scopes: ['default'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-getting-started',
	},
	typeform: {
		id: 'typeform',
		name: 'Typeform',
		authorizationUrl: 'https://api.typeform.com/oauth/authorize',
		tokenUrl: 'https://api.typeform.com/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/typeform/callback',
		scopes: ['forms:read', 'responses:read', 'webhooks:write'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developer.typeform.com/get-started/applications/',
	},
	todoist: {
		id: 'todoist',
		name: 'Todoist',
		authorizationUrl: 'https://todoist.com/oauth/authorize',
		tokenUrl: 'https://todoist.com/oauth/access_token',
		redirectUri: 'https://api.workway.co/oauth/todoist/callback',
		scopes: ['data:read_write'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developer.todoist.com/guides/#authorization',
	},
	airtable: {
		id: 'airtable',
		name: 'Airtable',
		authorizationUrl: 'https://airtable.com/oauth2/v1/authorize',
		tokenUrl: 'https://airtable.com/oauth2/v1/token',
		redirectUri: 'https://api.workway.co/oauth/airtable/callback',
		scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'],
		supportsPKCE: true,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://airtable.com/developers/web/guides/oauth-integrations',
	},
	linear: {
		id: 'linear',
		name: 'Linear',
		authorizationUrl: 'https://linear.app/oauth/authorize',
		tokenUrl: 'https://api.linear.app/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/linear/callback',
		scopes: ['read', 'write', 'issues:create'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developers.linear.app/docs/oauth/authentication',
	},
	stripe: {
		id: 'stripe',
		name: 'Stripe',
		authorizationUrl: 'https://connect.stripe.com/oauth/authorize',
		tokenUrl: 'https://connect.stripe.com/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/stripe/callback',
		scopes: ['read_write'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://stripe.com/docs/connect/oauth-reference',
	},
	'google-sheets': {
		id: 'google-sheets',
		name: 'Google Sheets',
		authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		redirectUri: 'https://api.workway.co/oauth/google/callback',
		scopes: [
			'https://www.googleapis.com/auth/spreadsheets',
			'https://www.googleapis.com/auth/drive.readonly',
		],
		supportsPKCE: true,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developers.google.com/identity/protocols/oauth2',
	},
	dribbble: {
		id: 'dribbble',
		name: 'Dribbble',
		authorizationUrl: 'https://dribbble.com/oauth/authorize',
		tokenUrl: 'https://dribbble.com/oauth/token',
		redirectUri: 'https://api.workway.co/oauth/dribbble/callback',
		scopes: ['public', 'upload'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developer.dribbble.com/v2/oauth/',
	},
	discord: {
		id: 'discord',
		name: 'Discord',
		authorizationUrl: 'https://discord.com/api/oauth2/authorize',
		tokenUrl: 'https://discord.com/api/oauth2/token',
		redirectUri: 'https://api.workway.co/oauth/discord/callback',
		scopes: ['bot', 'guilds', 'messages.read'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://discord.com/developers/applications',
	},
	github: {
		id: 'github',
		name: 'GitHub',
		authorizationUrl: 'https://github.com/login/oauth/authorize',
		tokenUrl: 'https://github.com/login/oauth/access_token',
		redirectUri: 'https://api.workway.co/oauth/github/callback',
		scopes: ['repo', 'read:user', 'read:org'],
		supportsPKCE: false,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://github.com/settings/developers',
	},
	'google-calendar': {
		id: 'google-calendar',
		name: 'Google Calendar',
		authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		redirectUri: 'https://api.workway.co/oauth/google/callback',
		scopes: [
			'https://www.googleapis.com/auth/calendar.readonly',
			'https://www.googleapis.com/auth/calendar.events',
		],
		supportsPKCE: true,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developers.google.com/identity/protocols/oauth2',
	},
	'google-drive': {
		id: 'google-drive',
		name: 'Google Drive',
		authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		redirectUri: 'https://api.workway.co/oauth/google/callback',
		scopes: [
			'https://www.googleapis.com/auth/drive.readonly',
			'https://www.googleapis.com/auth/drive.file',
		],
		supportsPKCE: true,
		tokenAuthMethod: 'client_secret_post',
		developerDocsUrl: 'https://developers.google.com/identity/protocols/oauth2',
	},
};

// ============================================================================
// CREDENTIAL RESOLUTION
// ============================================================================

/**
 * Error thrown when credentials cannot be resolved
 */
export class CredentialError extends Error {
	constructor(
		public readonly code:
			| 'DEVELOPER_CREDENTIALS_REQUIRED'
			| 'UNKNOWN_PROVIDER'
			| 'CREDENTIALS_EXPIRED'
			| 'CREDENTIALS_SUSPENDED',
		public readonly provider: string
	) {
		super(`Credential error [${code}]: ${provider}`);
		this.name = 'CredentialError';
	}
}

/**
 * Build token storage key with credential source metadata
 */
export function buildTokenKey(
	userId: string,
	provider: string,
	source: CredentialSource,
	developerId?: string
): string {
	if (source === 'developer' && developerId) {
		return `tokens:${userId}:${provider}:developer:${developerId}`;
	}
	return `tokens:${userId}:${provider}:system`;
}

/**
 * Parse token key to extract metadata
 */
export function parseTokenKey(key: string): {
	userId: string;
	provider: string;
	source: CredentialSource;
	developerId?: string;
} | null {
	const parts = key.split(':');
	if (parts.length < 4 || parts[0] !== 'tokens') {
		return null;
	}

	const [, userId, provider, source, developerId] = parts;

	return {
		userId,
		provider,
		source: source as CredentialSource,
		developerId: source === 'developer' ? developerId : undefined,
	};
}

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: string): OAuthProviderConfig | null {
	return OAUTH_PROVIDERS[provider] || null;
}

/**
 * Get all supported providers
 */
export function getSupportedProviders(): OAuthProviderConfig[] {
	return Object.values(OAUTH_PROVIDERS);
}

/**
 * Check if a provider supports BYOO
 */
export function providerSupportsByoo(provider: string): boolean {
	return provider in OAUTH_PROVIDERS;
}

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

/**
 * SQL schema for developer_oauth_apps table
 */
export const DEVELOPER_OAUTH_APPS_SCHEMA = `
CREATE TABLE IF NOT EXISTS developer_oauth_apps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Ownership
  developer_id TEXT NOT NULL,
  integration_id TEXT,

  -- Provider configuration
  provider TEXT NOT NULL,

  -- Credentials (encrypted at rest)
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,

  -- OAuth app configuration
  redirect_uri TEXT,
  scopes TEXT,
  webhook_secret_encrypted TEXT,

  -- Status & lifecycle
  status TEXT NOT NULL DEFAULT 'development'
    CHECK (status IN ('development', 'testing', 'pending_review', 'production', 'suspended', 'rejected')),

  -- Health monitoring
  last_health_check_at TEXT,
  health_status TEXT DEFAULT 'unknown'
    CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  last_error TEXT,

  -- Audit
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Constraints
  UNIQUE(developer_id, provider, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_developer_oauth_apps_developer ON developer_oauth_apps(developer_id);
CREATE INDEX IF NOT EXISTS idx_developer_oauth_apps_provider ON developer_oauth_apps(provider);
CREATE INDEX IF NOT EXISTS idx_developer_oauth_apps_status ON developer_oauth_apps(status);
`;

/**
 * SQL to add credential_mode to marketplace_integrations
 */
export const MARKETPLACE_INTEGRATIONS_CREDENTIAL_MODE = `
ALTER TABLE marketplace_integrations ADD COLUMN
  credential_mode TEXT DEFAULT 'system'
  CHECK (credential_mode IN ('system', 'developer', 'hybrid'));
`;

/**
 * SQL to add credential_source to user_installations
 */
export const USER_INSTALLATIONS_CREDENTIAL_SOURCE = `
ALTER TABLE user_installations ADD COLUMN
  credential_source TEXT DEFAULT 'system'
  CHECK (credential_source IN ('system', 'developer'));
`;

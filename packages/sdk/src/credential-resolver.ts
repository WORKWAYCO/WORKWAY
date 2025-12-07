/**
 * Credential Resolver Service for BYOO
 *
 * Resolves OAuth credentials based on context, supporting both
 * system credentials (WORKWAY's OAuth apps) and developer credentials (BYOO).
 *
 * Resolution Priority:
 * 1. Installation-specific credential source (if specified)
 * 2. Integration's credential mode (developer, hybrid, system)
 * 3. Default to system credentials
 *
 * Zuhandenheit: This service is invisible during normal operation.
 * It only becomes visible (Vorhandenheit) when credentials are missing or invalid.
 *
 * @example
 * ```typescript
 * import { CredentialResolver } from '@workwayco/sdk/credential-resolver';
 *
 * const resolver = new CredentialResolver(env);
 * const credentials = await resolver.resolve({
 *   userId: 'user_123',
 *   provider: 'zoom',
 *   integrationId: 'int_abc',
 * });
 *
 * // Use credentials for OAuth flow
 * const authUrl = buildAuthUrl({
 *   clientId: credentials.clientId,
 *   redirectUri: credentials.redirectUri,
 *   scopes: credentials.scopes,
 * });
 * ```
 */

import type {
	OAuthCredentials,
	CredentialResolverOptions,
	CredentialSource,
	CredentialMode,
	OAuthProviderConfig,
	DeveloperOAuthApp,
} from './byoo.js';
import { CredentialError, getProviderConfig } from './byoo.js';
import { decryptSecret, getKeyById, type KeyManagementConfig } from './encryption.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Environment bindings required for credential resolution
 */
export interface CredentialResolverEnv {
	/** D1 database binding */
	DB: D1Database;
	/** KV namespace for encryption keys */
	SECRETS_KV: KVNamespace;
	/** System OAuth credentials (environment variables) */
	[key: string]: unknown;
}

/**
 * Database row for installation
 */
interface InstallationRow {
	id: string;
	integration_id: string;
	credential_source: CredentialSource;
}

/**
 * Database row for integration
 */
interface IntegrationRow {
	id: string;
	credential_mode: CredentialMode;
}

/**
 * Database row for developer OAuth app
 */
interface DeveloperOAuthAppRow {
	id: string;
	developer_id: string;
	client_id: string;
	client_secret_encrypted: string;
	encryption_key_id: string;
	redirect_uri: string | null;
	scopes: string | null;
	status: string;
}

// ============================================================================
// CREDENTIAL RESOLVER CLASS
// ============================================================================

/**
 * Resolves OAuth credentials based on context
 */
export class CredentialResolver {
	private readonly env: CredentialResolverEnv;
	private readonly keyConfig: KeyManagementConfig;

	constructor(env: CredentialResolverEnv) {
		this.env = env;
		this.keyConfig = {
			kv: env.SECRETS_KV,
			prefix: 'encryption',
		};
	}

	/**
	 * Resolve OAuth credentials for a given context
	 *
	 * @throws CredentialError if credentials cannot be resolved
	 */
	async resolve(options: CredentialResolverOptions): Promise<OAuthCredentials> {
		const { provider, integrationId, installationId } = options;

		// Validate provider
		const providerConfig = getProviderConfig(provider);
		if (!providerConfig) {
			throw new CredentialError('UNKNOWN_PROVIDER', provider);
		}

		// 1. Check if installation specifies credential source
		if (installationId) {
			const installation = await this.getInstallation(installationId);
			if (installation?.credential_source === 'developer') {
				const devCreds = await this.getDeveloperCredentials(
					installation.integration_id,
					provider
				);
				if (devCreds) {
					return devCreds;
				}
			}
		}

		// 2. Check integration's credential mode
		if (integrationId) {
			const integration = await this.getIntegration(integrationId);

			if (integration?.credential_mode === 'developer') {
				const devCreds = await this.getDeveloperCredentials(integrationId, provider);
				if (devCreds) {
					return devCreds;
				}
				// Fail hard if developer mode but no credentials
				throw new CredentialError('DEVELOPER_CREDENTIALS_REQUIRED', provider);
			}

			if (integration?.credential_mode === 'hybrid') {
				const devCreds = await this.getDeveloperCredentials(integrationId, provider);
				if (devCreds) {
					return devCreds;
				}
				// Fall through to system credentials
			}
		}

		// 3. Use system credentials (default)
		return this.getSystemCredentials(provider, providerConfig);
	}

	/**
	 * Get installation by ID
	 */
	private async getInstallation(installationId: string): Promise<InstallationRow | null> {
		const result = await this.env.DB.prepare(
			`
			SELECT id, integration_id, credential_source
			FROM user_installations
			WHERE id = ?
		`
		)
			.bind(installationId)
			.first<InstallationRow>();

		return result || null;
	}

	/**
	 * Get integration by ID
	 */
	private async getIntegration(integrationId: string): Promise<IntegrationRow | null> {
		const result = await this.env.DB.prepare(
			`
			SELECT id, credential_mode
			FROM marketplace_integrations
			WHERE id = ?
		`
		)
			.bind(integrationId)
			.first<IntegrationRow>();

		return result || null;
	}

	/**
	 * Get developer credentials for an integration
	 */
	private async getDeveloperCredentials(
		integrationId: string,
		provider: string
	): Promise<OAuthCredentials | null> {
		const result = await this.env.DB.prepare(
			`
			SELECT
				doa.id,
				doa.developer_id,
				doa.client_id,
				doa.client_secret_encrypted,
				doa.encryption_key_id,
				doa.redirect_uri,
				doa.scopes,
				doa.status
			FROM developer_oauth_apps doa
			WHERE doa.integration_id = ?
				AND doa.provider = ?
				AND doa.status IN ('development', 'testing', 'production')
		`
		)
			.bind(integrationId, provider)
			.first<DeveloperOAuthAppRow>();

		if (!result) {
			return null;
		}

		// Check if suspended
		if (result.status === 'suspended') {
			throw new CredentialError('CREDENTIALS_SUSPENDED', provider);
		}

		// Get encryption key
		const keyHex = await getKeyById(this.keyConfig, result.encryption_key_id);
		if (!keyHex) {
			throw new Error(`Encryption key ${result.encryption_key_id} not found`);
		}

		// Decrypt client secret
		const clientSecret = await decryptSecret(result.client_secret_encrypted, keyHex);

		// Get provider config for defaults
		const providerConfig = getProviderConfig(provider)!;

		return {
			clientId: result.client_id,
			clientSecret,
			redirectUri: result.redirect_uri || providerConfig.redirectUri,
			scopes: result.scopes ? JSON.parse(result.scopes) : providerConfig.scopes,
			source: 'developer',
			developerId: result.developer_id,
			oauthAppId: result.id,
		};
	}

	/**
	 * Get system credentials from environment
	 */
	private getSystemCredentials(
		provider: string,
		config: OAuthProviderConfig
	): OAuthCredentials {
		const envPrefix = provider.toUpperCase().replace(/-/g, '_');

		const clientId = this.env[`${envPrefix}_CLIENT_ID`] as string | undefined;
		const clientSecret = this.env[`${envPrefix}_CLIENT_SECRET`] as string | undefined;

		if (!clientId || !clientSecret) {
			throw new CredentialError('UNKNOWN_PROVIDER', provider);
		}

		return {
			clientId,
			clientSecret,
			redirectUri: config.redirectUri,
			scopes: config.scopes,
			source: 'system',
		};
	}
}

// ============================================================================
// DEVELOPER OAUTH APP MANAGEMENT
// ============================================================================

/**
 * CRUD operations for developer OAuth apps
 */
export class DeveloperOAuthAppManager {
	private readonly env: CredentialResolverEnv;
	private readonly keyConfig: KeyManagementConfig;

	constructor(env: CredentialResolverEnv) {
		this.env = env;
		this.keyConfig = {
			kv: env.SECRETS_KV,
			prefix: 'encryption',
		};
	}

	/**
	 * Create a new developer OAuth app
	 */
	async create(options: {
		developerId: string;
		provider: string;
		clientId: string;
		clientSecret: string;
		integrationId?: string;
		redirectUri?: string;
		scopes?: string[];
	}): Promise<DeveloperOAuthApp> {
		const { developerId, provider, clientId, clientSecret, integrationId, redirectUri, scopes } =
			options;

		// Get current encryption key
		const { encryptSecret, getCurrentKeyId } = await import('./encryption.js');
		const keyId = await getCurrentKeyId(this.keyConfig);
		if (!keyId) {
			throw new Error('Encryption not initialized');
		}

		const keyHex = await getKeyById(this.keyConfig, keyId);
		if (!keyHex) {
			throw new Error('Encryption key not found');
		}

		// Encrypt the client secret
		const encrypted = await encryptSecret(clientSecret, keyHex, keyId);

		// Generate ID
		const id = crypto.randomUUID().replace(/-/g, '').substring(0, 32);

		// Insert into database
		await this.env.DB.prepare(
			`
			INSERT INTO developer_oauth_apps (
				id, developer_id, integration_id, provider,
				client_id, client_secret_encrypted, encryption_key_id,
				redirect_uri, scopes, status, health_status
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'development', 'unknown')
		`
		)
			.bind(
				id,
				developerId,
				integrationId || null,
				provider,
				clientId,
				encrypted.payload,
				encrypted.keyId,
				redirectUri || null,
				scopes ? JSON.stringify(scopes) : null
			)
			.run();

		return this.get(id) as Promise<DeveloperOAuthApp>;
	}

	/**
	 * Get a developer OAuth app by ID
	 */
	async get(id: string): Promise<DeveloperOAuthApp | null> {
		const result = await this.env.DB.prepare(
			`
			SELECT * FROM developer_oauth_apps WHERE id = ?
		`
		)
			.bind(id)
			.first<Record<string, unknown>>();

		if (!result) {
			return null;
		}

		return this.mapToApp(result);
	}

	/**
	 * List developer OAuth apps by developer
	 */
	async listByDeveloper(developerId: string): Promise<DeveloperOAuthApp[]> {
		const results = await this.env.DB.prepare(
			`
			SELECT * FROM developer_oauth_apps
			WHERE developer_id = ?
			ORDER BY created_at DESC
		`
		)
			.bind(developerId)
			.all<Record<string, unknown>>();

		return results.results.map((row) => this.mapToApp(row));
	}

	/**
	 * Update a developer OAuth app
	 */
	async update(
		id: string,
		updates: {
			clientId?: string;
			clientSecret?: string;
			redirectUri?: string;
			scopes?: string[];
			status?: string;
		}
	): Promise<DeveloperOAuthApp | null> {
		const current = await this.get(id);
		if (!current) {
			return null;
		}

		const setClauses: string[] = [];
		const values: unknown[] = [];

		if (updates.clientId !== undefined) {
			setClauses.push('client_id = ?');
			values.push(updates.clientId);
		}

		if (updates.clientSecret !== undefined) {
			// Re-encrypt the new secret
			const { encryptSecret, getCurrentKeyId } = await import('./encryption.js');
			const keyId = await getCurrentKeyId(this.keyConfig);
			const keyHex = await getKeyById(this.keyConfig, keyId!);
			const encrypted = await encryptSecret(updates.clientSecret, keyHex!, keyId!);

			setClauses.push('client_secret_encrypted = ?', 'encryption_key_id = ?');
			values.push(encrypted.payload, encrypted.keyId);
		}

		if (updates.redirectUri !== undefined) {
			setClauses.push('redirect_uri = ?');
			values.push(updates.redirectUri);
		}

		if (updates.scopes !== undefined) {
			setClauses.push('scopes = ?');
			values.push(JSON.stringify(updates.scopes));
		}

		if (updates.status !== undefined) {
			setClauses.push('status = ?');
			values.push(updates.status);
		}

		if (setClauses.length === 0) {
			return current;
		}

		setClauses.push("updated_at = datetime('now')");
		values.push(id);

		await this.env.DB.prepare(
			`UPDATE developer_oauth_apps SET ${setClauses.join(', ')} WHERE id = ?`
		)
			.bind(...values)
			.run();

		return this.get(id);
	}

	/**
	 * Delete a developer OAuth app
	 */
	async delete(id: string): Promise<boolean> {
		const result = await this.env.DB.prepare(`DELETE FROM developer_oauth_apps WHERE id = ?`)
			.bind(id)
			.run();

		return result.meta.changes > 0;
	}

	/**
	 * Update health status
	 */
	async updateHealth(
		id: string,
		status: 'healthy' | 'degraded' | 'unhealthy',
		error?: string
	): Promise<void> {
		await this.env.DB.prepare(
			`
			UPDATE developer_oauth_apps
			SET health_status = ?,
					last_health_check_at = datetime('now'),
					last_error = ?,
					updated_at = datetime('now')
			WHERE id = ?
		`
		)
			.bind(status, error || null, id)
			.run();
	}

	/**
	 * Map database row to DeveloperOAuthApp
	 */
	private mapToApp(row: Record<string, unknown>): DeveloperOAuthApp {
		return {
			id: row.id as string,
			developerId: row.developer_id as string,
			integrationId: row.integration_id as string | null,
			provider: row.provider as string,
			clientId: row.client_id as string,
			clientSecretEncrypted: row.client_secret_encrypted as string,
			encryptionKeyId: row.encryption_key_id as string,
			redirectUri: row.redirect_uri as string | null,
			scopes: row.scopes ? JSON.parse(row.scopes as string) : [],
			webhookSecretEncrypted: row.webhook_secret_encrypted as string | null,
			status: row.status as DeveloperOAuthApp['status'],
			healthStatus: row.health_status as DeveloperOAuthApp['healthStatus'],
			lastHealthCheckAt: row.last_health_check_at as string | null,
			lastError: row.last_error as string | null,
			createdAt: row.created_at as string,
			updatedAt: row.updated_at as string,
		};
	}
}

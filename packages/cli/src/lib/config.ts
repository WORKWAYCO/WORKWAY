/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Configuration management for WORKWAY CLI
 *
 * Manages global config (~/.workway/config.json) and project config (workway.config.ts)
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import type { CLIConfig, ProjectConfig, DeveloperWaitlistProfile } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.workway');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const OAUTH_TOKENS_FILE = path.join(CONFIG_DIR, 'oauth-tokens.json');
const DEVELOPER_PROFILE_FILE = path.join(CONFIG_DIR, 'developer-profile.json');
const ENCRYPTION_KEY_FILE = path.join(CONFIG_DIR, '.key');

// SECURITY: Whitelist of allowed API URLs to prevent MITM attacks
const ALLOWED_API_DOMAINS = [
	'marketplace-api.half-dozen.workers.dev',
	'api.workway.co',
	'localhost',
	'127.0.0.1',
];

/**
 * Validate API URL against whitelist
 * SECURITY: Prevents environment variable injection attacks
 */
function validateApiUrl(url: string): string {
	try {
		const parsed = new URL(url);

		// Must be HTTPS in production (allow HTTP for localhost dev)
		const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
		if (!isLocalhost && parsed.protocol !== 'https:') {
			console.warn('Warning: API URL must use HTTPS. Falling back to default.');
			return 'https://marketplace-api.half-dozen.workers.dev';
		}

		// Check domain whitelist
		if (!ALLOWED_API_DOMAINS.includes(parsed.hostname)) {
			console.warn(`Warning: API domain "${parsed.hostname}" not in whitelist. Falling back to default.`);
			return 'https://marketplace-api.half-dozen.workers.dev';
		}

		return url;
	} catch {
		console.warn('Warning: Invalid API URL. Falling back to default.');
		return 'https://marketplace-api.half-dozen.workers.dev';
	}
}

// ============================================================================
// GLOBAL CONFIG
// ============================================================================

/**
 * Get global config directory
 */
export function getConfigDir(): string {
	return CONFIG_DIR;
}

/**
 * Ensure config directory exists
 */
export async function ensureConfigDir(): Promise<void> {
	await fs.ensureDir(CONFIG_DIR);
}

/**
 * Load global config
 */
export async function loadConfig(): Promise<CLIConfig> {
	await ensureConfigDir();

	if (!(await fs.pathExists(CONFIG_FILE))) {
		return getDefaultConfig();
	}

	try {
		return await fs.readJson(CONFIG_FILE);
	} catch (error) {
		console.warn('Warning: Could not load config, using defaults');
		return getDefaultConfig();
	}
}

/**
 * Save global config
 */
export async function saveConfig(config: CLIConfig): Promise<void> {
	await ensureConfigDir();
	await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

/**
 * Get default config
 */
export function getDefaultConfig(): CLIConfig {
	// SECURITY: Validate API URL from environment variable
	const apiUrl = process.env.WORKWAY_API_URL
		? validateApiUrl(process.env.WORKWAY_API_URL)
		: 'https://marketplace-api.half-dozen.workers.dev';

	return {
		apiUrl,
		oauth: {
			callbackPort: 3456,
		},
		editor: process.env.EDITOR || 'code',
	};
}

/**
 * Update config
 */
export async function updateConfig(updates: Partial<CLIConfig>): Promise<void> {
	const config = await loadConfig();
	await saveConfig({ ...config, ...updates });
}

/**
 * Clear config (logout)
 */
export async function clearConfig(): Promise<void> {
	await saveConfig(getDefaultConfig());
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
	const config = await loadConfig();
	return !!config.credentials?.token;
}

/**
 * Get auth token
 */
export async function getAuthToken(): Promise<string | null> {
	const config = await loadConfig();
	return config.credentials?.token || null;
}

// ============================================================================
// OAUTH TOKENS (with encryption)
// ============================================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get or create encryption key for token storage
 * SECURITY: Key is stored separately and with restricted permissions
 */
async function getOrCreateEncryptionKey(): Promise<Buffer> {
	await ensureConfigDir();

	if (await fs.pathExists(ENCRYPTION_KEY_FILE)) {
		const keyHex = await fs.readFile(ENCRYPTION_KEY_FILE, 'utf-8');
		return Buffer.from(keyHex.trim(), 'hex');
	}

	// Generate new key
	const key = crypto.randomBytes(32);
	await fs.writeFile(ENCRYPTION_KEY_FILE, key.toString('hex'), { mode: 0o600 });

	return key;
}

/**
 * Encrypt data for storage
 */
function encryptData(data: string, key: Buffer): string {
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

	let encrypted = cipher.update(data, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Format: iv:authTag:encryptedData
	return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data from storage
 */
function decryptData(encryptedData: string, key: Buffer): string {
	const parts = encryptedData.split(':');
	if (parts.length !== 3) {
		throw new Error('Invalid encrypted data format');
	}

	const [ivHex, authTagHex, encrypted] = parts;
	const iv = Buffer.from(ivHex, 'hex');
	const authTag = Buffer.from(authTagHex, 'hex');

	const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(encrypted, 'hex', 'utf8');
	decrypted += decipher.final('utf8');

	return decrypted;
}

/**
 * Load OAuth tokens (decrypts from disk)
 */
export async function loadOAuthTokens(): Promise<Record<string, any>> {
	await ensureConfigDir();

	if (!(await fs.pathExists(OAUTH_TOKENS_FILE))) {
		return {};
	}

	try {
		const fileContent = await fs.readFile(OAUTH_TOKENS_FILE, 'utf-8');

		// Check if it's encrypted (contains colons for iv:authTag:data format)
		if (fileContent.includes(':') && !fileContent.startsWith('{')) {
			const key = await getOrCreateEncryptionKey();
			const decrypted = decryptData(fileContent.trim(), key);
			return JSON.parse(decrypted);
		}

		// Legacy: unencrypted JSON (migrate on next save)
		return JSON.parse(fileContent);
	} catch (error) {
		console.warn('Warning: Could not load OAuth tokens');
		return {};
	}
}

/**
 * Save OAuth tokens (encrypts to disk)
 * SECURITY: Tokens are encrypted at rest with AES-256-GCM
 */
export async function saveOAuthTokens(tokens: Record<string, any>): Promise<void> {
	await ensureConfigDir();

	const key = await getOrCreateEncryptionKey();
	const encrypted = encryptData(JSON.stringify(tokens), key);

	// Write encrypted data with restricted permissions (owner read/write only)
	await fs.writeFile(OAUTH_TOKENS_FILE, encrypted, { mode: 0o600 });
}

/**
 * Get OAuth token for provider
 */
export async function getOAuthToken(provider: string): Promise<any | null> {
	const tokens = await loadOAuthTokens();
	return tokens[provider] || null;
}

/**
 * Set OAuth token for provider
 */
export async function setOAuthToken(provider: string, token: any): Promise<void> {
	const tokens = await loadOAuthTokens();
	tokens[provider] = token;
	await saveOAuthTokens(tokens);
}

/**
 * Remove OAuth token for provider
 */
export async function removeOAuthToken(provider: string): Promise<void> {
	const tokens = await loadOAuthTokens();
	delete tokens[provider];
	await saveOAuthTokens(tokens);
}

// ============================================================================
// PROJECT CONFIG
// ============================================================================

/**
 * Find project config file
 */
export async function findProjectConfig(cwd: string = process.cwd()): Promise<string | null> {
	const configFiles = ['workway.config.ts', 'workway.config.js', 'workway.config.json'];

	for (const file of configFiles) {
		const configPath = path.join(cwd, file);
		if (await fs.pathExists(configPath)) {
			return configPath;
		}
	}

	return null;
}

/**
 * Load project config
 */
export async function loadProjectConfig(cwd: string = process.cwd()): Promise<ProjectConfig | null> {
	const configPath = await findProjectConfig(cwd);

	if (!configPath) {
		return null;
	}

	try {
		if (configPath.endsWith('.json')) {
			return await fs.readJson(configPath);
		} else {
			// For .ts/.js files, we would need to use dynamic import
			// For now, return null and we can implement this later
			return null;
		}
	} catch (error) {
		console.warn(`Warning: Could not load project config from ${configPath}`);
		return null;
	}
}

/**
 * Save project config
 */
export async function saveProjectConfig(config: ProjectConfig, cwd: string = process.cwd()): Promise<void> {
	const configPath = path.join(cwd, 'workway.config.json');
	await fs.writeJson(configPath, config, { spaces: 2 });
}

/**
 * Get default project config
 */
export function getDefaultProjectConfig(): ProjectConfig {
	return {
		dev: {
			port: 3000,
			hotReload: true,
			mockMode: true,
		},
		test: {
			testDataFile: './test-data.json',
			timeout: 30000,
		},
		build: {
			outDir: './dist',
			minify: false,
		},
	};
}

// ============================================================================
// DEVELOPER WAITLIST PROFILE
// ============================================================================

/**
 * Load developer waitlist profile (stored locally)
 */
export async function loadDeveloperProfile(): Promise<DeveloperWaitlistProfile | null> {
	await ensureConfigDir();

	if (!(await fs.pathExists(DEVELOPER_PROFILE_FILE))) {
		return null;
	}

	try {
		return await fs.readJson(DEVELOPER_PROFILE_FILE);
	} catch (error) {
		return null;
	}
}

/**
 * Save developer waitlist profile
 */
export async function saveDeveloperProfile(profile: DeveloperWaitlistProfile): Promise<void> {
	await ensureConfigDir();
	await fs.writeJson(DEVELOPER_PROFILE_FILE, profile, { spaces: 2 });
}

/**
 * Check if developer profile exists
 */
export async function hasDeveloperProfile(): Promise<boolean> {
	return fs.pathExists(DEVELOPER_PROFILE_FILE);
}

/**
 * Delete developer profile
 */
export async function deleteDeveloperProfile(): Promise<void> {
	if (await fs.pathExists(DEVELOPER_PROFILE_FILE)) {
		await fs.remove(DEVELOPER_PROFILE_FILE);
	}
}

/**
 * Get developer profile file path (for display purposes)
 */
export function getDeveloperProfilePath(): string {
	return DEVELOPER_PROFILE_FILE;
}

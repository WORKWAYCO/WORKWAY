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
import type { CLIConfig, ProjectConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.workway');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const OAUTH_TOKENS_FILE = path.join(CONFIG_DIR, 'oauth-tokens.json');

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
	return {
		apiUrl: process.env.WORKWAY_API_URL || 'https://marketplace-api.half-dozen.workers.dev',
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
// OAUTH TOKENS
// ============================================================================

/**
 * Load OAuth tokens
 */
export async function loadOAuthTokens(): Promise<Record<string, any>> {
	await ensureConfigDir();

	if (!(await fs.pathExists(OAUTH_TOKENS_FILE))) {
		return {};
	}

	try {
		return await fs.readJson(OAUTH_TOKENS_FILE);
	} catch (error) {
		return {};
	}
}

/**
 * Save OAuth tokens
 */
export async function saveOAuthTokens(tokens: Record<string, any>): Promise<void> {
	await ensureConfigDir();
	await fs.writeJson(OAUTH_TOKENS_FILE, tokens, { spaces: 2 });
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

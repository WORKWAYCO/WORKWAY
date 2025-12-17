/**
 * Identity Worker Authentication
 *
 * Handles authentication with the Identity Worker at id.createsomething.space
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Credentials, User, AuthResult } from '../types/index.js';

const IDENTITY_WORKER = 'https://id.createsomething.space';
const CONFIG_DIR = join(homedir(), '.workway');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'learn-credentials.json');

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

/**
 * Load credentials from disk
 */
export function loadCredentials(): Credentials | null {
	if (!existsSync(CREDENTIALS_FILE)) {
		return null;
	}

	try {
		const content = readFileSync(CREDENTIALS_FILE, 'utf-8');
		const credentials = JSON.parse(content) as Credentials;

		// Check if expired
		if (new Date(credentials.expiresAt) < new Date()) {
			return null;
		}

		return credentials;
	} catch {
		return null;
	}
}

/**
 * Save credentials to disk
 */
export function saveCredentials(credentials: Credentials): void {
	ensureConfigDir();
	writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
}

/**
 * Clear credentials from disk
 */
export function clearCredentials(): void {
	if (existsSync(CREDENTIALS_FILE)) {
		unlinkSync(CREDENTIALS_FILE);
	}
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
	const credentials = loadCredentials();
	return credentials !== null;
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
	const credentials = loadCredentials();
	return credentials?.user ?? null;
}

/**
 * Request magic link for authentication
 */
export async function requestMagicLink(email: string): Promise<{ success: boolean; message: string }> {
	try {
		const response = await fetch(`${IDENTITY_WORKER}/v1/auth/magic-link`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email })
		});

		if (!response.ok) {
			const error = (await response.json().catch(() => ({ message: 'Request failed' }))) as {
				message?: string;
			};
			return { success: false, message: error.message || 'Failed to send magic link' };
		}

		return { success: true, message: 'Magic link sent! Check your email.' };
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Network error'
		};
	}
}

/**
 * Validate a magic link token and exchange for credentials
 */
export async function validateMagicLinkToken(token: string): Promise<AuthResult> {
	try {
		const response = await fetch(`${IDENTITY_WORKER}/v1/auth/magic-link/verify`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token })
		});

		if (!response.ok) {
			return {
				authenticated: false,
				message: 'Invalid or expired token'
			};
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
			user: { id: string; email: string; tier?: string };
		};

		const credentials: Credentials = {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
			user: {
				id: data.user.id,
				email: data.user.email,
				tier: (data.user.tier as 'free' | 'pro' | 'enterprise') || 'free'
			}
		};

		saveCredentials(credentials);

		return {
			authenticated: true,
			user: credentials.user,
			message: 'Successfully authenticated!',
			nextSteps: [
				'Run "workway-learn status" to see your progress',
				'Start a lesson with the learn_lesson tool in Claude Code'
			]
		};
	} catch (error) {
		return {
			authenticated: false,
			message: error instanceof Error ? error.message : 'Authentication failed'
		};
	}
}

/**
 * Login with email/password (alternative to magic link)
 */
export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
	try {
		const response = await fetch(`${IDENTITY_WORKER}/v1/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});

		if (!response.ok) {
			const error = (await response.json().catch(() => ({ message: 'Login failed' }))) as {
				message?: string;
			};
			return {
				authenticated: false,
				message: error.message || 'Invalid credentials'
			};
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
			user: { id: string; email: string; tier?: string };
		};

		const credentials: Credentials = {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
			user: {
				id: data.user.id,
				email: data.user.email,
				tier: (data.user.tier as 'free' | 'pro' | 'enterprise') || 'free'
			}
		};

		saveCredentials(credentials);

		return {
			authenticated: true,
			user: credentials.user,
			message: 'Successfully authenticated!'
		};
	} catch (error) {
		return {
			authenticated: false,
			message: error instanceof Error ? error.message : 'Login failed'
		};
	}
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<boolean> {
	const credentials = loadCredentials();
	if (!credentials) return false;

	try {
		const response = await fetch(`${IDENTITY_WORKER}/v1/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: credentials.refreshToken })
		});

		if (!response.ok) return false;

		const data = (await response.json()) as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
		};

		const newCredentials: Credentials = {
			...credentials,
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString()
		};

		saveCredentials(newCredentials);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get authorization header for API requests
 */
export async function getAuthHeader(): Promise<{ Authorization: string } | null> {
	const credentials = loadCredentials();
	if (!credentials) return null;

	// Refresh if expiring within 5 minutes
	const expiresAt = new Date(credentials.expiresAt);
	const fiveMinutes = 5 * 60 * 1000;

	if (expiresAt.getTime() - Date.now() < fiveMinutes) {
		const refreshed = await refreshAccessToken();
		if (!refreshed) return null;
	}

	const freshCredentials = loadCredentials();
	if (!freshCredentials) return null;

	return { Authorization: `Bearer ${freshCredentials.accessToken}` };
}

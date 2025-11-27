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
 * WORKWAY Testing Utilities
 *
 * Utilities for testing integrations and workflows
 * Used by developers when writing tests for their integrations
 *
 * @example
 * ```typescript
 * import { createMockContext } from '@workway/sdk/testing'
 *
 * const context = createMockContext({
 *   userId: 'test-user',
 *   oauth: {
 *     slack: {
 *       accessToken: 'xoxb-test-token'
 *     }
 *   }
 * })
 *
 * const result = await sendMessageAction.execute(input, context)
 * ```
 */

import type { ActionContext, OAuthTokens } from './integration-sdk';

// Note: We don't implement DurableObjectStorage directly to avoid
// type compatibility issues with different @cloudflare/workers-types versions.
// Instead, we provide a duck-typed mock that works for testing.

// ============================================================================
// MOCK OAUTH MANAGER
// ============================================================================

export interface MockOAuthConfig {
	[provider: string]: Partial<OAuthTokens>;
}

export class MockOAuthManager {
	private tokens: Map<string, Map<string, OAuthTokens>> = new Map();

	constructor(config: MockOAuthConfig = {}) {
		// Pre-populate with config
		for (const [provider, tokenData] of Object.entries(config)) {
			this.setTokens('test-user', provider, {
				accessToken: tokenData.accessToken || 'mock-access-token',
				refreshToken: tokenData.refreshToken,
				expiresAt: tokenData.expiresAt || Date.now() + 3600000,
				scope: tokenData.scope || '',
				tokenType: tokenData.tokenType || 'Bearer',
			});
		}
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		const userTokens = this.tokens.get(userId);
		if (!userTokens) return null;

		return userTokens.get(provider) || null;
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens> {
		const tokens = await this.getTokens(userId, provider);
		if (!tokens) {
			throw new Error(`No tokens found for ${provider}`);
		}

		// Return refreshed tokens
		return {
			...tokens,
			accessToken: `refreshed-${tokens.accessToken}`,
			expiresAt: Date.now() + 3600000,
		};
	}

	// Test helper: Set tokens manually
	setTokens(userId: string, provider: string, tokens: OAuthTokens): void {
		if (!this.tokens.has(userId)) {
			this.tokens.set(userId, new Map());
		}
		this.tokens.get(userId)!.set(provider, tokens);
	}
}

// ============================================================================
// MOCK STORAGE
// ============================================================================

export class MockStorage {
	private data = new Map<string, any>();
	private alarms = new Map<number, () => void>();

	async get<T = any>(key: string): Promise<T | undefined>;
	async get<T = any>(keys: string[]): Promise<Map<string, T>>;
	async get<T = any>(keyOrKeys: string | string[]): Promise<any> {
		if (Array.isArray(keyOrKeys)) {
			const result = new Map<string, T>();
			for (const key of keyOrKeys) {
				const value = this.data.get(key);
				if (value !== undefined) {
					result.set(key, value);
				}
			}
			return result;
		}
		return this.data.get(keyOrKeys);
	}

	async put<T = any>(key: string, value: T): Promise<void>;
	async put<T = any>(entries: Record<string, T>): Promise<void>;
	async put<T = any>(keyOrEntries: string | Record<string, T>, value?: T): Promise<void> {
		if (typeof keyOrEntries === 'string') {
			this.data.set(keyOrEntries, value);
		} else {
			for (const [key, val] of Object.entries(keyOrEntries)) {
				this.data.set(key, val);
			}
		}
	}

	async delete(key: string): Promise<boolean>;
	async delete(keys: string[]): Promise<number>;
	async delete(keyOrKeys: string | string[]): Promise<any> {
		if (Array.isArray(keyOrKeys)) {
			let count = 0;
			for (const key of keyOrKeys) {
				if (this.data.delete(key)) count++;
			}
			return count;
		}
		return this.data.delete(keyOrKeys);
	}

	async list(options?: any): Promise<Map<string, any>> {
		return new Map(this.data);
	}

	async deleteAll(): Promise<void> {
		this.data.clear();
	}

	async setAlarm(timestamp: number): Promise<void> {
		// Mock alarm (no-op in tests)
	}

	async getAlarm(): Promise<number | null> {
		return null;
	}

	async deleteAlarm(): Promise<void> {
		// Mock alarm deletion (no-op in tests)
	}

	// Transaction methods (simplified for testing)
	transaction(closure: (txn: any) => Promise<void>): Promise<void> {
		return closure(this);
	}

	transactionSync(closure: (txn: any) => void): void {
		closure(this);
	}

	// Test helper: Get all data
	getAll(): Map<string, any> {
		return new Map(this.data);
	}

	// Test helper: Clear all data
	clear(): void {
		this.data.clear();
	}
}

// ============================================================================
// MOCK ACTION CONTEXT
// ============================================================================

export interface MockContextOptions {
	userId?: string;
	oauth?: MockOAuthConfig;
	triggerData?: any;
	stepResults?: Record<string, any>;
	env?: any;
	storage?: MockStorage;
}

/**
 * Create a mock ActionContext for testing
 *
 * @example
 * ```typescript
 * const context = createMockContext({
 *   userId: 'test-user',
 *   oauth: {
 *     slack: {
 *       accessToken: 'xoxb-test-token'
 *     }
 *   },
 *   triggerData: {
 *     messageId: 'msg_123'
 *   }
 * })
 *
 * const result = await action.execute(input, context)
 * ```
 */
export function createMockContext(options: MockContextOptions = {}): ActionContext {
	const {
		userId = 'test-user',
		oauth = {},
		triggerData = {},
		stepResults = {},
		env = {},
		storage = new MockStorage(),
	} = options;

	return {
		userId,
		oauth: new MockOAuthManager(oauth),
		storage,
		triggerData,
		stepResults,
		env,
	};
}

// ============================================================================
// MOCK FETCH
// ============================================================================

export interface MockFetchResponse {
	ok: boolean;
	status?: number;
	statusText?: string;
	headers?: Record<string, string>;
	json?: () => Promise<any>;
	text?: () => Promise<string>;
}

/**
 * Create a mock fetch function for testing API calls
 *
 * @example
 * ```typescript
 * global.fetch = createMockFetch({
 *   'https://api.slack.com/chat.postMessage': {
 *     ok: true,
 *     json: async () => ({ ok: true, ts: '1234567890.123' })
 *   }
 * })
 * ```
 */
export function createMockFetch(
	responses: Record<string, MockFetchResponse>
): (url: string, options?: any) => Promise<Response> {
	return async (url: string, options?: any) => {
		const response = responses[url];
		if (!response) {
			throw new Error(`No mock response configured for ${url}`);
		}

		return {
			ok: response.ok,
			status: response.status || (response.ok ? 200 : 400),
			statusText: response.statusText || (response.ok ? 'OK' : 'Bad Request'),
			headers: new Headers(response.headers || {}),
			json: response.json || (async () => ({})),
			text: response.text || (async () => ''),
		} as Response;
	};
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock OAuth tokens
 */
export function createMockTokens(overrides: Partial<OAuthTokens> = {}): OAuthTokens {
	return {
		accessToken: 'mock-access-token',
		refreshToken: 'mock-refresh-token',
		expiresAt: Date.now() + 3600000,
		scope: 'read write',
		tokenType: 'Bearer',
		...overrides,
	};
}

/**
 * Create expired OAuth tokens (for testing refresh)
 */
export function createExpiredTokens(overrides: Partial<OAuthTokens> = {}): OAuthTokens {
	return {
		accessToken: 'expired-token',
		refreshToken: 'refresh-token',
		expiresAt: Date.now() - 1000, // Expired 1 second ago
		scope: 'read write',
		tokenType: 'Bearer',
		...overrides,
	};
}

/**
 * Wait for a promise to settle (for testing async operations)
 */
export function waitFor(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test if action throws expected error
 */
export async function expectError(fn: () => Promise<any>, expectedMessage: string): Promise<void> {
	try {
		await fn();
		throw new Error('Expected function to throw, but it did not');
	} catch (error: any) {
		if (!error.message.includes(expectedMessage)) {
			throw new Error(`Expected error message to include "${expectedMessage}", but got: ${error.message}`);
		}
	}
}

// ============================================================================
// INTEGRATION TESTING UTILITIES
// ============================================================================

/**
 * Create a test workflow for integration testing
 */
export function createTestWorkflow(steps: any[]) {
	return {
		id: 'test-workflow',
		name: 'Test Workflow',
		trigger: { type: 'manual' },
		steps,
		config: {},
	};
}

/**
 * Mock trigger data for testing
 */
export function createMockTrigger(type: string, data: any = {}) {
	return {
		type,
		data,
		timestamp: Date.now(),
	};
}

// ============================================================================
// VITEST HELPERS (if using vitest)
// ============================================================================

/**
 * Setup function for vitest tests
 * Automatically mocks global fetch and resets after each test
 *
 * @example
 * ```typescript
 * import { setupIntegrationTests } from '@workway/sdk/testing'
 *
 * setupIntegrationTests()
 *
 * describe('my tests', () => {
 *   it('works', () => { ... })
 * })
 * ```
 */
export function setupIntegrationTests() {
	// Only works with vitest
	if (typeof beforeEach !== 'function' || typeof afterEach !== 'function') {
		console.warn('setupIntegrationTests() requires vitest');
		return;
	}

	beforeEach(() => {
		// Reset global fetch mock
		if (global.fetch) {
			(global.fetch as any).mockClear?.();
		}
	});

	afterEach(() => {
		// Clean up
	});
}

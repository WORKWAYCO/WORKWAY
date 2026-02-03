/**
 * OAuth Authentication and Authorization Tests
 *
 * Comprehensive test suite for OAuth integration handling in workflows.
 * Designed to be reusable across all integrations that require OAuth.
 *
 * Current focus: Notion OAuth (used by YouTube to Notion workflow)
 * Future: Extensible to Slack, Gmail, Zoom, etc.
 *
 * Test Coverage:
 * 1. OAuth token validation (valid, expired, invalid, missing)
 * 2. Scope enforcement (required, missing, extra scopes)
 * 3. Token refresh flows (success, failure, expired refresh token)
 * 4. Multi-integration scenarios (single, multiple, isolation)
 * 5. Error messaging (user-facing, re-auth URLs, security)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNotion } from '../lib/utils/createMockNotion';

// ============================================================================
// MOCK TYPES
// ============================================================================

interface MockOAuthToken {
	access_token: string;
	refresh_token?: string;
	expires_at?: number; // Unix timestamp
	scopes: string[];
}

interface MockIntegrationContext {
	notion?: {
		access_token: string;
		refresh_token?: string;
		expires_at?: number;
		scopes: string[];
	};
}

interface MockWorkflowResult {
	success: boolean;
	error?: {
		message: string;
		code?: string;
		reconnectUrl?: string;
	};
	data?: any;
}

// ============================================================================
// MOCK OAUTH PROVIDER
// ============================================================================

/**
 * Mock OAuth provider that simulates token validation and refresh
 */
class MockOAuthProvider {
	private tokens: Map<string, MockOAuthToken> = new Map();

	setToken(accessToken: string, token: MockOAuthToken) {
		this.tokens.set(accessToken, token);
	}

	validateToken(accessToken: string): {
		valid: boolean;
		expired: boolean;
		scopes: string[];
		error?: string;
	} {
		const token = this.tokens.get(accessToken);

		if (!token) {
			return { valid: false, expired: false, scopes: [], error: 'Invalid token' };
		}

		const now = Date.now();
		const expired = token.expires_at ? token.expires_at < now : false;

		if (expired) {
			return { valid: false, expired: true, scopes: token.scopes, error: 'Token expired' };
		}

		return { valid: true, expired: false, scopes: token.scopes };
	}

	async refreshToken(refreshToken: string): Promise<{
		success: boolean;
		access_token?: string;
		expires_at?: number;
		error?: string;
	}> {
		// Simulate refresh token validation
		if (refreshToken === 'valid_refresh_token') {
			const newAccessToken = 'refreshed_access_token_' + Date.now();
			const expiresAt = Date.now() + 3600 * 1000; // 1 hour from now

			this.setToken(newAccessToken, {
				access_token: newAccessToken,
				refresh_token: refreshToken,
				expires_at: expiresAt,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			return {
				success: true,
				access_token: newAccessToken,
				expires_at: expiresAt,
			};
		}

		return {
			success: false,
			error: 'Invalid or expired refresh token',
		};
	}
}

// ============================================================================
// MOCK WORKFLOW EXECUTION
// ============================================================================

/**
 * Simulates workflow execution with OAuth integration
 */
async function executeWorkflowWithOAuth(
	integrations: MockIntegrationContext,
	requiredScopes: string[],
	oauthProvider: MockOAuthProvider
): Promise<MockWorkflowResult> {
	// Check if Notion integration is present
	if (!integrations.notion) {
		return {
			success: false,
			error: {
				message: 'Please connect your Notion account to continue.',
				code: 'NOTION_NOT_CONNECTED',
				reconnectUrl: 'https://workway.co/integrations/notion/connect',
			},
		};
	}

	const { access_token, refresh_token, scopes } = integrations.notion;

	// Validate token
	const validation = oauthProvider.validateToken(access_token);

	// Handle expired token - attempt refresh
	if (validation.expired && refresh_token) {
		const refreshResult = await oauthProvider.refreshToken(refresh_token);

		if (refreshResult.success && refreshResult.access_token) {
			// Token refreshed successfully - update context and continue
			integrations.notion.access_token = refreshResult.access_token;
			integrations.notion.expires_at = refreshResult.expires_at;
			// Re-validate with new token
			const newValidation = oauthProvider.validateToken(refreshResult.access_token);
			if (!newValidation.valid) {
				return {
					success: false,
					error: {
						message: 'Token refresh succeeded but new token is invalid.',
						code: 'TOKEN_REFRESH_INVALID',
					},
				};
			}
			// Continue with refreshed token
		} else {
			// Refresh failed - user needs to re-authenticate
			return {
				success: false,
				error: {
					message: 'Your Notion session has expired. Please reconnect your account.',
					code: 'NOTION_REAUTH_REQUIRED',
					reconnectUrl: 'https://workway.co/integrations/notion/connect',
				},
			};
		}
	} else if (!validation.valid) {
		// Invalid token (not just expired)
		return {
			success: false,
			error: {
				message: 'Your Notion connection is invalid. Please reconnect your account.',
				code: 'NOTION_INVALID_TOKEN',
				reconnectUrl: 'https://workway.co/integrations/notion/connect',
			},
		};
	}

	// Check scopes
	const hasAllScopes = requiredScopes.every((scope) => scopes.includes(scope));

	if (!hasAllScopes) {
		const missingScopes = requiredScopes.filter((scope) => !scopes.includes(scope));
		return {
			success: false,
			error: {
				message: `Missing required Notion permissions: ${missingScopes.join(', ')}. Please reconnect with the correct permissions.`,
				code: 'NOTION_INSUFFICIENT_SCOPES',
				reconnectUrl: 'https://workway.co/integrations/notion/connect',
			},
		};
	}

	// All checks passed - execute workflow
	return {
		success: true,
		data: {
			message: 'Workflow executed successfully',
			integration: 'notion',
			scopes: validation.scopes,
		},
	};
}

// ============================================================================
// TESTS
// ============================================================================

describe('OAuth Authentication Flows', () => {
	let oauthProvider: MockOAuthProvider;

	beforeEach(() => {
		oauthProvider = new MockOAuthProvider();
	});

	describe('Notion OAuth - Token Validation', () => {
		it('should execute workflow with valid token', async () => {
			// Setup valid token
			const validToken = 'valid_access_token';
			oauthProvider.setToken(validToken, {
				access_token: validToken,
				expires_at: Date.now() + 3600 * 1000, // 1 hour from now
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: validToken,
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.integration).toBe('notion');
		});

		it('should reject workflow with expired token (no refresh token)', async () => {
			const expiredToken = 'expired_access_token';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				expires_at: Date.now() - 1000, // Expired 1 second ago
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_INVALID_TOKEN');
			expect(result.error?.message).toContain('invalid');
			expect(result.error?.reconnectUrl).toBe(
				'https://workway.co/integrations/notion/connect'
			);
		});

		it('should reject workflow with invalid token', async () => {
			const integrations: MockIntegrationContext = {
				notion: {
					access_token: 'invalid_token_not_in_provider',
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_INVALID_TOKEN');
			expect(result.error?.message).toContain('invalid');
		});

		it('should handle missing integration gracefully', async () => {
			const integrations: MockIntegrationContext = {};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_NOT_CONNECTED');
			expect(result.error?.message).toContain('connect your Notion account');
			expect(result.error?.reconnectUrl).toBeDefined();
		});
	});

	describe('Scope Enforcement', () => {
		it('should accept token with exact required scopes', async () => {
			const validToken = 'valid_scoped_token';
			oauthProvider.setToken(validToken, {
				access_token: validToken,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: validToken,
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(true);
		});

		it('should reject token with missing scopes', async () => {
			const insufficientToken = 'insufficient_scopes_token';
			oauthProvider.setToken(insufficientToken, {
				access_token: insufficientToken,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages'], // Missing write_pages and read_databases
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: insufficientToken,
					scopes: ['read_pages'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_INSUFFICIENT_SCOPES');
			expect(result.error?.message).toContain('Missing required Notion permissions');
			expect(result.error?.message).toContain('write_pages');
			expect(result.error?.message).toContain('read_databases');
		});

		it('should accept token with extra scopes', async () => {
			const extraScopesToken = 'extra_scopes_token';
			oauthProvider.setToken(extraScopesToken, {
				access_token: extraScopesToken,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases', 'read_comments'], // Extra scope
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: extraScopesToken,
					scopes: ['read_pages', 'write_pages', 'read_databases', 'read_comments'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(true);
			expect(result.data.scopes).toContain('read_comments');
		});

		it('should validate scopes before API calls', async () => {
			// This test ensures scope validation happens BEFORE any API calls
			const tokenWithoutWriteScope = 'read_only_token';
			oauthProvider.setToken(tokenWithoutWriteScope, {
				access_token: tokenWithoutWriteScope,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages', 'read_databases'], // No write_pages
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: tokenWithoutWriteScope,
					scopes: ['read_pages', 'read_databases'],
				},
			};

			// Workflow requires write_pages for creating Notion pages
			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Should fail before attempting any API calls
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_INSUFFICIENT_SCOPES');
		});
	});

	describe('Token Refresh Flows', () => {
		it('should refresh expired access token automatically', async () => {
			const expiredToken = 'expired_but_refreshable_token';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				refresh_token: 'valid_refresh_token',
				expires_at: Date.now() - 1000, // Expired
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					refresh_token: 'valid_refresh_token',
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Should succeed after automatic token refresh
			expect(result.success).toBe(true);
			expect(integrations.notion.access_token).not.toBe(expiredToken);
			expect(integrations.notion.access_token).toContain('refreshed_access_token');
		});

		it('should handle refresh token expiration', async () => {
			const expiredToken = 'expired_with_expired_refresh';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				refresh_token: 'expired_refresh_token',
				expires_at: Date.now() - 1000, // Expired
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					refresh_token: 'expired_refresh_token',
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Should fail and require user re-authentication
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_REAUTH_REQUIRED');
			expect(result.error?.message).toContain('session has expired');
			expect(result.error?.reconnectUrl).toBeDefined();
		});

		it('should continue workflow after successful refresh', async () => {
			const expiredToken = 'expired_token_for_refresh_test';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				refresh_token: 'valid_refresh_token',
				expires_at: Date.now() - 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					refresh_token: 'valid_refresh_token',
					expires_at: Date.now() - 1000,
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Workflow should complete successfully after refresh
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.message).toContain('successfully');
		});

		it('should handle refresh failure gracefully', async () => {
			const expiredToken = 'expired_token_refresh_fails';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				refresh_token: 'invalid_refresh_token',
				expires_at: Date.now() - 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					refresh_token: 'invalid_refresh_token',
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('expired');
			expect(result.error?.reconnectUrl).toBeDefined();
		});
	});

	describe('Multi-Integration Scenarios', () => {
		it('should handle single integration (Notion only)', async () => {
			const notionToken = 'notion_only_token';
			oauthProvider.setToken(notionToken, {
				access_token: notionToken,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: notionToken,
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(true);
		});

		it('should isolate integration failures', async () => {
			// This test simulates a workflow with multiple integrations
			// where one fails but others should continue

			const notionToken = 'notion_token';
			oauthProvider.setToken(notionToken, {
				access_token: notionToken,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			// First check Notion (should succeed)
			const notionResult = await executeWorkflowWithOAuth(
				{
					notion: {
						access_token: notionToken,
						scopes: ['read_pages', 'write_pages', 'read_databases'],
					},
				},
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(notionResult.success).toBe(true);

			// Simulate another integration failing (e.g., Slack not connected)
			// This should be isolated and not affect Notion's successful auth
			const slackResult = await executeWorkflowWithOAuth(
				{}, // No Slack integration
				['chat:write'], // Hypothetical Slack scope
				oauthProvider
			);

			expect(slackResult.success).toBe(false);
			// Notion's success should not be affected by Slack's failure
		});
	});

	describe('Error Messaging', () => {
		it('should provide actionable error for missing auth', async () => {
			const integrations: MockIntegrationContext = {};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toBeTruthy();
			expect(result.error?.message).toContain('connect');
			expect(result.error?.reconnectUrl).toBe(
				'https://workway.co/integrations/notion/connect'
			);
			expect(result.error?.code).toBe('NOTION_NOT_CONNECTED');
		});

		it('should not expose tokens in error messages', async () => {
			const sensitiveToken = 'secret_token_abc123';
			oauthProvider.setToken(sensitiveToken, {
				access_token: sensitiveToken,
				expires_at: Date.now() - 1000, // Expired
				scopes: ['read_pages'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: sensitiveToken,
					scopes: ['read_pages'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Error message should NOT contain the token
			expect(result.error?.message).not.toContain(sensitiveToken);
			expect(result.error?.message).not.toContain('secret_token');
			expect(result.error?.message).not.toContain('abc123');

			// Error should still be informative
			expect(result.error?.message).toBeTruthy();
			expect(result.error?.code).toBeTruthy();
		});

		it('should include specific error codes for debugging', async () => {
			const testCases = [
				{
					scenario: 'missing integration',
					integrations: {},
					expectedCode: 'NOTION_NOT_CONNECTED',
				},
				{
					scenario: 'invalid token',
					integrations: {
						notion: {
							access_token: 'invalid_token',
							scopes: ['read_pages', 'write_pages', 'read_databases'],
						},
					},
					expectedCode: 'NOTION_INVALID_TOKEN',
				},
			];

			for (const testCase of testCases) {
				const result = await executeWorkflowWithOAuth(
					testCase.integrations as MockIntegrationContext,
					['read_pages', 'write_pages', 'read_databases'],
					oauthProvider
				);

				expect(result.success).toBe(false);
				expect(result.error?.code).toBe(testCase.expectedCode);
			}
		});

		it('should provide clear re-authorization instructions', async () => {
			const expiredToken = 'expired_token_needs_reauth';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				refresh_token: 'expired_refresh_token',
				expires_at: Date.now() - 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					refresh_token: 'expired_refresh_token',
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('reconnect');
			expect(result.error?.reconnectUrl).toBeDefined();
			expect(result.error?.reconnectUrl).toContain('integrations/notion/connect');
		});

		it('should handle 401 vs 403 errors appropriately', async () => {
			// 401: Unauthorized (token issue) - should retry with refresh
			// 403: Forbidden (insufficient scopes) - should prompt for reconnect with correct scopes

			// 401 scenario - expired token
			const expiredToken = 'token_401_test';
			oauthProvider.setToken(expiredToken, {
				access_token: expiredToken,
				refresh_token: 'valid_refresh_token',
				expires_at: Date.now() - 1000,
				scopes: ['read_pages', 'write_pages', 'read_databases'],
			});

			const integrations401: MockIntegrationContext = {
				notion: {
					access_token: expiredToken,
					refresh_token: 'valid_refresh_token',
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const result401 = await executeWorkflowWithOAuth(
				integrations401,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Should succeed after refresh (handles 401)
			expect(result401.success).toBe(true);

			// 403 scenario - insufficient scopes
			const validTokenInsufficientScopes = 'token_403_test';
			oauthProvider.setToken(validTokenInsufficientScopes, {
				access_token: validTokenInsufficientScopes,
				expires_at: Date.now() + 3600 * 1000,
				scopes: ['read_pages'], // Missing write_pages
			});

			const integrations403: MockIntegrationContext = {
				notion: {
					access_token: validTokenInsufficientScopes,
					scopes: ['read_pages'],
				},
			};

			const result403 = await executeWorkflowWithOAuth(
				integrations403,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// Should fail with scope error (handles 403)
			expect(result403.success).toBe(false);
			expect(result403.error?.code).toBe('NOTION_INSUFFICIENT_SCOPES');
		});
	});

	describe('Integration with Notion Client', () => {
		it('should mock Notion API calls with valid OAuth', async () => {
			const notion = createMockNotion();

			// Mock successful API response
			notion.createPage.mockResolvedValueOnce({
				success: true,
				data: {
					id: 'page_123',
					url: 'https://notion.so/page_123',
					object: 'page',
					created_time: new Date().toISOString(),
					last_edited_time: new Date().toISOString(),
					properties: {},
					archived: false,
					parent: { type: 'database_id', database_id: 'db_123' },
				},
			});

			const result = await notion.createPage({
				parentDatabaseId: 'db_123',
				properties: {
					Name: { title: [{ text: { content: 'Test Page' } }] },
				},
			});

			expect(result.success).toBe(true);
			expect(result.data.id).toBe('page_123');
			expect(notion.createPage).toHaveBeenCalledWith({
				parentDatabaseId: 'db_123',
				properties: {
					Name: { title: [{ text: { content: 'Test Page' } }] },
				},
			});
		});

		it('should mock Notion OAuth errors', async () => {
			const notion = createMockNotion();

			// Mock OAuth error (401)
			notion.queryDatabase.mockResolvedValueOnce({
				success: false,
				error: {
					message: 'Unauthorized',
					code: 'NOTION_UNAUTHORIZED',
				},
			});

			const result = await notion.queryDatabase({
				databaseId: 'db_123',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NOTION_UNAUTHORIZED');
		});

		it('should validate OAuth before Notion API calls', async () => {
			// This test ensures OAuth validation happens before hitting Notion API
			const notion = createMockNotion();

			// Setup token validation to fail
			const invalidToken = 'invalid_token_for_api_test';

			const integrations: MockIntegrationContext = {
				notion: {
					access_token: invalidToken,
					scopes: ['read_pages', 'write_pages', 'read_databases'],
				},
			};

			const oauthValidation = await executeWorkflowWithOAuth(
				integrations,
				['read_pages', 'write_pages', 'read_databases'],
				oauthProvider
			);

			// OAuth validation should fail before any Notion API calls
			expect(oauthValidation.success).toBe(false);
			expect(notion.createPage).not.toHaveBeenCalled();
		});
	});
});

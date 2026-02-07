/**
 * Autodesk APS Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Autodesk } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

describe('Autodesk constructor', () => {
	it('should require access token', () => {
		expect(() => new Autodesk({ accessToken: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new Autodesk({ accessToken: 'test-token' });
		expect(client).toBeInstanceOf(Autodesk);
	});

	it('should support token refresh config', () => {
		const client = new Autodesk({
			accessToken: 'test-token',
			tokenRefresh: {
				refreshToken: 'refresh-token',
				clientId: 'client-id',
				clientSecret: 'client-secret',
				onTokenRefreshed: vi.fn(),
			},
		});
		expect(client).toBeInstanceOf(Autodesk);
	});
});

describe('Autodesk API methods', () => {
	let client: Autodesk;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new Autodesk({ accessToken: 'test-token' });
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getHubs', () => {
		it('should return hubs on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{ type: 'hubs', id: 'h.1', attributes: { name: 'My Hub', region: 'US' } },
					],
				}),
			});

			const result = await client.getHubs();
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
			expect(result.data[0].attributes.name).toBe('My Hub');
		});
	});

	describe('getProjects', () => {
		it('should return projects on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{ type: 'projects', id: 'p.1', attributes: { name: 'Tower Build', scopes: [] } },
						{ type: 'projects', id: 'p.2', attributes: { name: 'Bridge Repair', scopes: [] } },
					],
				}),
			});

			const result = await client.getProjects('h.1');
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});
	});

	describe('translateModel', () => {
		it('should submit translation job', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ urn: 'dXJuOmFkc2sub2Jq', result: 'created' }),
			});

			const result = await client.translateModel({ urn: 'dXJuOmFkc2sub2Jq' });
			expect(result.success).toBe(true);
			expect(result.data.result).toBe('created');
		});
	});

	describe('getManifest', () => {
		it('should return manifest on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					type: 'manifest',
					status: 'success',
					progress: 'complete',
					urn: 'dXJuOmFkc2sub2Jq',
				}),
			});

			const result = await client.getManifest('dXJuOmFkc2sub2Jq');
			expect(result.success).toBe(true);
			expect(result.data.status).toBe('success');
		});
	});

	describe('queryAECDataModel', () => {
		it('should execute GraphQL query', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: { projects: { results: [{ id: '1', name: 'Test' }] } },
				}),
			});

			const result = await client.queryAECDataModel('{ projects { results { id name } } }');
			expect(result.success).toBe(true);
		});

		it('should handle GraphQL errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: null,
					errors: [{ message: 'Field not found' }],
				}),
			});

			const result = await client.queryAECDataModel('{ invalid }');
			expect(result.success).toBe(false);
		});
	});

	describe('error handling', () => {
		it('should handle 401 auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ developerMessage: 'Invalid token' }),
			});

			const result = await client.getHubs();
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});

		it('should handle 429 rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				headers: new Headers({ 'Content-Type': 'application/json' }),
				json: async () => ({ reason: 'Rate limit exceeded' }),
			});

			const result = await client.getHubs();
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});
});

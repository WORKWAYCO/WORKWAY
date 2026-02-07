/**
 * DroneDeploy Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DroneDeploy } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

describe('DroneDeploy constructor', () => {
	it('should require API key', () => {
		expect(() => new DroneDeploy({ apiKey: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new DroneDeploy({ apiKey: 'test-key' });
		expect(client).toBeInstanceOf(DroneDeploy);
	});
});

describe('DroneDeploy API methods', () => {
	let client: DroneDeploy;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new DroneDeploy({ apiKey: 'test-key' });
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getPlans', () => {
		it('should return plans on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						viewer: {
							plans: {
								edges: [
									{ node: { id: 'p1', name: 'Site Alpha', status: 'active', imageCount: 120 } },
									{ node: { id: 'p2', name: 'Site Beta', status: 'active', imageCount: 85 } },
								],
							},
						},
					},
				}),
			});

			const result = await client.getPlans();
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
			expect(result.data[0].name).toBe('Site Alpha');
		});
	});

	describe('getMaps', () => {
		it('should return maps for a plan', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						node: {
							maps: {
								edges: [
									{ node: { id: 'm1', status: 'complete', dateCreation: '2024-01-15' } },
								],
							},
						},
					},
				}),
			});

			const result = await client.getMaps('p1');
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
			expect(result.data[0].planId).toBe('p1');
		});
	});

	describe('getIssues', () => {
		it('should return issues for a plan', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: {
						node: {
							issues: {
								edges: [
									{ node: { id: 'i1', title: 'Crack in foundation', status: 'open', priority: 'high' } },
								],
							},
						},
					},
				}),
			});

			const result = await client.getIssues('p1');
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
			expect(result.data[0].title).toBe('Crack in foundation');
		});
	});

	describe('query', () => {
		it('should execute raw GraphQL', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: { viewer: { username: 'test@example.com' } },
				}),
			});

			const result = await client.query('{ viewer { username } }');
			expect(result.success).toBe(true);
		});

		it('should handle GraphQL errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: null,
					errors: [{ message: 'Query failed' }],
				}),
			});

			const result = await client.query('{ invalid }');
			expect(result.success).toBe(false);
		});
	});

	describe('error handling', () => {
		it('should handle auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ message: 'Unauthorized' }),
			});

			const result = await client.getPlans();
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});
	});
});

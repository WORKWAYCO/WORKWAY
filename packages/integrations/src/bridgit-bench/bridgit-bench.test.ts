/**
 * Bridgit Bench Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BridgitBench } from './index.js';

describe('BridgitBench constructor', () => {
	it('should require service account ID or access token', () => {
		expect(() => new BridgitBench({ serviceAccountId: '', password: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new BridgitBench({
			serviceAccountId: 'guid-123',
			password: 'pass',
		});
		expect(client).toBeInstanceOf(BridgitBench);
	});

	it('should accept access token', () => {
		const client = new BridgitBench({
			serviceAccountId: '',
			password: '',
			accessToken: 'pre-auth-token',
		});
		expect(client).toBeInstanceOf(BridgitBench);
	});
});

describe('BridgitBench API methods', () => {
	let client: BridgitBench;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new BridgitBench({
			serviceAccountId: 'guid-123',
			password: 'pass',
			accessToken: 'test-token',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('authenticate', () => {
		it('should return auth tokens', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					access_token: 'new-token',
					refresh_token: 'new-refresh',
					token_type: 'Bearer',
					expires_in: 86400,
				}),
			});

			const result = await client.authenticate();
			expect(result.success).toBe(true);
			expect(result.data.access_token).toBe('new-token');
		});
	});

	describe('getProjects', () => {
		it('should return projects', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'p1', name: 'Highway Expansion', status: 'active' },
				],
			});

			const result = await client.getProjects();
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
		});
	});

	describe('getPeople', () => {
		it('should return people', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'pe1', first_name: 'Mike', last_name: 'Smith', title: 'Superintendent' },
				],
			});

			const result = await client.getPeople();
			expect(result.success).toBe(true);
			expect(result.data[0].first_name).toBe('Mike');
		});
	});

	describe('getRoles', () => {
		it('should return roles for a project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'r1', title: 'Project Manager', status: 'filled', person_name: 'John Doe' },
				],
			});

			const result = await client.getRoles('p1');
			expect(result.success).toBe(true);
			expect(result.data[0].title).toBe('Project Manager');
		});
	});
});

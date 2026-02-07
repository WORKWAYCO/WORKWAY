/**
 * Bluebeam Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Bluebeam } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

describe('Bluebeam constructor', () => {
	it('should require access token', () => {
		expect(() => new Bluebeam({ accessToken: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new Bluebeam({ accessToken: 'test-token' });
		expect(client).toBeInstanceOf(Bluebeam);
	});

	it('should support region selection', () => {
		const client = new Bluebeam({ accessToken: 'test-token', region: 'DE' });
		expect(client).toBeInstanceOf(Bluebeam);
	});
});

describe('Bluebeam API methods', () => {
	let client: Bluebeam;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new Bluebeam({ accessToken: 'test-token', region: 'US' });
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getSessions', () => {
		it('should return sessions on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ Id: 's1', Name: 'Foundation Review', Status: 'Active' },
				],
			});

			const result = await client.getSessions();
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
			expect(result.data[0].Name).toBe('Foundation Review');
		});
	});

	describe('getMarkups', () => {
		it('should return markups on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ Id: 'm1', Author: 'Jane', Subject: 'Rebar detail', Page: 3, Type: 'callout' },
				],
			});

			const result = await client.getMarkups('s1', 'd1');
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
		});
	});

	describe('createSession', () => {
		it('should create session', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ Id: 's2', Name: 'Steel Review', Status: 'Active' }),
			});

			const result = await client.createSession({ name: 'Steel Review' });
			expect(result.success).toBe(true);
			expect(result.data.Name).toBe('Steel Review');
		});
	});

	describe('error handling', () => {
		it('should handle auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ error: 'invalid_token' }),
			});

			const result = await client.getSessions();
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});
	});
});

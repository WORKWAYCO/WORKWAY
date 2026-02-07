/**
 * Shovels.ai Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Shovels } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

describe('Shovels constructor', () => {
	it('should require API key', () => {
		expect(() => new Shovels({ apiKey: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new Shovels({ apiKey: 'test-key' });
		expect(client).toBeInstanceOf(Shovels);
	});
});

describe('Shovels API methods', () => {
	let client: Shovels;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new Shovels({ apiKey: 'test-key' });
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getPermits', () => {
		it('should return permits on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'p1', type: 'residential', status: 'issued', address: '123 Main St' },
					{ id: 'p2', type: 'commercial', status: 'issued', address: '456 Oak Ave' },
				],
			});

			const result = await client.getPermits({ zipCode: '90210' });
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [],
			});

			const result = await client.getPermits({ zipCode: '00000' });
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('getContractors', () => {
		it('should return contractors on success', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'c1', name: 'ABC Construction', permit_count: 45 },
				],
			});

			const result = await client.getContractors({ state: 'CA' });
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
			expect(result.data[0].name).toBe('ABC Construction');
		});
	});

	describe('getContractor', () => {
		it('should return contractor details', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'c1',
					name: 'ABC Construction',
					license_number: 'LIC-12345',
					permit_count: 45,
					specialties: ['residential', 'remodel'],
				}),
			});

			const result = await client.getContractor('c1');
			expect(result.success).toBe(true);
			expect(result.data.license_number).toBe('LIC-12345');
		});
	});

	describe('getPermitActivity', () => {
		it('should return geo-search results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'p1', type: 'commercial', address: '789 Elm St', latitude: 34.05, longitude: -118.25 },
				],
			});

			const result = await client.getPermitActivity({
				latitude: 34.05,
				longitude: -118.25,
				radiusMiles: 10,
			});
			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
		});
	});

	describe('getJurisdictions', () => {
		it('should return jurisdictions', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'j1', name: 'Los Angeles', state: 'CA', permit_count: 100000 },
				],
			});

			const result = await client.getJurisdictions('CA');
			expect(result.success).toBe(true);
			expect(result.data[0].name).toBe('Los Angeles');
		});
	});

	describe('error handling', () => {
		it('should handle auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ detail: 'Invalid API key' }),
			});

			const result = await client.getPermits();
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});
	});
});

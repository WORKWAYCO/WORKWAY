/**
 * EquipmentWatch Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EquipmentWatch } from './index.js';

describe('EquipmentWatch constructor', () => {
	it('should require API key', () => {
		expect(() => new EquipmentWatch({ apiKey: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new EquipmentWatch({ apiKey: 'test-key' });
		expect(client).toBeInstanceOf(EquipmentWatch);
	});
});

describe('EquipmentWatch API methods', () => {
	let client: EquipmentWatch;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new EquipmentWatch({ apiKey: 'test-key' });
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('searchEquipment', () => {
		it('should return equipment results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'eq1', make: 'Caterpillar', model: '320', category: 'Excavator' },
				],
			});

			const result = await client.searchEquipment({ query: 'CAT 320' });
			expect(result.success).toBe(true);
			expect(result.data[0].make).toBe('Caterpillar');
		});
	});

	describe('getSpecifications', () => {
		it('should return specs', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'spec1',
					equipmentId: 'eq1',
					operatingWeight: 52000,
					horsepower: 162,
				}),
			});

			const result = await client.getSpecifications('eq1');
			expect(result.success).toBe(true);
			expect(result.data.horsepower).toBe(162);
		});
	});

	describe('getRentalRates', () => {
		it('should return rental rates', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					equipmentId: 'eq1',
					region: 'US-West',
					daily: 850,
					weekly: 3200,
					monthly: 9500,
					currency: 'USD',
				}),
			});

			const result = await client.getRentalRates('eq1', 'US-West');
			expect(result.success).toBe(true);
			expect(result.data.monthly).toBe(9500);
		});
	});

	describe('getMarketValue', () => {
		it('should return market value', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					equipmentId: 'eq1',
					condition: 'good',
					fairMarketValue: 185000,
					currency: 'USD',
				}),
			});

			const result = await client.getMarketValue('eq1', 'good');
			expect(result.success).toBe(true);
			expect(result.data.fairMarketValue).toBe(185000);
		});
	});

	describe('getCategories', () => {
		it('should return categories', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ id: 'cat1', name: 'Excavators', level: 0, equipmentCount: 1200 },
				],
			});

			const result = await client.getCategories();
			expect(result.success).toBe(true);
			expect(result.data[0].name).toBe('Excavators');
		});
	});
});

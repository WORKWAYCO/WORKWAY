/**
 * Oracle Textura Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OracleTextura } from './index.js';

describe('OracleTextura constructor', () => {
	it('should require base URL', () => {
		expect(() => new OracleTextura({ baseUrl: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new OracleTextura({
			baseUrl: 'https://textura.example.com',
			accessToken: 'test-token',
		});
		expect(client).toBeInstanceOf(OracleTextura);
	});
});

describe('OracleTextura API methods', () => {
	let client: OracleTextura;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new OracleTextura({
			baseUrl: 'https://textura.example.com',
			accessToken: 'test-token',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('exportPayments', () => {
		it('should return payments', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ paymentId: 'pay-1', amount: 50000, status: 'completed' },
				],
			});

			const result = await client.exportPayments();
			expect(result.success).toBe(true);
			expect(result.data[0].amount).toBe(50000);
		});
	});

	describe('exportInvoiceRejections', () => {
		it('should return rejected invoices', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ invoiceId: 'inv-1', status: 'rejected', rejectionReason: 'Missing lien waiver' },
				],
			});

			const result = await client.exportInvoiceRejections();
			expect(result.success).toBe(true);
			expect(result.data[0].rejectionReason).toBe('Missing lien waiver');
		});
	});

	describe('importContracts', () => {
		it('should import contracts', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ status: 'success', imported: 2 }),
			});

			const result = await client.importContracts({
				contracts: [
					{ projectId: 'p1', contractorId: 'c1', amount: 100000 },
				],
			});
			expect(result.success).toBe(true);
		});
	});

	describe('syncERPRecords', () => {
		it('should sync ERP records', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ status: 'success', synced: 5 }),
			});

			const result = await client.syncERPRecords([{ type: 'payment', id: 'p1' }]);
			expect(result.success).toBe(true);
		});
	});
});

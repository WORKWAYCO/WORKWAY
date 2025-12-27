/**
 * QuickBooks Integration Tests
 *
 * Tests for constructor validation, invoice/payment operations, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuickBooks } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('QuickBooks constructor', () => {
	it('should require access token', () => {
		expect(() => new QuickBooks({
			accessToken: '',
			realmId: '1234567890',
		})).toThrow();
	});

	it('should require realm ID', () => {
		expect(() => new QuickBooks({
			accessToken: 'test-token',
			realmId: '',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new QuickBooks({
			accessToken: 'test-token',
			realmId: '1234567890',
		});
		expect(client).toBeInstanceOf(QuickBooks);
	});

	it('should allow custom timeout', () => {
		const client = new QuickBooks({
			accessToken: 'test-token',
			realmId: '1234567890',
			timeout: 5000,
		});
		expect(client).toBeInstanceOf(QuickBooks);
	});

	it('should support sandbox mode', () => {
		const client = new QuickBooks({
			accessToken: 'test-token',
			realmId: '1234567890',
			sandbox: true,
		});
		expect(client).toBeInstanceOf(QuickBooks);
	});

	it('should support token refresh config', () => {
		const client = new QuickBooks({
			accessToken: 'test-token',
			realmId: '1234567890',
			refreshToken: 'refresh-token',
			clientId: 'client-id',
			clientSecret: 'client-secret',
			onTokenRefreshed: vi.fn(),
		});
		expect(client).toBeInstanceOf(QuickBooks);
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('QuickBooks API methods', () => {
	let client: QuickBooks;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new QuickBooks({
			accessToken: 'test-token',
			realmId: '1234567890',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getOverdueInvoices', () => {
		it('should return overdue invoices on success', async () => {
			const mockResponse = {
				QueryResponse: {
					Invoice: [
						{
							Id: '1',
							DocNumber: 'INV-001',
							TxnDate: '2023-12-01',
							DueDate: '2023-12-31',
							TotalAmt: 1500.00,
							Balance: 1500.00,
							CustomerRef: { value: '123', name: 'Acme Corp' },
						},
						{
							Id: '2',
							DocNumber: 'INV-002',
							TxnDate: '2023-11-01',
							DueDate: '2023-11-30',
							TotalAmt: 2000.00,
							Balance: 2000.00,
							CustomerRef: { value: '124', name: 'Tech Co' },
						},
					],
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.getOverdueInvoices();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
			expect(result.data[0].Balance).toBe(1500.00);
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ QueryResponse: {} }),
			});

			const result = await client.getOverdueInvoices();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('createInvoice', () => {
		it('should create invoice on success', async () => {
			const mockInvoice = {
				Invoice: {
					Id: '3',
					DocNumber: 'INV-003',
					TxnDate: '2024-01-15',
					DueDate: '2024-02-15',
					TotalAmt: 1500.00,
					Balance: 1500.00,
					CustomerRef: { value: '123', name: 'Acme Corp' },
					Line: [{
						Amount: 1500.00,
						Description: 'Consulting services',
						DetailType: 'SalesItemLineDetail',
					}],
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockInvoice,
			});

			const result = await client.createInvoice({
				customerId: '123',
				lineItems: [{
					description: 'Consulting services',
					amount: 1500.00,
				}],
			});

			expect(result.success).toBe(true);
			expect(result.data.Id).toBe('3');
			expect(result.data.TotalAmt).toBe(1500.00);
		});

		it('should validate required fields', async () => {
			const result = await client.createInvoice({
				customerId: '',
				lineItems: [],
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({
					Fault: {
						Error: [{ Message: 'Invalid customer reference' }],
					},
				}),
			});

			const result = await client.createInvoice({
				customerId: 'invalid',
				lineItems: [{
					description: 'Test',
					amount: 100,
				}],
			});

			expect(result.success).toBe(false);
		});
	});

	describe('getInvoice', () => {
		it('should return invoice on success', async () => {
			const mockInvoice = {
				Invoice: {
					Id: '1',
					DocNumber: 'INV-001',
					TxnDate: '2024-01-01',
					DueDate: '2024-02-01',
					TotalAmt: 1000.00,
					Balance: 500.00,
					CustomerRef: { value: '123', name: 'Acme Corp' },
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockInvoice,
			});

			const result = await client.getInvoice('1');

			expect(result.success).toBe(true);
			expect(result.data.Id).toBe('1');
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({
					Fault: {
						Error: [{ Message: 'Invoice not found' }],
					},
				}),
			});

			const result = await client.getInvoice('999');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
		});
	});

	describe('recordPayment', () => {
		it('should record payment on success', async () => {
			const mockPayment = {
				Payment: {
					Id: '1',
					TotalAmt: 1500.00,
					CustomerRef: { value: '123', name: 'Acme Corp' },
					TxnDate: '2024-01-15',
					Line: [{
						Amount: 1500.00,
						LinkedTxn: [{ TxnId: '3', TxnType: 'Invoice' }],
					}],
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockPayment,
			});

			const result = await client.recordPayment({
				customerId: '123',
				amount: 1500.00,
				invoiceId: '3',
			});

			expect(result.success).toBe(true);
			expect(result.data.TotalAmt).toBe(1500.00);
		});

		it('should validate required fields', async () => {
			const result = await client.recordPayment({
				customerId: '',
				amount: 0,
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getCustomer', () => {
		it('should return customer on success', async () => {
			const mockCustomer = {
				Customer: {
					Id: '123',
					DisplayName: 'Acme Corp',
					CompanyName: 'Acme Corporation',
					PrimaryEmailAddr: { Address: 'billing@acme.com' },
					Balance: 2500.00,
					Active: true,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockCustomer,
			});

			const result = await client.getCustomer('123');

			expect(result.success).toBe(true);
			expect(result.data.Id).toBe('123');
			expect(result.data.DisplayName).toBe('Acme Corp');
		});
	});

	describe('queryInvoices', () => {
		it('should query invoices with custom criteria', async () => {
			const mockResponse = {
				QueryResponse: {
					Invoice: [
						{
							Id: '1',
							TotalAmt: 1000.00,
							Balance: 0,
							CustomerRef: { value: '123' },
						},
					],
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.queryInvoices({
				where: "Balance = '0'",
				maxResults: 10,
			});

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
		});
	});

	describe('rate limiting', () => {
		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				headers: new Headers({ 'Content-Type': 'application/json' }),
				json: async () => ({
					Fault: {
						Error: [{ Message: 'Rate limit exceeded' }],
					},
				}),
			});

			const result = await client.getInvoice('1');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});

	describe('authentication errors', () => {
		it('should handle auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({
					Fault: {
						Error: [{ Message: 'AuthenticationFailed' }],
					},
				}),
			});

			const result = await client.getOverdueInvoices();

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});
	});
});

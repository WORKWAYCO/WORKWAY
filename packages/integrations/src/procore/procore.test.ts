/**
 * Procore Integration Tests
 *
 * Tests for constructor validation, project operations, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Procore } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('Procore constructor', () => {
	it('should require access token', () => {
		expect(() => new Procore({
			accessToken: '',
			companyId: '12345',
		})).toThrow();
	});

	it('should require company ID', () => {
		expect(() => new Procore({
			accessToken: 'test-token',
			companyId: '',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new Procore({
			accessToken: 'test-token',
			companyId: '12345',
		});
		expect(client).toBeInstanceOf(Procore);
	});

	it('should allow custom timeout', () => {
		const client = new Procore({
			accessToken: 'test-token',
			companyId: '12345',
			timeout: 5000,
		});
		expect(client).toBeInstanceOf(Procore);
	});

	it('should support environment selection', () => {
		const client = new Procore({
			accessToken: 'test-token',
			companyId: '12345',
			environment: 'sandbox',
		});
		expect(client).toBeInstanceOf(Procore);
	});

	it('should support token refresh config', () => {
		const client = new Procore({
			accessToken: 'test-token',
			companyId: '12345',
			tokenRefresh: {
				refreshToken: 'refresh-token',
				clientId: 'client-id',
				clientSecret: 'client-secret',
				onTokenRefreshed: vi.fn(),
			},
		});
		expect(client).toBeInstanceOf(Procore);
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('Procore API methods', () => {
	let client: Procore;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new Procore({
			accessToken: 'test-token',
			companyId: '12345',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getProjects', () => {
		it('should return projects on success', async () => {
			const mockProjects = [
				{
					id: 1,
					name: 'Office Building',
					active: true,
					address: '123 Main St',
					city: 'Seattle',
					state_code: 'WA',
					project_number: 'P-001',
				},
				{
					id: 2,
					name: 'Shopping Center',
					active: true,
					address: '456 Oak Ave',
					city: 'Portland',
					state_code: 'OR',
					project_number: 'P-002',
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockProjects,
			});

			const result = await client.getProjects();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
			expect(result.data[0].name).toBe('Office Building');
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [],
			});

			const result = await client.getProjects();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('getProject', () => {
		it('should return project on success', async () => {
			const mockProject = {
				id: 1,
				name: 'Office Building',
				active: true,
				address: '123 Main St',
				city: 'Seattle',
				state_code: 'WA',
				project_number: 'P-001',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockProject,
			});

			const result = await client.getProject('1');

			expect(result.success).toBe(true);
			expect(result.data.id).toBe(1);
			expect(result.data.name).toBe('Office Building');
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ errors: ['Project not found'] }),
			});

			const result = await client.getProject('999');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
		});

		it('should validate project ID', async () => {
			const result = await client.getProject('');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getRFIs', () => {
		it('should return RFIs on success', async () => {
			const mockRFIs = [
				{
					id: 1,
					number: 'RFI-001',
					subject: 'Foundation depth clarification',
					status: 'open',
					due_date: '2024-01-15',
					assigned_to: { id: 123, name: 'John Smith' },
				},
				{
					id: 2,
					number: 'RFI-002',
					subject: 'Material substitution approval',
					status: 'answered',
					due_date: '2024-01-16',
					assigned_to: { id: 124, name: 'Jane Doe' },
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockRFIs,
			});

			const result = await client.getRFIs({
				projectId: '1',
				status: 'open',
			});

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});

		it('should validate project ID', async () => {
			const result = await client.getRFIs({
				projectId: '',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getDailyLogs', () => {
		it('should return daily logs on success', async () => {
			const mockLogs = [
				{
					id: 1,
					date: '2024-01-15',
					weather: 'Sunny, 72°F',
					work_performed: 'Framing continued on 2nd floor',
					safety_notes: 'No incidents',
				},
				{
					id: 2,
					date: '2024-01-16',
					weather: 'Cloudy, 68°F',
					work_performed: 'Electrical rough-in',
					safety_notes: 'Hard hats required',
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockLogs,
			});

			const result = await client.getDailyLogs({
				projectId: '1',
				date: new Date('2024-01-15'),
			});

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});
	});

	describe('getSubmittals', () => {
		it('should return submittals on success', async () => {
			const mockSubmittals = [
				{
					id: 1,
					number: 'SUB-001',
					title: 'Steel fabrication shop drawings',
					status: 'pending_approval',
					due_date: '2024-01-20',
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockSubmittals,
			});

			const result = await client.getSubmittals({
				projectId: '1',
			});

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(1);
		});
	});

	describe('getChangeOrders', () => {
		it('should return change orders on success', async () => {
			const mockChangeOrders = [
				{
					id: 1,
					number: 'CO-001',
					title: 'Additional outlet installation',
					status: 'approved',
					amount: 2500.00,
					approved_at: '2024-01-10',
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockChangeOrders,
			});

			const result = await client.getChangeOrders({
				projectId: '1',
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
				json: async () => ({ errors: ['Rate limit exceeded'] }),
			});

			const result = await client.getProject('1');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});

	describe('authentication errors', () => {
		it('should handle auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ errors: ['Invalid access token'] }),
			});

			const result = await client.getProjects();

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});
	});
});

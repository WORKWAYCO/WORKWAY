/**
 * Follow Up Boss Integration Tests
 *
 * Tests for constructor validation, lead operations, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FollowUpBoss } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('FollowUpBoss constructor', () => {
	it('should require API key', () => {
		expect(() => new FollowUpBoss({
			apiKey: '',
			systemName: 'TestSystem',
			systemKey: 'test-key',
		})).toThrow();
	});

	it('should require system name', () => {
		expect(() => new FollowUpBoss({
			apiKey: 'fka_test',
			systemName: '',
			systemKey: 'test-key',
		})).toThrow();
	});

	it('should require system key', () => {
		expect(() => new FollowUpBoss({
			apiKey: 'fka_test',
			systemName: 'TestSystem',
			systemKey: '',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new FollowUpBoss({
			apiKey: 'fka_test',
			systemName: 'TestSystem',
			systemKey: 'test-key',
		});
		expect(client).toBeInstanceOf(FollowUpBoss);
	});

	it('should allow custom timeout', () => {
		const client = new FollowUpBoss({
			apiKey: 'fka_test',
			systemName: 'TestSystem',
			systemKey: 'test-key',
			timeout: 5000,
		});
		expect(client).toBeInstanceOf(FollowUpBoss);
	});

	it('should allow custom API URL', () => {
		const client = new FollowUpBoss({
			apiKey: 'fka_test',
			systemName: 'TestSystem',
			systemKey: 'test-key',
			apiUrl: 'https://custom.api.com',
		});
		expect(client).toBeInstanceOf(FollowUpBoss);
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('FollowUpBoss API methods', () => {
	let client: FollowUpBoss;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new FollowUpBoss({
			apiKey: 'fka_test',
			systemName: 'TestSystem',
			systemKey: 'test-key',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('createLead', () => {
		it('should create lead on success', async () => {
			const mockLead = {
				id: 123,
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				firstName: 'John',
				lastName: 'Smith',
				stage: 'Lead',
				source: 'Website',
				contacted: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockLead,
			});

			const result = await client.createLead({
				firstName: 'John',
				lastName: 'Smith',
				emails: ['john@example.com'],
				source: 'Website',
			});

			expect(result.success).toBe(true);
			expect(result.data.id).toBe(123);
			expect(result.data.firstName).toBe('John');
		});

		it('should validate required fields', async () => {
			const result = await client.createLead({
				firstName: '',
				lastName: '',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Invalid email' }),
			});

			const result = await client.createLead({
				firstName: 'John',
				lastName: 'Smith',
				emails: ['invalid-email'],
			});

			expect(result.success).toBe(false);
		});
	});

	describe('getPerson', () => {
		it('should return person on success', async () => {
			const mockPerson = {
				id: 123,
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				firstName: 'John',
				lastName: 'Smith',
				stage: 'Active',
				source: 'Referral',
				contacted: true,
				emails: [{ value: 'john@example.com', type: 'work' }],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockPerson,
			});

			const result = await client.getPerson(123);

			expect(result.success).toBe(true);
			expect(result.data.id).toBe(123);
			expect(result.data.stage).toBe('Active');
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ error: 'Person not found' }),
			});

			const result = await client.getPerson(999);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
		});
	});

	describe('getPeople', () => {
		it('should return people list on success', async () => {
			const mockPeople = [
				{
					id: 1,
					firstName: 'John',
					lastName: 'Smith',
					stage: 'Lead',
					source: 'Website',
					contacted: false,
				},
				{
					id: 2,
					firstName: 'Jane',
					lastName: 'Doe',
					stage: 'Active',
					source: 'Referral',
					contacted: true,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ people: mockPeople }),
			});

			const result = await client.getPeople({ limit: 10 });

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ people: [] }),
			});

			const result = await client.getPeople();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('getTodaysTasks', () => {
		it('should return tasks for today', async () => {
			const mockTasks = [
				{
					id: 1,
					description: 'Call lead',
					dueDate: new Date().toISOString(),
					completed: false,
					personId: 123,
				},
				{
					id: 2,
					description: 'Send email',
					dueDate: new Date().toISOString(),
					completed: false,
					personId: 456,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ tasks: mockTasks }),
			});

			const result = await client.getTodaysTasks();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});
	});

	describe('updatePerson', () => {
		it('should update person on success', async () => {
			const mockUpdated = {
				id: 123,
				firstName: 'John',
				lastName: 'Smith',
				stage: 'Active',
				contacted: true,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockUpdated,
			});

			const result = await client.updatePerson(123, {
				stage: 'Active',
				contacted: true,
			});

			expect(result.success).toBe(true);
			expect(result.data.stage).toBe('Active');
		});

		it('should validate person ID', async () => {
			const result = await client.updatePerson(0, { stage: 'Active' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('rate limiting', () => {
		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				headers: new Headers({ 'Content-Type': 'application/json' }),
				json: async () => ({ error: 'Rate limit exceeded' }),
			});

			const result = await client.getPerson(123);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});
});

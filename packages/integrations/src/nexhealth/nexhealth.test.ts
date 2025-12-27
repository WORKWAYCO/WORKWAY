/**
 * NexHealth Integration Tests
 *
 * Tests for constructor validation, patient/appointment operations, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NexHealth } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('NexHealth constructor', () => {
	it('should require API key', () => {
		expect(() => new NexHealth({
			apiKey: '',
			subdomain: 'test-practice',
		})).toThrow();
	});

	it('should require subdomain', () => {
		expect(() => new NexHealth({
			apiKey: 'test-key',
			subdomain: '',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new NexHealth({
			apiKey: 'test-key',
			subdomain: 'test-practice',
		});
		expect(client).toBeInstanceOf(NexHealth);
	});

	it('should allow custom timeout', () => {
		const client = new NexHealth({
			apiKey: 'test-key',
			subdomain: 'test-practice',
			timeout: 5000,
		});
		expect(client).toBeInstanceOf(NexHealth);
	});

	it('should allow location ID', () => {
		const client = new NexHealth({
			apiKey: 'test-key',
			subdomain: 'test-practice',
			locationId: 'loc-123',
		});
		expect(client).toBeInstanceOf(NexHealth);
	});

	it('should allow custom API URL', () => {
		const client = new NexHealth({
			apiKey: 'test-key',
			subdomain: 'test-practice',
			apiUrl: 'https://custom.api.com',
		});
		expect(client).toBeInstanceOf(NexHealth);
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('NexHealth API methods', () => {
	let client: NexHealth;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new NexHealth({
			apiKey: 'test-key',
			subdomain: 'test-practice',
			locationId: 'loc-123',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getTodaysAppointments', () => {
		it('should return appointments on success', async () => {
			const mockAppointments = {
				data: [
					{
						id: 1,
						patient_id: 123,
						provider_id: 456,
						start_time: new Date().toISOString(),
						end_time: new Date().toISOString(),
						status: 'confirmed',
						appointment_type: 'Checkup',
					},
					{
						id: 2,
						patient_id: 124,
						provider_id: 456,
						start_time: new Date().toISOString(),
						end_time: new Date().toISOString(),
						status: 'pending',
						appointment_type: 'Cleaning',
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockAppointments,
			});

			const result = await client.getTodaysAppointments();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
			expect(result.data[0].id).toBe(1);
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
			});

			const result = await client.getTodaysAppointments();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('getPatient', () => {
		it('should return patient on success', async () => {
			const mockPatient = {
				id: 123,
				first_name: 'John',
				last_name: 'Smith',
				name: 'John Smith',
				email: 'john@example.com',
				phone: '555-555-5555',
				date_of_birth: '1990-01-01',
				inactive: false,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockPatient,
			});

			const result = await client.getPatient(123);

			expect(result.success).toBe(true);
			expect(result.data.id).toBe(123);
			expect(result.data.first_name).toBe('John');
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ error: 'Patient not found' }),
			});

			const result = await client.getPatient(999);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
		});

		it('should validate patient ID', async () => {
			const result = await client.getPatient(0);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getInactivePatients', () => {
		it('should return inactive patients', async () => {
			const mockPatients = {
				data: [
					{
						id: 123,
						first_name: 'John',
						last_name: 'Smith',
						name: 'John Smith',
						inactive: true,
						last_appointment_date: '2023-01-01',
					},
					{
						id: 124,
						first_name: 'Jane',
						last_name: 'Doe',
						name: 'Jane Doe',
						inactive: true,
						last_appointment_date: '2023-02-01',
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockPatients,
			});

			const result = await client.getInactivePatients({ monthsInactive: 6 });

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});
	});

	describe('sendAppointmentReminder', () => {
		it('should send reminder on success', async () => {
			const mockResponse = {
				success: true,
				message: 'Reminder sent',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await client.sendAppointmentReminder(123);

			expect(result.success).toBe(true);
		});

		it('should validate appointment ID', async () => {
			const result = await client.sendAppointmentReminder(0);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Appointment not eligible for reminder' }),
			});

			const result = await client.sendAppointmentReminder(123);

			expect(result.success).toBe(false);
		});
	});

	describe('createPatient', () => {
		it('should create patient on success', async () => {
			const mockPatient = {
				id: 125,
				first_name: 'New',
				last_name: 'Patient',
				name: 'New Patient',
				email: 'new@example.com',
				phone: '555-555-5555',
				inactive: false,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockPatient,
			});

			const result = await client.createPatient({
				first_name: 'New',
				last_name: 'Patient',
				email: 'new@example.com',
				phone: '555-555-5555',
			});

			expect(result.success).toBe(true);
			expect(result.data.id).toBe(125);
		});

		it('should validate required fields', async () => {
			const result = await client.createPatient({
				first_name: '',
				last_name: '',
			});

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

			const result = await client.getPatient(123);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});
});

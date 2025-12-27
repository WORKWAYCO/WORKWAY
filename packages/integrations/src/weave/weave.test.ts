/**
 * Weave Integration Tests
 *
 * Tests for constructor validation, messaging operations, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Weave } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('Weave constructor', () => {
	it('should require API key', () => {
		expect(() => new Weave({
			apiKey: '',
			locationId: 'loc-123',
		})).toThrow();
	});

	it('should require location ID', () => {
		expect(() => new Weave({
			apiKey: 'test-key',
			locationId: '',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new Weave({
			apiKey: 'test-key',
			locationId: 'loc-123',
		});
		expect(client).toBeInstanceOf(Weave);
	});

	it('should allow custom timeout', () => {
		const client = new Weave({
			apiKey: 'test-key',
			locationId: 'loc-123',
			timeout: 5000,
		});
		expect(client).toBeInstanceOf(Weave);
	});

	it('should allow custom API URL', () => {
		const client = new Weave({
			apiKey: 'test-key',
			locationId: 'loc-123',
			apiUrl: 'https://custom.api.com',
		});
		expect(client).toBeInstanceOf(Weave);
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('Weave API methods', () => {
	let client: Weave;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new Weave({
			apiKey: 'test-key',
			locationId: 'loc-123',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('sendAppointmentReminder', () => {
		it('should send reminder on success', async () => {
			const mockMessage = {
				id: 'msg-123',
				location_id: 'loc-123',
				thread_id: 'thread-456',
				direction: 'outbound',
				body: 'Reminder: Your appointment is tomorrow at 10:00 AM',
				status: 'sent',
				phone_number: '+15551234567',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockMessage,
			});

			const result = await client.sendAppointmentReminder({
				patientPhone: '+15551234567',
				patientName: 'John',
				appointmentTime: '2024-01-15T10:00:00Z',
				practiceName: 'Smile Dental',
			});

			expect(result.success).toBe(true);
			expect(result.data.id).toBe('msg-123');
			expect(result.data.status).toBe('sent');
		});

		it('should validate required fields', async () => {
			const result = await client.sendAppointmentReminder({
				patientPhone: '',
				patientName: '',
				appointmentTime: '',
				practiceName: '',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Invalid phone number format' }),
			});

			const result = await client.sendAppointmentReminder({
				patientPhone: 'invalid',
				patientName: 'John',
				appointmentTime: '2024-01-15T10:00:00Z',
				practiceName: 'Smile Dental',
			});

			expect(result.success).toBe(false);
		});
	});

	describe('requestReview', () => {
		it('should request review on success', async () => {
			const mockMessage = {
				id: 'msg-124',
				location_id: 'loc-123',
				thread_id: 'thread-457',
				direction: 'outbound',
				body: 'Thanks for visiting! Please leave us a review',
				status: 'sent',
				phone_number: '+15551234567',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockMessage,
			});

			const result = await client.requestReview({
				patientPhone: '+15551234567',
				patientName: 'John',
				reviewUrl: 'https://g.page/r/example',
			});

			expect(result.success).toBe(true);
			expect(result.data.id).toBe('msg-124');
		});

		it('should validate required fields', async () => {
			const result = await client.requestReview({
				patientPhone: '',
				patientName: '',
				reviewUrl: '',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('sendMessage', () => {
		it('should send message on success', async () => {
			const mockMessage = {
				id: 'msg-125',
				location_id: 'loc-123',
				thread_id: 'thread-458',
				direction: 'outbound',
				body: 'Custom message text',
				status: 'sent',
				phone_number: '+15551234567',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockMessage,
			});

			const result = await client.sendMessage({
				phoneNumber: '+15551234567',
				body: 'Custom message text',
			});

			expect(result.success).toBe(true);
			expect(result.data.body).toBe('Custom message text');
		});

		it('should validate phone number', async () => {
			const result = await client.sendMessage({
				phoneNumber: '',
				body: 'Test message',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should validate message body', async () => {
			const result = await client.sendMessage({
				phoneNumber: '+15551234567',
				body: '',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getMessages', () => {
		it('should return messages on success', async () => {
			const mockMessages = {
				data: [
					{
						id: 'msg-1',
						location_id: 'loc-123',
						thread_id: 'thread-1',
						direction: 'inbound',
						body: 'Can I reschedule?',
						status: 'received',
						phone_number: '+15551234567',
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
					{
						id: 'msg-2',
						location_id: 'loc-123',
						thread_id: 'thread-1',
						direction: 'outbound',
						body: 'Yes, what time works for you?',
						status: 'sent',
						phone_number: '+15551234567',
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockMessages,
			});

			const result = await client.getMessages({ threadId: 'thread-1' });

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
			});

			const result = await client.getMessages();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('getThreads', () => {
		it('should return threads on success', async () => {
			const mockThreads = {
				data: [
					{
						id: 'thread-1',
						location_id: 'loc-123',
						phone_number: '+15551234567',
						patient_id: 'pat-123',
						patient_name: 'John Smith',
						last_message_at: new Date().toISOString(),
						unread_count: 0,
					},
					{
						id: 'thread-2',
						location_id: 'loc-123',
						phone_number: '+15559876543',
						patient_id: 'pat-124',
						patient_name: 'Jane Doe',
						last_message_at: new Date().toISOString(),
						unread_count: 2,
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockThreads,
			});

			const result = await client.getThreads();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});
	});

	describe('getPatient', () => {
		it('should return patient on success', async () => {
			const mockPatient = {
				id: 'pat-123',
				location_id: 'loc-123',
				first_name: 'John',
				last_name: 'Smith',
				phone_number: '+15551234567',
				email: 'john@example.com',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockPatient,
			});

			const result = await client.getPatient('pat-123');

			expect(result.success).toBe(true);
			expect(result.data.id).toBe('pat-123');
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ error: 'Patient not found' }),
			});

			const result = await client.getPatient('nonexistent');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
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

			const result = await client.getPatient('pat-123');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});
});

/**
 * Calendly Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Calendly, type CalendlyWebhookEvent, type CalendlyScheduledEvent } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Calendly', () => {
	const accessToken = 'test-access-token';
	let calendly: Calendly;

	beforeEach(() => {
		vi.clearAllMocks();
		calendly = new Calendly({ accessToken });
	});

	// ==========================================================================
	// CONSTRUCTOR
	// ==========================================================================

	describe('constructor', () => {
		it('should create instance with valid config', () => {
			expect(calendly).toBeInstanceOf(Calendly);
		});

		it('should throw error without access token', () => {
			expect(() => new Calendly({ accessToken: '' })).toThrow();
		});

		it('should use default API URL', () => {
			const client = new Calendly({ accessToken });
			expect(client).toBeInstanceOf(Calendly);
		});

		it('should accept custom API URL', () => {
			const client = new Calendly({
				accessToken,
				apiUrl: 'https://custom.api.calendly.com',
			});
			expect(client).toBeInstanceOf(Calendly);
		});
	});

	// ==========================================================================
	// USERS
	// ==========================================================================

	describe('getCurrentUser', () => {
		it('should get the current user', async () => {
			const mockUser = {
				uri: 'https://api.calendly.com/users/abc123',
				name: 'Test User',
				slug: 'test-user',
				email: 'test@example.com',
				scheduling_url: 'https://calendly.com/test-user',
				timezone: 'America/New_York',
				avatar_url: null,
				created_at: '2024-01-01T00:00:00.000Z',
				updated_at: '2024-01-01T00:00:00.000Z',
				current_organization: 'https://api.calendly.com/organizations/org123',
				resource_type: 'User',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ resource: mockUser }),
			});

			const result = await calendly.getCurrentUser();

			expect(result.success).toBe(true);
			expect(result.data?.email).toBe('test@example.com');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.calendly.com/users/me',
				expect.any(Object)
			);
		});
	});

	describe('getUser', () => {
		it('should get a user by URI', async () => {
			const mockUser = {
				uri: 'https://api.calendly.com/users/abc123',
				name: 'Test User',
				email: 'test@example.com',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ resource: mockUser }),
			});

			const result = await calendly.getUser('https://api.calendly.com/users/abc123');

			expect(result.success).toBe(true);
			expect(result.data?.email).toBe('test@example.com');
		});

		it('should accept UUID directly', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ resource: { email: 'test@example.com' } }),
			});

			await calendly.getUser('abc123');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.calendly.com/users/abc123',
				expect.any(Object)
			);
		});
	});

	// ==========================================================================
	// EVENT TYPES
	// ==========================================================================

	describe('listEventTypes', () => {
		it('should list event types', async () => {
			const mockResponse = {
				collection: [
					{
						uri: 'https://api.calendly.com/event_types/type1',
						name: '30 Minute Meeting',
						active: true,
						duration: 30,
					},
					{
						uri: 'https://api.calendly.com/event_types/type2',
						name: '60 Minute Meeting',
						active: true,
						duration: 60,
					},
				],
				pagination: {
					count: 2,
					next_page: null,
					previous_page: null,
					next_page_token: null,
					previous_page_token: null,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await calendly.listEventTypes({ active: true });

			expect(result.success).toBe(true);
			expect(result.data?.collection).toHaveLength(2);
			expect(result.data?.collection[0].name).toBe('30 Minute Meeting');
		});

		it('should handle pagination parameters', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ collection: [], pagination: {} }),
			});

			await calendly.listEventTypes({
				user: 'https://api.calendly.com/users/abc',
				count: 50,
				pageToken: 'token123',
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('user='),
				expect.any(Object)
			);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('count=50'),
				expect.any(Object)
			);
		});
	});

	describe('getEventType', () => {
		it('should get an event type by URI', async () => {
			const mockEventType = {
				uri: 'https://api.calendly.com/event_types/type1',
				name: '30 Minute Meeting',
				duration: 30,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ resource: mockEventType }),
			});

			const result = await calendly.getEventType('https://api.calendly.com/event_types/type1');

			expect(result.success).toBe(true);
			expect(result.data?.name).toBe('30 Minute Meeting');
		});
	});

	// ==========================================================================
	// SCHEDULED EVENTS
	// ==========================================================================

	describe('listScheduledEvents', () => {
		it('should list scheduled events for a user', async () => {
			const mockResponse = {
				collection: [
					{
						uri: 'https://api.calendly.com/scheduled_events/event1',
						name: 'Meeting with John',
						status: 'active',
						start_time: '2024-01-15T10:00:00.000Z',
						end_time: '2024-01-15T10:30:00.000Z',
					},
				],
				pagination: {
					count: 1,
					next_page: null,
					previous_page: null,
					next_page_token: null,
					previous_page_token: null,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await calendly.listScheduledEvents({
				user: 'https://api.calendly.com/users/abc',
			});

			expect(result.success).toBe(true);
			expect(result.data?.collection).toHaveLength(1);
		});

		it('should require user or organization', async () => {
			const result = await calendly.listScheduledEvents({});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should filter by status and date range', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ collection: [], pagination: {} }),
			});

			await calendly.listScheduledEvents({
				user: 'https://api.calendly.com/users/abc',
				status: 'active',
				minStartTime: '2024-01-01T00:00:00Z',
				maxStartTime: '2024-12-31T23:59:59Z',
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('status=active'),
				expect.any(Object)
			);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('min_start_time='),
				expect.any(Object)
			);
		});
	});

	describe('getScheduledEvent', () => {
		it('should get a scheduled event by URI', async () => {
			const mockEvent = {
				uri: 'https://api.calendly.com/scheduled_events/event1',
				name: 'Meeting with John',
				status: 'active',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ resource: mockEvent }),
			});

			const result = await calendly.getScheduledEvent('https://api.calendly.com/scheduled_events/event1');

			expect(result.success).toBe(true);
			expect(result.data?.name).toBe('Meeting with John');
		});
	});

	describe('cancelScheduledEvent', () => {
		it('should cancel a scheduled event', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({}),
			});

			const result = await calendly.cancelScheduledEvent(
				'https://api.calendly.com/scheduled_events/event1',
				'Meeting rescheduled'
			);

			expect(result.success).toBe(true);
			expect(result.data?.canceled).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.calendly.com/scheduled_events/event1/cancellation',
				expect.objectContaining({
					method: 'POST',
				})
			);
		});
	});

	// ==========================================================================
	// INVITEES
	// ==========================================================================

	describe('listInvitees', () => {
		it('should list invitees for an event', async () => {
			const mockResponse = {
				collection: [
					{
						uri: 'https://api.calendly.com/scheduled_events/event1/invitees/inv1',
						email: 'john@example.com',
						name: 'John Doe',
						status: 'active',
					},
				],
				pagination: {
					count: 1,
					next_page: null,
					previous_page: null,
					next_page_token: null,
					previous_page_token: null,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await calendly.listInvitees({
				eventUuid: 'event1',
			});

			expect(result.success).toBe(true);
			expect(result.data?.collection).toHaveLength(1);
			expect(result.data?.collection[0].email).toBe('john@example.com');
		});

		it('should require event UUID', async () => {
			const result = await calendly.listInvitees({ eventUuid: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getInvitee', () => {
		it('should get an invitee by URI', async () => {
			const mockInvitee = {
				uri: 'https://api.calendly.com/scheduled_events/event1/invitees/inv1',
				email: 'john@example.com',
				name: 'John Doe',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ resource: mockInvitee }),
			});

			const result = await calendly.getInvitee(
				'https://api.calendly.com/scheduled_events/event1/invitees/inv1'
			);

			expect(result.success).toBe(true);
			expect(result.data?.email).toBe('john@example.com');
		});
	});

	describe('markNoShow', () => {
		it('should mark an invitee as a no-show', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({
					resource: {
						uri: 'https://api.calendly.com/invitee_no_shows/ns1',
						created_at: '2024-01-15T11:00:00.000Z',
					},
				}),
			});

			const result = await calendly.markNoShow(
				'https://api.calendly.com/scheduled_events/event1/invitees/inv1'
			);

			expect(result.success).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.calendly.com/invitee_no_shows',
				expect.objectContaining({
					method: 'POST',
				})
			);
		});
	});

	describe('removeNoShow', () => {
		it('should remove a no-show marking', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
			});

			const result = await calendly.removeNoShow(
				'https://api.calendly.com/invitee_no_shows/ns1'
			);

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ==========================================================================
	// AVAILABLE TIMES
	// ==========================================================================

	describe('getAvailableTimes', () => {
		it('should get available times for an event type', async () => {
			const mockResponse = {
				collection: [
					{
						status: 'available',
						invitees_remaining: 1,
						start_time: '2024-01-15T10:00:00.000Z',
						scheduling_url: 'https://calendly.com/test/30min?start_time=...',
					},
					{
						status: 'available',
						invitees_remaining: 1,
						start_time: '2024-01-15T10:30:00.000Z',
						scheduling_url: 'https://calendly.com/test/30min?start_time=...',
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await calendly.getAvailableTimes({
				eventType: 'https://api.calendly.com/event_types/type1',
				startTime: '2024-01-15T00:00:00Z',
				endTime: '2024-01-16T00:00:00Z',
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
		});

		it('should require event type', async () => {
			const result = await calendly.getAvailableTimes({
				eventType: '',
				startTime: '2024-01-15T00:00:00Z',
				endTime: '2024-01-16T00:00:00Z',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	describe('listWebhooks', () => {
		it('should list webhook subscriptions', async () => {
			const mockResponse = {
				collection: [
					{
						uri: 'https://api.calendly.com/webhook_subscriptions/wh1',
						callback_url: 'https://example.com/webhook',
						state: 'active',
						events: ['invitee.created', 'invitee.canceled'],
					},
				],
				pagination: {
					count: 1,
					next_page: null,
					previous_page: null,
					next_page_token: null,
					previous_page_token: null,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await calendly.listWebhooks({
				organization: 'https://api.calendly.com/organizations/org1',
				scope: 'organization',
			});

			expect(result.success).toBe(true);
			expect(result.data?.collection).toHaveLength(1);
		});
	});

	describe('createWebhook', () => {
		it('should create a webhook subscription', async () => {
			const mockWebhook = {
				uri: 'https://api.calendly.com/webhook_subscriptions/wh1',
				callback_url: 'https://example.com/webhook',
				state: 'active',
				events: ['invitee.created'],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: () => Promise.resolve({ resource: mockWebhook }),
			});

			const result = await calendly.createWebhook({
				url: 'https://example.com/webhook',
				events: ['invitee.created'],
				organization: 'https://api.calendly.com/organizations/org1',
				scope: 'organization',
			});

			expect(result.success).toBe(true);
			expect(result.data?.callback_url).toBe('https://example.com/webhook');
		});

		it('should require URL', async () => {
			const result = await calendly.createWebhook({
				url: '',
				events: ['invitee.created'],
				organization: 'https://api.calendly.com/organizations/org1',
				scope: 'organization',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should require events', async () => {
			const result = await calendly.createWebhook({
				url: 'https://example.com/webhook',
				events: [],
				organization: 'https://api.calendly.com/organizations/org1',
				scope: 'organization',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('deleteWebhook', () => {
		it('should delete a webhook subscription', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
			});

			const result = await calendly.deleteWebhook(
				'https://api.calendly.com/webhook_subscriptions/wh1'
			);

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ==========================================================================
	// WEBHOOK VERIFICATION
	// ==========================================================================

	describe('verifyWebhook', () => {
		const signingKey = 'test-signing-key';

		it('should require payload', async () => {
			const result = await calendly.verifyWebhook('', 't=123,v1=abc', signingKey);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
		});

		it('should require signature', async () => {
			const result = await calendly.verifyWebhook('{}', '', signingKey);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
		});

		it('should require signing key', async () => {
			const result = await calendly.verifyWebhook('{}', 't=123,v1=abc', '');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
		});

		it('should reject invalid signature format', async () => {
			const result = await calendly.verifyWebhook('{}', 'invalid', signingKey);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
		});

		it('should reject old timestamps', async () => {
			const oldTimestamp = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
			const result = await calendly.verifyWebhook(
				'{}',
				`t=${oldTimestamp},v1=abc`,
				signingKey
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.AUTH_INVALID);
			expect(result.error?.message).toContain('too old');
		});
	});

	describe('parseWebhookUnsafe', () => {
		it('should parse valid webhook payload', () => {
			const payload = JSON.stringify({
				event: 'invitee.created',
				created_at: '2024-01-15T10:00:00.000Z',
				created_by: 'https://api.calendly.com/users/user1',
				payload: {
					email: 'john@example.com',
					name: 'John Doe',
				},
			});

			const result = calendly.parseWebhookUnsafe(payload);

			expect(result.success).toBe(true);
			expect(result.data?.event).toBe('invitee.created');
			expect(result.data?.payload.email).toBe('john@example.com');
		});

		it('should reject invalid JSON', () => {
			const result = calendly.parseWebhookUnsafe('invalid json');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
		});
	});

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	describe('extractMeetingDetails', () => {
		it('should extract meeting details from webhook event', () => {
			const event: CalendlyWebhookEvent = {
				event: 'invitee.created',
				created_at: '2024-01-15T10:00:00.000Z',
				created_by: 'https://api.calendly.com/users/user1',
				payload: {
					email: 'john@example.com',
					name: 'John Doe',
					first_name: 'John',
					last_name: 'Doe',
					status: 'active',
					timezone: 'America/New_York',
					cancel_url: 'https://calendly.com/cancel/...',
					reschedule_url: 'https://calendly.com/reschedule/...',
					questions_and_answers: [
						{ question: 'What is your role?', answer: 'Engineer', position: 0 },
						{ question: 'Company', answer: 'Acme Inc', position: 1 },
					],
					scheduled_event: {
						uri: 'https://api.calendly.com/scheduled_events/event1',
						name: '30 Minute Meeting',
						status: 'active',
						start_time: '2024-01-15T14:00:00.000Z',
						end_time: '2024-01-15T14:30:00.000Z',
						location: {
							type: 'zoom',
							join_url: 'https://zoom.us/j/123',
						},
					} as CalendlyScheduledEvent,
				},
			};

			const details = Calendly.extractMeetingDetails(event);

			expect(details.eventType).toBe('invitee.created');
			expect(details.inviteeName).toBe('John Doe');
			expect(details.inviteeEmail).toBe('john@example.com');
			expect(details.eventName).toBe('30 Minute Meeting');
			expect(details.startTime).toBe('2024-01-15T14:00:00.000Z');
			expect(details.joinUrl).toBe('https://zoom.us/j/123');
			expect(details.questionsAndAnswers['What is your role?']).toBe('Engineer');
			expect(details.isCanceled).toBe(false);
		});

		it('should detect canceled events', () => {
			const event: CalendlyWebhookEvent = {
				event: 'invitee.canceled',
				created_at: '2024-01-15T10:00:00.000Z',
				created_by: 'https://api.calendly.com/users/user1',
				payload: {
					email: 'john@example.com',
					name: 'John Doe',
					status: 'canceled',
					cancellation: {
						canceled_by: 'john@example.com',
						reason: 'Schedule conflict',
						canceler_type: 'invitee',
						created_at: '2024-01-15T09:00:00.000Z',
					},
				},
			};

			const details = Calendly.extractMeetingDetails(event);

			expect(details.isCanceled).toBe(true);
			expect(details.cancellationReason).toBe('Schedule conflict');
		});
	});

	describe('formatMeetingTime', () => {
		it('should format meeting time', () => {
			const formatted = Calendly.formatMeetingTime(
				'2024-01-15T14:00:00.000Z',
				'2024-01-15T14:30:00.000Z',
				'America/New_York'
			);

			expect(formatted).toContain('Monday');
			expect(formatted).toContain('January');
			expect(formatted).toContain('15');
			expect(formatted).toContain('2024');
		});
	});

	// ==========================================================================
	// ERROR HANDLING
	// ==========================================================================

	describe('error handling', () => {
		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: () => Promise.resolve('Invalid token'),
			});

			const result = await calendly.getCurrentUser();

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await calendly.getCurrentUser();

			expect(result.success).toBe(false);
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				text: () => Promise.resolve('Rate limited'),
			});

			const result = await calendly.listEventTypes();

			expect(result.success).toBe(false);
		});
	});
});

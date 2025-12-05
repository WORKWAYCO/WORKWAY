/**
 * Typeform Integration Tests
 *
 * Tests for the Typeform forms and responses integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Typeform } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.subtle for webhook verification tests
const mockCrypto = {
	subtle: {
		importKey: vi.fn(),
		sign: vi.fn(),
	},
};

describe('Typeform Constructor', () => {
	it('should require access token', () => {
		expect(() => new Typeform({ accessToken: '' })).toThrow(
			'typeform access token is required'
		);
	});

	it('should create instance with valid token', () => {
		const typeform = new Typeform({ accessToken: 'test-token' });
		expect(typeform).toBeInstanceOf(Typeform);
	});

	it('should allow custom API URL for EU data center', () => {
		const typeform = new Typeform({
			accessToken: 'test-token',
			apiUrl: 'https://api.eu.typeform.com',
		});
		expect(typeform).toBeInstanceOf(Typeform);
	});
});

describe('Typeform Forms', () => {
	let typeform: Typeform;

	beforeEach(() => {
		typeform = new Typeform({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should list forms', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				items: [
					{
						id: 'form-123',
						title: 'Customer Feedback',
						type: 'form',
						created_at: '2024-01-01T00:00:00Z',
						last_updated_at: '2024-01-02T00:00:00Z',
						_links: { display: 'https://form.typeform.com/to/form-123' },
					},
					{
						id: 'form-456',
						title: 'Job Application',
						type: 'form',
						created_at: '2024-01-01T00:00:00Z',
						last_updated_at: '2024-01-02T00:00:00Z',
						_links: { display: 'https://form.typeform.com/to/form-456' },
					},
				],
			}),
		});

		const result = await typeform.listForms();

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
		expect(result.data[0].title).toBe('Customer Feedback');
		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.typeform.com/forms',
			expect.any(Object)
		);
	});

	it('should list forms with search filter', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				items: [
					{
						id: 'form-123',
						title: 'Customer Feedback',
						type: 'form',
						created_at: '2024-01-01T00:00:00Z',
						last_updated_at: '2024-01-02T00:00:00Z',
						_links: { display: 'https://form.typeform.com/to/form-123' },
					},
				],
			}),
		});

		const result = await typeform.listForms({ search: 'feedback' });

		expect(result.success).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('search=feedback'),
			expect.any(Object)
		);
	});

	it('should get form by ID', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'form-123',
				title: 'Customer Feedback',
				type: 'form',
				fields: [
					{
						id: 'field-1',
						ref: 'name_field',
						title: 'What is your name?',
						type: 'short_text',
					},
					{
						id: 'field-2',
						ref: 'rating_field',
						title: 'How would you rate our service?',
						type: 'rating',
					},
				],
				created_at: '2024-01-01T00:00:00Z',
				last_updated_at: '2024-01-02T00:00:00Z',
				_links: { display: 'https://form.typeform.com/to/form-123' },
			}),
		});

		const result = await typeform.getForm('form-123');

		expect(result.success).toBe(true);
		expect(result.data.id).toBe('form-123');
		expect(result.data.fields).toHaveLength(2);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.typeform.com/forms/form-123',
			expect.any(Object)
		);
	});
});

describe('Typeform Responses', () => {
	let typeform: Typeform;

	beforeEach(() => {
		typeform = new Typeform({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should get responses for a form', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				total_items: 2,
				page_count: 1,
				items: [
					{
						response_id: 'resp-1',
						token: 'resp-1',
						landed_at: '2024-01-01T10:00:00Z',
						submitted_at: '2024-01-01T10:05:00Z',
						metadata: {
							user_agent: 'Mozilla/5.0',
							platform: 'desktop',
							referer: 'https://example.com',
						},
						answers: [
							{
								field: { id: 'field-1', ref: 'name_field', type: 'short_text' },
								type: 'text',
								text: 'John Doe',
							},
							{
								field: { id: 'field-2', ref: 'rating_field', type: 'rating' },
								type: 'number',
								number: 5,
							},
						],
					},
				],
			}),
		});

		const result = await typeform.getResponses({ formId: 'form-123' });

		expect(result.success).toBe(true);
		expect(result.data.total_items).toBe(2);
		expect(result.data.items).toHaveLength(1);
		expect(result.data.items[0].answers).toHaveLength(2);
	});

	it('should filter responses by date range', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				total_items: 1,
				page_count: 1,
				items: [],
			}),
		});

		await typeform.getResponses({
			formId: 'form-123',
			since: '2024-01-01T00:00:00Z',
			until: '2024-01-31T23:59:59Z',
		});

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringMatching(/since=.*&until=/),
			expect.any(Object)
		);
	});

	it('should require form ID', async () => {
		const result = await typeform.getResponses({ formId: '' });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});

	it('should delete responses', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204,
			json: async () => ({}),
		});

		const result = await typeform.deleteResponses('form-123', [
			'resp-1',
			'resp-2',
		]);

		expect(result.success).toBe(true);
		expect(result.data.deleted).toBe(true);
	});

	it('should require response IDs for deletion', async () => {
		const result = await typeform.deleteResponses('form-123', []);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});
});

describe('Typeform Webhooks', () => {
	let typeform: Typeform;

	beforeEach(() => {
		typeform = new Typeform({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should list webhooks for a form', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				items: [
					{
						id: 'webhook-1',
						form_id: 'form-123',
						tag: 'workway-integration',
						url: 'https://workway.example.com/webhook',
						enabled: true,
						created_at: '2024-01-01T00:00:00Z',
						updated_at: '2024-01-01T00:00:00Z',
					},
				],
			}),
		});

		const result = await typeform.listWebhooks('form-123');

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].tag).toBe('workway-integration');
	});

	it('should create webhook', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'webhook-1',
				form_id: 'form-123',
				tag: 'workway-integration',
				url: 'https://workway.example.com/webhook',
				enabled: true,
				secret: 'my-secret',
				verify_ssl: true,
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z',
			}),
		});

		const result = await typeform.createWebhook({
			formId: 'form-123',
			tag: 'workway-integration',
			url: 'https://workway.example.com/webhook',
			secret: 'my-secret',
		});

		expect(result.success).toBe(true);
		expect(result.data.tag).toBe('workway-integration');
		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.typeform.com/forms/form-123/webhooks/workway-integration',
			expect.objectContaining({
				method: 'PUT',
			})
		);
	});

	it('should require form ID for webhook creation', async () => {
		const result = await typeform.createWebhook({
			formId: '',
			tag: 'test',
			url: 'https://example.com',
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});

	it('should require tag for webhook creation', async () => {
		const result = await typeform.createWebhook({
			formId: 'form-123',
			tag: '',
			url: 'https://example.com',
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});

	it('should require URL for webhook creation', async () => {
		const result = await typeform.createWebhook({
			formId: 'form-123',
			tag: 'test',
			url: '',
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});

	it('should delete webhook', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204,
			json: async () => ({}),
		});

		const result = await typeform.deleteWebhook('form-123', 'workway-integration');

		expect(result.success).toBe(true);
		expect(result.data.deleted).toBe(true);
	});
});

describe('Typeform Workspaces', () => {
	let typeform: Typeform;

	beforeEach(() => {
		typeform = new Typeform({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should list workspaces', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				items: [
					{
						id: 'workspace-1',
						name: 'My Workspace',
						default: true,
						shared: false,
						forms: { count: 5, href: 'https://api.typeform.com/...' },
						self: { href: 'https://api.typeform.com/...' },
					},
				],
			}),
		});

		const result = await typeform.listWorkspaces();

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].name).toBe('My Workspace');
	});
});

describe('Typeform Webhook Verification', () => {
	let typeform: Typeform;

	beforeEach(() => {
		typeform = new Typeform({ accessToken: 'test-token' });
	});

	it('should reject invalid signature format', async () => {
		const result = await typeform.verifyWebhook(
			'{"event_type": "form_response"}',
			'invalid-signature',
			'secret'
		);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('auth_invalid');
		expect(result.error?.message).toContain('Invalid signature format');
	});

	it('should reject missing payload', async () => {
		const result = await typeform.verifyWebhook('', 'sha256=abc', 'secret');

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('validation_error');
	});

	it('should reject missing signature', async () => {
		const result = await typeform.verifyWebhook(
			'{"event_type": "form_response"}',
			'',
			'secret'
		);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('validation_error');
	});

	it('should reject missing secret', async () => {
		const result = await typeform.verifyWebhook(
			'{"event_type": "form_response"}',
			'sha256=abc',
			''
		);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('validation_error');
	});

	it('should parse webhook without verification (unsafe)', () => {
		const payload = JSON.stringify({
			event_id: 'event-123',
			event_type: 'form_response',
			form_response: {
				form_id: 'form-123',
				token: 'resp-123',
				landed_at: '2024-01-01T10:00:00Z',
				submitted_at: '2024-01-01T10:05:00Z',
				definition: {
					id: 'form-123',
					title: 'Test Form',
					fields: [],
				},
				answers: [
					{
						field: { id: 'field-1', ref: 'email_field', type: 'email' },
						type: 'email',
						email: 'test@example.com',
					},
				],
			},
		});

		const result = typeform.parseWebhookUnsafe(payload);

		expect(result.success).toBe(true);
		expect(result.data.event_type).toBe('form_response');
		expect(result.data.form_response.answers[0].email).toBe('test@example.com');
	});

	it('should reject invalid JSON in unsafe parse', () => {
		const result = typeform.parseWebhookUnsafe('not valid json');

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('validation_error');
	});
});

describe('Typeform Helper Methods', () => {
	it('should extract answers as key-value object', () => {
		const response = {
			response_id: 'resp-1',
			token: 'resp-1',
			landed_at: '2024-01-01T10:00:00Z',
			submitted_at: '2024-01-01T10:05:00Z',
			metadata: {
				user_agent: 'Mozilla/5.0',
				platform: 'desktop' as const,
				referer: 'https://example.com',
			},
			answers: [
				{
					field: { id: 'f1', ref: 'name', type: 'short_text' as const },
					type: 'text' as const,
					text: 'John Doe',
				},
				{
					field: { id: 'f2', ref: 'email', type: 'email' as const },
					type: 'email' as const,
					email: 'john@example.com',
				},
				{
					field: { id: 'f3', ref: 'rating', type: 'rating' as const },
					type: 'number' as const,
					number: 5,
				},
				{
					field: { id: 'f4', ref: 'subscribe', type: 'yes_no' as const },
					type: 'boolean' as const,
					boolean: true,
				},
				{
					field: { id: 'f5', ref: 'color', type: 'multiple_choice' as const },
					type: 'choice' as const,
					choice: { label: 'Blue', id: 'c1' },
				},
			],
			hidden: {
				source: 'landing_page',
			},
			calculated: {
				score: 85,
			},
		};

		const extracted = Typeform.extractAnswers(response);

		expect(extracted.name).toBe('John Doe');
		expect(extracted.email).toBe('john@example.com');
		expect(extracted.rating).toBe(5);
		expect(extracted.subscribe).toBe(true);
		expect(extracted.color).toBe('Blue');
		expect(extracted.hidden_source).toBe('landing_page');
		expect(extracted._score).toBe(85);
	});

	it('should get specific answer by field ref', () => {
		const response = {
			response_id: 'resp-1',
			token: 'resp-1',
			landed_at: '2024-01-01T10:00:00Z',
			submitted_at: '2024-01-01T10:05:00Z',
			metadata: {
				user_agent: 'Mozilla/5.0',
				platform: 'desktop' as const,
				referer: 'https://example.com',
			},
			answers: [
				{
					field: { id: 'f1', ref: 'email_field', type: 'email' as const },
					type: 'email' as const,
					email: 'test@example.com',
				},
			],
		};

		const answer = Typeform.getAnswer(response, 'email_field');

		expect(answer).toBeDefined();
		expect(answer?.email).toBe('test@example.com');
	});

	it('should return undefined for non-existent answer', () => {
		const response = {
			response_id: 'resp-1',
			token: 'resp-1',
			landed_at: '2024-01-01T10:00:00Z',
			submitted_at: '2024-01-01T10:05:00Z',
			metadata: {
				user_agent: 'Mozilla/5.0',
				platform: 'desktop' as const,
				referer: 'https://example.com',
			},
			answers: [],
		};

		const answer = Typeform.getAnswer(response, 'nonexistent');

		expect(answer).toBeUndefined();
	});
});

describe('Typeform Error Handling', () => {
	let typeform: Typeform;

	beforeEach(() => {
		typeform = new Typeform({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should handle authentication error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			json: async () => ({ message: 'Invalid token' }),
		});

		const result = await typeform.listForms();

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('auth_expired');
	});

	it('should handle rate limit error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 429,
			statusText: 'Too Many Requests',
			json: async () => ({ message: 'Rate limit exceeded' }),
		});

		const result = await typeform.listForms();

		expect(result.success).toBe(false);
	});

	it('should handle not found error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: 'Not Found',
			json: async () => ({ message: 'Form not found' }),
		});

		const result = await typeform.getForm('nonexistent-form');

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('not_found');
	});

	it('should handle server error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			json: async () => ({ message: 'Server error' }),
		});

		const result = await typeform.listForms();

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('provider_down');
	});

	it('should handle network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await typeform.listForms();

		expect(result.success).toBe(false);
	});
});

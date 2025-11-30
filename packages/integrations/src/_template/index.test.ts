/**
 * [SERVICE_NAME] Integration Tests
 *
 * Template for testing integrations. Focus areas:
 * - Webhook signature verification (security-critical)
 * - Error handling and ActionResult structure
 * - Constructor validation
 *
 * Run with: pnpm test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceName } from './index.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Generate a valid webhook signature
 * Adjust this based on the service's signature format
 */
async function generateSignature(
	payload: string,
	secret: string,
	timestamp?: number
): Promise<string> {
	const ts = timestamp ?? Math.floor(Date.now() / 1000);
	const signedPayload = `${ts}.${payload}`;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signatureBuffer = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(signedPayload)
	);

	const signature = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return `t=${ts},v1=${signature}`;
}

/**
 * Create a mock webhook event payload
 */
function createMockEvent(
	overrides: Partial<{ id: string; type: string; data: unknown }> = {}
): string {
	return JSON.stringify({
		id: overrides.id ?? 'evt_test_123',
		type: overrides.type ?? 'resource.created',
		data: overrides.data ?? { id: 'res_123', name: 'Test' },
		created: Math.floor(Date.now() / 1000),
	});
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ServiceName constructor', () => {
	it('should require API key', () => {
		expect(() => new ServiceName({ apiKey: '' })).toThrow();
	});

	it('should accept valid config', () => {
		const client = new ServiceName({ apiKey: 'test_key' });
		expect(client).toBeInstanceOf(ServiceName);
	});

	it('should allow custom timeout', () => {
		const client = new ServiceName({ apiKey: 'test_key', timeout: 5000 });
		expect(client).toBeInstanceOf(ServiceName);
	});

	it('should allow custom API URL', () => {
		const client = new ServiceName({
			apiKey: 'test_key',
			apiUrl: 'https://custom.api.com',
		});
		expect(client).toBeInstanceOf(ServiceName);
	});
});

// ============================================================================
// WEBHOOK VERIFICATION TESTS
// ============================================================================

describe('ServiceName.parseWebhookEvent', () => {
	const webhookSecret = 'whsec_test_secret_key_12345';
	let client: ServiceName;

	beforeEach(() => {
		client = new ServiceName({ apiKey: 'test_key' });
	});

	describe('valid signatures', () => {
		it('should verify and parse a valid webhook event', async () => {
			const payload = createMockEvent();
			const signature = await generateSignature(payload, webhookSecret);

			const result = await client.parseWebhookEvent(
				payload,
				signature,
				webhookSecret
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
		});

		it('should handle different event types', async () => {
			const eventTypes = [
				'resource.created',
				'resource.updated',
				'resource.deleted',
			];

			for (const type of eventTypes) {
				const payload = createMockEvent({ type });
				const signature = await generateSignature(payload, webhookSecret);

				const result = await client.parseWebhookEvent(
					payload,
					signature,
					webhookSecret
				);

				expect(result.success).toBe(true);
			}
		});

		it('should include correct metadata in result', async () => {
			const payload = createMockEvent();
			const signature = await generateSignature(payload, webhookSecret);

			const result = await client.parseWebhookEvent(
				payload,
				signature,
				webhookSecret
			);

			expect(result.metadata.source.integration).toBe('service-name');
			expect(result.metadata.source.action).toBe('parse-webhook');
			expect(result.metadata.schema).toBe('service-name.webhook-event.v1');
		});
	});

	describe('invalid signatures', () => {
		it('should reject malformed signature header', async () => {
			const payload = createMockEvent();
			const invalidSignature = 'invalid_format';

			const result = await client.parseWebhookEvent(
				payload,
				invalidSignature,
				webhookSecret
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid signature format');
		});

		it('should reject empty signature', async () => {
			const payload = createMockEvent();

			const result = await client.parseWebhookEvent(payload, '', webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid signature format');
		});

		it('should reject wrong secret', async () => {
			const payload = createMockEvent();
			const signature = await generateSignature(payload, webhookSecret);
			const wrongSecret = 'whsec_wrong_secret';

			const result = await client.parseWebhookEvent(
				payload,
				signature,
				wrongSecret
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid webhook signature');
		});

		it('should reject tampered payload', async () => {
			const originalPayload = createMockEvent({ id: 'evt_original' });
			const signature = await generateSignature(originalPayload, webhookSecret);
			const tamperedPayload = createMockEvent({ id: 'evt_tampered' });

			const result = await client.parseWebhookEvent(
				tamperedPayload,
				signature,
				webhookSecret
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid webhook signature');
		});
	});

	describe('timestamp validation', () => {
		it('should reject expired timestamps (> 5 minutes old)', async () => {
			const payload = createMockEvent();
			const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
			const signature = await generateSignature(
				payload,
				webhookSecret,
				oldTimestamp
			);

			const result = await client.parseWebhookEvent(
				payload,
				signature,
				webhookSecret
			);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('timestamp too old');
		});

		it('should accept timestamps within 5 minute window', async () => {
			const payload = createMockEvent();
			const recentTimestamp = Math.floor(Date.now() / 1000) - 120; // 2 min ago
			const signature = await generateSignature(
				payload,
				webhookSecret,
				recentTimestamp
			);

			const result = await client.parseWebhookEvent(
				payload,
				signature,
				webhookSecret
			);

			expect(result.success).toBe(true);
		});
	});

	describe('payload parsing', () => {
		it('should handle invalid JSON payload', async () => {
			const invalidPayload = 'not valid json {{{';
			const signature = await generateSignature(invalidPayload, webhookSecret);

			const result = await client.parseWebhookEvent(
				invalidPayload,
				signature,
				webhookSecret
			);

			// Should fail during JSON.parse
			expect(result.success).toBe(false);
		});

		it('should preserve all event fields', async () => {
			const customData = { id: 'custom_123', extra: 'field' };
			const payload = createMockEvent({
				id: 'evt_custom',
				type: 'custom.event',
				data: customData,
			});
			const signature = await generateSignature(payload, webhookSecret);

			const result = await client.parseWebhookEvent(
				payload,
				signature,
				webhookSecret
			);

			expect(result.success).toBe(true);
			expect(result.data.type).toBe('custom.event');
		});
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('ServiceName API methods', () => {
	let client: ServiceName;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new ServiceName({ apiKey: 'test_key' });
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getResource', () => {
		it('should return resource on success', async () => {
			const mockResource = { id: 'res_123', name: 'Test' };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResource,
			});

			const result = await client.getResource('res_123');

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockResource);
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ error: { message: 'Not found' } }),
			});

			const result = await client.getResource('nonexistent');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('not_found');
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				json: async () => ({ error: { message: 'Rate limited' } }),
			});

			const result = await client.getResource('res_123');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('rate_limited');
		});
	});

	describe('createResource', () => {
		it('should validate required fields', async () => {
			const result = await client.createResource({ name: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('validation_error');
		});

		it('should create resource on success', async () => {
			const mockResource = { id: 'res_new', name: 'New Resource' };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResource,
			});

			const result = await client.createResource({ name: 'New Resource' });

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockResource);
		});
	});
});

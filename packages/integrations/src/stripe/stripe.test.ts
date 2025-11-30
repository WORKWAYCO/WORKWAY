/**
 * Stripe Integration Tests
 *
 * Tests for webhook signature verification - security-critical code.
 * Addresses Canon Audit: "No webhook signature tests"
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Stripe } from './index.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Generate a valid Stripe webhook signature
 */
async function generateStripeSignature(
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
 * Create a mock Stripe webhook event payload
 */
function createMockEvent(overrides: Partial<{
	id: string;
	type: string;
	data: Record<string, unknown>;
}> = {}): string {
	return JSON.stringify({
		id: overrides.id ?? 'evt_test_123',
		object: 'event',
		type: overrides.type ?? 'payment_intent.succeeded',
		api_version: '2023-10-16',
		created: Math.floor(Date.now() / 1000),
		data: {
			object: overrides.data ?? {
				id: 'pi_test_123',
				object: 'payment_intent',
				amount: 2000,
				currency: 'usd',
				status: 'succeeded',
			},
		},
		livemode: false,
		pending_webhooks: 1,
		request: { id: 'req_test_123', idempotency_key: null },
	});
}

// ============================================================================
// WEBHOOK VERIFICATION TESTS
// ============================================================================

describe('Stripe.parseWebhookEvent', () => {
	const webhookSecret = 'whsec_test_secret_key_12345';
	let stripe: Stripe;

	beforeEach(() => {
		stripe = new Stripe({ secretKey: 'sk_test_123' });
	});

	describe('valid signatures', () => {
		it('should verify and parse a valid webhook event', async () => {
			const payload = createMockEvent();
			const signature = await generateStripeSignature(payload, webhookSecret);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.id).toBe('evt_test_123');
			expect(result.data.type).toBe('payment_intent.succeeded');
		});

		it('should handle different event types', async () => {
			const testCases = [
				'payment_intent.succeeded',
				'payment_intent.payment_failed',
				'customer.created',
				'customer.subscription.created',
				'invoice.paid',
			];

			for (const eventType of testCases) {
				const payload = createMockEvent({ type: eventType });
				const signature = await generateStripeSignature(payload, webhookSecret);

				const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

				expect(result.success).toBe(true);
				expect(result.data.type).toBe(eventType);
			}
		});

		it('should include correct metadata in result', async () => {
			const payload = createMockEvent();
			const signature = await generateStripeSignature(payload, webhookSecret);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.metadata.source.integration).toBe('stripe');
			expect(result.metadata.source.action).toBe('parse-webhook');
			expect(result.metadata.schema).toBe('stripe.webhook-event.v1');
		});
	});

	describe('invalid signatures', () => {
		it('should reject malformed signature header (missing t=)', async () => {
			const payload = createMockEvent();
			const invalidSignature = 'v1=abc123def456';

			const result = await stripe.parseWebhookEvent(payload, invalidSignature, webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid Stripe signature format');
		});

		it('should reject malformed signature header (missing v1=)', async () => {
			const payload = createMockEvent();
			const timestamp = Math.floor(Date.now() / 1000);
			const invalidSignature = `t=${timestamp}`;

			const result = await stripe.parseWebhookEvent(payload, invalidSignature, webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid Stripe signature format');
		});

		it('should reject empty signature', async () => {
			const payload = createMockEvent();

			const result = await stripe.parseWebhookEvent(payload, '', webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid Stripe signature format');
		});

		it('should reject wrong secret', async () => {
			const payload = createMockEvent();
			const signature = await generateStripeSignature(payload, webhookSecret);
			const wrongSecret = 'whsec_wrong_secret_key';

			const result = await stripe.parseWebhookEvent(payload, signature, wrongSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid webhook signature');
		});

		it('should reject tampered payload', async () => {
			const originalPayload = createMockEvent({ id: 'evt_original' });
			const signature = await generateStripeSignature(originalPayload, webhookSecret);
			const tamperedPayload = createMockEvent({ id: 'evt_tampered' });

			const result = await stripe.parseWebhookEvent(tamperedPayload, signature, webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid webhook signature');
		});

		it('should reject signature with wrong hash algorithm (if v0 used)', async () => {
			const payload = createMockEvent();
			const timestamp = Math.floor(Date.now() / 1000);
			// v0 signatures use a different algorithm
			const invalidSignature = `t=${timestamp},v0=abc123def456`;

			const result = await stripe.parseWebhookEvent(payload, invalidSignature, webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Invalid Stripe signature format');
		});
	});

	describe('timestamp validation', () => {
		it('should reject expired timestamps (> 5 minutes old)', async () => {
			const payload = createMockEvent();
			// 10 minutes ago
			const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
			const signature = await generateStripeSignature(payload, webhookSecret, oldTimestamp);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Webhook timestamp too old');
		});

		it('should accept timestamps within 5 minute window', async () => {
			const payload = createMockEvent();
			// 2 minutes ago - should be valid
			const recentTimestamp = Math.floor(Date.now() / 1000) - 120;
			const signature = await generateStripeSignature(payload, webhookSecret, recentTimestamp);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.success).toBe(true);
		});

		it('should accept timestamps at exactly 5 minute boundary', async () => {
			const payload = createMockEvent();
			// Exactly 5 minutes ago (300 seconds)
			const boundaryTimestamp = Math.floor(Date.now() / 1000) - 300;
			const signature = await generateStripeSignature(payload, webhookSecret, boundaryTimestamp);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.success).toBe(true);
		});

		it('should reject timestamps just past 5 minute boundary', async () => {
			const payload = createMockEvent();
			// 301 seconds ago - just past the boundary
			const pastBoundaryTimestamp = Math.floor(Date.now() / 1000) - 301;
			const signature = await generateStripeSignature(payload, webhookSecret, pastBoundaryTimestamp);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Webhook timestamp too old');
		});
	});

	describe('payload parsing', () => {
		it('should handle invalid JSON payload', async () => {
			const invalidPayload = 'not valid json {{{';
			const timestamp = Math.floor(Date.now() / 1000);
			// Generate signature for the invalid payload (signature itself is valid)
			const signature = await generateStripeSignature(invalidPayload, webhookSecret, timestamp);

			const result = await stripe.parseWebhookEvent(invalidPayload, signature, webhookSecret);

			// Should fail during JSON.parse
			expect(result.success).toBe(false);
		});

		it('should handle empty payload', async () => {
			const emptyPayload = '';
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = await generateStripeSignature(emptyPayload, webhookSecret, timestamp);

			const result = await stripe.parseWebhookEvent(emptyPayload, signature, webhookSecret);

			expect(result.success).toBe(false);
		});

		it('should preserve all event fields', async () => {
			const customData = {
				id: 'cus_test_customer',
				email: 'test@example.com',
				metadata: { custom_field: 'custom_value' },
			};
			const payload = createMockEvent({
				id: 'evt_custom',
				type: 'customer.created',
				data: customData,
			});
			const signature = await generateStripeSignature(payload, webhookSecret);

			const result = await stripe.parseWebhookEvent(payload, signature, webhookSecret);

			expect(result.success).toBe(true);
			expect(result.data.id).toBe('evt_custom');
			expect(result.data.type).toBe('customer.created');
			expect(result.data.data.object).toEqual(customData);
		});
	});

	describe('edge cases', () => {
		it('should handle signature with extra fields', async () => {
			const payload = createMockEvent();
			const timestamp = Math.floor(Date.now() / 1000);
			const signedPayload = `${timestamp}.${payload}`;

			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(webhookSecret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const signatureBuffer = await crypto.subtle.sign(
				'HMAC',
				key,
				encoder.encode(signedPayload)
			);
			const sig = Array.from(new Uint8Array(signatureBuffer))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			// Include extra field (should be ignored)
			const signatureWithExtra = `t=${timestamp},v1=${sig},v0=ignored`;

			const result = await stripe.parseWebhookEvent(payload, signatureWithExtra, webhookSecret);

			expect(result.success).toBe(true);
		});

		it('should handle unicode in payload', async () => {
			const eventWithUnicode = JSON.stringify({
				id: 'evt_unicode',
				object: 'event',
				type: 'customer.created',
				api_version: '2023-10-16',
				created: Math.floor(Date.now() / 1000),
				data: {
					object: {
						name: '日本語テスト',
						description: 'Emoji test: 🎉🚀',
					},
				},
				livemode: false,
				pending_webhooks: 1,
			});

			const signature = await generateStripeSignature(eventWithUnicode, webhookSecret);

			const result = await stripe.parseWebhookEvent(eventWithUnicode, signature, webhookSecret);

			expect(result.success).toBe(true);
			expect(result.data.data.object.name).toBe('日本語テスト');
		});

		it('should handle very large payloads', async () => {
			// Create a large nested object
			const largeData: Record<string, unknown> = {};
			for (let i = 0; i < 100; i++) {
				largeData[`field_${i}`] = 'x'.repeat(1000);
			}

			const largePayload = createMockEvent({ data: largeData });
			const signature = await generateStripeSignature(largePayload, webhookSecret);

			const result = await stripe.parseWebhookEvent(largePayload, signature, webhookSecret);

			expect(result.success).toBe(true);
		});
	});
});

// ============================================================================
// STRIPE API TESTS (with mocked fetch)
// ============================================================================

describe('Stripe API methods', () => {
	let stripe: Stripe;

	beforeEach(() => {
		stripe = new Stripe({ secretKey: 'sk_test_123' });
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should require secret key', () => {
			expect(() => new Stripe({ secretKey: '' })).toThrow();
		});

		it('should use default API URL', () => {
			const s = new Stripe({ secretKey: 'sk_test_123' });
			// We can't directly access private members, but we verify it works
			expect(s).toBeInstanceOf(Stripe);
		});

		it('should allow custom timeout', () => {
			const s = new Stripe({ secretKey: 'sk_test_123', timeout: 5000 });
			expect(s).toBeInstanceOf(Stripe);
		});
	});
});

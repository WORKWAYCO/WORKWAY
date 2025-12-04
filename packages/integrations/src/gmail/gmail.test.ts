/**
 * Gmail Integration Tests
 *
 * Tests for Gmail integration - validates SDK patterns:
 * - ActionResult narrow waist
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Gmail } from './index.js';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('Gmail Constructor', () => {
	it('should require access token', () => {
		expect(() => new Gmail({ accessToken: '' })).toThrow('gmail access token is required');
	});

	it('should accept valid access token', () => {
		const gmail = new Gmail({ accessToken: 'ya29.test_token' });
		expect(gmail).toBeInstanceOf(Gmail);
	});

	it('should allow custom API URL', () => {
		const gmail = new Gmail({
			accessToken: 'ya29.test_token',
			apiUrl: 'https://custom.gmail.api',
		});
		expect(gmail).toBeInstanceOf(Gmail);
	});

	it('should allow custom timeout', () => {
		const gmail = new Gmail({
			accessToken: 'ya29.test_token',
			timeout: 5000,
		});
		expect(gmail).toBeInstanceOf(Gmail);
	});
});

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Gmail.sendEmail Input Validation', () => {
	let gmail: Gmail;

	beforeEach(() => {
		gmail = new Gmail({ accessToken: 'ya29.test_token' });
	});

	it('should reject missing recipients', async () => {
		const result = await gmail.sendEmail({
			to: [],
			subject: 'Test',
			body: 'Test body',
		});

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain('At least one recipient is required');
	});

	it('should reject missing subject', async () => {
		const result = await gmail.sendEmail({
			to: ['test@example.com'],
			subject: '',
			body: 'Test body',
		});

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain('Subject is required');
	});

	it('should include correct metadata on validation errors', async () => {
		const result = await gmail.sendEmail({
			to: [],
			subject: 'Test',
			body: 'Test body',
		});

		expect(result.success).toBe(false);
		expect(result.metadata.source.integration).toBe('gmail');
		expect(result.metadata.source.action).toBe('send-email');
	});
});

// ============================================================================
// ACTION RESULT STRUCTURE TESTS
// ============================================================================

describe('Gmail ActionResult Structure', () => {
	let gmail: Gmail;

	beforeEach(() => {
		gmail = new Gmail({ accessToken: 'ya29.test_token' });
		// Mock fetch to avoid actual API calls
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ messages: [] }), { status: 200 })
		);
	});

	it('should return ActionResult with correct metadata for listEmails', async () => {
		const result = await gmail.listEmails({ maxResults: 10 });

		expect(result.success).toBe(true);
		expect(result.metadata).toBeDefined();
		expect(result.metadata.source.integration).toBe('gmail');
		expect(result.metadata.source.action).toBe('list-emails');
		expect(result.metadata.schema).toBe('gmail.email-list.v1');
	});

	it('should include capabilities in result', async () => {
		const result = await gmail.listEmails();

		expect(result.success).toBe(true);
		expect(result.capabilities).toBeDefined();
		expect(result.capabilities?.canHandleText).toBe(true);
		expect(result.capabilities?.supportsSearch).toBe(true);
		expect(result.capabilities?.supportsPagination).toBe(true);
	});

	it('should return empty array when no messages found', async () => {
		const result = await gmail.listEmails();

		expect(result.success).toBe(true);
		expect(result.data).toEqual([]);
	});
});

// ============================================================================
// OPTIONS VALIDATION TESTS
// ============================================================================

describe('Gmail.listEmails Options', () => {
	let gmail: Gmail;

	beforeEach(() => {
		gmail = new Gmail({ accessToken: 'ya29.test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ messages: [] }), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should respect maxResults limit', async () => {
		await gmail.listEmails({ maxResults: 50 });

		expect(global.fetch).toHaveBeenCalled();
		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('maxResults=50');
	});

	it('should cap maxResults at 100', async () => {
		await gmail.listEmails({ maxResults: 200 });

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('maxResults=100');
	});

	it('should include query parameter when provided', async () => {
		await gmail.listEmails({ query: 'from:test@example.com' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('q=from%3Atest%40example.com');
	});

	it('should default to INBOX label', async () => {
		await gmail.listEmails();

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('labelIds=INBOX');
	});
});

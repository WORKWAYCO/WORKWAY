/**
 * DocuSign Integration Tests
 *
 * Tests for constructor validation, envelope operations, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocuSign } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('DocuSign constructor', () => {
	it('should require access token', () => {
		expect(() => new DocuSign({
			accessToken: '',
			accountId: 'test-account',
			basePath: 'https://demo.docusign.net',
		})).toThrow();
	});

	it('should require account ID', () => {
		expect(() => new DocuSign({
			accessToken: 'test-token',
			accountId: '',
			basePath: 'https://demo.docusign.net',
		})).toThrow();
	});

	it('should require base path', () => {
		expect(() => new DocuSign({
			accessToken: 'test-token',
			accountId: 'test-account',
			basePath: '',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new DocuSign({
			accessToken: 'test-token',
			accountId: 'test-account',
			basePath: 'https://demo.docusign.net',
		});
		expect(client).toBeInstanceOf(DocuSign);
	});

	it('should allow custom timeout', () => {
		const client = new DocuSign({
			accessToken: 'test-token',
			accountId: 'test-account',
			basePath: 'https://demo.docusign.net',
			timeout: 5000,
		});
		expect(client).toBeInstanceOf(DocuSign);
	});

	it('should support token refresh config', () => {
		const client = new DocuSign({
			accessToken: 'test-token',
			accountId: 'test-account',
			basePath: 'https://demo.docusign.net',
			refreshToken: 'refresh-token',
			clientId: 'client-id',
			clientSecret: 'client-secret',
			onTokenRefreshed: vi.fn(),
		});
		expect(client).toBeInstanceOf(DocuSign);
	});
});

// ============================================================================
// API METHOD TESTS (with mocked fetch)
// ============================================================================

describe('DocuSign API methods', () => {
	let client: DocuSign;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new DocuSign({
			accessToken: 'test-token',
			accountId: 'test-account',
			basePath: 'https://demo.docusign.net',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('sendEnvelope', () => {
		it('should send envelope on success', async () => {
			const mockEnvelope = {
				envelopeId: 'env-123',
				status: 'sent',
				emailSubject: 'Test Document',
				statusChangedDateTime: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvelope,
			});

			const result = await client.sendEnvelope({
				emailSubject: 'Test Document',
				documents: [{
					name: 'test.pdf',
					content: 'base64content',
				}],
				recipients: [{
					email: 'signer@example.com',
					name: 'Test Signer',
				}],
			});

			expect(result.success).toBe(true);
			expect(result.data.envelopeId).toBe('env-123');
		});

		it('should validate required fields', async () => {
			const result = await client.sendEnvelope({
				emailSubject: '',
				documents: [],
				recipients: [],
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ message: 'Invalid document' }),
			});

			const result = await client.sendEnvelope({
				emailSubject: 'Test',
				documents: [{
					name: 'test.pdf',
					content: 'invalid',
				}],
				recipients: [{
					email: 'test@example.com',
					name: 'Test',
				}],
			});

			expect(result.success).toBe(false);
		});
	});

	describe('getEnvelope', () => {
		it('should return envelope on success', async () => {
			const mockEnvelope = {
				envelopeId: 'env-123',
				status: 'completed',
				emailSubject: 'Test Document',
				createdDateTime: new Date().toISOString(),
				statusChangedDateTime: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvelope,
			});

			const result = await client.getEnvelope('env-123');

			expect(result.success).toBe(true);
			expect(result.data.envelopeId).toBe('env-123');
		});

		it('should handle 404 errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ message: 'Envelope not found' }),
			});

			const result = await client.getEnvelope('nonexistent');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
		});
	});

	describe('listEnvelopes', () => {
		it('should return envelope list on success', async () => {
			const mockEnvelopes = {
				envelopes: [
					{
						envelopeId: 'env-1',
						status: 'sent',
						emailSubject: 'Doc 1',
						statusChangedDateTime: new Date().toISOString(),
					},
					{
						envelopeId: 'env-2',
						status: 'completed',
						emailSubject: 'Doc 2',
						statusChangedDateTime: new Date().toISOString(),
					},
				],
				totalSetSize: 2,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvelopes,
			});

			const result = await client.listEnvelopes({ status: 'any' });

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(2);
		});

		it('should handle empty results', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ envelopes: [], totalSetSize: 0 }),
			});

			const result = await client.listEnvelopes();

			expect(result.success).toBe(true);
			expect(result.data.length).toBe(0);
		});
	});

	describe('sendFromTemplate', () => {
		it('should send envelope from template', async () => {
			const mockEnvelope = {
				envelopeId: 'env-template-123',
				status: 'sent',
				emailSubject: 'From Template',
				statusChangedDateTime: new Date().toISOString(),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvelope,
			});

			const result = await client.sendFromTemplate({
				templateId: 'tpl-123',
				recipients: [{
					email: 'signer@example.com',
					name: 'Test Signer',
					roleName: 'Signer',
				}],
			});

			expect(result.success).toBe(true);
			expect(result.data.envelopeId).toBe('env-template-123');
		});

		it('should validate template ID', async () => {
			const result = await client.sendFromTemplate({
				templateId: '',
				recipients: [{
					email: 'test@example.com',
					name: 'Test',
					roleName: 'Signer',
				}],
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
				json: async () => ({ message: 'Rate limit exceeded' }),
			});

			const result = await client.getEnvelope('env-123');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});
});

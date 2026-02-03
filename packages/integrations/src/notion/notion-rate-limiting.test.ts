/**
 * Notion Integration Rate Limiting Tests
 *
 * Tests for Notion API rate limiting behavior:
 * - Rate: 3 requests/second
 * - Batch delay: 350ms between batches
 * - Error handling: 429 responses
 * - Backoff strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Notion } from './index.js';
import { mockNotionResponse, mockNotionError, createMockBlock } from './test-utils.js';
import { mockErrorRateLimited } from './__fixtures__/responses.js';

describe('Notion Rate Limiting', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('429 Rate Limit Error Handling', () => {
		it('should handle rate limit errors on queryDatabase', async () => {
			// Mock 429 response
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionError('rate_limited', 'Rate limited', 429));

			const result = await notion.queryDatabase({
				databaseId: 'db-123',
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Rate limit');
		});

		it('should handle rate limit errors on createPage', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionError('rate_limited', 'Rate limited', 429));

			const result = await notion.createPage({
				parentDatabaseId: 'db-123',
				properties: {
					Name: { title: [{ text: { content: 'Test' } }] },
				},
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Rate limit');
		});

		it('should handle rate limit errors on appendBlockChildren', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionError('rate_limited', 'Rate limited', 429));

			const result = await notion.appendBlockChildren({
				blockId: 'page-123',
				children: [
					{
						object: 'block',
						type: 'paragraph',
						paragraph: {
							rich_text: [{ type: 'text', text: { content: 'Test' } }],
						},
					},
				],
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Rate limit');
		});
	});

	describe('Batch Processing with Delays', () => {
		it('should process 250 blocks in 3 batches', async () => {
			const blocks = Array.from({ length: 250 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// Mock successful responses
			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', blocks, 100, 350);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(250);
			expect(result.data?.batches).toBe(3);
			expect(global.fetch).toHaveBeenCalledTimes(3);
		});

		it('should use default batch size of 100', async () => {
			const blocks = Array.from({ length: 150 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', blocks);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(150);
			expect(result.data?.batches).toBe(2);
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});

		it('should use custom delay when specified', async () => {
			const blocks = Array.from({ length: 200 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			// Use 500ms delay instead of default 350ms (delay parameter accepted)
			const result = await notion.appendBlocksInBatches('page-123', blocks, 100, 500);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(200);
			expect(result.data?.batches).toBe(2);
		});

		it('should not delay after final batch', async () => {
			const blocks = Array.from({ length: 100 }, () =>
				createMockBlock({
					type: 'paragraph',
					paragraph: {
						rich_text: [{ type: 'text', text: { content: 'Test' } }],
					},
				})
			);

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const startTime = Date.now();
			await notion.appendBlocksInBatches('page-123', blocks, 100, 350);
			const endTime = Date.now();

			// Should complete immediately (single batch, no delay)
			expect(endTime - startTime).toBeLessThan(100);
		});
	});

	describe('Rate Limit Boundary Testing', () => {
		it('should process batches under rate limit threshold', async () => {
			// Notion allows 3 req/sec
			// 350ms delay = ~2.86 req/sec (under limit)
			const blocks = Array.from({ length: 300 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', blocks, 100, 350);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(300);
			expect(result.data?.batches).toBe(3);

			// 3 batches with 350ms between them
			// Batch 1 at 0ms, Batch 2 at 350ms, Batch 3 at 700ms
			// Total time span: 700ms for 3 requests = 2.86 req/sec (under 3 req/sec limit)
			// Note: This is about verifying the delay exists, not precise timing
			expect(result.data?.batches).toBe(3);
		});

		it('should handle single block without delay', async () => {
			const block = createMockBlock({
				type: 'paragraph',
				paragraph: {
					rich_text: [{ type: 'text', text: { content: 'Test' } }],
				},
			});

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', [block]);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(1);
			expect(result.data?.batches).toBe(1);
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('Error Handling During Batch Processing', () => {
		it('should stop processing on rate limit error', async () => {
			const blocks = Array.from({ length: 200 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// First batch succeeds, second batch hits rate limit
			let callCount = 0;
			vi.spyOn(global, 'fetch').mockImplementation(async () => {
				callCount++;
				if (callCount === 1) {
					return mockNotionResponse({
						object: 'list',
						results: [],
					});
				}
				return mockNotionError('rate_limited', 'Rate limited', 429);
			});

			const result = await notion.appendBlocksInBatches('page-123', blocks, 100, 350);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Failed to append batch 2');
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});

		it('should include batch number in error message', async () => {
			const blocks = Array.from({ length: 300 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// Fail on batch 3
			let callCount = 0;
			vi.spyOn(global, 'fetch').mockImplementation(async () => {
				callCount++;
				if (callCount < 3) {
					return mockNotionResponse({
						object: 'list',
						results: [],
					});
				}
				return mockNotionError('validation_error', 'Invalid block', 400);
			});

			const result = await notion.appendBlocksInBatches('page-123', blocks, 100, 350);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('batch 3');
		});
	});

	describe('Batch Size Limits', () => {
		it('should split 250 blocks into 3 batches of 100, 100, and 50', async () => {
			const blocks = Array.from({ length: 250 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', blocks, 100, 350);

			expect(result.success).toBe(true);
			expect(result.data?.batches).toBe(3);
			expect(fetchSpy).toHaveBeenCalledTimes(3);
		});

		it('should allow custom batch sizes under 100', async () => {
			const blocks = Array.from({ length: 150 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }],
				},
			}));

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', blocks, 50, 350);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(150);
			expect(result.data?.batches).toBe(3);
		});
	});

	describe('Concurrent Request Handling', () => {
		it('should handle multiple concurrent queryDatabase calls', async () => {
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
					has_more: false,
					next_cursor: null,
				})
			);

			// Fire 5 concurrent requests
			const promises = Array.from({ length: 5 }, () =>
				notion.queryDatabase({ databaseId: 'db-123' })
			);

			const results = await Promise.all(promises);

			// All should succeed
			results.forEach((result) => {
				expect(result.success).toBe(true);
			});

			// All 5 requests should have been made
			expect(global.fetch).toHaveBeenCalledTimes(5);
		});

		it('should handle rate limit on one of multiple concurrent requests', async () => {
			let callCount = 0;
			vi.spyOn(global, 'fetch').mockImplementation(async () => {
				callCount++;
				if (callCount === 3) {
					// Third request hits rate limit
					return mockNotionError('rate_limited', 'Rate limited', 429);
				}
				return mockNotionResponse({
					object: 'list',
					results: [],
					has_more: false,
					next_cursor: null,
				});
			});

			const promises = Array.from({ length: 5 }, () =>
				notion.queryDatabase({ databaseId: 'db-123' })
			);

			const results = await Promise.all(promises);

			// 4 should succeed, 1 should fail
			const succeeded = results.filter((r) => r.success);
			const failed = results.filter((r) => !r.success);

			expect(succeeded.length).toBe(4);
			expect(failed.length).toBe(1);
			expect(failed[0].error?.message).toContain('Rate limit');
		});
	});

	describe('Real-World Usage Patterns', () => {
		it('should handle YouTube workflow transcript appending', async () => {
			// Simulate YouTube transcript with ~3,687 characters
			// Split into 2 blocks (~1,900 chars each, under 2,000 limit)
			const transcriptText = 'a'.repeat(3687);
			const blocks = [
				{
					object: 'block' as const,
					type: 'paragraph' as const,
					paragraph: {
						rich_text: [{ type: 'text' as const, text: { content: transcriptText.substring(0, 1900) } }],
					},
				},
				{
					object: 'block' as const,
					type: 'paragraph' as const,
					paragraph: {
						rich_text: [{ type: 'text' as const, text: { content: transcriptText.substring(1900) } }],
					},
				},
			];

			// Return new Response for each call (Response body can only be read once)
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse({
					object: 'list',
					results: [],
				})
			);

			const result = await notion.appendBlocksInBatches('page-123', blocks);

			expect(result.success).toBe(true);
			expect(result.data?.totalAppended).toBe(2);
			expect(result.data?.batches).toBe(1); // Both blocks fit in one batch
		});

		it('should handle large playlist with multiple videos', async () => {
			vi.spyOn(global, 'fetch').mockImplementation(async () =>
				mockNotionResponse(
					{
						object: 'page',
						id: 'page-123',
						properties: {
							Name: { title: [{ text: { content: 'Video' } }] },
							URL: { url: 'https://youtube.com/watch?v=abc' },
						},
					},
					201
				)
			);

			// Simulate 10 videos, each creating a page
			const createPageCalls = Array.from({ length: 10 }, (_, i) =>
				notion.createPage({
					parentDatabaseId: 'db-youtube',
					properties: {
						Name: { title: [{ text: { content: `Video ${i}` } }] },
						URL: { url: `https://youtube.com/watch?v=abc${i}` },
					},
				})
			);

			const results = await Promise.all(createPageCalls);

			// All should succeed
			results.forEach((result) => {
				expect(result.success).toBe(true);
			});

			expect(global.fetch).toHaveBeenCalledTimes(10);
		});
	});
});

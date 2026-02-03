/**
 * Notion Integration Test Utilities
 *
 * Helper functions for creating mock data and responses in tests.
 * Follows the pattern from the test guide: fixtures + utilities.
 */

import { mockPage, mockDatabase, mockBlock } from './__fixtures__/responses.js';

/**
 * Create a mock Notion page with optional overrides
 *
 * Usage:
 * ```typescript
 * const page = createMockPage({
 *   properties: {
 *     Name: { title: [{ text: { content: 'Custom Title' } }] }
 *   }
 * });
 * ```
 */
export function createMockPage(overrides: Partial<typeof mockPage> = {}) {
	return {
		...mockPage,
		id: `page-${Math.random().toString(36).substr(2, 9)}`,
		created_time: new Date().toISOString(),
		last_edited_time: new Date().toISOString(),
		...overrides,
	};
}

/**
 * Create a mock Notion database with optional overrides
 */
export function createMockDatabase(overrides: Partial<typeof mockDatabase> = {}) {
	return {
		...mockDatabase,
		id: `db-${Math.random().toString(36).substr(2, 9)}`,
		created_time: new Date().toISOString(),
		last_edited_time: new Date().toISOString(),
		...overrides,
	};
}

/**
 * Create a mock Notion block with optional overrides
 */
export function createMockBlock(overrides: Partial<typeof mockBlock> = {}) {
	return {
		...mockBlock,
		id: `block-${Math.random().toString(36).substr(2, 9)}`,
		created_time: new Date().toISOString(),
		last_edited_time: new Date().toISOString(),
		...overrides,
	};
}

/**
 * Create a mock Notion API response (for fetch mocking)
 *
 * Usage:
 * ```typescript
 * vi.spyOn(global, 'fetch').mockResolvedValue(
 *   mockNotionResponse({ object: 'page', id: 'test-123' })
 * );
 * ```
 */
export function mockNotionResponse(data: any, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Notion-Version': '2022-06-28',
			...headers,
		},
	});
}

/**
 * Create a mock Notion error response
 *
 * Usage:
 * ```typescript
 * vi.spyOn(global, 'fetch').mockResolvedValue(
 *   mockNotionError('validation_error', 'Invalid properties', 400)
 * );
 * ```
 */
export function mockNotionError(
	code: string,
	message: string,
	status = 400,
	headers: Record<string, string> = {}
) {
	return mockNotionResponse(
		{
			object: 'error',
			status,
			code,
			message,
		},
		status,
		headers
	);
}

/**
 * Create a mock query response with custom results
 *
 * Usage:
 * ```typescript
 * const response = mockQueryResponse([page1, page2], 'cursor-123', true);
 * ```
 */
export function mockQueryResponse(results: any[] = [], nextCursor: string | null = null, hasMore = false) {
	return {
		object: 'list',
		results,
		next_cursor: nextCursor,
		has_more: hasMore,
		type: 'page',
		page: {},
	};
}

/**
 * Create a mock search response with custom results
 */
export function mockSearchResponse(results: any[] = [], nextCursor: string | null = null, hasMore = false) {
	return {
		object: 'list',
		results,
		next_cursor: nextCursor,
		has_more: hasMore,
		type: 'page_or_database',
	};
}

/**
 * Create a YouTube video page (matches youtube-playlist-sync schema)
 *
 * Usage:
 * ```typescript
 * const videoPage = createYouTubeVideoPage({
 *   title: 'My Video',
 *   url: 'https://youtube.com/watch?v=abc123',
 *   channel: 'My Channel',
 *   published: '2024-01-15'
 * });
 * ```
 */
export function createYouTubeVideoPage(params: {
	title: string;
	url: string;
	channel?: string;
	published?: string;
}) {
	return createMockPage({
		properties: {
			Name: {
				id: 'title',
				type: 'title' as const,
				title: [{ type: 'text' as const, text: { content: params.title }, plain_text: params.title }],
			},
			URL: {
				id: 'url',
				type: 'url' as const,
				url: params.url,
			},
			...(params.channel && {
				Channel: {
					id: 'channel',
					type: 'rich_text' as const,
					rich_text: [
						{ type: 'text' as const, text: { content: params.channel }, plain_text: params.channel },
					],
				},
			}),
			...(params.published && {
				Published: {
					id: 'date',
					type: 'date' as const,
					date: { start: params.published, end: null, time_zone: null },
				},
			}),
		},
	});
}

/**
 * Create a transcript block for testing
 *
 * Usage:
 * ```typescript
 * const block = createTranscriptBlock('This is the transcript...');
 * ```
 */
export function createTranscriptBlock(text: string, parentPageId = 'page-123') {
	return createMockBlock({
		parent: {
			type: 'page_id' as const,
			page_id: parentPageId,
		},
		type: 'paragraph' as const,
		paragraph: {
			rich_text: [
				{
					type: 'text' as const,
					text: { content: text, link: null },
					plain_text: text,
				},
			],
			color: 'default' as const,
		},
	});
}

/**
 * Simulate rate limiting delay for testing
 *
 * Usage:
 * ```typescript
 * await batchWithDelay(items, 3, 350, async (item) => {
 *   await processItem(item);
 * });
 * ```
 */
export async function batchWithDelay<T>(
	items: T[],
	batchSize: number,
	delayMs: number,
	fn: (item: T) => Promise<void>
) {
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		await Promise.all(batch.map(fn));

		// Delay between batches (except after last batch)
		if (i + batchSize < items.length) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

/**
 * Create multiple mock pages for pagination testing
 *
 * Usage:
 * ```typescript
 * const pages = createMockPages(10);
 * ```
 */
export function createMockPages(count: number) {
	return Array.from({ length: count }, (_, i) =>
		createMockPage({
			properties: {
				Name: {
					id: 'title',
					type: 'title' as const,
					title: [
						{
							type: 'text' as const,
							text: { content: `Page ${i + 1}` },
							plain_text: `Page ${i + 1}`,
						},
					],
				},
			},
		})
	);
}

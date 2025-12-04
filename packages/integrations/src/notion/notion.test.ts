/**
 * Notion Integration Tests
 *
 * Tests for Notion integration - validates SDK patterns:
 * - ActionResult narrow waist
 * - Input validation
 * - StandardDocument/StandardTask transformations
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Notion } from './index.js';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('Notion Constructor', () => {
	it('should require access token', () => {
		expect(() => new Notion({ accessToken: '' })).toThrow('Notion access token is required');
	});

	it('should accept valid access token', () => {
		const notion = new Notion({ accessToken: 'secret_test_token' });
		expect(notion).toBeInstanceOf(Notion);
	});

	it('should allow custom API URL', () => {
		const notion = new Notion({
			accessToken: 'secret_test_token',
			apiUrl: 'https://custom.notion.api',
		});
		expect(notion).toBeInstanceOf(Notion);
	});

	it('should allow custom Notion version', () => {
		const notion = new Notion({
			accessToken: 'secret_test_token',
			notionVersion: '2023-01-01',
		});
		expect(notion).toBeInstanceOf(Notion);
	});

	it('should allow custom timeout', () => {
		const notion = new Notion({
			accessToken: 'secret_test_token',
			timeout: 5000,
		});
		expect(notion).toBeInstanceOf(Notion);
	});
});

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Notion Input Validation', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
	});

	describe('getPage', () => {
		it('should reject missing page ID', async () => {
			const result = await notion.getPage({ pageId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Page ID is required');
		});

		it('should include correct metadata on validation errors', async () => {
			const result = await notion.getPage({ pageId: '' });

			expect(result.success).toBe(false);
			expect(result.metadata.source.integration).toBe('notion');
			expect(result.metadata.source.action).toBe('get-page');
		});
	});

	describe('createPage', () => {
		it('should reject missing parent', async () => {
			const result = await notion.createPage({
				properties: { Name: { title: [{ text: { content: 'Test' } }] } },
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('parentDatabaseId or parentPageId is required');
		});
	});

	describe('updatePage', () => {
		it('should reject missing page ID', async () => {
			const result = await notion.updatePage({
				pageId: '',
				properties: { Status: { select: { name: 'Done' } } },
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Page ID is required');
		});
	});

	describe('queryDatabase', () => {
		it('should reject missing database ID', async () => {
			const result = await notion.queryDatabase({ databaseId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Database ID is required');
		});
	});

	describe('getDatabase', () => {
		it('should reject missing database ID', async () => {
			const result = await notion.getDatabase('');

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Database ID is required');
		});
	});

	describe('getBlockChildren', () => {
		it('should reject missing block ID', async () => {
			const result = await notion.getBlockChildren({ blockId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Block ID is required');
		});
	});

	describe('getTask', () => {
		it('should reject missing page ID', async () => {
			const result = await notion.getTask('');

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Page ID is required');
		});
	});
});

// ============================================================================
// ACTION RESULT STRUCTURE TESTS
// ============================================================================

describe('Notion ActionResult Structure', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ object: 'list', results: [], has_more: false, next_cursor: null }), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return ActionResult with correct metadata for search', async () => {
		const result = await notion.search({ query: 'test' });

		expect(result.success).toBe(true);
		expect(result.metadata).toBeDefined();
		expect(result.metadata.source.integration).toBe('notion');
		expect(result.metadata.source.action).toBe('search');
		expect(result.metadata.schema).toBe('notion.search-results.v1');
	});

	it('should include capabilities in result', async () => {
		const result = await notion.search();

		expect(result.success).toBe(true);
		expect(result.capabilities).toBeDefined();
		expect(result.capabilities?.canHandleText).toBe(true);
		expect(result.capabilities?.canHandleRichText).toBe(true);
		expect(result.capabilities?.supportsSearch).toBe(true);
		expect(result.capabilities?.supportsPagination).toBe(true);
		expect(result.capabilities?.supportsNesting).toBe(true);
	});

	it('should return empty array when no results found', async () => {
		const result = await notion.search();

		expect(result.success).toBe(true);
		expect(result.data).toEqual([]);
	});
});

// ============================================================================
// SEARCH OPTIONS TESTS
// ============================================================================

describe('Notion.search Options', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ object: 'list', results: [], has_more: false, next_cursor: null }), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should include query in request body', async () => {
		await notion.search({ query: 'Project Notes' });

		expect(global.fetch).toHaveBeenCalled();
		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.query).toBe('Project Notes');
	});

	it('should respect page_size limit', async () => {
		await notion.search({ page_size: 50 });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.page_size).toBe(50);
	});

	it('should cap page_size at 100', async () => {
		await notion.search({ page_size: 200 });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.page_size).toBe(100);
	});

	it('should include filter when provided', async () => {
		await notion.search({ filter: { property: 'object', value: 'page' } });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.filter).toEqual({ property: 'object', value: 'page' });
	});

	it('should include sort when provided', async () => {
		await notion.search({ sort: { direction: 'descending', timestamp: 'last_edited_time' } });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.sort).toEqual({ direction: 'descending', timestamp: 'last_edited_time' });
	});

	it('should include pagination cursor when provided', async () => {
		await notion.search({ start_cursor: 'cursor_abc123' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.start_cursor).toBe('cursor_abc123');
	});
});

// ============================================================================
// API REQUEST TESTS
// ============================================================================

describe('Notion API Requests', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should include authorization header', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ object: 'list', results: [], has_more: false, next_cursor: null }), { status: 200 })
		);

		await notion.search();

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const headers = init?.headers as Headers;
		expect(headers.get('Authorization')).toBe('Bearer secret_test_token');
	});

	it('should include Notion-Version header', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ object: 'list', results: [], has_more: false, next_cursor: null }), { status: 200 })
		);

		await notion.search();

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const headers = init?.headers as Headers;
		expect(headers.get('Notion-Version')).toBe('2022-06-28');
	});

	it('should use custom Notion version when provided', async () => {
		const customNotion = new Notion({
			accessToken: 'secret_test_token',
			notionVersion: '2023-01-01',
		});

		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ object: 'list', results: [], has_more: false, next_cursor: null }), { status: 200 })
		);

		await customNotion.search();

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const headers = init?.headers as Headers;
		expect(headers.get('Notion-Version')).toBe('2023-01-01');
	});

	it('should include Content-Type header', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ object: 'list', results: [], has_more: false, next_cursor: null }), { status: 200 })
		);

		await notion.search();

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const headers = init?.headers as Headers;
		expect(headers.get('Content-Type')).toBe('application/json');
	});
});

// ============================================================================
// GET PAGE TESTS
// ============================================================================

describe('Notion.getPage', () => {
	let notion: Notion;

	const mockPage = {
		object: 'page',
		id: 'page-123',
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-02T00:00:00.000Z',
		created_by: { object: 'user', id: 'user-1' },
		last_edited_by: { object: 'user', id: 'user-1' },
		parent: { type: 'database_id', database_id: 'db-123' },
		archived: false,
		properties: {
			Name: {
				id: 'title',
				type: 'title',
				title: [{ type: 'text', text: { content: 'Test Page' }, plain_text: 'Test Page' }],
			},
		},
		url: 'https://notion.so/Test-Page-123',
	};

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockPage), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return page data on success', async () => {
		const result = await notion.getPage({ pageId: 'page-123' });

		expect(result.success).toBe(true);
		expect(result.data.id).toBe('page-123');
		expect(result.data.url).toBe('https://notion.so/Test-Page-123');
	});

	it('should include correct schema in metadata', async () => {
		const result = await notion.getPage({ pageId: 'page-123' });

		expect(result.metadata.schema).toBe('notion.page.v1');
	});

	it('should call correct API endpoint', async () => {
		await notion.getPage({ pageId: 'page-123' });

		expect(global.fetch).toHaveBeenCalled();
		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('/pages/page-123');
	});
});

// ============================================================================
// QUERY DATABASE TESTS
// ============================================================================

describe('Notion.queryDatabase', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({
				object: 'list',
				results: [],
				has_more: false,
				next_cursor: null,
			}), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should call correct API endpoint', async () => {
		await notion.queryDatabase({ databaseId: 'db-123' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('/databases/db-123/query');
	});

	it('should include filter in request body', async () => {
		const filter = {
			property: 'Status',
			select: { equals: 'Done' },
		};

		await notion.queryDatabase({ databaseId: 'db-123', filter });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.filter).toEqual(filter);
	});

	it('should include sorts in request body', async () => {
		const sorts = [{ property: 'Created', direction: 'descending' as const }];

		await notion.queryDatabase({ databaseId: 'db-123', sorts });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.sorts).toEqual(sorts);
	});

	it('should return correct schema', async () => {
		const result = await notion.queryDatabase({ databaseId: 'db-123' });

		expect(result.metadata.schema).toBe('notion.page-list.v1');
	});
});

// ============================================================================
// CREATE PAGE TESTS
// ============================================================================

describe('Notion.createPage', () => {
	let notion: Notion;

	const mockCreatedPage = {
		object: 'page',
		id: 'new-page-123',
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-01T00:00:00.000Z',
		created_by: { object: 'user', id: 'user-1' },
		last_edited_by: { object: 'user', id: 'user-1' },
		parent: { type: 'database_id', database_id: 'db-123' },
		archived: false,
		properties: {},
		url: 'https://notion.so/New-Page-123',
	};

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockCreatedPage), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should create page in database', async () => {
		const result = await notion.createPage({
			parentDatabaseId: 'db-123',
			properties: {
				Name: { title: [{ text: { content: 'New Task' } }] },
			},
		});

		expect(result.success).toBe(true);
		expect(result.data.id).toBe('new-page-123');
	});

	it('should create page under another page', async () => {
		const result = await notion.createPage({
			parentPageId: 'parent-page-123',
			properties: {
				title: { title: [{ text: { content: 'Subpage' } }] },
			},
		});

		expect(result.success).toBe(true);

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.parent).toEqual({ page_id: 'parent-page-123' });
	});

	it('should include icon when provided', async () => {
		await notion.createPage({
			parentDatabaseId: 'db-123',
			properties: {},
			icon: { type: 'emoji', emoji: '🚀' },
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.icon).toEqual({ type: 'emoji', emoji: '🚀' });
	});

	it('should call POST on /pages endpoint', async () => {
		await notion.createPage({
			parentDatabaseId: 'db-123',
			properties: {},
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		const init = calls[0][1];
		expect(url).toContain('/pages');
		expect(init?.method).toBe('POST');
	});
});

// ============================================================================
// UPDATE PAGE TESTS
// ============================================================================

describe('Notion.updatePage', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({
				object: 'page',
				id: 'page-123',
				properties: {},
			}), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should call PATCH on correct endpoint', async () => {
		await notion.updatePage({
			pageId: 'page-123',
			properties: { Status: { select: { name: 'Done' } } },
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		const init = calls[0][1];
		expect(url).toContain('/pages/page-123');
		expect(init?.method).toBe('PATCH');
	});

	it('should include properties in request body', async () => {
		const properties = { Status: { select: { name: 'Done' } } };

		await notion.updatePage({
			pageId: 'page-123',
			properties,
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.properties).toEqual(properties);
	});

	it('should handle archive flag', async () => {
		await notion.updatePage({
			pageId: 'page-123',
			archived: true,
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.archived).toBe(true);
	});
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Notion Error Handling', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should handle 401 unauthorized', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401 })
		);

		const result = await notion.search();

		expect(result.success).toBe(false);
		expect(result.metadata.source.integration).toBe('notion');
	});

	it('should handle 404 not found', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ message: 'Page not found' }), { status: 404 })
		);

		const result = await notion.getPage({ pageId: 'nonexistent' });

		expect(result.success).toBe(false);
	});

	it('should handle 429 rate limit', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ message: 'Rate limited' }), {
				status: 429,
				headers: { 'Retry-After': '60' },
			})
		);

		const result = await notion.search();

		expect(result.success).toBe(false);
	});

	it('should handle network errors', async () => {
		vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

		const result = await notion.search();

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain('Network error');
	});
});

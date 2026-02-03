/**
 * Notion API Mock Fixtures
 *
 * Realistic mock responses based on actual Notion API structures.
 * Used for testing without requiring real API credentials.
 *
 * Reference: https://developers.notion.com/reference/intro
 */

/**
 * Mock Database - YouTube Videos Database
 *
 * Matches the schema used by youtube-playlist-sync workflow:
 * - Name (title): Video title
 * - URL (url): YouTube URL
 * - Channel (rich_text): Channel name
 * - Published (date): Publish date
 */
export const mockDatabase = {
	object: 'database' as const,
	id: 'db-abc123',
	title: [{ text: { content: 'YouTube Videos' } }],
	properties: {
		Name: { id: 'title', name: 'Name', type: 'title' as const, title: {} },
		URL: { id: 'url', name: 'URL', type: 'url' as const, url: {} },
		Channel: { id: 'channel', name: 'Channel', type: 'rich_text' as const, rich_text: {} },
		Published: { id: 'date', name: 'Published', type: 'date' as const, date: {} },
	},
	created_time: '2024-01-01T00:00:00.000Z',
	last_edited_time: '2024-01-01T00:00:00.000Z',
	created_by: { object: 'user' as const, id: 'user-123' },
	last_edited_by: { object: 'user' as const, id: 'user-123' },
	url: 'https://www.notion.so/db-abc123',
	parent: { type: 'workspace' as const, workspace: true },
	archived: false,
	is_inline: false,
};

/**
 * Mock Page - Video Page in YouTube Database
 */
export const mockPage = {
	object: 'page' as const,
	id: 'page-xyz789',
	created_time: '2024-01-01T00:00:00.000Z',
	last_edited_time: '2024-01-01T00:00:00.000Z',
	created_by: { object: 'user' as const, id: 'user-123' },
	last_edited_by: { object: 'user' as const, id: 'user-123' },
	cover: null,
	icon: null,
	parent: {
		type: 'database_id' as const,
		database_id: 'db-abc123',
	},
	archived: false,
	properties: {
		Name: {
			id: 'title',
			type: 'title' as const,
			title: [{ type: 'text' as const, text: { content: 'Test Video' }, plain_text: 'Test Video' }],
		},
		URL: {
			id: 'url',
			type: 'url' as const,
			url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		},
		Channel: {
			id: 'channel',
			type: 'rich_text' as const,
			rich_text: [{ type: 'text' as const, text: { content: 'Test Channel' }, plain_text: 'Test Channel' }],
		},
		Published: {
			id: 'date',
			type: 'date' as const,
			date: { start: '2024-01-01', end: null, time_zone: null },
		},
	},
	url: 'https://notion.so/Test-Video-xyz789',
};

/**
 * Mock Block - Paragraph with Transcript Text
 */
export const mockBlock = {
	object: 'block' as const,
	id: 'block-123',
	parent: {
		type: 'page_id' as const,
		page_id: 'page-xyz789',
	},
	created_time: '2024-01-01T00:00:00.000Z',
	last_edited_time: '2024-01-01T00:00:00.000Z',
	created_by: { object: 'user' as const, id: 'user-123' },
	last_edited_by: { object: 'user' as const, id: 'user-123' },
	has_children: false,
	archived: false,
	type: 'paragraph' as const,
	paragraph: {
		rich_text: [
			{
				type: 'text' as const,
				text: { content: 'Transcript content here...', link: null },
				plain_text: 'Transcript content here...',
			},
		],
		color: 'default' as const,
	},
};

/**
 * Mock Query Response - Empty Results
 */
export const mockQueryEmpty = {
	object: 'list' as const,
	results: [],
	next_cursor: null,
	has_more: false,
	type: 'page' as const,
	page: {},
};

/**
 * Mock Query Response - With Results
 */
export const mockQueryWithResults = {
	object: 'list' as const,
	results: [mockPage],
	next_cursor: null,
	has_more: false,
	type: 'page' as const,
	page: {},
};

/**
 * Mock Query Response - Paginated
 */
export const mockQueryPaginated = {
	object: 'list' as const,
	results: [mockPage],
	next_cursor: 'cursor-abc123',
	has_more: true,
	type: 'page' as const,
	page: {},
};

/**
 * Mock Search Response - Empty
 */
export const mockSearchEmpty = {
	object: 'list' as const,
	results: [],
	next_cursor: null,
	has_more: false,
	type: 'page_or_database' as const,
};

/**
 * Mock Search Response - With Results
 */
export const mockSearchWithResults = {
	object: 'list' as const,
	results: [mockPage, mockDatabase],
	next_cursor: null,
	has_more: false,
	type: 'page_or_database' as const,
};

/**
 * Mock Error Response - Rate Limited (429)
 */
export const mockErrorRateLimited = {
	object: 'error' as const,
	status: 429,
	code: 'rate_limited' as const,
	message: 'Rate limited. Please retry after 1000',
};

/**
 * Mock Error Response - Invalid Request (400)
 */
export const mockErrorInvalidRequest = {
	object: 'error' as const,
	status: 400,
	code: 'validation_error' as const,
	message: 'body failed validation: body.properties.Name.title should be defined, instead was `undefined`.',
};

/**
 * Mock Error Response - Not Found (404)
 */
export const mockErrorNotFound = {
	object: 'error' as const,
	status: 404,
	code: 'object_not_found' as const,
	message: 'Could not find database with ID: db-invalid',
};

/**
 * Mock Error Response - Unauthorized (401)
 */
export const mockErrorUnauthorized = {
	object: 'error' as const,
	status: 401,
	code: 'unauthorized' as const,
	message: 'API token is invalid.',
};

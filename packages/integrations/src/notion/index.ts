/**
 * Notion Integration for WORKWAY
 *
 * Demonstrates the SDK patterns with DUAL StandardData outputs:
 * - StandardDocument for pages
 * - StandardTask for database items with task properties
 *
 * This validates the narrow waist pattern across multiple data types.
 *
 * @example
 * ```typescript
 * import { Notion } from '@workwayco/integrations/notion';
 *
 * const notion = new Notion({ accessToken: tokens.notion.access_token });
 *
 * // Search pages
 * const pages = await notion.search({ query: 'Project' });
 *
 * // Get a page
 * const page = await notion.getPage({ pageId: 'abc123' });
 *
 * // Create a page in a database
 * const created = await notion.createPage({
 *   parentDatabaseId: 'db123',
 *   properties: { Name: { title: [{ text: { content: 'New Task' } }] } }
 * });
 *
 * // Query a database
 * const items = await notion.queryDatabase({ databaseId: 'db123' });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	type StandardDocument,
	type StandardTask,
	type StandardList,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	BaseAPIClient,
	validateAccessToken,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notion rich text object
 */
export interface NotionRichText {
	type: 'text' | 'mention' | 'equation';
	text?: {
		content: string;
		link?: { url: string } | null;
	};
	mention?: {
		type: string;
		[key: string]: unknown;
	};
	annotations?: {
		bold: boolean;
		italic: boolean;
		strikethrough: boolean;
		underline: boolean;
		code: boolean;
		color: string;
	};
	plain_text: string;
	href?: string | null;
}

/**
 * Notion page object
 */
export interface NotionPage {
	object: 'page';
	id: string;
	created_time: string;
	last_edited_time: string;
	created_by: { object: 'user'; id: string };
	last_edited_by: { object: 'user'; id: string };
	parent:
		| { type: 'database_id'; database_id: string; data_source_id?: string }
		| { type: 'data_source_id'; data_source_id: string }
		| { type: 'page_id'; page_id: string }
		| { type: 'workspace'; workspace: true };
	archived: boolean;
	properties: Record<string, NotionProperty>;
	url: string;
	icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } } | null;
	cover?: { type: 'external'; external: { url: string } } | null;
}

/**
 * Notion database object (2025-09-03: now contains data_sources list)
 */
export interface NotionDatabase {
	object: 'database';
	id: string;
	title: NotionRichText[];
	description: NotionRichText[];
	created_time: string;
	last_edited_time: string;
	icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } } | null;
	cover?: { type: 'external'; external: { url: string } } | null;
	/** In 2025-09-03, properties moved to data_sources. This may be empty. */
	properties?: Record<string, NotionPropertySchema>;
	/** List of data sources in this database (2025-09-03+) */
	data_sources?: Array<{ id: string; name: string }>;
	parent:
		| { type: 'page_id'; page_id: string }
		| { type: 'workspace'; workspace: true };
	url: string;
	archived: boolean;
	is_inline?: boolean;
	in_trash?: boolean;
}

/**
 * Notion data source object (2025-09-03+)
 * Contains the schema (properties) for a single source within a database
 */
export interface NotionDataSource {
	object: 'data_source';
	id: string;
	name?: string;
	created_time: string;
	last_edited_time: string;
	properties: Record<string, NotionPropertySchema>;
	parent: { type: 'database_id'; database_id: string };
	/** The database's parent (grandparent of this data source) */
	database_parent:
		| { type: 'page_id'; page_id: string }
		| { type: 'workspace'; workspace: true };
	in_trash?: boolean;
}

/**
 * Notion property value (in a page)
 */
export interface NotionProperty {
	id: string;
	type: string;
	title?: NotionRichText[];
	rich_text?: NotionRichText[];
	number?: number | null;
	select?: { id: string; name: string; color: string } | null;
	multi_select?: Array<{ id: string; name: string; color: string }>;
	date?: { start: string; end?: string | null; time_zone?: string | null } | null;
	checkbox?: boolean;
	url?: string | null;
	email?: string | null;
	phone_number?: string | null;
	status?: { id: string; name: string; color: string } | null;
	people?: Array<{ object: 'user'; id: string }>;
	files?: Array<{ name: string; type: string; file?: { url: string }; external?: { url: string } }>;
	relation?: Array<{ id: string }>;
	formula?: { type: string; [key: string]: unknown };
	rollup?: { type: string; [key: string]: unknown };
	created_time?: string;
	created_by?: { object: 'user'; id: string };
	last_edited_time?: string;
	last_edited_by?: { object: 'user'; id: string };
}

/**
 * Notion property schema (in a database)
 */
export interface NotionPropertySchema {
	id: string;
	name: string;
	type: string;
	[key: string]: unknown;
}

/**
 * Notion block object (content blocks)
 */
export interface NotionBlock {
	object: 'block';
	id: string;
	type: string;
	created_time: string;
	last_edited_time: string;
	has_children: boolean;
	archived: boolean;
	[key: string]: unknown;
}

/**
 * Notion integration configuration
 */
export interface NotionConfig {
	/** Integration token or OAuth access token */
	accessToken: string;
	/** Notion API version (default: '2025-09-03') */
	notionVersion?: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Options for searching
 */
export interface SearchOptions {
	/** Search query */
	query?: string;
	/** Filter by object type: 'page' or 'data_source' (2025-09-03+) */
	filter?: { property: 'object'; value: 'page' | 'data_source' };
	/** Sort direction */
	sort?: { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' };
	/** Pagination cursor */
	start_cursor?: string;
	/** Page size (default: 100, max: 100) */
	page_size?: number;
}

/**
 * Options for getting a page
 */
export interface GetPageOptions {
	/** Page ID */
	pageId: string;
}

/**
 * Options for creating a page
 */
export interface CreatePageOptions {
	/** Parent data source ID (2025-09-03+, preferred over parentDatabaseId) */
	parentDataSourceId?: string;
	/** Parent database ID (deprecated in 2025-09-03, use parentDataSourceId instead) */
	parentDatabaseId?: string;
	/** Parent page ID (mutually exclusive with parentDataSourceId/parentDatabaseId) */
	parentPageId?: string;
	/** Page properties */
	properties: Record<string, unknown>;
	/** Page content (blocks) */
	children?: NotionBlock[];
	/** Page icon */
	icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } };
	/** Page cover */
	cover?: { type: 'external'; external: { url: string } };
}

/**
 * Options for updating a page
 */
export interface UpdatePageOptions {
	/** Page ID */
	pageId: string;
	/** Properties to update */
	properties?: Record<string, unknown>;
	/** Archive the page */
	archived?: boolean;
	/** Update icon */
	icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } } | null;
	/** Update cover */
	cover?: { type: 'external'; external: { url: string } } | null;
}

/**
 * Options for querying a database/data source
 */
export interface QueryDatabaseOptions {
	/** Data source ID (2025-09-03+, preferred) */
	dataSourceId?: string;
	/** Database ID (will be resolved to data source ID automatically) */
	databaseId?: string;
	/** Filter conditions */
	filter?: Record<string, unknown>;
	/** Sort conditions */
	sorts?: Array<{ property: string; direction: 'ascending' | 'descending' } | { timestamp: 'created_time' | 'last_edited_time'; direction: 'ascending' | 'descending' }>;
	/** Pagination cursor */
	start_cursor?: string;
	/** Page size (default: 100, max: 100) */
	page_size?: number;
}

/**
 * Options for getting page content
 */
export interface GetBlockChildrenOptions {
	/** Block or page ID */
	blockId: string;
	/** Pagination cursor */
	start_cursor?: string;
	/** Page size (default: 100, max: 100) */
	page_size?: number;
}

// ============================================================================
// NOTION INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Notion integration */
const handleError = createErrorHandler('notion');

/**
 * Notion Integration
 *
 * Weniger, aber besser: Extends BaseAPIClient for shared HTTP logic.
 *
 * API Version 2025-09-03:
 * - Uses data_source_id instead of database_id for queries and page creation
 * - Search filter uses 'data_source' instead of 'database'
 * - Database endpoint returns data_sources list; use getDataSource() for schema
 */
export class Notion extends BaseAPIClient {
	private notionVersion: string;
	/** Cache of database_id -> data_source_id mappings */
	private dataSourceCache: Map<string, string> = new Map();

	constructor(config: NotionConfig) {
		validateAccessToken(config.accessToken, 'notion');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.notion.com/v1',
			timeout: config.timeout,
		});
		this.notionVersion = config.notionVersion || '2025-09-03';
	}

	/** Get Notion-specific headers */
	private get notionHeaders(): Record<string, string> {
		return { 'Notion-Version': this.notionVersion };
	}

	// ==========================================================================
	// DATA SOURCE RESOLUTION (2025-09-03+)
	// ==========================================================================

	/**
	 * Resolve a database ID to its primary data source ID
	 *
	 * In 2025-09-03+, most operations require data_source_id instead of database_id.
	 * This method fetches the database and returns the first data source ID.
	 *
	 * Results are cached to avoid repeated API calls.
	 */
	async resolveDataSourceId(databaseId: string): Promise<string> {
		// Check cache first
		const cached = this.dataSourceCache.get(databaseId);
		if (cached) return cached;

		// Fetch database to get data sources
		const result = await this.getDatabase(databaseId);
		if (!result.success || !result.data.data_sources?.length) {
			throw new Error(`Could not resolve data source for database ${databaseId}`);
		}

		const dataSourceId = result.data.data_sources[0].id;
		this.dataSourceCache.set(databaseId, dataSourceId);
		return dataSourceId;
	}

	/**
	 * Get a data source by ID (2025-09-03+)
	 *
	 * Use this to get the schema (properties) of a data source.
	 * In 2025-09-03, getDatabase() returns the database container,
	 * while getDataSource() returns the actual schema.
	 */
	async getDataSource(dataSourceId: string): Promise<ActionResult<NotionDataSource>> {
		if (!dataSourceId) {
			return ActionResult.error('Data source ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'get-data-source',
			});
		}

		try {
			const response = await this.get(`/data_sources/${dataSourceId}`, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'get-data-source' });

			const dataSource = (await response.json()) as NotionDataSource;

			return createActionResult({
				data: dataSource,
				integration: 'notion',
				action: 'get-data-source',
				schema: 'notion.data-source.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-data-source');
		}
	}

	// ==========================================================================
	// ACTIONS
	// ==========================================================================

	/**
	 * Search pages and data sources
	 *
	 * Note: In 2025-09-03+, use filter value 'data_source' instead of 'database'.
	 * Search results for data sources return the schema (properties).
	 *
	 * @returns ActionResult with search results
	 */
	async search(options: SearchOptions = {}): Promise<ActionResult<Array<NotionPage | NotionDataSource>>> {
		const { query, filter, sort, start_cursor, page_size = 100 } = options;

		try {
			const body: Record<string, unknown> = {
				page_size: Math.min(page_size, 100),
			};

			if (query) body.query = query;
			if (filter) body.filter = filter;
			if (sort) body.sort = sort;
			if (start_cursor) body.start_cursor = start_cursor;

			const response = await this.post('/search', body, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'search' });

			const data = (await response.json()) as {
				object: 'list';
				results: Array<NotionPage | NotionDataSource>;
				has_more: boolean;
				next_cursor: string | null;
			};

			// Provide standardized list format
			const standard: StandardList = {
				type: 'list',
				items: data.results.map((item) => ({
					id: item.id,
					title: this.extractTitle(item),
					description: undefined,
					url: item.object === 'page' ? (item as NotionPage).url : undefined,
					metadata: {
						object: item.object,
						archived: item.object === 'page' ? (item as NotionPage).archived : undefined,
					},
				})),
				metadata: {
					total: data.results.length,
					hasMore: data.has_more,
					cursor: data.next_cursor || undefined,
				},
			};

			return createActionResult({
				data: data.results,
				integration: 'notion',
				action: 'search',
				schema: 'notion.search-results.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'search');
		}
	}

	/**
	 * Get a page by ID
	 *
	 * @returns ActionResult with page data and StandardDocument format
	 */
	async getPage(options: GetPageOptions): Promise<ActionResult<NotionPage>> {
		const { pageId } = options;

		if (!pageId) {
			return ActionResult.error('Page ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'get-page',
			});
		}

		try {
			const response = await this.get(`/pages/${pageId}`, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'get-page' });

			const page = (await response.json()) as NotionPage;
			const standard = this.toStandardDocument(page);

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'get-page',
				schema: 'notion.page.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'get-page');
		}
	}

	/**
	 * Create a new page
	 *
	 * In 2025-09-03+, use parentDataSourceId for database pages.
	 * parentDatabaseId is still supported but will be automatically resolved.
	 *
	 * @returns ActionResult with created page
	 */
	async createPage(options: CreatePageOptions): Promise<ActionResult<NotionPage>> {
		const { parentDataSourceId, parentDatabaseId, parentPageId, properties, children, icon, cover } = options;

		if (!parentDataSourceId && !parentDatabaseId && !parentPageId) {
			return ActionResult.error(
				'Either parentDataSourceId, parentDatabaseId, or parentPageId is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'create-page' }
			);
		}

		try {
			let parent: Record<string, unknown>;

			if (parentPageId) {
				parent = { page_id: parentPageId };
			} else if (parentDataSourceId) {
				// Use data_source_id directly (2025-09-03+)
				parent = { type: 'data_source_id', data_source_id: parentDataSourceId };
			} else if (parentDatabaseId) {
				// Resolve database_id to data_source_id
				const dataSourceId = await this.resolveDataSourceId(parentDatabaseId);
				parent = { type: 'data_source_id', data_source_id: dataSourceId };
			} else {
				return ActionResult.error(
					'No valid parent specified',
					ErrorCode.MISSING_REQUIRED_FIELD,
					{ integration: 'notion', action: 'create-page' }
				);
			}

			const body: Record<string, unknown> = {
				parent,
				properties,
			};

			if (children) body.children = children;
			if (icon) body.icon = icon;
			if (cover) body.cover = cover;

			const response = await this.post('/pages', body, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'create-page' });

			const page = (await response.json()) as NotionPage;

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'create-page',
				schema: 'notion.page.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-page');
		}
	}

	/**
	 * Update a page
	 *
	 * @returns ActionResult with updated page
	 */
	async updatePage(options: UpdatePageOptions): Promise<ActionResult<NotionPage>> {
		const { pageId, properties, archived, icon, cover } = options;

		if (!pageId) {
			return ActionResult.error('Page ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'update-page',
			});
		}

		try {
			const body: Record<string, unknown> = {};
			if (properties) body.properties = properties;
			if (archived !== undefined) body.archived = archived;
			if (icon !== undefined) body.icon = icon;
			if (cover !== undefined) body.cover = cover;

			const response = await this.patch(`/pages/${pageId}`, body, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'update-page' });

			const page = (await response.json()) as NotionPage;

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'update-page',
				schema: 'notion.page.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-page');
		}
	}

	/**
	 * Query a database/data source
	 *
	 * In 2025-09-03+, uses /data_sources/:id/query endpoint.
	 * If databaseId is provided, it will be automatically resolved to dataSourceId.
	 *
	 * @returns ActionResult with database items (pages)
	 */
	async queryDatabase(options: QueryDatabaseOptions): Promise<ActionResult<NotionPage[]>> {
		const { dataSourceId, databaseId, filter, sorts, start_cursor, page_size = 100 } = options;

		if (!dataSourceId && !databaseId) {
			return ActionResult.error('Either dataSourceId or databaseId is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'query-database',
			});
		}

		try {
			// Resolve to data source ID if needed
			const resolvedDataSourceId = dataSourceId || await this.resolveDataSourceId(databaseId!);

			const body: Record<string, unknown> = {
				page_size: Math.min(page_size, 100),
			};

			if (filter) body.filter = filter;
			if (sorts) body.sorts = sorts;
			if (start_cursor) body.start_cursor = start_cursor;

			// Use /data_sources endpoint (2025-09-03+)
			const response = await this.post(`/data_sources/${resolvedDataSourceId}/query`, body, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'query-database' });

			const data = (await response.json()) as {
				object: 'list';
				results: NotionPage[];
				has_more: boolean;
				next_cursor: string | null;
			};

			return createActionResult({
				data: data.results,
				integration: 'notion',
				action: 'query-database',
				schema: 'notion.page-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'query-database');
		}
	}

	/**
	 * Get a database schema
	 *
	 * @returns ActionResult with database metadata
	 */
	async getDatabase(databaseId: string): Promise<ActionResult<NotionDatabase>> {
		if (!databaseId) {
			return ActionResult.error('Database ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'get-database',
			});
		}

		try {
			const response = await this.get(`/databases/${databaseId}`, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'get-database' });

			const database = (await response.json()) as NotionDatabase;

			return createActionResult({
				data: database,
				integration: 'notion',
				action: 'get-database',
				schema: 'notion.database.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-database');
		}
	}

	/**
	 * Get page content (blocks)
	 *
	 * @returns ActionResult with block children
	 */
	async getBlockChildren(options: GetBlockChildrenOptions): Promise<ActionResult<NotionBlock[]>> {
		const { blockId, start_cursor, page_size = 100 } = options;

		if (!blockId) {
			return ActionResult.error('Block ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'get-block-children',
			});
		}

		try {
			const params = new URLSearchParams({
				page_size: Math.min(page_size, 100).toString(),
			});
			if (start_cursor) params.set('start_cursor', start_cursor);

			const response = await this.get(`/blocks/${blockId}/children?${params}`, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'get-block-children' });

			const data = (await response.json()) as {
				object: 'list';
				results: NotionBlock[];
				has_more: boolean;
				next_cursor: string | null;
			};

			return createActionResult({
				data: data.results,
				integration: 'notion',
				action: 'get-block-children',
				schema: 'notion.block-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-block-children');
		}
	}

	/**
	 * Append children blocks to a page or block
	 *
	 * Use this to add content to an existing page after creation.
	 * Respects Notion's 100-block limit per request.
	 *
	 * @returns ActionResult with appended blocks
	 */
	async appendBlockChildren(options: {
		blockId: string;
		children: NotionBlock[];
	}): Promise<ActionResult<NotionBlock[]>> {
		const { blockId, children } = options;

		if (!blockId) {
			return ActionResult.error('Block ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'append-block-children',
			});
		}

		if (!children || children.length === 0) {
			return ActionResult.error('Children blocks are required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'append-block-children',
			});
		}

		try {
			const response = await this.patch(
				`/blocks/${blockId}/children`,
				{ children },
				this.notionHeaders
			);
			await assertResponseOk(response, { integration: 'notion', action: 'append-block-children' });

			const data = (await response.json()) as {
				object: 'list';
				results: NotionBlock[];
			};

			return createActionResult({
				data: data.results,
				integration: 'notion',
				action: 'append-block-children',
				schema: 'notion.block-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'append-block-children');
		}
	}

	/**
	 * Append blocks to a page in batches
	 *
	 * Automatically splits large block arrays into batches of 100 (Notion's limit).
	 * Includes rate limiting between batches.
	 *
	 * @param pageId - The page ID to append blocks to
	 * @param blocks - Array of blocks to append
	 * @param batchSize - Max blocks per request (default: 100)
	 * @param delayMs - Delay between batches in ms (default: 350)
	 */
	async appendBlocksInBatches(
		pageId: string,
		blocks: NotionBlock[],
		batchSize: number = 100,
		delayMs: number = 350
	): Promise<ActionResult<{ totalAppended: number; batches: number }>> {
		if (!pageId) {
			return ActionResult.error('Page ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'append-blocks-in-batches',
			});
		}

		let totalAppended = 0;
		let batches = 0;

		for (let i = 0; i < blocks.length; i += batchSize) {
			const batch = blocks.slice(i, i + batchSize);

			const result = await this.appendBlockChildren({
				blockId: pageId,
				children: batch,
			});

			if (!result.success) {
				return ActionResult.error(
					`Failed to append batch ${batches + 1}: ${result.error?.message}`,
					ErrorCode.EXTERNAL_SERVICE_ERROR,
					{ integration: 'notion', action: 'append-blocks-in-batches' }
				);
			}

			totalAppended += batch.length;
			batches++;

			// Rate limiting between batches
			if (i + batchSize < blocks.length) {
				await new Promise((r) => setTimeout(r, delayMs));
			}
		}

		return createActionResult({
			data: { totalAppended, batches },
			integration: 'notion',
			action: 'append-blocks-in-batches',
			schema: 'notion.batch-result.v1',
			capabilities: this.getCapabilities(),
		});
	}

	// ==========================================================================
	// TASK-SPECIFIC ACTIONS (for StandardTask support)
	// ==========================================================================

	/**
	 * Get a database item as a task (with StandardTask transformation)
	 *
	 * Use this when querying task/project management databases
	 *
	 * @returns ActionResult with page and StandardTask format
	 */
	async getTask(pageId: string): Promise<ActionResult<NotionPage>> {
		if (!pageId) {
			return ActionResult.error('Page ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'notion',
				action: 'get-task',
			});
		}

		try {
			const response = await this.get(`/pages/${pageId}`, this.notionHeaders);
			await assertResponseOk(response, { integration: 'notion', action: 'get-task' });

			const page = (await response.json()) as NotionPage;
			const standard = this.toStandardTask(page);

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'get-task',
				schema: 'notion.task.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'get-task');
		}
	}

	/**
	 * Query tasks from a database (with StandardTask transformations)
	 *
	 * @returns ActionResult with tasks
	 */
	async queryTasks(options: QueryDatabaseOptions): Promise<ActionResult<NotionPage[]>> {
		const result = await this.queryDatabase(options);

		if (!result.success) {
			return result;
		}

		// Re-wrap with task schema
		return createActionResult({
			data: result.data,
			integration: 'notion',
			action: 'query-tasks',
			schema: 'notion.task-list.v1',
			capabilities: this.getCapabilities(),
		});
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Get capabilities for Notion actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: true,
			canHandleMarkdown: true,
			canHandleImages: true,
			canHandleAttachments: true,
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: true,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}

	/**
	 * Extract title from a page, database, or data source
	 */
	private extractTitle(item: NotionPage | NotionDatabase | NotionDataSource): string {
		if (item.object === 'database') {
			return this.richTextToPlain((item as NotionDatabase).title);
		}

		if (item.object === 'data_source') {
			// Data sources have a name property
			return (item as NotionDataSource).name || 'Untitled Data Source';
		}

		// For pages, find the title property
		const page = item as NotionPage;
		for (const [, prop] of Object.entries(page.properties)) {
			if (prop.type === 'title' && prop.title) {
				return this.richTextToPlain(prop.title);
			}
		}

		return 'Untitled';
	}

	/**
	 * Convert rich text array to plain text
	 */
	private richTextToPlain(richText: NotionRichText[]): string {
		if (!richText || !Array.isArray(richText)) return '';
		return richText.map((rt) => rt.plain_text).join('');
	}

	/**
	 * Convert Notion page to StandardDocument format
	 */
	private toStandardDocument(page: NotionPage): StandardDocument {
		const title = this.extractTitle(page);

		return {
			type: 'document',
			id: page.id,
			title,
			url: page.url,
			author: page.created_by.id,
			createdAt: new Date(page.created_time).getTime(),
			updatedAt: new Date(page.last_edited_time).getTime(),
			metadata: {
				archived: page.archived,
				parent: page.parent,
				icon: page.icon,
				cover: page.cover,
			},
		};
	}

	/**
	 * Convert Notion page (from task database) to StandardTask format
	 *
	 * Attempts to map common property names to StandardTask fields
	 */
	private toStandardTask(page: NotionPage): StandardTask {
		const title = this.extractTitle(page);
		const props = page.properties;

		// Find status property (common names: Status, State, Stage)
		const statusProp = props.Status || props.State || props.Stage;
		let status: StandardTask['status'] = 'todo';
		if (statusProp?.status) {
			const statusName = statusProp.status.name.toLowerCase();
			if (statusName.includes('done') || statusName.includes('complete')) {
				status = 'done';
			} else if (statusName.includes('progress') || statusName.includes('doing')) {
				status = 'in_progress';
			} else if (statusName.includes('cancel')) {
				status = 'cancelled';
			}
		}

		// Find assignee property (common names: Assignee, Assigned, Owner)
		const assigneeProp = props.Assignee || props.Assigned || props.Owner;
		const assignee = assigneeProp?.people?.[0]?.id;

		// Find due date property (common names: Due, Due Date, Deadline)
		const dueProp = props.Due || props['Due Date'] || props.Deadline;
		const dueDate = dueProp?.date?.start
			? new Date(dueProp.date.start).getTime()
			: undefined;

		// Find priority property (common names: Priority, Importance)
		const priorityProp = props.Priority || props.Importance;
		let priority: StandardTask['priority'];
		if (priorityProp?.select) {
			const priorityName = priorityProp.select.name.toLowerCase();
			if (priorityName.includes('urgent') || priorityName.includes('critical')) {
				priority = 'urgent';
			} else if (priorityName.includes('high')) {
				priority = 'high';
			} else if (priorityName.includes('medium') || priorityName.includes('normal')) {
				priority = 'medium';
			} else {
				priority = 'low';
			}
		}

		// Find labels/tags property (common names: Tags, Labels, Categories)
		const labelsProp = props.Tags || props.Labels || props.Categories;
		const labels = labelsProp?.multi_select?.map((s) => s.name);

		// Find description property (common names: Description, Notes, Details)
		const descProp = props.Description || props.Notes || props.Details;
		const description = descProp?.rich_text
			? this.richTextToPlain(descProp.rich_text)
			: undefined;

		return {
			type: 'task',
			id: page.id,
			title,
			description,
			status,
			assignee,
			dueDate,
			priority,
			labels,
			timestamp: new Date(page.last_edited_time).getTime(),
			metadata: {
				url: page.url,
				archived: page.archived,
				parent: page.parent,
			},
		};
	}

	// ==========================================================================
	// ZUHANDENHEIT: Document Builder
	// ==========================================================================

	/**
	 * Create a document from a template
	 *
	 * Zuhandenheit: Developer thinks "create a standup summary" not
	 * "construct 100 lines of Notion block objects"
	 *
	 * @example
	 * ```typescript
	 * // BEFORE: 100+ lines of block construction
	 * await notion.createPage({
	 *   children: [
	 *     { object: 'block', type: 'heading_2', heading_2: { rich_text: [...] } },
	 *     // ... 100 more lines
	 *   ]
	 * });
	 *
	 * // AFTER: Template-based
	 * await notion.createDocument({
	 *   database: 'db123',
	 *   template: 'summary',
	 *   data: {
	 *     title: 'Standup - 2024-01-15',
	 *     summary: 'Team made progress on...',
	 *     sections: {
	 *       themes: ['API work', 'Testing'],
	 *       blockers: ['Waiting on design'],
	 *       actionItems: ['Review PR #123']
	 *     }
	 *   }
	 * });
	 * ```
	 */
	async createDocument(options: {
		database: string;
		template: 'summary' | 'report' | 'notes' | 'article' | 'meeting' | 'feedback' | 'custom';
		data: {
			title: string;
			summary?: string;
			date?: string;
			mood?: 'positive' | 'neutral' | 'concerned';
			properties?: Record<string, unknown>;
			sections?: Record<string, string[]>;
			content?: string;
			metadata?: Record<string, unknown>;
		};
		customBlocks?: any[];
	}): Promise<ActionResult<NotionPage>> {
		const { database, template, data, customBlocks } = options;

		// Build properties
		const properties: Record<string, unknown> = {
			Title: {
				title: [{ text: { content: data.title } }],
			},
			...(data.date && {
				Date: { date: { start: data.date } },
			}),
			...(data.mood && {
				Mood: { select: { name: data.mood } },
			}),
			...data.properties,
		};

		// Build blocks based on template
		let children: any[];

		switch (template) {
			case 'summary':
				children = this.buildSummaryBlocks(data);
				break;
			case 'report':
				children = this.buildReportBlocks(data);
				break;
			case 'notes':
				children = this.buildNotesBlocks(data);
				break;
			case 'article':
				children = this.buildArticleBlocks(data);
				break;
			case 'meeting':
				children = this.buildMeetingBlocks(data);
				break;
			case 'feedback':
				children = this.buildFeedbackBlocks(data);
				break;
			case 'custom':
				children = customBlocks || [];
				break;
			default:
				children = this.buildSummaryBlocks(data);
		}

		return this.createPage({
			parentDatabaseId: database,
			properties,
			children,
		});
	}

	/**
	 * Build summary template blocks (standup, meeting notes, etc.)
	 */
	private buildSummaryBlocks(data: {
		summary?: string;
		sections?: Record<string, string[]>;
		content?: string;
	}): any[] {
		const blocks: any[] = [];

		// Summary callout
		if (data.summary) {
			blocks.push({
				object: 'block',
				type: 'callout',
				callout: {
					rich_text: [{ text: { content: data.summary } }],
					icon: { emoji: '📋' },
				},
			});
		}

		// Sections
		if (data.sections) {
			for (const [sectionName, items] of Object.entries(data.sections)) {
				// Section header
				const displayName = this.formatSectionName(sectionName);
				blocks.push({
					object: 'block',
					type: 'heading_2',
					heading_2: {
						rich_text: [{ text: { content: displayName } }],
					},
				});

				// Section items
				if (items.length === 0) {
					blocks.push({
						object: 'block',
						type: 'paragraph',
						paragraph: {
							rich_text: [{ text: { content: `No ${sectionName.toLowerCase()} reported` } }],
						},
					});
				} else {
					// Use to_do for action items, bulleted_list for others
					const blockType = sectionName.toLowerCase().includes('action') ? 'to_do' : 'bulleted_list_item';

					for (const item of items) {
						if (blockType === 'to_do') {
							blocks.push({
								object: 'block',
								type: 'to_do',
								to_do: {
									rich_text: [{ text: { content: item } }],
									checked: false,
								},
							});
						} else {
							blocks.push({
								object: 'block',
								type: 'bulleted_list_item',
								bulleted_list_item: {
									rich_text: [{ text: { content: item } }],
								},
							});
						}
					}
				}
			}
		}

		// Raw content at the end (in a toggle)
		if (data.content) {
			blocks.push({
				object: 'block',
				type: 'divider',
				divider: {},
			});
			blocks.push({
				object: 'block',
				type: 'toggle',
				toggle: {
					rich_text: [{ text: { content: 'View Original Content' } }],
					children: [{
						object: 'block',
						type: 'paragraph',
						paragraph: {
							rich_text: [{ text: { content: data.content.slice(0, 2000) } }],
						},
					}],
				},
			});
		}

		return blocks;
	}

	/**
	 * Build report template blocks
	 */
	private buildReportBlocks(data: {
		summary?: string;
		sections?: Record<string, string[]>;
		content?: string;
		metadata?: Record<string, unknown>;
	}): any[] {
		const blocks: any[] = [];

		// Title section with metadata
		if (data.metadata) {
			const metaText = Object.entries(data.metadata)
				.map(([k, v]) => `**${k}:** ${v}`)
				.join(' | ');

			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ text: { content: metaText } }],
				},
			});
			blocks.push({
				object: 'block',
				type: 'divider',
				divider: {},
			});
		}

		// Executive summary
		if (data.summary) {
			blocks.push({
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ text: { content: 'Executive Summary' } }],
				},
			});
			blocks.push({
				object: 'block',
				type: 'quote',
				quote: {
					rich_text: [{ text: { content: data.summary } }],
				},
			});
		}

		// Sections as collapsible toggles
		if (data.sections) {
			for (const [sectionName, items] of Object.entries(data.sections)) {
				const displayName = this.formatSectionName(sectionName);
				blocks.push({
					object: 'block',
					type: 'toggle',
					toggle: {
						rich_text: [{ text: { content: `${displayName} (${items.length})` } }],
						children: items.map((item) => ({
							object: 'block',
							type: 'bulleted_list_item',
							bulleted_list_item: {
								rich_text: [{ text: { content: item } }],
							},
						})),
					},
				});
			}
		}

		return blocks;
	}

	/**
	 * Build notes template blocks
	 */
	private buildNotesBlocks(data: {
		summary?: string;
		sections?: Record<string, string[]>;
		content?: string;
	}): any[] {
		const blocks: any[] = [];

		// Quick summary
		if (data.summary) {
			blocks.push({
				object: 'block',
				type: 'callout',
				callout: {
					rich_text: [{ text: { content: data.summary } }],
					icon: { emoji: '📝' },
					color: 'gray_background',
				},
			});
		}

		// Content first for notes
		if (data.content) {
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ text: { content: data.content } }],
				},
			});
		}

		// Key points as sections
		if (data.sections) {
			blocks.push({
				object: 'block',
				type: 'divider',
				divider: {},
			});

			for (const [sectionName, items] of Object.entries(data.sections)) {
				const displayName = this.formatSectionName(sectionName);
				blocks.push({
					object: 'block',
					type: 'heading_3',
					heading_3: {
						rich_text: [{ text: { content: displayName } }],
					},
				});

				for (const item of items) {
					blocks.push({
						object: 'block',
						type: 'bulleted_list_item',
						bulleted_list_item: {
							rich_text: [{ text: { content: item } }],
						},
					});
				}
			}
		}

		return blocks;
	}

	/**
	 * Build article template blocks
	 */
	private buildArticleBlocks(data: {
		summary?: string;
		content?: string;
		sections?: Record<string, string[]>;
	}): any[] {
		const blocks: any[] = [];

		// Lead paragraph
		if (data.summary) {
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{
						text: { content: data.summary },
						annotations: { italic: true },
					}],
				},
			});
		}

		// Main content
		if (data.content) {
			// Split content into paragraphs
			const paragraphs = data.content.split('\n\n').filter(p => p.trim());
			for (const para of paragraphs) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: {
						rich_text: [{ text: { content: para } }],
					},
				});
			}
		}

		// Related sections
		if (data.sections) {
			blocks.push({
				object: 'block',
				type: 'divider',
				divider: {},
			});

			for (const [sectionName, items] of Object.entries(data.sections)) {
				const displayName = this.formatSectionName(sectionName);
				blocks.push({
					object: 'block',
					type: 'heading_2',
					heading_2: {
						rich_text: [{ text: { content: displayName } }],
					},
				});

				for (const item of items) {
					blocks.push({
						object: 'block',
						type: 'bulleted_list_item',
						bulleted_list_item: {
							rich_text: [{ text: { content: item } }],
						},
					});
				}
			}
		}

		return blocks;
	}

	/**
	 * Build meeting template blocks (optimized for meeting transcripts)
	 */
	private buildMeetingBlocks(data: {
		summary?: string;
		sections?: Record<string, string[]>;
		content?: string;
		metadata?: Record<string, unknown>;
	}): any[] {
		const blocks: any[] = [];

		// Meeting info header
		if (data.metadata) {
			const metaText = Object.entries(data.metadata)
				.map(([k, v]) => `**${k}:** ${v}`)
				.join(' • ');

			blocks.push({
				object: 'block',
				type: 'callout',
				callout: {
					rich_text: [{ text: { content: metaText } }],
					icon: { emoji: '📅' },
					color: 'blue_background',
				},
			});
		}

		// Meeting summary
		if (data.summary) {
			blocks.push({
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ text: { content: 'Summary' } }],
				},
			});
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ text: { content: data.summary } }],
				},
			});
		}

		// Sections with meeting-specific formatting
		if (data.sections) {
			const sectionOrder = ['decisions', 'actionItems', 'followUps', 'keyTopics'];
			const sectionEmojis: Record<string, string> = {
				decisions: '✅',
				actionItems: '📋',
				followUps: '📆',
				keyTopics: '💡',
			};

			// Process ordered sections first
			for (const sectionName of sectionOrder) {
				const items = data.sections[sectionName];
				if (!items || items.length === 0) continue;

				const displayName = this.formatSectionName(sectionName);
				const emoji = sectionEmojis[sectionName] || '•';

				blocks.push({
					object: 'block',
					type: 'heading_2',
					heading_2: {
						rich_text: [{ text: { content: `${emoji} ${displayName}` } }],
					},
				});

				// Use to_do for action items, numbered for decisions
				const isActionItem = sectionName === 'actionItems';
				const isDecision = sectionName === 'decisions';

				for (const item of items) {
					if (isActionItem) {
						blocks.push({
							object: 'block',
							type: 'to_do',
							to_do: {
								rich_text: [{ text: { content: item } }],
								checked: false,
							},
						});
					} else if (isDecision) {
						blocks.push({
							object: 'block',
							type: 'numbered_list_item',
							numbered_list_item: {
								rich_text: [{ text: { content: item } }],
							},
						});
					} else {
						blocks.push({
							object: 'block',
							type: 'bulleted_list_item',
							bulleted_list_item: {
								rich_text: [{ text: { content: item } }],
							},
						});
					}
				}
			}

			// Process any remaining sections
			for (const [sectionName, items] of Object.entries(data.sections)) {
				if (sectionOrder.includes(sectionName) || items.length === 0) continue;

				const displayName = this.formatSectionName(sectionName);
				blocks.push({
					object: 'block',
					type: 'heading_3',
					heading_3: {
						rich_text: [{ text: { content: displayName } }],
					},
				});

				for (const item of items) {
					blocks.push({
						object: 'block',
						type: 'bulleted_list_item',
						bulleted_list_item: {
							rich_text: [{ text: { content: item } }],
						},
					});
				}
			}
		}

		// Full transcript in toggle
		if (data.content) {
			blocks.push({
				object: 'block',
				type: 'divider',
				divider: {},
			});
			blocks.push({
				object: 'block',
				type: 'toggle',
				toggle: {
					rich_text: [{ text: { content: '📜 Full Transcript' } }],
					children: [{
						object: 'block',
						type: 'paragraph',
						paragraph: {
							rich_text: [{ text: { content: data.content.slice(0, 2000) } }],
						},
					}],
				},
			});
		}

		return blocks;
	}

	/**
	 * Build feedback template blocks (customer feedback analysis)
	 */
	private buildFeedbackBlocks(data: {
		summary?: string;
		sections?: Record<string, string[]>;
		content?: string;
		metadata?: Record<string, unknown>;
	}): any[] {
		const blocks: any[] = [];

		// Feedback metadata (sentiment, urgency, etc.)
		if (data.metadata) {
			const metaText = Object.entries(data.metadata)
				.map(([k, v]) => `**${k}:** ${v}`)
				.join(' | ');

			blocks.push({
				object: 'block',
				type: 'callout',
				callout: {
					rich_text: [{ text: { content: metaText } }],
					icon: { emoji: '💬' },
					color: 'yellow_background',
				},
			});
		}

		// Summary insight
		if (data.summary) {
			blocks.push({
				object: 'block',
				type: 'quote',
				quote: {
					rich_text: [{ text: { content: data.summary } }],
				},
			});
		}

		// Themes and insights
		if (data.sections) {
			for (const [sectionName, items] of Object.entries(data.sections)) {
				if (items.length === 0) continue;

				const displayName = this.formatSectionName(sectionName);
				blocks.push({
					object: 'block',
					type: 'heading_2',
					heading_2: {
						rich_text: [{ text: { content: displayName } }],
					},
				});

				for (const item of items) {
					blocks.push({
						object: 'block',
						type: 'bulleted_list_item',
						bulleted_list_item: {
							rich_text: [{ text: { content: item } }],
						},
					});
				}
			}
		}

		// Original feedback content
		if (data.content) {
			blocks.push({
				object: 'block',
				type: 'divider',
				divider: {},
			});
			blocks.push({
				object: 'block',
				type: 'heading_3',
				heading_3: {
					rich_text: [{ text: { content: 'Original Feedback' } }],
				},
			});
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ text: { content: data.content } }],
				},
			});
		}

		return blocks;
	}

	/**
	 * Format section name for display
	 */
	private formatSectionName(name: string): string {
		// Convert camelCase or snake_case to Title Case
		return name
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.replace(/^\w/, c => c.toUpperCase())
			.trim();
	}

}

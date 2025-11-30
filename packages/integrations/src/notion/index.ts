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
	type StandardDocument,
	type StandardTask,
	type StandardList,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	IntegrationError,
	ErrorCode,
	createErrorFromResponse,
} from '@workwayco/sdk';

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
		| { type: 'database_id'; database_id: string }
		| { type: 'page_id'; page_id: string }
		| { type: 'workspace'; workspace: true };
	archived: boolean;
	properties: Record<string, NotionProperty>;
	url: string;
	icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } } | null;
	cover?: { type: 'external'; external: { url: string } } | null;
}

/**
 * Notion database object
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
	properties: Record<string, NotionPropertySchema>;
	parent:
		| { type: 'page_id'; page_id: string }
		| { type: 'workspace'; workspace: true };
	url: string;
	archived: boolean;
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
	/** Notion API version (default: '2022-06-28') */
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
	/** Filter by object type: 'page' or 'database' */
	filter?: { property: 'object'; value: 'page' | 'database' };
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
	/** Parent database ID (mutually exclusive with parentPageId) */
	parentDatabaseId?: string;
	/** Parent page ID (mutually exclusive with parentDatabaseId) */
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
 * Options for querying a database
 */
export interface QueryDatabaseOptions {
	/** Database ID */
	databaseId: string;
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

/**
 * Notion Integration
 *
 * Implements the WORKWAY SDK patterns for Notion API access.
 */
export class Notion {
	private accessToken: string;
	private notionVersion: string;
	private apiUrl: string;
	private timeout: number;

	constructor(config: NotionConfig) {
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'Notion access token is required',
				{ integration: 'notion', retryable: false }
			);
		}

		this.accessToken = config.accessToken;
		this.notionVersion = config.notionVersion || '2022-06-28';
		this.apiUrl = config.apiUrl || 'https://api.notion.com/v1';
		this.timeout = config.timeout ?? 30000;
	}

	// ==========================================================================
	// ACTIONS
	// ==========================================================================

	/**
	 * Search pages and databases
	 *
	 * @returns ActionResult with search results
	 */
	async search(options: SearchOptions = {}): Promise<ActionResult<Array<NotionPage | NotionDatabase>>> {
		const {
			query,
			filter,
			sort,
			start_cursor,
			page_size = 100,
		} = options;

		try {
			const body: Record<string, unknown> = {
				page_size: Math.min(page_size, 100),
			};

			if (query) body.query = query;
			if (filter) body.filter = filter;
			if (sort) body.sort = sort;
			if (start_cursor) body.start_cursor = start_cursor;

			const response = await this.request('/search', {
				method: 'POST',
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'search',
				});
			}

			const data = await response.json() as {
				object: 'list';
				results: Array<NotionPage | NotionDatabase>;
				has_more: boolean;
				next_cursor: string | null;
			};

			// Provide standardized list format
			const standard: StandardList = {
				type: 'list',
				items: data.results.map((item) => ({
					id: item.id,
					title: this.extractTitle(item),
					description: item.object === 'database'
						? this.richTextToPlain((item as NotionDatabase).description)
						: undefined,
					url: item.url,
					metadata: {
						object: item.object,
						archived: item.archived,
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
		} catch (error: unknown) {
			return this.handleError(error, 'search');
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
			return ActionResult.error(
				'Page ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'get-page' }
			);
		}

		try {
			const response = await this.request(`/pages/${pageId}`);

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'get-page',
				});
			}

			const page = await response.json() as NotionPage;
			const standard = this.toStandardDocument(page);

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'get-page',
				schema: 'notion.page.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error: unknown) {
			return this.handleError(error, 'get-page');
		}
	}

	/**
	 * Create a new page
	 *
	 * @returns ActionResult with created page
	 */
	async createPage(options: CreatePageOptions): Promise<ActionResult<NotionPage>> {
		const { parentDatabaseId, parentPageId, properties, children, icon, cover } = options;

		if (!parentDatabaseId && !parentPageId) {
			return ActionResult.error(
				'Either parentDatabaseId or parentPageId is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'create-page' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				parent: parentDatabaseId
					? { database_id: parentDatabaseId }
					: { page_id: parentPageId },
				properties,
			};

			if (children) body.children = children;
			if (icon) body.icon = icon;
			if (cover) body.cover = cover;

			const response = await this.request('/pages', {
				method: 'POST',
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'create-page',
				});
			}

			const page = await response.json() as NotionPage;

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'create-page',
				schema: 'notion.page.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error: unknown) {
			return this.handleError(error, 'create-page');
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
			return ActionResult.error(
				'Page ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'update-page' }
			);
		}

		try {
			const body: Record<string, unknown> = {};
			if (properties) body.properties = properties;
			if (archived !== undefined) body.archived = archived;
			if (icon !== undefined) body.icon = icon;
			if (cover !== undefined) body.cover = cover;

			const response = await this.request(`/pages/${pageId}`, {
				method: 'PATCH',
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'update-page',
				});
			}

			const page = await response.json() as NotionPage;

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'update-page',
				schema: 'notion.page.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error: unknown) {
			return this.handleError(error, 'update-page');
		}
	}

	/**
	 * Query a database
	 *
	 * @returns ActionResult with database items (pages)
	 */
	async queryDatabase(options: QueryDatabaseOptions): Promise<ActionResult<NotionPage[]>> {
		const { databaseId, filter, sorts, start_cursor, page_size = 100 } = options;

		if (!databaseId) {
			return ActionResult.error(
				'Database ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'query-database' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				page_size: Math.min(page_size, 100),
			};

			if (filter) body.filter = filter;
			if (sorts) body.sorts = sorts;
			if (start_cursor) body.start_cursor = start_cursor;

			const response = await this.request(`/databases/${databaseId}/query`, {
				method: 'POST',
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'query-database',
				});
			}

			const data = await response.json() as {
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
		} catch (error: unknown) {
			return this.handleError(error, 'query-database');
		}
	}

	/**
	 * Get a database schema
	 *
	 * @returns ActionResult with database metadata
	 */
	async getDatabase(databaseId: string): Promise<ActionResult<NotionDatabase>> {
		if (!databaseId) {
			return ActionResult.error(
				'Database ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'get-database' }
			);
		}

		try {
			const response = await this.request(`/databases/${databaseId}`);

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'get-database',
				});
			}

			const database = await response.json() as NotionDatabase;

			return createActionResult({
				data: database,
				integration: 'notion',
				action: 'get-database',
				schema: 'notion.database.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error: unknown) {
			return this.handleError(error, 'get-database');
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
			return ActionResult.error(
				'Block ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'get-block-children' }
			);
		}

		try {
			const params = new URLSearchParams({
				page_size: Math.min(page_size, 100).toString(),
			});
			if (start_cursor) params.set('start_cursor', start_cursor);

			const response = await this.request(`/blocks/${blockId}/children?${params}`);

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'get-block-children',
				});
			}

			const data = await response.json() as {
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
		} catch (error: unknown) {
			return this.handleError(error, 'get-block-children');
		}
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
			return ActionResult.error(
				'Page ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'notion', action: 'get-task' }
			);
		}

		try {
			const response = await this.request(`/pages/${pageId}`);

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'notion',
					action: 'get-task',
				});
			}

			const page = await response.json() as NotionPage;
			const standard = this.toStandardTask(page);

			return createActionResult({
				data: page,
				integration: 'notion',
				action: 'get-task',
				schema: 'notion.task.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error: unknown) {
			return this.handleError(error, 'get-task');
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
	 * Make authenticated request to Notion API with timeout
	 */
	private async request(path: string, options: RequestInit = {}): Promise<Response> {
		const url = `${this.apiUrl}${path}`;

		const headers = new Headers(options.headers);
		headers.set('Authorization', `Bearer ${this.accessToken}`);
		headers.set('Content-Type', 'application/json');
		headers.set('Notion-Version', this.notionVersion);

		// Add timeout via AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(url, {
				...options,
				headers,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

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
	 * Extract title from a page or database
	 */
	private extractTitle(item: NotionPage | NotionDatabase): string {
		if (item.object === 'database') {
			return this.richTextToPlain((item as NotionDatabase).title);
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

	/**
	 * Handle errors consistently
	 */
	private handleError<T>(error: unknown, action: string): ActionResult<T> {
		if (error instanceof IntegrationError) {
			const integrationErr = error as IntegrationError;
			return ActionResult.error(integrationErr.message, integrationErr.code, {
				integration: 'notion',
				action,
			});
		}
		const errMessage = error instanceof Error ? error.message : String(error);
		return ActionResult.error(
			`Failed to ${action.replace('-', ' ')}: ${errMessage}`,
			ErrorCode.API_ERROR,
			{ integration: 'notion', action }
		);
	}
}

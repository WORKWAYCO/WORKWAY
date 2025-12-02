/**
 * Airtable Integration for WORKWAY
 *
 * Weniger, aber besser: Extends BaseAPIClient for shared HTTP logic.
 *
 * @example
 * ```typescript
 * import { Airtable } from '@workwayco/integrations/airtable';
 *
 * const airtable = new Airtable({
 *   accessToken: tokens.airtable.access_token,
 *   baseId: 'appXXXXXXXXXXXXXX'
 * });
 *
 * // List records from a table
 * const records = await airtable.listRecords({ tableId: 'Tasks' });
 *
 * // Create a record
 * const created = await airtable.createRecord({
 *   tableId: 'Tasks',
 *   fields: { Name: 'New Task', Status: 'Todo' }
 * });
 *
 * // Update a record
 * const updated = await airtable.updateRecord({
 *   tableId: 'Tasks',
 *   recordId: 'recXXX',
 *   fields: { Status: 'Done' }
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	IntegrationError,
	ErrorCode,
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
 * Airtable integration configuration
 */
export interface AirtableConfig {
	/** Personal access token or OAuth access token */
	accessToken: string;
	/** Base ID (appXXXXXXXXXXXXXX) */
	baseId: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Airtable record object
 */
export interface AirtableRecord {
	id: string;
	createdTime: string;
	fields: Record<string, AirtableFieldValue>;
}

/**
 * Airtable field value types
 */
export type AirtableFieldValue =
	| string
	| number
	| boolean
	| null
	| string[]
	| AirtableAttachment[]
	| AirtableCollaborator
	| AirtableCollaborator[]
	| AirtableRecordLink[]
	| AirtableBarcode
	| AirtableButton
	| { label: string; url: string }; // URL with label

/**
 * Airtable attachment object
 */
export interface AirtableAttachment {
	id: string;
	url: string;
	filename: string;
	size: number;
	type: string;
	width?: number;
	height?: number;
	thumbnails?: {
		small: { url: string; width: number; height: number };
		large: { url: string; width: number; height: number };
		full?: { url: string; width: number; height: number };
	};
}

/**
 * Airtable collaborator object
 */
export interface AirtableCollaborator {
	id: string;
	email: string;
	name: string;
}

/**
 * Airtable linked record reference
 */
export interface AirtableRecordLink {
	id: string;
}

/**
 * Airtable barcode object
 */
export interface AirtableBarcode {
	text: string;
}

/**
 * Airtable button object
 */
export interface AirtableButton {
	label: string;
	url?: string;
}

/**
 * Airtable table schema
 */
export interface AirtableTable {
	id: string;
	name: string;
	primaryFieldId: string;
	fields: AirtableField[];
	views: AirtableView[];
}

/**
 * Airtable field schema
 */
export interface AirtableField {
	id: string;
	name: string;
	type: string;
	description?: string;
	options?: Record<string, unknown>;
}

/**
 * Airtable view schema
 */
export interface AirtableView {
	id: string;
	name: string;
	type: 'grid' | 'form' | 'calendar' | 'gallery' | 'kanban' | 'timeline' | 'block';
}

/**
 * Airtable list response
 */
export interface AirtableListResponse {
	records: AirtableRecord[];
	offset?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

/**
 * Options for listing records
 */
export interface ListRecordsOptions {
	/** Table name or ID */
	tableId: string;
	/** Fields to return (default: all fields) */
	fields?: string[];
	/** Filter formula (Airtable formula syntax) */
	filterByFormula?: string;
	/** Maximum records to return (max 100 per request) */
	maxRecords?: number;
	/** Page size (max 100) */
	pageSize?: number;
	/** Sort by fields */
	sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
	/** View ID or name to filter records */
	view?: string;
	/** Pagination offset from previous response */
	offset?: string;
	/** Cell format: 'json' (default) or 'string' */
	cellFormat?: 'json' | 'string';
	/** Timezone for date calculations */
	timeZone?: string;
	/** User locale for formatting */
	userLocale?: string;
}

/**
 * Options for getting a single record
 */
export interface GetRecordOptions {
	/** Table name or ID */
	tableId: string;
	/** Record ID */
	recordId: string;
}

/**
 * Options for creating a record
 */
export interface CreateRecordOptions {
	/** Table name or ID */
	tableId: string;
	/** Field values */
	fields: Record<string, AirtableFieldValue>;
	/** Typecast values (attempts to convert string values to the correct type) */
	typecast?: boolean;
}

/**
 * Options for updating a record
 */
export interface UpdateRecordOptions {
	/** Table name or ID */
	tableId: string;
	/** Record ID */
	recordId: string;
	/** Field values to update */
	fields: Record<string, AirtableFieldValue>;
	/** Typecast values */
	typecast?: boolean;
}

/**
 * Options for deleting a record
 */
export interface DeleteRecordOptions {
	/** Table name or ID */
	tableId: string;
	/** Record ID */
	recordId: string;
}

/**
 * Options for batch creating records
 */
export interface BatchCreateOptions {
	/** Table name or ID */
	tableId: string;
	/** Array of records to create (max 10 per request) */
	records: Array<{ fields: Record<string, AirtableFieldValue> }>;
	/** Typecast values */
	typecast?: boolean;
}

/**
 * Options for batch updating records
 */
export interface BatchUpdateOptions {
	/** Table name or ID */
	tableId: string;
	/** Array of records to update (max 10 per request) */
	records: Array<{ id: string; fields: Record<string, AirtableFieldValue> }>;
	/** Typecast values */
	typecast?: boolean;
}

/**
 * Options for batch deleting records
 */
export interface BatchDeleteOptions {
	/** Table name or ID */
	tableId: string;
	/** Record IDs to delete (max 10 per request) */
	recordIds: string[];
}

// ============================================================================
// AIRTABLE INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Airtable integration */
const handleError = createErrorHandler('airtable');

/**
 * Airtable Integration
 *
 * Weniger, aber besser: Extends BaseAPIClient for shared HTTP logic.
 */
export class Airtable extends BaseAPIClient {
	private readonly baseId: string;

	constructor(config: AirtableConfig) {
		validateAccessToken(config.accessToken, 'airtable');

		if (!config.baseId) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Airtable base ID is required',
				{ integration: 'airtable', retryable: false }
			);
		}

		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.airtable.com/v0',
			timeout: config.timeout,
		});

		this.baseId = config.baseId;
	}

	// ==========================================================================
	// RECORD OPERATIONS
	// ==========================================================================

	/**
	 * List records from a table
	 *
	 * @returns ActionResult with records and StandardList format
	 */
	async listRecords(options: ListRecordsOptions): Promise<ActionResult<AirtableListResponse>> {
		const {
			tableId,
			fields,
			filterByFormula,
			maxRecords,
			pageSize,
			sort,
			view,
			offset,
			cellFormat,
			timeZone,
			userLocale,
		} = options;

		if (!tableId) {
			return ActionResult.error(
				'Table ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'list-records' }
			);
		}

		try {
			const params = new URLSearchParams();

			if (fields?.length) {
				fields.forEach((f) => params.append('fields[]', f));
			}
			if (filterByFormula) params.set('filterByFormula', filterByFormula);
			if (maxRecords) params.set('maxRecords', maxRecords.toString());
			if (pageSize) params.set('pageSize', Math.min(pageSize, 100).toString());
			if (view) params.set('view', view);
			if (offset) params.set('offset', offset);
			if (cellFormat) params.set('cellFormat', cellFormat);
			if (timeZone) params.set('timeZone', timeZone);
			if (userLocale) params.set('userLocale', userLocale);

			if (sort?.length) {
				sort.forEach((s, i) => {
					params.append(`sort[${i}][field]`, s.field);
					params.append(`sort[${i}][direction]`, s.direction);
				});
			}

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.get(url);
			await assertResponseOk(response, { integration: 'airtable', action: 'list-records' });

			const data = (await response.json()) as AirtableListResponse;

			// Provide standardized list format
			const standard: StandardList = {
				type: 'list',
				items: data.records.map((record) => ({
					id: record.id,
					title: this.extractTitle(record),
					description: this.extractDescription(record),
					metadata: {
						createdTime: record.createdTime,
						fields: Object.keys(record.fields),
					},
				})),
				metadata: {
					total: data.records.length,
					hasMore: !!data.offset,
					cursor: data.offset,
				},
			};

			return createActionResult({
				data,
				integration: 'airtable',
				action: 'list-records',
				schema: 'airtable.record-list.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'list-records');
		}
	}

	/**
	 * Get a single record by ID
	 *
	 * @returns ActionResult with record data
	 */
	async getRecord(options: GetRecordOptions): Promise<ActionResult<AirtableRecord>> {
		const { tableId, recordId } = options;

		if (!tableId || !recordId) {
			return ActionResult.error(
				'Table ID and Record ID are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'get-record' }
			);
		}

		try {
			const url = `/${this.baseId}/${encodeURIComponent(tableId)}/${recordId}`;
			const response = await this.get(url);
			await assertResponseOk(response, { integration: 'airtable', action: 'get-record' });

			const record = (await response.json()) as AirtableRecord;
			const standard = this.toStandardTask(record);

			return createActionResult({
				data: record,
				integration: 'airtable',
				action: 'get-record',
				schema: 'airtable.record.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'get-record');
		}
	}

	/**
	 * Create a new record
	 *
	 * @returns ActionResult with created record
	 */
	async createRecord(options: CreateRecordOptions): Promise<ActionResult<AirtableRecord>> {
		const { tableId, fields, typecast } = options;

		if (!tableId) {
			return ActionResult.error(
				'Table ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'create-record' }
			);
		}

		try {
			const body: Record<string, unknown> = { fields };
			if (typecast) body.typecast = true;

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}`;
			const response = await this.post(url, body);
			await assertResponseOk(response, { integration: 'airtable', action: 'create-record' });

			const record = (await response.json()) as AirtableRecord;

			return createActionResult({
				data: record,
				integration: 'airtable',
				action: 'create-record',
				schema: 'airtable.record.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-record');
		}
	}

	/**
	 * Update an existing record
	 *
	 * @returns ActionResult with updated record
	 */
	async updateRecord(options: UpdateRecordOptions): Promise<ActionResult<AirtableRecord>> {
		const { tableId, recordId, fields, typecast } = options;

		if (!tableId || !recordId) {
			return ActionResult.error(
				'Table ID and Record ID are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'update-record' }
			);
		}

		try {
			const body: Record<string, unknown> = { fields };
			if (typecast) body.typecast = true;

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}/${recordId}`;
			const response = await this.patch(url, body);
			await assertResponseOk(response, { integration: 'airtable', action: 'update-record' });

			const record = (await response.json()) as AirtableRecord;

			return createActionResult({
				data: record,
				integration: 'airtable',
				action: 'update-record',
				schema: 'airtable.record.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-record');
		}
	}

	/**
	 * Replace all fields of a record (destructive update)
	 *
	 * @returns ActionResult with updated record
	 */
	async replaceRecord(options: UpdateRecordOptions): Promise<ActionResult<AirtableRecord>> {
		const { tableId, recordId, fields, typecast } = options;

		if (!tableId || !recordId) {
			return ActionResult.error(
				'Table ID and Record ID are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'replace-record' }
			);
		}

		try {
			const body: Record<string, unknown> = { fields };
			if (typecast) body.typecast = true;

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}/${recordId}`;
			// Use PUT via protected request() method
			const response = await this.request(url, {
				method: 'PUT',
				body: JSON.stringify(body),
			});
			await assertResponseOk(response, { integration: 'airtable', action: 'replace-record' });

			const record = (await response.json()) as AirtableRecord;

			return createActionResult({
				data: record,
				integration: 'airtable',
				action: 'replace-record',
				schema: 'airtable.record.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'replace-record');
		}
	}

	/**
	 * Delete a record
	 *
	 * @returns ActionResult with deleted record ID
	 */
	async deleteRecord(options: DeleteRecordOptions): Promise<ActionResult<{ id: string; deleted: boolean }>> {
		const { tableId, recordId } = options;

		if (!tableId || !recordId) {
			return ActionResult.error(
				'Table ID and Record ID are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'delete-record' }
			);
		}

		try {
			const url = `/${this.baseId}/${encodeURIComponent(tableId)}/${recordId}`;
			const response = await this.delete(url);
			await assertResponseOk(response, { integration: 'airtable', action: 'delete-record' });

			const result = (await response.json()) as { id: string; deleted: boolean };

			return createActionResult({
				data: result,
				integration: 'airtable',
				action: 'delete-record',
				schema: 'airtable.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-record');
		}
	}

	// ==========================================================================
	// BATCH OPERATIONS
	// ==========================================================================

	/**
	 * Create multiple records (max 10 per request)
	 *
	 * @returns ActionResult with created records
	 */
	async batchCreate(options: BatchCreateOptions): Promise<ActionResult<AirtableRecord[]>> {
		const { tableId, records, typecast } = options;

		if (!tableId) {
			return ActionResult.error(
				'Table ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'batch-create' }
			);
		}

		if (!records?.length || records.length > 10) {
			return ActionResult.error(
				'Records array must contain 1-10 records',
				ErrorCode.VALIDATION_ERROR,
				{ integration: 'airtable', action: 'batch-create' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				records: records.map((r) => ({ fields: r.fields })),
			};
			if (typecast) body.typecast = true;

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}`;
			const response = await this.post(url, body);
			await assertResponseOk(response, { integration: 'airtable', action: 'batch-create' });

			const data = (await response.json()) as { records: AirtableRecord[] };

			return createActionResult({
				data: data.records,
				integration: 'airtable',
				action: 'batch-create',
				schema: 'airtable.record-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'batch-create');
		}
	}

	/**
	 * Update multiple records (max 10 per request)
	 *
	 * @returns ActionResult with updated records
	 */
	async batchUpdate(options: BatchUpdateOptions): Promise<ActionResult<AirtableRecord[]>> {
		const { tableId, records, typecast } = options;

		if (!tableId) {
			return ActionResult.error(
				'Table ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'batch-update' }
			);
		}

		if (!records?.length || records.length > 10) {
			return ActionResult.error(
				'Records array must contain 1-10 records',
				ErrorCode.VALIDATION_ERROR,
				{ integration: 'airtable', action: 'batch-update' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				records: records.map((r) => ({ id: r.id, fields: r.fields })),
			};
			if (typecast) body.typecast = true;

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}`;
			const response = await this.patch(url, body);
			await assertResponseOk(response, { integration: 'airtable', action: 'batch-update' });

			const data = (await response.json()) as { records: AirtableRecord[] };

			return createActionResult({
				data: data.records,
				integration: 'airtable',
				action: 'batch-update',
				schema: 'airtable.record-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'batch-update');
		}
	}

	/**
	 * Delete multiple records (max 10 per request)
	 *
	 * @returns ActionResult with deleted record IDs
	 */
	async batchDelete(options: BatchDeleteOptions): Promise<ActionResult<Array<{ id: string; deleted: boolean }>>> {
		const { tableId, recordIds } = options;

		if (!tableId) {
			return ActionResult.error(
				'Table ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'airtable', action: 'batch-delete' }
			);
		}

		if (!recordIds?.length || recordIds.length > 10) {
			return ActionResult.error(
				'Record IDs array must contain 1-10 IDs',
				ErrorCode.VALIDATION_ERROR,
				{ integration: 'airtable', action: 'batch-delete' }
			);
		}

		try {
			const params = new URLSearchParams();
			recordIds.forEach((id) => params.append('records[]', id));

			const url = `/${this.baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;
			const response = await this.delete(url);
			await assertResponseOk(response, { integration: 'airtable', action: 'batch-delete' });

			const data = (await response.json()) as { records: Array<{ id: string; deleted: boolean }> };

			return createActionResult({
				data: data.records,
				integration: 'airtable',
				action: 'batch-delete',
				schema: 'airtable.delete-results.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'batch-delete');
		}
	}

	// ==========================================================================
	// SCHEMA OPERATIONS
	// ==========================================================================

	/**
	 * Get table schema (requires Meta API scope)
	 *
	 * Note: Uses separate Meta API endpoint, so we make a direct fetch here
	 *
	 * @returns ActionResult with table schemas
	 */
	async getTables(): Promise<ActionResult<AirtableTable[]>> {
		try {
			// Use Meta API endpoint for schema (different from main API)
			const metaUrl = `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`;
			const response = await this.request(metaUrl.replace('https://api.airtable.com/v0', ''));
			await assertResponseOk(response, { integration: 'airtable', action: 'get-tables' });

			const data = (await response.json()) as { tables: AirtableTable[] };

			return createActionResult({
				data: data.tables,
				integration: 'airtable',
				action: 'get-tables',
				schema: 'airtable.table-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-tables');
		}
	}

	// ==========================================================================
	// TASK-SPECIFIC ACTIONS (for StandardTask support)
	// ==========================================================================

	/**
	 * Get a record as a task (with StandardTask transformation)
	 *
	 * Use this when working with task-like tables
	 *
	 * @returns ActionResult with record and StandardTask format
	 */
	async getTask(tableId: string, recordId: string): Promise<ActionResult<AirtableRecord>> {
		const result = await this.getRecord({ tableId, recordId });

		if (!result.success) {
			return result;
		}

		// Re-wrap with task schema
		return createActionResult({
			data: result.data,
			integration: 'airtable',
			action: 'get-task',
			schema: 'airtable.task.v1',
			capabilities: this.getCapabilities(),
			standard: this.toStandardTask(result.data),
		});
	}

	/**
	 * Query tasks from a table (with StandardTask transformations)
	 *
	 * @returns ActionResult with tasks
	 */
	async queryTasks(options: ListRecordsOptions): Promise<ActionResult<AirtableListResponse>> {
		const result = await this.listRecords(options);

		if (!result.success) {
			return result;
		}

		// Re-wrap with task schema
		return createActionResult({
			data: result.data,
			integration: 'airtable',
			action: 'query-tasks',
			schema: 'airtable.task-list.v1',
			capabilities: this.getCapabilities(),
		});
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Get capabilities for Airtable actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: true,
			canHandleImages: true,
			canHandleAttachments: true,
			supportsSearch: true,
			supportsPagination: true,
			supportsRelations: true,
			supportsMetadata: true,
			supportsBulkOperations: true,
		};
	}

	/**
	 * Extract title from a record (looks for common field names)
	 */
	private extractTitle(record: AirtableRecord): string {
		const fields = record.fields;
		const titleFields = ['Name', 'Title', 'Task', 'Subject', 'name', 'title'];

		for (const field of titleFields) {
			if (fields[field] && typeof fields[field] === 'string') {
				return fields[field] as string;
			}
		}

		// Return first string field as fallback
		for (const [, value] of Object.entries(fields)) {
			if (typeof value === 'string') {
				return value;
			}
		}

		return 'Untitled';
	}

	/**
	 * Extract description from a record
	 */
	private extractDescription(record: AirtableRecord): string | undefined {
		const fields = record.fields;
		const descFields = ['Description', 'Notes', 'Details', 'description', 'notes'];

		for (const field of descFields) {
			if (fields[field] && typeof fields[field] === 'string') {
				return fields[field] as string;
			}
		}

		return undefined;
	}

	/**
	 * Convert Airtable record to StandardTask format
	 *
	 * Attempts to map common field names to StandardTask fields
	 */
	private toStandardTask(record: AirtableRecord): StandardTask {
		const fields = record.fields;
		const title = this.extractTitle(record);

		// Find status field
		const statusField = fields.Status || fields.State || fields.status;
		let status: StandardTask['status'] = 'todo';
		if (typeof statusField === 'string') {
			const statusLower = statusField.toLowerCase();
			if (statusLower.includes('done') || statusLower.includes('complete')) {
				status = 'done';
			} else if (statusLower.includes('progress') || statusLower.includes('doing')) {
				status = 'in_progress';
			} else if (statusLower.includes('cancel')) {
				status = 'cancelled';
			}
		}

		// Find assignee field
		const assigneeField = fields.Assignee || fields.Owner || fields.assignee;
		let assignee: string | undefined;
		if (Array.isArray(assigneeField) && assigneeField[0]) {
			const first = assigneeField[0] as AirtableCollaborator;
			assignee = first.email || first.name || first.id;
		} else if (typeof assigneeField === 'string') {
			assignee = assigneeField;
		}

		// Find due date field
		const dueDateField = fields['Due Date'] || fields.Due || fields.Deadline || fields.dueDate;
		let dueDate: number | undefined;
		if (typeof dueDateField === 'string') {
			const parsed = Date.parse(dueDateField);
			if (!isNaN(parsed)) {
				dueDate = parsed;
			}
		}

		// Find priority field
		const priorityField = fields.Priority || fields.priority;
		let priority: StandardTask['priority'];
		if (typeof priorityField === 'string') {
			const priorityLower = priorityField.toLowerCase();
			if (priorityLower.includes('urgent') || priorityLower.includes('critical')) {
				priority = 'urgent';
			} else if (priorityLower.includes('high')) {
				priority = 'high';
			} else if (priorityLower.includes('medium') || priorityLower.includes('normal')) {
				priority = 'medium';
			} else {
				priority = 'low';
			}
		}

		// Find labels/tags field
		const labelsField = fields.Tags || fields.Labels || fields.Categories || fields.tags;
		let labels: string[] | undefined;
		if (Array.isArray(labelsField)) {
			labels = labelsField.filter((l): l is string => typeof l === 'string');
		}

		// Description
		const description = this.extractDescription(record);

		return {
			type: 'task',
			id: record.id,
			title,
			description,
			status,
			assignee,
			dueDate,
			priority,
			labels,
			timestamp: new Date(record.createdTime).getTime(),
			metadata: {
				createdTime: record.createdTime,
				fieldCount: Object.keys(fields).length,
			},
		};
	}
}

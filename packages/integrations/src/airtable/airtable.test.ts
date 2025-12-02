/**
 * Airtable Integration Tests
 *
 * Tests for Airtable integration - validates SDK patterns:
 * - ActionResult narrow waist
 * - Input validation
 * - StandardTask transformations
 * - Error handling
 * - Batch operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Airtable } from './index.js';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('Airtable Constructor', () => {
	it('should require access token', () => {
		expect(() => new Airtable({ accessToken: '', baseId: 'appXXX' })).toThrow('Airtable access token is required');
	});

	it('should require base ID', () => {
		expect(() => new Airtable({ accessToken: 'pat_token', baseId: '' })).toThrow('Airtable base ID is required');
	});

	it('should accept valid configuration', () => {
		const airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		expect(airtable).toBeInstanceOf(Airtable);
	});

	it('should allow custom API URL', () => {
		const airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
			apiUrl: 'https://custom.airtable.api',
		});
		expect(airtable).toBeInstanceOf(Airtable);
	});

	it('should allow custom timeout', () => {
		const airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
			timeout: 5000,
		});
		expect(airtable).toBeInstanceOf(Airtable);
	});
});

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Airtable Input Validation', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
	});

	describe('listRecords', () => {
		it('should reject missing table ID', async () => {
			const result = await airtable.listRecords({ tableId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Table ID is required');
		});

		it('should include correct metadata on validation errors', async () => {
			const result = await airtable.listRecords({ tableId: '' });

			expect(result.success).toBe(false);
			expect(result.metadata.source.integration).toBe('airtable');
			expect(result.metadata.source.action).toBe('list-records');
		});
	});

	describe('getRecord', () => {
		it('should reject missing table ID', async () => {
			const result = await airtable.getRecord({ tableId: '', recordId: 'recXXX' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Table ID and Record ID are required');
		});

		it('should reject missing record ID', async () => {
			const result = await airtable.getRecord({ tableId: 'Tasks', recordId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Table ID and Record ID are required');
		});
	});

	describe('createRecord', () => {
		it('should reject missing table ID', async () => {
			const result = await airtable.createRecord({
				tableId: '',
				fields: { Name: 'Test' },
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Table ID is required');
		});
	});

	describe('updateRecord', () => {
		it('should reject missing table ID or record ID', async () => {
			const result = await airtable.updateRecord({
				tableId: '',
				recordId: 'recXXX',
				fields: { Status: 'Done' },
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Table ID and Record ID are required');
		});
	});

	describe('deleteRecord', () => {
		it('should reject missing table ID or record ID', async () => {
			const result = await airtable.deleteRecord({
				tableId: 'Tasks',
				recordId: '',
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Table ID and Record ID are required');
		});
	});

	describe('batchCreate', () => {
		it('should reject empty records array', async () => {
			const result = await airtable.batchCreate({
				tableId: 'Tasks',
				records: [],
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Records array must contain 1-10 records');
		});

		it('should reject more than 10 records', async () => {
			const records = Array.from({ length: 11 }, () => ({ fields: { Name: 'Test' } }));
			const result = await airtable.batchCreate({
				tableId: 'Tasks',
				records,
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Records array must contain 1-10 records');
		});
	});

	describe('batchUpdate', () => {
		it('should reject more than 10 records', async () => {
			const records = Array.from({ length: 11 }, (_, i) => ({
				id: `rec${i}`,
				fields: { Name: 'Test' },
			}));
			const result = await airtable.batchUpdate({
				tableId: 'Tasks',
				records,
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Records array must contain 1-10 records');
		});
	});

	describe('batchDelete', () => {
		it('should reject more than 10 record IDs', async () => {
			const recordIds = Array.from({ length: 11 }, (_, i) => `rec${i}`);
			const result = await airtable.batchDelete({
				tableId: 'Tasks',
				recordIds,
			});

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Record IDs array must contain 1-10 IDs');
		});
	});
});

// ============================================================================
// ACTION RESULT STRUCTURE TESTS
// ============================================================================

describe('Airtable ActionResult Structure', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ records: [] }), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return ActionResult with correct metadata for listRecords', async () => {
		const result = await airtable.listRecords({ tableId: 'Tasks' });

		expect(result.success).toBe(true);
		expect(result.metadata).toBeDefined();
		expect(result.metadata.source.integration).toBe('airtable');
		expect(result.metadata.source.action).toBe('list-records');
		expect(result.metadata.schema).toBe('airtable.record-list.v1');
	});

	it('should include capabilities in result', async () => {
		const result = await airtable.listRecords({ tableId: 'Tasks' });

		expect(result.success).toBe(true);
		expect(result.capabilities).toBeDefined();
		expect(result.capabilities?.canHandleText).toBe(true);
		expect(result.capabilities?.canHandleRichText).toBe(true);
		expect(result.capabilities?.supportsSearch).toBe(true);
		expect(result.capabilities?.supportsPagination).toBe(true);
		expect(result.capabilities?.supportsBulkOperations).toBe(true);
	});

	it('should return empty records array when no results found', async () => {
		const result = await airtable.listRecords({ tableId: 'Tasks' });

		expect(result.success).toBe(true);
		expect(result.data.records).toEqual([]);
	});
});

// ============================================================================
// LIST RECORDS OPTIONS TESTS
// ============================================================================

describe('Airtable.listRecords Options', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ records: [] }), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should include filterByFormula in query params', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			filterByFormula: "{Status} = 'Done'",
		});

		expect(global.fetch).toHaveBeenCalled();
		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('filterByFormula');
	});

	it('should include fields in query params', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			fields: ['Name', 'Status', 'Due Date'],
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('fields%5B%5D=Name');
		expect(url).toContain('fields%5B%5D=Status');
	});

	it('should cap pageSize at 100', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			pageSize: 200,
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('pageSize=100');
	});

	it('should include sort parameters', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			sort: [
				{ field: 'Due Date', direction: 'asc' },
				{ field: 'Priority', direction: 'desc' },
			],
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('sort%5B0%5D%5Bfield%5D=Due');
		expect(url).toContain('sort%5B0%5D%5Bdirection%5D=asc');
	});

	it('should include view parameter', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			view: 'Grid view',
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('view=Grid');
	});

	it('should include pagination offset', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			offset: 'recXXXXXXXXXXXXXX/0',
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('offset=');
	});
});

// ============================================================================
// API REQUEST TESTS
// ============================================================================

describe('Airtable API Requests', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should include authorization header', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ records: [] }), { status: 200 })
		);

		await airtable.listRecords({ tableId: 'Tasks' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const headers = init?.headers as Headers;
		expect(headers.get('Authorization')).toBe('Bearer pat_test_token');
	});

	it('should include Content-Type header', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ records: [] }), { status: 200 })
		);

		await airtable.listRecords({ tableId: 'Tasks' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const headers = init?.headers as Headers;
		expect(headers.get('Content-Type')).toBe('application/json');
	});

	it('should use correct base URL format', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ records: [] }), { status: 200 })
		);

		await airtable.listRecords({ tableId: 'Tasks' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('https://api.airtable.com/v0');
		expect(url).toContain('appXXXXXXXXXXXXXX');
		expect(url).toContain('Tasks');
	});
});

// ============================================================================
// GET RECORD TESTS
// ============================================================================

describe('Airtable.getRecord', () => {
	let airtable: Airtable;

	const mockRecord = {
		id: 'recXXXXXXXXXXXXXX',
		createdTime: '2024-01-01T00:00:00.000Z',
		fields: {
			Name: 'Test Task',
			Status: 'In Progress',
			Priority: 'High',
		},
	};

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockRecord), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return record data on success', async () => {
		const result = await airtable.getRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
		});

		expect(result.success).toBe(true);
		expect(result.data.id).toBe('recXXXXXXXXXXXXXX');
		expect(result.data.fields.Name).toBe('Test Task');
	});

	it('should include correct schema in metadata', async () => {
		const result = await airtable.getRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
		});

		expect(result.metadata.schema).toBe('airtable.record.v1');
	});

	it('should call correct API endpoint', async () => {
		await airtable.getRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
		});

		expect(global.fetch).toHaveBeenCalled();
		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('/Tasks/recXXXXXXXXXXXXXX');
	});
});

// ============================================================================
// CREATE RECORD TESTS
// ============================================================================

describe('Airtable.createRecord', () => {
	let airtable: Airtable;

	const mockCreatedRecord = {
		id: 'recNEWXXXXXXXXXXX',
		createdTime: '2024-01-01T00:00:00.000Z',
		fields: {
			Name: 'New Task',
			Status: 'Todo',
		},
	};

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockCreatedRecord), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should create record successfully', async () => {
		const result = await airtable.createRecord({
			tableId: 'Tasks',
			fields: { Name: 'New Task', Status: 'Todo' },
		});

		expect(result.success).toBe(true);
		expect(result.data.id).toBe('recNEWXXXXXXXXXXX');
	});

	it('should call POST on correct endpoint', async () => {
		await airtable.createRecord({
			tableId: 'Tasks',
			fields: { Name: 'New Task' },
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		const init = calls[0][1];
		expect(url).toContain('/Tasks');
		expect(init?.method).toBe('POST');
	});

	it('should include fields in request body', async () => {
		const fields = { Name: 'New Task', Status: 'Todo', Priority: 'High' };

		await airtable.createRecord({
			tableId: 'Tasks',
			fields,
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.fields).toEqual(fields);
	});

	it('should include typecast when provided', async () => {
		await airtable.createRecord({
			tableId: 'Tasks',
			fields: { Name: 'New Task' },
			typecast: true,
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.typecast).toBe(true);
	});
});

// ============================================================================
// UPDATE RECORD TESTS
// ============================================================================

describe('Airtable.updateRecord', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({
				id: 'recXXXXXXXXXXXXXX',
				createdTime: '2024-01-01T00:00:00.000Z',
				fields: { Status: 'Done' },
			}), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should call PATCH on correct endpoint', async () => {
		await airtable.updateRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
			fields: { Status: 'Done' },
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		const init = calls[0][1];
		expect(url).toContain('/Tasks/recXXXXXXXXXXXXXX');
		expect(init?.method).toBe('PATCH');
	});

	it('should include fields in request body', async () => {
		const fields = { Status: 'Done', Priority: 'Low' };

		await airtable.updateRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
			fields,
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const init = calls[0][1];
		const body = JSON.parse(init?.body as string);
		expect(body.fields).toEqual(fields);
	});
});

// ============================================================================
// DELETE RECORD TESTS
// ============================================================================

describe('Airtable.deleteRecord', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({
				id: 'recXXXXXXXXXXXXXX',
				deleted: true,
			}), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should call DELETE on correct endpoint', async () => {
		await airtable.deleteRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		const init = calls[0][1];
		expect(url).toContain('/Tasks/recXXXXXXXXXXXXXX');
		expect(init?.method).toBe('DELETE');
	});

	it('should return deleted confirmation', async () => {
		const result = await airtable.deleteRecord({
			tableId: 'Tasks',
			recordId: 'recXXXXXXXXXXXXXX',
		});

		expect(result.success).toBe(true);
		expect(result.data.deleted).toBe(true);
	});
});

// ============================================================================
// BATCH OPERATIONS TESTS
// ============================================================================

describe('Airtable Batch Operations', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('batchCreate', () => {
		it('should create multiple records', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({
					records: [
						{ id: 'rec1', createdTime: '2024-01-01T00:00:00.000Z', fields: { Name: 'Task 1' } },
						{ id: 'rec2', createdTime: '2024-01-01T00:00:00.000Z', fields: { Name: 'Task 2' } },
					],
				}), { status: 200 })
			);

			const result = await airtable.batchCreate({
				tableId: 'Tasks',
				records: [
					{ fields: { Name: 'Task 1' } },
					{ fields: { Name: 'Task 2' } },
				],
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
		});

		it('should include all records in request body', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ records: [] }), { status: 200 })
			);

			const records = [
				{ fields: { Name: 'Task 1' } },
				{ fields: { Name: 'Task 2' } },
				{ fields: { Name: 'Task 3' } },
			];

			await airtable.batchCreate({
				tableId: 'Tasks',
				records,
			});

			const calls = vi.mocked(global.fetch).mock.calls;
			const init = calls[0][1];
			const body = JSON.parse(init?.body as string);
			expect(body.records).toHaveLength(3);
		});
	});

	describe('batchUpdate', () => {
		it('should update multiple records', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({
					records: [
						{ id: 'rec1', createdTime: '2024-01-01T00:00:00.000Z', fields: { Status: 'Done' } },
						{ id: 'rec2', createdTime: '2024-01-01T00:00:00.000Z', fields: { Status: 'Done' } },
					],
				}), { status: 200 })
			);

			const result = await airtable.batchUpdate({
				tableId: 'Tasks',
				records: [
					{ id: 'rec1', fields: { Status: 'Done' } },
					{ id: 'rec2', fields: { Status: 'Done' } },
				],
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
		});
	});

	describe('batchDelete', () => {
		it('should delete multiple records', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({
					records: [
						{ id: 'rec1', deleted: true },
						{ id: 'rec2', deleted: true },
					],
				}), { status: 200 })
			);

			const result = await airtable.batchDelete({
				tableId: 'Tasks',
				recordIds: ['rec1', 'rec2'],
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data[0].deleted).toBe(true);
		});

		it('should include record IDs in query params', async () => {
			vi.spyOn(global, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ records: [] }), { status: 200 })
			);

			await airtable.batchDelete({
				tableId: 'Tasks',
				recordIds: ['rec1', 'rec2'],
			});

			const calls = vi.mocked(global.fetch).mock.calls;
			const url = calls[0][0] as string;
			expect(url).toContain('records%5B%5D=rec1');
			expect(url).toContain('records%5B%5D=rec2');
		});
	});
});

// ============================================================================
// STANDARD TASK TRANSFORMATION TESTS
// ============================================================================

describe('Airtable StandardTask Transformation', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should transform record to StandardTask', async () => {
		const mockRecord = {
			id: 'recXXX',
			createdTime: '2024-01-01T00:00:00.000Z',
			fields: {
				Name: 'Test Task',
				Status: 'In Progress',
				Priority: 'High',
				'Due Date': '2024-01-15',
				Description: 'Test description',
			},
		};

		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockRecord), { status: 200 })
		);

		const result = await airtable.getTask('Tasks', 'recXXX');

		expect(result.success).toBe(true);
		expect(result.standard).toBeDefined();
		expect(result.standard?.type).toBe('task');
		expect(result.standard?.title).toBe('Test Task');
		expect(result.standard?.status).toBe('in_progress');
		expect(result.standard?.priority).toBe('high');
	});

	it('should map done status correctly', async () => {
		const mockRecord = {
			id: 'recXXX',
			createdTime: '2024-01-01T00:00:00.000Z',
			fields: {
				Name: 'Completed Task',
				Status: 'Done',
			},
		};

		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockRecord), { status: 200 })
		);

		const result = await airtable.getTask('Tasks', 'recXXX');

		expect(result.standard?.status).toBe('done');
	});

	it('should handle missing optional fields', async () => {
		const mockRecord = {
			id: 'recXXX',
			createdTime: '2024-01-01T00:00:00.000Z',
			fields: {
				Title: 'Simple Task',
			},
		};

		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockRecord), { status: 200 })
		);

		const result = await airtable.getTask('Tasks', 'recXXX');

		expect(result.success).toBe(true);
		expect(result.standard?.title).toBe('Simple Task');
		expect(result.standard?.status).toBe('todo');
	});
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Airtable Error Handling', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should handle 401 unauthorized', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'Invalid token' } }), { status: 401 })
		);

		const result = await airtable.listRecords({ tableId: 'Tasks' });

		expect(result.success).toBe(false);
		expect(result.metadata.source.integration).toBe('airtable');
	});

	it('should handle 404 not found', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'Record not found' } }), { status: 404 })
		);

		const result = await airtable.getRecord({
			tableId: 'Tasks',
			recordId: 'nonexistent',
		});

		expect(result.success).toBe(false);
	});

	it('should handle 422 validation error', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({
				error: { message: 'Invalid field value', type: 'INVALID_REQUEST_UNKNOWN' },
			}), { status: 422 })
		);

		const result = await airtable.createRecord({
			tableId: 'Tasks',
			fields: { InvalidField: 'value' },
		});

		expect(result.success).toBe(false);
	});

	it('should handle 429 rate limit', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'Rate limited' } }), {
				status: 429,
				headers: { 'Retry-After': '30' },
			})
		);

		const result = await airtable.listRecords({ tableId: 'Tasks' });

		expect(result.success).toBe(false);
	});

	it('should handle network errors', async () => {
		vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

		const result = await airtable.listRecords({ tableId: 'Tasks' });

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain('Network error');
	});
});

// ============================================================================
// URL ENCODING TESTS
// ============================================================================

describe('Airtable URL Encoding', () => {
	let airtable: Airtable;

	beforeEach(() => {
		airtable = new Airtable({
			accessToken: 'pat_test_token',
			baseId: 'appXXXXXXXXXXXXXX',
		});
		vi.spyOn(global, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ records: [] }), { status: 200 })
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should properly encode table names with spaces', async () => {
		await airtable.listRecords({ tableId: 'My Tasks Table' });

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('My%20Tasks%20Table');
	});

	it('should properly encode special characters in filter formulas', async () => {
		await airtable.listRecords({
			tableId: 'Tasks',
			filterByFormula: "AND({Status} = 'Done', {Priority} = 'High')",
		});

		const calls = vi.mocked(global.fetch).mock.calls;
		const url = calls[0][0] as string;
		expect(url).toContain('filterByFormula=');
	});
});

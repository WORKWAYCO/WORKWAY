/**
 * D1 Helpers Tests
 *
 * Tests for JSON field serialization and read replica helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	jsonField,
	parseJsonField,
	isJsonObject,
	safeJsonStringify,
	readQuery,
	readFirst,
	createReadHelper,
	D1SchemaChecker,
} from './d1-helpers';

// =============================================================================
// JSON FIELD HELPERS
// =============================================================================

describe('jsonField', () => {
	it('should serialize object to JSON string', () => {
		const obj = { key: 'value', nested: { a: 1 } };
		const result = jsonField(obj);

		// Result should be a string when checked
		expect(typeof result).toBe('string');
		expect(JSON.parse(result as unknown as string)).toEqual(obj);
	});

	it('should handle empty objects', () => {
		const result = jsonField({});
		expect(JSON.parse(result as unknown as string)).toEqual({});
	});

	it('should handle arrays in objects', () => {
		const obj = { items: [1, 2, 3], tags: ['a', 'b'] };
		const result = jsonField(obj);
		expect(JSON.parse(result as unknown as string)).toEqual(obj);
	});

	it('should handle special characters', () => {
		const obj = { text: 'Hello "world"', path: 'foo\\bar' };
		const result = jsonField(obj);
		expect(JSON.parse(result as unknown as string)).toEqual(obj);
	});
});

describe('parseJsonField', () => {
	it('should parse valid JSON string', () => {
		const json = '{"key": "value"}';
		const result = parseJsonField(json);
		expect(result).toEqual({ key: 'value' });
	});

	it('should return object as-is if already parsed', () => {
		const obj = { key: 'value' };
		const result = parseJsonField(obj);
		expect(result).toEqual(obj);
	});

	it('should return fallback for null', () => {
		const fallback = { default: true };
		const result = parseJsonField(null, fallback);
		expect(result).toEqual(fallback);
	});

	it('should return fallback for undefined', () => {
		const fallback = { default: true };
		const result = parseJsonField(undefined, fallback);
		expect(result).toEqual(fallback);
	});

	it('should return fallback for invalid JSON', () => {
		const fallback = { default: true };
		const result = parseJsonField('not valid json', fallback);
		expect(result).toEqual(fallback);
	});

	it('should return empty object as default fallback', () => {
		const result = parseJsonField(null);
		expect(result).toEqual({});
	});

	it('should handle number values', () => {
		const result = parseJsonField(123, { default: true });
		expect(result).toEqual({ default: true });
	});

	it('should handle boolean values', () => {
		const result = parseJsonField(true, { default: true });
		expect(result).toEqual({ default: true });
	});
});

describe('isJsonObject', () => {
	it('should return true for plain objects', () => {
		expect(isJsonObject({})).toBe(true);
		expect(isJsonObject({ key: 'value' })).toBe(true);
	});

	it('should return false for arrays', () => {
		expect(isJsonObject([])).toBe(false);
		expect(isJsonObject([1, 2, 3])).toBe(false);
	});

	it('should return false for null', () => {
		expect(isJsonObject(null)).toBe(false);
	});

	it('should return false for primitives', () => {
		expect(isJsonObject('string')).toBe(false);
		expect(isJsonObject(123)).toBe(false);
		expect(isJsonObject(true)).toBe(false);
		expect(isJsonObject(undefined)).toBe(false);
	});
});

describe('safeJsonStringify', () => {
	it('should stringify valid objects', () => {
		expect(safeJsonStringify({ key: 'value' })).toBe('{"key":"value"}');
	});

	it('should return "null" for undefined', () => {
		expect(safeJsonStringify(undefined)).toBe('null');
	});

	it('should return "null" for circular references', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(safeJsonStringify(circular)).toBe('null');
	});

	it('should handle null', () => {
		expect(safeJsonStringify(null)).toBe('null');
	});

	it('should handle primitives', () => {
		expect(safeJsonStringify('hello')).toBe('"hello"');
		expect(safeJsonStringify(123)).toBe('123');
		expect(safeJsonStringify(true)).toBe('true');
	});
});

// =============================================================================
// READ QUERY HELPERS
// =============================================================================

describe('readQuery', () => {
	const mockDb = {
		prepare: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should execute query with default strong consistency', async () => {
		const mockResults = [{ id: 1 }, { id: 2 }];
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: mockResults }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readQuery(mockDb as unknown as D1Database, 'SELECT * FROM users');

		expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users');
		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'strong' });
		expect(result).toEqual(mockResults);
	});

	it('should execute query with eventual consistency', async () => {
		const mockResults = [{ id: 1 }];
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: mockResults }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readQuery(
			mockDb as unknown as D1Database,
			'SELECT * FROM users WHERE id = ?',
			[1],
			{ consistency: 'eventual' }
		);

		expect(mockStmt.bind).toHaveBeenCalledWith(1);
		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'eventual' });
		expect(result).toEqual(mockResults);
	});

	it('should return empty array when results is undefined', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({}),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readQuery(mockDb as unknown as D1Database, 'SELECT * FROM empty');

		expect(result).toEqual([]);
	});

	it('should handle multiple parameters', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		await readQuery(
			mockDb as unknown as D1Database,
			'SELECT * FROM users WHERE status = ? AND role = ?',
			['active', 'admin']
		);

		expect(mockStmt.bind).toHaveBeenCalledWith('active', 'admin');
	});
});

describe('readFirst', () => {
	const mockDb = {
		prepare: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return first result', async () => {
		const mockResult = { id: 1, name: 'Test' };
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue(mockResult),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readFirst(
			mockDb as unknown as D1Database,
			'SELECT * FROM users WHERE id = ?',
			[1]
		);

		expect(result).toEqual(mockResult);
	});

	it('should return null when no result', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue(null),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readFirst(mockDb as unknown as D1Database, 'SELECT * FROM users WHERE id = ?', [999]);

		expect(result).toBeNull();
	});

	it('should use eventual consistency when specified', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue({ id: 1 }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		await readFirst(
			mockDb as unknown as D1Database,
			'SELECT * FROM users WHERE id = ?',
			[1],
			{ consistency: 'eventual' }
		);

		expect(mockStmt.first).toHaveBeenCalledWith({ consistency: 'eventual' });
	});
});

describe('createReadHelper', () => {
	const mockDb = {
		prepare: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create helper with default eventual consistency', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
			first: vi.fn().mockResolvedValue(null),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const helper = createReadHelper(mockDb as unknown as D1Database);

		await helper.query('SELECT * FROM users');
		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'eventual' });

		await helper.first('SELECT * FROM users WHERE id = ?', [1]);
		expect(mockStmt.first).toHaveBeenCalledWith({ consistency: 'eventual' });
	});

	it('should respect custom default consistency', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const helper = createReadHelper(mockDb as unknown as D1Database, 'strong');

		await helper.query('SELECT * FROM users');
		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'strong' });
	});
});

// =============================================================================
// SCHEMA CHECKER
// =============================================================================

describe('D1SchemaChecker', () => {
	const mockDb = {
		prepare: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getTableColumns', () => {
		it('should return column info from PRAGMA', async () => {
			const mockColumns = [
				{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
				{ cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
			];
			const mockStmt = {
				all: vi.fn().mockResolvedValue({ results: mockColumns }),
			};
			mockDb.prepare.mockReturnValue(mockStmt);

			const checker = new D1SchemaChecker(mockDb as unknown as D1Database);
			const columns = await checker.getTableColumns('users');

			expect(mockDb.prepare).toHaveBeenCalledWith('PRAGMA table_info(users)');
			expect(columns).toEqual(mockColumns);
		});
	});

	describe('compareTable', () => {
		it('should identify matching schema', async () => {
			const mockColumns = [
				{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
				{ cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
			];
			const mockStmt = {
				all: vi.fn().mockResolvedValue({ results: mockColumns }),
			};
			mockDb.prepare.mockReturnValue(mockStmt);

			const checker = new D1SchemaChecker(mockDb as unknown as D1Database);
			const diff = await checker.compareTable('users', ['id', 'name']);

			expect(diff.matched).toBe(true);
			expect(diff.missingColumns).toEqual([]);
			expect(diff.extraColumns).toEqual([]);
		});

		it('should identify missing columns', async () => {
			const mockColumns = [
				{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
			];
			const mockStmt = {
				all: vi.fn().mockResolvedValue({ results: mockColumns }),
			};
			mockDb.prepare.mockReturnValue(mockStmt);

			const checker = new D1SchemaChecker(mockDb as unknown as D1Database);
			const diff = await checker.compareTable('users', ['id', 'name', 'email']);

			expect(diff.matched).toBe(false);
			expect(diff.missingColumns).toEqual(['name', 'email']);
		});

		it('should identify extra columns', async () => {
			const mockColumns = [
				{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
				{ cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
				{ cid: 2, name: 'legacy_field', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
			];
			const mockStmt = {
				all: vi.fn().mockResolvedValue({ results: mockColumns }),
			};
			mockDb.prepare.mockReturnValue(mockStmt);

			const checker = new D1SchemaChecker(mockDb as unknown as D1Database);
			const diff = await checker.compareTable('users', ['id', 'name']);

			expect(diff.matched).toBe(false);
			expect(diff.extraColumns).toEqual(['legacy_field']);
		});
	});

	describe('generateMigrationSQL', () => {
		it('should generate ALTER TABLE statements', () => {
			const checker = new D1SchemaChecker(mockDb as unknown as D1Database);
			const diff = {
				tableName: 'users',
				actualColumns: ['id'],
				expectedColumns: ['id', 'name', 'email'],
				missingColumns: ['name', 'email'],
				extraColumns: [],
				matched: false,
			};

			const sql = checker.generateMigrationSQL(diff, {
				name: 'TEXT NOT NULL',
				email: 'TEXT',
			});

			expect(sql).toEqual([
				'ALTER TABLE users ADD COLUMN name TEXT NOT NULL;',
				'ALTER TABLE users ADD COLUMN email TEXT;',
			]);
		});

		it('should use TEXT as default type', () => {
			const checker = new D1SchemaChecker(mockDb as unknown as D1Database);
			const diff = {
				tableName: 'users',
				actualColumns: [],
				expectedColumns: ['unknown_field'],
				missingColumns: ['unknown_field'],
				extraColumns: [],
				matched: false,
			};

			const sql = checker.generateMigrationSQL(diff, {});

			expect(sql).toEqual(['ALTER TABLE users ADD COLUMN unknown_field TEXT;']);
		});
	});
});

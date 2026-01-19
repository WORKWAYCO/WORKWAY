/**
 * D1 Helpers Tests
 *
 * Focus: Edge cases in parsing and fallback behavior.
 * Pruned: Trivial JSON.stringify tests, basic type guards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	parseJsonField,
	safeJsonStringify,
	readQuery,
	readFirst,
	createReadHelper,
} from './d1-helpers';

// =============================================================================
// JSON PARSING EDGE CASES
// =============================================================================

describe('parseJsonField', () => {
	it('should return object as-is if already parsed (D1 may pre-parse)', () => {
		const obj = { key: 'value' };
		expect(parseJsonField(obj)).toEqual(obj);
	});

	it('should return fallback for invalid JSON (corrupted data)', () => {
		const fallback = { default: true };
		expect(parseJsonField('not valid json', fallback)).toEqual(fallback);
		expect(parseJsonField('{broken', fallback)).toEqual(fallback);
	});

	it('should return fallback for null/undefined (missing data)', () => {
		const fallback = { default: true };
		expect(parseJsonField(null, fallback)).toEqual(fallback);
		expect(parseJsonField(undefined, fallback)).toEqual(fallback);
	});

	it('should return empty object as default fallback', () => {
		expect(parseJsonField(null)).toEqual({});
	});

	it('should handle unexpected types gracefully', () => {
		const fallback = { default: true };
		expect(parseJsonField(123, fallback)).toEqual(fallback);
		expect(parseJsonField(true, fallback)).toEqual(fallback);
	});
});

describe('safeJsonStringify', () => {
	it('should return "null" for circular references (prevents crash)', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(safeJsonStringify(circular)).toBe('null');
	});

	it('should return "null" for undefined', () => {
		expect(safeJsonStringify(undefined)).toBe('null');
	});
});

// =============================================================================
// READ REPLICA CONSISTENCY
// =============================================================================

describe('readQuery consistency', () => {
	const mockDb = { prepare: vi.fn() };

	beforeEach(() => vi.clearAllMocks());

	it('should default to strong consistency', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		await readQuery(mockDb as unknown as D1Database, 'SELECT 1');

		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'strong' });
	});

	it('should use eventual consistency for read replicas when specified', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		await readQuery(mockDb as unknown as D1Database, 'SELECT 1', [], { consistency: 'eventual' });

		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'eventual' });
	});

	it('should return empty array when D1 returns undefined results', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({}), // No results field
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readQuery(mockDb as unknown as D1Database, 'SELECT 1');

		expect(result).toEqual([]);
	});
});

describe('readFirst', () => {
	const mockDb = { prepare: vi.fn() };

	beforeEach(() => vi.clearAllMocks());

	it('should return null when no row found', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue(null),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const result = await readFirst(mockDb as unknown as D1Database, 'SELECT 1 WHERE 0');

		expect(result).toBeNull();
	});
});

describe('createReadHelper', () => {
	const mockDb = { prepare: vi.fn() };

	beforeEach(() => vi.clearAllMocks());

	it('should default to eventual consistency (optimized for reads)', async () => {
		const mockStmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
		};
		mockDb.prepare.mockReturnValue(mockStmt);

		const helper = createReadHelper(mockDb as unknown as D1Database);
		await helper.query('SELECT 1');

		expect(mockStmt.all).toHaveBeenCalledWith({ consistency: 'eventual' });
	});
});

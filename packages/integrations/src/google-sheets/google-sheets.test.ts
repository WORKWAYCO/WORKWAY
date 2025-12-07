/**
 * Google Sheets Integration Tests
 *
 * Tests for the Google Sheets integration client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleSheets } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GoogleSheets', () => {
	const testConfig = {
		accessToken: 'ya29.test_access_token',
	};

	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	// ============================================================================
	// CONSTRUCTOR TESTS
	// ============================================================================

	describe('constructor', () => {
		it('should create instance with valid config', () => {
			const client = new GoogleSheets(testConfig);
			expect(client).toBeInstanceOf(GoogleSheets);
		});

		it('should throw error if access token is missing', () => {
			expect(() => new GoogleSheets({ accessToken: '' })).toThrow();
		});
	});

	// ============================================================================
	// SPREADSHEET TESTS
	// ============================================================================

	describe('getSpreadsheet', () => {
		it('should get spreadsheet metadata', async () => {
			const mockSpreadsheet = {
				spreadsheetId: 'abc123',
				properties: {
					title: 'My Spreadsheet',
					locale: 'en_US',
					autoRecalc: 'ON_CHANGE',
					timeZone: 'America/New_York',
				},
				sheets: [
					{
						properties: {
							sheetId: 0,
							title: 'Sheet1',
							index: 0,
							sheetType: 'GRID',
							gridProperties: {
								rowCount: 1000,
								columnCount: 26,
							},
						},
					},
				],
				spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc123',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSpreadsheet),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.getSpreadsheet({ spreadsheetId: 'abc123' });

			expect(result.success).toBe(true);
			expect(result.data?.properties.title).toBe('My Spreadsheet');
			expect(result.data?.sheets).toHaveLength(1);
		});
	});

	describe('createSpreadsheet', () => {
		it('should create a new spreadsheet', async () => {
			const mockSpreadsheet = {
				spreadsheetId: 'new123',
				properties: {
					title: 'New Spreadsheet',
					locale: 'en_US',
					autoRecalc: 'ON_CHANGE',
					timeZone: 'America/New_York',
				},
				sheets: [],
				spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new123',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSpreadsheet),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.createSpreadsheet({ title: 'New Spreadsheet' });

			expect(result.success).toBe(true);
			expect(result.data?.spreadsheetId).toBe('new123');
		});

		it('should create spreadsheet with initial sheets', async () => {
			const mockSpreadsheet = {
				spreadsheetId: 'new123',
				properties: { title: 'Test', locale: 'en_US', autoRecalc: 'ON_CHANGE', timeZone: 'America/New_York' },
				sheets: [
					{ properties: { sheetId: 0, title: 'Data', index: 0, sheetType: 'GRID' } },
					{ properties: { sheetId: 1, title: 'Summary', index: 1, sheetType: 'GRID' } },
				],
				spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new123',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSpreadsheet),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.createSpreadsheet({
				title: 'Test',
				sheets: ['Data', 'Summary'],
			});

			expect(result.success).toBe(true);
			expect(result.data?.sheets).toHaveLength(2);
		});
	});

	// ============================================================================
	// VALUES TESTS
	// ============================================================================

	describe('getValues', () => {
		it('should get values from a range', async () => {
			const mockValueRange = {
				range: 'Sheet1!A1:D10',
				majorDimension: 'ROWS',
				values: [
					['Name', 'Email', 'Phone', 'Company'],
					['John Doe', 'john@example.com', '555-1234', 'Acme Inc'],
					['Jane Smith', 'jane@example.com', '555-5678', 'Tech Corp'],
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockValueRange),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.getValues({
				spreadsheetId: 'abc123',
				range: 'Sheet1!A1:D10',
			});

			expect(result.success).toBe(true);
			expect(result.data?.values).toHaveLength(3);
			expect(result.data?.values[0]).toEqual(['Name', 'Email', 'Phone', 'Company']);
		});

		it('should handle valueRenderOption parameter', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ range: 'A1:A1', majorDimension: 'ROWS', values: [[]] }),
			});

			const client = new GoogleSheets(testConfig);
			await client.getValues({
				spreadsheetId: 'abc123',
				range: 'A1:A1',
				valueRenderOption: 'UNFORMATTED_VALUE',
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('valueRenderOption=UNFORMATTED_VALUE'),
				expect.any(Object)
			);
		});
	});

	describe('batchGetValues', () => {
		it('should get values from multiple ranges', async () => {
			const mockResponse = {
				valueRanges: [
					{ range: 'Sheet1!A1:A5', majorDimension: 'ROWS', values: [['1'], ['2'], ['3']] },
					{ range: 'Sheet1!B1:B5', majorDimension: 'ROWS', values: [['a'], ['b'], ['c']] },
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.batchGetValues({
				spreadsheetId: 'abc123',
				ranges: ['Sheet1!A1:A5', 'Sheet1!B1:B5'],
			});

			expect(result.success).toBe(true);
			expect(result.data?.valueRanges).toHaveLength(2);
		});
	});

	describe('updateValues', () => {
		it('should update values in a range', async () => {
			const mockResponse = {
				spreadsheetId: 'abc123',
				updatedRange: 'Sheet1!A1:B2',
				updatedRows: 2,
				updatedColumns: 2,
				updatedCells: 4,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.updateValues({
				spreadsheetId: 'abc123',
				range: 'Sheet1!A1',
				values: [
					['Name', 'Value'],
					['Test', 123],
				],
			});

			expect(result.success).toBe(true);
			expect(result.data?.updatedCells).toBe(4);
		});
	});

	describe('appendValues', () => {
		it('should append values to a sheet', async () => {
			const mockResponse = {
				spreadsheetId: 'abc123',
				tableRange: 'Sheet1!A1:D10',
				updates: {
					spreadsheetId: 'abc123',
					updatedRange: 'Sheet1!A11:D11',
					updatedRows: 1,
					updatedColumns: 4,
					updatedCells: 4,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.appendValues({
				spreadsheetId: 'abc123',
				range: 'Sheet1!A:D',
				values: [['New', 'Row', 'Data', 'Here']],
			});

			expect(result.success).toBe(true);
			expect(result.data?.updates.updatedRows).toBe(1);
		});
	});

	describe('clearValues', () => {
		it('should clear values in a range', async () => {
			const mockResponse = {
				clearedRange: 'Sheet1!A1:D10',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.clearValues({
				spreadsheetId: 'abc123',
				range: 'Sheet1!A1:D10',
			});

			expect(result.success).toBe(true);
			expect(result.data?.clearedRange).toBe('Sheet1!A1:D10');
		});
	});

	// ============================================================================
	// SHEET OPERATIONS TESTS
	// ============================================================================

	describe('addSheet', () => {
		it('should add a new sheet', async () => {
			const mockResponse = {
				replies: [
					{
						addSheet: {
							properties: {
								sheetId: 12345,
								title: 'New Sheet',
								index: 1,
								sheetType: 'GRID',
								gridProperties: {
									rowCount: 1000,
									columnCount: 26,
								},
							},
						},
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.addSheet({
				spreadsheetId: 'abc123',
				title: 'New Sheet',
			});

			expect(result.success).toBe(true);
			expect(result.data?.properties.title).toBe('New Sheet');
		});
	});

	describe('deleteSheet', () => {
		it('should delete a sheet', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({}),
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.deleteSheet('abc123', 12345);

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ============================================================================
	// HELPER METHODS TESTS
	// ============================================================================

	describe('valuesToObjects', () => {
		it('should convert sheet values to objects', () => {
			const client = new GoogleSheets(testConfig);
			const values = [
				['name', 'email', 'age'],
				['John', 'john@example.com', 30],
				['Jane', 'jane@example.com', 25],
			];

			const objects = client.valuesToObjects(values);

			expect(objects).toHaveLength(2);
			expect(objects[0]).toEqual({ name: 'John', email: 'john@example.com', age: 30 });
			expect(objects[1]).toEqual({ name: 'Jane', email: 'jane@example.com', age: 25 });
		});

		it('should return empty array for insufficient data', () => {
			const client = new GoogleSheets(testConfig);

			expect(client.valuesToObjects([])).toEqual([]);
			expect(client.valuesToObjects([['header']])).toEqual([]);
		});

		it('should handle missing values', () => {
			const client = new GoogleSheets(testConfig);
			const values = [
				['a', 'b', 'c'],
				['1', '2'],
			];

			const objects = client.valuesToObjects(values);

			expect(objects[0]).toEqual({ a: '1', b: '2', c: null });
		});
	});

	describe('objectsToValues', () => {
		it('should convert objects to sheet values', () => {
			const client = new GoogleSheets(testConfig);
			const objects = [
				{ name: 'John', email: 'john@example.com' },
				{ name: 'Jane', email: 'jane@example.com' },
			];

			const values = client.objectsToValues(objects);

			expect(values).toHaveLength(3); // header + 2 rows
			expect(values[0]).toEqual(['name', 'email']);
			expect(values[1]).toEqual(['John', 'john@example.com']);
		});

		it('should use custom headers', () => {
			const client = new GoogleSheets(testConfig);
			const objects = [{ name: 'John', email: 'john@example.com', age: 30 }];

			const values = client.objectsToValues(objects, ['name', 'email']);

			expect(values[0]).toEqual(['name', 'email']);
			expect(values[1]).toEqual(['John', 'john@example.com']);
		});

		it('should return empty array for empty input', () => {
			const client = new GoogleSheets(testConfig);
			expect(client.objectsToValues([])).toEqual([]);
		});
	});

	// ============================================================================
	// ERROR HANDLING TESTS
	// ============================================================================

	describe('error handling', () => {
		it('should handle 401 unauthorized', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.getSpreadsheet({ spreadsheetId: 'abc123' });

			expect(result.success).toBe(false);
		});

		it('should handle 404 not found', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.getSpreadsheet({ spreadsheetId: 'nonexistent' });

			expect(result.success).toBe(false);
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
			});

			const client = new GoogleSheets(testConfig);
			const result = await client.getValues({
				spreadsheetId: 'abc123',
				range: 'A1:A1',
			});

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const client = new GoogleSheets(testConfig);
			const result = await client.getSpreadsheet({ spreadsheetId: 'abc123' });

			expect(result.success).toBe(false);
		});
	});
});

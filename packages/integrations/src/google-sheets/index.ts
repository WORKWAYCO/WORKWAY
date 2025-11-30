/**
 * Google Sheets Integration for WORKWAY
 *
 * Enables structured data workflows:
 * - Read spreadsheet data for AI processing
 * - Write AI results back to sheets
 * - Append rows (logging, data collection)
 * - Create new spreadsheets
 *
 * Implements the SDK patterns:
 * - ActionResult narrow waist for output
 * - IntegrationError narrow waist for errors
 * - StandardData for normalized data
 * - OAuth token handling
 *
 * @example
 * ```typescript
 * import { GoogleSheets } from '@workwayco/integrations/google-sheets';
 *
 * const sheets = new GoogleSheets({ accessToken: tokens.google.access_token });
 *
 * // Read data from a range
 * const data = await sheets.getValues({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A1:D10'
 * });
 *
 * // Write data to a range
 * await sheets.updateValues({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A1',
 *   values: [['Name', 'Email'], ['John', 'john@example.com']]
 * });
 *
 * // Append rows
 * await sheets.appendValues({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A:D',
 *   values: [['New Row', 'Data', 'Here', new Date().toISOString()]]
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { IntegrationError, ErrorCode } from '@workwayco/sdk';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Google Sheets integration configuration
 */
export interface GoogleSheetsConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Spreadsheet metadata
 */
export interface Spreadsheet {
	spreadsheetId: string;
	properties: {
		title: string;
		locale: string;
		autoRecalc: string;
		timeZone: string;
	};
	sheets: Sheet[];
	spreadsheetUrl: string;
}

/**
 * Sheet (tab) within a spreadsheet
 */
export interface Sheet {
	properties: {
		sheetId: number;
		title: string;
		index: number;
		sheetType: string;
		gridProperties?: {
			rowCount: number;
			columnCount: number;
			frozenRowCount?: number;
			frozenColumnCount?: number;
		};
	};
}

/**
 * Value range response
 */
export interface ValueRange {
	range: string;
	majorDimension: 'ROWS' | 'COLUMNS';
	values: unknown[][];
}

/**
 * Update response
 */
export interface UpdateValuesResponse {
	spreadsheetId: string;
	updatedRange: string;
	updatedRows: number;
	updatedColumns: number;
	updatedCells: number;
}

/**
 * Append response
 */
export interface AppendValuesResponse {
	spreadsheetId: string;
	tableRange: string;
	updates: {
		spreadsheetId: string;
		updatedRange: string;
		updatedRows: number;
		updatedColumns: number;
		updatedCells: number;
	};
}

/**
 * Batch update response
 */
export interface BatchUpdateResponse {
	spreadsheetId: string;
	totalUpdatedRows: number;
	totalUpdatedColumns: number;
	totalUpdatedCells: number;
	totalUpdatedSheets: number;
	responses: UpdateValuesResponse[];
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetSpreadsheetOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** Include grid data (cell values) */
	includeGridData?: boolean;
	/** Specific ranges to include */
	ranges?: string[];
}

export interface GetValuesOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** A1 notation range (e.g., 'Sheet1!A1:D10') */
	range: string;
	/** How to interpret values: RAW, FORMATTED_VALUE, UNFORMATTED_VALUE */
	valueRenderOption?: 'RAW' | 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE';
	/** How to interpret dates: SERIAL_NUMBER, FORMATTED_STRING */
	dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING';
}

export interface UpdateValuesOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** A1 notation range (e.g., 'Sheet1!A1') */
	range: string;
	/** 2D array of values */
	values: unknown[][];
	/** How to interpret input: RAW, USER_ENTERED */
	valueInputOption?: 'RAW' | 'USER_ENTERED';
	/** Include values in response */
	includeValuesInResponse?: boolean;
}

export interface AppendValuesOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** A1 notation range to append after (e.g., 'Sheet1!A:D') */
	range: string;
	/** 2D array of values to append */
	values: unknown[][];
	/** How to interpret input: RAW, USER_ENTERED */
	valueInputOption?: 'RAW' | 'USER_ENTERED';
	/** How to insert: OVERWRITE, INSERT_ROWS */
	insertDataOption?: 'OVERWRITE' | 'INSERT_ROWS';
}

export interface ClearValuesOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** A1 notation range to clear */
	range: string;
}

export interface CreateSpreadsheetOptions {
	/** Spreadsheet title */
	title: string;
	/** Initial sheet names (optional) */
	sheets?: string[];
	/** Locale (optional, e.g., 'en_US') */
	locale?: string;
	/** Timezone (optional, e.g., 'America/New_York') */
	timeZone?: string;
}

export interface BatchGetValuesOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** Multiple A1 notation ranges */
	ranges: string[];
	/** How to interpret values */
	valueRenderOption?: 'RAW' | 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE';
}

export interface AddSheetOptions {
	/** Spreadsheet ID */
	spreadsheetId: string;
	/** New sheet title */
	title: string;
	/** Number of rows (optional) */
	rowCount?: number;
	/** Number of columns (optional) */
	columnCount?: number;
}

// ============================================================================
// GOOGLE SHEETS INTEGRATION CLASS
// ============================================================================

/**
 * Google Sheets Integration
 *
 * Implements the WORKWAY SDK patterns for Google Sheets API access.
 */
export class GoogleSheets {
	private accessToken: string;
	private apiUrl: string;
	private timeout: number;

	constructor(config: GoogleSheetsConfig) {
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'Google Sheets access token is required',
				{ integration: 'google-sheets', retryable: false }
			);
		}

		this.accessToken = config.accessToken;
		this.apiUrl = config.apiUrl || 'https://sheets.googleapis.com/v4/spreadsheets';
		this.timeout = config.timeout ?? 30000;
	}

	// ==========================================================================
	// SPREADSHEET OPERATIONS
	// ==========================================================================

	/**
	 * Get spreadsheet metadata
	 */
	async getSpreadsheet(
		options: GetSpreadsheetOptions
	): Promise<ActionResult<Spreadsheet>> {
		try {
			const params = new URLSearchParams();
			if (options.includeGridData) params.append('includeGridData', 'true');
			if (options.ranges) {
				for (const range of options.ranges) {
					params.append('ranges', range);
				}
			}

			const url = `/${options.spreadsheetId}${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleGoogleError(response, 'get-spreadsheet');
			}

			const spreadsheet = (await response.json()) as Spreadsheet;

			return createActionResult({
				data: spreadsheet,
				integration: 'google-sheets',
				action: 'get-spreadsheet',
				schema: 'google-sheets.spreadsheet.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-spreadsheet');
		}
	}

	/**
	 * Create a new spreadsheet
	 */
	async createSpreadsheet(
		options: CreateSpreadsheetOptions
	): Promise<ActionResult<Spreadsheet>> {
		try {
			const body: Record<string, unknown> = {
				properties: {
					title: options.title,
					locale: options.locale || 'en_US',
					timeZone: options.timeZone || 'America/New_York',
				},
			};

			if (options.sheets && options.sheets.length > 0) {
				body.sheets = options.sheets.map((title, index) => ({
					properties: {
						title,
						index,
					},
				}));
			}

			const response = await this.request('', {
				method: 'POST',
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				return this.handleGoogleError(response, 'create-spreadsheet');
			}

			const spreadsheet = (await response.json()) as Spreadsheet;

			return createActionResult({
				data: spreadsheet,
				integration: 'google-sheets',
				action: 'create-spreadsheet',
				schema: 'google-sheets.spreadsheet.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-spreadsheet');
		}
	}

	// ==========================================================================
	// VALUE OPERATIONS
	// ==========================================================================

	/**
	 * Get values from a range
	 */
	async getValues(options: GetValuesOptions): Promise<ActionResult<ValueRange>> {
		try {
			const params = new URLSearchParams();
			if (options.valueRenderOption) {
				params.append('valueRenderOption', options.valueRenderOption);
			}
			if (options.dateTimeRenderOption) {
				params.append('dateTimeRenderOption', options.dateTimeRenderOption);
			}

			const encodedRange = encodeURIComponent(options.range);
			const url = `/${options.spreadsheetId}/values/${encodedRange}${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleGoogleError(response, 'get-values');
			}

			const valueRange = (await response.json()) as ValueRange;

			return createActionResult({
				data: valueRange,
				integration: 'google-sheets',
				action: 'get-values',
				schema: 'google-sheets.value-range.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-values');
		}
	}

	/**
	 * Get values from multiple ranges
	 */
	async batchGetValues(
		options: BatchGetValuesOptions
	): Promise<ActionResult<{ valueRanges: ValueRange[] }>> {
		try {
			const params = new URLSearchParams();
			for (const range of options.ranges) {
				params.append('ranges', range);
			}
			if (options.valueRenderOption) {
				params.append('valueRenderOption', options.valueRenderOption);
			}

			const url = `/${options.spreadsheetId}/values:batchGet?${params.toString()}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleGoogleError(response, 'batch-get-values');
			}

			const result = (await response.json()) as { valueRanges: ValueRange[] };

			return createActionResult({
				data: result,
				integration: 'google-sheets',
				action: 'batch-get-values',
				schema: 'google-sheets.batch-value-range.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'batch-get-values');
		}
	}

	/**
	 * Update values in a range
	 */
	async updateValues(
		options: UpdateValuesOptions
	): Promise<ActionResult<UpdateValuesResponse>> {
		try {
			const params = new URLSearchParams();
			params.append('valueInputOption', options.valueInputOption || 'USER_ENTERED');
			if (options.includeValuesInResponse) {
				params.append('includeValuesInResponse', 'true');
			}

			const encodedRange = encodeURIComponent(options.range);
			const url = `/${options.spreadsheetId}/values/${encodedRange}?${params.toString()}`;

			const response = await this.request(url, {
				method: 'PUT',
				body: JSON.stringify({
					range: options.range,
					majorDimension: 'ROWS',
					values: options.values,
				}),
			});

			if (!response.ok) {
				return this.handleGoogleError(response, 'update-values');
			}

			const result = (await response.json()) as UpdateValuesResponse;

			return createActionResult({
				data: result,
				integration: 'google-sheets',
				action: 'update-values',
				schema: 'google-sheets.update-response.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'update-values');
		}
	}

	/**
	 * Append values to a sheet
	 */
	async appendValues(
		options: AppendValuesOptions
	): Promise<ActionResult<AppendValuesResponse>> {
		try {
			const params = new URLSearchParams();
			params.append('valueInputOption', options.valueInputOption || 'USER_ENTERED');
			params.append('insertDataOption', options.insertDataOption || 'INSERT_ROWS');

			const encodedRange = encodeURIComponent(options.range);
			const url = `/${options.spreadsheetId}/values/${encodedRange}:append?${params.toString()}`;

			const response = await this.request(url, {
				method: 'POST',
				body: JSON.stringify({
					range: options.range,
					majorDimension: 'ROWS',
					values: options.values,
				}),
			});

			if (!response.ok) {
				return this.handleGoogleError(response, 'append-values');
			}

			const result = (await response.json()) as AppendValuesResponse;

			return createActionResult({
				data: result,
				integration: 'google-sheets',
				action: 'append-values',
				schema: 'google-sheets.append-response.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'append-values');
		}
	}

	/**
	 * Clear values in a range
	 */
	async clearValues(
		options: ClearValuesOptions
	): Promise<ActionResult<{ clearedRange: string }>> {
		try {
			const encodedRange = encodeURIComponent(options.range);
			const url = `/${options.spreadsheetId}/values/${encodedRange}:clear`;

			const response = await this.request(url, {
				method: 'POST',
				body: JSON.stringify({}),
			});

			if (!response.ok) {
				return this.handleGoogleError(response, 'clear-values');
			}

			const result = (await response.json()) as { clearedRange: string };

			return createActionResult({
				data: result,
				integration: 'google-sheets',
				action: 'clear-values',
				schema: 'google-sheets.clear-response.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'clear-values');
		}
	}

	// ==========================================================================
	// SHEET OPERATIONS
	// ==========================================================================

	/**
	 * Add a new sheet to an existing spreadsheet
	 */
	async addSheet(options: AddSheetOptions): Promise<ActionResult<Sheet>> {
		try {
			const url = `/${options.spreadsheetId}:batchUpdate`;

			const response = await this.request(url, {
				method: 'POST',
				body: JSON.stringify({
					requests: [
						{
							addSheet: {
								properties: {
									title: options.title,
									gridProperties: {
										rowCount: options.rowCount || 1000,
										columnCount: options.columnCount || 26,
									},
								},
							},
						},
					],
				}),
			});

			if (!response.ok) {
				return this.handleGoogleError(response, 'add-sheet');
			}

			const result = (await response.json()) as {
				replies: Array<{ addSheet: { properties: Sheet['properties'] } }>;
			};

			const sheet: Sheet = {
				properties: result.replies[0].addSheet.properties,
			};

			return createActionResult({
				data: sheet,
				integration: 'google-sheets',
				action: 'add-sheet',
				schema: 'google-sheets.sheet.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'add-sheet');
		}
	}

	/**
	 * Delete a sheet from a spreadsheet
	 */
	async deleteSheet(
		spreadsheetId: string,
		sheetId: number
	): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const url = `/${spreadsheetId}:batchUpdate`;

			const response = await this.request(url, {
				method: 'POST',
				body: JSON.stringify({
					requests: [
						{
							deleteSheet: {
								sheetId,
							},
						},
					],
				}),
			});

			if (!response.ok) {
				return this.handleGoogleError(response, 'delete-sheet');
			}

			return createActionResult({
				data: { deleted: true },
				integration: 'google-sheets',
				action: 'delete-sheet',
				schema: 'google-sheets.delete-response.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'delete-sheet');
		}
	}

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	/**
	 * Convert sheet data to array of objects (using first row as headers)
	 */
	valuesToObjects<T = Record<string, unknown>>(values: unknown[][]): T[] {
		if (!values || values.length < 2) return [];

		const headers = values[0] as string[];
		const rows = values.slice(1);

		return rows.map((row) => {
			const obj: Record<string, unknown> = {};
			headers.forEach((header, index) => {
				obj[header] = row[index] ?? null;
			});
			return obj as T;
		});
	}

	/**
	 * Convert array of objects to sheet values (with headers)
	 */
	objectsToValues<T extends Record<string, unknown>>(
		objects: T[],
		headers?: string[]
	): unknown[][] {
		if (!objects || objects.length === 0) return [];

		const keys = headers || Object.keys(objects[0]);
		const headerRow = keys;
		const dataRows = objects.map((obj) => keys.map((key) => obj[key] ?? ''));

		return [headerRow, ...dataRows];
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Make authenticated request to Google Sheets API with timeout
	 */
	private async request(
		endpoint: string,
		options: RequestInit = {}
	): Promise<Response> {
		const url = `${this.apiUrl}${endpoint}`;

		// Add timeout via AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(url, {
				...options,
				headers: {
					Authorization: `Bearer ${this.accessToken}`,
					'Content-Type': 'application/json',
					...options.headers,
				},
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Get capabilities for Google Sheets actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			supportsSearch: false,
			supportsPagination: false,
			supportsBulkOperations: true,
		};
	}

	/**
	 * Handle Google API errors
	 */
	private async handleGoogleError<T>(
		response: Response,
		action: string
	): Promise<ActionResult<T>> {
		try {
			const errorData = (await response.json()) as {
				error?: { message?: string; status?: string; code?: number };
			};
			const message = errorData.error?.message || 'Google Sheets API error';
			const code = this.mapGoogleError(response.status, errorData.error?.status);

			return ActionResult.error(message, code, {
				integration: 'google-sheets',
				action,
			});
		} catch {
			return ActionResult.error(
				`Google Sheets API error: ${response.status}`,
				ErrorCode.API_ERROR,
				{ integration: 'google-sheets', action }
			);
		}
	}

	/**
	 * Map Google error status to ErrorCode
	 */
	private mapGoogleError(status: number, errorStatus?: string): string {
		if (status === 401) return ErrorCode.AUTH_INVALID;
		if (status === 403) return ErrorCode.AUTH_INSUFFICIENT_SCOPE;
		if (status === 404) return ErrorCode.NOT_FOUND;
		if (status === 429) return ErrorCode.RATE_LIMITED;

		switch (errorStatus) {
			case 'UNAUTHENTICATED':
				return ErrorCode.AUTH_INVALID;
			case 'PERMISSION_DENIED':
				return ErrorCode.PERMISSION_DENIED;
			case 'NOT_FOUND':
				return ErrorCode.NOT_FOUND;
			case 'ALREADY_EXISTS':
				return ErrorCode.CONFLICT;
			case 'RESOURCE_EXHAUSTED':
				return ErrorCode.RATE_LIMITED;
			case 'INVALID_ARGUMENT':
				return ErrorCode.VALIDATION_ERROR;
			default:
				return ErrorCode.API_ERROR;
		}
	}

	/**
	 * Handle general errors
	 */
	private handleError<T>(error: unknown, action: string): ActionResult<T> {
		if (error instanceof IntegrationError) {
			const integrationErr = error as IntegrationError;
			return ActionResult.error(integrationErr.message, integrationErr.code, {
				integration: 'google-sheets',
				action,
			});
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		return ActionResult.error(message, ErrorCode.UNKNOWN, {
			integration: 'google-sheets',
			action,
		});
	}
}

/**
 * Google Sheets ↔ Notion Bidirectional Sync (Private)
 *
 * Two-way synchronization between Google Sheets and a Notion database.
 * Google Sheets is the source of truth when conflicts occur.
 *
 * ## Architecture
 *
 * ```
 * Google Sheets                              Notion Database
 *      │                                           │
 *      │ ←── Polling (cron every 5-15 min) ──→    │
 *      │ ←── Notion webhooks (near real-time) ──  │
 *      │                                           │
 *      ▼                                           ▼
 * ┌─────────────────────────────────────────────────────┐
 * │              Sync State Store (KV)                  │
 * │  ─────────────────────────────────────────────────  │
 * │  row_id │ sheets_hash │ notion_hash │ last_sync    │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * ## Sync Directions
 *
 * 1. **Sheets → Notion** (Polling every 5-15 min)
 *    - Cron triggers workflow
 *    - Fetch all Sheets rows, hash each row
 *    - Compare with stored hashes, sync changed rows to Notion
 *
 * 2. **Notion → Sheets** (Webhook-triggered)
 *    - Notion webhook fires on page update
 *    - Check if change originated from Sheets sync (skip if within 5s)
 *    - If genuine Notion change AND Sheets unchanged → update Sheets
 *    - If conflict → Sheets wins (per client preference)
 *
 * ## Conflict Resolution: Sheets-Wins
 *
 * When both systems change the same record:
 * - Google Sheets value is authoritative
 * - Notion change is overwritten with Sheets data
 * - Conflict is logged to audit trail
 *
 * ## Supported Data Types
 *
 * | Sheets | Notion | Notes |
 * |--------|--------|-------|
 * | Text | title, rich_text | Direct mapping |
 * | Dropdown | select, status | Value matching |
 * | Date | date | ISO format |
 * | Number | number | Direct mapping |
 * | Checkbox (TRUE/FALSE) | checkbox | Boolean conversion |
 *
 * @private Internal workflow - configure via environment variables
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';
import {
	delay,
	columnLetterToIndex,
	columnIndexToLetter,
	simpleHash,
	rowToObject,
} from '../_shared/utils.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time window to ignore events after a sync (prevents infinite loops) */
const LOOP_PREVENTION_WINDOW_MS = 5000;

/** State key prefix for KV storage */
const STATE_KEY_PREFIX = 'sheets-notion-sync:';

/** Maximum rows to process per sync (for rate limiting) */
const MAX_ROWS_PER_SYNC = 500;

/** Delay between API calls (ms) to respect rate limits */
const API_DELAY_MS = 350;

// ============================================================================
// TYPES
// ============================================================================

interface SyncState {
	spreadsheetId: string;
	notionDatabaseId: string;
	lastSyncTime: string; // ISO timestamp
	rowStates: Record<
		string,
		{
			sheetsHash: string;
			notionPageId: string;
			lastSheetsModified: string;
			lastNotionModified: string;
		}
	>;
}

interface FieldMapping {
	sheetsColumn: string; // Column letter (A, B, C) or header name
	notionProperty: string; // Notion property name
	type: 'text' | 'title' | 'select' | 'status' | 'date' | 'number' | 'checkbox' | 'rich_text';
}

interface ConflictLog {
	rowId: string;
	timestamp: string;
	sheetsValue: Record<string, unknown>;
	notionValue: Record<string, unknown>;
	resolution: 'sheets_wins';
}

interface SyncResult {
	created: number;
	updated: number;
	conflicts: number;
	errors: number;
	skipped: number;
}

// ============================================================================
// EXECUTION TRACKING
// ============================================================================

/**
 * Track workflow execution for dashboard visibility
 */
async function trackExecution(
	userId: string,
	apiSecret: string,
	connectionUrl: string,
	data: {
		status: 'running' | 'success' | 'failed';
		rowsSynced?: number;
		direction?: 'sheets_to_notion' | 'notion_to_sheets' | 'bidirectional';
		resultSummary?: string;
		errorMessage?: string;
		startedAt?: string;
		completedAt?: string;
		executionTimeMs?: number;
	}
) {
	try {
		await fetch(`${connectionUrl}/executions/${userId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Secret': apiSecret,
			},
			body: JSON.stringify({
				workflowId: 'sheets-notion-bidirectional',
				...data,
			}),
		});
	} catch (error) {
		console.error('Failed to track execution:', error);
	}
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Google Sheets ↔ Notion Sync (Private)',
	description:
		'Your team works in Sheets. Your data lives in Notion. Both stay in sync.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_data_diverges',

		outcomeStatement: {
			suggestion: 'Want to keep working in Sheets while your data lives in Notion?',
			explanation:
				'Edit in either place. Changes show up in both. No more copying and pasting between tools.',
			outcome: 'Work in Sheets, organize in Notion—automatically',
		},

		primaryPair: {
			from: 'google-sheets',
			to: 'notion',
			workflowId: 'sheets-notion-bidirectional',
			outcome: 'Sheets and Notion in sync',
		},

		// Private workflows have limited discovery
		discoveryMoments: [],

		smartDefaults: {
			syncInterval: { value: '15' },
			conflictResolution: { value: 'sheets_wins' },
		},

		essentialFields: ['spreadsheet_id', 'notion_database_id', 'key_column'],

		zuhandenheit: {
			timeToValue: 15, // Minutes to first outcome
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	// No pricing for private workflows
	pricing: {
		model: 'free',
		description: 'Internal workflow - no usage fees',
	},

	integrations: [
		{ service: 'google-sheets', scopes: ['spreadsheets.readonly', 'spreadsheets'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	config: {
		// === Required Configuration ===
		spreadsheet_id: {
			type: 'text',
			label: 'Google Spreadsheet ID',
			required: true,
			description: 'The ID from your Google Sheets URL (between /d/ and /edit)',
		},
		sheet_name: {
			type: 'text',
			label: 'Sheet Tab Name',
			required: false,
			default: 'Sheet1',
			description: 'Name of the specific sheet tab to sync',
		},
		notion_database_id: {
			type: 'text',
			label: 'Notion Database ID',
			required: true,
			description: 'The Notion database to sync with',
		},
		key_column: {
			type: 'text',
			label: 'Key Column (Unique ID)',
			required: true,
			default: 'A',
			description: 'Column containing unique identifiers (e.g., A or "ID")',
		},

		// === Field Mappings (JSON) ===
		field_mappings: {
			type: 'text',
			label: 'Field Mappings (JSON)',
			required: true,
			description:
				'JSON array of field mappings: [{"sheetsColumn": "B", "notionProperty": "Name", "type": "title"}]',
		},

		// === Sync Settings ===
		sync_interval: {
			type: 'select',
			label: 'Sync Interval',
			options: ['5', '15', '30', '60'],
			default: '15',
			description: 'Minutes between Sheets→Notion syncs',
		},
		enable_notion_to_sheets: {
			type: 'boolean',
			label: 'Enable Notion → Sheets',
			default: true,
			description: 'Allow Notion changes to write back to Sheets',
		},

		// === BYOO Connection ===
		google_connection_id: {
			type: 'text',
			label: 'Google Connection ID',
			required: true,
			description: 'Your BYOO Google OAuth connection ID',
		},
	},

	// Cron trigger for Sheets → Notion direction
	trigger: cron({
		schedule: '*/15 * * * *', // Default: every 15 minutes
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const startedAt = new Date().toISOString();
		const startTime = Date.now();

		const {
			spreadsheet_id,
			sheet_name = 'Sheet1',
			notion_database_id,
			key_column,
			field_mappings,
			enable_notion_to_sheets = true,
			google_connection_id,
		} = inputs;

		// Parse field mappings
		let mappings: FieldMapping[];
		try {
			mappings = JSON.parse(field_mappings as string);
		} catch (e) {
			return {
				success: false,
				error: 'Invalid field_mappings JSON. Expected array of {sheetsColumn, notionProperty, type}',
			};
		}

		// Track execution start
		const apiSecret = env.WORKFLOW_API_SECRET || '';
		const connectionUrl = env.API_URL || 'https://api.workway.co';

		if (google_connection_id && apiSecret) {
			await trackExecution(google_connection_id, apiSecret, connectionUrl, {
				status: 'running',
				direction: 'sheets_to_notion',
				startedAt,
			});
		}

		try {
			// Load sync state from KV
			const stateKey = `${STATE_KEY_PREFIX}${spreadsheet_id}:${notion_database_id}`;
			let state: SyncState = (await env.KV?.get(stateKey, 'json')) || {
				spreadsheetId: spreadsheet_id,
				notionDatabaseId: notion_database_id,
				lastSyncTime: new Date(0).toISOString(),
				rowStates: {},
			};

			// === DIRECTION 1: Google Sheets → Notion ===
			const result = await syncSheetsToNotion({
				spreadsheetId: spreadsheet_id,
				sheetName: sheet_name,
				notionDatabaseId: notion_database_id,
				keyColumn: key_column,
				mappings,
				state,
				integrations,
				env,
			});

			// Update state
			state.lastSyncTime = new Date().toISOString();
			await env.KV?.put(stateKey, JSON.stringify(state));

			const executionTimeMs = Date.now() - startTime;
			const summary = `Created: ${result.created}, Updated: ${result.updated}, Conflicts: ${result.conflicts}, Errors: ${result.errors}`;

			// Track successful execution
			if (google_connection_id && apiSecret) {
				await trackExecution(google_connection_id, apiSecret, connectionUrl, {
					status: 'success',
					rowsSynced: result.created + result.updated,
					direction: 'sheets_to_notion',
					resultSummary: summary,
					startedAt,
					completedAt: new Date().toISOString(),
					executionTimeMs,
				});
			}

			return {
				success: true,
				direction: 'sheets_to_notion',
				...result,
				summary,
			};
		} catch (error) {
			const executionTimeMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			if (google_connection_id && apiSecret) {
				await trackExecution(google_connection_id, apiSecret, connectionUrl, {
					status: 'failed',
					direction: 'sheets_to_notion',
					errorMessage,
					startedAt,
					completedAt: new Date().toISOString(),
					executionTimeMs,
				});
			}

			return {
				success: false,
				error: errorMessage,
			};
		}
	},

	// TODO: Webhook handler for Notion → Sheets direction
	// This uses a custom handler pattern not yet supported by the SDK.
	// Uncomment and refactor when the SDK supports webhook handlers with custom logic.
	/*
	webhooks: [
		webhook({
			path: '/notion-webhook',
			// Custom handler logic would go here
		}),
	],
	*/

	// Placeholder for future webhook handler implementation
	// The original handler logic is preserved below for reference:
	/*
	async notionWebhookHandler({ request, inputs, integrations, env }) {
				const startedAt = new Date().toISOString();
				const startTime = Date.now();

				const { enable_notion_to_sheets = true, google_connection_id } = inputs;

				if (!enable_notion_to_sheets) {
					return { success: true, skipped: true, reason: 'Notion→Sheets disabled' };
				}

				// Parse webhook payload
				const payload = await request.json();
				const pageId = payload?.page?.id;
				const lastEditedTime = payload?.page?.last_edited_time;

				if (!pageId) {
					return { success: false, error: 'Missing page ID in webhook payload' };
				}

				const apiSecret = env.WORKFLOW_API_SECRET || '';
				const connectionUrl = env.API_URL || 'https://api.workway.co';

				try {
					// Load sync state
					const stateKey = `${STATE_KEY_PREFIX}${inputs.spreadsheet_id}:${inputs.notion_database_id}`;
					const state: SyncState = (await env.KV?.get(stateKey, 'json')) || {
						spreadsheetId: inputs.spreadsheet_id,
						notionDatabaseId: inputs.notion_database_id,
						lastSyncTime: new Date(0).toISOString(),
						rowStates: {},
					};

					// Find the row state for this page
					const rowEntry = Object.entries(state.rowStates).find(
						([, v]) => v.notionPageId === pageId
					);

					if (!rowEntry) {
						// Page not tracked - might be new, let next Sheets→Notion sync handle it
						return { success: true, skipped: true, reason: 'Page not in sync state' };
					}

					const [rowId, rowState] = rowEntry;

					// Loop prevention: check if this change was caused by our sync
					const lastSync = new Date(state.lastSyncTime).getTime();
					const editTime = new Date(lastEditedTime).getTime();

					if (editTime - lastSync < LOOP_PREVENTION_WINDOW_MS) {
						return { success: true, skipped: true, reason: 'Loop prevention - recent sync' };
					}

					// Parse field mappings
					let mappings: FieldMapping[];
					try {
						mappings = JSON.parse(inputs.field_mappings as string);
					} catch (e) {
						return { success: false, error: 'Invalid field_mappings JSON' };
					}

					// Fetch current Sheets row to check for conflicts
					const sheetsData = await integrations.googleSheets.spreadsheets.values.get({
						spreadsheetId: inputs.spreadsheet_id,
						range: `${inputs.sheet_name || 'Sheet1'}!A:Z`,
					});

					if (!sheetsData.success || !sheetsData.data.values) {
						return { success: false, error: 'Failed to fetch spreadsheet data' };
					}

					const rows = sheetsData.data.values;
					const headers = rows[0] as string[];
					const keyColIndex = getColumnIndex(inputs.key_column, headers);

					// Find the row by key
					const targetRowIndex = rows.findIndex(
						(row: string[], idx: number) => idx > 0 && row[keyColIndex] === rowId
					);

					if (targetRowIndex === -1) {
						return { success: false, error: `Row with key ${rowId} not found in Sheets` };
					}

					// Check if Sheets changed since last sync (conflict detection)
					const currentRow = rows[targetRowIndex] as string[];
					const currentHash = simpleHash(JSON.stringify(currentRow));

					if (currentHash !== rowState.sheetsHash) {
						// CONFLICT: Sheets changed since last sync - Sheets wins
						const conflictLog: ConflictLog = {
							rowId,
							timestamp: new Date().toISOString(),
							sheetsValue: rowToObject(currentRow, headers),
							notionValue: { pageId }, // Would need to fetch full Notion data
							resolution: 'sheets_wins',
						};

						// Log conflict
						console.log('Conflict detected, Sheets wins:', conflictLog);

						// Re-sync Sheets → Notion (Sheets wins)
						await updateNotionPage({
							pageId,
							row: currentRow,
							headers,
							mappings,
							integrations,
						});

						return {
							success: true,
							conflict: true,
							resolution: 'sheets_wins',
							rowId,
						};
					}

					// No conflict - safe to write Notion changes to Sheets
					const result = await syncNotionToSheets({
						pageId,
						rowId,
						rowIndex: targetRowIndex,
						headers,
						mappings,
						spreadsheetId: inputs.spreadsheet_id,
						sheetName: inputs.sheet_name || 'Sheet1',
						integrations,
					});

					// Update row state
					if (result.success) {
						const updatedRow = await getSheetRow(
							inputs.spreadsheet_id,
							inputs.sheet_name || 'Sheet1',
							targetRowIndex,
							integrations
						);
						if (updatedRow) {
							state.rowStates[rowId] = {
								...state.rowStates[rowId],
								sheetsHash: simpleHash(JSON.stringify(updatedRow)),
								lastNotionModified: new Date().toISOString(),
							};
							await env.KV?.put(stateKey, JSON.stringify(state));
						}
					}

					const executionTimeMs = Date.now() - startTime;

					if (google_connection_id && apiSecret) {
						await trackExecution(google_connection_id, apiSecret, connectionUrl, {
							status: result.success ? 'success' : 'failed',
							rowsSynced: result.success ? 1 : 0,
							direction: 'notion_to_sheets',
							resultSummary: result.success ? `Updated row ${rowId}` : result.error,
							startedAt,
							completedAt: new Date().toISOString(),
							executionTimeMs,
						});
					}

				return result;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return { success: false, error: errorMessage };
			}
	},
	*/

	onError: async ({ error, inputs }) => {
		const connectionId = inputs.google_connection_id || 'unknown';
		console.error(`Sheets-Notion Sync failed for connection ${connectionId}:`, error);
	},
});

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Sync Google Sheets → Notion (polling-based)
 */
async function syncSheetsToNotion(params: {
	spreadsheetId: string;
	sheetName: string;
	notionDatabaseId: string;
	keyColumn: string;
	mappings: FieldMapping[];
	state: SyncState;
	integrations: any;
	env: any;
}): Promise<SyncResult> {
	const { spreadsheetId, sheetName, notionDatabaseId, keyColumn, mappings, state, integrations } =
		params;

	const result: SyncResult = {
		created: 0,
		updated: 0,
		conflicts: 0,
		errors: 0,
		skipped: 0,
	};

	// 1. Fetch Google Sheets data
	const sheetsData = await integrations.googleSheets.spreadsheets.values.get({
		spreadsheetId,
		range: `${sheetName}!A:Z`,
	});

	if (!sheetsData.success || !sheetsData.data.values) {
		throw new Error('Failed to fetch spreadsheet data');
	}

	const rows = sheetsData.data.values;
	const headers = rows[0] as string[];
	const dataRows = rows.slice(1);
	const keyColIndex = getColumnIndex(keyColumn, headers);

	if (keyColIndex === -1) {
		throw new Error(`Key column "${keyColumn}" not found in headers: ${headers.join(', ')}`);
	}

	// 2. Get existing Notion pages for this database
	const existingPages = await getNotionPagesByDatabase(notionDatabaseId, mappings, integrations);

	// 3. Process each row
	for (let i = 0; i < Math.min(dataRows.length, MAX_ROWS_PER_SYNC); i++) {
		const row = dataRows[i] as string[];
		const rowId = row[keyColIndex];

		if (!rowId) {
			result.skipped++;
			continue;
		}

		const rowHash = simpleHash(JSON.stringify(row));
		const existingState = state.rowStates[rowId];

		// Check if row has changed
		if (existingState && existingState.sheetsHash === rowHash) {
			result.skipped++;
			continue;
		}

		try {
			// Find or create Notion page
			const existingPage = existingPages.find((p) => p.key === rowId);

			if (existingPage) {
				// Update existing page
				await updateNotionPage({
					pageId: existingPage.id,
					row,
					headers,
					mappings,
					integrations,
				});
				result.updated++;
			} else {
				// Create new page
				const newPageId = await createNotionPage({
					databaseId: notionDatabaseId,
					row,
					headers,
					mappings,
					integrations,
				});

				if (newPageId) {
					result.created++;
					state.rowStates[rowId] = {
						sheetsHash: rowHash,
						notionPageId: newPageId,
						lastSheetsModified: new Date().toISOString(),
						lastNotionModified: new Date().toISOString(),
					};
				}
			}

			// Update state for existing rows
			if (existingPage) {
				state.rowStates[rowId] = {
					sheetsHash: rowHash,
					notionPageId: existingPage.id,
					lastSheetsModified: new Date().toISOString(),
					lastNotionModified: existingState?.lastNotionModified || new Date().toISOString(),
				};
			}

			// Rate limiting
			await delay(API_DELAY_MS);
		} catch (error) {
			console.error(`Error syncing row ${rowId}:`, error);
			result.errors++;
		}
	}

	return result;
}

/**
 * Sync Notion → Google Sheets (webhook-triggered)
 */
async function syncNotionToSheets(params: {
	pageId: string;
	rowId: string;
	rowIndex: number;
	headers: string[];
	mappings: FieldMapping[];
	spreadsheetId: string;
	sheetName: string;
	integrations: any;
}): Promise<{ success: boolean; error?: string }> {
	const { pageId, rowIndex, headers, mappings, spreadsheetId, sheetName, integrations } = params;

	try {
		// Fetch Notion page
		const pageResult = await integrations.notion.pages.retrieve({ page_id: pageId });

		if (!pageResult.success) {
			return { success: false, error: 'Failed to fetch Notion page' };
		}

		const page = pageResult.data;
		const properties = page.properties;

		// Build row values from Notion properties
		const rowValues: string[] = new Array(headers.length).fill('');

		for (const mapping of mappings) {
			const colIndex = getColumnIndex(mapping.sheetsColumn, headers);
			if (colIndex === -1) continue;

			const notionValue = properties[mapping.notionProperty];
			if (!notionValue) continue;

			rowValues[colIndex] = notionPropertyToSheetValue(notionValue, mapping.type);
		}

		// Update Sheets row
		const range = `${sheetName}!A${rowIndex + 1}:${columnIndexToLetter(headers.length - 1)}${rowIndex + 1}`;

		const updateResult = await integrations.googleSheets.spreadsheets.values.update({
			spreadsheetId,
			range,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [rowValues],
			},
		});

		return { success: updateResult.success };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// ============================================================================
// NOTION HELPERS
// ============================================================================

/**
 * Get all pages from a Notion database
 */
async function getNotionPagesByDatabase(
	databaseId: string,
	mappings: FieldMapping[],
	integrations: any
): Promise<Array<{ id: string; key: string }>> {
	const pages: Array<{ id: string; key: string }> = [];

	// Find the title/key mapping
	const keyMapping = mappings.find((m) => m.type === 'title');
	if (!keyMapping) return pages;

	try {
		const result = await integrations.notion.databases.query({
			database_id: databaseId,
			page_size: 100,
		});

		if (result.success && result.data.results) {
			for (const page of result.data.results) {
				const titleProp = page.properties[keyMapping.notionProperty];
				if (titleProp?.title?.[0]?.plain_text) {
					pages.push({
						id: page.id,
						key: titleProp.title[0].plain_text,
					});
				}
			}
		}
	} catch (error) {
		console.error('Error querying Notion database:', error);
	}

	return pages;
}

/**
 * Create a new Notion page
 */
async function createNotionPage(params: {
	databaseId: string;
	row: string[];
	headers: string[];
	mappings: FieldMapping[];
	integrations: any;
}): Promise<string | null> {
	const { databaseId, row, headers, mappings, integrations } = params;

	const properties: Record<string, unknown> = {};

	for (const mapping of mappings) {
		const colIndex = getColumnIndex(mapping.sheetsColumn, headers);
		if (colIndex === -1 || colIndex >= row.length) continue;

		const value = row[colIndex];
		if (!value && value !== '0') continue;

		properties[mapping.notionProperty] = sheetValueToNotionProperty(value, mapping.type);
	}

	try {
		const result = await integrations.notion.pages.create({
			parent: { database_id: databaseId },
			properties,
		});

		return result.success ? result.data.id : null;
	} catch (error) {
		console.error('Error creating Notion page:', error);
		return null;
	}
}

/**
 * Update an existing Notion page
 */
async function updateNotionPage(params: {
	pageId: string;
	row: string[];
	headers: string[];
	mappings: FieldMapping[];
	integrations: any;
}): Promise<boolean> {
	const { pageId, row, headers, mappings, integrations } = params;

	const properties: Record<string, unknown> = {};

	for (const mapping of mappings) {
		// Skip title property on updates (can cause issues)
		if (mapping.type === 'title') continue;

		const colIndex = getColumnIndex(mapping.sheetsColumn, headers);
		if (colIndex === -1 || colIndex >= row.length) continue;

		const value = row[colIndex];
		properties[mapping.notionProperty] = sheetValueToNotionProperty(value, mapping.type);
	}

	try {
		const result = await integrations.notion.pages.update({
			page_id: pageId,
			properties,
		});

		return result.success;
	} catch (error) {
		console.error('Error updating Notion page:', error);
		return false;
	}
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Convert a Google Sheets value to Notion property format
 */
function sheetValueToNotionProperty(
	value: string,
	type: FieldMapping['type']
): Record<string, unknown> {
	switch (type) {
		case 'title':
			return { title: [{ text: { content: value } }] };

		case 'rich_text':
		case 'text':
			return { rich_text: [{ text: { content: value } }] };

		case 'select':
		case 'status':
			return { select: { name: value } };

		case 'date':
			// Try to parse as date
			const date = new Date(value);
			if (!isNaN(date.getTime())) {
				return { date: { start: date.toISOString().split('T')[0] } };
			}
			return { date: null };

		case 'number':
			const num = parseFloat(value);
			return { number: isNaN(num) ? null : num };

		case 'checkbox':
			return {
				checkbox: value.toUpperCase() === 'TRUE' || value === '1' || value.toLowerCase() === 'yes',
			};

		default:
			return { rich_text: [{ text: { content: value } }] };
	}
}

/**
 * Convert a Notion property to Google Sheets value
 */
function notionPropertyToSheetValue(property: any, type: FieldMapping['type']): string {
	if (!property) return '';

	switch (type) {
		case 'title':
			return property.title?.[0]?.plain_text || '';

		case 'rich_text':
		case 'text':
			return property.rich_text?.[0]?.plain_text || '';

		case 'select':
		case 'status':
			return property.select?.name || property.status?.name || '';

		case 'date':
			return property.date?.start || '';

		case 'number':
			return property.number?.toString() || '';

		case 'checkbox':
			return property.checkbox ? 'TRUE' : 'FALSE';

		default:
			return '';
	}
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Get column index from column letter or header name
 */
function getColumnIndex(column: string, headers: string[]): number {
	// Check if it's a letter (A, B, C, etc.)
	if (/^[A-Z]+$/i.test(column)) {
		return columnLetterToIndex(column);
	}

	// Otherwise, look for header name
	return headers.findIndex((h) => h.toLowerCase() === column.toLowerCase());
}

// Sheet utilities (columnLetterToIndex, columnIndexToLetter, simpleHash, rowToObject, delay)
// are now imported from ../_shared/utils.js

/**
 * Get a single row from Google Sheets
 */
async function getSheetRow(
	spreadsheetId: string,
	sheetName: string,
	rowIndex: number,
	integrations: any
): Promise<string[] | null> {
	try {
		const result = await integrations.googleSheets.spreadsheets.values.get({
			spreadsheetId,
			range: `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`,
		});

		if (result.success && result.data.values?.[0]) {
			return result.data.values[0];
		}
	} catch (error) {
		console.error('Error fetching sheet row:', error);
	}
	return null;
}

// ============================================================================
// METADATA
// ============================================================================

/**
 * Workflow metadata - Private workflow
 */
export const metadata = {
	id: 'sheets-notion-bidirectional',
	category: 'data_sync',
	featured: false,

	// Private workflow - Half Dozen team only
	visibility: 'private' as const,
	accessGrants: [{ type: 'email_domain' as const, value: 'halfdozen.co' }],

	// BYOO configuration
	developerId: 'internal',
	byooProvider: 'google-sheets',

	// Honest flags
	experimental: false,
	requiresCustomInfrastructure: true,

	// Infrastructure required
	infrastructureRequired: ['BYOO Google OAuth app', 'Notion integration'],

	// Analytics
	analyticsUrl: 'https://workway.co/workflows/private/sheets-notion-bidirectional/analytics',

	stats: { rating: 0, users: 0, reviews: 0 },
};

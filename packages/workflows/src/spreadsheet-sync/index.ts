/**
 * Spreadsheet Sync Pipeline
 *
 * Compound workflow: Google Sheets → Airtable + Slack
 *
 * Automates spreadsheet to database sync:
 * 1. Monitors Google Sheets for changes (scheduled)
 * 2. Syncs new/updated rows to Airtable
 * 3. Notifies team on Slack of sync status
 * 4. AI detects data anomalies
 *
 * Zuhandenheit: "Spreadsheet data appears in Airtable automatically"
 * not "manually copy-paste rows between tools"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Spreadsheet Sync Pipeline',
	description:
		'Automatically sync Google Sheets data to Airtable, with Slack notifications and AI anomaly detection',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_data_changes',

		outcomeStatement: {
			suggestion: 'Want spreadsheet data to sync automatically?',
			explanation: 'When your Google Sheet updates, we\'ll sync changes to Airtable and notify your team.',
			outcome: 'Spreadsheet data that syncs itself',
		},

		primaryPair: {
			from: 'google-sheets',
			to: 'airtable',
			workflowId: 'spreadsheet-sync',
			outcome: 'Spreadsheets synced to Airtable',
		},

		additionalPairs: [
			{ from: 'google-sheets', to: 'slack', workflowId: 'spreadsheet-sync', outcome: 'Sync notifications in Slack' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['google-sheets', 'airtable'],
				workflowId: 'spreadsheet-sync',
				priority: 80,
			},
		],

		smartDefaults: {
			syncInterval: { value: 15 },
			notifyOnSync: { value: true },
		},

		essentialFields: ['spreadsheetId', 'airtableBaseId', 'airtableTableId'],

		zuhandenheit: {
			timeToValue: 15, // 15 minutes until first sync
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 15,
		trialDays: 14,
		description: 'Free for 500 rows/month, $15/month unlimited',
	},

	integrations: [
		{ service: 'google-sheets', scopes: ['spreadsheets.readonly'] },
		{ service: 'airtable', scopes: ['data.records:write'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'], optional: true },
	],

	inputs: {
		spreadsheetId: {
			type: 'text',
			label: 'Google Sheet ID',
			required: true,
			description: 'The ID from your Google Sheets URL',
		},
		sheetName: {
			type: 'text',
			label: 'Sheet Tab Name',
			required: false,
			default: 'Sheet1',
			description: 'Name of the specific sheet tab to sync',
		},
		airtableBaseId: {
			type: 'airtable_base_picker',
			label: 'Airtable Base',
			required: true,
			description: 'Destination Airtable base',
		},
		airtableTableId: {
			type: 'airtable_table_picker',
			label: 'Airtable Table',
			required: true,
			description: 'Destination table in the base',
		},
		syncInterval: {
			type: 'select',
			label: 'Sync Interval',
			required: true,
			options: [
				{ value: '5', label: 'Every 5 minutes' },
				{ value: '15', label: 'Every 15 minutes' },
				{ value: '60', label: 'Every hour' },
				{ value: '1440', label: 'Daily' },
			],
			default: '15',
			description: 'How often to check for changes',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Notification Channel',
			required: false,
			description: 'Optional: Channel for sync notifications',
		},
		keyColumn: {
			type: 'text',
			label: 'Key Column',
			required: false,
			default: 'A',
			description: 'Column to use as unique identifier (e.g., A for email)',
		},
		enableAnomalyDetection: {
			type: 'boolean',
			label: 'AI Anomaly Detection',
			default: true,
			description: 'Detect unusual data patterns during sync',
		},
		notifyOnSync: {
			type: 'boolean',
			label: 'Notify on Sync',
			default: true,
			description: 'Post to Slack after each sync',
		},
		notifyOnlyOnChanges: {
			type: 'boolean',
			label: 'Only Notify on Changes',
			default: true,
			description: 'Only notify when rows are added/updated',
		},
	},

	trigger: schedule({
		cron: '*/15 * * * *', // Every 15 minutes, adjusted by inputs
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, storage, env }) {
		const sheetName = inputs.sheetName || 'Sheet1';

		// 1. Fetch Google Sheets data
		const sheetsData = await integrations.googleSheets.spreadsheets.values.get({
			spreadsheetId: inputs.spreadsheetId,
			range: `${sheetName}!A:Z`,
		});

		if (!sheetsData.success || !sheetsData.data.values) {
			return { success: false, error: 'Failed to fetch spreadsheet data' };
		}

		const rows = sheetsData.data.values;
		const headers = rows[0] as string[];
		const dataRows = rows.slice(1);

		// 2. Get last sync state from storage
		const lastSyncKey = `sync:${inputs.spreadsheetId}:${inputs.airtableTableId}`;
		const lastSync = (await storage.get(lastSyncKey)) as SyncState | null;
		const lastSyncedRowCount = lastSync?.rowCount || 0;
		const lastSyncedHash = lastSync?.dataHash || '';

		// 3. Calculate current data hash
		const currentHash = simpleHash(JSON.stringify(dataRows));
		const hasChanges = currentHash !== lastSyncedHash;

		if (!hasChanges && inputs.notifyOnlyOnChanges) {
			return {
				success: true,
				noChanges: true,
				rowCount: dataRows.length,
			};
		}

		// 4. Sync to Airtable
		const keyColumnIndex = inputs.keyColumn ? columnLetterToIndex(inputs.keyColumn) : 0;
		let created = 0;
		let updated = 0;
		let errors = 0;

		// Get existing Airtable records
		const existingRecords = await integrations.airtable.records.list({
			baseId: inputs.airtableBaseId,
			tableId: inputs.airtableTableId,
			maxRecords: 10000,
		});

		const existingByKey: Record<string, string> = {};
		if (existingRecords.success) {
			for (const record of existingRecords.data) {
				const keyField = headers[keyColumnIndex];
				const keyValue = record.fields[keyField];
				if (keyValue) {
					existingByKey[String(keyValue)] = record.id;
				}
			}
		}

		// Process rows
		for (const row of dataRows) {
			const keyValue = row[keyColumnIndex];
			if (!keyValue) continue;

			const fields: Record<string, any> = {};
			for (let i = 0; i < headers.length && i < row.length; i++) {
				if (row[i] !== undefined && row[i] !== '') {
					fields[headers[i]] = row[i];
				}
			}

			try {
				if (existingByKey[keyValue]) {
					// Update existing record
					await integrations.airtable.records.update({
						baseId: inputs.airtableBaseId,
						tableId: inputs.airtableTableId,
						recordId: existingByKey[keyValue],
						fields,
					});
					updated++;
				} else {
					// Create new record
					await integrations.airtable.records.create({
						baseId: inputs.airtableBaseId,
						tableId: inputs.airtableTableId,
						fields,
					});
					created++;
				}
			} catch (e) {
				errors++;
			}
		}

		// 5. AI Anomaly Detection (optional)
		let anomalies: string[] = [];
		if (inputs.enableAnomalyDetection && env.AI && dataRows.length > 10) {
			anomalies = await detectAnomalies(env.AI, headers, dataRows);
		}

		// 6. Save sync state
		await storage.put(lastSyncKey, {
			rowCount: dataRows.length,
			dataHash: currentHash,
			lastSync: new Date().toISOString(),
		});

		// 7. Notify on Slack (optional)
		if (inputs.slackChannel && integrations.slack && inputs.notifyOnSync) {
			const emoji = errors > 0 ? '⚠️' : '✅';
			const text = `${emoji} *Spreadsheet Sync Complete*\n` +
				`• Created: ${created} records\n` +
				`• Updated: ${updated} records\n` +
				`• Errors: ${errors}\n` +
				`• Total rows: ${dataRows.length}` +
				(anomalies.length > 0 ? `\n\n🔍 *Anomalies detected:*\n${anomalies.map(a => `• ${a}`).join('\n')}` : '');

			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text,
			});
		}

		return {
			success: true,
			sync: {
				created,
				updated,
				errors,
				totalRows: dataRows.length,
			},
			anomalies: anomalies.length > 0 ? anomalies : undefined,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Spreadsheet Sync Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface SyncState {
	rowCount: number;
	dataHash: string;
	lastSync: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function columnLetterToIndex(letter: string): number {
	const upper = letter.toUpperCase();
	let index = 0;
	for (let i = 0; i < upper.length; i++) {
		index = index * 26 + (upper.charCodeAt(i) - 64);
	}
	return index - 1;
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return hash.toString(16);
}

async function detectAnomalies(ai: any, headers: string[], rows: any[][]): Promise<string[]> {
	try {
		// Sample data for analysis
		const sampleSize = Math.min(50, rows.length);
		const sample = rows.slice(0, sampleSize);

		const prompt = `Analyze this spreadsheet data for anomalies.

Headers: ${headers.join(', ')}
Sample rows (${sampleSize} of ${rows.length}):
${sample.slice(0, 5).map(r => r.join(', ')).join('\n')}

Look for:
- Missing required fields
- Unusual values or outliers
- Inconsistent formatting
- Duplicate key values

Return a JSON array of anomaly descriptions (max 3):
["anomaly 1", "anomaly 2"]

If no anomalies found, return: []`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 150,
		});

		const text = result.response || '';
		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}
	} catch (e) {
		// Graceful degradation
	}
	return [];
}

export const metadata = {
	id: 'spreadsheet-sync',
	category: 'data-analytics',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};

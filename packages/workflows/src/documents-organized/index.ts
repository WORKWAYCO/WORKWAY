/**
 * Drive Document Hub Workflow
 *
 * Automatically sync Google Drive documents to Notion and notify
 * your team in Slack when important files are added or updated.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My documents organize themselves"
 *
 * Integrations: Google Drive, Notion, Slack
 * Trigger: Daily cron OR webhook (Drive push notifications)
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Drive Document Hub',
	description: 'Documents that organize themselves - synced to Notion with team notifications',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_files_change',

		outcomeStatement: {
			suggestion: 'Want documents tracked automatically?',
			explanation: 'When files are added or updated in Drive, we sync them to Notion and notify your team.',
			outcome: 'Documents that organize themselves',
		},

		primaryPair: {
			from: 'google-drive',
			to: 'notion',
			workflowId: 'documents-organized',
			outcome: 'Documents that organize themselves',
		},

		additionalPairs: [
			{ from: 'google-drive', to: 'slack', workflowId: 'documents-organized', outcome: 'File updates in Slack' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['google-drive', 'notion'],
				workflowId: 'documents-organized',
				priority: 100,
			},
			{
				trigger: 'integration_connected',
				integrations: ['google-drive', 'slack'],
				workflowId: 'documents-organized',
				priority: 85,
			},
		],

		smartDefaults: {
			syncToNotion: { value: true },
			notifySlack: { value: true },
			includeFilePreview: { value: true },
			watchFolders: { value: [] },
		},

		essentialFields: ['notion_database_id'],

		zuhandenheit: {
			timeToValue: 3,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.05,
		freeExecutions: 100,
		description: 'Per file synced',
	},

	integrations: [
		{ service: 'google-drive', scopes: ['drive.readonly', 'drive.metadata.readonly'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases', 'write_databases'] },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	config: {
		// Folder selection
		watch_folders: {
			type: 'text',
			label: 'Folders to Watch',
			required: false,
			description: 'Leave empty to watch entire Drive',
		},
		include_shared_drives: {
			type: 'boolean',
			label: 'Include Shared Drives',
			default: false,
			description: 'Also monitor shared drives you have access to',
		},

		// Notion destination
		notion_database_id: {
			type: 'text',
			label: 'Notion Database',
			required: true,
			description: 'Database to sync documents to',
		},
		notion_title_property: {
			type: 'text',
			label: 'Title Property Name',
			default: 'Name',
			description: 'Property name for file title',
		},
		notion_url_property: {
			type: 'text',
			label: 'URL Property Name',
			default: 'Drive URL',
			description: 'Property name for Drive link',
		},

		// File filtering
		file_types: {
			type: 'multiselect',
			label: 'File Types',
			options: ['documents', 'spreadsheets', 'presentations', 'pdfs', 'images', 'all'],
			default: ['documents', 'spreadsheets', 'presentations'],
			description: 'Types of files to sync',
		},
		exclude_patterns: {
			type: 'text',
			label: 'Exclude Patterns',
			default: '',
			description: 'Comma-separated patterns to exclude (e.g., "draft, temp, old")',
		},

		// Sync settings
		sync_frequency: {
			type: 'select',
			label: 'Sync Frequency',
			options: ['hourly', 'daily', 'weekly'],
			default: 'daily',
			description: 'How often to check for changes',
		},
		lookback_hours: {
			type: 'number',
			label: 'Lookback Hours',
			default: 24,
			description: 'How far back to look for changes',
		},

		// Notifications
		slack_channel: {
			type: 'text',
			label: 'Notification Channel',
			required: false,
			description: 'Channel for file update notifications',
		},
		notify_on_new: {
			type: 'boolean',
			label: 'Notify on New Files',
			default: true,
			description: 'Post when new files are added',
		},
		notify_on_update: {
			type: 'boolean',
			label: 'Notify on Updates',
			default: false,
			description: 'Post when existing files are modified',
		},
		include_file_preview: {
			type: 'boolean',
			label: 'Include Preview',
			default: true,
			description: 'Include thumbnail preview in notifications',
		},
	},

	trigger: cron({
		schedule: '0 9 * * *', // 9 AM UTC daily
		timezone: 'UTC',
	}),

	webhooks: [
		webhook({
			service: 'google-drive',
			event: 'file.created',
		}),
		webhook({
			service: 'google-drive',
			event: 'file.modified',
		}),
	],

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			file: { id: string; name: string; mimeType: string };
			notionPageId: string | null;
			slackPosted: boolean;
			action: 'created' | 'updated' | 'skipped';
		}> = [];

		const isWebhookTrigger = trigger.type === 'webhook';

		// Parse exclude patterns
		const excludePatterns = (inputs.excludePatterns || '')
			.split(',')
			.map((p: string) => p.trim().toLowerCase())
			.filter(Boolean);

		// Build MIME type filter
		const mimeTypes = buildMimeTypeFilter(inputs.fileTypes || ['all']);

		if (isWebhookTrigger) {
			// Single file from webhook
			const file = trigger.data;
			const fileResult = await processFile({
				file,
				inputs,
				integrations,
				env,
				excludePatterns,
				mimeTypes,
				isNew: (trigger as any).event === 'file.created',
			});
			results.push(fileResult);
		} else {
			// Batch sync from cron
			const query = buildDriveQuery({
				folderIds: inputs.watchFolders || [],
				mimeTypes,
				modifiedAfter: new Date(Date.now() - inputs.lookbackHours * 60 * 60 * 1000),
			});

			const filesResult = await integrations['google-drive'].files.list({
				q: query,
				fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, modifiedTime, createdTime, owners)',
				includeItemsFromAllDrives: inputs.includeSharedDrives,
				supportsAllDrives: inputs.includeSharedDrives,
				orderBy: 'modifiedTime desc',
				pageSize: 100,
			});

			if (filesResult.success && filesResult.data?.files) {
				for (const file of filesResult.data.files) {
					// Check exclusion patterns
					const fileName = file.name.toLowerCase();
					if (excludePatterns.some((p: string) => fileName.includes(p))) {
						results.push({
							file: { id: file.id, name: file.name, mimeType: file.mimeType },
							notionPageId: null,
							slackPosted: false,
							action: 'skipped',
						});
						continue;
					}

					// Check if already processed (idempotency)
					const processedKey = `drive:${file.id}:${file.modifiedTime}`;
					const alreadyProcessed = await env.KV?.get(processedKey);
					if (alreadyProcessed) {
						results.push({
							file: { id: file.id, name: file.name, mimeType: file.mimeType },
							notionPageId: null,
							slackPosted: false,
							action: 'skipped',
						});
						continue;
					}

					const isNew = new Date(file.createdTime) > new Date(Date.now() - inputs.lookbackHours * 60 * 60 * 1000);

					const fileResult = await processFile({
						file,
						inputs,
						integrations,
						env,
						excludePatterns,
						mimeTypes,
						isNew,
					});
					results.push(fileResult);

					// Mark as processed (TTL: 7 days)
					await env.KV?.put(processedKey, 'true', { expirationTtl: 604800 });
				}
			}
		}

		// Summary
		const created = results.filter(r => r.action === 'created').length;
		const updated = results.filter(r => r.action === 'updated').length;
		const skipped = results.filter(r => r.action === 'skipped').length;

		return {
			success: true,
			filesProcessed: results.length,
			created,
			updated,
			skipped,
			results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `Drive Document Hub failed: ${error.message}`,
			});
		}
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ProcessFileParams {
	file: any;
	inputs: any;
	integrations: any;
	env: any;
	excludePatterns: string[];
	mimeTypes: string[];
	isNew: boolean;
}

async function processFile(params: ProcessFileParams) {
	const { file, inputs, integrations, env, isNew } = params;

	let notionPageId: string | null = null;
	let slackPosted = false;
	const action: 'created' | 'updated' | 'skipped' = isNew ? 'created' : 'updated';

	// 1. Sync to Notion
	if (inputs.notionDatabaseId) {
		try {
			// Check if page already exists
			const existingPage = await findExistingNotionPage({
				databaseId: inputs.notionDatabaseId,
				driveFileId: file.id,
				integrations,
			});

			const properties: Record<string, any> = {
				[inputs.notionTitleProperty || 'Name']: {
					title: [{ text: { content: file.name } }],
				},
				[inputs.notionUrlProperty || 'Drive URL']: {
					url: file.webViewLink,
				},
			};

			// Add metadata properties if they exist in the database
			const metadataProps: Record<string, any> = {
				'File Type': { select: { name: getFileTypeLabel(file.mimeType) } },
				'Last Modified': { date: { start: file.modifiedTime } },
				'Drive File ID': { rich_text: [{ text: { content: file.id } }] },
			};

			if (existingPage) {
				// Update existing page
				const updateResult = await integrations.notion.pages.update({
					page_id: existingPage.id,
					properties: { ...properties, ...metadataProps },
				});
				notionPageId = updateResult.success ? existingPage.id : null;
			} else {
				// Create new page
				const createResult = await integrations.notion.pages.create({
					parent: { database_id: inputs.notionDatabaseId },
					properties: { ...properties, ...metadataProps },
					icon: { external: { url: getFileIcon(file.mimeType) } },
				});
				notionPageId = createResult.success ? createResult.data?.id : null;
			}
		} catch {
			// Continue without Notion sync
		}
	}

	// 2. Notify Slack
	const shouldNotify =
		inputs.slackChannel &&
		((isNew && inputs.notifyOnNew) || (!isNew && inputs.notifyOnUpdate));

	if (shouldNotify) {
		slackPosted = await postFileNotification({
			file,
			isNew,
			notionPageId,
			channel: inputs.slackChannel,
			includePreview: inputs.includeFilePreview,
			integrations,
		});
	}

	return {
		file: { id: file.id, name: file.name, mimeType: file.mimeType },
		notionPageId,
		slackPosted,
		action,
	};
}

function buildMimeTypeFilter(fileTypes: string[]): string[] {
	const mimeMap: Record<string, string[]> = {
		documents: ['application/vnd.google-apps.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
		spreadsheets: ['application/vnd.google-apps.spreadsheet', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
		presentations: ['application/vnd.google-apps.presentation', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
		pdfs: ['application/pdf'],
		images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
	};

	if (fileTypes.includes('all')) {
		return [];
	}

	const mimes: string[] = [];
	for (const type of fileTypes) {
		if (mimeMap[type]) {
			mimes.push(...mimeMap[type]);
		}
	}
	return mimes;
}

function buildDriveQuery(params: {
	folderIds: string[];
	mimeTypes: string[];
	modifiedAfter: Date;
}): string {
	const conditions: string[] = [];

	// Folder filter
	if (params.folderIds.length > 0) {
		const folderConditions = params.folderIds.map(id => `'${id}' in parents`);
		conditions.push(`(${folderConditions.join(' or ')})`);
	}

	// MIME type filter
	if (params.mimeTypes.length > 0) {
		const mimeConditions = params.mimeTypes.map(m => `mimeType='${m}'`);
		conditions.push(`(${mimeConditions.join(' or ')})`);
	}

	// Modified time filter
	conditions.push(`modifiedTime > '${params.modifiedAfter.toISOString()}'`);

	// Exclude trashed files
	conditions.push('trashed = false');

	return conditions.join(' and ');
}

async function findExistingNotionPage(params: {
	databaseId: string;
	driveFileId: string;
	integrations: any;
}): Promise<{ id: string } | null> {
	const { databaseId, driveFileId, integrations } = params;

	try {
		const result = await integrations.notion.databases.query({
			database_id: databaseId,
			filter: {
				property: 'Drive File ID',
				rich_text: { equals: driveFileId },
			},
			page_size: 1,
		});

		if (result.success && result.data?.results?.length > 0) {
			return { id: result.data.results[0].id };
		}
	} catch {
		// Database might not have Drive File ID property
	}

	return null;
}

function getFileTypeLabel(mimeType: string): string {
	const labels: Record<string, string> = {
		'application/vnd.google-apps.document': 'Google Doc',
		'application/vnd.google-apps.spreadsheet': 'Google Sheet',
		'application/vnd.google-apps.presentation': 'Google Slides',
		'application/pdf': 'PDF',
		'image/jpeg': 'Image',
		'image/png': 'Image',
	};
	return labels[mimeType] || 'File';
}

function getFileIcon(mimeType: string): string {
	const icons: Record<string, string> = {
		'application/vnd.google-apps.document': 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x32.png',
		'application/vnd.google-apps.spreadsheet': 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png',
		'application/vnd.google-apps.presentation': 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png',
		'application/pdf': 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_12_pdf_x32.png',
	};
	return icons[mimeType] || 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_generic_x32.png';
}

async function postFileNotification(params: {
	file: any;
	isNew: boolean;
	notionPageId: string | null;
	channel: string;
	includePreview: boolean;
	integrations: any;
}): Promise<boolean> {
	const { file, isNew, notionPageId, channel, includePreview, integrations } = params;

	const action = isNew ? 'New file added' : 'File updated';
	const fileType = getFileTypeLabel(file.mimeType);

	const blocks: any[] = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${action}*: <${file.webViewLink}|${file.name}>`,
			},
			accessory: includePreview && file.thumbnailLink ? {
				type: 'image',
				image_url: file.thumbnailLink,
				alt_text: file.name,
			} : undefined,
		},
		{
			type: 'context',
			elements: [
				{ type: 'mrkdwn', text: `Type: ${fileType}` },
				{ type: 'mrkdwn', text: `Modified: ${new Date(file.modifiedTime).toLocaleDateString()}` },
			],
		},
	];

	// Add Notion link if synced
	if (notionPageId) {
		blocks.push({
			type: 'context',
			elements: [
				{ type: 'mrkdwn', text: `Synced to Notion` },
			],
		});
	}

	try {
		await integrations.slack.chat.postMessage({
			channel,
			text: `${action}: ${file.name}`,
			blocks,
		});
		return true;
	} catch {
		return false;
	}
}

export const metadata = {
	id: 'documents-organized',
	category: 'productivity',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};

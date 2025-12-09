/**
 * Gmail to Notion - Private (Half Dozen Internal)
 *
 * Organization-specific workflow for @halfdozen.co team.
 * Syncs important emails to the team's central Notion database.
 *
 * ## Architecture
 *
 * - Auth: BYOO (Bring Your Own OAuth) Google app
 * - Storage: Half Dozen's central Notion database
 * - Deduplication: Message-ID based (Source ID property)
 *
 * ## Why BYOO?
 *
 * Gmail OAuth scopes require Google app verification for public apps.
 * Using BYOO with the organization's own Google Cloud app allows
 * unverified apps for internal organizational use.
 *
 * @private For @halfdozen.co team only
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// ============================================================================
// HALF DOZEN INTERNAL CONSTANTS
// ============================================================================

/**
 * Half Dozen's central LLM database in Notion
 * All email intelligence data for @halfdozen.co goes here.
 */
const HALFDOZEN_INTERNAL_LLM_DATABASE = '27a019187ac580b797fec563c98afbbc';

// Cache for database schema
let cachedTitleProperty: string | null = null;

// ============================================================================
// GMAIL API HELPERS
// ============================================================================

interface GmailMessage {
	id: string;
	threadId: string;
	labelIds: string[];
	snippet: string;
}

interface GmailMessageFull {
	id: string;
	threadId: string;
	labelIds: string[];
	payload: {
		headers: Array<{ name: string; value: string }>;
		mimeType: string;
		body?: { data?: string };
		parts?: Array<{
			mimeType: string;
			body?: { data?: string };
			parts?: Array<{ mimeType: string; body?: { data?: string } }>;
		}>;
	};
	internalDate: string;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
	const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
	return header?.value || '';
}

function decodeBase64Url(data: string): string {
	// Base64url to Base64
	const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
	// Decode
	try {
		return atob(base64);
	} catch {
		return '';
	}
}

function extractTextBody(payload: GmailMessageFull['payload']): string {
	// Try direct body first
	if (payload.body?.data) {
		return decodeBase64Url(payload.body.data);
	}

	// Try parts
	if (payload.parts) {
		// Look for text/plain first
		for (const part of payload.parts) {
			if (part.mimeType === 'text/plain' && part.body?.data) {
				return decodeBase64Url(part.body.data);
			}
			// Check nested parts
			if (part.parts) {
				for (const nested of part.parts) {
					if (nested.mimeType === 'text/plain' && nested.body?.data) {
						return decodeBase64Url(nested.body.data);
					}
				}
			}
		}

		// Fallback to text/html and strip tags
		for (const part of payload.parts) {
			if (part.mimeType === 'text/html' && part.body?.data) {
				const html = decodeBase64Url(part.body.data);
				return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
			}
		}
	}

	return '';
}

// ============================================================================
// NOTION HELPERS
// ============================================================================

async function checkExistingPage(
	notion: any,
	databaseId: string,
	messageId: string
): Promise<boolean> {
	try {
		const result = await notion.databases.query({
			database_id: databaseId,
			filter: {
				property: 'Source ID',
				rich_text: { equals: messageId },
			},
			page_size: 1,
		});
		return result.success && result.data?.length > 0;
	} catch {
		return false;
	}
}

interface CreateEmailPageParams {
	databaseId: string;
	subject: string;
	from: string;
	date: string;
	body: string;
	messageId: string;
	threadUrl: string;
	integrations: any;
}

async function createNotionEmailPage(params: CreateEmailPageParams) {
	const { databaseId, subject, from, date, body, messageId, threadUrl, integrations } = params;

	// Dynamically detect title property from database schema
	let titleProperty = cachedTitleProperty;

	if (!titleProperty) {
		try {
			const dbResult = await integrations.notion.getDatabase(databaseId);
			if (dbResult.success && dbResult.data?.properties) {
				for (const [propName, propConfig] of Object.entries(dbResult.data.properties)) {
					if ((propConfig as any).type === 'title') {
						titleProperty = propName;
						cachedTitleProperty = propName;
						break;
					}
				}
			}
		} catch (error) {
			console.error('[Workflow] Failed to fetch database schema:', error);
		}

		// Fallback
		if (!titleProperty) {
			titleProperty = 'Item';
		}
	}

	const properties: Record<string, any> = {
		[titleProperty]: {
			title: [{ text: { content: subject || '(No Subject)' } }],
		},
		Date: {
			date: { start: date.split('T')[0] },
		},
		Type: {
			select: { name: 'Email' },
		},
		Status: {
			select: { name: 'Active' },
		},
		Source: {
			select: { name: 'Gmail' },
		},
		'Source URL': {
			url: threadUrl,
		},
		'Source ID': {
			rich_text: [{ text: { content: messageId } }],
		},
	};

	const children: any[] = [];

	// Email info callout
	children.push({
		object: 'block',
		type: 'callout',
		callout: {
			rich_text: [
				{
					text: {
						content: `From: ${from} \u2022 ${new Date(date).toLocaleDateString()}`,
					},
				},
			],
			icon: { emoji: '\u{1F4E7}' },
			color: 'blue_background',
		},
	});

	children.push({
		object: 'block',
		type: 'divider',
		divider: {},
	});

	// Email body (split into blocks if long)
	const bodyBlocks = splitTextIntoBlocks(body);
	children.push(...bodyBlocks);

	try {
		const result = await integrations.notion.pages.create({
			parent: { database_id: databaseId },
			properties,
			children,
		});
		return result.success ? { url: result.data?.url } : null;
	} catch (error) {
		console.error('Failed to create Notion page:', error);
		return null;
	}
}

function splitTextIntoBlocks(text: string): any[] {
	const blocks: any[] = [];
	const maxChars = 1900;

	// Split by paragraphs
	const paragraphs = text.split(/\n\n+/);
	let currentBlock = '';

	for (const para of paragraphs) {
		if (currentBlock.length + para.length + 2 > maxChars) {
			if (currentBlock) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: currentBlock } }] },
				});
			}
			currentBlock = para;
		} else {
			currentBlock = currentBlock ? `${currentBlock}\n\n${para}` : para;
		}
	}

	if (currentBlock) {
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: currentBlock } }] },
		});
	}

	return blocks.length > 0
		? blocks
		: [
				{
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: '(No content)' } }] },
				},
			];
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Gmail to Notion (Internal)',
	description:
		'Sync important emails to team Notion database. Uses BYOO (Bring Your Own OAuth) for Gmail access.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_emails_arrive',

		outcomeStatement: {
			suggestion: 'Want important emails to become searchable knowledge?',
			explanation:
				'Emails with the WORKWAY label automatically create Notion pages in your team database.',
			outcome: 'Important emails that become searchable knowledge',
		},

		primaryPair: {
			from: 'gmail',
			to: 'notion',
			workflowId: 'gmail-to-notion-private',
			outcome: 'Emails documented in Notion',
		},

		additionalPairs: [],

		discoveryMoments: [],

		smartDefaults: {
			lookbackMinutes: { value: 60 },
			labelFilter: { value: 'WORKWAY' },
		},

		essentialFields: [],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: false, // Requires BYOO setup
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'free',
		pricePerExecution: 0,
		freeExecutions: 0,
		description: 'Internal workflow - no charge',
	},

	integrations: [
		{ service: 'gmail', scopes: ['gmail.readonly'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	inputs: {
		lookbackMinutes: {
			type: 'number',
			label: 'Lookback (minutes)',
			default: 60,
			description: 'How far back to check for new emails',
		},

		labelFilter: {
			type: 'string',
			label: 'Gmail Label',
			default: 'WORKWAY',
			description: 'Only sync emails with this label (leave empty for all unread)',
		},
	},

	// Run every 15 minutes
	trigger: cron({
		schedule: '*/15 * * * *',
		timezone: 'UTC',
	}),

	async execute({ inputs, integrations }) {
		const results: Array<{
			messageId: string;
			subject: string;
			notionPageUrl?: string;
		}> = [];

		// Build Gmail query
		const lookbackMs = (inputs.lookbackMinutes || 60) * 60 * 1000;
		const afterDate = new Date(Date.now() - lookbackMs);
		const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

		let query = `after:${afterTimestamp}`;
		if (inputs.labelFilter) {
			query += ` label:${inputs.labelFilter}`;
		} else {
			query += ' is:unread';
		}

		// Fetch messages from Gmail
		let messages: GmailMessage[] = [];
		try {
			const listResponse = await integrations.gmail.request(
				`/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
				{ method: 'GET' }
			);

			if (listResponse.ok) {
				const listData = (await listResponse.json()) as { messages?: GmailMessage[] };
				messages = listData.messages || [];
			}
		} catch (error) {
			console.error('[gmail-to-notion] Failed to list messages:', error);
			return {
				success: false,
				error: 'Failed to fetch emails from Gmail',
				synced: 0,
			};
		}

		if (messages.length === 0) {
			return {
				success: true,
				synced: 0,
				message: 'No new emails found',
			};
		}

		// Process each message
		for (const message of messages) {
			// Get full message details
			let fullMessage: GmailMessageFull;
			try {
				const msgResponse = await integrations.gmail.request(
					`/gmail/v1/users/me/messages/${message.id}?format=full`,
					{ method: 'GET' }
				);
				if (!msgResponse.ok) continue;
				fullMessage = (await msgResponse.json()) as GmailMessageFull;
			} catch {
				continue;
			}

			const messageId = getHeader(fullMessage.payload.headers, 'Message-ID') || message.id;
			const subject = getHeader(fullMessage.payload.headers, 'Subject');
			const from = getHeader(fullMessage.payload.headers, 'From');
			const date = new Date(parseInt(fullMessage.internalDate)).toISOString();

			// Check for duplicates
			const alreadyExists = await checkExistingPage(
				integrations.notion,
				HALFDOZEN_INTERNAL_LLM_DATABASE,
				messageId
			);

			if (alreadyExists) {
				continue;
			}

			// Extract body
			const body = extractTextBody(fullMessage.payload);

			// Build Gmail URL
			const threadUrl = `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`;

			// Create Notion page
			const notionPage = await createNotionEmailPage({
				databaseId: HALFDOZEN_INTERNAL_LLM_DATABASE,
				subject,
				from,
				date,
				body: body.slice(0, 10000), // Limit body length
				messageId,
				threadUrl,
				integrations,
			});

			results.push({
				messageId,
				subject,
				notionPageUrl: notionPage?.url,
			});
		}

		return {
			success: true,
			synced: results.length,
			results,
		};
	},

	onError: async ({ error }) => {
		console.error('[gmail-to-notion] Workflow failed:', error);
	},
});

// ============================================================================
// METADATA
// ============================================================================

/**
 * Workflow metadata - Private workflow for @halfdozen.co
 */
export const metadata = {
	id: 'gmail-to-notion-private',
	category: 'productivity',
	featured: false,

	// Private workflow - requires WORKWAY login
	visibility: 'private' as const,
	accessGrants: [{ type: 'email_domain' as const, value: 'halfdozen.co' }],

	// BYOO required
	credentialMode: 'developer' as const,

	// Why this exists
	workaroundReason: 'Gmail OAuth scopes require Google app verification for public apps',
	infrastructureRequired: ['BYOO Google OAuth app'],

	// Analytics URL
	analyticsUrl: 'https://workway.co/workflows/private/gmail-to-notion-private/analytics',

	stats: { rating: 0, users: 0, reviews: 0 },
};

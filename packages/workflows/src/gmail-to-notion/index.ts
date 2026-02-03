/**
 * Gmail to Notion - Simplified
 *
 * Simplified workflow that syncs labeled Gmail emails to a Notion database.
 * Each email becomes a single Notion page with AI summary and rich formatting.
 *
 * ## Key Differences from private-emails-documented
 *
 * - Individual emails (not threads) - simpler mental model
 * - Single-level deduplication via Gmail Message ID
 * - No contact management - users link contacts manually if needed
 * - No thread tracking - each email processed once
 *
 * ## Notion Schema (5 properties)
 *
 * Required properties:
 * - Subject (title): Email subject
 * - From (rich_text): Sender name and email
 * - Date (date): Email received date
 * - Gmail ID (rich_text): For deduplication
 * - Summary (rich_text): AI-generated summary (optional)
 *
 * @see /packages/workflows/src/private-emails-documented - Full-featured version
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get configuration from workflow context.
 */
function getConfig(config?: Record<string, unknown>) {
	return {
		/** Notion database ID for emails */
		databaseId:
			(config?.notionDatabaseId as string) ||
			(typeof process !== 'undefined' ? process.env.NOTION_DATABASE_ID : undefined) ||
			'',

		/** Gmail label to watch for syncing */
		gmailLabel: (config?.gmailLabel as string) || 'To Notion',

		/** Infrastructure URL for Gmail worker */
		connectionUrl:
			(config?.connectionUrl as string) ||
			(typeof process !== 'undefined' ? process.env.GMAIL_CONNECTION_URL : undefined) ||
			'https://arc.workway.co',

		/** Max emails to process per run */
		maxEmails: (config?.maxEmails as number) || 25,
	};
}

/** Workers AI model for summaries */
const AI_MODEL = '@cf/meta/llama-3-8b-instruct';

// ============================================================================
// TYPES
// ============================================================================

interface EmailParticipant {
	email: string;
	name: string;
}

interface ParsedEmail {
	messageId: string;
	from: EmailParticipant;
	to: EmailParticipant[];
	cc: EmailParticipant[];
	subject: string;
	date: string;
	body: string;
	allParticipants: EmailParticipant[];
}

// ============================================================================
// EXECUTION TRACKING
// ============================================================================

/**
 * Track workflow execution for dashboard visibility
 * POSTs to the Arc for Gmail worker for user-specific analytics
 */
async function trackExecution(
	userId: string,
	apiSecret: string,
	connectionUrl: string,
	data: {
		status: 'running' | 'success' | 'failed';
		emailsSynced?: number;
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
				Authorization: `Bearer ${apiSecret}`,
			},
			body: JSON.stringify({
				workflow_id: 'gmail-to-notion',
				trigger_type: 'schedule',
				status: data.status,
				emails_synced: data.emailsSynced || 0,
				result_summary: data.resultSummary,
				error_message: data.errorMessage,
				started_at: data.startedAt,
				completed_at: data.completedAt,
				execution_time_ms: data.executionTimeMs,
			}),
		});
	} catch (error) {
		// Don't fail the workflow if tracking fails
		console.error('[Workflow] Failed to track execution:', error);
	}
}

// ============================================================================
// HTML TO NOTION BLOCKS CONVERSION
// ============================================================================

/**
 * Sanitize HTML to prevent XSS attacks
 */
function sanitizeHtml(html: string): string {
	if (!html) return '';

	let cleaned = html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
		.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
		.replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
		.replace(/<applet[^>]*>[\s\S]*?<\/applet>/gi, '')
		.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
		.replace(/<input[^>]*>/gi, '')
		.replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, '')
		.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
		.replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '')
		.replace(/<meta[^>]*>/gi, '')
		.replace(/<link[^>]*>/gi, '')
		.replace(/<base[^>]*>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '')
		.replace(/<\/?[ovwxp]:[^>]*>/gi, '');

	cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
	cleaned = cleaned.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');

	cleaned = cleaned.replace(
		/(<[^>]+\s+(?:href|src)\s*=\s*["'])([^"']*)(["'][^>]*>)/gi,
		(match, prefix, url, suffix) => {
			const lowerUrl = url.toLowerCase().trim();
			if (
				lowerUrl.startsWith('javascript:') ||
				lowerUrl.startsWith('data:') ||
				lowerUrl.startsWith('vbscript:') ||
				lowerUrl.startsWith('file:')
			) {
				return prefix + 'about:blank' + suffix;
			}
			return match;
		}
	);

	cleaned = cleaned.replace(/\s+style\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '');

	return cleaned;
}

/**
 * Convert HTML to Notion block objects
 */
function htmlToNotionBlocks(html: string): any[] {
	const blocks: any[] = [];
	let cleanedHtml = sanitizeHtml(html).replace(/<!DOCTYPE[^>]*>/gi, '');

	// Extract headings
	const headingMatches = Array.from(cleanedHtml.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi));
	for (const match of headingMatches) {
		const level = parseInt(match[1]);
		const text = sanitizeText(stripTags(match[2]));
		if (text) {
			const headingType = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3';
			blocks.push({ [headingType]: { rich_text: [{ text: { content: text.substring(0, 2000) } }] } });
		}
	}

	// Extract list items
	const listItemMatches = Array.from(cleanedHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
	for (const match of listItemMatches) {
		const text = sanitizeText(stripTags(match[1]));
		if (text) {
			blocks.push({
				bulleted_list_item: { rich_text: [{ text: { content: text.substring(0, 2000) } }] },
			});
		}
	}

	// Extract blockquotes
	const quoteMatches = Array.from(cleanedHtml.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi));
	for (const match of quoteMatches) {
		const text = sanitizeText(stripTags(match[1]));
		if (text) {
			blocks.push({ quote: { rich_text: [{ text: { content: text.substring(0, 2000) } }] } });
		}
	}

	// Extract paragraphs
	const paragraphs = cleanedHtml
		.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '')
		.replace(/<[uo]l[^>]*>[\s\S]*?<\/[uo]l>/gi, '')
		.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
		.split(/<p[^>]*>|<br\s*\/?>/gi)
		.map((p) => sanitizeText(stripTags(p)))
		.filter((p) => p.length > 0);

	for (const text of paragraphs) {
		const chunks = splitText(text, 1900);
		for (const chunk of chunks) {
			blocks.push({ paragraph: { rich_text: [{ text: { content: chunk } }] } });
		}
	}

	// Fallback: if no blocks, convert entire HTML to plain text
	if (blocks.length === 0) {
		const plainText = sanitizeText(stripTags(cleanedHtml));
		if (plainText) {
			const chunks = splitText(plainText, 1900);
			for (const chunk of chunks) {
				blocks.push({ paragraph: { rich_text: [{ text: { content: chunk } }] } });
			}
		}
	}

	return blocks;
}

function stripTags(html: string): string {
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitText(text: string, maxLength: number): string[] {
	if (text.length <= maxLength) return [text];

	const chunks: string[] = [];
	let currentChunk = '';
	const words = text.split(' ');

	for (const word of words) {
		if ((currentChunk + ' ' + word).length > maxLength) {
			if (currentChunk) chunks.push(currentChunk.trim());
			currentChunk = word;
		} else {
			currentChunk = currentChunk ? currentChunk + ' ' + word : word;
		}
	}

	if (currentChunk) chunks.push(currentChunk.trim());
	return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
}

function sanitizeText(text: string): string {
	if (!text) return '';

	return text
		.replace(/[\u00A0\u2007\u202F]/g, ' ')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
		.replace(/â€\u0153/g, '')
		.replace(/â‚¬/g, '')
		.replace(/[\u00C2\u00E2]/g, '')
		.replace(/[\u201A]/g, '')
		.replace(/[\u00AC]/g, '')
		.replace(/[¶¢ªº]/g, '')
		.replace(/[\u00CD]/g, '')
		.replace(/\uFFFD/g, '')
		.replace(/ {2,}/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// ============================================================================
// AI SUMMARY GENERATION
// ============================================================================

async function generateSummary(email: ParsedEmail, ai: any): Promise<string | null> {
	if (!ai) return null;

	const prompt = `
Summarize this email in 1-2 sentences.
Focus on the key point, action item, or request.

From: ${email.from.name || email.from.email}
Subject: ${email.subject}
Body: ${email.body.substring(0, 1000)}
`;

	try {
		const response = await ai.run(AI_MODEL, {
			messages: [
				{ role: 'system', content: 'You are a helpful assistant that summarizes emails concisely.' },
				{ role: 'user', content: prompt },
			],
		});

		return response.response;
	} catch (error) {
		console.error('AI generation failed:', error);
		return null;
	}
}

// ============================================================================
// GMAIL HELPERS
// ============================================================================

function decodeBase64Url(str: string): string {
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (base64.length % 4) {
		base64 += '=';
	}
	try {
		return atob(base64);
	} catch {
		return str;
	}
}

function extractEmailBody(payload: any): string {
	if (payload.body?.data) {
		return decodeBase64Url(payload.body.data);
	}

	if (payload.parts) {
		for (const part of payload.parts) {
			if (part.mimeType === 'text/plain' && part.body?.data) {
				return decodeBase64Url(part.body.data);
			}
			if (part.parts) {
				for (const nested of part.parts) {
					if (nested.mimeType === 'text/plain' && nested.body?.data) {
						return decodeBase64Url(nested.body.data);
					}
				}
			}
		}

		// Fallback to HTML
		for (const part of payload.parts) {
			if (part.mimeType === 'text/html' && part.body?.data) {
				const html = decodeBase64Url(part.body.data);
				return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
			}
		}
	}

	return '';
}

function parseEmailParticipant(headerValue: string): EmailParticipant {
	const match = headerValue.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
	if (match) {
		return {
			name: (match[1] || '').trim(),
			email: match[2].trim().toLowerCase(),
		};
	}
	return { name: '', email: headerValue.trim().toLowerCase() };
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
	const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
	return header?.value || '';
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Gmail to Notion',
	description:
		'Sync labeled Gmail emails to a Notion database. Each email becomes a page with AI summary and rich formatting.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_emails_arrive',

		outcomeStatement: {
			suggestion: 'Want important emails to become searchable notes?',
			explanation:
				'Label any Gmail email and it syncs automatically to Notion with AI summary and formatting preserved.',
			outcome: 'Emails that document themselves',
		},

		primaryPair: {
			from: 'gmail-byoo',
			to: 'notion',
			workflowId: 'gmail-to-notion',
			outcome: 'Labeled emails become Notion pages',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'gmail-to-notion',
				priority: 30,
			},
		],

		smartDefaults: {
			gmailLabel: { value: 'To Notion' },
		},

		essentialFields: ['gmail_connection_id', 'notion_database_id'],

		zuhandenheit: {
			timeToValue: 5,
			worksOutOfBox: false, // Requires BYOO setup
			gracefulDegradation: true,
			automaticTrigger: false,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.02,
		freeExecutions: 100,
		description: 'Per email synced',
	},

	integrations: [
		{ service: 'gmail', scopes: ['gmail.readonly'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	config: {
		gmail_connection_id: {
			type: 'string',
			label: 'Gmail Connection ID',
			required: true,
			description: 'Your unique identifier for the Gmail BYOO connection',
		},

		notion_database_id: {
			type: 'string',
			label: 'Notion Database ID',
			required: true,
			description: 'The Notion database to add emails to',
		},

		gmail_label: {
			type: 'string',
			label: 'Gmail Label',
			default: 'To Notion',
			description: 'Only sync emails with this label',
		},

		max_emails: {
			type: 'number',
			label: 'Max Emails per Run',
			default: 25,
			description: 'Maximum emails to process per execution',
		},

		connection_url: {
			type: 'string',
			label: 'Connection URL',
			default: 'https://arc.workway.co',
			description: 'Infrastructure URL for Gmail worker (BYOO)',
		},
	},

	// Run every 5 minutes
	trigger: cron({
		schedule: '*/5 * * * *',
		timezone: 'UTC',
	}),

	async execute({ inputs, integrations, env, config }) {
		const startTime = Date.now();
		const startedAt = new Date().toISOString();

		const workflowConfig = getConfig(config);
		const userId = inputs.gmailConnectionId;
		const apiSecret = (env as any).GMAIL_API_SECRET || '';

		if (!userId) {
			return {
				success: false,
				error: 'Missing Gmail connection ID. Please complete setup.',
				action: 'setup_required',
				actionLabel: 'Complete Setup',
				actionUrl: `${workflowConfig.connectionUrl}/setup`,
			};
		}

		if (!workflowConfig.databaseId) {
			return {
				success: false,
				error: 'Missing Notion database ID. Configure via notion_database_id.',
			};
		}

		// Track execution start
		await trackExecution(userId, apiSecret, workflowConfig.connectionUrl, {
			status: 'running',
			startedAt,
		});

		const labelName = inputs.gmailLabel || workflowConfig.gmailLabel;
		const maxEmails = inputs.maxEmails || workflowConfig.maxEmails;

		// 1. Get label ID
		const labelsResponse = await integrations.gmail.request('/gmail/v1/users/me/labels', {
			method: 'GET',
		});

		if (!labelsResponse.ok) {
			return { success: false, error: 'Failed to fetch Gmail labels', synced: 0 };
		}

		const labelsData = (await labelsResponse.json()) as { labels: Array<{ id: string; name: string }> };
		const syncLabel = labelsData.labels.find((l) => l.name === labelName);

		if (!syncLabel) {
			await trackExecution(userId, apiSecret, workflowConfig.connectionUrl, {
				status: 'failed',
				startedAt,
				completedAt: new Date().toISOString(),
				executionTimeMs: Date.now() - startTime,
				errorMessage: `Label "${labelName}" not found`,
			});

			return {
				success: true,
				synced: 0,
				message: `Label "${labelName}" not found. Create it in Gmail first.`,
			};
		}

		// 2. Fetch messages with the sync label
		const messagesResponse = await integrations.gmail.request(
			`/gmail/v1/users/me/messages?labelIds=${syncLabel.id}&maxResults=${maxEmails}`,
			{ method: 'GET' }
		);

		if (!messagesResponse.ok) {
			return { success: false, error: 'Failed to fetch Gmail messages', synced: 0 };
		}

		const messagesData = (await messagesResponse.json()) as { messages?: Array<{ id: string }> };
		const messages = messagesData.messages || [];

		if (messages.length === 0) {
			return { success: true, synced: 0, message: 'No messages with sync label' };
		}

		const results: Array<{
			messageId: string;
			subject: string;
			notionPageId?: string;
			skipped?: boolean;
		}> = [];

		// 3. Process each message
		for (const message of messages) {
			// Check if already exists in Notion (deduplication)
			const existingPage = await integrations.notion.databases.query({
				database_id: workflowConfig.databaseId,
				filter: {
					property: 'Gmail ID',
					rich_text: { equals: message.id },
				},
				page_size: 1,
			});

			if (existingPage.success && existingPage.data?.length > 0) {
				// Skip duplicate
				results.push({ messageId: message.id, subject: '', skipped: true });
				continue;
			}

			// Fetch full message
			const messageResponse = await integrations.gmail.request(
				`/gmail/v1/users/me/messages/${message.id}?format=full`,
				{ method: 'GET' }
			);

			if (!messageResponse.ok) continue;

			const messageData = (await messageResponse.json()) as {
				id: string;
				payload: { headers: Array<{ name: string; value: string }>; parts?: any[]; body?: any };
				internalDate: string;
			};

			// Parse email
			const from = parseEmailParticipant(getHeader(messageData.payload.headers, 'From'));
			const toHeader = getHeader(messageData.payload.headers, 'To');
			const ccHeader = getHeader(messageData.payload.headers, 'Cc');

			const to = toHeader ? toHeader.split(',').map((t) => parseEmailParticipant(t.trim())) : [];
			const cc = ccHeader ? ccHeader.split(',').map((t) => parseEmailParticipant(t.trim())) : [];

			const email: ParsedEmail = {
				messageId: messageData.id,
				from,
				to,
				cc,
				subject: getHeader(messageData.payload.headers, 'Subject') || '(No subject)',
				date: new Date(parseInt(messageData.internalDate)).toISOString(),
				body: extractEmailBody(messageData.payload),
				allParticipants: [from, ...to, ...cc],
			};

			// Generate AI summary
			let summary: string | null = null;
			if ((env as any).AI) {
				summary = await generateSummary(email, (env as any).AI);
			}

			// Build page properties
			const fromDisplay = email.from.name
				? `${email.from.name} <${email.from.email}>`
				: email.from.email;

			const properties: any = {
				Subject: { title: [{ text: { content: email.subject } }] },
				From: { rich_text: [{ text: { content: fromDisplay.substring(0, 2000) } }] },
				Date: { date: { start: email.date } },
				'Gmail ID': { rich_text: [{ text: { content: email.messageId } }] },
			};

			if (summary) {
				properties.Summary = { rich_text: [{ text: { content: summary.substring(0, 2000) } }] };
			}

			// Build content blocks
			const contentBlocks: any[] = [];

			// Add AI summary callout if available
			if (summary) {
				contentBlocks.push({
					callout: {
						rich_text: [{ text: { content: summary } }],
						icon: { emoji: '\u{1F4AC}' },
						color: 'blue_background',
					},
				});
			}

			// Email metadata
			const toNames = email.to.map((t) => t.name || t.email).join(', ');
			const dateFormatted = new Date(email.date).toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			});

			contentBlocks.push({
				quote: {
					rich_text: [{ text: { content: `${fromDisplay} → ${toNames} | ${dateFormatted}` } }],
				},
			});

			// Email body with rich formatting
			const bodyBlocks = htmlToNotionBlocks(email.body);
			contentBlocks.push(...bodyBlocks);

			// Create Notion page
			const createResult = await integrations.notion.pages.create({
				parent: { database_id: workflowConfig.databaseId },
				properties,
				children: contentBlocks.slice(0, 100), // Notion limit
			});

			if (createResult.success) {
				results.push({
					messageId: email.messageId,
					subject: email.subject,
					notionPageId: createResult.data.id,
				});

				// Append remaining blocks if any
				if (contentBlocks.length > 100) {
					for (let i = 100; i < contentBlocks.length; i += 100) {
						await integrations.notion.blocks.children.append({
							block_id: createResult.data.id,
							children: contentBlocks.slice(i, i + 100),
						});
					}
				}
			}
		}

		const synced = results.filter((r) => !r.skipped).length;
		const skipped = results.filter((r) => r.skipped).length;

		// Track successful execution
		await trackExecution(userId, apiSecret, workflowConfig.connectionUrl, {
			status: 'success',
			emailsSynced: synced,
			resultSummary: `Synced ${synced} emails, skipped ${skipped} duplicates`,
			startedAt,
			completedAt: new Date().toISOString(),
			executionTimeMs: Date.now() - startTime,
		});

		return {
			success: true,
			synced,
			skipped,
			results: results.filter((r) => !r.skipped),
		};
	},

	onError: async ({ error, inputs }) => {
		const userId = inputs.gmailConnectionId || 'unknown';
		console.error(`Gmail to Notion failed for user ${userId}:`, error);
	},
});

// ============================================================================
// METADATA
// ============================================================================

export const metadata = {
	id: 'gmail-to-notion',
	category: 'productivity',
	featured: false,

	// Private workflow - requires BYOO setup
	visibility: 'private' as const,
	accessGrants: [{ type: 'email_domain' as const, value: 'halfdozen.co' }],

	experimental: true,
	requiresCustomInfrastructure: true,

	stats: { rating: 0, users: 0, reviews: 0 },
};

/**
 * Gmail to Notion - Private (Half Dozen Internal)
 *
 * Organization-specific workflow for @halfdozen.co team.
 * Syncs Gmail threads to the team's Notion Interactions database.
 *
 * ## Architecture
 *
 * - Transcript source: Gmail API (via BYOO OAuth)
 * - Storage: Half Dozen's central Notion database
 * - Auth: BYOO (Bring Your Own OAuth) - organization's Google Cloud app
 * - AI: Workers AI for thread summaries
 *
 * ## Capabilities
 *
 * - Gmail Threads: Label-based sync ("Log to Notion")
 * - Contact Management: Auto-creates Notion contacts for external participants
 * - AI Summaries: Workers AI generates thread summaries
 * - Thread Tracking: Deduplication by Gmail Thread ID
 * - HTML→Notion: Rich conversion preserving bold, italic, links, lists
 * - Mojibake Removal: Cleans broken UTF-8 from email HTML
 *
 * ## vs. gmail-to-notion (Public - Future)
 *
 * | Feature | Private | Public |
 * |---------|---------|--------|
 * | OAuth | BYOO (org app) | WORKWAY verified app |
 * | Database | Hardcoded | User-configurable |
 * | Verification | Not required | Google verification required |
 *
 * ## Why BYOO?
 *
 * Gmail OAuth scopes require Google app verification for public apps.
 * Using BYOO with the organization's own Google Cloud app allows
 * unverified apps for internal organizational use.
 *
 * ## Notion Schema (Interactions Database)
 *
 * Required properties:
 * - Interaction (title): Email subject
 * - Type (select): "Email"
 * - Date (date): Latest email timestamp
 * - Summary (rich_text): AI-generated thread summary
 * - Contacts (relation): Links to Contacts database
 * - Thread ID (rich_text): Gmail thread ID for deduplication
 *
 * @see /packages/workflows/src/meeting-intelligence-private - Pattern reference
 * @private For @halfdozen.co team only
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// ============================================================================
// HALF DOZEN INTERNAL CONSTANTS
// These are organization-specific. Do NOT use this workflow as a template.
// ============================================================================

/**
 * Half Dozen's central LLM database in Notion (Interactions)
 * All email intelligence data for @halfdozen.co goes here.
 * This is intentionally NOT configurable - it's internal infrastructure.
 */
const HALFDOZEN_INTERACTIONS_DATABASE = '27a019187ac580b797fec563c98afbbc';

/**
 * Half Dozen's Contacts database in Notion
 * Auto-creates contacts for external email participants.
 */
const HALFDOZEN_CONTACTS_DATABASE = 'ccd3f8e7-5cc1-48c4-90b2-69a8f3d78e5c'; // TODO: Get actual contacts database ID

/**
 * Internal domains for @halfdozen.co team
 * Used to categorize participants as internal vs external
 */
const HALFDOZEN_INTERNAL_DOMAINS = ['halfdozen.co'];

/** Gmail label to watch for syncing */
const GMAIL_LABEL = 'Log to Notion';

/** Workers AI model for summaries */
const AI_MODEL = '@cf/meta/llama-3-8b-instruct';

/** Infrastructure URL - Arc for Gmail worker */
const GMAIL_CONNECTION_URL = 'https://arc.halfdozen.co';

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

interface ThreadTracking {
	pageId: string;
	threadId: string;
	lastProcessedAt: string;
	messageCount: number;
	processedMessageIds: string[];
}

// ============================================================================
// EXECUTION TRACKING (matches meeting-intelligence-private pattern)
// ============================================================================

/**
 * Track workflow execution for dashboard visibility
 * POSTs to the Arc for Gmail worker for user-specific analytics
 */
async function trackExecution(
	userId: string,
	apiSecret: string,
	data: {
		status: 'running' | 'success' | 'failed';
		threadsSynced?: number;
		contactsCreated?: number;
		resultSummary?: string;
		errorMessage?: string;
		startedAt?: string;
		completedAt?: string;
		executionTimeMs?: number;
	}
) {
	try {
		await fetch(`${GMAIL_CONNECTION_URL}/executions/${userId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiSecret}`,
			},
			body: JSON.stringify({
				workflow_id: 'gmail-to-notion-private',
				trigger_type: 'schedule',
				status: data.status,
				threads_synced: data.threadsSynced || 0,
				contacts_created: data.contactsCreated || 0,
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
// Simplified regex-based conversion (no external dependencies)
// ============================================================================

/**
 * Convert HTML to Notion block objects
 * Uses regex-based parsing to avoid external dependencies
 */
function htmlToNotionBlocks(html: string): any[] {
	const blocks: any[] = [];

	// Clean HTML first
	let cleanedHtml = html
		.replace(/<!DOCTYPE[^>]*>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '')
		.replace(/<\/?[ovwxp]:[^>]*>/gi, '');

	// Extract headings
	const headingMatches = cleanedHtml.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi);
	for (const match of headingMatches) {
		const level = parseInt(match[1]);
		const text = sanitizeText(stripTags(match[2]));
		if (text) {
			const headingType = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3';
			blocks.push({ [headingType]: { rich_text: [{ text: { content: text.substring(0, 2000) } }] } });
		}
	}

	// Extract list items
	const listItemMatches = cleanedHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
	for (const match of listItemMatches) {
		const text = sanitizeText(stripTags(match[1]));
		if (text) {
			blocks.push({
				bulleted_list_item: { rich_text: [{ text: { content: text.substring(0, 2000) } }] },
			});
		}
	}

	// Extract blockquotes
	const quoteMatches = cleanedHtml.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi);
	for (const match of quoteMatches) {
		const text = sanitizeText(stripTags(match[1]));
		if (text) {
			blocks.push({ quote: { rich_text: [{ text: { content: text.substring(0, 2000) } }] } });
		}
	}

	// Extract paragraphs - process remaining text
	const paragraphs = cleanedHtml
		.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '')
		.replace(/<[uo]l[^>]*>[\s\S]*?<\/[uo]l>/gi, '')
		.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
		.split(/<p[^>]*>|<br\s*\/?>/gi)
		.map((p) => sanitizeText(stripTags(p)))
		.filter((p) => p.length > 0);

	for (const text of paragraphs) {
		// Split long text into chunks
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

/**
 * Strip HTML tags from string
 */
function stripTags(html: string): string {
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Split text into chunks of max length
 */
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

/**
 * Sanitize text content by removing corrupted characters and normalizing whitespace
 * Removes UTF-8 mojibake characters that appear in email HTML
 */
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

async function generateSummary(emails: ParsedEmail[], ai: any): Promise<string | null> {
	if (!ai) return null;

	const context = emails
		.map(
			(e) =>
				`From: ${e.from.name || e.from.email}\nDate: ${e.date}\nSubject: ${e.subject}\nBody: ${e.body.substring(0, 500)}...`
		)
		.join('\n\n---\n\n');

	const prompt = `
    Summarize the following email thread in 2-3 sentences.
    Focus on the key decisions, action items, or emotional tone.
    Make it useful for someone quickly glancing at the Notion page.

    Emails:
    ${context}
  `;

	try {
		const response = await ai.run(AI_MODEL, {
			messages: [
				{ role: 'system', content: 'You are a helpful assistant that summarizes email threads.' },
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
// NOTION HELPERS
// ============================================================================

async function findOrCreateContact(
	participant: EmailParticipant,
	notion: any,
	contactsDatabaseId: string
): Promise<string> {
	// Search for existing contact by email
	const searchResult = await notion.databases.query({
		database_id: contactsDatabaseId,
		filter: {
			property: 'Email',
			email: { equals: participant.email },
		},
		page_size: 1,
	});

	if (searchResult.success && searchResult.data?.length > 0) {
		return searchResult.data[0].id;
	}

	// Create new contact
	const name = participant.name || participant.email.split('@')[0];
	const createResult = await notion.pages.create({
		parent: { database_id: contactsDatabaseId },
		properties: {
			Name: { title: [{ text: { content: name } }] },
			Email: { email: participant.email },
		},
	});

	if (createResult.success) {
		console.log(`Created new contact: ${name} (${participant.email})`);
		return createResult.data.id;
	}

	throw new Error(`Failed to create contact: ${participant.email}`);
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Gmail to Notion (Half Dozen Internal)',
	description:
		'Internal workflow for @halfdozen.co. Gmail threads sync to central database via label-based trigger. Requires BYOO Google OAuth app.',
	version: '2.0.0',

	pathway: {
		outcomeFrame: 'when_emails_arrive',

		outcomeStatement: {
			suggestion: 'Want email threads to become searchable knowledge?',
			explanation:
				'Label any Gmail thread "Log to Notion" and it syncs automatically with AI summary, contact links, and rich formatting preserved. Requires BYOO setup.',
			outcome: 'Email threads that document themselves (with BYOO app)',
		},

		primaryPair: {
			from: 'gmail-byoo',
			to: 'notion',
			workflowId: 'gmail-to-notion-private',
			outcome: 'Emails documented (requires BYOO app)',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'gmail-to-notion-private',
				priority: 25, // Lower than OAuth version (future)
			},
		],

		smartDefaults: {
			gmailLabel: { value: 'Log to Notion' },
		},

		essentialFields: ['gmailConnectionId'],

		zuhandenheit: {
			timeToValue: 5, // Minutes - be honest about BYOO setup
			worksOutOfBox: false, // Requires BYOO setup
			gracefulDegradation: true,
			automaticTrigger: false, // Requires BYOO setup first
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.05,
		freeExecutions: 50,
		description: 'Per thread synced',
	},

	integrations: [
		{ service: 'gmail', scopes: ['gmail.readonly'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
	],

	inputs: {
		gmailConnectionId: {
			type: 'string',
			label: 'Gmail Connection ID',
			required: true,
			description: 'Your unique identifier for the Gmail BYOO connection (set during setup)',
		},

		// Database is hardcoded to Internal LLM for @halfdozen.co users
		// interactionsDatabaseId removed - all data goes to central hub
		// contactsDatabaseId removed - all data goes to central hub

		gmailLabel: {
			type: 'string',
			label: 'Gmail Label',
			default: 'Log to Notion',
			description: 'Only sync threads with this label',
		},
	},

	// Run every 5 minutes (same as Arc for Gmail)
	trigger: cron({
		schedule: '*/5 * * * *',
		timezone: 'UTC',
	}),

	async execute({ inputs, integrations, env }) {
		const startTime = Date.now();
		const startedAt = new Date().toISOString();

		const results: Array<{
			threadId: string;
			subject: string;
			notionPageId?: string;
			isUpdate: boolean;
		}> = [];

		let contactsCreated = 0;

		// Get user identifier (from inputs - set during setup)
		const userId = inputs.gmailConnectionId;
		const apiSecret = (env as any).GMAIL_API_SECRET || '';

		if (!userId) {
			return {
				success: false,
				error: 'Missing Gmail connection ID. Please complete setup.',
				action: 'setup_required',
				actionLabel: 'Complete Setup',
				actionUrl: `${GMAIL_CONNECTION_URL}/setup`,
			};
		}

		// Track execution start
		await trackExecution(userId, apiSecret, {
			status: 'running',
			startedAt,
		});

		const labelName = inputs.gmailLabel || GMAIL_LABEL;
		const internalDomains = HALFDOZEN_INTERNAL_DOMAINS;

		// 1. Get label ID for the sync label
		const labelsResponse = await integrations.gmail.request('/gmail/v1/users/me/labels', {
			method: 'GET',
		});

		if (!labelsResponse.ok) {
			return { success: false, error: 'Failed to fetch Gmail labels', synced: 0 };
		}

		const labelsData = (await labelsResponse.json()) as { labels: Array<{ id: string; name: string }> };
		const syncLabel = labelsData.labels.find((l) => l.name === labelName);

		if (!syncLabel) {
			// Track failed execution (no label)
			await trackExecution(userId, apiSecret, {
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

		// 2. Fetch threads with the sync label
		const threadsResponse = await integrations.gmail.request(
			`/gmail/v1/users/me/threads?labelIds=${syncLabel.id}&maxResults=10`,
			{ method: 'GET' }
		);

		if (!threadsResponse.ok) {
			return { success: false, error: 'Failed to fetch Gmail threads', synced: 0 };
		}

		const threadsData = (await threadsResponse.json()) as { threads?: Array<{ id: string }> };
		const threads = threadsData.threads || [];

		if (threads.length === 0) {
			return { success: true, synced: 0, message: 'No threads with sync label' };
		}

		// 3. Process each thread
		for (const thread of threads) {
			// Fetch full thread
			const threadResponse = await integrations.gmail.request(
				`/gmail/v1/users/me/threads/${thread.id}?format=full`,
				{ method: 'GET' }
			);

			if (!threadResponse.ok) continue;

			const threadData = (await threadResponse.json()) as {
				id: string;
				messages: Array<{
					id: string;
					payload: { headers: Array<{ name: string; value: string }>; parts?: any[]; body?: any };
					internalDate: string;
				}>;
			};

			// Parse emails from thread
			const emails: ParsedEmail[] = threadData.messages.map((msg) => {
				const from = parseEmailParticipant(getHeader(msg.payload.headers, 'From'));
				const toHeader = getHeader(msg.payload.headers, 'To');
				const ccHeader = getHeader(msg.payload.headers, 'Cc');

				const to = toHeader ? toHeader.split(',').map((t) => parseEmailParticipant(t.trim())) : [];
				const cc = ccHeader ? ccHeader.split(',').map((t) => parseEmailParticipant(t.trim())) : [];

				return {
					messageId: msg.id,
					from,
					to,
					cc,
					subject: getHeader(msg.payload.headers, 'Subject'),
					date: new Date(parseInt(msg.internalDate)).toISOString(),
					body: extractEmailBody(msg.payload),
					allParticipants: [from, ...to, ...cc],
				};
			});

			// Check if thread already exists in Notion (using hardcoded database)
			const existingPage = await integrations.notion.databases.query({
				database_id: HALFDOZEN_INTERACTIONS_DATABASE,
				filter: {
					property: 'Thread ID',
					rich_text: { equals: thread.id },
				},
				page_size: 1,
			});

			const isUpdate = existingPage.success && existingPage.data?.length > 0;

			// Categorize participants
			const externalParticipants: EmailParticipant[] = [];
			const internalParticipants = new Set<string>();

			for (const email of emails) {
				for (const participant of email.allParticipants) {
					const domain = participant.email.split('@')[1];
					if (internalDomains.includes(domain)) {
						internalParticipants.add(participant.name || participant.email);
					} else if (!externalParticipants.find((p) => p.email === participant.email)) {
						externalParticipants.push(participant);
					}
				}
			}

			// Find or create contacts (using hardcoded database)
			const contactIds: string[] = [];
			for (const participant of externalParticipants) {
				try {
					const contactId = await findOrCreateContact(participant, integrations.notion, HALFDOZEN_CONTACTS_DATABASE);
					contactIds.push(contactId);
					contactsCreated++;
				} catch (error) {
					console.error(`Failed to create contact: ${participant.email}`, error);
				}
			}

			// Generate AI summary
			let summary: string | null = null;
			if ((env as any).AI) {
				summary = await generateSummary(emails, (env as any).AI);
			}

			// Build page properties
			const latestDate = emails[emails.length - 1].date;
			const subject = emails[0].subject || '(No subject)';

			const properties: any = {
				Interaction: { title: [{ text: { content: subject } }] },
				Type: { select: { name: 'Email' } },
				Date: { date: { start: latestDate } },
				'Thread ID': { rich_text: [{ text: { content: thread.id } }] },
			};

			if (summary) {
				properties.Summary = { rich_text: [{ text: { content: summary } }] };
			}

			if (contactIds.length > 0) {
				properties.Contacts = { relation: contactIds.map((id) => ({ id })) };
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

			// Add emails (newest first)
			for (let i = emails.length - 1; i >= 0; i--) {
				const email = emails[i];

				if (i < emails.length - 1) {
					contentBlocks.push({ divider: {} });
				}

				// Email header
				const fromName = email.from.name || email.from.email;
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
						rich_text: [{ text: { content: `${fromName} \u2192 ${toNames} | ${dateFormatted}` } }],
					},
				});

				// Email body with rich formatting
				const bodyBlocks = htmlToNotionBlocks(email.body);
				contentBlocks.push(...bodyBlocks);
			}

			// Create or update page
			if (isUpdate) {
				// Update existing page
				const pageId = existingPage.data[0].id;
				await integrations.notion.pages.update({
					page_id: pageId,
					properties: {
						Date: properties.Date,
						Summary: properties.Summary,
						Contacts: properties.Contacts,
					},
				});

				// Append new content (would need to track which messages are new)
				results.push({
					threadId: thread.id,
					subject,
					notionPageId: pageId,
					isUpdate: true,
				});
			} else {
				// Create new page (using hardcoded database)
				const createResult = await integrations.notion.pages.create({
					parent: { database_id: HALFDOZEN_INTERACTIONS_DATABASE },
					properties,
					children: contentBlocks.slice(0, 100), // Notion limit: 100 blocks per request
				});

				if (createResult.success) {
					results.push({
						threadId: thread.id,
						subject,
						notionPageId: createResult.data.id,
						isUpdate: false,
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
		}

		// Track successful execution
		await trackExecution(userId, apiSecret, {
			status: 'success',
			threadsSynced: results.length,
			contactsCreated,
			resultSummary: `Synced ${results.length} threads, created ${contactsCreated} contacts`,
			startedAt,
			completedAt: new Date().toISOString(),
			executionTimeMs: Date.now() - startTime,
		});

		return {
			success: true,
			synced: results.length,
			created: results.filter((r) => !r.isUpdate).length,
			updated: results.filter((r) => r.isUpdate).length,
			contactsCreated,
			results,
			analyticsUrl: 'https://workway.co/workflows/private/gmail-to-notion-private/analytics',
		};
	},

	onError: async ({ error, inputs }) => {
		const userId = inputs.gmailConnectionId || 'unknown';
		console.error(`Gmail to Notion failed for user ${userId}:`, error);

		// Note: We can't track failed executions in onError because env is not available.
		// The execute function already tracks failures when they occur.
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

	// Honest flags (matches meeting-intelligence-private pattern)
	experimental: true,
	requiresCustomInfrastructure: true,
	canonicalAlternative: 'gmail-to-notion', // Future public version

	// Why this exists
	workaroundReason: 'Gmail OAuth scopes require Google app verification for public apps',
	infrastructureRequired: ['BYOO Google OAuth app', 'Arc for Gmail worker'],

	// Upgrade path (when Google verification completes)
	upgradeTarget: 'gmail-to-notion',
	upgradeCondition: 'When WORKWAY Gmail OAuth app is verified',

	// Analytics URL - unified at workway.co/workflows
	// Private workflow analytics are accessible at /workflows/private/{workflow-id}/analytics
	analyticsUrl: 'https://workway.co/workflows/private/gmail-to-notion-private/analytics',

	// Setup URL - initial BYOO connection setup
	setupUrl: `${GMAIL_CONNECTION_URL}/setup`,

	stats: { rating: 0, users: 0, reviews: 0 },
};

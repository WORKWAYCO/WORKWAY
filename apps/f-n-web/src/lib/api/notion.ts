/**
 * Notion API Client
 * Creates database pages for F→N sync
 */

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionDatabase {
	id: string;
	title: Array<{ plain_text: string }>;
	properties: Record<string, NotionProperty>;
}

export interface NotionProperty {
	id: string;
	name: string;
	type: string;
}

export interface NotionPage {
	id: string;
	url: string;
}

export interface NotionClient {
	getDatabases(): Promise<NotionDatabase[]>;
	getDatabase(id: string): Promise<NotionDatabase | null>;
	createPage(databaseId: string, properties: Record<string, unknown>, children?: unknown[]): Promise<NotionPage>;
	appendBlocks(pageId: string, children: unknown[]): Promise<void>;
}

export function createNotionClient(accessToken: string): NotionClient {
	async function request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const response = await fetch(`${NOTION_API_URL}${endpoint}`, {
			...options,
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Notion-Version': NOTION_VERSION,
				'Content-Type': 'application/json',
				...options.headers
			}
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({})) as { message?: string };
			throw new Error(error.message || `Notion API error: ${response.status}`);
		}

		return response.json();
	}

	return {
		async getDatabases(): Promise<NotionDatabase[]> {
			const data = await request<{ results: NotionDatabase[] }>('/search', {
				method: 'POST',
				body: JSON.stringify({
					filter: { property: 'object', value: 'database' },
					page_size: 100
				})
			});

			return data.results || [];
		},

		async getDatabase(id: string): Promise<NotionDatabase | null> {
			try {
				return await request<NotionDatabase>(`/databases/${id}`);
			} catch {
				return null;
			}
		},

		async createPage(
			databaseId: string,
			properties: Record<string, unknown>,
			children: unknown[] = []
		): Promise<NotionPage> {
			return request<NotionPage>('/pages', {
				method: 'POST',
				body: JSON.stringify({
					parent: { database_id: databaseId },
					properties,
					children: children.slice(0, 100) // Notion limit
				})
			});
		},

		async appendBlocks(pageId: string, children: unknown[]): Promise<void> {
			// Notion has a limit of 100 blocks per request
			const batches = [];
			for (let i = 0; i < children.length; i += 100) {
				batches.push(children.slice(i, i + 100));
			}

			for (const batch of batches) {
				await request(`/blocks/${pageId}/children`, {
					method: 'PATCH',
					body: JSON.stringify({ children: batch })
				});
			}
		}
	};
}

/** Notion's 2000 char limit with safety margin */
const NOTION_TEXT_LIMIT = 1900;

/** Truncate text to Notion's limit */
function truncateForNotion(text: string): string {
	return text.length > NOTION_TEXT_LIMIT ? text.slice(0, NOTION_TEXT_LIMIT) + '...' : text;
}

/**
 * Format transcript content as Notion blocks
 */
export function formatTranscriptBlocks(transcript: {
	summary?: {
		overview?: string;
		shorthand_bullet?: string[];
		action_items?: string[];
	};
	sentences?: Array<{
		text: string;
		speaker_name: string;
		start_time: number;
	}>;
}): unknown[] {
	const blocks: unknown[] = [];

	// Summary section
	if (transcript.summary?.overview) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ type: 'text', text: { content: 'Summary' } }]
			}
		});
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: {
				rich_text: [{ type: 'text', text: { content: truncateForNotion(transcript.summary.overview) } }]
			}
		});
	}

	// Key points
	if (transcript.summary?.shorthand_bullet?.length) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ type: 'text', text: { content: 'Key Points' } }]
			}
		});
		// Handle both array and string formats from Fireflies
		const bullets = Array.isArray(transcript.summary.shorthand_bullet)
			? transcript.summary.shorthand_bullet
			: [transcript.summary.shorthand_bullet];
		for (const point of bullets) {
			if (typeof point === 'string' && point.trim()) {
				blocks.push({
					object: 'block',
					type: 'bulleted_list_item',
					bulleted_list_item: {
						rich_text: [{ type: 'text', text: { content: truncateForNotion(point) } }]
					}
				});
			}
		}
	}

	// Action items
	if (transcript.summary?.action_items?.length) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ type: 'text', text: { content: 'Action Items' } }]
			}
		});
		// Handle both array and string formats from Fireflies
		const items = Array.isArray(transcript.summary.action_items)
			? transcript.summary.action_items
			: [transcript.summary.action_items];
		for (const item of items) {
			if (typeof item === 'string' && item.trim()) {
				blocks.push({
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ type: 'text', text: { content: truncateForNotion(item) } }],
						checked: false
					}
				});
			}
		}
	}

	// Full transcript - inside a collapsible toggle (Zuhandenheit: content recedes until needed)
	if (transcript.sentences?.length) {
		blocks.push({
			object: 'block',
			type: 'divider',
			divider: {}
		});

		// Build full transcript text with speaker attribution
		const transcriptParts: string[] = [];
		let currentSpeaker = '';
		let currentText = '';

		for (const sentence of transcript.sentences) {
			const speaker = sentence.speaker_name || 'Speaker';
			if (speaker !== currentSpeaker) {
				// Flush previous speaker's text
				if (currentText) {
					transcriptParts.push(`${currentSpeaker}: ${currentText}`);
				}
				currentSpeaker = speaker;
				currentText = sentence.text;
			} else {
				currentText += ' ' + sentence.text;
			}
		}

		// Flush last speaker
		if (currentText) {
			transcriptParts.push(`${currentSpeaker}: ${currentText}`);
		}

		const fullTranscript = transcriptParts.join('\n\n');

		// Put transcript inside a toggle block (collapsible)
		// All transcript blocks are nested children of the toggle - not top-level blocks
		blocks.push({
			object: 'block',
			type: 'toggle',
			toggle: {
				rich_text: [{ type: 'text', text: { content: 'Full Transcript' } }],
				children: splitTranscriptIntoBlocks(fullTranscript)
			}
		});
	}

	return blocks;
}

/**
 * Split a long transcript into paragraph blocks of ~1900 chars
 * Keeps logical segments (speaker turns) together when possible
 */
function splitTranscriptIntoBlocks(transcript: string): unknown[] {
	const blocks: unknown[] = [];
	const maxChars = 1900;

	// Split on double newlines or speaker turns
	const segments = transcript.split(/\n\n/);
	let currentBlock = '';

	for (const segment of segments) {
		if (currentBlock.length + segment.length + 2 > maxChars) {
			if (currentBlock) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ type: 'text', text: { content: currentBlock } }] }
				});
			}
			// If segment itself is too long, split it
			if (segment.length > maxChars) {
				const words = segment.split(' ');
				let chunk = '';
				for (const word of words) {
					if (chunk.length + word.length + 1 > maxChars) {
						blocks.push({
							object: 'block',
							type: 'paragraph',
							paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] }
						});
						chunk = word;
					} else {
						chunk = chunk ? `${chunk} ${word}` : word;
					}
				}
				currentBlock = chunk;
			} else {
				currentBlock = segment;
			}
		} else {
			currentBlock = currentBlock ? `${currentBlock}\n\n${segment}` : segment;
		}
	}

	if (currentBlock) {
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ type: 'text', text: { content: currentBlock } }] }
		});
	}

	return blocks.length > 0
		? blocks
		: [{
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ type: 'text', text: { content: 'No transcript available' } }] }
		}];
}

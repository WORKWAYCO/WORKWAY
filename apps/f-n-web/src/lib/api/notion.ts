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
				rich_text: [{ type: 'text', text: { content: transcript.summary.overview } }]
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
		for (const point of transcript.summary.shorthand_bullet) {
			blocks.push({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: {
					rich_text: [{ type: 'text', text: { content: point } }]
				}
			});
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
		for (const item of transcript.summary.action_items) {
			blocks.push({
				object: 'block',
				type: 'to_do',
				to_do: {
					rich_text: [{ type: 'text', text: { content: item } }],
					checked: false
				}
			});
		}
	}

	// Full transcript
	if (transcript.sentences?.length) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ type: 'text', text: { content: 'Full Transcript' } }]
			}
		});
		blocks.push({
			object: 'block',
			type: 'divider',
			divider: {}
		});

		// Group by speaker for readability
		let currentSpeaker = '';
		let currentText = '';

		for (const sentence of transcript.sentences) {
			if (sentence.speaker_name !== currentSpeaker) {
				// Flush previous speaker's text
				if (currentText) {
					blocks.push(createTranscriptBlock(currentSpeaker, currentText));
				}
				currentSpeaker = sentence.speaker_name;
				currentText = sentence.text;
			} else {
				currentText += ' ' + sentence.text;
			}
		}

		// Flush last speaker
		if (currentText) {
			blocks.push(createTranscriptBlock(currentSpeaker, currentText));
		}
	}

	return blocks;
}

function createTranscriptBlock(speaker: string, text: string): unknown {
	// Notion has a 2000 char limit per text block
	const truncatedText = text.length > 1900 ? text.slice(0, 1900) + '...' : text;

	return {
		object: 'block',
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: { content: `${speaker}: ` },
					annotations: { bold: true }
				},
				{
					type: 'text',
					text: { content: truncatedText }
				}
			]
		}
	};
}

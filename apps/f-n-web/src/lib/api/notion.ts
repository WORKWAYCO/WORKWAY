/**
 * Notion API Client
 * Creates database pages for F→N sync
 *
 * API Version 2025-09-03:
 * - Uses data_source_id for page creation and queries
 * - Search returns data_source objects instead of database
 */

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';

export interface NotionDatabase {
	id: string;
	title: Array<{ plain_text: string }>;
	properties?: Record<string, NotionProperty>;
	/** Data sources in this database (2025-09-03+) */
	data_sources?: Array<{ id: string; name: string }>;
}

export interface NotionDataSource {
	id: string;
	object: 'data_source';
	name?: string;
	properties: Record<string, NotionProperty>;
	parent: { type: 'database_id'; database_id: string };
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
	getDataSource(dataSourceId: string): Promise<NotionDataSource | null>;
	resolveDataSourceId(databaseId: string): Promise<string>;
	createPage(databaseId: string, properties: Record<string, unknown>, children?: unknown[]): Promise<NotionPage>;
	appendBlocks(pageId: string, children: unknown[]): Promise<void>;
}

export function createNotionClient(accessToken: string): NotionClient {
	// Cache for database_id -> data_source_id mappings
	const dataSourceCache = new Map<string, string>();

	async function request<T>(
		endpoint: string,
		options: RequestInit = {},
		isRetry = false
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

		// Handle 429 Rate Limited with Retry-After header
		if (response.status === 429 && !isRetry) {
			const retryAfter = response.headers.get('Retry-After');
			let delayMs = 1000; // Default 1 second
			if (retryAfter) {
				const seconds = parseInt(retryAfter, 10);
				if (!isNaN(seconds)) {
					delayMs = seconds * 1000;
				}
			}
			// Cap at 60 seconds
			delayMs = Math.min(delayMs, 60000);
			await new Promise(resolve => setTimeout(resolve, delayMs));
			return request<T>(endpoint, options, true);
		}

		if (!response.ok) {
			const error = await response.json().catch(() => ({})) as { message?: string };
			throw new Error(error.message || `Notion API error: ${response.status}`);
		}

		return response.json();
	}

	return {
		/**
		 * Get all accessible databases
		 * In 2025-09-03, search returns data_source objects
		 */
		async getDatabases(): Promise<NotionDatabase[]> {
			// Search for data sources, then group by parent database
			const data = await request<{ results: NotionDataSource[] }>('/search', {
				method: 'POST',
				body: JSON.stringify({
					filter: { property: 'object', value: 'data_source' },
					page_size: 100
				})
			});

			// Convert data sources to database format for backward compatibility
			const databaseMap = new Map<string, NotionDatabase>();
			for (const ds of data.results || []) {
				const dbId = ds.parent?.database_id;
				if (dbId && !databaseMap.has(dbId)) {
					databaseMap.set(dbId, {
						id: dbId,
						title: ds.name ? [{ plain_text: ds.name }] : [{ plain_text: 'Untitled' }],
						properties: ds.properties,
						data_sources: [{ id: ds.id, name: ds.name || 'Default' }]
					});
					// Cache the mapping
					dataSourceCache.set(dbId, ds.id);
				}
			}

			return Array.from(databaseMap.values());
		},

		/**
		 * Get a database by ID (returns data_sources list)
		 */
		async getDatabase(id: string): Promise<NotionDatabase | null> {
			try {
				return await request<NotionDatabase>(`/databases/${id}`);
			} catch {
				return null;
			}
		},

		/**
		 * Get a data source by ID (contains the actual schema/properties)
		 */
		async getDataSource(dataSourceId: string): Promise<NotionDataSource | null> {
			try {
				return await request<NotionDataSource>(`/data_sources/${dataSourceId}`);
			} catch {
				return null;
			}
		},

		/**
		 * Resolve a database ID to its primary data source ID
		 */
		async resolveDataSourceId(databaseId: string): Promise<string> {
			// Check cache first
			const cached = dataSourceCache.get(databaseId);
			if (cached) return cached;

			// Fetch database to get data sources list
			const db = await request<NotionDatabase>(`/databases/${databaseId}`);
			if (!db.data_sources?.length) {
				throw new Error(`No data sources found for database ${databaseId}`);
			}

			const dataSourceId = db.data_sources[0].id;
			dataSourceCache.set(databaseId, dataSourceId);
			return dataSourceId;
		},

		/**
		 * Create a page in a database
		 * Automatically resolves database_id to data_source_id for 2025-09-03
		 */
		async createPage(
			databaseId: string,
			properties: Record<string, unknown>,
			children: unknown[] = []
		): Promise<NotionPage> {
			// Resolve to data source ID
			const dataSourceId = await this.resolveDataSourceId(databaseId);

			return request<NotionPage>('/pages', {
				method: 'POST',
				body: JSON.stringify({
					parent: { type: 'data_source_id', data_source_id: dataSourceId },
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

			for (let i = 0; i < batches.length; i++) {
				await request(`/blocks/${pageId}/children`, {
					method: 'PATCH',
					body: JSON.stringify({ children: batches[i] })
				});
				// Rate limiting: 350ms delay between batches (Notion allows 3 req/s)
				if (i < batches.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 350));
				}
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
 * Split text into chunks of ≤NOTION_TEXT_LIMIT chars at word boundaries
 * Returns array of chunks that can each be a separate rich_text element
 */
function chunkTextForNotion(text: string): string[] {
	if (text.length <= NOTION_TEXT_LIMIT) {
		return [text];
	}

	const chunks: string[] = [];
	const words = text.split(' ');
	let currentChunk = '';

	for (const word of words) {
		// If adding this word would exceed limit
		if (currentChunk.length + word.length + 1 > NOTION_TEXT_LIMIT) {
			if (currentChunk) {
				chunks.push(currentChunk);
			}
			// If single word is too long, split it
			if (word.length > NOTION_TEXT_LIMIT) {
				for (let i = 0; i < word.length; i += NOTION_TEXT_LIMIT) {
					chunks.push(word.slice(i, i + NOTION_TEXT_LIMIT));
				}
				currentChunk = '';
			} else {
				currentChunk = word;
			}
		} else {
			currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/** Check if text contains markdown-style bullets */
function hasMarkdownBullets(text: string): boolean {
	return text.split('\n').some(line => line.trim().startsWith('- '));
}

/** Parse markdown bullets into array of items */
function parseMarkdownBullets(text: string): string[] {
	return text
		.split('\n')
		.map(line => line.trim())
		.filter(line => line.startsWith('- '))
		.map(line => line.slice(2).trim()); // Remove "- " prefix
}

/** Convert markdown bold **text** to Notion rich_text with bold annotation
 *  Each rich_text element is chunked to ≤NOTION_TEXT_LIMIT chars
 */
function parseMarkdownBold(text: string): Array<{ type: string; text: { content: string }; annotations?: { bold: boolean } }> {
	const parts: Array<{ type: string; text: { content: string }; annotations?: { bold: boolean } }> = [];
	const regex = /\*\*([^*]+)\*\*/g;
	let lastIndex = 0;
	let match;

	while ((match = regex.exec(text)) !== null) {
		// Add text before the bold (chunked)
		if (match.index > lastIndex) {
			const beforeText = text.slice(lastIndex, match.index);
			for (const chunk of chunkTextForNotion(beforeText)) {
				parts.push({
					type: 'text',
					text: { content: chunk }
				});
			}
		}
		// Add the bold text (chunked)
		for (const chunk of chunkTextForNotion(match[1])) {
			parts.push({
				type: 'text',
				text: { content: chunk },
				annotations: { bold: true }
			});
		}
		lastIndex = regex.lastIndex;
	}

	// Add remaining text (chunked)
	if (lastIndex < text.length) {
		const remaining = text.slice(lastIndex);
		for (const chunk of chunkTextForNotion(remaining)) {
			parts.push({
				type: 'text',
				text: { content: chunk }
			});
		}
	}

	// If no parts created, return chunked simple text
	if (parts.length === 0) {
		for (const chunk of chunkTextForNotion(text)) {
			parts.push({ type: 'text', text: { content: chunk } });
		}
	}

	return parts;
}

/**
 * Split a blob of key points into individual key points
 * Fireflies sometimes returns all key points as one string with emoji-prefixed sections
 * Format: "- 📝 **Title1**...\nDesc\n📋 **Title2**...\nDesc"
 */
function splitKeyPointsBlob(text: string): string[] {
	// Match lines starting with emoji (with optional leading "- ")
	const emojiPattern = /^[\s-]*([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u;

	const lines = text.split('\n');
	const keyPoints: string[] = [];
	let currentPoint: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Strip leading "- " if present
		const cleanLine = trimmed.replace(/^-\s*/, '');

		// Check if this line starts a new key point (emoji prefix)
		if (emojiPattern.test(cleanLine) && currentPoint.length > 0) {
			// Save previous key point
			keyPoints.push(currentPoint.join('\n'));
			currentPoint = [cleanLine];
		} else if (emojiPattern.test(cleanLine)) {
			// First key point
			currentPoint = [cleanLine];
		} else {
			// Description line - add to current key point
			currentPoint.push(trimmed);
		}
	}

	// Don't forget the last key point
	if (currentPoint.length > 0) {
		keyPoints.push(currentPoint.join('\n'));
	}

	return keyPoints;
}

/**
 * Parse a key point into a main bullet with optional nested children
 * Fireflies format: "📝 **Title** (timestamp)\nDescription line 1\nDescription line 2"
 */
function parseKeyPointWithChildren(point: string): { title: string; children: string[] } {
	const lines = point.split('\n').map(l => l.trim()).filter(l => l);
	if (lines.length === 0) return { title: point, children: [] };

	// First line is the title (with emoji, bold, timestamp)
	// Strip leading "- " if present
	const title = lines[0].replace(/^-\s*/, '');
	// Remaining lines are description children
	const children = lines.slice(1);

	return { title, children };
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

		// Check if overview contains markdown bullets
		if (hasMarkdownBullets(transcript.summary.overview)) {
			// Parse and render as bullet list with bold formatting
			const bullets = parseMarkdownBullets(transcript.summary.overview);
			for (const bullet of bullets) {
				blocks.push({
					object: 'block',
					type: 'bulleted_list_item',
					bulleted_list_item: {
						rich_text: parseMarkdownBold(truncateForNotion(bullet))
					}
				});
			}
		} else {
			// Render as paragraph
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ type: 'text', text: { content: truncateForNotion(transcript.summary.overview) } }]
				}
			});
		}
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
		// Join all items and split by emoji to handle blob format
		const rawBullets = Array.isArray(transcript.summary.shorthand_bullet)
			? transcript.summary.shorthand_bullet
			: [transcript.summary.shorthand_bullet];

		// Combine all into one blob and split by emoji-prefixed lines
		const combinedBlob = rawBullets.join('\n');
		const keyPoints = splitKeyPointsBlob(combinedBlob);

		for (const point of keyPoints) {
			if (point.trim()) {
				const { title, children } = parseKeyPointWithChildren(point);

				// Create main bullet with nested children for descriptions
				const bulletBlock: {
					object: string;
					type: string;
					bulleted_list_item: {
						rich_text: Array<{ type: string; text: { content: string }; annotations?: { bold: boolean } }>;
						children?: unknown[];
					};
				} = {
					object: 'block',
					type: 'bulleted_list_item',
					bulleted_list_item: {
						rich_text: parseMarkdownBold(truncateForNotion(title))
					}
				};

				// Add description lines as nested bullets
				if (children.length > 0) {
					bulletBlock.bulleted_list_item.children = children.map(child => ({
						object: 'block',
						type: 'bulleted_list_item',
						bulleted_list_item: {
							rich_text: [{ type: 'text', text: { content: truncateForNotion(child) } }]
						}
					}));
				}

				blocks.push(bulletBlock);
			}
		}
	}

	// Action items
	if (transcript.summary?.action_items?.length) {
		// Handle both array and string formats from Fireflies
		// Fireflies often returns one big string with newlines
		const rawItems = Array.isArray(transcript.summary.action_items)
			? transcript.summary.action_items.join('\n')
			: transcript.summary.action_items;
		
		// Split by newlines and filter non-empty lines
		const items = rawItems
			.split('\n')
			.map((i: string) => i.trim())
			.filter((i: string) => i.length > 0)
			.slice(0, 30); // Limit to prevent huge lists
		
		if (items.length > 0) {
			blocks.push({
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ type: 'text', text: { content: 'Action Items' } }]
				}
			});
			
			for (const item of items) {
				blocks.push({
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: parseMarkdownBold(truncateForNotion(item)),
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

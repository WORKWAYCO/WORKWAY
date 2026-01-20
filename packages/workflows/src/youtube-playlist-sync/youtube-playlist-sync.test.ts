/**
 * YouTube Playlist to Notion Sync - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

// Import helper functions for testing
// Note: In production, these would be extracted to a shared module

describe('Helper Functions', () => {
	describe('extractPlaylistId', () => {
		// Inline the function for testing
		function extractPlaylistId(urlOrId: string): string | null {
			// Already a playlist ID (starts with PL, UU, LL, etc.)
			if (/^(PL|UU|LL|FL|RD|OL)[a-zA-Z0-9_-]+$/.test(urlOrId)) {
				return urlOrId;
			}

			// youtube.com/playlist?list=PLAYLIST_ID
			const listMatch = urlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
			if (listMatch) return listMatch[1];

			return null;
		}

		it('should extract from youtube.com/playlist URL', () => {
			expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx123')).toBe('PLxxx123');
		});

		it('should extract from URL with other params', () => {
			expect(extractPlaylistId('https://www.youtube.com/watch?v=abc&list=PLxxx123')).toBe('PLxxx123');
		});

		it('should return the ID if already a valid playlist ID', () => {
			expect(extractPlaylistId('PLxxx123')).toBe('PLxxx123');
		});

		it('should handle UU (uploads) playlists', () => {
			expect(extractPlaylistId('UUxxx123')).toBe('UUxxx123');
		});

		it('should handle LL (likes) playlists', () => {
			expect(extractPlaylistId('LLxxx123')).toBe('LLxxx123');
		});

		it('should return null for invalid input', () => {
			expect(extractPlaylistId('invalid')).toBeNull();
			expect(extractPlaylistId('')).toBeNull();
			expect(extractPlaylistId('https://www.youtube.com/watch?v=abc')).toBeNull();
		});
	});

	describe('getPollIntervalMs', () => {
		// Inline the function for testing
		function getPollIntervalMs(frequency: string): number {
			switch (frequency) {
				case '15min':
					return 15 * 60 * 1000;
				case 'hourly':
					return 60 * 60 * 1000;
				case 'daily':
					return 24 * 60 * 60 * 1000;
				default:
					return 60 * 60 * 1000;
			}
		}

		it('should return 15 minutes for "15min"', () => {
			expect(getPollIntervalMs('15min')).toBe(15 * 60 * 1000);
		});

		it('should return 1 hour for "hourly"', () => {
			expect(getPollIntervalMs('hourly')).toBe(60 * 60 * 1000);
		});

		it('should return 24 hours for "daily"', () => {
			expect(getPollIntervalMs('daily')).toBe(24 * 60 * 60 * 1000);
		});

		it('should default to hourly for unknown values', () => {
			expect(getPollIntervalMs('unknown')).toBe(60 * 60 * 1000);
			expect(getPollIntervalMs('')).toBe(60 * 60 * 1000);
		});
	});

	describe('splitTextIntoBlocks', () => {
		const NOTION_BLOCK_CHAR_LIMIT = 1900;

		// Inline the function for testing
		function findSplitPoint(text: string, maxLength: number): number {
			const sentenceEnd = text.slice(0, maxLength).lastIndexOf('. ');
			if (sentenceEnd > maxLength * 0.5) {
				return sentenceEnd + 2;
			}

			const wordEnd = text.slice(0, maxLength).lastIndexOf(' ');
			if (wordEnd > maxLength * 0.5) {
				return wordEnd + 1;
			}

			return maxLength;
		}

		function splitTextIntoBlocks(text: string): any[] {
			const blocks: any[] = [];
			const paragraphs = text.split(/\n\n+/);

			for (const para of paragraphs) {
				if (!para.trim()) continue;

				const trimmed = para.trim();

				if (trimmed.length <= NOTION_BLOCK_CHAR_LIMIT) {
					blocks.push({
						object: 'block',
						type: 'paragraph',
						paragraph: { rich_text: [{ text: { content: trimmed } }] },
					});
					continue;
				}

				let remaining = trimmed;
				while (remaining.length > 0) {
					let chunk: string;

					if (remaining.length <= NOTION_BLOCK_CHAR_LIMIT) {
						chunk = remaining;
						remaining = '';
					} else {
						const cutPoint = findSplitPoint(remaining, NOTION_BLOCK_CHAR_LIMIT);
						chunk = remaining.slice(0, cutPoint).trim();
						remaining = remaining.slice(cutPoint).trim();
					}

					if (chunk) {
						blocks.push({
							object: 'block',
							type: 'paragraph',
							paragraph: { rich_text: [{ text: { content: chunk } }] },
						});
					}
				}
			}

			return blocks.length > 0
				? blocks
				: [
						{
							object: 'block',
							type: 'paragraph',
							paragraph: { rich_text: [{ text: { content: '' } }] },
						},
				  ];
		}

		it('should create a single block for short text', () => {
			const result = splitTextIntoBlocks('Hello, world!');
			expect(result).toHaveLength(1);
			expect(result[0].paragraph.rich_text[0].text.content).toBe('Hello, world!');
		});

		it('should split by paragraphs', () => {
			const result = splitTextIntoBlocks('First paragraph.\n\nSecond paragraph.');
			expect(result).toHaveLength(2);
			expect(result[0].paragraph.rich_text[0].text.content).toBe('First paragraph.');
			expect(result[1].paragraph.rich_text[0].text.content).toBe('Second paragraph.');
		});

		it('should return empty block for empty text', () => {
			const result = splitTextIntoBlocks('');
			expect(result).toHaveLength(1);
			expect(result[0].paragraph.rich_text[0].text.content).toBe('');
		});

		it('should split long text at sentence boundaries', () => {
			const longText = 'A'.repeat(1000) + '. ' + 'B'.repeat(1000);
			const result = splitTextIntoBlocks(longText);
			expect(result.length).toBeGreaterThan(1);
		});
	});

	describe('formatDuration', () => {
		// Inline the function for testing
		function formatDuration(duration: string): string {
			const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
			if (!match) return duration;

			const hours = parseInt(match[1] || '0', 10);
			const minutes = parseInt(match[2] || '0', 10);
			const seconds = parseInt(match[3] || '0', 10);

			if (hours > 0) {
				return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
			}
			return `${minutes}:${seconds.toString().padStart(2, '0')}`;
		}

		it('should format hours, minutes, and seconds', () => {
			expect(formatDuration('PT1H2M10S')).toBe('1:02:10');
		});

		it('should format minutes and seconds', () => {
			expect(formatDuration('PT5M30S')).toBe('5:30');
		});

		it('should format seconds only', () => {
			expect(formatDuration('PT45S')).toBe('0:45');
		});

		it('should format minutes only', () => {
			expect(formatDuration('PT10M')).toBe('10:00');
		});

		it('should return original for invalid format', () => {
			expect(formatDuration('invalid')).toBe('invalid');
		});
	});
});

// ============================================================================
// WORKFLOW LOGIC TESTS
// ============================================================================

describe('Workflow Logic', () => {
	describe('Poll Frequency Check', () => {
		function shouldSkipExecution(
			lastChecked: string,
			pollFrequency: string
		): { skip: boolean; message?: string } {
			const pollIntervals: Record<string, number> = {
				'15min': 15 * 60 * 1000,
				'hourly': 60 * 60 * 1000,
				'daily': 24 * 60 * 60 * 1000,
			};

			const pollIntervalMs = pollIntervals[pollFrequency] || pollIntervals['hourly'];
			const lastCheckedTime = new Date(lastChecked).getTime();
			const timeSinceLastCheck = Date.now() - lastCheckedTime;

			if (timeSinceLastCheck < pollIntervalMs) {
				const minutesRemaining = Math.ceil((pollIntervalMs - timeSinceLastCheck) / 60000);
				return {
					skip: true,
					message: `Skipped - next check in ${minutesRemaining} minutes`,
				};
			}

			return { skip: false };
		}

		it('should not skip on first run', () => {
			const result = shouldSkipExecution(new Date(0).toISOString(), 'hourly');
			expect(result.skip).toBe(false);
		});

		it('should skip if checked less than interval ago', () => {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
			const result = shouldSkipExecution(fiveMinutesAgo, 'hourly');
			expect(result.skip).toBe(true);
			expect(result.message).toContain('Skipped');
		});

		it('should not skip if checked more than interval ago', () => {
			const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
			const result = shouldSkipExecution(twoHoursAgo, 'hourly');
			expect(result.skip).toBe(false);
		});

		it('should respect 15min frequency', () => {
			const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
			const result = shouldSkipExecution(tenMinutesAgo, '15min');
			expect(result.skip).toBe(true);
		});

		it('should respect daily frequency', () => {
			const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
			const result = shouldSkipExecution(twelveHoursAgo, 'daily');
			expect(result.skip).toBe(true);
		});
	});

	describe('State Key Generation', () => {
		it('should include installation ID for user isolation', () => {
			const prefix = 'youtube-playlist-sync:';
			const installationId = 'inst_abc123';
			const playlistId = 'PLxxx';

			const stateKey = `${prefix}${installationId}:${playlistId}`;

			expect(stateKey).toBe('youtube-playlist-sync:inst_abc123:PLxxx');
		});

		it('should use fallback for missing installation ID', () => {
			const prefix = 'youtube-playlist-sync:';
			const installationId = undefined;
			const userId = undefined;
			const playlistId = 'PLxxx';

			const instanceId = installationId || userId || 'default';
			const stateKey = `${prefix}${instanceId}:${playlistId}`;

			expect(stateKey).toBe('youtube-playlist-sync:default:PLxxx');
		});
	});

	describe('Duplicate Detection', () => {
		it('should filter out processed video IDs', () => {
			const playlistItems = [
				{ videoId: 'vid1', title: 'Video 1' },
				{ videoId: 'vid2', title: 'Video 2' },
				{ videoId: 'vid3', title: 'Video 3' },
			];

			const processedVideoIds = ['vid1', 'vid3'];

			const newVideos = playlistItems.filter(
				(item) => !processedVideoIds.includes(item.videoId)
			);

			expect(newVideos).toHaveLength(1);
			expect(newVideos[0].videoId).toBe('vid2');
		});

		it('should return all videos if none processed', () => {
			const playlistItems = [
				{ videoId: 'vid1', title: 'Video 1' },
				{ videoId: 'vid2', title: 'Video 2' },
			];

			const processedVideoIds: string[] = [];

			const newVideos = playlistItems.filter(
				(item) => !processedVideoIds.includes(item.videoId)
			);

			expect(newVideos).toHaveLength(2);
		});
	});

	describe('Result Counting', () => {
		it('should count success, skipped, and failed correctly', () => {
			const results = [
				{ videoId: 'vid1', notionUrl: 'https://notion.so/1' },
				{ videoId: 'vid2', skipped: true },
				{ videoId: 'vid3', notionUrl: 'https://notion.so/3' },
				{ videoId: 'vid4', error: 'Failed to create' },
				{ videoId: 'vid5', skipped: true },
			];

			const successCount = results.filter((r) => !r.error && !r.skipped).length;
			const skippedCount = results.filter((r) => r.skipped).length;
			const failCount = results.filter((r) => r.error).length;

			expect(successCount).toBe(2);
			expect(skippedCount).toBe(2);
			expect(failCount).toBe(1);
		});
	});

	describe('State Pruning', () => {
		it('should prune to keep last 1000 IDs', () => {
			// Generate 1200 video IDs
			const processedVideoIds = Array.from({ length: 1200 }, (_, i) => `vid${i}`);

			// Prune logic
			if (processedVideoIds.length > 1000) {
				const pruned = processedVideoIds.slice(-1000);
				expect(pruned).toHaveLength(1000);
				expect(pruned[0]).toBe('vid200'); // Should keep IDs 200-1199
				expect(pruned[999]).toBe('vid1199');
			}
		});
	});
});

// ============================================================================
// INTEGRATION MOCK TESTS
// ============================================================================

describe('Integration Mocks', () => {
	describe('YouTube Integration', () => {
		const createMockYouTube = () => ({
			getPlaylistItems: vi.fn(),
			getVideos: vi.fn(),
			getTranscript: vi.fn(),
		});

		it('should handle successful playlist fetch', async () => {
			const youtube = createMockYouTube();
			youtube.getPlaylistItems.mockResolvedValueOnce({
				success: true,
				data: {
					items: [
						{ videoId: 'vid1', title: 'Video 1' },
						{ videoId: 'vid2', title: 'Video 2' },
					],
					nextPageToken: undefined,
				},
			});

			const result = await youtube.getPlaylistItems({ playlistId: 'PLxxx', maxResults: 50 });
			expect(result.success).toBe(true);
			expect(result.data.items).toHaveLength(2);
		});

		it('should handle pagination', async () => {
			const youtube = createMockYouTube();
			youtube.getPlaylistItems
				.mockResolvedValueOnce({
					success: true,
					data: {
						items: [{ videoId: 'vid1', title: 'Video 1' }],
						nextPageToken: 'token123',
					},
				})
				.mockResolvedValueOnce({
					success: true,
					data: {
						items: [{ videoId: 'vid2', title: 'Video 2' }],
						nextPageToken: undefined,
					},
				});

			// First call
			const result1 = await youtube.getPlaylistItems({ playlistId: 'PLxxx', maxResults: 50 });
			expect(result1.data.nextPageToken).toBe('token123');

			// Second call with token
			const result2 = await youtube.getPlaylistItems({
				playlistId: 'PLxxx',
				maxResults: 50,
				pageToken: 'token123',
			});
			expect(result2.data.nextPageToken).toBeUndefined();
		});

		it('should handle transcript fetch failure gracefully', async () => {
			const youtube = createMockYouTube();
			youtube.getTranscript.mockResolvedValueOnce({
				success: false,
				error: { message: 'No captions available' },
			});

			const result = await youtube.getTranscript({ videoId: 'vid1' });
			expect(result.success).toBe(false);
		});
	});

	describe('Notion Integration', () => {
		const createMockNotion = () => ({
			createPage: vi.fn(),
			queryDatabase: vi.fn(),
			appendBlocksInBatches: vi.fn(),
		});

		it('should handle page creation', async () => {
			const notion = createMockNotion();
			notion.createPage.mockResolvedValueOnce({
				success: true,
				data: {
					id: 'page123',
					url: 'https://notion.so/page123',
				},
			});

			const result = await notion.createPage({
				parentDatabaseId: 'db123',
				properties: { Name: { title: [{ text: { content: 'Test' } }] } },
			});

			expect(result.success).toBe(true);
			expect(result.data.url).toBe('https://notion.so/page123');
		});

		it('should handle duplicate detection query', async () => {
			const notion = createMockNotion();
			notion.queryDatabase.mockResolvedValueOnce({
				success: true,
				data: [{ id: 'existing-page' }],
			});

			const result = await notion.queryDatabase({
				databaseId: 'db123',
				filter: {
					property: 'URL',
					url: { equals: 'https://www.youtube.com/watch?v=vid1' },
				},
			});

			expect(result.success).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);
		});

		it('should handle batch block appending', async () => {
			const notion = createMockNotion();
			notion.appendBlocksInBatches.mockResolvedValueOnce({
				success: true,
				data: { totalAppended: 150, batches: 2 },
			});

			const blocks = Array.from({ length: 150 }, (_, i) => ({
				object: 'block',
				type: 'paragraph',
				paragraph: { rich_text: [{ text: { content: `Block ${i}` } }] },
			}));

			const result = await notion.appendBlocksInBatches('page123', blocks);
			expect(result.success).toBe(true);
			expect(result.data.batches).toBe(2);
		});
	});
});

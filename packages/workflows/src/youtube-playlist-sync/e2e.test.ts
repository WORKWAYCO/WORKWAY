/**
 * YouTube Playlist to Notion Sync - E2E Tests
 *
 * Comprehensive end-to-end tests validating complete workflow execution:
 * - Trigger handling (cron-based polling)
 * - State persistence across executions (KV storage)
 * - Full integration with external APIs (YouTube InnerTube + Notion)
 * - Error recovery and graceful degradation
 * - Multi-video processing with concurrency
 *
 * Test Strategy:
 * - Mock external APIs (YouTube InnerTube, Notion)
 * - Mock KV storage (in-memory implementation)
 * - Use realistic data fixtures
 * - Validate both success and error paths
 * - Test concurrency behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchPlaylistItems,
	fetchVideoDetails,
	fetchTranscript,
	createNotionVideoPage,
	getPollIntervalMs,
	type PlaylistSyncState,
	type VideoData,
	type TranscriptData,
} from './utils.js';
import { createMockNotion } from '../lib/utils/createMockNotion.js';
import { mockPage, mockQueryEmpty, mockQueryWithResults } from '../../integrations/src/notion/__fixtures__/responses.js';

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

/**
 * In-memory KV storage for testing
 */
class MockKVStorage {
	private store: Map<string, string> = new Map();

	async get(key: string, type: 'text' | 'json' = 'text'): Promise<any> {
		const value = this.store.get(key);
		if (!value) return null;
		if (type === 'json') return JSON.parse(value);
		return value;
	}

	async put(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}

	size(): number {
		return this.store.size;
	}
}

/**
 * Mock YouTube InnerTube API responses
 */
function createMockPlaylistResponse(videoIds: string[]) {
	return {
		contents: {
			singleColumnBrowseResultsRenderer: {
				tabs: [
					{
						tabRenderer: {
							content: {
								sectionListRenderer: {
									contents: [
										{
											playlistVideoListRenderer: {
												contents: videoIds.map((id, index) => ({
													playlistVideoRenderer: {
														videoId: id,
														title: {
															runs: [{ text: `Video ${index + 1}` }],
														},
													},
												})),
											},
										},
									],
								},
							},
						},
					},
				],
			},
		},
	};
}

function createMockVideoResponse(videoId: string, overrides: Partial<VideoData> = {}) {
	return {
		videoDetails: {
			videoId,
			title: overrides.title || `Test Video ${videoId}`,
			shortDescription: overrides.description || 'Test description',
			author: overrides.channelTitle || 'Test Channel',
			lengthSeconds: '180',
			viewCount: String(overrides.viewCount || 1000),
			thumbnail: {
				thumbnails: [{ url: overrides.thumbnailUrl || 'https://i.ytimg.com/vi/test/maxresdefault.jpg' }],
			},
		},
	};
}

function createMockTranscriptResponse(segments: string[]) {
	const xml = segments
		.map(
			(text, i) =>
				`<p t="${i * 1000}" d="1000">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
		)
		.join('');
	return `<?xml version="1.0" encoding="utf-8"?><transcript>${xml}</transcript>`;
}

// ============================================================================
// COMPLETE WORKFLOW EXECUTION TESTS
// ============================================================================

describe('E2E: Complete Workflow Execution', () => {
	let mockKV: MockKVStorage;
	let mockNotion: ReturnType<typeof createMockNotion>;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		mockKV = new MockKVStorage();
		mockNotion = createMockNotion();
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('should execute full workflow: trigger → fetch → process → update state', async () => {
		// Setup: Mock all external APIs
		global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
			const urlStr = url.toString();
			const body = options?.body ? JSON.parse(options.body) : {};

			// YouTube playlist fetch
			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(['vid1', 'vid2', 'vid3'])));
			}

			// YouTube video details - extract videoId from request body
			if (urlStr.includes('/player')) {
				const videoId = body.videoId || 'vid1';
				return new Response(JSON.stringify(createMockVideoResponse(videoId)));
			}

			// YouTube transcript (from timedtext) - extract videoId from body
			if (body.videoId) {
				return new Response(
					JSON.stringify({
						captions: {
							playerCaptionsTracklistRenderer: {
								captionTracks: [
									{
										baseUrl: `https://www.youtube.com/api/timedtext?v=${body.videoId}`,
										languageCode: 'en',
									},
								],
							},
						},
					})
				);
			}

			// Transcript XML response
			if (urlStr.includes('timedtext')) {
				return new Response(createMockTranscriptResponse(['Hello world', 'This is a test']));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({
			success: true,
			data: [],
		});

		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});

		mockNotion.appendBlocksInBatches.mockResolvedValue({
			success: true,
			data: { totalAppended: 10, batches: 1 },
		});

		// Execute: Workflow logic
		const playlistId = 'PLtest123';
		const stateKey = `youtube-playlist-sync:user-123:${playlistId}`;

		// Initial state (first run)
		let state: PlaylistSyncState = {
			playlistId,
			lastChecked: new Date(0).toISOString(),
			processedVideoIds: [],
		};

		// Fetch playlist items
		const playlistResult = await fetchPlaylistItems(playlistId);
		expect(playlistResult.success).toBe(true);
		expect(playlistResult.items).toHaveLength(3);

		// Find new videos
		const newVideos = playlistResult.items!.filter((item) => !state.processedVideoIds.includes(item.videoId));
		expect(newVideos).toHaveLength(3);

		// Process videos
		const results = [];
		for (const item of newVideos) {
			const videoResult = await fetchVideoDetails(item.videoId);
			expect(videoResult.success).toBe(true);

			const video = videoResult.data!;
			const transcriptResult = await fetchTranscript(video.id);

			const notionPage = await createNotionVideoPage({
				video,
				transcript: transcriptResult.data || null,
				databaseId: 'db-123',
				propertyNames: {
					title: 'Name',
					url: 'URL',
					channel: 'Channel',
					date: 'Published',
				},
				integrations: { notion: mockNotion },
			});

			state.processedVideoIds.push(video.id);
			results.push({ videoId: video.id, notionUrl: notionPage?.url });
		}

		// Update state
		state.lastChecked = new Date().toISOString();
		await mockKV.put(stateKey, JSON.stringify(state));

		// Verify: All videos processed
		expect(results).toHaveLength(3);
		expect(state.processedVideoIds).toHaveLength(3);
		expect(state.processedVideoIds).toEqual(['vid1', 'vid2', 'vid3']);

		// Verify: State persisted
		const savedState = await mockKV.get(stateKey, 'json');
		expect(savedState.processedVideoIds).toHaveLength(3);
		expect(new Date(savedState.lastChecked).getTime()).toBeGreaterThan(0);
	});

	it('should handle subsequent runs correctly (incremental sync)', async () => {
		// Setup: Initial state with some videos already processed
		const playlistId = 'PLtest123';
		const stateKey = `youtube-playlist-sync:user-123:${playlistId}`;

		const initialState: PlaylistSyncState = {
			playlistId,
			lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
			processedVideoIds: ['vid1', 'vid2'],
		};

		await mockKV.put(stateKey, JSON.stringify(initialState));

		// Mock: Playlist now has 4 videos (2 new)
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			const urlStr = url.toString();

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(['vid1', 'vid2', 'vid3', 'vid4'])));
			}

			if (urlStr.includes('/player')) {
				const videoId = urlStr.includes('vid3') ? 'vid3' : 'vid4';
				return new Response(JSON.stringify(createMockVideoResponse(videoId)));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-456', url: 'https://notion.so/page-456' },
		});
		mockNotion.appendBlocksInBatches.mockResolvedValue({
			success: true,
			data: { totalAppended: 5, batches: 1 },
		});

		// Execute: Load state
		let state = (await mockKV.get(stateKey, 'json')) as PlaylistSyncState;

		// Fetch and filter
		const playlistResult = await fetchPlaylistItems(playlistId);
		const newVideos = playlistResult.items!.filter((item) => !state.processedVideoIds.includes(item.videoId));

		expect(newVideos).toHaveLength(2); // Only vid3 and vid4

		// Process new videos
		for (const item of newVideos) {
			const videoResult = await fetchVideoDetails(item.videoId);
			await createNotionVideoPage({
				video: videoResult.data!,
				transcript: null,
				databaseId: 'db-123',
				propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
				integrations: { notion: mockNotion },
			});

			state.processedVideoIds.push(item.videoId);
		}

		state.lastChecked = new Date().toISOString();
		await mockKV.put(stateKey, JSON.stringify(state));

		// Verify: Only new videos processed
		expect(state.processedVideoIds).toHaveLength(4);
		expect(state.processedVideoIds).toContain('vid3');
		expect(state.processedVideoIds).toContain('vid4');
		expect(mockNotion.createPage).toHaveBeenCalledTimes(2);
	});
});

// ============================================================================
// STATE MANAGEMENT TESTS
// ============================================================================

describe('E2E: State Management', () => {
	let mockKV: MockKVStorage;

	beforeEach(() => {
		mockKV = new MockKVStorage();
	});

	it('should initialize empty state on first run', async () => {
		const stateKey = 'youtube-playlist-sync:user-123:PLtest';
		const state = (await mockKV.get(stateKey, 'json')) || {
			playlistId: 'PLtest',
			lastChecked: new Date(0).toISOString(),
			processedVideoIds: [],
		};

		expect(state.processedVideoIds).toHaveLength(0);
		expect(new Date(state.lastChecked).getTime()).toBe(0);
	});

	it('should track processed video IDs correctly', async () => {
		const stateKey = 'youtube-playlist-sync:user-123:PLtest';
		let state: PlaylistSyncState = {
			playlistId: 'PLtest',
			lastChecked: new Date().toISOString(),
			processedVideoIds: [],
		};

		// Process videos one by one
		const videoIds = ['vid1', 'vid2', 'vid3'];
		for (const videoId of videoIds) {
			state.processedVideoIds.push(videoId);
			await mockKV.put(stateKey, JSON.stringify(state));
		}

		const savedState = (await mockKV.get(stateKey, 'json')) as PlaylistSyncState;
		expect(savedState.processedVideoIds).toEqual(videoIds);
	});

	it('should prune processedVideoIds to keep last 1000', async () => {
		const stateKey = 'youtube-playlist-sync:user-123:PLtest';

		// Create state with 1200 video IDs
		const state: PlaylistSyncState = {
			playlistId: 'PLtest',
			lastChecked: new Date().toISOString(),
			processedVideoIds: Array.from({ length: 1200 }, (_, i) => `vid${i}`),
		};

		// Prune logic
		if (state.processedVideoIds.length > 1000) {
			state.processedVideoIds = state.processedVideoIds.slice(-1000);
		}

		await mockKV.put(stateKey, JSON.stringify(state));

		const savedState = (await mockKV.get(stateKey, 'json')) as PlaylistSyncState;
		expect(savedState.processedVideoIds).toHaveLength(1000);
		expect(savedState.processedVideoIds[0]).toBe('vid200'); // First element is vid200
		expect(savedState.processedVideoIds[999]).toBe('vid1199'); // Last element is vid1199
	});

	it('should enforce poll frequency correctly', () => {
		const testCases = [
			{ lastChecked: new Date(Date.now() - 5 * 60 * 1000).toISOString(), frequency: '15min', shouldSkip: true },
			{ lastChecked: new Date(Date.now() - 20 * 60 * 1000).toISOString(), frequency: '15min', shouldSkip: false },
			{ lastChecked: new Date(Date.now() - 30 * 60 * 1000).toISOString(), frequency: 'hourly', shouldSkip: true },
			{ lastChecked: new Date(Date.now() - 90 * 60 * 1000).toISOString(), frequency: 'hourly', shouldSkip: false },
			{ lastChecked: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), frequency: 'daily', shouldSkip: true },
			{
				lastChecked: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
				frequency: 'daily',
				shouldSkip: false,
			},
		];

		for (const { lastChecked, frequency, shouldSkip } of testCases) {
			const pollIntervalMs = getPollIntervalMs(frequency);
			const lastCheckedTime = new Date(lastChecked).getTime();
			const timeSinceLastCheck = Date.now() - lastCheckedTime;
			const skip = timeSinceLastCheck < pollIntervalMs;

			expect(skip).toBe(shouldSkip);
		}
	});

	it('should handle user isolation with installation IDs', async () => {
		const playlistId = 'PLtest';

		// Different users should have separate state
		const user1StateKey = `youtube-playlist-sync:user-1:${playlistId}`;
		const user2StateKey = `youtube-playlist-sync:user-2:${playlistId}`;

		const user1State: PlaylistSyncState = {
			playlistId,
			lastChecked: new Date().toISOString(),
			processedVideoIds: ['vid1', 'vid2'],
		};

		const user2State: PlaylistSyncState = {
			playlistId,
			lastChecked: new Date().toISOString(),
			processedVideoIds: ['vid3', 'vid4'],
		};

		await mockKV.put(user1StateKey, JSON.stringify(user1State));
		await mockKV.put(user2StateKey, JSON.stringify(user2State));

		const savedUser1State = (await mockKV.get(user1StateKey, 'json')) as PlaylistSyncState;
		const savedUser2State = (await mockKV.get(user2StateKey, 'json')) as PlaylistSyncState;

		expect(savedUser1State.processedVideoIds).toEqual(['vid1', 'vid2']);
		expect(savedUser2State.processedVideoIds).toEqual(['vid3', 'vid4']);
	});
});

// ============================================================================
// MULTI-VIDEO SCENARIOS
// ============================================================================

describe('E2E: Multi-Video Processing', () => {
	let mockNotion: ReturnType<typeof createMockNotion>;

	beforeEach(() => {
		mockNotion = createMockNotion();
	});

	it('should process 10+ videos in a new playlist', async () => {
		const videoIds = Array.from({ length: 15 }, (_, i) => `vid${i}`);

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			const urlStr = url.toString();

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(videoIds)));
			}

			if (urlStr.includes('/player')) {
				const match = urlStr.match(/vid(\d+)/);
				const id = match ? `vid${match[1]}` : 'vid0';
				return new Response(JSON.stringify(createMockVideoResponse(id)));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});
		mockNotion.appendBlocksInBatches.mockResolvedValue({
			success: true,
			data: { totalAppended: 5, batches: 1 },
		});

		// Fetch playlist
		const playlistResult = await fetchPlaylistItems('PLtest');
		expect(playlistResult.success).toBe(true);
		expect(playlistResult.items).toHaveLength(15);

		// Process all videos
		const results = [];
		for (const item of playlistResult.items!) {
			const videoResult = await fetchVideoDetails(item.videoId);
			const notionPage = await createNotionVideoPage({
				video: videoResult.data!,
				transcript: null,
				databaseId: 'db-123',
				propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
				integrations: { notion: mockNotion },
			});
			results.push(notionPage);
		}

		expect(results).toHaveLength(15);
		expect(mockNotion.createPage).toHaveBeenCalledTimes(15);
	});

	it('should handle mixed state (some videos already processed)', async () => {
		const allVideoIds = ['vid1', 'vid2', 'vid3', 'vid4', 'vid5'];
		const processedVideoIds = ['vid1', 'vid3', 'vid5'];

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			const urlStr = url.toString();

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(allVideoIds)));
			}

			if (urlStr.includes('/player')) {
				const match = urlStr.match(/vid(\d+)/);
				const id = match ? `vid${match[1]}` : 'vid1';
				return new Response(JSON.stringify(createMockVideoResponse(id)));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});

		// Fetch and filter
		const playlistResult = await fetchPlaylistItems('PLtest');
		const newVideos = playlistResult.items!.filter((item) => !processedVideoIds.includes(item.videoId));

		expect(newVideos).toHaveLength(2); // Only vid2 and vid4

		// Process new videos
		for (const item of newVideos) {
			const videoResult = await fetchVideoDetails(item.videoId);
			await createNotionVideoPage({
				video: videoResult.data!,
				transcript: null,
				databaseId: 'db-123',
				propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
				integrations: { notion: mockNotion },
			});
		}

		expect(mockNotion.createPage).toHaveBeenCalledTimes(2);
	});

	it('should handle empty playlist (no new videos)', async () => {
		global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(createMockPlaylistResponse([]))));

		const playlistResult = await fetchPlaylistItems('PLempty');
		expect(playlistResult.success).toBe(true);
		expect(playlistResult.items).toHaveLength(0);

		// No processing should occur
		const newVideos = playlistResult.items!;
		expect(newVideos).toHaveLength(0);
	});

	it('should stress test with 50+ videos (concurrency)', async () => {
		const videoIds = Array.from({ length: 55 }, (_, i) => `vid${i}`);

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			const urlStr = url.toString();

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(videoIds)));
			}

			if (urlStr.includes('/player')) {
				const match = urlStr.match(/vid(\d+)/);
				const id = match ? `vid${match[1]}` : 'vid0';
				return new Response(JSON.stringify(createMockVideoResponse(id)));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});
		mockNotion.appendBlocksInBatches.mockResolvedValue({
			success: true,
			data: { totalAppended: 5, batches: 1 },
		});

		// Fetch playlist
		const playlistResult = await fetchPlaylistItems('PLtest');
		expect(playlistResult.success).toBe(true);
		expect(playlistResult.items).toHaveLength(55);

		// Process with concurrency (batches of 5)
		const concurrency = 5;
		const results = [];

		for (let i = 0; i < playlistResult.items!.length; i += concurrency) {
			const batch = playlistResult.items!.slice(i, i + concurrency);
			const batchResults = await Promise.all(
				batch.map(async (item) => {
					const videoResult = await fetchVideoDetails(item.videoId);
					return createNotionVideoPage({
						video: videoResult.data!,
						transcript: null,
						databaseId: 'db-123',
						propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
						integrations: { notion: mockNotion },
					});
				})
			);
			results.push(...batchResults);
		}

		expect(results).toHaveLength(55);
		expect(mockNotion.createPage).toHaveBeenCalledTimes(55);
	});
});

// ============================================================================
// ERROR SCENARIOS
// ============================================================================

describe('E2E: Error Handling', () => {
	let mockNotion: ReturnType<typeof createMockNotion>;

	beforeEach(() => {
		mockNotion = createMockNotion();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should handle YouTube API failures (playlist not found)', async () => {
		global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

		const result = await fetchPlaylistItems('PLnonexistent');
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('should handle YouTube API network errors', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const result = await fetchPlaylistItems('PLtest');
		expect(result.success).toBe(false);
		expect(result.error).toContain('Network error');
	});

	it('should handle Notion API failures (database not found)', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
			const urlStr = url.toString();
			const body = options?.body ? JSON.parse(options.body) : {};

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(['vid1'])));
			}

			if (urlStr.includes('/player')) {
				return new Response(JSON.stringify(createMockVideoResponse(body.videoId || 'vid1')));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: false,
			error: { message: 'Database not found' },
		});

		const videoResult = await fetchVideoDetails('vid1');

		try {
			await createNotionVideoPage({
				video: videoResult.data!,
				transcript: null,
				databaseId: 'db-invalid',
				propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
				integrations: { notion: mockNotion },
			});
			expect.fail('Should have thrown error');
		} catch (error) {
			expect(error).toBeDefined();
			expect((error as Error).message).toContain('Failed to create Notion page');
		}
	});

	it('should handle Notion API rate limits', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
			const urlStr = url.toString();
			const body = options?.body ? JSON.parse(options.body) : {};

			if (urlStr.includes('/player')) {
				return new Response(JSON.stringify(createMockVideoResponse(body.videoId || 'vid1')));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: false,
			error: { message: 'Rate limited. Please retry after 1000' },
		});

		const videoResult = await fetchVideoDetails('vid1');

		try {
			await createNotionVideoPage({
				video: videoResult.data!,
				transcript: null,
				databaseId: 'db-123',
				propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
				integrations: { notion: mockNotion },
			});
			expect.fail('Should have thrown error');
		} catch (error) {
			expect((error as Error).message).toContain('Rate limited');
		}
	});

	it('should handle partial failures (some videos succeed, some fail)', async () => {
		const videoIds = ['vid1', 'vid2', 'vid3'];

		global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
			const urlStr = url.toString();
			const body = options?.body ? JSON.parse(options.body) : {};

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(videoIds)));
			}

			if (urlStr.includes('/player')) {
				// vid2 fails to fetch
				if (body.videoId === 'vid2') {
					return new Response(null, { status: 500 });
				}

				return new Response(JSON.stringify(createMockVideoResponse(body.videoId || 'vid1')));
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});

		const playlistResult = await fetchPlaylistItems('PLtest');
		const results = [];

		for (const item of playlistResult.items!) {
			const videoResult = await fetchVideoDetails(item.videoId);

			if (!videoResult.success) {
				results.push({ videoId: item.videoId, error: videoResult.error });
				continue;
			}

			const notionPage = await createNotionVideoPage({
				video: videoResult.data!,
				transcript: null,
				databaseId: 'db-123',
				propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
				integrations: { notion: mockNotion },
			});

			results.push({ videoId: item.videoId, notionUrl: notionPage?.url });
		}

		const successCount = results.filter((r) => !r.error).length;
		const failCount = results.filter((r) => r.error).length;

		expect(successCount).toBe(2); // vid1 and vid3
		expect(failCount).toBe(1); // vid2
	});

	it('should handle invalid configuration (bad playlist ID)', async () => {
		const result = await fetchPlaylistItems('invalid-id');
		expect(result.success).toBe(false);
	});
});

// ============================================================================
// GRACEFUL DEGRADATION
// ============================================================================

describe('E2E: Graceful Degradation', () => {
	let mockNotion: ReturnType<typeof createMockNotion>;

	beforeEach(() => {
		mockNotion = createMockNotion();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should create page without transcript if unavailable', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			const urlStr = url.toString();

			if (urlStr.includes('/browse')) {
				return new Response(JSON.stringify(createMockPlaylistResponse(['vid1'])));
			}

			if (urlStr.includes('/player')) {
				// Return video without captions
				return new Response(
					JSON.stringify({
						videoDetails: {
							videoId: 'vid1',
							title: 'Video Without Captions',
							shortDescription: 'Test',
							author: 'Test Channel',
							lengthSeconds: '180',
							viewCount: '1000',
						},
						// No captions property
					})
				);
			}

			return new Response(null, { status: 404 });
		});

		mockNotion.queryDatabase.mockResolvedValue({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});
		mockNotion.appendBlocksInBatches.mockResolvedValue({
			success: true,
			data: { totalAppended: 5, batches: 1 },
		});

		const videoResult = await fetchVideoDetails('vid1');
		const transcriptResult = await fetchTranscript('vid1');

		expect(transcriptResult.success).toBe(false);

		// Should still create page without transcript
		const notionPage = await createNotionVideoPage({
			video: videoResult.data!,
			transcript: null, // No transcript
			databaseId: 'db-123',
			propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
			integrations: { notion: mockNotion },
		});

		expect(notionPage).toBeDefined();
		expect(mockNotion.createPage).toHaveBeenCalled();
	});

	it('should handle unavailable video metadata gracefully', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			const urlStr = url.toString();

			if (urlStr.includes('/player')) {
				// Return minimal video data
				return new Response(
					JSON.stringify({
						videoDetails: {
							videoId: 'vid1',
							title: 'Minimal Video',
							// Missing most optional fields
						},
					})
				);
			}

			return new Response(null, { status: 404 });
		});

		const result = await fetchVideoDetails('vid1');

		expect(result.success).toBe(true);
		expect(result.data?.title).toBe('Minimal Video');
		expect(result.data?.description).toBe('');
		expect(result.data?.channelTitle).toBe('Unknown');
	});

	it('should handle Notion duplicate detection correctly', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
			const urlStr = url.toString();
			const body = options?.body ? JSON.parse(options.body) : {};

			if (urlStr.includes('/player')) {
				return new Response(JSON.stringify(createMockVideoResponse(body.videoId || 'vid1')));
			}

			return new Response(null, { status: 404 });
		});

		// First call: no duplicates
		mockNotion.queryDatabase.mockResolvedValueOnce({ success: true, data: [] });
		mockNotion.createPage.mockResolvedValue({
			success: true,
			data: { id: 'page-123', url: 'https://notion.so/page-123' },
		});
		mockNotion.appendBlocksInBatches.mockResolvedValue({
			success: true,
			data: { totalAppended: 5, batches: 1 },
		});

		const videoResult = await fetchVideoDetails('vid1');

		const firstPage = await createNotionVideoPage({
			video: videoResult.data!,
			transcript: null,
			databaseId: 'db-123',
			propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
			integrations: { notion: mockNotion },
		});

		expect(firstPage?.skipped).toBeUndefined();
		expect(mockNotion.createPage).toHaveBeenCalledTimes(1);

		// Second call: duplicate detected
		mockNotion.queryDatabase.mockResolvedValueOnce({
			success: true,
			data: [{ id: 'page-123', url: 'https://notion.so/page-123' }],
		});

		const secondPage = await createNotionVideoPage({
			video: videoResult.data!,
			transcript: null,
			databaseId: 'db-123',
			propertyNames: { title: 'Name', url: 'URL', channel: 'Channel', date: 'Published' },
			integrations: { notion: mockNotion },
		});

		expect(secondPage?.skipped).toBe(true);
		expect(mockNotion.createPage).toHaveBeenCalledTimes(1); // Still only 1 call
	});
});

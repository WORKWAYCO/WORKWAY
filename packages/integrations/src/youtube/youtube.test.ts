/**
 * YouTube Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	YouTube,
	extractVideoId,
	extractPlaylistId,
	parseDuration,
	formatDuration,
} from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('YouTube Integration', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	describe('constructor', () => {
		it('should throw if no access token or API key provided', () => {
			expect(() => new YouTube({} as any)).toThrow('YouTube access token or API key is required');
		});

		it('should accept access token', () => {
			const youtube = new YouTube({ accessToken: 'test-token' });
			expect(youtube).toBeInstanceOf(YouTube);
		});

		it('should accept API key', () => {
			const youtube = new YouTube({ apiKey: 'test-api-key' } as any);
			expect(youtube).toBeInstanceOf(YouTube);
		});
	});

	describe('getPlaylistItems', () => {
		it('should fetch playlist items successfully', async () => {
			const youtube = new YouTube({ accessToken: 'test-token' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					kind: 'youtube#playlistItemListResponse',
					etag: 'test-etag',
					nextPageToken: 'next-token',
					pageInfo: { totalResults: 100, resultsPerPage: 50 },
					items: [
						{
							id: 'item-1',
							snippet: {
								publishedAt: '2024-01-15T12:00:00Z',
								channelId: 'channel-1',
								title: 'Test Video',
								description: 'Test description',
								thumbnails: { default: { url: 'https://example.com/thumb.jpg', width: 120, height: 90 } },
								channelTitle: 'Test Channel',
								playlistId: 'playlist-1',
								position: 0,
								resourceId: { kind: 'youtube#video', videoId: 'video-1' },
							},
							contentDetails: {
								videoId: 'video-1',
							},
						},
					],
				}),
			});

			const result = await youtube.getPlaylistItems({ playlistId: 'test-playlist' });

			expect(result.success).toBe(true);
			expect(result.data?.items).toHaveLength(1);
			expect(result.data?.items[0].videoId).toBe('video-1');
			expect(result.data?.items[0].title).toBe('Test Video');
			expect(result.data?.nextPageToken).toBe('next-token');
		});

		it('should return error for missing playlist ID', async () => {
			const youtube = new YouTube({ accessToken: 'test-token' });

			const result = await youtube.getPlaylistItems({ playlistId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toBe('Playlist ID is required');
		});
	});

	describe('getVideo', () => {
		it('should fetch video details successfully', async () => {
			const youtube = new YouTube({ accessToken: 'test-token' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					kind: 'youtube#videoListResponse',
					pageInfo: { totalResults: 1, resultsPerPage: 1 },
					items: [
						{
							id: 'video-1',
							snippet: {
								publishedAt: '2024-01-15T12:00:00Z',
								channelId: 'channel-1',
								title: 'Test Video',
								description: 'Test description',
								thumbnails: { high: { url: 'https://example.com/thumb.jpg', width: 480, height: 360 } },
								channelTitle: 'Test Channel',
								tags: ['test', 'video'],
							},
							contentDetails: {
								duration: 'PT5M30S',
							},
							statistics: {
								viewCount: '1000',
								likeCount: '100',
								commentCount: '10',
							},
						},
					],
				}),
			});

			const result = await youtube.getVideo({ videoId: 'video-1' });

			expect(result.success).toBe(true);
			expect(result.data?.id).toBe('video-1');
			expect(result.data?.title).toBe('Test Video');
			expect(result.data?.duration).toBe('PT5M30S');
			expect(result.data?.viewCount).toBe(1000);
		});

		it('should return error for video not found', async () => {
			const youtube = new YouTube({ accessToken: 'test-token' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					kind: 'youtube#videoListResponse',
					pageInfo: { totalResults: 0, resultsPerPage: 0 },
					items: [],
				}),
			});

			const result = await youtube.getVideo({ videoId: 'not-found' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toBe('Video not found');
		});
	});

	describe('getTranscript', () => {
		it('should fetch transcript successfully', async () => {
			const youtube = new YouTube({ accessToken: 'test-token' });

			// Mock the video page fetch
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<html>"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=test","languageCode":"en"}]</html>`,
			});

			// Mock the transcript fetch
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					events: [
						{ tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] },
						{ tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: 'This is a test' }] },
					],
				}),
			});

			const result = await youtube.getTranscript({ videoId: 'test-video' });

			expect(result.success).toBe(true);
			expect(result.data?.segments).toHaveLength(2);
			expect(result.data?.text).toBe('Hello world This is a test');
		});

		it('should return error when no captions available', async () => {
			const youtube = new YouTube({ accessToken: 'test-token' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: async () => '<html>No captions here</html>',
			});

			const result = await youtube.getTranscript({ videoId: 'no-captions' });

			expect(result.success).toBe(false);
			expect(result.error?.message).toBe('No captions available for this video');
		});
	});
});

describe('Utility Functions', () => {
	describe('extractVideoId', () => {
		it('should extract from youtube.com/watch URL', () => {
			expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should extract from youtu.be URL', () => {
			expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should extract from embed URL', () => {
			expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should return the ID if already a valid video ID', () => {
			expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should return null for invalid input', () => {
			expect(extractVideoId('invalid')).toBeNull();
		});
	});

	describe('extractPlaylistId', () => {
		it('should extract from youtube.com/playlist URL', () => {
			expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx123')).toBe('PLxxx123');
		});

		it('should return the ID if already a valid playlist ID', () => {
			expect(extractPlaylistId('PLxxx123')).toBe('PLxxx123');
		});

		it('should handle UU (uploads) playlists', () => {
			expect(extractPlaylistId('UUxxx123')).toBe('UUxxx123');
		});

		it('should return null for invalid input', () => {
			expect(extractPlaylistId('invalid')).toBeNull();
		});
	});

	describe('parseDuration', () => {
		it('should parse hours, minutes, and seconds', () => {
			expect(parseDuration('PT1H2M10S')).toBe(3730);
		});

		it('should parse minutes and seconds', () => {
			expect(parseDuration('PT5M30S')).toBe(330);
		});

		it('should parse seconds only', () => {
			expect(parseDuration('PT45S')).toBe(45);
		});

		it('should return 0 for invalid format', () => {
			expect(parseDuration('invalid')).toBe(0);
		});
	});

	describe('formatDuration', () => {
		it('should format hours, minutes, and seconds', () => {
			expect(formatDuration(3730)).toBe('1:02:10');
		});

		it('should format minutes and seconds', () => {
			expect(formatDuration(330)).toBe('5:30');
		});

		it('should format seconds with leading zero', () => {
			expect(formatDuration(65)).toBe('1:05');
		});
	});
});

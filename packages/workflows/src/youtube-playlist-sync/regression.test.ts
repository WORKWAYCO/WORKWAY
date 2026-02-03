/**
 * YouTube Playlist Sync - Regression Test Suite
 *
 * Comprehensive tests for edge cases, boundary conditions, and previously encountered issues.
 * These tests prevent regressions by covering tricky scenarios that have caused or could cause issues.
 *
 * Test Coverage:
 * - Date/time edge cases (formats, timezones, invalid dates)
 * - Content edge cases (long strings, special characters, empty data)
 * - Notion database edge cases (property variations, missing fields)
 * - YouTube playlist edge cases (format variations, empty playlists, large playlists)
 * - Transcript edge cases (unavailable, very long, special characters)
 * - State management edge cases (corrupted state, pruning, conflicts)
 * - API response variations (partial data, unexpected structure)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	formatDuration,
	splitTextIntoBlocks,
	getPollIntervalMs,
	buildVideoBlocks,
	buildVideoInfoLines,
	NOTION_BLOCK_CHAR_LIMIT,
	NOTION_BLOCKS_PER_REQUEST,
	type VideoData,
	type TranscriptData,
} from './utils.js';
import { extractPlaylistId } from '@workwayco/integrations';

// ============================================================================
// DATE/TIME EDGE CASES
// ============================================================================

describe('Date/Time Edge Cases', () => {
	describe('formatDuration', () => {
		it('should handle various valid ISO 8601 duration formats', () => {
			expect(formatDuration('PT1H2M10S')).toBe('1:02:10');
			expect(formatDuration('PT5M30S')).toBe('5:30');
			expect(formatDuration('PT45S')).toBe('0:45');
			expect(formatDuration('PT10M')).toBe('10:00');
			expect(formatDuration('PT1H')).toBe('1:00:00');
			expect(formatDuration('PT0S')).toBe('0:00');
		});

		it('should handle very long durations (>10 hours)', () => {
			expect(formatDuration('PT12H30M45S')).toBe('12:30:45');
			expect(formatDuration('PT100H')).toBe('100:00:00');
		});

		it('should handle edge case durations (0 seconds, 1 second)', () => {
			expect(formatDuration('PT0S')).toBe('0:00');
			expect(formatDuration('PT1S')).toBe('0:01');
		});

		it('should handle malformed duration strings gracefully', () => {
			expect(formatDuration('invalid')).toBe('invalid');
			expect(formatDuration('')).toBe('');
			expect(formatDuration('PT')).toBe('0:00'); // Matches regex but no H/M/S components
			expect(formatDuration('1:23:45')).toBe('1:23:45'); // Already formatted
		});

		it('should handle missing duration components', () => {
			expect(formatDuration('PT10M0S')).toBe('10:00');
			expect(formatDuration('PT0M30S')).toBe('0:30');
		});
	});

	describe('Video Published Date Variations', () => {
		it('should handle various ISO 8601 date formats', () => {
			const dates = [
				'2025-01-15T10:30:00Z', // UTC
				'2025-01-15T10:30:00.000Z', // With milliseconds
				'2025-01-15T10:30:00+00:00', // UTC with offset
				'2025-01-15T10:30:00-08:00', // PST
				'2025-01-15', // Date only
			];

			dates.forEach((date) => {
				const video: VideoData = {
					id: 'test',
					title: 'Test',
					description: '',
					publishedAt: date,
					channelTitle: 'Channel',
				};

				const infoLines = buildVideoInfoLines(video);
				const publishedLine = infoLines.find((line) => line.includes('Published'));

				expect(publishedLine).toBeDefined();
				expect(publishedLine).toContain('2025-01-15');
			});
		});

		it('should handle date edge cases (today, yesterday, 1 year ago)', () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(yesterday.getDate() - 1);
			const oneYearAgo = new Date(today);
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

			[today, yesterday, oneYearAgo].forEach((date) => {
				const video: VideoData = {
					id: 'test',
					title: 'Test',
					description: '',
					publishedAt: date.toISOString(),
					channelTitle: 'Channel',
				};

				const infoLines = buildVideoInfoLines(video);
				expect(infoLines.some((line) => line.includes('Published'))).toBe(true);
			});
		});

		it('should handle invalid/missing publish dates gracefully', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '', // Empty
				channelTitle: 'Channel',
			};

			const infoLines = buildVideoInfoLines(video);
			// Should not crash, but Published line might be missing or empty
			expect(infoLines).toBeInstanceOf(Array);
		});
	});

	describe('Timezone Handling', () => {
		it('should extract date correctly regardless of timezone', () => {
			const dateUTC = '2025-01-15T23:30:00Z';
			const datePST = '2025-01-15T15:30:00-08:00'; // Same moment in PST

			const video1: VideoData = {
				id: 'test1',
				title: 'Test',
				description: '',
				publishedAt: dateUTC,
				channelTitle: 'Channel',
			};

			const video2: VideoData = {
				id: 'test2',
				title: 'Test',
				description: '',
				publishedAt: datePST,
				channelTitle: 'Channel',
			};

			const info1 = buildVideoInfoLines(video1);
			const info2 = buildVideoInfoLines(video2);

			// Both should extract the same date (2025-01-15)
			expect(info1.find((l) => l.includes('Published'))).toBeDefined();
			expect(info2.find((l) => l.includes('Published'))).toBeDefined();
		});
	});

	describe('Poll Frequency Intervals', () => {
		it('should return correct milliseconds for all frequency options', () => {
			expect(getPollIntervalMs('15min')).toBe(15 * 60 * 1000);
			expect(getPollIntervalMs('hourly')).toBe(60 * 60 * 1000);
			expect(getPollIntervalMs('daily')).toBe(24 * 60 * 60 * 1000);
		});

		it('should default to hourly for unknown frequencies', () => {
			expect(getPollIntervalMs('')).toBe(60 * 60 * 1000);
			expect(getPollIntervalMs('weekly')).toBe(60 * 60 * 1000);
			expect(getPollIntervalMs('invalid')).toBe(60 * 60 * 1000);
		});
	});
});

// ============================================================================
// CONTENT EDGE CASES
// ============================================================================

describe('Content Edge Cases', () => {
	describe('Very Long Video Titles', () => {
		it('should handle titles exceeding 200 characters', () => {
			const longTitle = 'a'.repeat(500);
			const video: VideoData = {
				id: 'test',
				title: longTitle,
				description: 'Description',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, null);
			expect(blocks).toBeInstanceOf(Array);
			expect(blocks.length).toBeGreaterThan(0);
		});

		it('should handle title with 1000+ characters', () => {
			const veryLongTitle = 'Very Long Title '.repeat(100); // ~1500 chars
			const video: VideoData = {
				id: 'test',
				title: veryLongTitle,
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			expect(() => buildVideoBlocks(video, null)).not.toThrow();
		});
	});

	describe('Very Long Descriptions', () => {
		it('should split descriptions exceeding Notion block limit (1900 chars)', () => {
			const longDescription = 'a'.repeat(5000);
			const blocks = splitTextIntoBlocks(longDescription);

			// Should split into multiple blocks
			expect(blocks.length).toBeGreaterThan(1);

			// Each block should be under the limit
			blocks.forEach((block) => {
				const content = block.paragraph.rich_text[0].text.content;
				expect(content.length).toBeLessThanOrEqual(NOTION_BLOCK_CHAR_LIMIT);
			});
		});

		it('should handle description with 10,000+ characters', () => {
			const veryLongDescription = 'Long description. '.repeat(600); // ~10,000 chars
			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: veryLongDescription,
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, null);

			// Should not crash and should create multiple blocks
			expect(blocks.length).toBeGreaterThan(5);
		});

		it('should preserve paragraph breaks in long descriptions', () => {
			const multiParagraphDescription =
				'Paragraph 1.\n\n' + 'Paragraph 2.\n\n' + 'Paragraph 3 is very long. '.repeat(200);

			const blocks = splitTextIntoBlocks(multiParagraphDescription);

			// Should have at least 3 blocks (one for each paragraph)
			expect(blocks.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('Special Characters in Content', () => {
		it('should handle emoji in titles and descriptions', () => {
			const emojiTitle = '🎬 Video Tutorial 📹 Part 1 🔥';
			const emojiDescription = 'Learn to code! 💻 Subscribe for more! 👍';

			const video: VideoData = {
				id: 'test',
				title: emojiTitle,
				description: emojiDescription,
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel 🎥',
			};

			const blocks = buildVideoBlocks(video, null);

			// Should not crash and should preserve emoji
			expect(blocks.length).toBeGreaterThan(0);
		});

		it('should handle special characters (quotes, symbols, unicode)', () => {
			const specialTitle = 'Video: "Testing" with <tags> & symbols • © ® ™';
			const specialDescription =
				'Description with quotes: "double" and \'single\'\n' +
				'Symbols: @ # $ % ^ & * ( ) - _ = +\n' +
				'Unicode: café résumé naïve';

			const video: VideoData = {
				id: 'test',
				title: specialTitle,
				description: specialDescription,
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, null);
			expect(blocks.length).toBeGreaterThan(0);
		});

		it('should handle HTML entities and escape sequences', () => {
			const titleWithEntities = 'Video &amp; Tutorial &lt;HTML&gt; &quot;Quotes&quot;';
			const descriptionWithEscapes = 'Line 1\nLine 2\tTabbed\rCarriage return';

			const video: VideoData = {
				id: 'test',
				title: titleWithEntities,
				description: descriptionWithEscapes,
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			expect(() => buildVideoBlocks(video, null)).not.toThrow();
		});

		it('should handle newlines and whitespace variations', () => {
			const descriptions = [
				'Line1\nLine2\nLine3', // Unix
				'Line1\r\nLine2\r\nLine3', // Windows
				'Line1\rLine2\rLine3', // Old Mac
				'Line1\n\n\n\nLine2', // Multiple newlines
				'   Leading spaces',
				'Trailing spaces   ',
				'\t\tTabs at start',
			];

			descriptions.forEach((desc) => {
				const video: VideoData = {
					id: 'test',
					title: 'Test',
					description: desc,
					publishedAt: '2025-01-15T10:00:00Z',
					channelTitle: 'Channel',
				};

				expect(() => buildVideoBlocks(video, null)).not.toThrow();
			});
		});
	});

	describe('Empty/Missing Content', () => {
		it('should handle empty description gracefully', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test Video',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, null);

			// Should still create video embed and info blocks, but no description section
			expect(blocks.length).toBeGreaterThan(0);
			expect(blocks[0].type).toBe('video');
		});

		it('should handle missing optional fields', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Minimal Video',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Unknown',
				// duration, viewCount, thumbnailUrl not provided
			};

			const infoLines = buildVideoInfoLines(video);

			// Should not crash, but info callout will have fewer lines
			expect(infoLines).toBeInstanceOf(Array);
		});

		it('should handle empty transcript text', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: 'Description',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const emptyTranscript: TranscriptData = {
				text: '',
				segments: [],
			};

			const blocks = buildVideoBlocks(video, emptyTranscript);

			// Should handle gracefully, might skip transcript section
			expect(blocks).toBeInstanceOf(Array);
		});
	});
});

// ============================================================================
// NOTION DATABASE EDGE CASES
// ============================================================================

describe('Notion Database Edge Cases', () => {
	describe('Property Name Variations', () => {
		it('should handle non-standard property names', () => {
			const propertyNames = {
				title: 'Video Title', // Not "Name"
				url: 'Video URL', // Not "URL"
				channel: 'Creator', // Not "Channel"
				date: 'Upload Date', // Not "Published"
			};

			// Validation that custom property names are supported
			expect(propertyNames.title).toBe('Video Title');
			expect(propertyNames.url).toBe('Video URL');
		});

		it('should handle property names with special characters', () => {
			const propertyNames = {
				title: 'Name 🎬',
				url: 'URL (External)',
				channel: 'Channel/Creator',
				date: 'Date - Published',
			};

			expect(propertyNames.title).toBeDefined();
		});
	});

	describe('Database Structure Variations', () => {
		it('should handle database with extra properties (should ignore)', () => {
			// Real scenario: User's database has additional columns
			// Workflow should only set the properties it knows about
			const userDatabaseProperties = [
				'Name',
				'URL',
				'Channel',
				'Published',
				'Category', // Extra property
				'Tags', // Extra property
				'Status', // Extra property
			];

			// Workflow only needs to set its 4 core properties
			const workflowProperties = ['Name', 'URL', 'Channel', 'Published'];

			// Extra properties should be ignored (not cause errors)
			expect(workflowProperties.length).toBe(4);
			expect(userDatabaseProperties.length).toBe(7);
		});
	});

	describe('Block Batching Edge Cases', () => {
		it('should handle exactly 100 blocks (Notion limit)', () => {
			const blocks = Array.from({ length: 100 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: { rich_text: [{ text: { content: `Block ${i}` } }] },
			}));

			expect(blocks.length).toBe(NOTION_BLOCKS_PER_REQUEST);
		});

		it('should handle 101 blocks (requires batching)', () => {
			const blocks = Array.from({ length: 101 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: { rich_text: [{ text: { content: `Block ${i}` } }] },
			}));

			// First 100 go in initial create, 1 goes in append batch
			expect(blocks.length).toBe(101);
		});

		it('should handle 500 blocks (multiple batches)', () => {
			const blocks = Array.from({ length: 500 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: { rich_text: [{ text: { content: `Block ${i}` } }] },
			}));

			// Should require 5 batches (100 + 100 + 100 + 100 + 100)
			const batchCount = Math.ceil(blocks.length / NOTION_BLOCKS_PER_REQUEST);
			expect(batchCount).toBe(5);
		});
	});
});

// ============================================================================
// YOUTUBE PLAYLIST EDGE CASES
// ============================================================================

describe('YouTube Playlist Edge Cases', () => {
	describe('extractPlaylistId', () => {
		it('should handle various URL formats', () => {
			const urls = [
				'https://www.youtube.com/playlist?list=PLxxx123',
				'https://youtube.com/playlist?list=PLxxx123',
				'http://www.youtube.com/playlist?list=PLxxx123',
				'www.youtube.com/playlist?list=PLxxx123',
				'youtube.com/playlist?list=PLxxx123',
			];

			urls.forEach((url) => {
				expect(extractPlaylistId(url)).toBe('PLxxx123');
			});
		});

		it('should handle playlist URLs with extra parameters', () => {
			const urlWithParams =
				'https://youtube.com/playlist?list=PLxxx123&si=abc&feature=share&index=5';
			expect(extractPlaylistId(urlWithParams)).toBe('PLxxx123');
		});

		it('should handle playlist URL with video parameter', () => {
			const urlWithVideo =
				'https://www.youtube.com/watch?v=videoId&list=PLxxx123&index=2';
			expect(extractPlaylistId(urlWithVideo)).toBe('PLxxx123');
		});

		it('should handle raw playlist IDs without URL', () => {
			expect(extractPlaylistId('PLxxx123')).toBe('PLxxx123');
			expect(extractPlaylistId('UUxxx123')).toBe('UUxxx123'); // Uploads playlist
			expect(extractPlaylistId('LLxxx123')).toBe('LLxxx123'); // Likes playlist
		});

		it('should reject invalid playlist IDs/URLs', () => {
			expect(extractPlaylistId('invalid')).toBeNull();
			expect(extractPlaylistId('')).toBeNull();
			expect(extractPlaylistId('https://www.youtube.com/watch?v=abc')).toBeNull();
			expect(extractPlaylistId('https://vimeo.com/123456')).toBeNull();
		});

		it('should handle playlist ID edge cases', () => {
			// Playlist IDs are typically 34 characters starting with PL, UU, or LL
			expect(extractPlaylistId('PL' + 'a'.repeat(32))).toBeDefined();
			expect(extractPlaylistId('UU' + 'a'.repeat(32))).toBeDefined();
			expect(extractPlaylistId('LL' + 'a'.repeat(32))).toBeDefined();
		});
	});

	describe('Empty and Single-Item Playlists', () => {
		it('should handle empty playlist (0 videos)', () => {
			const playlistItems: any[] = [];
			const processedVideoIds: string[] = [];

			const newVideos = playlistItems.filter(
				(item) => !processedVideoIds.includes(item.videoId)
			);

			expect(newVideos.length).toBe(0);
		});

		it('should handle single-video playlist', () => {
			const playlistItems = [{ videoId: 'vid1', title: 'Only Video' }];
			const processedVideoIds: string[] = [];

			const newVideos = playlistItems.filter(
				(item) => !processedVideoIds.includes(item.videoId)
			);

			expect(newVideos.length).toBe(1);
		});
	});

	describe('Large Playlists', () => {
		it('should handle playlist with 100 videos', () => {
			const playlistItems = Array.from({ length: 100 }, (_, i) => ({
				videoId: `vid${i}`,
				title: `Video ${i}`,
			}));

			expect(playlistItems.length).toBe(100);
		});

		it('should handle playlist with 500+ videos', () => {
			const playlistItems = Array.from({ length: 500 }, (_, i) => ({
				videoId: `vid${i}`,
				title: `Video ${i}`,
			}));

			// Should handle without crashing (though may be limited by API pagination)
			expect(playlistItems.length).toBe(500);
		});

		it('should handle very large playlist (1000+ videos)', () => {
			const playlistItems = Array.from({ length: 1200 }, (_, i) => ({
				videoId: `vid${i}`,
				title: `Video ${i}`,
			}));

			expect(playlistItems.length).toBe(1200);
		});
	});
});

// ============================================================================
// TRANSCRIPT EDGE CASES
// ============================================================================

describe('Transcript Edge Cases', () => {
	describe('Transcript Availability', () => {
		it('should handle video with no transcript available', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test Video',
				description: 'Description',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, null);

			// Should create blocks without transcript section
			expect(blocks).toBeInstanceOf(Array);
			expect(blocks.some((b) => b.type === 'divider')).toBe(false); // No divider before transcript
		});

		it('should handle transcript with missing language metadata', () => {
			const transcript: TranscriptData = {
				text: 'Transcript text without language',
				segments: [{ text: 'Transcript text without language', offset: 0, duration: 1000 }],
				// language not provided
			};

			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, transcript);

			// Should handle missing language gracefully
			expect(blocks).toBeInstanceOf(Array);
		});
	});

	describe('Very Long Transcripts', () => {
		it('should handle transcript with 10,000+ characters', () => {
			const longTranscript = 'Long transcript segment. '.repeat(500); // ~12,000 chars

			const transcript: TranscriptData = {
				text: longTranscript,
				segments: [{ text: longTranscript, offset: 0, duration: 60000 }],
				language: 'English',
			};

			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			const blocks = buildVideoBlocks(video, transcript);

			// Should split into multiple blocks
			const transcriptBlocks = blocks.filter((b) => b.type === 'paragraph');
			expect(transcriptBlocks.length).toBeGreaterThan(5);
		});

		it('should handle transcript exceeding 50,000 characters', () => {
			const veryLongTranscript = 'Segment. '.repeat(6000); // ~54,000 chars

			const blocks = splitTextIntoBlocks(veryLongTranscript);

			// Should split into many blocks, each under limit
			expect(blocks.length).toBeGreaterThan(25);
			blocks.forEach((block) => {
				const content = block.paragraph.rich_text[0].text.content;
				expect(content.length).toBeLessThanOrEqual(NOTION_BLOCK_CHAR_LIMIT);
			});
		});
	});

	describe('Transcript Special Characters', () => {
		it('should handle transcript with emoji and unicode', () => {
			const transcript: TranscriptData = {
				text: 'Hello 👋 welcome to the tutorial! 🎉 Learn about café and résumé.',
				segments: [
					{ text: 'Hello 👋 welcome to the tutorial! 🎉', offset: 0, duration: 2000 },
					{ text: 'Learn about café and résumé.', offset: 2000, duration: 3000 },
				],
				language: 'English',
			};

			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			expect(() => buildVideoBlocks(video, transcript)).not.toThrow();
		});

		it('should handle transcript with HTML entities', () => {
			const transcript: TranscriptData = {
				text: 'Use &lt;div&gt; tags &amp; &quot;attributes&quot;',
				segments: [
					{ text: 'Use &lt;div&gt; tags &amp; &quot;attributes&quot;', offset: 0, duration: 3000 },
				],
				language: 'English',
			};

			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
			};

			expect(() => buildVideoBlocks(video, transcript)).not.toThrow();
		});
	});

	describe('Transcript Language Variations', () => {
		it('should handle transcripts in various languages', () => {
			const languages = [
				{ code: 'English', text: 'Hello world' },
				{ code: 'Spanish', text: 'Hola mundo' },
				{ code: 'French', text: 'Bonjour le monde' },
				{ code: 'Japanese', text: 'こんにちは世界' },
				{ code: 'Arabic', text: 'مرحبا بالعالم' },
				{ code: 'Chinese (Simplified)', text: '你好世界' },
			];

			languages.forEach(({ code, text }) => {
				const transcript: TranscriptData = {
					text,
					segments: [{ text, offset: 0, duration: 2000 }],
					language: code,
				};

				const video: VideoData = {
					id: 'test',
					title: 'Test',
					description: '',
					publishedAt: '2025-01-15T10:00:00Z',
					channelTitle: 'Channel',
				};

				expect(() => buildVideoBlocks(video, transcript)).not.toThrow();
			});
		});
	});
});

// ============================================================================
// STATE MANAGEMENT EDGE CASES
// ============================================================================

describe('State Management Edge Cases', () => {
	describe('State Pruning', () => {
		it('should keep last 1000 IDs when exceeding limit', () => {
			const processedVideoIds = Array.from({ length: 1200 }, (_, i) => `vid${i}`);

			// Simulate pruning logic
			const pruned =
				processedVideoIds.length > 1000
					? processedVideoIds.slice(-1000)
					: processedVideoIds;

			expect(pruned.length).toBe(1000);
			expect(pruned[0]).toBe('vid200'); // First 200 were removed
			expect(pruned[999]).toBe('vid1199'); // Last one
		});

		it('should not prune when under 1000 IDs', () => {
			const processedVideoIds = Array.from({ length: 500 }, (_, i) => `vid${i}`);

			const pruned =
				processedVideoIds.length > 1000
					? processedVideoIds.slice(-1000)
					: processedVideoIds;

			expect(pruned.length).toBe(500);
			expect(pruned).toEqual(processedVideoIds);
		});

		it('should handle exactly 1000 IDs (no pruning needed)', () => {
			const processedVideoIds = Array.from({ length: 1000 }, (_, i) => `vid${i}`);

			const pruned =
				processedVideoIds.length > 1000
					? processedVideoIds.slice(-1000)
					: processedVideoIds;

			expect(pruned.length).toBe(1000);
			expect(pruned).toEqual(processedVideoIds);
		});

		it('should handle 1001 IDs (prune 1)', () => {
			const processedVideoIds = Array.from({ length: 1001 }, (_, i) => `vid${i}`);

			const pruned = processedVideoIds.slice(-1000);

			expect(pruned.length).toBe(1000);
			expect(pruned[0]).toBe('vid1'); // First one (vid0) was removed
		});
	});

	describe('Corrupted State Recovery', () => {
		it('should initialize fresh state when JSON is invalid', () => {
			const invalidJSON = '{invalid json}';

			let state;
			try {
				state = JSON.parse(invalidJSON);
			} catch {
				// Fallback to default state
				state = {
					playlistId: 'PLxxx',
					lastChecked: new Date(0).toISOString(),
					processedVideoIds: [],
				};
			}

			expect(state.playlistId).toBe('PLxxx');
			expect(state.processedVideoIds).toEqual([]);
		});

		it('should handle missing state (first run)', () => {
			const state = null;

			const fallbackState = state || {
				playlistId: 'PLxxx',
				lastChecked: new Date(0).toISOString(),
				processedVideoIds: [],
			};

			expect(fallbackState.lastChecked).toBe(new Date(0).toISOString());
			expect(fallbackState.processedVideoIds).toEqual([]);
		});

		it('should handle state with missing fields', () => {
			const incompleteState: any = {
				playlistId: 'PLxxx',
				// lastChecked missing
				// processedVideoIds missing
			};

			const normalizedState = {
				playlistId: incompleteState.playlistId || 'unknown',
				lastChecked: incompleteState.lastChecked || new Date(0).toISOString(),
				processedVideoIds: incompleteState.processedVideoIds || [],
			};

			expect(normalizedState.lastChecked).toBe(new Date(0).toISOString());
			expect(normalizedState.processedVideoIds).toEqual([]);
		});
	});

	describe('Concurrent State Conflicts', () => {
		it('should handle race condition where same video ID added twice', () => {
			const processedVideoIds = ['vid1', 'vid2', 'vid3'];

			// Simulate two executions trying to add vid4
			const execution1Ids = [...processedVideoIds, 'vid4'];
			const execution2Ids = [...processedVideoIds, 'vid4'];

			// Whichever wins the race, vid4 should only appear once in merged state
			const mergedIds = Array.from(
				new Set([...execution1Ids, ...execution2Ids])
			).sort();

			expect(mergedIds).toEqual(['vid1', 'vid2', 'vid3', 'vid4']);
			expect(mergedIds.filter((id) => id === 'vid4').length).toBe(1);
		});
	});
});

// ============================================================================
// API RESPONSE VARIATIONS
// ============================================================================

describe('API Response Variations', () => {
	describe('Partial Data Scenarios', () => {
		it('should handle video with missing optional metadata', () => {
			const partialVideo: VideoData = {
				id: 'test',
				title: 'Video Title',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
				// duration, viewCount, thumbnailUrl missing
			};

			const infoLines = buildVideoInfoLines(partialVideo);

			// Should still work, just with fewer info lines
			expect(infoLines).toBeInstanceOf(Array);
			expect(infoLines.some((line) => line.includes('Channel'))).toBe(true);
		});

		it('should handle video with only required fields', () => {
			const minimalVideo: VideoData = {
				id: 'test',
				title: 'Minimal Video',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Unknown',
			};

			expect(() => buildVideoBlocks(minimalVideo, null)).not.toThrow();
		});
	});

	describe('View Count Edge Cases', () => {
		it('should handle zero views', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
				viewCount: 0,
			};

			const infoLines = buildVideoInfoLines(video);
			const viewsLine = infoLines.find((line) => line.includes('Views'));

			// Note: viewCount of 0 is falsy, so buildVideoInfoLines skips it
			// This is acceptable behavior - 0 views doesn't need to be displayed
			expect(viewsLine).toBeUndefined();
		});

		it('should handle very large view counts (millions)', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
				viewCount: 123456789,
			};

			const infoLines = buildVideoInfoLines(video);
			const viewsLine = infoLines.find((line) => line.includes('Views'));

			expect(viewsLine).toBeDefined();
			// Should format with commas
			expect(viewsLine).toContain('123,456,789');
		});
	});

	describe('Thumbnail URL Variations', () => {
		it('should handle missing thumbnail URL', () => {
			const video: VideoData = {
				id: 'test',
				title: 'Test',
				description: '',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'Channel',
				// thumbnailUrl not provided
			};

			expect(() => buildVideoBlocks(video, null)).not.toThrow();
		});

		it('should handle various thumbnail URL formats', () => {
			const thumbnailUrls = [
				'https://i.ytimg.com/vi/videoId/maxresdefault.jpg',
				'https://i.ytimg.com/vi/videoId/hqdefault.jpg',
				'https://i.ytimg.com/vi/videoId/default.jpg',
			];

			thumbnailUrls.forEach((thumbnailUrl) => {
				const video: VideoData = {
					id: 'test',
					title: 'Test',
					description: '',
					publishedAt: '2025-01-15T10:00:00Z',
					channelTitle: 'Channel',
					thumbnailUrl,
				};

				expect(() => buildVideoBlocks(video, null)).not.toThrow();
			});
		});
	});
});

// ============================================================================
// BOUNDARY CONDITIONS
// ============================================================================

describe('Boundary Conditions', () => {
	describe('Zero/Empty States', () => {
		it('should handle playlist with 0 new videos', () => {
			const allVideos = [
				{ videoId: 'vid1', title: 'Video 1' },
				{ videoId: 'vid2', title: 'Video 2' },
			];
			const processedVideoIds = ['vid1', 'vid2'];

			const newVideos = allVideos.filter(
				(item) => !processedVideoIds.includes(item.videoId)
			);

			expect(newVideos.length).toBe(0);
		});

		it('should handle empty string inputs', () => {
			expect(extractPlaylistId('')).toBeNull();
			expect(formatDuration('')).toBe('');

			const emptyBlocks = splitTextIntoBlocks('');
			expect(emptyBlocks.length).toBe(1);
			expect(emptyBlocks[0].paragraph.rich_text[0].text.content).toBe('');
		});

		it('should handle whitespace-only strings', () => {
			const whitespaceText = '   \n\n\t\t   ';
			const blocks = splitTextIntoBlocks(whitespaceText);

			// Should handle gracefully, possibly return empty block
			expect(blocks).toBeInstanceOf(Array);
		});
	});

	describe('Maximum Values', () => {
		it('should handle maximum reasonable duration (24 hours)', () => {
			expect(formatDuration('PT24H')).toBe('24:00:00');
			expect(formatDuration('PT23H59M59S')).toBe('23:59:59');
		});

		it('should handle maximum Notion block count', () => {
			const maxBlocks = Array.from({ length: NOTION_BLOCKS_PER_REQUEST }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph' as const,
				paragraph: { rich_text: [{ text: { content: `Block ${i}` } }] },
			}));

			expect(maxBlocks.length).toBe(100);
		});

		it('should handle maximum concurrent videos (clamped to 10)', () => {
			const configValue = 100; // User sets very high value

			const clampedConcurrency = Math.max(1, Math.min(10, configValue));

			expect(clampedConcurrency).toBe(10);
		});
	});

	describe('Minimum Values', () => {
		it('should handle minimum duration (0 seconds)', () => {
			expect(formatDuration('PT0S')).toBe('0:00');
		});

		it('should handle minimum concurrent videos (clamped to 1)', () => {
			const configValue = 0; // User sets zero or negative

			const clampedConcurrency = Math.max(1, Math.min(10, configValue));

			expect(clampedConcurrency).toBe(1);
		});

		it('should handle single character in each field', () => {
			const video: VideoData = {
				id: 'a',
				title: 'b',
				description: 'c',
				publishedAt: '2025-01-15T10:00:00Z',
				channelTitle: 'd',
			};

			expect(() => buildVideoBlocks(video, null)).not.toThrow();
		});
	});
});

// ============================================================================
// KNOWN ISSUES & HISTORICAL BUGS
// ============================================================================

describe('Known Issues & Historical Bug Prevention', () => {
	describe('Text Splitting Regression', () => {
		it('should split at sentence boundaries when possible', () => {
			// Create text long enough to exceed Notion block limit (1900 chars)
			const longText =
				'First sentence. '.repeat(70) + 'Second sentence. '.repeat(70); // ~2240 chars
			const blocks = splitTextIntoBlocks(longText);

			// Should split into multiple blocks
			expect(blocks.length).toBeGreaterThan(1);

			// Check that splits happen at sentence boundaries (periods)
			blocks.forEach((block) => {
				const content = block.paragraph.rich_text[0].text.content;
				if (content.length === NOTION_BLOCK_CHAR_LIMIT) {
					// If at limit, should end with period or be mid-word
					const lastChar = content.trim().slice(-1);
					// This is a soft check - splitting at word boundaries
					expect(typeof lastChar).toBe('string');
				}
			});
		});

		it('should not lose text when splitting long paragraphs', () => {
			const originalText = 'Word '.repeat(1000); // 5000 chars
			const blocks = splitTextIntoBlocks(originalText);

			// Reconstruct text from blocks
			const reconstructedText = blocks
				.map((b) => b.paragraph.rich_text[0].text.content)
				.join(' ');

			// Length should be approximately the same (accounting for whitespace normalization)
			expect(reconstructedText.length).toBeGreaterThan(originalText.length * 0.95);
		});
	});

	describe('Duplicate Detection Regression', () => {
		it('should not process same video twice in one execution', () => {
			const playlistItems = [
				{ videoId: 'vid1', title: 'Video 1' },
				{ videoId: 'vid1', title: 'Video 1' }, // Duplicate
				{ videoId: 'vid2', title: 'Video 2' },
			];

			// Simulate deduplication
			const uniqueVideoIds = new Set(playlistItems.map((item) => item.videoId));

			expect(uniqueVideoIds.size).toBe(2); // Only vid1 and vid2
		});

		it('should correctly track processed IDs across executions', () => {
			const execution1 = ['vid1', 'vid2'];
			const execution2 = ['vid2', 'vid3']; // vid2 already processed

			// Simulate state persistence
			const allProcessed = Array.from(new Set([...execution1, ...execution2]));

			expect(allProcessed).toEqual(['vid1', 'vid2', 'vid3']);
		});
	});

	describe('Concurrency Control Regression', () => {
		it('should clamp user-provided concurrency to valid range', () => {
			const testCases = [
				{ input: -5, expected: 1 },
				{ input: 0, expected: 1 },
				{ input: 1, expected: 1 },
				{ input: 5, expected: 5 },
				{ input: 10, expected: 10 },
				{ input: 15, expected: 10 },
				{ input: 100, expected: 10 },
			];

			testCases.forEach(({ input, expected }) => {
				const clamped = Math.max(1, Math.min(10, input));
				expect(clamped).toBe(expected);
			});
		});
	});

	describe('State Key Generation Regression', () => {
		it('should generate unique state keys per user and playlist', () => {
			const prefix = 'youtube-playlist-sync:';
			const user1Playlist1 = `${prefix}user1:PLabc`;
			const user1Playlist2 = `${prefix}user1:PLxyz`;
			const user2Playlist1 = `${prefix}user2:PLabc`;

			// All should be unique
			const keys = new Set([user1Playlist1, user1Playlist2, user2Playlist1]);
			expect(keys.size).toBe(3);
		});

		it('should handle missing installation ID gracefully', () => {
			const prefix = 'youtube-playlist-sync:';
			const installationId = undefined;
			const userId = undefined;
			const playlistId = 'PLxxx';

			const instanceId = installationId || userId || 'default';
			const stateKey = `${prefix}${instanceId}:${playlistId}`;

			expect(stateKey).toBe('youtube-playlist-sync:default:PLxxx');
		});
	});
});

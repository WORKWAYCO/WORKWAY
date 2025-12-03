/**
 * Zoom Integration Tests
 *
 * Tests for the Zoom integration client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Zoom } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Zoom', () => {
	const testConfig = {
		accessToken: 'test-access-token',
	};

	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should throw error if access token is missing', () => {
			expect(() => new Zoom({ accessToken: '' })).toThrow();
		});

		it('should create instance with valid config', () => {
			const client = new Zoom(testConfig);
			expect(client).toBeInstanceOf(Zoom);
		});
	});

	describe('getMeetings', () => {
		it('should fetch meetings successfully', async () => {
			const mockMeetings = {
				meetings: [
					{
						id: 123456789,
						topic: 'Test Meeting',
						start_time: '2024-01-15T10:00:00Z',
						duration: 60,
						host_id: 'host123',
					},
				],
				page_count: 1,
				page_size: 300,
				total_records: 1,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMeetings),
			});

			const client = new Zoom(testConfig);
			const result = await client.getMeetings({ days: 1 });

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data[0].topic).toBe('Test Meeting');
		});

		it('should handle pagination token', async () => {
			const mockMeetings = {
				meetings: [],
				page_count: 1,
				page_size: 300,
				total_records: 0,
				next_page_token: 'next-token',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMeetings),
			});

			const client = new Zoom(testConfig);
			const result = await client.getMeetings({ nextPageToken: 'token123' });

			expect(result.success).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('next_page_token=token123'),
				expect.any(Object)
			);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: () => Promise.resolve({ message: 'Invalid token' }),
			});

			const client = new Zoom(testConfig);
			const result = await client.getMeetings();

			expect(result.success).toBe(false);
		});
	});

	describe('getMeeting', () => {
		it('should fetch a single meeting', async () => {
			const mockMeeting = {
				id: 123456789,
				topic: 'Test Meeting',
				start_time: '2024-01-15T10:00:00Z',
				duration: 60,
				host_id: 'host123',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMeeting),
			});

			const client = new Zoom(testConfig);
			const result = await client.getMeeting({ meetingId: '123456789' });

			expect(result.success).toBe(true);
			expect(result.data.id).toBe(123456789);
		});

		it('should require meeting ID', async () => {
			const client = new Zoom(testConfig);
			const result = await client.getMeeting({ meetingId: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});
	});

	describe('getRecordings', () => {
		it('should fetch recordings for a meeting', async () => {
			const mockRecording = {
				id: 'rec123',
				meeting_id: '123456789',
				recording_start: '2024-01-15T10:00:00Z',
				recording_end: '2024-01-15T11:00:00Z',
				duration: 3600,
				total_size: 1000000,
				recording_count: 1,
				recording_files: [
					{
						id: 'file123',
						meeting_id: '123456789',
						recording_start: '2024-01-15T10:00:00Z',
						recording_end: '2024-01-15T11:00:00Z',
						file_type: 'MP4',
						file_size: 1000000,
						download_url: 'https://zoom.us/download/file123',
						status: 'completed',
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockRecording),
			});

			const client = new Zoom(testConfig);
			const result = await client.getRecordings({ meetingId: '123456789' });

			expect(result.success).toBe(true);
			expect(result.data).not.toBeNull();
			expect(result.data?.recording_files).toHaveLength(1);
		});

		it('should return null for meetings without recordings', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			const client = new Zoom(testConfig);
			const result = await client.getRecordings({ meetingId: '123456789' });

			expect(result.success).toBe(true);
			expect(result.data).toBeNull();
		});
	});

	describe('getTranscript', () => {
		it('should fetch transcript from transcript API', async () => {
			// Mock transcript metadata
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						meeting_id: '123456789',
						meeting_topic: 'Test Meeting',
						download_url: 'https://zoom.us/download/transcript',
					}),
			});

			// Mock transcript download
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () =>
					Promise.resolve(
						'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nJohn: Hello everyone\n\n00:00:05.000 --> 00:00:10.000\nJane: Hi John'
					),
			});

			const client = new Zoom(testConfig);
			const result = await client.getTranscript({ meetingId: '123456789' });

			expect(result.success).toBe(true);
			expect(result.data).not.toBeNull();
			expect(result.data?.transcript_text).toContain('John: Hello everyone');
			expect(result.data?.source).toBe('oauth_api');
			expect(result.data?.speakers).toContain('John');
			expect(result.data?.speakers).toContain('Jane');
		});

		it('should fall back to recordings API', async () => {
			// Mock transcript API returning 404
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
			});

			// Mock recordings API
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 'rec123',
						meeting_id: '123456789',
						recording_start: '2024-01-15T10:00:00Z',
						recording_end: '2024-01-15T11:00:00Z',
						duration: 3600,
						total_size: 1000000,
						recording_count: 1,
						recording_files: [
							{
								id: 'file123',
								meeting_id: '123456789',
								recording_start: '2024-01-15T10:00:00Z',
								recording_end: '2024-01-15T11:00:00Z',
								file_type: 'TRANSCRIPT',
								file_size: 5000,
								download_url: 'https://zoom.us/download/transcript',
								status: 'completed',
							},
						],
					}),
			});

			// Mock transcript download
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () =>
					Promise.resolve('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'),
			});

			const client = new Zoom(testConfig);
			const result = await client.getTranscript({ meetingId: '123456789' });

			expect(result.success).toBe(true);
			expect(result.data).not.toBeNull();
			expect(result.data?.transcript_text).toContain('Hello world');
		});

		it('should return null when no transcript available', async () => {
			// Mock transcript API returning 404
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
			});

			// Mock recordings API returning 404
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
			});

			const client = new Zoom(testConfig);
			const result = await client.getTranscript({ meetingId: '123456789' });

			expect(result.success).toBe(true);
			expect(result.data).toBeNull();
		});
	});

	describe('getClips', () => {
		it('should fetch clips successfully', async () => {
			const mockClips = {
				data: [
					{
						clip_id: 'clip123',
						title: 'Test Clip',
						duration: 120,
						created_date: '2024-01-15T10:00:00Z',
						status: 'completed',
						share_link: 'https://zoom.us/clip/clip123',
						owner_id: 'owner123',
					},
				],
				page_size: 300,
				total_records: 1,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockClips),
			});

			const client = new Zoom(testConfig);
			const result = await client.getClips({ days: 7 });

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data[0].id).toBe('clip123');
			expect(result.data[0].title).toBe('Test Clip');
		});

		it('should handle empty clips response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [],
						page_size: 300,
						total_records: 0,
					}),
			});

			const client = new Zoom(testConfig);
			const result = await client.getClips();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(0);
		});
	});

	describe('getClipTranscript', () => {
		it('should require share URL', async () => {
			const client = new Zoom(testConfig);
			const result = await client.getClipTranscript({ shareUrl: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should require browser scraper URL', async () => {
			const client = new Zoom(testConfig);
			const result = await client.getClipTranscript({
				shareUrl: 'https://zoom.us/clip/clip123',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should fetch transcript from browser scraper', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						transcript: 'John: This is a test clip\nJane: Thanks for sharing',
						segments_count: 2,
					}),
			});

			const client = new Zoom({
				...testConfig,
				browserScraperUrl: 'https://scraper.example.com',
			});
			const result = await client.getClipTranscript({
				shareUrl: 'https://zoom.us/clip/clip123',
			});

			expect(result.success).toBe(true);
			expect(result.data).not.toBeNull();
			expect(result.data?.source).toBe('browser_scraper');
			expect(result.data?.speakers).toContain('John');
		});
	});

	describe('getMeetingsWithTranscripts', () => {
		it('should fetch meetings and their transcripts', async () => {
			// Mock getMeetings
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						meetings: [
							{
								id: 123456789,
								topic: 'Meeting 1',
								start_time: '2024-01-15T10:00:00Z',
								duration: 60,
								host_id: 'host123',
							},
						],
						page_count: 1,
						page_size: 300,
						total_records: 1,
					}),
			});

			// Mock transcript metadata
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						meeting_id: '123456789',
						meeting_topic: 'Meeting 1',
						download_url: 'https://zoom.us/download/transcript',
					}),
			});

			// Mock transcript download
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello'),
			});

			const client = new Zoom(testConfig);
			const result = await client.getMeetingsWithTranscripts({ days: 1 });

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data[0].meeting.topic).toBe('Meeting 1');
			expect(result.data[0].transcript).not.toBeNull();
		});
	});
});

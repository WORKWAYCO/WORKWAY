/**
 * Notion Integration Tests - Fixture-Based Examples
 *
 * Demonstrates using fixtures and test utilities for realistic mock data.
 * These tests validate Notion integration patterns using pre-built fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Notion } from './index.js';
import {
	mockDatabase,
	mockPage,
	mockQueryEmpty,
	mockQueryWithResults,
	mockErrorNotFound,
} from './__fixtures__/responses.js';
import {
	createMockPage,
	createYouTubeVideoPage,
	mockNotionResponse,
	mockNotionError,
	mockQueryResponse,
} from './test-utils.js';

describe('Notion Integration - Fixture-Based Tests', () => {
	let notion: Notion;

	beforeEach(() => {
		notion = new Notion({ accessToken: 'secret_test_token' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('queryDatabase with fixtures', () => {
		it('should handle empty results', async () => {
			// Use pre-built fixture
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionResponse(mockQueryEmpty));

			const result = await notion.queryDatabase({
				databaseId: 'db-123',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual([]);
		});

		it('should handle results with realistic page data', async () => {
			// Use pre-built fixture
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionResponse(mockQueryWithResults));

			const result = await notion.queryDatabase({
				databaseId: 'db-123',
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data?.[0]).toMatchObject(mockPage);
		});

		it('should check for duplicate YouTube video', async () => {
			// Use test utility to create custom response
			const videoPage = createYouTubeVideoPage({
				title: 'Color Correction Tutorial',
				url: 'https://www.youtube.com/watch?v=4zcffN53c_g',
				channel: 'Whitcombe Media',
				published: '2024-01-15',
			});

			vi.spyOn(global, 'fetch').mockResolvedValue(
				mockNotionResponse(
					mockQueryResponse([videoPage]) // Helper creates proper structure
				)
			);

			const result = await notion.queryDatabase({
				databaseId: 'db-youtube',
				filter: {
					property: 'URL',
					url: { equals: 'https://www.youtube.com/watch?v=4zcffN53c_g' },
				},
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data?.[0].properties.URL.url).toBe(
				'https://www.youtube.com/watch?v=4zcffN53c_g'
			);
		});
	});

	describe('createPage with fixtures', () => {
		it('should create YouTube video page', async () => {
			// Use test utility for custom page
			const createdPage = createYouTubeVideoPage({
				title: 'Test Video',
				url: 'https://www.youtube.com/watch?v=test123',
				channel: 'Test Channel',
				published: '2024-01-01',
			});

			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionResponse(createdPage, 201));

			const result = await notion.createPage({
				parentDatabaseId: 'db-youtube',
				properties: {
					Name: { title: [{ text: { content: 'Test Video' } }] },
					URL: { url: 'https://www.youtube.com/watch?v=test123' },
				},
			});

			expect(result.success).toBe(true);
			expect(result.data?.properties.Name.title[0].text.content).toBe('Test Video');
		});
	});

	describe('getDatabase with fixtures', () => {
		it('should retrieve database schema', async () => {
			// Use pre-built database fixture
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionResponse(mockDatabase));

			const result = await notion.getDatabase('db-abc123');

			expect(result.success).toBe(true);
			expect(result.data?.properties).toHaveProperty('Name');
			expect(result.data?.properties).toHaveProperty('URL');
			expect(result.data?.properties).toHaveProperty('Channel');
			expect(result.data?.properties).toHaveProperty('Published');
		});

		it('should handle not found error', async () => {
			// Use pre-built error fixture
			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionError('object_not_found', 'Could not find database with ID: db-invalid', 404));

			const result = await notion.getDatabase('db-invalid');

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Resource not found');
		});
	});

	describe('pagination with fixtures', () => {
		it('should handle paginated results', async () => {
			// First page
			const page1 = createMockPage({ properties: { Name: { title: [{ text: { content: 'Page 1' } }] } } });

			// Use helper to create paginated response
			const firstPageResponse = mockQueryResponse([page1], 'cursor-123', true);

			vi.spyOn(global, 'fetch').mockResolvedValue(mockNotionResponse(firstPageResponse));

			const result = await notion.queryDatabase({
				databaseId: 'db-123',
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data?.[0].properties.Name.title[0].text.content).toBe('Page 1');
		});
	});
});

/**
 * Concurrent Processing Tests
 *
 * Tests for the processConcurrently utility function that enables
 * controlled concurrent processing of YouTube videos.
 */

import { describe, it, expect, vi } from 'vitest';
import { processConcurrently } from './utils.js';

describe('processConcurrently', () => {
	it('should process items concurrently in batches', async () => {
		const items = [1, 2, 3, 4, 5, 6, 7];
		const processOrder: number[] = [];

		const result = await processConcurrently(items, 3, async (item) => {
			processOrder.push(item);
			// Simulate async work
			await new Promise((resolve) => setTimeout(resolve, 10));
			return item * 2;
		});

		expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
		// All items should be processed
		expect(processOrder).toHaveLength(7);
	});

	it('should process with concurrency of 1 (sequential)', async () => {
		const items = [1, 2, 3];
		const processOrder: number[] = [];

		await processConcurrently(items, 1, async (item) => {
			processOrder.push(item);
			await new Promise((resolve) => setTimeout(resolve, 5));
			return item;
		});

		// With concurrency 1, should process sequentially
		expect(processOrder).toEqual([1, 2, 3]);
	});

	it('should handle empty array', async () => {
		const result = await processConcurrently([], 3, async (item) => item);
		expect(result).toEqual([]);
	});

	it('should handle single item', async () => {
		const result = await processConcurrently([42], 3, async (item) => item * 2);
		expect(result).toEqual([84]);
	});

	it('should pass correct index to process function', async () => {
		const items = ['a', 'b', 'c', 'd'];
		const indices: number[] = [];

		await processConcurrently(items, 2, async (item, index) => {
			indices.push(index);
			return item;
		});

		expect(indices).toEqual([0, 1, 2, 3]);
	});

	it('should handle errors in individual items', async () => {
		const items = [1, 2, 3, 4];

		const result = await processConcurrently(items, 2, async (item) => {
			if (item === 3) {
				return { error: 'Failed for item 3' };
			}
			return { success: true, value: item * 2 };
		});

		expect(result).toEqual([
			{ success: true, value: 2 },
			{ success: true, value: 4 },
			{ error: 'Failed for item 3' },
			{ success: true, value: 8 },
		]);
	});

	it('should maintain result order matching input order', async () => {
		const items = [1, 2, 3, 4, 5];

		// Process items with varying delays to test ordering
		const result = await processConcurrently(items, 3, async (item) => {
			// Item 1 takes longest, but should still be first in results
			await new Promise((resolve) => setTimeout(resolve, (6 - item) * 2));
			return item * 10;
		});

		expect(result).toEqual([10, 20, 30, 40, 50]);
	});

	it('should process exactly concurrency items at a time', async () => {
		const items = [1, 2, 3, 4, 5, 6];
		let concurrentCount = 0;
		let maxConcurrent = 0;

		await processConcurrently(items, 2, async (item) => {
			concurrentCount++;
			maxConcurrent = Math.max(maxConcurrent, concurrentCount);

			await new Promise((resolve) => setTimeout(resolve, 20));

			concurrentCount--;
			return item;
		});

		// Should never exceed concurrency limit of 2
		expect(maxConcurrent).toBeLessThanOrEqual(2);
	});

	it('should handle large batches efficiently', async () => {
		const items = Array.from({ length: 100 }, (_, i) => i);

		const startTime = Date.now();
		const result = await processConcurrently(items, 10, async (item) => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return item * 2;
		});
		const duration = Date.now() - startTime;

		expect(result).toHaveLength(100);
		// With concurrency 10, should take ~50ms (100 items / 10 concurrent * 5ms)
		// Allow some overhead, but should be much faster than sequential (500ms)
		expect(duration).toBeLessThan(200);
	});

	it('should work with async functions that return different types', async () => {
		const items = ['video1', 'video2', 'video3'];

		const result = await processConcurrently(items, 2, async (videoId) => {
			return {
				videoId,
				title: `Title for ${videoId}`,
				processed: true,
			};
		});

		expect(result).toEqual([
			{ videoId: 'video1', title: 'Title for video1', processed: true },
			{ videoId: 'video2', title: 'Title for video2', processed: true },
			{ videoId: 'video3', title: 'Title for video3', processed: true },
		]);
	});

	it('should handle concurrency greater than array length', async () => {
		const items = [1, 2];

		const result = await processConcurrently(items, 10, async (item) => item * 2);

		expect(result).toEqual([2, 4]);
	});
});

/**
 * Analytics Engine Tests
 *
 * Focus: Data point structure, error handling, timing.
 * Pruned: Constants verification, trivial factory functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkwayAnalytics, type MetricPoint } from './analytics-engine';

describe('WorkwayAnalytics', () => {
	const mockAnalytics = { writeDataPoint: vi.fn() };
	let analytics: WorkwayAnalytics;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
		analytics = new WorkwayAnalytics(mockAnalytics as unknown as AnalyticsEngineDataset);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('recordMetric blob/double indices', () => {
		it('should write correct blob indices (order matters for queries)', async () => {
			const metric: MetricPoint = {
				tenantId: 'tenant_123',
				workflowId: 'workflow_456',
				operation: 'workflow.trigger',
				durationMs: 150,
				status: 'success',
				metadata: 'extra',
			};

			await analytics.recordMetric(metric);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs).toEqual([
				'tenant_123',    // blob1: tenantId
				'workflow_456',  // blob2: workflowId
				'workflow.trigger', // blob3: operation
				'success',       // blob4: status
				'extra',         // blob5: metadata
			]);
		});

		it('should use empty strings for optional fields', async () => {
			await analytics.recordMetric({
				tenantId: 'tenant_123',
				operation: 'api.health',
				durationMs: 5,
				status: 'success',
			});

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[1]).toBe(''); // workflowId
			expect(call[0].blobs[4]).toBe(''); // metadata
		});

		it('should index by tenantId for efficient per-tenant queries', async () => {
			await analytics.recordMetric({
				tenantId: 'tenant_xyz',
				operation: 'test',
				durationMs: 100,
				status: 'success',
			});

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].indexes).toEqual(['tenant_xyz']);
		});
	});

	describe('recordError', () => {
		it('should capture error message in metadata', async () => {
			const error = new Error('Connection timeout');
			await analytics.recordError('tenant_123', 'api.call', Date.now() - 100, error);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[4]).toBe('Connection timeout');
		});

		it('should truncate long error messages to 100 chars', async () => {
			const longMessage = 'A'.repeat(150);
			const error = new Error(longMessage);
			await analytics.recordError('tenant_123', 'api.call', Date.now() - 100, error);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[4]).toHaveLength(100);
		});

		it('should handle non-Error objects gracefully', async () => {
			await analytics.recordError('tenant_123', 'api.call', Date.now() - 100, 'string error');

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[4]).toBe('');
		});
	});

	describe('timed wrapper', () => {
		it('should record success for successful operation', async () => {
			const result = await analytics.timed('tenant_123', 'op', async () => 'done');

			expect(result).toBe('done');
			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[3]).toBe('success');
		});

		it('should record error and rethrow for failed operation', async () => {
			await expect(
				analytics.timed('tenant_123', 'op', async () => {
					throw new Error('fail');
				})
			).rejects.toThrow('fail');

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[3]).toBe('error');
		});
	});
});

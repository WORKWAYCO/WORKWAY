/**
 * Analytics Engine Tests
 *
 * Tests for Cloudflare Analytics Engine wrapper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	WorkwayAnalytics,
	createAnalytics,
	Operations,
	type MetricPoint,
} from './analytics-engine';

describe('WorkwayAnalytics', () => {
	const mockAnalytics = {
		writeDataPoint: vi.fn(),
	};

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

	describe('recordMetric', () => {
		it('should write data point with correct blob indices', async () => {
			const metric: MetricPoint = {
				tenantId: 'tenant_123',
				workflowId: 'workflow_456',
				operation: 'workflow.trigger',
				durationMs: 150,
				status: 'success',
				tokensUsed: 100,
				statusCode: 200,
				metadata: 'extra info',
			};

			await analytics.recordMetric(metric);

			expect(mockAnalytics.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['tenant_123', 'workflow_456', 'workflow.trigger', 'success', 'extra info'],
				doubles: [150, 100, 200, expect.any(Number)],
				indexes: ['tenant_123'],
			});
		});

		it('should use empty strings for optional fields', async () => {
			const metric: MetricPoint = {
				tenantId: 'tenant_123',
				operation: 'api.health',
				durationMs: 5,
				status: 'success',
			};

			await analytics.recordMetric(metric);

			expect(mockAnalytics.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['tenant_123', '', 'api.health', 'success', ''],
				doubles: [5, 0, 0, expect.any(Number)],
				indexes: ['tenant_123'],
			});
		});

		it('should use 0 for optional numeric fields', async () => {
			const metric: MetricPoint = {
				tenantId: 'tenant_123',
				operation: 'test',
				durationMs: 100,
				status: 'error',
			};

			await analytics.recordMetric(metric);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].doubles[1]).toBe(0); // tokensUsed
			expect(call[0].doubles[2]).toBe(0); // statusCode
		});

		it('should include current timestamp', async () => {
			await analytics.recordMetric({
				tenantId: 'tenant_123',
				operation: 'test',
				durationMs: 100,
				status: 'success',
			});

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].doubles[3]).toBe(Date.now());
		});
	});

	describe('recordSuccess', () => {
		it('should calculate duration from start time', async () => {
			const startTime = Date.now() - 250; // 250ms ago

			await analytics.recordSuccess('tenant_123', 'workflow.execute', startTime);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].doubles[0]).toBe(250); // durationMs
			expect(call[0].blobs[3]).toBe('success');
		});

		it('should include optional fields', async () => {
			const startTime = Date.now() - 100;

			await analytics.recordSuccess('tenant_123', 'ai.generate', startTime, {
				workflowId: 'wf_789',
				tokensUsed: 500,
				statusCode: 200,
			});

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[1]).toBe('wf_789');
			expect(call[0].doubles[1]).toBe(500);
			expect(call[0].doubles[2]).toBe(200);
		});
	});

	describe('recordError', () => {
		it('should record error with duration', async () => {
			const startTime = Date.now() - 500;

			await analytics.recordError('tenant_123', 'workflow.execute', startTime);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].doubles[0]).toBe(500);
			expect(call[0].blobs[3]).toBe('error');
		});

		it('should capture error message in metadata', async () => {
			const startTime = Date.now() - 100;
			const error = new Error('Connection timeout');

			await analytics.recordError('tenant_123', 'api.call', startTime, error);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[4]).toBe('Connection timeout');
		});

		it('should truncate long error messages to 100 chars', async () => {
			const startTime = Date.now() - 100;
			const longMessage = 'A'.repeat(150);
			const error = new Error(longMessage);

			await analytics.recordError('tenant_123', 'api.call', startTime, error);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[4]).toBe('A'.repeat(100));
		});

		it('should handle non-Error objects', async () => {
			const startTime = Date.now() - 100;

			await analytics.recordError('tenant_123', 'api.call', startTime, 'string error');

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[4]).toBe(''); // metadata is undefined for non-Error
		});

		it('should include optional fields', async () => {
			const startTime = Date.now() - 100;

			await analytics.recordError('tenant_123', 'api.call', startTime, undefined, {
				workflowId: 'wf_123',
				statusCode: 500,
			});

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[1]).toBe('wf_123');
			expect(call[0].doubles[2]).toBe(500);
		});
	});

	describe('timed', () => {
		it('should record success for successful operation', async () => {
			const result = await analytics.timed(
				'tenant_123',
				'workflow.execute',
				async () => {
					return { data: 'result' };
				}
			);

			expect(result).toEqual({ data: 'result' });
			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[3]).toBe('success');
		});

		it('should record error and rethrow for failed operation', async () => {
			const error = new Error('Operation failed');

			await expect(
				analytics.timed('tenant_123', 'workflow.execute', async () => {
					throw error;
				})
			).rejects.toThrow('Operation failed');

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[3]).toBe('error');
			expect(call[0].blobs[4]).toBe('Operation failed');
		});

		it('should include workflowId option', async () => {
			await analytics.timed(
				'tenant_123',
				'workflow.execute',
				async () => 'done',
				{ workflowId: 'wf_999' }
			);

			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].blobs[1]).toBe('wf_999');
		});

		it('should measure actual execution time', async () => {
			vi.useRealTimers(); // Need real timers for this test

			const result = await analytics.timed('tenant_123', 'slow.op', async () => {
				await new Promise((r) => setTimeout(r, 50));
				return 'done';
			});

			expect(result).toBe('done');
			const [call] = mockAnalytics.writeDataPoint.mock.calls;
			expect(call[0].doubles[0]).toBeGreaterThanOrEqual(50);
		});
	});
});

describe('Operations', () => {
	it('should have consistent API operations', () => {
		expect(Operations.API_HEALTH).toBe('api.health');
		expect(Operations.API_TRIGGER).toBe('api.trigger');
		expect(Operations.API_AUTH).toBe('api.auth');
	});

	it('should have consistent workflow operations', () => {
		expect(Operations.WORKFLOW_TRIGGER).toBe('workflow.trigger');
		expect(Operations.WORKFLOW_EXECUTE).toBe('workflow.execute');
		expect(Operations.WORKFLOW_COMPLETE).toBe('workflow.complete');
		expect(Operations.WORKFLOW_ERROR).toBe('workflow.error');
	});

	it('should have consistent AI operations', () => {
		expect(Operations.AI_GENERATE).toBe('ai.generate');
		expect(Operations.AI_EMBED).toBe('ai.embed');
	});

	it('should have consistent integration operations', () => {
		expect(Operations.INTEGRATION_CALL).toBe('integration.call');
		expect(Operations.OAUTH_REFRESH).toBe('oauth.refresh');
	});
});

describe('createAnalytics', () => {
	it('should create WorkwayAnalytics instance', () => {
		const mockAnalytics = { writeDataPoint: vi.fn() };
		const instance = createAnalytics(mockAnalytics as unknown as AnalyticsEngineDataset);
		expect(instance).toBeInstanceOf(WorkwayAnalytics);
	});
});

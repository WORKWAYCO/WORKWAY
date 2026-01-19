/**
 * Tracing Tests
 *
 * Tests for distributed tracing utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getTraceId,
	propagateTrace,
	createTraceHeaders,
	createTraceContext,
	createChildSpan,
	createLogger,
	timed,
	createTimer,
	TRACE_ID_HEADER,
} from './tracing';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
	randomUUID: vi.fn(() => 'mock-uuid-1234-5678-90ab-cdef12345678'),
});

describe('TRACE_ID_HEADER', () => {
	it('should be X-Trace-ID', () => {
		expect(TRACE_ID_HEADER).toBe('X-Trace-ID');
	});
});

describe('getTraceId', () => {
	it('should return X-Trace-ID header if present', () => {
		const request = new Request('https://example.com', {
			headers: { 'X-Trace-ID': 'trace-123' },
		});

		const traceId = getTraceId(request);

		expect(traceId).toBe('trace-123');
	});

	it('should fallback to CF-Ray header', () => {
		const request = new Request('https://example.com', {
			headers: { 'CF-Ray': 'ray-abc-123' },
		});

		const traceId = getTraceId(request);

		expect(traceId).toBe('ray-abc-123');
	});

	it('should generate UUID if no headers present', () => {
		const request = new Request('https://example.com');

		const traceId = getTraceId(request);

		expect(traceId).toBe('mock-uuid-1234-5678-90ab-cdef12345678');
	});

	it('should prefer X-Trace-ID over CF-Ray', () => {
		const request = new Request('https://example.com', {
			headers: {
				'X-Trace-ID': 'trace-preferred',
				'CF-Ray': 'ray-fallback',
			},
		});

		const traceId = getTraceId(request);

		expect(traceId).toBe('trace-preferred');
	});
});

describe('propagateTrace', () => {
	it('should copy existing headers and add trace ID', () => {
		const request = new Request('https://example.com', {
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer token',
			},
		});

		const headers = propagateTrace(request, 'trace-xyz');

		expect(headers.get('X-Trace-ID')).toBe('trace-xyz');
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(headers.get('Authorization')).toBe('Bearer token');
	});

	it('should override existing X-Trace-ID', () => {
		const request = new Request('https://example.com', {
			headers: { 'X-Trace-ID': 'old-trace' },
		});

		const headers = propagateTrace(request, 'new-trace');

		expect(headers.get('X-Trace-ID')).toBe('new-trace');
	});
});

describe('createTraceHeaders', () => {
	it('should create headers with only trace ID', () => {
		const headers = createTraceHeaders('trace-123');

		expect(headers.get('X-Trace-ID')).toBe('trace-123');
	});

	it('should include additional headers', () => {
		const headers = createTraceHeaders('trace-123', {
			'Content-Type': 'application/json',
			Authorization: 'Bearer token',
		});

		expect(headers.get('X-Trace-ID')).toBe('trace-123');
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(headers.get('Authorization')).toBe('Bearer token');
	});
});

describe('createTraceContext', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should create context with trace ID from request', () => {
		const request = new Request('https://example.com', {
			headers: { 'X-Trace-ID': 'request-trace-id' },
		});

		const ctx = createTraceContext(request);

		expect(ctx.traceId).toBe('request-trace-id');
		expect(ctx.spanId).toHaveLength(16);
		expect(ctx.parentSpanId).toBeUndefined();
		expect(ctx.startTime).toBe(Date.now());
	});

	it('should generate trace ID without request', () => {
		const ctx = createTraceContext();

		expect(ctx.traceId).toBe('mock-uuid-1234-5678-90ab-cdef12345678');
	});
});

describe('createChildSpan', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should inherit trace ID from parent', () => {
		const parent = {
			traceId: 'parent-trace',
			spanId: 'parent-span-id',
			startTime: Date.now() - 1000,
		};

		const child = createChildSpan(parent);

		expect(child.traceId).toBe('parent-trace');
	});

	it('should set parent span ID', () => {
		const parent = {
			traceId: 'parent-trace',
			spanId: 'parent-span-id',
			startTime: Date.now() - 1000,
		};

		const child = createChildSpan(parent);

		expect(child.parentSpanId).toBe('parent-span-id');
	});

	it('should have new span ID', () => {
		const parent = {
			traceId: 'parent-trace',
			spanId: 'parent-span-id',
			startTime: Date.now() - 1000,
		};

		const child = createChildSpan(parent);

		expect(child.spanId).not.toBe(parent.spanId);
		expect(child.spanId).toHaveLength(16);
	});

	it('should have fresh start time', () => {
		const parent = {
			traceId: 'parent-trace',
			spanId: 'parent-span-id',
			startTime: Date.now() - 5000,
		};

		const child = createChildSpan(parent);

		expect(child.startTime).toBe(Date.now());
		expect(child.startTime).toBeGreaterThan(parent.startTime);
	});
});

describe('createLogger', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		vi.useRealTimers();
	});

	it('should log info level', () => {
		const ctx = { traceId: 'trace-123', spanId: 'span-456', startTime: Date.now() };
		const log = createLogger(ctx);

		log.info('Test message', { key: 'value' });

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(logEntry.level).toBe('info');
		expect(logEntry.message).toBe('Test message');
		expect(logEntry.traceId).toBe('trace-123');
		expect(logEntry.spanId).toBe('span-456');
		expect(logEntry.data).toEqual({ key: 'value' });
	});

	it('should log error with error details', () => {
		const ctx = { traceId: 'trace-123', spanId: 'span-456', startTime: Date.now() };
		const log = createLogger(ctx);
		const error = new Error('Something failed');

		log.error('Operation failed', { code: 'ERR_001' }, error);

		const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(logEntry.level).toBe('error');
		expect(logEntry.error.name).toBe('Error');
		expect(logEntry.error.message).toBe('Something failed');
		expect(logEntry.error.stack).toBeDefined();
	});

	it('should log debug level', () => {
		const ctx = { traceId: 'trace-123', spanId: 'span-456', startTime: Date.now() };
		const log = createLogger(ctx);

		log.debug('Debug info');

		const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(logEntry.level).toBe('debug');
	});

	it('should log warn level', () => {
		const ctx = { traceId: 'trace-123', spanId: 'span-456', startTime: Date.now() };
		const log = createLogger(ctx);

		log.warn('Warning message');

		const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(logEntry.level).toBe('warn');
	});

	it('should include ISO timestamp', () => {
		const ctx = { traceId: 'trace-123', spanId: 'span-456', startTime: Date.now() };
		const log = createLogger(ctx);

		log.info('Test');

		const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(logEntry.timestamp).toBe('2024-01-15T12:00:00.000Z');
	});
});

describe('timed', () => {
	it('should return result and duration', async () => {
		const { result, durationMs } = await timed(async () => {
			await new Promise((r) => setTimeout(r, 10));
			return 'success';
		});

		expect(result).toBe('success');
		expect(durationMs).toBeGreaterThanOrEqual(10);
	});

	it('should propagate errors', async () => {
		await expect(
			timed(async () => {
				throw new Error('Test error');
			})
		).rejects.toThrow('Test error');
	});
});

describe('createTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should track marks with elapsed time', () => {
		const timer = createTimer();

		vi.advanceTimersByTime(100);
		timer.mark('step1');

		vi.advanceTimersByTime(200);
		timer.mark('step2');

		const marks = timer.getMarks();

		expect(marks.step1).toBe(100);
		expect(marks.step2).toBe(300);
	});

	it('should return elapsed time', () => {
		const timer = createTimer();

		vi.advanceTimersByTime(500);

		expect(timer.elapsed()).toBe(500);
	});

	it('should return copy of marks', () => {
		const timer = createTimer();
		timer.mark('test');

		const marks1 = timer.getMarks();
		const marks2 = timer.getMarks();

		expect(marks1).toEqual(marks2);
		expect(marks1).not.toBe(marks2); // Different object references
	});

	it('should allow overwriting marks', () => {
		const timer = createTimer();

		vi.advanceTimersByTime(100);
		timer.mark('checkpoint');

		vi.advanceTimersByTime(100);
		timer.mark('checkpoint');

		expect(timer.getMarks().checkpoint).toBe(200);
	});
});

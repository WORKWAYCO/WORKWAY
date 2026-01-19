/**
 * Tracing Tests
 *
 * Focus: Trace ID priority, header propagation.
 * Pruned: Logger levels, timer marks, trivial utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import { getTraceId, propagateTrace, createChildSpan } from './tracing';

vi.stubGlobal('crypto', {
	randomUUID: vi.fn(() => 'generated-uuid'),
});

describe('getTraceId priority', () => {
	it('should prefer X-Trace-ID header (explicit propagation)', () => {
		const request = new Request('https://example.com', {
			headers: {
				'X-Trace-ID': 'explicit-trace',
				'CF-Ray': 'cloudflare-ray',
			},
		});

		expect(getTraceId(request)).toBe('explicit-trace');
	});

	it('should fallback to CF-Ray header (Cloudflare request ID)', () => {
		const request = new Request('https://example.com', {
			headers: { 'CF-Ray': 'cloudflare-ray' },
		});

		expect(getTraceId(request)).toBe('cloudflare-ray');
	});

	it('should generate UUID when no trace headers present', () => {
		const request = new Request('https://example.com');

		expect(getTraceId(request)).toBe('generated-uuid');
	});
});

describe('propagateTrace', () => {
	it('should preserve existing headers while adding trace ID', () => {
		const request = new Request('https://example.com', {
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer token',
			},
		});

		const headers = propagateTrace(request, 'new-trace');

		expect(headers.get('X-Trace-ID')).toBe('new-trace');
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

describe('createChildSpan', () => {
	it('should inherit traceId but create new spanId', () => {
		const parent = {
			traceId: 'parent-trace',
			spanId: 'parent-span',
			startTime: Date.now() - 1000,
		};

		const child = createChildSpan(parent);

		expect(child.traceId).toBe('parent-trace');
		expect(child.spanId).not.toBe('parent-span');
		expect(child.parentSpanId).toBe('parent-span');
	});
});

/**
 * Tracing Module
 *
 * Utilities for distributed tracing across Cloudflare Workers.
 * Trace IDs are propagated via X-Trace-ID header.
 *
 * @example
 * ```typescript
 * // In your worker
 * const traceId = getTraceId(request);
 *
 * // When calling another service
 * const response = await fetch(url, {
 *   headers: propagateTrace(request, traceId),
 * });
 *
 * // Log with trace context
 * console.log(`[${traceId}] Processing request...`);
 * ```
 */

// =============================================================================
// TRACE ID MANAGEMENT
// =============================================================================

/**
 * Header name for trace ID propagation
 */
export const TRACE_ID_HEADER = 'X-Trace-ID';

/**
 * Get trace ID from request, or generate a new one
 *
 * Checks multiple sources in order:
 * 1. X-Trace-ID header (explicit propagation)
 * 2. CF-Ray header (Cloudflare request ID)
 * 3. Generate new UUID
 *
 * @example
 * ```typescript
 * export default {
 *   async fetch(request: Request) {
 *     const traceId = getTraceId(request);
 *     console.log(`[${traceId}] Request received`);
 *     // ...
 *   }
 * }
 * ```
 */
export function getTraceId(request: Request): string {
	return (
		request.headers.get(TRACE_ID_HEADER) ??
		request.headers.get('CF-Ray') ??
		crypto.randomUUID()
	);
}

/**
 * Create headers with trace ID for propagation
 *
 * Use when making requests to other services to maintain
 * trace correlation across the request chain.
 *
 * @example
 * ```typescript
 * const traceId = getTraceId(request);
 *
 * // Call another service with trace propagation
 * const response = await fetch('https://api.example.com/data', {
 *   headers: propagateTrace(request, traceId),
 * });
 * ```
 */
export function propagateTrace(request: Request, traceId: string): Headers {
	const headers = new Headers(request.headers);
	headers.set(TRACE_ID_HEADER, traceId);
	return headers;
}

/**
 * Create new headers with only the trace ID
 *
 * Use when you don't want to copy all headers from the original request.
 *
 * @example
 * ```typescript
 * const response = await fetch(url, {
 *   headers: createTraceHeaders(traceId),
 * });
 * ```
 */
export function createTraceHeaders(
	traceId: string,
	additionalHeaders?: Record<string, string>
): Headers {
	const headers = new Headers(additionalHeaders);
	headers.set(TRACE_ID_HEADER, traceId);
	return headers;
}

// =============================================================================
// TRACE CONTEXT
// =============================================================================

/**
 * Trace context for passing through async operations
 */
export interface TraceContext {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	startTime: number;
}

/**
 * Create a new trace context
 *
 * @example
 * ```typescript
 * const ctx = createTraceContext(request);
 * console.log(`[${ctx.traceId}] Starting operation`);
 * ```
 */
export function createTraceContext(request?: Request): TraceContext {
	return {
		traceId: request ? getTraceId(request) : crypto.randomUUID(),
		spanId: crypto.randomUUID().slice(0, 16),
		startTime: Date.now(),
	};
}

/**
 * Create a child span within a trace
 *
 * @example
 * ```typescript
 * const parentCtx = createTraceContext(request);
 *
 * // Create child span for database query
 * const dbCtx = createChildSpan(parentCtx);
 * await queryDatabase();
 * console.log(`[${dbCtx.traceId}] DB query took ${Date.now() - dbCtx.startTime}ms`);
 * ```
 */
export function createChildSpan(parent: TraceContext): TraceContext {
	return {
		traceId: parent.traceId,
		spanId: crypto.randomUUID().slice(0, 16),
		parentSpanId: parent.spanId,
		startTime: Date.now(),
	};
}

// =============================================================================
// STRUCTURED LOGGING
// =============================================================================

/**
 * Log levels for structured logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	traceId: string;
	spanId?: string;
	message: string;
	data?: Record<string, unknown>;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
}

/**
 * Create a logger with trace context
 *
 * @example
 * ```typescript
 * const log = createLogger(ctx);
 *
 * log.info('Processing request', { path: url.pathname });
 * log.error('Operation failed', { code: 'TIMEOUT' }, error);
 * ```
 */
export function createLogger(ctx: TraceContext) {
	const log = (
		level: LogLevel,
		message: string,
		data?: Record<string, unknown>,
		error?: Error
	): void => {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			traceId: ctx.traceId,
			spanId: ctx.spanId,
			message,
			data,
		};

		if (error) {
			entry.error = {
				name: error.name,
				message: error.message,
				stack: error.stack,
			};
		}

		// Output as JSON for tail worker processing
		console.log(JSON.stringify(entry));
	};

	return {
		debug: (message: string, data?: Record<string, unknown>) =>
			log('debug', message, data),
		info: (message: string, data?: Record<string, unknown>) =>
			log('info', message, data),
		warn: (message: string, data?: Record<string, unknown>) =>
			log('warn', message, data),
		error: (message: string, data?: Record<string, unknown>, error?: Error) =>
			log('error', message, data, error),
	};
}

// =============================================================================
// TIMING UTILITIES
// =============================================================================

/**
 * Measure execution time of an async operation
 *
 * @example
 * ```typescript
 * const { result, durationMs } = await timed(() => fetchData());
 * log.info('Fetch completed', { durationMs });
 * ```
 */
export async function timed<T>(
	fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
	const start = Date.now();
	const result = await fn();
	return { result, durationMs: Date.now() - start };
}

/**
 * Create a timing wrapper for multiple operations
 *
 * @example
 * ```typescript
 * const timer = createTimer();
 *
 * await doStep1();
 * timer.mark('step1');
 *
 * await doStep2();
 * timer.mark('step2');
 *
 * console.log(timer.getMarks());
 * // { step1: 150, step2: 320 }
 * ```
 */
export function createTimer() {
	const start = Date.now();
	const marks: Record<string, number> = {};

	return {
		mark(name: string): void {
			marks[name] = Date.now() - start;
		},
		getMarks(): Record<string, number> {
			return { ...marks };
		},
		elapsed(): number {
			return Date.now() - start;
		},
	};
}

export default {
	getTraceId,
	propagateTrace,
	createTraceHeaders,
	createTraceContext,
	createChildSpan,
	createLogger,
	timed,
	createTimer,
	TRACE_ID_HEADER,
};

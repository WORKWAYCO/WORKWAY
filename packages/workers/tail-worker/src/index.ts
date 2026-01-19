/**
 * WORKWAY Tail Worker
 *
 * Receives trace events from other workers for distributed tracing
 * and log aggregation. Processes events non-blockingly after the
 * original worker has responded.
 *
 * Features:
 * - Structured log processing
 * - Error tracking and alerting
 * - Trace ID correlation
 * - Performance monitoring
 *
 * @see https://developers.cloudflare.com/workers/observability/tail-workers/
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Env {
	ENVIRONMENT: string;
	LOG_LEVEL: string;
	// Optional: KV for trace storage
	TRACES?: KVNamespace;
}

/**
 * Tail event from Cloudflare
 */
interface TailEvent {
	/** Script that generated this event */
	scriptName: string;
	/** Outcome of the request */
	outcome: 'ok' | 'exception' | 'exceededCpu' | 'exceededMemory' | 'unknown';
	/** Timestamp when event was generated */
	eventTimestamp: number;
	/** Console logs from the worker */
	logs: TailLog[];
	/** Exceptions thrown */
	exceptions: TailException[];
	/** Event type (always 'trace') */
	event: {
		request?: TailRequest;
		response?: TailResponse;
	} | null;
}

interface TailLog {
	message: unknown[];
	level: 'debug' | 'info' | 'log' | 'warn' | 'error';
	timestamp: number;
}

interface TailException {
	name: string;
	message: string;
	timestamp: number;
}

interface TailRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	cf?: Record<string, unknown>;
}

interface TailResponse {
	status: number;
}

/**
 * Structured trace for output
 */
interface StructuredTrace {
	timestamp: string;
	traceId: string;
	worker: string;
	outcome: string;
	durationMs?: number;
	request?: {
		method: string;
		path: string;
		status?: number;
	};
	logs: Array<{
		level: string;
		message: string;
		timestamp: string;
	}>;
	errors: Array<{
		name: string;
		message: string;
		timestamp: string;
	}>;
	metadata: {
		environment: string;
		region?: string;
	};
}

// =============================================================================
// LOG LEVEL FILTERING
// =============================================================================

const LOG_LEVELS = {
	debug: 0,
	info: 1,
	log: 1,
	warn: 2,
	error: 3,
} as const;

function shouldLog(
	messageLevel: keyof typeof LOG_LEVELS,
	configLevel: string
): boolean {
	const configNumeric = LOG_LEVELS[configLevel as keyof typeof LOG_LEVELS] ?? 1;
	const messageNumeric = LOG_LEVELS[messageLevel] ?? 1;
	return messageNumeric >= configNumeric;
}

// =============================================================================
// TRACE PROCESSING
// =============================================================================

/**
 * Extract trace ID from request headers or generate one
 */
function extractTraceId(event: TailEvent): string {
	const headers = event.event?.request?.headers ?? {};
	return headers['x-trace-id'] ?? headers['cf-ray'] ?? crypto.randomUUID();
}

/**
 * Format log messages as strings
 */
function formatLogMessage(message: unknown[]): string {
	return message
		.map((part) => {
			if (typeof part === 'string') return part;
			if (part === null) return 'null';
			if (part === undefined) return 'undefined';
			try {
				return JSON.stringify(part);
			} catch {
				return String(part);
			}
		})
		.join(' ');
}

/**
 * Process a tail event into a structured trace
 */
function processEvent(event: TailEvent, env: Env): StructuredTrace {
	const traceId = extractTraceId(event);
	const timestamp = new Date(event.eventTimestamp).toISOString();

	// Parse request info
	let request: StructuredTrace['request'];
	if (event.event?.request) {
		const url = new URL(event.event.request.url);
		request = {
			method: event.event.request.method,
			path: url.pathname,
			status: event.event.response?.status,
		};
	}

	// Filter and format logs
	const logs = event.logs
		.filter((log) => shouldLog(log.level, env.LOG_LEVEL))
		.map((log) => ({
			level: log.level,
			message: formatLogMessage(log.message),
			timestamp: new Date(log.timestamp).toISOString(),
		}));

	// Format errors
	const errors = event.exceptions.map((ex) => ({
		name: ex.name,
		message: ex.message,
		timestamp: new Date(ex.timestamp).toISOString(),
	}));

	return {
		timestamp,
		traceId,
		worker: event.scriptName,
		outcome: event.outcome,
		request,
		logs,
		errors,
		metadata: {
			environment: env.ENVIRONMENT,
			region: (event.event?.request?.cf as Record<string, unknown>)?.colo as string,
		},
	};
}

/**
 * Output trace (can be extended to send to external services)
 */
function outputTrace(trace: StructuredTrace): void {
	// For now, output to console (visible in Cloudflare dashboard)
	// In production, you might send to:
	// - Datadog
	// - Grafana Cloud
	// - Custom logging endpoint

	// Compact format for normal traces
	if (trace.errors.length === 0 && trace.outcome === 'ok') {
		console.log(
			JSON.stringify({
				t: trace.timestamp,
				id: trace.traceId,
				w: trace.worker,
				r: trace.request
					? `${trace.request.method} ${trace.request.path} ${trace.request.status}`
					: undefined,
			})
		);
		return;
	}

	// Full format for errors
	console.log(JSON.stringify(trace, null, 2));
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default {
	/**
	 * Tail handler - receives events from other workers
	 */
	async tail(events: TailEvent[], env: Env): Promise<void> {
		for (const event of events) {
			try {
				const trace = processEvent(event, env);
				outputTrace(trace);

				// Optional: Store traces in KV for debugging
				if (env.TRACES && trace.errors.length > 0) {
					await env.TRACES.put(
						`error:${trace.traceId}`,
						JSON.stringify(trace),
						{ expirationTtl: 86400 } // 24 hours
					);
				}
			} catch (error) {
				// Don't let processing errors break the tail worker
				console.error('Tail processing error:', error);
			}
		}
	},

	/**
	 * Fetch handler - for health checks and debugging
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/health') {
			return new Response(
				JSON.stringify({
					status: 'healthy',
					worker: 'tail-worker',
					environment: env.ENVIRONMENT,
					logLevel: env.LOG_LEVEL,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		return new Response('WORKWAY Tail Worker - Distributed Tracing', {
			status: 200,
		});
	},
};

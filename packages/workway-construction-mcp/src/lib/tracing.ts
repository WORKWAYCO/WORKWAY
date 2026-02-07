/**
 * Distributed Tracing for MCP Server
 * 
 * Provides trace context propagation and custom spans for observability.
 * Supports W3C Trace Context standard and OpenTelemetry export format.
 * 
 * Features:
 * - 128-bit trace IDs and 64-bit span IDs
 * - W3C Trace Context header parsing (traceparent)
 * - Configurable sampling rate
 * - OTLP-compatible export format
 * - Langfuse integration support
 */

// ============================================================================
// Types
// ============================================================================

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface SpanContext {
  end: (status?: 'ok' | 'error') => void;
  setAttributes: (attrs: Record<string, string | number | boolean>) => void;
  addEvent: (name: string, attributes?: Record<string, string | number | boolean>) => void;
  spanId: string;
  traceId: string;
}

export interface TracerConfig {
  serviceName?: string;
  samplingRate?: number; // 0.0 to 1.0
  environment?: string;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate trace ID (128-bit hex, 32 characters)
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate span ID (64-bit hex, 16 characters)
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// W3C Trace Context
// ============================================================================

/**
 * Parse W3C Trace Context header (traceparent)
 * Format: 00-{trace-id}-{parent-id}-{flags}
 * 
 * @see https://www.w3.org/TR/trace-context/
 */
export function parseTraceParent(header: string | null): TraceContext | null {
  if (!header) return null;
  
  const parts = header.split('-');
  if (parts.length !== 4) return null;
  
  const [version, traceId, parentSpanId, flags] = parts;
  
  // Only support version 00
  if (version !== '00') return null;
  
  // Validate trace ID (32 hex chars, not all zeros)
  if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === '00000000000000000000000000000000') {
    return null;
  }
  
  // Validate parent span ID (16 hex chars, not all zeros)
  if (!/^[0-9a-f]{16}$/.test(parentSpanId) || parentSpanId === '0000000000000000') {
    return null;
  }
  
  // Parse flags (sampled = bit 0)
  const flagsNum = parseInt(flags, 16);
  if (isNaN(flagsNum)) return null;
  
  return {
    traceId,
    spanId: generateSpanId(),
    parentSpanId,
    sampled: (flagsNum & 0x01) === 0x01,
  };
}

/**
 * Create W3C traceparent header
 */
export function createTraceParent(ctx: TraceContext): string {
  const flags = ctx.sampled ? '01' : '00';
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Create W3C tracestate header (for additional vendor-specific data)
 */
export function createTraceState(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

// ============================================================================
// Tracer Class
// ============================================================================

/**
 * Tracer for creating and managing distributed trace spans
 */
export class Tracer {
  private spans: Span[] = [];
  private context: TraceContext;
  private config: Required<TracerConfig>;
  private currentSpanId: string;
  
  constructor(request?: Request, config: TracerConfig = {}) {
    this.config = {
      serviceName: config.serviceName || 'workway-construction-mcp',
      samplingRate: config.samplingRate ?? 0.1, // 10% default sampling
      environment: config.environment || 'development',
    };
    
    // Parse incoming trace context or create new one
    const traceparent = request?.headers.get('traceparent') ?? null;
    const parsed = parseTraceParent(traceparent);
    
    if (parsed) {
      this.context = parsed;
    } else {
      // New trace - apply sampling decision
      const sampled = Math.random() < this.config.samplingRate;
      this.context = {
        traceId: generateTraceId(),
        spanId: generateSpanId(),
        sampled,
      };
    }
    
    this.currentSpanId = this.context.spanId;
  }
  
  /**
   * Get the trace ID for logging and correlation
   */
  get traceId(): string {
    return this.context.traceId;
  }
  
  /**
   * Get the current span ID
   */
  get spanId(): string {
    return this.currentSpanId;
  }
  
  /**
   * Check if this trace is being sampled
   */
  get isSampled(): boolean {
    return this.context.sampled;
  }
  
  /**
   * Get the traceparent header value for propagation
   */
  get traceparent(): string {
    return createTraceParent({
      ...this.context,
      spanId: this.currentSpanId,
    });
  }
  
  /**
   * Start a new span
   */
  startSpan(
    name: string,
    attributes: Record<string, string | number | boolean> = {}
  ): SpanContext {
    const spanId = generateSpanId();
    const parentSpanId = this.currentSpanId;
    
    const span: Span = {
      name,
      traceId: this.context.traceId,
      spanId,
      parentSpanId,
      startTime: Date.now(),
      status: 'unset',
      attributes: {
        'service.name': this.config.serviceName,
        'deployment.environment': this.config.environment,
        ...attributes,
      },
      events: [],
    };
    
    this.spans.push(span);
    
    // Update current span for child spans
    const previousSpanId = this.currentSpanId;
    this.currentSpanId = spanId;
    
    return {
      spanId,
      traceId: this.context.traceId,
      
      end: (status: 'ok' | 'error' = 'ok') => {
        span.endTime = Date.now();
        span.status = status;
        // Restore parent span as current
        this.currentSpanId = previousSpanId;
      },
      
      setAttributes: (attrs: Record<string, string | number | boolean>) => {
        Object.assign(span.attributes, attrs);
      },
      
      addEvent: (eventName: string, eventAttrs?: Record<string, string | number | boolean>) => {
        span.events.push({
          name: eventName,
          timestamp: Date.now(),
          attributes: eventAttrs,
        });
      },
    };
  }
  
  /**
   * Wrap an async function with a span
   */
  async withSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean>,
    fn: (span: SpanContext) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    try {
      const result = await fn(span);
      span.end('ok');
      return result;
    } catch (error) {
      const errorType = error instanceof Error ? error.constructor.name : 'Error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      span.setAttributes({
        'error.type': errorType,
        'error.message': errorMessage,
      });
      span.addEvent('exception', {
        'exception.type': errorType,
        'exception.message': errorMessage,
      });
      span.end('error');
      throw error;
    }
  }
  
  /**
   * Get all completed spans for export
   */
  getSpans(): Span[] {
    return this.spans;
  }
  
  /**
   * Export spans to OpenTelemetry Protocol (OTLP) format
   */
  toOTLP(): OTLPExportData {
    return {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'deployment.environment', value: { stringValue: this.config.environment } },
            { key: 'telemetry.sdk.name', value: { stringValue: 'workway-tracing' } },
            { key: 'telemetry.sdk.version', value: { stringValue: '1.0.0' } },
          ],
        },
        scopeSpans: [{
          scope: {
            name: 'workway-mcp-tracer',
            version: '1.0.0',
          },
          spans: this.spans.map(span => this.spanToOTLP(span)),
        }],
      }],
    };
  }
  
  /**
   * Convert a span to OTLP format
   */
  private spanToOTLP(span: Span): OTLPSpan {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: 1, // SPAN_KIND_INTERNAL
      startTimeUnixNano: BigInt(span.startTime * 1_000_000).toString(),
      endTimeUnixNano: BigInt((span.endTime || Date.now()) * 1_000_000).toString(),
      status: {
        code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
        message: span.status === 'error' 
          ? (span.attributes['error.message'] as string || 'Unknown error')
          : undefined,
      },
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: this.valueToOTLP(value),
      })),
      events: span.events.map(event => ({
        name: event.name,
        timeUnixNano: BigInt(event.timestamp * 1_000_000).toString(),
        attributes: event.attributes 
          ? Object.entries(event.attributes).map(([key, value]) => ({
              key,
              value: this.valueToOTLP(value),
            }))
          : [],
      })),
    };
  }
  
  /**
   * Convert a value to OTLP attribute value format
   */
  private valueToOTLP(value: string | number | boolean): OTLPValue {
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) 
        ? { intValue: value.toString() }
        : { doubleValue: value };
    }
    return { boolValue: value };
  }
}

// ============================================================================
// OTLP Types
// ============================================================================

export interface OTLPExportData {
  resourceSpans: OTLPResourceSpan[];
}

interface OTLPResourceSpan {
  resource: {
    attributes: OTLPAttribute[];
  };
  scopeSpans: OTLPScopeSpan[];
}

interface OTLPScopeSpan {
  scope: {
    name: string;
    version: string;
  };
  spans: OTLPSpan[];
}

interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  status: {
    code: number;
    message?: string;
  };
  attributes: OTLPAttribute[];
  events: OTLPEvent[];
}

interface OTLPAttribute {
  key: string;
  value: OTLPValue;
}

interface OTLPValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
}

interface OTLPEvent {
  name: string;
  timeUnixNano: string;
  attributes: OTLPAttribute[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a child tracer that inherits the parent context
 */
export function createChildTracer(parentTracer: Tracer, config?: TracerConfig): Tracer {
  // Create a fake request with the parent's traceparent
  const headers = new Headers();
  headers.set('traceparent', parentTracer.traceparent);
  const fakeRequest = new Request('https://internal/', { headers });
  return new Tracer(fakeRequest, config);
}

/**
 * OpenTelemetry Exporter
 * 
 * Exports traces to external observability platforms.
 * Supports:
 * - Generic OTLP/HTTP endpoint
 * - Langfuse (AI observability platform)
 * - Cloudflare Logpush (future)
 */

import type { Span, OTLPExportData } from './tracing';

// ============================================================================
// Types
// ============================================================================

export interface ExporterConfig {
  /** OTLP HTTP endpoint URL */
  endpoint?: string;
  /** Authorization header value (e.g., "Bearer token") */
  authorization?: string;
  /** Custom headers for the export request */
  headers?: Record<string, string>;
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
}

export interface LangfuseConfig {
  /** Langfuse host URL (default: https://cloud.langfuse.com) */
  host: string;
  /** Langfuse public key */
  publicKey: string;
  /** Langfuse secret key */
  secretKey: string;
}

export interface ExportResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  exportedSpanCount?: number;
}

// ============================================================================
// OTLP Exporter
// ============================================================================

/**
 * Export spans to an OpenTelemetry Protocol (OTLP) HTTP endpoint
 * 
 * @example
 * // Export to generic OTLP endpoint
 * await exportSpans('https://otel-collector.example.com/v1/traces', otlpData);
 * 
 * // Export to Grafana Cloud
 * await exportSpans('https://otlp-gateway-prod.grafana.net/otlp/v1/traces', otlpData, {
 *   authorization: 'Basic <base64-credentials>'
 * });
 */
export async function exportSpans(
  endpoint: string,
  otlpData: OTLPExportData,
  config: ExporterConfig = {}
): Promise<ExportResult> {
  const timeout = config.timeout || 5000;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    
    if (config.authorization) {
      headers['Authorization'] = config.authorization;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(otlpData),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const spanCount = otlpData.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.length || 0;
    
    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        exportedSpanCount: spanCount,
      };
    }
    
    const errorText = await response.text().catch(() => 'Unknown error');
    return {
      success: false,
      statusCode: response.status,
      error: `Export failed: ${response.status} ${errorText}`,
      exportedSpanCount: 0,
    };
  } catch (error) {
    // Don't fail the request if export fails - tracing is observability, not critical path
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Tracing] Failed to export spans:', message);
    
    return {
      success: false,
      error: message,
      exportedSpanCount: 0,
    };
  }
}

// ============================================================================
// Langfuse Exporter
// ============================================================================

/**
 * Export spans to Langfuse for AI observability
 * 
 * Langfuse provides specialized observability for LLM applications with features like:
 * - Token usage tracking
 * - Cost analysis
 * - Prompt versioning
 * - Evaluation metrics
 * 
 * @see https://langfuse.com/docs/integrations/opentelemetry
 */
export async function exportToLangfuse(
  config: LangfuseConfig,
  spans: Span[]
): Promise<ExportResult> {
  if (spans.length === 0) {
    return { success: true, exportedSpanCount: 0 };
  }
  
  try {
    // Group spans by trace ID
    const traceId = spans[0].traceId;
    
    // Convert spans to Langfuse observation format
    const observations = spans.map(span => ({
      id: span.spanId,
      traceId: traceId,
      parentObservationId: span.parentSpanId,
      type: 'span' as const,
      name: span.name,
      startTime: new Date(span.startTime).toISOString(),
      endTime: span.endTime ? new Date(span.endTime).toISOString() : undefined,
      metadata: span.attributes,
      level: span.status === 'error' ? 'ERROR' : 'DEFAULT',
      statusMessage: span.status === 'error' 
        ? (span.attributes['error.message'] as string || undefined)
        : undefined,
    }));
    
    // Create the trace and observations in a single batch
    const batch = [
      {
        type: 'trace-create',
        body: {
          id: traceId,
          name: 'mcp-request',
          timestamp: new Date(spans[0].startTime).toISOString(),
          metadata: {
            service: spans[0].attributes['service.name'],
            environment: spans[0].attributes['deployment.environment'],
          },
        },
      },
      ...observations.map(obs => ({
        type: 'observation-create',
        body: obs,
      })),
    ];
    
    // Send to Langfuse ingestion API
    const credentials = btoa(`${config.publicKey}:${config.secretKey}`);
    
    const response = await fetch(`${config.host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({ batch }),
    });
    
    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        exportedSpanCount: spans.length,
      };
    }
    
    const errorText = await response.text().catch(() => 'Unknown error');
    return {
      success: false,
      statusCode: response.status,
      error: `Langfuse export failed: ${response.status} ${errorText}`,
      exportedSpanCount: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Tracing] Failed to export to Langfuse:', message);
    
    return {
      success: false,
      error: message,
      exportedSpanCount: 0,
    };
  }
}

// ============================================================================
// Batch Exporter
// ============================================================================

/**
 * Export spans to multiple destinations
 */
export async function exportToAll(
  spans: Span[],
  otlpData: OTLPExportData,
  options: {
    otlpEndpoint?: string;
    otlpConfig?: ExporterConfig;
    langfuseConfig?: LangfuseConfig;
  }
): Promise<Record<string, ExportResult>> {
  const results: Record<string, ExportResult> = {};
  
  // Export to OTLP endpoint if configured
  if (options.otlpEndpoint) {
    results.otlp = await exportSpans(
      options.otlpEndpoint,
      otlpData,
      options.otlpConfig
    );
  }
  
  // Export to Langfuse if configured
  if (options.langfuseConfig?.host && options.langfuseConfig?.publicKey) {
    results.langfuse = await exportToLangfuse(options.langfuseConfig, spans);
  }
  
  return results;
}

// ============================================================================
// Console Exporter (for development)
// ============================================================================

/**
 * Log spans to console in a readable format (for development/debugging)
 */
export function logSpansToConsole(spans: Span[]): void {
  if (spans.length === 0) {
    console.log('[Tracing] No spans to log');
    return;
  }
  
  console.log(`[Tracing] Trace ID: ${spans[0].traceId}`);
  console.log(`[Tracing] Total spans: ${spans.length}`);
  
  for (const span of spans) {
    const duration = span.endTime ? span.endTime - span.startTime : 'ongoing';
    const status = span.status === 'error' ? '❌' : span.status === 'ok' ? '✅' : '⏳';
    
    console.log(`  ${status} ${span.name} (${duration}ms)`);
    
    if (span.status === 'error' && span.attributes['error.message']) {
      console.log(`     Error: ${span.attributes['error.message']}`);
    }
  }
}

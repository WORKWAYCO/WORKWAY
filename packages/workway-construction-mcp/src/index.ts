/**
 * WORKWAY Construction MCP Server
 * 
 * The Automation Layer - AI-native workflow automation for construction.
 * 
 * Built on @workway/mcp-core with construction-specific:
 * - Procore OAuth integration
 * - Construction workflow tools (RFIs, daily logs, submittals)
 * - Webhook handling
 * - Rate limiting (Procore: 3600 req/min)
 * - Audit logging for security compliance
 * - Distributed tracing with OpenTelemetry export
 */

import { Hono } from 'hono';
import { createMCPServer, type MCPEnv } from '@workway/mcp-core';
import { allTools, toolCategories } from './tools';
import { listResources, fetchResource } from './resources';
import { encrypt, decrypt } from './lib/crypto';
import { 
  ALLOWED_ORIGINS, 
  OAUTH_CALLBACK_URL, 
  MCP_BASE_URL,
  getProcoreUrls,
  type ProcoreEnvironment,
} from './lib/config';
import { logOAuthCallback } from './lib/audit-logger';
import { 
  Tracer, 
  type TracerConfig,
} from './lib/tracing';
import { 
  exportSpans, 
  exportToLangfuse, 
  logSpansToConsole,
} from './lib/otel-exporter';
import type { Env } from './types';
import observability from './routes/observability';

// Re-export Durable Objects
export { ProcoreRateLimiter } from './durable-objects/rate-limiter';

// ============================================================================
// Create MCP Server with Construction Tools
// ============================================================================

// WORKWAY icon: black rounded square with white "W" construction mark
const WORKWAY_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI2IiBmaWxsPSIjMDAwMDAwIi8+CiAgPHBhdGggZD0iTTYgMTBMMTAgMjJMMTYgMTRMMjIgMjJMMjYgMTAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K';

const mcpServer = createMCPServer<Env>({
  name: 'workway-construction-mcp',
  version: '0.1.0',
  description: 'The Automation Layer - AI-native workflow automation for construction',
  icon: WORKWAY_ICON,
  baseUrl: MCP_BASE_URL,
  allowedOrigins: ALLOWED_ORIGINS,
  capabilities: {
    tools: { listChanged: true },
    resources: { subscribe: false, listChanged: true },
    prompts: { listChanged: false },
  },
  tools: allTools,
  resources: {
    list: listResources,
    fetch: fetchResource,
  },
});

// ============================================================================
// Construction-Specific Routes
// ============================================================================

// Custom type for Hono context with tracing
type Variables = {
  tracer: Tracer;
  traceId: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// Distributed Tracing Middleware
// ============================================================================

/**
 * Tracing middleware - adds distributed tracing to all requests
 * 
 * Features:
 * - Parses incoming W3C Trace Context (traceparent header)
 * - Creates new trace context if not present
 * - Configurable sampling rate via TRACE_SAMPLING_RATE env var
 * - Adds x-trace-id response header for correlation
 * - Exports spans to OTLP endpoint or Langfuse if configured
 */
app.use('*', async (c, next) => {
  // Parse sampling rate from env (default 10%)
  const samplingRate = c.env.TRACE_SAMPLING_RATE 
    ? parseFloat(c.env.TRACE_SAMPLING_RATE)
    : 0.1;
  
  const tracerConfig: TracerConfig = {
    serviceName: 'workway-construction-mcp',
    samplingRate,
    environment: c.env.ENVIRONMENT || 'development',
  };
  
  // Create tracer from incoming request (parses traceparent if present)
  const tracer = new Tracer(c.req.raw, tracerConfig);
  
  // Store tracer and trace ID in context for use by handlers
  c.set('tracer', tracer);
  c.set('traceId', tracer.traceId);
  
  // Start root span for the request
  const url = new URL(c.req.url);
  const rootSpan = tracer.startSpan('http.request', {
    'http.method': c.req.method,
    'http.url': url.pathname,
    'http.host': url.host,
    'http.user_agent': c.req.header('user-agent') || 'unknown',
  });
  
  try {
    // Process the request
    await next();
    
    // Add response info to span
    rootSpan.setAttributes({
      'http.status_code': c.res.status,
    });
    rootSpan.end(c.res.status >= 400 ? 'error' : 'ok');
  } catch (error) {
    // Record error in span
    rootSpan.setAttributes({
      'error': true,
      'error.type': error instanceof Error ? error.constructor.name : 'Error',
      'error.message': error instanceof Error ? error.message : String(error),
    });
    rootSpan.end('error');
    throw error;
  } finally {
    // Add trace ID to response headers
    c.header('x-trace-id', tracer.traceId);
    
    // Export spans if sampling and configured
    if (tracer.isSampled) {
      // Fire and forget - don't block the response
      exportTracingData(c.env, tracer).catch(err => {
        console.error('[Tracing] Export error:', err);
      });
    }
  }
});

/**
 * Export tracing data to configured destinations
 */
async function exportTracingData(env: Env, tracer: Tracer): Promise<void> {
  const spans = tracer.getSpans();
  if (spans.length === 0) return;
  
  // Log to console in development
  if (env.ENVIRONMENT === 'development') {
    logSpansToConsole(spans);
  }
  
  // Export to OTLP endpoint if configured
  if (env.OTEL_EXPORTER_URL) {
    await exportSpans(env.OTEL_EXPORTER_URL, tracer.toOTLP());
  }
  
  // Export to Langfuse if configured
  if (env.LANGFUSE_HOST && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY) {
    await exportToLangfuse(
      {
        host: env.LANGFUSE_HOST,
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
      },
      spans
    );
  }
}

// ============================================================================
// OAuth 2.0 Authorization Server (for Claude Cowork)
// ============================================================================

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Required for Claude to discover auth endpoints
 * Endpoints MUST be at root level per MCP spec
 */
app.get('/.well-known/oauth-authorization-server', (c) => {
  return c.json({
    issuer: MCP_BASE_URL,
    authorization_endpoint: `${MCP_BASE_URL}/authorize`,
    token_endpoint: `${MCP_BASE_URL}/token`,
    registration_endpoint: `${MCP_BASE_URL}/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256', 'plain'],
    scopes_supported: ['mcp:tools', 'mcp:resources'],
  });
});

/**
 * Dynamic Client Registration (RFC 7591)
 * Claude registers itself as an OAuth client
 */
app.post('/register', async (c) => {
  const body = await c.req.json() as {
    client_name?: string;
    redirect_uris?: string[];
  };
  
  // Generate a client ID for this registration
  const clientId = `ww_client_${crypto.randomUUID().replace(/-/g, '')}`;
  
  // Store client registration in KV
  await c.env.KV.put(`oauth_client:${clientId}`, JSON.stringify({
    client_name: body.client_name || 'Unknown Client',
    redirect_uris: body.redirect_uris || [],
    created_at: new Date().toISOString(),
  }), {
    expirationTtl: 365 * 24 * 60 * 60, // 1 year
  });
  
  return c.json({
    client_id: clientId,
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
    token_endpoint_auth_method: 'none',
  }, 201);
});

/**
 * Authorization Endpoint (MCP spec requires /authorize)
 * Generates an auth code for the client
 */
app.get('/authorize', async (c) => {
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const state = c.req.query('state');
  const codeChallenge = c.req.query('code_challenge');
  const codeChallengeMethod = c.req.query('code_challenge_method');
  
  if (!clientId || !redirectUri) {
    return c.json({ error: 'invalid_request', error_description: 'Missing client_id or redirect_uri' }, 400);
  }
  
  // Generate authorization code
  const code = crypto.randomUUID();
  
  // Store auth code with PKCE challenge
  await c.env.KV.put(`oauth_code:${code}`, JSON.stringify({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    created_at: new Date().toISOString(),
  }), {
    expirationTtl: 600, // 10 minutes
  });
  
  // Redirect back with code
  const redirect = new URL(redirectUri);
  redirect.searchParams.set('code', code);
  if (state) redirect.searchParams.set('state', state);
  
  return c.redirect(redirect.toString(), 302);
});

/**
 * Token Endpoint (MCP spec requires /token)
 * Exchanges auth code for access token
 */
app.post('/token', async (c) => {
  const body = await c.req.parseBody() as {
    grant_type: string;
    code?: string;
    redirect_uri?: string;
    client_id?: string;
    code_verifier?: string;
    refresh_token?: string;
  };
  
  if (body.grant_type === 'authorization_code') {
    const code = body.code;
    if (!code) {
      return c.json({ error: 'invalid_request', error_description: 'Missing code' }, 400);
    }
    
    // Retrieve and delete auth code
    const codeData = await c.env.KV.get(`oauth_code:${code}`, 'json') as {
      client_id: string;
      redirect_uri: string;
      code_challenge?: string;
      code_challenge_method?: string;
    } | null;
    
    if (!codeData) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, 400);
    }
    
    await c.env.KV.delete(`oauth_code:${code}`);
    
    // Verify PKCE if provided
    if (codeData.code_challenge && body.code_verifier) {
      const encoder = new TextEncoder();
      const data = encoder.encode(body.code_verifier);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const calculatedChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      if (calculatedChallenge !== codeData.code_challenge) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid code_verifier' }, 400);
      }
    }
    
    // Generate tokens
    const accessToken = `ww_at_${crypto.randomUUID().replace(/-/g, '')}`;
    const refreshToken = `ww_rt_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // Store access token
    await c.env.KV.put(`oauth_access_token:${accessToken}`, JSON.stringify({
      client_id: codeData.client_id,
      created_at: new Date().toISOString(),
    }), {
      expirationTtl: 3600, // 1 hour
    });
    
    // Store refresh token
    await c.env.KV.put(`oauth_refresh_token:${refreshToken}`, JSON.stringify({
      client_id: codeData.client_id,
      created_at: new Date().toISOString(),
    }), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });
    
    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
    });
  }
  
  if (body.grant_type === 'refresh_token') {
    const refreshToken = body.refresh_token;
    if (!refreshToken) {
      return c.json({ error: 'invalid_request', error_description: 'Missing refresh_token' }, 400);
    }
    
    const tokenData = await c.env.KV.get(`oauth_refresh_token:${refreshToken}`, 'json') as {
      client_id: string;
    } | null;
    
    if (!tokenData) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
    }
    
    // Generate new access token
    const accessToken = `ww_at_${crypto.randomUUID().replace(/-/g, '')}`;
    
    await c.env.KV.put(`oauth_access_token:${accessToken}`, JSON.stringify({
      client_id: tokenData.client_id,
      created_at: new Date().toISOString(),
    }), {
      expirationTtl: 3600,
    });
    
    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }
  
  return c.json({ error: 'unsupported_grant_type' }, 400);
});

// Mount the MCP server
app.route('/', mcpServer);

// Mount observability dashboard API
app.route('/observability', observability);

// ============================================================================
// Dashboard API (Construction-specific)
// ============================================================================

app.get('/api/dashboard', async (c) => {
  const workflows = await c.env.DB.prepare(`
    SELECT w.*, 
           (SELECT COUNT(*) FROM workflow_actions WHERE workflow_id = w.id) as action_count,
           (SELECT COUNT(*) FROM executions WHERE workflow_id = w.id) as execution_count
    FROM workflows w
    ORDER BY w.updated_at DESC
    LIMIT 50
  `).all<any>();

  return c.json({
    workflows: workflows.results || [],
    templates: [
      { id: 'rfi_overdue_alert', name: 'RFI Overdue Alert', category: 'rfi' },
      { id: 'weekly_project_summary', name: 'Weekly Project Summary', category: 'reporting' },
      { id: 'submittal_status_digest', name: 'Submittal Status Digest', category: 'submittal' },
      { id: 'daily_log_reminder', name: 'Daily Log Reminder', category: 'daily_log' },
      { id: 'new_rfi_notification', name: 'New RFI Notification', category: 'rfi' },
      { id: 'submittal_approved_notification', name: 'Submittal Approved', category: 'submittal' },
    ],
    stats: {
      totalWorkflows: workflows.results?.length || 0,
      activeWorkflows: workflows.results?.filter((w: any) => w.status === 'active').length || 0,
      totalExecutions: workflows.results?.reduce((sum: number, w: any) => sum + (w.execution_count || 0), 0) || 0,
    },
  });
});

app.get('/dashboard', (c) => {
  return c.redirect('https://workway.co/dashboard', 302);
});

app.get('/docs', (c) => {
  return c.redirect('https://construction-web.pages.dev/docs', 302);
});

// ============================================================================
// Tool Categories (Construction-specific)
// ============================================================================

app.get('/mcp/tools', (c) => {
  const tracer = c.get('tracer');
  const span = tracer.startSpan('mcp.list_tools', {
    'mcp.operation': 'list_tools',
  });
  
  const tools = Object.values(allTools).map((tool: any) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  }));

  span.setAttributes({ 'mcp.tool_count': tools.length });
  span.end('ok');
  
  return c.json({
    tools,
    categories: toolCategories,
  });
});

// ============================================================================
// Webhook Endpoints (Construction-specific)
// ============================================================================

app.post('/webhooks/:workflow_id', async (c) => {
  const workflowId = c.req.param('workflow_id');
  const body = await c.req.json();

  // Verify workflow exists and is active
  const workflow = await c.env.DB.prepare(`
    SELECT * FROM workflows WHERE id = ? AND status = 'active'
  `).bind(workflowId).first<any>();

  if (!workflow) {
    return c.json({ error: 'Workflow not found or not active' }, 404);
  }

  // Create execution record
  const executionId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO executions (id, workflow_id, status, started_at, input_data)
    VALUES (?, ?, 'pending', ?, ?)
  `).bind(executionId, workflowId, new Date().toISOString(), JSON.stringify(body)).run();

  return c.json({
    received: true,
    executionId,
    message: 'Webhook received, execution queued',
  });
});

// ============================================================================
// Procore OAuth (Construction-specific)
// ============================================================================

app.get('/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    // Log OAuth error
    await logOAuthCallback(c.env, {
      userId: 'unknown',
      success: false,
      provider: 'procore',
      errorMessage: errorDescription || error,
      request: c.req.raw,
    });
    return c.json({ 
      error: 'oauth_error',
      message: errorDescription || error,
      code: 'PROCORE_OAUTH_ERROR',
    }, 400);
  }

  if (!code || !state) {
    return c.json({ 
      error: 'missing_params',
      message: 'Missing authorization code or state parameter',
      code: 'OAUTH_MISSING_PARAMS',
    }, 400);
  }

  // Verify state
  const stateData = await c.env.KV.get(`oauth_state:${state}`, 'json') as {
    provider: string;
    companyId?: string;
    userId: string;
    environment?: ProcoreEnvironment;
    createdAt: string;
  } | null;
  
  if (!stateData) {
    return c.json({ 
      error: 'invalid_state',
      message: 'Invalid or expired state. Please try connecting again.',
      code: 'OAUTH_STATE_INVALID',
    }, 400);
  }

  // Verify state hasn't expired (10 minutes)
  const stateAge = Date.now() - new Date(stateData.createdAt).getTime();
  if (stateAge > 10 * 60 * 1000) {
    await c.env.KV.delete(`oauth_state:${state}`);
    return c.json({ 
      error: 'state_expired',
      message: 'Authorization session expired. Please try again.',
      code: 'OAUTH_STATE_EXPIRED',
    }, 400);
  }

  // Get environment-specific URLs and credentials
  const procoreEnv = stateData.environment || 'production';
  const urls = getProcoreUrls(procoreEnv);
  
  const clientId = procoreEnv === 'sandbox'
    ? (c.env.PROCORE_SANDBOX_CLIENT_ID || c.env.PROCORE_CLIENT_ID)
    : c.env.PROCORE_CLIENT_ID;
  const clientSecret = procoreEnv === 'sandbox'
    ? (c.env.PROCORE_SANDBOX_CLIENT_SECRET || c.env.PROCORE_CLIENT_SECRET)
    : c.env.PROCORE_CLIENT_SECRET;

  // Exchange code for token
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: OAUTH_CALLBACK_URL,
  });

  const tokenResponse = await fetch(urls.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', tokenResponse.status, errorText);
    return c.json({ 
      error: 'token_exchange_failed',
      message: `Failed to exchange authorization code for token: ${errorText}`,
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
      status: tokenResponse.status,
      environment: procoreEnv,
    }, 400);
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    token_type: string;
    created_at?: number;
  };

  // Encrypt tokens before storage
  const encryptionKey = c.env.COOKIE_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('COOKIE_ENCRYPTION_KEY not configured');
    return c.json({ 
      error: 'configuration_error',
      message: 'Server configuration error',
      code: 'MISSING_ENCRYPTION_KEY',
    }, 500);
  }

  const encryptedAccessToken = await encrypt(tokenData.access_token, encryptionKey);
  const encryptedRefreshToken = tokenData.refresh_token 
    ? await encrypt(tokenData.refresh_token, encryptionKey)
    : null;

  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Delete existing token for this user/provider
  await c.env.DB.prepare(`
    DELETE FROM oauth_tokens WHERE provider = 'procore' AND user_id = ?
  `).bind(stateData.userId).run();

  // Store encrypted token
  const tokenId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, company_id, environment, created_at)
    VALUES (?, 'procore', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tokenId,
    stateData.userId,
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt,
    stateData.companyId || null,
    procoreEnv,
    new Date().toISOString()
  ).run();

  // Invalidate KV token cache for this user (ensures fresh token is fetched)
  await c.env.KV.delete(`procore_token:${stateData.userId}`);
  await c.env.KV.delete(`procore_token:default`);

  // Clean up state
  await c.env.KV.delete(`oauth_state:${state}`);

  // Log successful OAuth callback
  await logOAuthCallback(c.env, {
    userId: stateData.userId,
    success: true,
    provider: 'procore',
    environment: procoreEnv,
    request: c.req.raw,
  });

  // Return beautiful success page
  const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connected to Procore - WORKWAY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 3rem;
      max-width: 480px;
    }
    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 2rem;
      animation: pop 0.3s ease-out;
    }
    .checkmark svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
      fill: none;
    }
    @keyframes pop {
      0% { transform: scale(0); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    .subtitle {
      color: #a1a1aa;
      margin-bottom: 2rem;
      line-height: 1.5;
    }
    .connection-id {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 2rem;
    }
    .connection-id label {
      font-size: 0.75rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: 0.5rem;
    }
    .connection-id code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 1rem;
      color: #f97316;
    }
    .note {
      font-size: 0.875rem;
      color: #71717a;
      line-height: 1.5;
    }
    .env-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: ${procoreEnv === 'sandbox' ? '#854d0e' : '#166534'};
      color: ${procoreEnv === 'sandbox' ? '#fef08a' : '#bbf7d0'};
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">
      <svg viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>Connected to Procore</h1>
    <p class="subtitle">Your Procore account is now linked. You can close this window and return to Claude.</p>
    <div class="connection-id">
      <label>Your Connection ID</label>
      <code>${stateData.userId}</code>
    </div>
    <p class="note">Use this ID with WORKWAY tools in Claude to access your Procore data.</p>
    <span class="env-badge">${procoreEnv === 'sandbox' ? 'Sandbox' : 'Production'}</span>
  </div>
</body>
</html>`;

  return c.html(successHtml);
});

// ============================================================================
// Durable Object for Workflow State
// ============================================================================

export class WorkflowState implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/execute') {
      const body = await request.json() as any;
      await this.state.storage.put('currentExecution', body);
      return new Response(JSON.stringify({ status: 'executing' }));
    }
    
    if (url.pathname === '/status') {
      const execution = await this.state.storage.get('currentExecution');
      return new Response(JSON.stringify({ execution }));
    }

    return new Response('Not found', { status: 404 });
  }
}

// ============================================================================
// Export
// ============================================================================

export default app;

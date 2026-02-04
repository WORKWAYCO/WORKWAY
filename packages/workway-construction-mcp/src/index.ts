/**
 * WORKWAY Construction MCP Server
 * 
 * The Automation Layer - AI-native workflow automation for construction.
 * 
 * Built on @workway/mcp-core with construction-specific:
 * - Procore OAuth integration
 * - Construction workflow tools (RFIs, daily logs, submittals)
 * - Webhook handling
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
import type { Env } from './types';

// ============================================================================
// Create MCP Server with Construction Tools
// ============================================================================

const mcpServer = createMCPServer<Env>({
  name: 'workway-construction-mcp',
  version: '0.1.0',
  description: 'The Automation Layer - AI-native workflow automation for construction',
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

const app = new Hono<{ Bindings: Env }>();

// Mount the MCP server
app.route('/', mcpServer);

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
  const tools = Object.values(allTools).map((tool: any) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  }));

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

  // Clean up state
  await c.env.KV.delete(`oauth_state:${state}`);

  return c.json({
    success: true,
    message: `Procore ${procoreEnv} connected successfully!`,
    userId: stateData.userId,
    environment: procoreEnv,
    expiresAt,
  });
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

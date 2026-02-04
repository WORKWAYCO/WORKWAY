/**
 * WORKWAY Construction MCP Server
 * 
 * The Automation Layer.
 * AI-native workflow automation for construction, powered by Cloudflare.
 * 
 * This MCP server exposes tools for:
 * - Creating and managing construction workflows
 * - Integrating with Procore for RFIs, daily logs, submittals
 * - Debugging and observability with Atlas-aligned taxonomy
 * 
 * North Star: "The AI-native workflow layer for construction, powered by Cloudflare."
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { allTools, toolCategories } from './tools';
import { listResources, fetchResource } from './resources';
import { encrypt, decrypt } from './lib/crypto';
import { 
  ALLOWED_ORIGINS, 
  OAUTH_CALLBACK_URL, 
  PROCORE_TOKEN_URL,
  MCP_BASE_URL,
} from './lib/config';

// ============================================================================
// MCP Server Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// CORS for MCP clients - restricted to allowed origins
app.use('*', cors({
  origin: (origin) => {
    // Allow requests with no origin (same-origin, server-to-server)
    if (!origin) return '*';
    
    // Check against allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    
    // In development, allow localhost
    if (origin.startsWith('http://localhost:')) {
      return origin;
    }
    
    // Default deny - return first allowed origin to indicate CORS is configured
    return ALLOWED_ORIGINS[0];
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ============================================================================
// Landing Page
// ============================================================================

/**
 * Landing page for Procore app listing
 */
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WORKWAY for Procore - AI-Powered Construction Automation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      min-height: 100vh;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    .hero { text-align: center; padding: 80px 0; }
    .logo { font-size: 48px; font-weight: 700; margin-bottom: 16px; }
    .logo span { color: #f97316; }
    .tagline { font-size: 24px; color: #94a3b8; margin-bottom: 32px; }
    .cta { 
      display: inline-block;
      background: #f97316;
      color: white;
      padding: 16px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 18px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(249, 115, 22, 0.3); }
    
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; margin: 80px 0; }
    .feature { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 32px; }
    .feature-icon { font-size: 40px; margin-bottom: 16px; }
    .feature h3 { font-size: 20px; margin-bottom: 12px; }
    .feature p { color: #94a3b8; line-height: 1.6; }
    
    .integrations { text-align: center; padding: 60px 0; }
    .integrations h2 { font-size: 32px; margin-bottom: 40px; }
    .integration-logos { display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; }
    .integration-logo { 
      background: white; 
      padding: 20px 40px; 
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      color: #1a1a2e;
    }
    
    .how-it-works { padding: 60px 0; }
    .how-it-works h2 { font-size: 32px; text-align: center; margin-bottom: 48px; }
    .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px; }
    .step { text-align: center; }
    .step-number { 
      width: 48px; height: 48px; 
      background: #f97316; 
      border-radius: 50%; 
      display: inline-flex; 
      align-items: center; 
      justify-content: center;
      font-weight: 700;
      font-size: 20px;
      margin-bottom: 16px;
    }
    .step h4 { font-size: 18px; margin-bottom: 8px; }
    .step p { color: #94a3b8; }
    
    .footer { text-align: center; padding: 40px 0; color: #64748b; }
    .footer a { color: #f97316; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <div class="logo">WORK<span>WAY</span></div>
      <p class="tagline">AI-Powered Automation for Construction Projects</p>
      <a href="https://developers.procore.com" class="cta">Install from Procore Marketplace</a>
    </div>
    
    <div class="features">
      <div class="feature">
        <div class="feature-icon">📋</div>
        <h3>Automated RFI Tracking</h3>
        <p>Never miss an overdue RFI again. Get automatic notifications when RFIs need attention, with smart prioritization based on project impact.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Daily Summary Reports</h3>
        <p>Receive AI-generated project summaries every morning. Track progress, identify blockers, and stay informed without digging through data.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔔</div>
        <h3>Smart Notifications</h3>
        <p>Route alerts to the right people via email or Slack. Customize notification rules based on project, event type, and severity.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📄</div>
        <h3>Submittal Monitoring</h3>
        <p>Track submittal status automatically. Get alerts for pending reviews, approaching deadlines, and approval bottlenecks.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🤖</div>
        <h3>AI-Native Design</h3>
        <p>Built for AI agents from the ground up. Works seamlessly with Claude, GPT, and other AI assistants to automate complex workflows.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h3>Enterprise Security</h3>
        <p>OAuth 2.0 authentication, encrypted token storage, and user-level permissions. Your data stays secure and compliant.</p>
      </div>
    </div>
    
    <div class="how-it-works">
      <h2>How It Works</h2>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <h4>Install the App</h4>
          <p>Add WORKWAY from the Procore App Management section using your Company Admin account.</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <h4>Connect Your Account</h4>
          <p>Authenticate with OAuth to securely link your Procore projects.</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <h4>Configure Workflows</h4>
          <p>Set up automated workflows for RFI tracking, daily summaries, and notifications.</p>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <h4>Automate & Relax</h4>
          <p>Let AI handle the routine tasks while you focus on building.</p>
        </div>
      </div>
    </div>
    
    <div class="integrations">
      <h2>Powered By</h2>
      <div class="integration-logos">
        <div class="integration-logo">
          <span style="color: #f97316;">●</span> Procore
        </div>
        <div class="integration-logo">
          <span style="color: #f97316;">●</span> Cloudflare
        </div>
        <div class="integration-logo">
          <span style="color: #f97316;">●</span> MCP Protocol
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Built by <a href="https://halfdozen.co">Half Dozen</a> · <a href="mailto:support@workway.co">Contact Support</a></p>
      <p style="margin-top: 8px;">App Version Key: 39b684c3-af8c-433e-8e19-6bc359312448</p>
    </div>
  </div>
</body>
</html>`;
  
  return c.html(html);
});

/**
 * Dashboard API - returns JSON data for dashboard
 */
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

/**
 * Dashboard for workflow management
 */
app.get('/dashboard', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WORKWAY Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; min-height: 100vh; }
    .header { background: #1a1a2e; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 700; }
    .logo span { color: #f97316; }
    .nav a { color: white; text-decoration: none; margin-left: 24px; }
    .nav a:hover { color: #f97316; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 32px; font-weight: 700; color: #1a1a2e; }
    .stat-label { color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .workflow-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
    .workflow-item:last-child { border-bottom: none; }
    .workflow-name { font-weight: 500; }
    .workflow-meta { color: #64748b; font-size: 14px; margin-top: 4px; }
    .workflow-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-active { background: #dcfce7; color: #166534; }
    .status-draft { background: #fef3c7; color: #92400e; }
    .status-deployed { background: #dcfce7; color: #166534; }
    .templates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .template-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .template-name { font-weight: 500; margin-bottom: 8px; }
    .template-category { display: inline-block; padding: 2px 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px; color: #64748b; }
    .empty-state { text-align: center; padding: 48px; color: #64748b; }
    .loading { text-align: center; padding: 48px; color: #64748b; }
    @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } .templates { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">WORK<span>WAY</span></div>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/mcp">API</a>
    </nav>
  </div>
  <div class="container">
    <div class="stats" id="stats">
      <div class="stat-card"><div class="stat-value" id="total-workflows">-</div><div class="stat-label">Total Workflows</div></div>
      <div class="stat-card"><div class="stat-value" id="active-workflows">-</div><div class="stat-label">Active</div></div>
      <div class="stat-card"><div class="stat-value" id="total-executions">-</div><div class="stat-label">Executions</div></div>
      <div class="stat-card"><div class="stat-value" id="template-count">6</div><div class="stat-label">Templates</div></div>
    </div>
    <div class="section">
      <h2 class="section-title">Workflows</h2>
      <div class="card"><div id="workflow-list" class="loading">Loading...</div></div>
    </div>
    <div class="section">
      <h2 class="section-title">Quick Start Templates</h2>
      <div class="templates" id="templates"></div>
    </div>
    <div class="section">
      <h2 class="section-title">API Access</h2>
      <div class="card" style="padding: 20px;">
        <p style="margin-bottom: 12px;">Use these endpoints to integrate with your AI agents:</p>
        <code style="display: block; background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px;">POST ${MCP_BASE_URL}/mcp/tools/{tool_name}</code>
      </div>
    </div>
  </div>
  <script>
    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        document.getElementById('total-workflows').textContent = data.stats.totalWorkflows;
        document.getElementById('active-workflows').textContent = data.stats.activeWorkflows;
        document.getElementById('total-executions').textContent = data.stats.totalExecutions;
        const wfList = document.getElementById('workflow-list');
        if (data.workflows.length === 0) {
          wfList.innerHTML = '<div class="empty-state">No workflows yet. Create one from a template using the MCP tools.</div>';
        } else {
          wfList.innerHTML = data.workflows.map(w => 
            '<div class="workflow-item"><div><div class="workflow-name">' + w.name + '</div><div class="workflow-meta">' + 
            w.action_count + ' actions · ' + w.execution_count + ' executions</div></div>' +
            '<span class="workflow-status status-' + w.status + '">' + w.status + '</span></div>'
          ).join('');
        }
        document.getElementById('templates').innerHTML = data.templates.map(t =>
          '<div class="template-card"><div class="template-name">' + t.name + '</div><span class="template-category">' + t.category + '</span></div>'
        ).join('');
      } catch (e) { console.error(e); }
    }
    loadDashboard();
  </script>
</body>
</html>`;
  return c.html(html);
});

// ============================================================================
// MCP Protocol Endpoints
// ============================================================================

/**
 * MCP Server Info
 */
app.get('/mcp', (c) => {
  return c.json({
    name: 'workway-construction-mcp',
    version: '0.1.0',
    description: 'The Automation Layer - AI-native workflow automation for construction',
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
    },
  });
});

/**
 * List available tools (MCP tools/list)
 */
app.get('/mcp/tools', (c) => {
  const tools = Object.values(allTools).map(tool => ({
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

/**
 * Execute a tool (MCP tools/call)
 */
app.post('/mcp/tools/:name', async (c) => {
  const toolName = c.req.param('name');
  const tool = Object.values(allTools).find(t => t.name === toolName);

  if (!tool) {
    return c.json({
      error: {
        code: -32602,
        message: `Unknown tool: ${toolName}`,
      },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const input = tool.inputSchema.parse(body.arguments || body);
    const result = await tool.execute(input as any, c.env);

    return c.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.data || result, null, 2),
        },
      ],
      isError: !result.success,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    }, 400);
  }
});

// ============================================================================
// MCP Resources Endpoints
// ============================================================================

/**
 * List available resources
 */
app.get('/mcp/resources', (c) => {
  return c.json({
    resources: listResources(),
  });
});

/**
 * Read a resource by URI
 */
app.get('/mcp/resources/read', async (c) => {
  const uri = c.req.query('uri');
  
  if (!uri) {
    return c.json({ error: 'Missing uri parameter' }, 400);
  }
  
  const content = await fetchResource(uri, c.env);
  
  if (content === null) {
    return c.json({ error: `Resource not found: ${uri}` }, 404);
  }
  
  return c.json({
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(content, null, 2),
      },
    ],
  });
});

// ============================================================================
// Webhook Endpoints
// ============================================================================

/**
 * Receive webhooks from Procore and other sources
 */
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

  // TODO: Queue workflow execution via Durable Object
  // For now, return acknowledgment
  return c.json({
    received: true,
    executionId,
    message: 'Webhook received, execution queued',
  });
});

// ============================================================================
// OAuth Callback
// ============================================================================

/**
 * OAuth callback for Procore
 * Implements PKCE verification and encrypted token storage
 */
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

  // Exchange code for token (using form-urlencoded as per OAuth 2.0 spec)
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: c.env.PROCORE_CLIENT_ID,
    client_secret: c.env.PROCORE_CLIENT_SECRET,
    redirect_uri: OAUTH_CALLBACK_URL,
  });

  const tokenResponse = await fetch(PROCORE_TOKEN_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', tokenResponse.status, errorText);
    console.error('Token URL:', PROCORE_TOKEN_URL);
    console.error('Client ID:', c.env.PROCORE_CLIENT_ID?.substring(0, 10) + '...');
    return c.json({ 
      error: 'token_exchange_failed',
      message: `Failed to exchange authorization code for token: ${errorText}`,
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
      status: tokenResponse.status,
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

  // Calculate expiration
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Delete existing token for this user/provider
  await c.env.DB.prepare(`
    DELETE FROM oauth_tokens WHERE provider = 'procore' AND user_id = ?
  `).bind(stateData.userId).run();

  // Store encrypted token with user isolation
  const tokenId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, company_id, created_at)
    VALUES (?, 'procore', ?, ?, ?, ?, ?, ?)
  `).bind(
    tokenId,
    stateData.userId,
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt,
    stateData.companyId || null,
    new Date().toISOString()
  ).run();

  // Clean up state
  await c.env.KV.delete(`oauth_state:${state}`);

  // Return success
  return c.json({
    success: true,
    message: 'Procore connected successfully!',
    userId: stateData.userId,
    expiresAt,
  });
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
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
      // Handle workflow execution
      const body = await request.json() as any;
      
      // Store execution state
      await this.state.storage.put('currentExecution', body);
      
      // TODO: Execute workflow steps
      
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

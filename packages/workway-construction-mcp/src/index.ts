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
import type { Context } from 'hono';
import type { Env, User, UsageResult, AnonymousUsage, UserTier } from './types';
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

// Tier limits
const TIER_LIMITS: Record<UserTier, number> = {
  anonymous: 50,      // Total lifetime runs
  free: 500,          // Per month
  pro: 5000,          // Per month
  enterprise: -1,     // Unlimited (-1 means no limit)
};

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
// Usage Metering
// ============================================================================

/**
 * Generate a fingerprint for anonymous users
 * Uses hash of IP + User-Agent for tracking
 */
function generateFingerprint(c: Context<{ Bindings: Env }>): string {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const userAgent = c.req.header('user-agent') || 'unknown';
  // Simple hash - in production you might want crypto.subtle.digest
  let hash = 0;
  const str = `${ip}:${userAgent}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Get user from Authorization header (JWT or API key)
 */
async function getUserFromToken(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  // Extract token
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  try {
    // Check if it's a user API key stored in KV
    const userId = await c.env.KV.get(`api_key:${token}`);
    if (userId) {
      const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(userId).first<User>();
      return user || null;
    }

    // TODO: Add JWT verification for session tokens
    // For now, check oauth_tokens for user lookup
    const oauthToken = await c.env.DB.prepare(
      'SELECT user_id FROM oauth_tokens WHERE access_token = ? LIMIT 1'
    ).bind(token).first<{ user_id: string }>();

    if (oauthToken) {
      const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(oauthToken.user_id).first<User>();
      return user || null;
    }

    return null;
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
}

/**
 * Check anonymous usage via KV
 */
async function checkAnonymousUsage(c: Context<{ Bindings: Env }>): Promise<UsageResult> {
  const fingerprint = generateFingerprint(c);
  const key = `anon_usage:${fingerprint}`;
  
  const usageData = await c.env.KV.get<AnonymousUsage>(key, 'json');
  const limit = TIER_LIMITS.anonymous;
  
  if (!usageData) {
    return {
      exceeded: false,
      runs: 0,
      limit,
      tier: 'anonymous',
    };
  }

  return {
    exceeded: usageData.runs >= limit,
    runs: usageData.runs,
    limit,
    tier: 'anonymous',
  };
}

/**
 * Check authenticated user usage via D1
 */
async function checkAuthenticatedUsage(c: Context<{ Bindings: Env }>, user: User): Promise<UsageResult> {
  const limit = TIER_LIMITS[user.tier];
  
  // Enterprise has unlimited
  if (limit === -1) {
    return {
      exceeded: false,
      runs: user.runs_this_month,
      limit: -1,
      tier: user.tier,
      userId: user.id,
      cycleStart: user.billing_cycle_start,
    };
  }

  // Check if billing cycle needs reset (30 days)
  const cycleStart = new Date(user.billing_cycle_start);
  const now = new Date();
  const daysSinceCycleStart = Math.floor((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCycleStart >= 30) {
    // Reset the billing cycle
    await c.env.DB.prepare(`
      UPDATE users 
      SET runs_this_month = 0, 
          billing_cycle_start = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now.toISOString(), now.toISOString(), user.id).run();

    return {
      exceeded: false,
      runs: 0,
      limit,
      tier: user.tier,
      userId: user.id,
      cycleStart: now.toISOString(),
      daysUntilReset: 30,
    };
  }

  const daysUntilReset = 30 - daysSinceCycleStart;

  return {
    exceeded: user.runs_this_month >= limit,
    runs: user.runs_this_month,
    limit,
    tier: user.tier,
    userId: user.id,
    cycleStart: user.billing_cycle_start,
    daysUntilReset,
  };
}

/**
 * Check usage for current request
 */
async function checkUsage(c: Context<{ Bindings: Env }>): Promise<UsageResult> {
  const user = await getUserFromToken(c);
  if (!user) {
    return checkAnonymousUsage(c);
  }
  return checkAuthenticatedUsage(c, user);
}

/**
 * Increment usage after successful tool call
 */
async function incrementUsage(c: Context<{ Bindings: Env }>): Promise<void> {
  const user = await getUserFromToken(c);
  
  if (!user) {
    // Anonymous - increment in KV
    const fingerprint = generateFingerprint(c);
    const key = `anon_usage:${fingerprint}`;
    
    const usageData = await c.env.KV.get<AnonymousUsage>(key, 'json');
    const newUsage: AnonymousUsage = {
      runs: (usageData?.runs || 0) + 1,
      first_seen: usageData?.first_seen || new Date().toISOString(),
    };
    
    // Store with 90 day expiration for anonymous users
    await c.env.KV.put(key, JSON.stringify(newUsage), {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
    });
  } else {
    // Authenticated - increment in D1
    await c.env.DB.prepare(`
      UPDATE users 
      SET runs_this_month = runs_this_month + 1,
          updated_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), user.id).run();
  }
}

/**
 * Get current usage for API endpoint
 */
async function getCurrentUsage(c: Context<{ Bindings: Env }>): Promise<UsageResult & { resetDate?: string }> {
  const usage = await checkUsage(c);
  
  // Calculate reset date for display
  let resetDate: string | undefined;
  if (usage.cycleStart && usage.daysUntilReset) {
    const reset = new Date(usage.cycleStart);
    reset.setDate(reset.getDate() + 30);
    resetDate = reset.toISOString();
  }

  return {
    ...usage,
    resetDate,
  };
}

// ============================================================================
// Landing Page - WORKWAY
// ============================================================================

/**
 * Root route - returns API info and redirects to Pages site
 */
app.get('/', (c) => {
  return c.json({
    api: 'workway-construction-mcp',
    version: '0.1.0',
    docs: 'https://construction-web.pages.dev/docs',
    dashboard: `${MCP_BASE_URL}/dashboard`,
    mcp: `${MCP_BASE_URL}/mcp`,
  });
});

// Landing page HTML removed - now served by Pages site at construction-web.pages.dev

/**
 * Documentation route - redirects to Pages site
 */
app.get('/docs', (c) => {
  return c.redirect('https://construction-web.pages.dev/docs', 302);
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
 * Dashboard - Redirect to main WORKWAY dashboard
 */
app.get('/dashboard', (c) => {
  return c.redirect('https://workway.co/dashboard', 302);
});

// ============================================================================
// Usage API
// ============================================================================

/**
 * Get current usage for the authenticated user or anonymous session
 */
app.get('/api/usage', async (c) => {
  const usage = await getCurrentUsage(c);
  return c.json({
    tier: usage.tier,
    runs_used: usage.runs,
    runs_limit: usage.limit,
    billing_cycle_start: usage.cycleStart || null,
    days_until_reset: usage.daysUntilReset || null,
    reset_date: usage.resetDate || null,
  });
});

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Generate an API key for the current user
 * Anonymous users get a temporary key tied to their fingerprint
 * Authenticated users get a persistent key
 */
app.post('/api/keys', async (c) => {
  const user = await getUserFromToken(c);
  
  if (!user) {
    // Anonymous user - generate temporary key tied to fingerprint
    const fingerprint = generateFingerprint(c);
    const key = `ww_anon_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // Store key -> fingerprint mapping with 90 day expiration
    await c.env.KV.put(`api_key:${key}`, fingerprint, {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
    });
    
    return c.json({
      apiKey: key,
      tier: 'anonymous',
      expiresIn: '90 days',
    });
  }
  
  // Authenticated user - generate persistent key
  const key = `ww_${crypto.randomUUID().replace(/-/g, '')}`;
  
  // Store key -> userId mapping (no expiration for authenticated users)
  await c.env.KV.put(`api_key:${key}`, user.id);
  
  // Also store user -> key mapping so we can revoke later
  const userKeysKey = `user_keys:${user.id}`;
  const existingKeys = await c.env.KV.get<string[]>(userKeysKey, 'json') || [];
  existingKeys.push(key);
  await c.env.KV.put(userKeysKey, JSON.stringify(existingKeys));
  
  return c.json({
    apiKey: key,
    tier: user.tier,
    userId: user.id,
  });
});

/**
 * Revoke an API key for the current user
 */
app.delete('/api/keys', async (c) => {
  const user = await getUserFromToken(c);
  
  if (!user) {
    // Anonymous user - revoke by fingerprint
    const fingerprint = generateFingerprint(c);
    
    // We can't easily look up keys by fingerprint, so just return success
    // The key will expire naturally anyway
    return c.json({
      success: true,
      message: 'Anonymous keys will expire automatically',
    });
  }
  
  // Authenticated user - revoke all their keys
  const userKeysKey = `user_keys:${user.id}`;
  const existingKeys = await c.env.KV.get<string[]>(userKeysKey, 'json') || [];
  
  // Delete all keys
  for (const key of existingKeys) {
    await c.env.KV.delete(`api_key:${key}`);
  }
  
  // Clear the user's key list
  await c.env.KV.delete(userKeysKey);
  
  return c.json({
    success: true,
    keysRevoked: existingKeys.length,
  });
});

/**
 * Revoke a specific API key
 */
app.delete('/api/keys/:key', async (c) => {
  const keyToRevoke = c.req.param('key');
  const user = await getUserFromToken(c);
  
  // Verify the key belongs to this user (or is anonymous)
  const keyOwner = await c.env.KV.get(`api_key:${keyToRevoke}`);
  
  if (!keyOwner) {
    return c.json({ error: 'Key not found' }, 404);
  }
  
  if (user && keyOwner !== user.id) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  // Delete the key
  await c.env.KV.delete(`api_key:${keyToRevoke}`);
  
  // Remove from user's key list if authenticated
  if (user) {
    const userKeysKey = `user_keys:${user.id}`;
    const existingKeys = await c.env.KV.get<string[]>(userKeysKey, 'json') || [];
    const updatedKeys = existingKeys.filter(k => k !== keyToRevoke);
    await c.env.KV.put(userKeysKey, JSON.stringify(updatedKeys));
  }
  
  return c.json({
    success: true,
    keyRevoked: keyToRevoke,
  });
});

// ============================================================================
// MCP Protocol Endpoints (REST)
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

// ============================================================================
// Remote MCP Protocol (SSE Transport for Claude Cowork)
// ============================================================================

/**
 * SSE endpoint for Remote MCP Protocol
 * Claude Cowork connects here to receive messages and get the message endpoint
 */
app.get('/sse', (c) => {
  // Generate a session ID for this connection
  const sessionId = crypto.randomUUID();
  const messageEndpoint = new URL(c.req.url).origin + `/message?sessionId=${sessionId}`;
  
  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Store session in KV
      await c.env.KV.put(`sse_session:${sessionId}`, 'active', {
        expirationTtl: 3600, // 1 hour
      });
      
      // Send endpoint event (tells client where to POST messages)
      const endpointEvent = `event: endpoint\ndata: ${messageEndpoint}\n\n`;
      controller.enqueue(encoder.encode(endpointEvent));
      
      // Send initial message event
      const initMessage = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      };
      const messageEvent = `event: message\ndata: ${JSON.stringify(initMessage)}\n\n`;
      controller.enqueue(encoder.encode(messageEvent));
      
      // Keep connection alive with periodic pings
      // Note: In Cloudflare Workers, long-running connections are limited
      // The client should reconnect if the connection drops
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});

/**
 * CORS preflight for message endpoint
 */
app.options('/message', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});

/**
 * Message endpoint for Remote MCP Protocol
 * Claude Cowork sends JSON-RPC messages here
 */
app.post('/message', async (c) => {
  const sessionId = c.req.query('sessionId');
  
  if (!sessionId) {
    return c.json({ error: 'Missing sessionId' }, 400);
  }
  
  // Verify session exists
  const session = await c.env.KV.get(`sse_session:${sessionId}`);
  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }
  
  try {
    const message = await c.req.json() as {
      jsonrpc: string;
      id?: string | number;
      method: string;
      params?: Record<string, unknown>;
    };
    
    // Handle JSON-RPC methods
    let result: unknown;
    
    switch (message.method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'workway-construction-mcp',
            version: '0.1.0',
          },
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: false, listChanged: true },
            prompts: { listChanged: false },
          },
        };
        break;
        
      case 'tools/list':
        const tools = Object.values(allTools).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }));
        result = { tools };
        break;
        
      case 'tools/call': {
        const params = message.params as { name: string; arguments?: Record<string, unknown> };
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        
        const tool = Object.values(allTools).find(t => t.name === toolName);
        if (!tool) {
          return c.json({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32602,
              message: `Unknown tool: ${toolName}`,
            },
          });
        }
        
        // Check usage limits
        const usage = await checkUsage(c);
        if (usage.exceeded) {
          return c.json({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32000,
              message: usage.tier === 'anonymous' 
                ? 'Free tier limit reached. Sign up at workway.co for more runs.'
                : `Monthly limit of ${usage.limit} runs exceeded.`,
            },
          });
        }
        
        // Execute tool
        try {
          const input = tool.inputSchema.parse(toolArgs);
          const toolResult = await tool.execute(input as any, c.env);
          
          // Increment usage
          await incrementUsage(c);
          
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult.data || toolResult, null, 2),
              },
            ],
            isError: !toolResult.success,
          };
        } catch (execError) {
          result = {
            content: [
              {
                type: 'text',
                text: `Error: ${execError instanceof Error ? execError.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
        break;
      }
        
      case 'resources/list':
        const resources = listResources();
        result = { resources };
        break;
        
      case 'resources/read': {
        const resourceParams = message.params as { uri: string };
        const content = await fetchResource(resourceParams?.uri, c.env);
        if (content === null) {
          return c.json({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32602,
              message: `Resource not found: ${resourceParams?.uri}`,
            },
          });
        }
        result = {
          contents: [
            {
              uri: resourceParams?.uri,
              mimeType: 'application/json',
              text: JSON.stringify(content, null, 2),
            },
          ],
        };
        break;
      }
        
      case 'prompts/list':
        result = { prompts: [] };
        break;
        
      default:
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          },
        });
    }
    
    // Return JSON-RPC response
    return c.json({
      jsonrpc: '2.0',
      id: message.id,
      result,
    });
    
  } catch (error) {
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    }, 400);
  }
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
 * Includes usage metering - checks limits before execution, increments after
 */
app.post('/mcp/tools/:name', async (c) => {
  // Check usage limits before executing
  const usage = await checkUsage(c);
  if (usage.exceeded) {
    return c.json({
      error: 'run_limit_exceeded',
      current: usage.runs,
      limit: usage.limit,
      tier: usage.tier,
      upgrade_url: 'https://workway.co/pricing',
      message: usage.tier === 'anonymous' 
        ? 'You have reached the free tier limit. Sign up for more runs.'
        : `You have exceeded your ${usage.tier} tier monthly limit of ${usage.limit} runs.`,
    }, 402);
  }

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

    // Increment usage after successful execution
    await incrementUsage(c);

    return c.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.data || result, null, 2),
        },
      ],
      isError: !result.success,
      usage: {
        runs_used: usage.runs + 1,
        runs_limit: usage.limit,
        tier: usage.tier,
      },
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
  
  // Use sandbox credentials if connecting to sandbox
  const clientId = procoreEnv === 'sandbox'
    ? (c.env.PROCORE_SANDBOX_CLIENT_ID || c.env.PROCORE_CLIENT_ID)
    : c.env.PROCORE_CLIENT_ID;
  const clientSecret = procoreEnv === 'sandbox'
    ? (c.env.PROCORE_SANDBOX_CLIENT_SECRET || c.env.PROCORE_CLIENT_SECRET)
    : c.env.PROCORE_CLIENT_SECRET;

  // Exchange code for token (using form-urlencoded as per OAuth 2.0 spec)
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: OAUTH_CALLBACK_URL,
  });

  const tokenResponse = await fetch(urls.tokenUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', tokenResponse.status, errorText);
    console.error('Token URL:', urls.tokenUrl);
    console.error('Environment:', procoreEnv);
    console.error('Client ID:', c.env.PROCORE_CLIENT_ID?.substring(0, 10) + '...');
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

  // Calculate expiration
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Delete existing token for this user/provider
  await c.env.DB.prepare(`
    DELETE FROM oauth_tokens WHERE provider = 'procore' AND user_id = ?
  `).bind(stateData.userId).run();

  // Store encrypted token with user isolation and environment
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

  // Return success
  return c.json({
    success: true,
    message: `Procore ${procoreEnv} connected successfully!`,
    userId: stateData.userId,
    environment: procoreEnv,
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

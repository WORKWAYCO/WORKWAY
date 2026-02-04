/**
 * MCP Server Factory
 * 
 * Creates a complete MCP server with all shared infrastructure:
 * - CORS handling
 * - SSE transport (Remote MCP Protocol)
 * - Auth/API key management
 * - Usage metering
 * - Health check
 * - REST and JSON-RPC endpoints
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { BaseMCPEnv, MCPServerConfig, UserTier, User } from './types';
import { createSSEHandler, createMessageCORSHandler } from './transport/sse';
import { createMessageHandler } from './protocol/handler';
import { getUserFromToken, generateAPIKey, revokeAllAPIKeys, revokeAPIKey } from './auth';
import { createMetering } from './metering/usage';

// Default allowed origins
const DEFAULT_ALLOWED_ORIGINS = [
  'https://workway.co',
  'https://www.workway.co',
  'https://mcp.workway.co',
];

// Default tier limits
const DEFAULT_TIER_LIMITS: Record<UserTier, number> = {
  anonymous: 50,
  free: 500,
  pro: 5000,
  enterprise: -1,
};

export interface CreateMCPServerOptions<TEnv extends BaseMCPEnv> extends MCPServerConfig<TEnv> {
  /** Base URL for redirects (e.g., https://mcp.workway.co) */
  baseUrl?: string;
}

/**
 * Create an MCP server with all shared infrastructure
 */
export function createMCPServer<TEnv extends BaseMCPEnv>(
  config: CreateMCPServerOptions<TEnv>
) {
  const app = new Hono<{ Bindings: TEnv }>();
  
  const allowedOrigins = config.allowedOrigins || DEFAULT_ALLOWED_ORIGINS;
  const tierLimits = { ...DEFAULT_TIER_LIMITS, ...config.tierLimits };
  const metering = createMetering({ tierLimits });
  
  // ============================================================================
  // CORS Middleware
  // ============================================================================
  
  app.use('*', cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (allowedOrigins.includes(origin)) return origin;
      if (origin.startsWith('http://localhost:')) return origin;
      return allowedOrigins[0];
    },
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));
  
  // ============================================================================
  // Health & Info (No auth required - anonymous metering applies)
  // ============================================================================
  
  app.get('/', (c) => {
    return c.json({
      name: config.name,
      version: config.version,
      description: config.description,
      protocol: 'mcp',
      endpoints: {
        mcp: `${config.baseUrl || ''}/mcp`,
        sse: `${config.baseUrl || ''}/sse`,
      },
    });
  });
  
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      version: config.version,
      timestamp: new Date().toISOString(),
    });
  });
  
  // ============================================================================
  // Remote MCP Protocol (SSE Transport)
  // Claude expects both GET (stream) and POST (JSON-RPC) on /sse
  // ============================================================================
  
  app.get('/sse', createSSEHandler<TEnv>());
  app.options('/sse', createMessageCORSHandler());
  app.post('/sse', createMessageHandler<TEnv>({
    serverInfo: {
      name: config.name,
      version: config.version,
    },
    capabilities: config.capabilities || {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
    },
    tools: config.tools,
    resources: config.resources,
    tierLimits,
  }));
  
  // Legacy /message endpoint (keep for backwards compatibility)
  app.options('/message', createMessageCORSHandler());
  app.post('/message', createMessageHandler<TEnv>({
    serverInfo: {
      name: config.name,
      version: config.version,
    },
    capabilities: config.capabilities || {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
    },
    tools: config.tools,
    resources: config.resources,
    tierLimits,
  }));
  
  // ============================================================================
  // Streamable HTTP Transport (POST /mcp)
  // Primary transport for Claude - JSON-RPC over HTTP
  // ============================================================================
  
  app.post('/mcp', async (c) => {
    try {
      const message = await c.req.json() as {
        jsonrpc: string;
        id?: string | number;
        method: string;
        params?: Record<string, unknown>;
      };
      
      let result: unknown;
      
      switch (message.method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: config.name,
              version: config.version,
            },
            capabilities: config.capabilities || {
              tools: { listChanged: true },
              resources: { subscribe: false, listChanged: true },
              prompts: { listChanged: false },
            },
          };
          break;
          
        case 'tools/list':
          const toolsList = Object.values(config.tools).map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodToJsonSchema(tool.inputSchema, { target: 'openApi3' }),
          }));
          result = { tools: toolsList };
          break;
          
        case 'tools/call': {
          const params = message.params as { name: string; arguments?: Record<string, unknown> };
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};
          
          // Find tool by name property (not object key)
          const tool = Object.values(config.tools).find((t: any) => t.name === toolName);
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
          const usage = await metering.checkUsage(c);
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
          
          try {
            const input = tool.inputSchema.parse(toolArgs);
            const toolResult = await tool.execute(input, c.env);
            await metering.incrementUsage(c);
            
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
          const resourcesList = config.resources?.list() || [];
          result = { resources: resourcesList };
          break;
          
        case 'resources/read': {
          const resourceParams = message.params as { uri: string };
          if (!config.resources) {
            return c.json({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32602, message: 'Resources not supported' },
            });
          }
          
          const content = await config.resources.fetch(resourceParams?.uri, c.env);
          if (content === null) {
            return c.json({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32602, message: `Resource not found: ${resourceParams?.uri}` },
            });
          }
          result = {
            contents: [{
              uri: resourceParams?.uri,
              mimeType: 'application/json',
              text: JSON.stringify(content, null, 2),
            }],
          };
          break;
        }
          
        case 'prompts/list':
          result = { prompts: [] };
          break;
          
        case 'notifications/initialized':
          // Client notification - just acknowledge
          return c.json({ jsonrpc: '2.0', id: message.id, result: {} });
          
        default:
          return c.json({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: `Method not found: ${message.method}` },
          });
      }
      
      return c.json({
        jsonrpc: '2.0',
        id: message.id,
        result,
      });
      
    } catch (error) {
      return c.json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }, 400);
    }
  });
  
  // ============================================================================
  // REST MCP Protocol (GET /mcp for info)
  // ============================================================================
  
  app.get('/mcp', (c) => {
    return c.json({
      name: config.name,
      version: config.version,
      description: config.description,
      capabilities: config.capabilities || {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: false },
      },
    });
  });
  
  app.get('/mcp/tools', (c) => {
    const tools = Object.values(config.tools).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }));
    
    return c.json({ tools });
  });
  
  app.post('/mcp/tools/:name', async (c) => {
    // Check usage limits
    const usage = await metering.checkUsage(c);
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
    const tool = config.tools[toolName];
    
    if (!tool) {
      return c.json({
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      }, 404);
    }
    
    try {
      const body = await c.req.json();
      const input = tool.inputSchema.parse(body.arguments || body);
      const result = await tool.execute(input, c.env);
      
      // Increment usage
      await metering.incrementUsage(c);
      
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
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      }, 400);
    }
  });
  
  // ============================================================================
  // Resources
  // ============================================================================
  
  if (config.resources) {
    app.get('/mcp/resources', (c) => {
      return c.json({ resources: config.resources!.list() });
    });
    
    app.get('/mcp/resources/read', async (c) => {
      const uri = c.req.query('uri');
      if (!uri) {
        return c.json({ error: 'Missing uri parameter' }, 400);
      }
      
      const content = await config.resources!.fetch(uri, c.env);
      if (content === null) {
        return c.json({ error: `Resource not found: ${uri}` }, 404);
      }
      
      return c.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(content, null, 2),
        }],
      });
    });
  }
  
  // ============================================================================
  // Usage API
  // ============================================================================
  
  app.get('/api/usage', async (c) => {
    const usage = await metering.getCurrentUsage(c);
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
  
  app.post('/api/keys', async (c) => {
    const user = await getUserFromToken(c);
    const result = await generateAPIKey(c, user);
    return c.json(result);
  });
  
  app.delete('/api/keys', async (c) => {
    const user = await getUserFromToken(c);
    const result = await revokeAllAPIKeys(c, user);
    return c.json(result);
  });
  
  app.delete('/api/keys/:key', async (c) => {
    const keyToRevoke = c.req.param('key');
    const user = await getUserFromToken(c);
    const result = await revokeAPIKey(c, keyToRevoke, user);
    
    if (!result.success) {
      const status = result.error === 'Key not found' ? 404 : 403;
      return c.json({ error: result.error }, status);
    }
    
    return c.json({ success: true, keyRevoked: keyToRevoke });
  });
  
  // ============================================================================
  // Custom Routes
  // ============================================================================
  
  if (config.customRoutes) {
    config.customRoutes(app, {} as TEnv);
  }
  
  return app;
}

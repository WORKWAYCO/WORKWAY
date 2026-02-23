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

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { BaseMCPEnv, MCPServerConfig, UserTier, UsageResult } from './types';
import { createSSEHandler, createMessageCORSHandler } from './transport/sse';
import { createMessageHandler } from './protocol/handler';
import { getUserFromToken, generateAPIKey, revokeAllAPIKeys, revokeAPIKey, generateFingerprint } from './auth';
import { createMetering } from './metering/usage';
import {
  emitTelemetryInvocation,
  isTelemetryResourceUri,
  mergeTelemetryResources,
  readTelemetryResource,
  resolveBraintrustTelemetryOptions,
  resolveTelemetryAccountId,
} from './telemetry';

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
  const telemetryEnabled = config.telemetry?.enabled !== false;
  const telemetryServerName = config.telemetry?.serverName || config.name;

  const getAccountIdFromUsage = (c: Context<{ Bindings: TEnv }>, usage: UsageResult): string => {
    if (usage.userId) return usage.userId;
    return `anon:${generateFingerprint(c)}`;
  };

  const emitToolTelemetry = (
    c: Context<{ Bindings: TEnv }>,
    args: {
      toolName: string;
      accountId: string;
      input: unknown;
      output: unknown;
      durationMs: number;
      success: boolean;
      error?: string;
    },
  ): void => {
    if (!telemetryEnabled) return;
    const telemetryTask = emitTelemetryInvocation({
      db: c.env.DB,
      serverName: telemetryServerName,
      toolName: args.toolName,
      accountId: args.accountId,
      input: args.input,
      output: args.output,
      durationMs: args.durationMs,
      success: args.success,
      error: args.error,
      braintrust: resolveBraintrustTelemetryOptions(c.env, config.telemetry?.braintrust),
    }).catch((error: unknown) => {
      console.warn(`[telemetry] scheduling failed for ${args.toolName}:`, error);
    });

    c.executionCtx?.waitUntil?.(telemetryTask);
  };
  
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
      icon: config.icon,
    },
    capabilities: config.capabilities || {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
    },
    tools: config.tools,
    resources: config.resources,
    prompts: config.prompts,
    tierLimits,
    telemetry: {
      enabled: telemetryEnabled,
      serverName: telemetryServerName,
      braintrust: config.telemetry?.braintrust,
    },
  }));
  
  // Legacy /message endpoint (keep for backwards compatibility)
  app.options('/message', createMessageCORSHandler());
  app.post('/message', createMessageHandler<TEnv>({
    serverInfo: {
      name: config.name,
      version: config.version,
      icon: config.icon,
    },
    capabilities: config.capabilities || {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
    },
    tools: config.tools,
    resources: config.resources,
    prompts: config.prompts,
    tierLimits,
    telemetry: {
      enabled: telemetryEnabled,
      serverName: telemetryServerName,
      braintrust: config.telemetry?.braintrust,
    },
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
              ...(config.icon && { icon: config.icon }),
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

          const startedAt = Date.now();
          const accountId = getAccountIdFromUsage(c, usage);

          try {
            const input = tool.inputSchema.parse(toolArgs);
            const toolResult = await tool.execute(input, c.env);
            await metering.incrementUsage(c);

            emitToolTelemetry(c, {
              toolName,
              accountId,
              input: toolArgs,
              output: toolResult,
              durationMs: Date.now() - startedAt,
              success: true,
            });
            
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
            const errorMessage = execError instanceof Error ? execError.message : String(execError);
            emitToolTelemetry(c, {
              toolName,
              accountId,
              input: toolArgs,
              output: { error: errorMessage },
              durationMs: Date.now() - startedAt,
              success: false,
              error: errorMessage,
            });

            result = {
              content: [
                {
                  type: 'text',
                  text: `Error: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
          break;
        }
          
        case 'resources/list':
          const resourcesList = config.resources?.list() || [];
          result = {
            resources: telemetryEnabled
              ? mergeTelemetryResources(resourcesList, telemetryServerName)
              : resourcesList,
          };
          break;
          
        case 'resources/read': {
          const resourceParams = message.params as { uri: string };
          const resourceUri = resourceParams?.uri;

          if (!resourceUri) {
            return c.json({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32602, message: 'Missing resource uri' },
            });
          }

          if (telemetryEnabled && isTelemetryResourceUri(resourceUri)) {
            const accountId = await resolveTelemetryAccountId(c);
            const telemetryContent = await readTelemetryResource(
              c.env.DB,
              telemetryServerName,
              resourceUri,
              accountId,
            );
            if (!telemetryContent) {
              return c.json({
                jsonrpc: '2.0',
                id: message.id,
                error: { code: -32602, message: `Resource not found: ${resourceUri}` },
              });
            }
            result = { contents: [telemetryContent] };
            break;
          }

          if (!config.resources) {
            return c.json({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32602, message: 'Resources not supported' },
            });
          }
          
          const content = await config.resources.fetch(resourceUri, c.env);
          if (content === null) {
            return c.json({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32602, message: `Resource not found: ${resourceUri}` },
            });
          }
          result = {
            contents: [{
              uri: resourceUri,
              mimeType: 'application/json',
              text: JSON.stringify(content, null, 2),
            }],
          };
          break;
        }
          
        case 'prompts/list':
          result = {
            prompts: (config.prompts || []).map((prompt) => ({
              name: prompt.name,
              description: prompt.description,
              arguments: prompt.arguments,
            })),
          };
          break;

        case 'prompts/get': {
          const promptParams = message.params as { name: string; arguments?: Record<string, unknown> };
          const prompt = (config.prompts || []).find((entry) => entry.name === promptParams?.name);
          if (!prompt) {
            return c.json({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32602, message: `Unknown prompt: ${promptParams?.name}` },
            });
          }

          const args = promptParams?.arguments || {};
          const messages = prompt.render ? prompt.render(args) : (prompt.messages || []);
          result = {
            description: prompt.description,
            messages,
          };
          break;
        }
          
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

  app.get('/mcp/prompts', (c) => {
    return c.json({
      prompts: (config.prompts || []).map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })),
    });
  });

  app.get('/mcp/prompts/:name', (c) => {
    const promptName = c.req.param('name');
    const prompt = (config.prompts || []).find((entry) => entry.name === promptName);
    if (!prompt) {
      return c.json({ error: `Prompt not found: ${promptName}` }, 404);
    }

    const rawArgs = c.req.query('args');
    let args: Record<string, unknown> = {};
    if (rawArgs) {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        return c.json({ error: 'Invalid args JSON' }, 400);
      }
    }

    const messages = prompt.render ? prompt.render(args) : (prompt.messages || []);
    return c.json({
      description: prompt.description,
      messages,
    });
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

    const accountId = getAccountIdFromUsage(c, usage);
    
    const toolName = c.req.param('name');
    const tool = Object.values(config.tools).find((candidate: any) => candidate.name === toolName);
    
    if (!tool) {
      return c.json({
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      }, 404);
    }

    const startedAt = Date.now();
    let payload: Record<string, unknown> = {};

    try {
      const body = await c.req.json();
      payload = (body.arguments || body || {}) as Record<string, unknown>;
      const input = tool.inputSchema.parse(body.arguments || body);
      const result = await tool.execute(input, c.env);
      
      // Increment usage
      await metering.incrementUsage(c);

      emitToolTelemetry(c, {
        toolName,
        accountId,
        input: payload,
        output: result,
        durationMs: Date.now() - startedAt,
        success: true,
      });
      
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
      emitToolTelemetry(c, {
        toolName,
        accountId,
        input: payload,
        output: { error: message },
        durationMs: Date.now() - startedAt,
        success: false,
        error: message,
      });
      return c.json({
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      }, 400);
    }
  });
  
  // ============================================================================
  // Resources
  // ============================================================================
  
  app.get('/mcp/resources', (c) => {
    const baseResources = config.resources?.list() || [];
    return c.json({
      resources: telemetryEnabled
        ? mergeTelemetryResources(baseResources, telemetryServerName)
        : baseResources,
    });
  });

  app.get('/mcp/resources/read', async (c) => {
    const uri = c.req.query('uri');
    if (!uri) {
      return c.json({ error: 'Missing uri parameter' }, 400);
    }

    if (telemetryEnabled && isTelemetryResourceUri(uri)) {
      const accountId = await resolveTelemetryAccountId(c);
      const telemetryContent = await readTelemetryResource(c.env.DB, telemetryServerName, uri, accountId);
      if (!telemetryContent) {
        return c.json({ error: `Resource not found: ${uri}` }, 404);
      }

      return c.json({
        contents: [telemetryContent],
      });
    }

    if (!config.resources) {
      return c.json({ error: 'Resources not supported' }, 404);
    }

    const content = await config.resources.fetch(uri, c.env);
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

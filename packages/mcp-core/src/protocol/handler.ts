/**
 * MCP Protocol Handler
 * 
 * Handles JSON-RPC message routing for the MCP protocol.
 */

import type { Context } from 'hono';
import type { 
  BaseMCPEnv, 
  MCPServerConfig, 
  MCPTool, 
  MCPResource,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  UsageResult,
} from '../types';
import { checkUsage, incrementUsage } from '../metering/usage';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ProtocolHandlerConfig<TEnv extends BaseMCPEnv> {
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
  };
  tools: Record<string, MCPTool<any, any>>;
  resources?: {
    list: () => MCPResource[];
    fetch: (uri: string, env: TEnv) => Promise<unknown | null>;
  };
  tierLimits?: Record<string, number>;
}

/**
 * Create the message handler for Remote MCP Protocol
 * 
 * Stateless handler - matches OUTERFIELDS pattern where POST /sse
 * handles JSON-RPC without session management.
 */
export function createMessageHandler<TEnv extends BaseMCPEnv>(
  config: ProtocolHandlerConfig<TEnv>
) {
  return async (c: Context<{ Bindings: TEnv }>) => {
    try {
      const message = await c.req.json() as JsonRpcRequest;
      const response = await handleMessage(c, message, config);
      return c.json(response);
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
  };
}

/**
 * Handle a single JSON-RPC message
 */
async function handleMessage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  message: JsonRpcRequest,
  config: ProtocolHandlerConfig<TEnv>
): Promise<JsonRpcResponse> {
  let result: unknown;
  
  switch (message.method) {
    case 'initialize':
      result = {
        protocolVersion: '2024-11-05',
        serverInfo: config.serverInfo,
        capabilities: config.capabilities,
      };
      break;
      
    case 'tools/list':
      const tools = Object.values(config.tools).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema, { target: 'openApi3' }),
      }));
      result = { tools };
      break;
      
    case 'tools/call': {
      const params = message.params as { name: string; arguments?: Record<string, unknown> };
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      
      // Find tool by name property (not object key)
      const tool = Object.values(config.tools).find(t => t.name === toolName);
      if (!tool) {
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32602,
            message: `Unknown tool: ${toolName}`,
          },
        };
      }
      
      // Check usage limits
      const usage = await checkUsage(c, config.tierLimits as any);
      if (usage.exceeded) {
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32000,
            message: usage.tier === 'anonymous' 
              ? 'Free tier limit reached. Sign up at workway.co for more runs.'
              : `Monthly limit of ${usage.limit} runs exceeded.`,
          },
        };
      }
      
      // Execute tool
      try {
        const input = tool.inputSchema.parse(toolArgs);
        const toolResult = await tool.execute(input, c.env as TEnv);
        
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
      const resources = config.resources?.list() || [];
      result = { resources };
      break;
      
    case 'resources/read': {
      const resourceParams = message.params as { uri: string };
      if (!config.resources) {
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32602,
            message: 'Resources not supported',
          },
        };
      }
      
      const content = await config.resources.fetch(resourceParams?.uri, c.env as TEnv);
      if (content === null) {
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32602,
            message: `Resource not found: ${resourceParams?.uri}`,
          },
        };
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
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`,
        },
      };
  }
  
  return {
    jsonrpc: '2.0',
    id: message.id,
    result,
  };
}

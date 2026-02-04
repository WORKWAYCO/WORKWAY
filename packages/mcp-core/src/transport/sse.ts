/**
 * SSE Transport for Remote MCP Protocol
 * 
 * Implements the Server-Sent Events transport layer for Claude Cowork
 * and other Remote MCP clients.
 */

import type { Context } from 'hono';
import type { BaseMCPEnv } from '../types';

export interface SSESession {
  sessionId: string;
  messageEndpoint: string;
}

/**
 * Create an SSE endpoint handler for Remote MCP Protocol
 * 
 * Matches the pattern used by working MCP servers like OUTERFIELDS:
 * - GET /sse returns SSE stream with keep-alive pings
 * - POST /sse handles JSON-RPC messages (handled separately)
 */
export function createSSEHandler<TEnv extends BaseMCPEnv>() {
  return (c: Context<{ Bindings: TEnv }>) => {
    const encoder = new TextEncoder();
    
    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial comment to establish connection
        controller.enqueue(encoder.encode(': connected\n\n'));
        
        // Keep connection alive with periodic pings
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            // Stream closed, cleanup
            clearInterval(keepAlive);
          }
        }, 15000);
        
        // Store cleanup function
        (controller as any).cleanup = () => clearInterval(keepAlive);
      },
      cancel(controller) {
        if ((controller as any).cleanup) {
          (controller as any).cleanup();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Max-Age': '86400',
      },
    });
  };
}

/**
 * Create CORS preflight handler for message endpoint
 */
export function createMessageCORSHandler() {
  return () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  };
}

/**
 * Validate SSE session from KV
 */
export async function validateSession<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  sessionId: string
): Promise<boolean> {
  const session = await c.env.KV.get(`sse_session:${sessionId}`);
  return session === 'active';
}

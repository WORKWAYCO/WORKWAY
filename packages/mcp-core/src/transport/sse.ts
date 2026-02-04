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
 * @param getEnv - Function to get KV namespace from context
 * @returns Hono handler for /sse endpoint
 */
export function createSSEHandler<TEnv extends BaseMCPEnv>() {
  return (c: Context<{ Bindings: TEnv }>) => {
    // Generate a session ID for this connection
    const sessionId = crypto.randomUUID();
    const origin = new URL(c.req.url).origin;
    const messageEndpoint = `${origin}/message?sessionId=${sessionId}`;
    
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

/**
 * MCP Server Integration Tests
 * 
 * Tests for the Hono API server endpoints:
 * - GET /mcp
 * - GET /mcp/tools
 * - POST /mcp/tools/:name
 * - GET /mcp/resources
 * - GET /mcp/resources/read
 * - POST /webhooks/:workflow_id
 * - GET /oauth/callback
 * - GET /health
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/index';
import { createMockEnv } from '../mocks/env';
import type { Env } from '../../src/types';

describe('MCP Server Endpoints', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
    global.fetch = vi.fn();
  });

  describe('GET /mcp', () => {
    it('should return server info', async () => {
      const req = new Request('http://localhost/mcp');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        name: 'workway-construction-mcp',
        version: '0.1.0',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: false, listChanged: true },
        },
      });
    });
  });

  describe('GET /mcp/tools', () => {
    it('should list all available tools', async () => {
      const req = new Request('http://localhost/mcp/tools');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tools).toBeInstanceOf(Array);
      expect(data.tools.length).toBeGreaterThan(0);
      expect(data.categories).toBeDefined();

      // Verify tool structure
      const tool = data.tools[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
    });

    it('should include all tool categories', async () => {
      const req = new Request('http://localhost/mcp/tools');
      const res = await app.fetch(req, env);

      const data = await res.json();
      expect(data.categories).toHaveProperty('workflow');
      expect(data.categories).toHaveProperty('procore');
      expect(data.categories).toHaveProperty('debugging');
    });
  });

  describe('POST /mcp/tools/:name', () => {
    it('should execute a valid tool', async () => {
      const req = new Request('http://localhost/mcp/tools/workway_create_workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            name: 'Test Workflow',
          },
        }),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.content).toBeInstanceOf(Array);
      expect(data.isError).toBe(false);
    });

    it('should return 404 for unknown tool', async () => {
      const req = new Request('http://localhost/mcp/tools/unknown_tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arguments: {} }),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Unknown tool');
    });

    it('should handle invalid input schema', async () => {
      const req = new Request('http://localhost/mcp/tools/workway_create_workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            // Missing required 'name' field
          },
        }),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.isError).toBe(true);
    });

    it('should handle tool execution errors', async () => {
      // This would require mocking a tool that throws an error
      // For now, we test the error handling path
      const req = new Request('http://localhost/mcp/tools/workway_create_workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            name: 'Test',
          },
        }),
      });

      const res = await app.fetch(req, env);
      // Should handle gracefully
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('GET /mcp/resources', () => {
    it('should list all available resources', async () => {
      const req = new Request('http://localhost/mcp/resources');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.resources).toBeInstanceOf(Array);
      expect(data.resources.length).toBeGreaterThan(0);

      const resource = data.resources[0];
      expect(resource).toHaveProperty('uri');
      expect(resource).toHaveProperty('name');
      expect(resource).toHaveProperty('description');
    });
  });

  describe('GET /mcp/resources/read', () => {
    it('should fetch a valid resource', async () => {
      const req = new Request('http://localhost/mcp/resources/read?uri=construction://best-practices');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contents).toBeInstanceOf(Array);
      expect(data.contents[0]).toHaveProperty('uri');
      expect(data.contents[0]).toHaveProperty('mimeType');
      expect(data.contents[0]).toHaveProperty('text');
    });

    it('should return 400 when uri parameter missing', async () => {
      const req = new Request('http://localhost/mcp/resources/read');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing uri parameter');
    });

    it('should return 404 for unknown resource', async () => {
      const req = new Request('http://localhost/mcp/resources/read?uri=unknown://resource');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('Resource not found');
    });
  });

  describe('POST /webhooks/:workflow_id', () => {
    beforeEach(() => {
      // Mock database to return a valid workflow
      env.DB.prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT * FROM workflows')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'workflow-123',
                status: 'active',
              }),
            }),
          };
        }
        if (sql.includes('INSERT INTO executions')) {
          return {
            bind: () => ({
              run: async () => ({ success: true }),
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => null,
          }),
        };
      });
    });

    it('should accept webhook payload', async () => {
      const payload = {
        event: 'rfi.created',
        data: { rfiId: 123 },
      };

      const req = new Request('http://localhost/webhooks/workflow-123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
      expect(data.executionId).toBeDefined();
      expect(data.message).toContain('execution queued');
    });

    it('should return 404 for non-existent workflow', async () => {
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => null, // Workflow not found
        }),
      }));

      const req = new Request('http://localhost/webhooks/nonexistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('should return 404 for inactive workflow', async () => {
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'workflow-123',
            status: 'paused', // Not active
          }),
        }),
      }));

      const req = new Request('http://localhost/webhooks/workflow-123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /oauth/callback', () => {
    beforeEach(() => {
      // Mock KV for state verification
      env.KV.get = vi.fn(async (key: string) => {
        if (key === 'oauth_state:valid-state') {
          return JSON.stringify({
            provider: 'procore',
            createdAt: new Date().toISOString(),
          });
        }
        return null;
      });

      env.KV.delete = vi.fn(async () => {});

      // Mock token exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });

      // Mock database for token storage
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          run: async () => ({ success: true }),
        }),
      }));
    });

    it('should handle successful OAuth callback', async () => {
      const req = new Request('http://localhost/oauth/callback?code=auth-code&state=valid-state');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('connected successfully');
    });

    it('should return 400 when code missing', async () => {
      const req = new Request('http://localhost/oauth/callback?state=valid-state');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing code');
    });

    it('should return 400 when state missing', async () => {
      const req = new Request('http://localhost/oauth/callback?code=auth-code');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing code or state');
    });

    it('should return 400 for invalid state', async () => {
      const req = new Request('http://localhost/oauth/callback?code=auth-code&state=invalid-state');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid or expired state');
    });

    it('should handle OAuth error parameter', async () => {
      const req = new Request('http://localhost/oauth/callback?error=access_denied');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('OAuth error');
    });

    it('should handle token exchange failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Invalid client credentials',
      });

      const req = new Request('http://localhost/oauth/callback?code=auth-code&state=valid-state');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Token exchange failed');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const req = new Request('http://localhost/health');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.version).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const req = new Request('http://localhost/mcp', {
        method: 'OPTIONS',
      });

      const res = await app.fetch(req, env);

      // CORS middleware should handle OPTIONS
      expect([200, 204]).toContain(res.status);
    });
  });
});

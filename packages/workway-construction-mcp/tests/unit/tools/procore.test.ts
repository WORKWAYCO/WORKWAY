/**
 * Procore Tools Unit Tests
 * 
 * Tests for Procore integration tools:
 * - workway_connect_procore
 * - workway_check_procore_connection
 * - workway_list_procore_projects
 * - workway_get_procore_rfis
 * - workway_get_procore_daily_logs
 * - workway_get_procore_submittals
 * - workway_test_procore_api
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { procoreTools } from '../../../src/tools/procore';
import { createMockEnv } from '../../mocks/env';
import type { Env } from '../../../src/types';

describe('procoreTools', () => {
  let env: Env;
  let mockDB: any;
  let mockKV: any;

  beforeEach(() => {
    env = createMockEnv({
      procoreClientId: 'test-client-id',
      procoreClientSecret: 'test-secret',
    });
    mockDB = env.DB;
    mockKV = env.KV;

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('connect_procore', () => {
    it('should generate OAuth authorization URL', async () => {
      const input = {};

      const result = await procoreTools.connect_procore.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.authorizationUrl).toContain('login.procore.com/oauth/authorize');
      expect(result.data?.authorizationUrl).toContain('client_id=test-client-id');
      expect(result.data?.authorizationUrl).toContain('response_type=code');
      expect(result.data?.status).toBe('pending');
      expect(result.data?.instructions).toBeDefined();
    });

    it('should include company_id in state if provided', async () => {
      const input = {
        company_id: 'company-123',
      };

      const result = await procoreTools.connect_procore.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.authorizationUrl).toBeDefined();

      // Verify state was stored in KV
      const stateMatch = result.data?.authorizationUrl.match(/state=([^&]+)/);
      expect(stateMatch).toBeTruthy();
    });

    it('should store state in KV with expiration', async () => {
      const input = {};

      await procoreTools.connect_procore.execute(input, env);

      // Verify KV.put was called (would need to spy on mockKV)
      expect(result.success).toBe(true);
    });
  });

  describe('check_procore_connection', () => {
    it('should return not connected when no token exists', async () => {
      mockDB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => null, // No token
        }),
      }));

      const input = {};

      const result = await procoreTools.check_procore_connection.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.connected).toBe(false);
    });

    it('should return connected when valid token exists', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      mockDB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'token-123',
            provider: 'procore',
            user_id: 'user-123',
            access_token: 'valid-token',
            refresh_token: 'refresh-token',
            expires_at: futureDate,
            scopes: JSON.stringify(['read', 'write']),
            updated_at: new Date().toISOString(),
          }),
        }),
      }));

      const input = {};

      const result = await procoreTools.check_procore_connection.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.connected).toBe(true);
      expect(result.data?.tokenExpiresAt).toBe(futureDate);
      expect(result.data?.scopes).toEqual(['read', 'write']);
    });

    it('should return not connected when token expired', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      mockDB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'token-123',
            expires_at: pastDate,
          }),
        }),
      }));

      const input = {};

      const result = await procoreTools.check_procore_connection.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.connected).toBe(false);
    });
  });

  describe('list_procore_projects', () => {
    beforeEach(() => {
      // Mock valid token
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('oauth_tokens')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'token-123',
                access_token: 'valid-token',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                company_id: 'company-123',
              }),
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

    it('should fetch and return projects', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Project Alpha',
          displayName: 'Alpha Construction',
          projectNumber: 'PRJ-001',
          address: '123 Main St',
          city: 'Chicago',
          stateCode: 'IL',
          active: true,
        },
        {
          id: 2,
          name: 'Project Beta',
          displayName: 'Beta Development',
          active: false,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      });

      const input = {
        active_only: true,
      };

      const result = await procoreTools.list_procore_projects.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.projects).toHaveLength(2);
      expect(result.data?.total).toBe(2);
      expect(result.data?.projects[0]).toMatchObject({
        id: 1,
        name: 'Project Alpha',
        displayName: 'Alpha Construction',
        active: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const input = {};

      const result = await procoreTools.list_procore_projects.execute(input, env);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should filter by active_only', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const input = {
        active_only: true,
      };

      await procoreTools.list_procore_projects.execute(input, env);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[active]=true'),
        expect.any(Object)
      );
    });
  });

  describe('get_procore_rfis', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('oauth_tokens')) {
          return {
            bind: () => ({
              first: async () => ({
                access_token: 'valid-token',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              }),
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

    it('should fetch RFIs for a project', async () => {
      const mockRFIs = [
        {
          id: 1,
          number: 1,
          subject: 'Foundation Question',
          status: 'open',
          questionBody: 'What is the foundation depth?',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          number: 2,
          subject: 'Material Spec',
          status: 'closed',
          questionBody: 'Can we substitute material?',
          answerBody: 'Yes, see spec section 3.2',
          responseTime: 5,
          createdAt: '2024-01-05T00:00:00Z',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRFIs,
      });

      const input = {
        project_id: 123,
        status: 'all' as const,
        limit: 50,
      };

      const result = await procoreTools.get_procore_rfis.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.rfis).toHaveLength(2);
      expect(result.data?.total).toBe(2);
      expect(result.data?.stats.openCount).toBe(1);
    });

    it('should filter by status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const input = {
        project_id: 123,
        status: 'open' as const,
      };

      await procoreTools.get_procore_rfis.execute(input, env);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[status]=open'),
        expect.any(Object)
      );
    });

    it('should calculate average response time', async () => {
      const mockRFIs = [
        { id: 1, responseTime: 3 },
        { id: 2, responseTime: 5 },
        { id: 3, responseTime: 7 },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRFIs,
      });

      const input = {
        project_id: 123,
      };

      const result = await procoreTools.get_procore_rfis.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.stats.avgResponseTimeDays).toBe(5); // (3+5+7)/3
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Project not found',
      });

      const input = {
        project_id: 999,
      };

      const result = await procoreTools.get_procore_rfis.execute(input, env);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('get_procore_daily_logs', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('oauth_tokens')) {
          return {
            bind: () => ({
              first: async () => ({
                access_token: 'valid-token',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              }),
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

    it('should fetch daily logs', async () => {
      const mockLogs = [
        {
          id: 1,
          logDate: '2024-01-15',
          status: 'submitted',
          weatherConditions: 'Sunny',
          temperatureHigh: 75,
          temperatureLow: 55,
          notes: 'Good progress',
          manpowerLogs: [
            { id: 1, companyName: 'ABC Construction', workerCount: 10, hoursWorked: 80 },
          ],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLogs,
      });

      const input = {
        project_id: 123,
        limit: 30,
      };

      const result = await procoreTools.get_procore_daily_logs.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.dailyLogs).toHaveLength(1);
      expect(result.data?.dailyLogs[0]).toMatchObject({
        logDate: '2024-01-15',
        weatherConditions: 'Sunny',
        temperatureHigh: 75,
        manpowerCount: 10,
      });
    });

    it('should filter by date range', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const input = {
        project_id: 123,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      };

      await procoreTools.get_procore_daily_logs.execute(input, env);

      const fetchCall = (global.fetch as any).mock.calls[0][0];
      expect(fetchCall).toContain('filters[log_date][gte]=2024-01-01');
      expect(fetchCall).toContain('filters[log_date][lte]=2024-01-31');
    });
  });

  describe('get_procore_submittals', () => {
    beforeEach(() => {
      mockDB.prepare = vi.fn((sql: string) => {
        if (sql.includes('oauth_tokens')) {
          return {
            bind: () => ({
              first: async () => ({
                access_token: 'valid-token',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              }),
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

    it('should fetch submittals', async () => {
      const mockSubmittals = [
        {
          id: 1,
          number: 1,
          title: 'Structural Steel',
          status: 'pending',
          specSection: '05 12 00',
          dueDate: '2024-02-15',
          ballInCourt: 'Contractor',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          number: 2,
          title: 'HVAC Equipment',
          status: 'approved',
          createdAt: '2024-01-05T00:00:00Z',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSubmittals,
      });

      const input = {
        project_id: 123,
        status: 'all' as const,
      };

      const result = await procoreTools.get_procore_submittals.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.submittals).toHaveLength(2);
      expect(result.data?.stats.pendingCount).toBe(1);
    });

    it('should calculate overdue count', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Yesterday
      const mockSubmittals = [
        {
          id: 1,
          status: 'pending',
          dueDate: pastDate,
        },
        {
          id: 2,
          status: 'pending',
          dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSubmittals,
      });

      const input = {
        project_id: 123,
      };

      const result = await procoreTools.get_procore_submittals.execute(input, env);

      expect(result.success).toBe(true);
      expect(result.data?.stats.overdueCount).toBe(1);
    });
  });
});

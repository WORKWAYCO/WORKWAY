/**
 * Procore Client Integration Tests
 * 
 * Tests for ProcoreClient class:
 * - Token retrieval and caching
 * - Token refresh logic
 * - API request handling
 * - Error handling (401, 403, 429, 500)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcoreClient, ProcoreError } from '../../src/lib/procore-client';
import { createMockEnv } from '../mocks/env';
import type { Env } from '../../src/types';

describe('ProcoreClient', () => {
  let env: Env;
  let client: ProcoreClient;

  beforeEach(() => {
    env = createMockEnv();
    client = new ProcoreClient({ env });
    global.fetch = vi.fn();
  });

  describe('getToken', () => {
    it('should retrieve token from database', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'token-123',
            provider: 'procore',
            user_id: 'user-123',
            access_token: 'test-token',
            refresh_token: 'refresh-token',
            expires_at: futureDate,
            scopes: JSON.stringify(['read', 'write']),
            created_at: new Date().toISOString(),
          }),
        }),
      }));

      const token = await client.getToken();

      expect(token.accessToken).toBe('test-token');
      expect(token.refreshToken).toBe('refresh-token');
      expect(token.expiresAt).toBe(futureDate);
    });

    it('should throw error when not connected', async () => {
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => null, // No token
        }),
      }));

      await expect(client.getToken()).rejects.toThrow(ProcoreError);
      await expect(client.getToken()).rejects.toThrow('Not connected to Procore');
    });

    it('should refresh token when expired', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      // Mock expired token
      env.DB.prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'token-123',
                access_token: 'old-token',
                refresh_token: 'refresh-token',
                expires_at: pastDate,
                user_id: 'user-123',
                provider: 'procore',
                created_at: new Date().toISOString(),
              }),
            }),
          };
        }
        if (sql.includes('UPDATE')) {
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

      // Mock refresh token endpoint
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });

      const token = await client.getToken();

      expect(token.accessToken).toBe('new-access-token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/token'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error when refresh token missing', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();

      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'token-123',
            access_token: 'old-token',
            refresh_token: null, // No refresh token
            expires_at: pastDate,
            user_id: 'user-123',
            provider: 'procore',
            created_at: new Date().toISOString(),
          }),
        }),
      }));

      await expect(client.getToken()).rejects.toThrow(ProcoreError);
      await expect(client.getToken()).rejects.toThrow('token expired');
    });

    it('should cache token when valid', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      let callCount = 0;

      env.DB.prepare = vi.fn(() => {
        callCount++;
        return {
          bind: () => ({
            first: async () => ({
              id: 'token-123',
              access_token: 'test-token',
              refresh_token: 'refresh-token',
              expires_at: futureDate,
              user_id: 'user-123',
              provider: 'procore',
              created_at: new Date().toISOString(),
            }),
          }),
        };
      });

      // First call
      const token1 = await client.getToken();
      expect(callCount).toBe(1);

      // Second call should use cache
      const token2 = await client.getToken();
      expect(callCount).toBe(1); // Should not call DB again
      expect(token1.accessToken).toBe(token2.accessToken);
    });
  });

  describe('request', () => {
    beforeEach(() => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'token-123',
            access_token: 'test-token',
            expires_at: futureDate,
            user_id: 'user-123',
            provider: 'procore',
            created_at: new Date().toISOString(),
          }),
        }),
      }));
    });

    it('should make authenticated request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const result = await client.request('/projects');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should include company ID header when set', async () => {
      const clientWithCompany = new ProcoreClient({
        env,
        companyId: 'company-123',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await clientWithCompany.request('/projects');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Procore-Company-Id': 'company-123',
          }),
        })
      );
    });

    it('should handle 401 Unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(client.request('/projects')).rejects.toThrow(ProcoreError);
      await expect(client.request('/projects')).rejects.toThrow('authentication failed');
    });

    it('should handle 403 Forbidden', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      await expect(client.request('/projects')).rejects.toThrow(ProcoreError);
      await expect(client.request('/projects')).rejects.toThrow('Access denied');
    });

    it('should handle 429 Rate Limited', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(client.request('/projects')).rejects.toThrow(ProcoreError);
      await expect(client.request('/projects')).rejects.toThrow('rate limit');
    });

    it('should handle generic API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(client.request('/projects')).rejects.toThrow(ProcoreError);
      await expect(client.request('/projects')).rejects.toThrow('API error');
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      env.DB.prepare = vi.fn(() => ({
        bind: () => ({
          first: async () => ({
            id: 'token-123',
            access_token: 'test-token',
            expires_at: futureDate,
            user_id: 'user-123',
            provider: 'procore',
            created_at: new Date().toISOString(),
          }),
        }),
      }));
    });

    it('should get projects with filters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: 'Project 1', active: true },
        ],
      });

      const projects = await client.getProjects({ active: true });

      expect(projects).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[active]=true'),
        expect.any(Object)
      );
    });

    it('should get RFIs with filters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, number: 1, subject: 'Test RFI', status: 'open' },
        ],
      });

      const rfis = await client.getRFIs(123, { status: 'open', limit: 10 });

      expect(rfis).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/123/rfis'),
        expect.any(Object)
      );
    });

    it('should get daily logs with date range', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, logDate: '2024-01-15', status: 'submitted' },
        ],
      });

      const logs = await client.getDailyLogs(123, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 30,
      });

      expect(logs).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[log_date][gte]=2024-01-01'),
        expect.any(Object)
      );
    });

    it('should get submittals with status filter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, number: 1, title: 'Test Submittal', status: 'pending' },
        ],
      });

      const submittals = await client.getSubmittals(123, {
        status: 'pending',
        limit: 50,
      });

      expect(submittals).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[status]=pending'),
        expect.any(Object)
      );
    });
  });
});

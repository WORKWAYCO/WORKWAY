/**
 * Mock Environment Factory
 * 
 * Creates mock Env objects for testing with D1, KV, and Durable Objects
 */

import type { Env } from '../../src/types';

export interface MockEnvOptions {
  dbData?: Record<string, any[]>;
  kvData?: Record<string, string>;
  procoreClientId?: string;
  procoreClientSecret?: string;
}

export function createMockEnv(options: MockEnvOptions = {}): Env {
  const dbData = options.dbData || {};
  const kvData = options.kvData || {};

  // Mock D1 Database
  const mockDB = {
    prepare: (sql: string) => {
      return {
        bind: (...params: any[]) => {
          return {
            first: async <T>(): Promise<T | null> => {
              const table = extractTableName(sql);
              const rows = dbData[table] || [];
              return (rows[0] as T) || null;
            },
            all: async <T>(): Promise<{ results: T[] }> => {
              const table = extractTableName(sql);
              const rows = dbData[table] || [];
              return { results: rows as T[] };
            },
            run: async () => {
              return { success: true, meta: {} };
            },
          };
        },
        first: async <T>(): Promise<T | null> => {
          const table = extractTableName(sql);
          const rows = dbData[table] || [];
          return (rows[0] as T) || null;
        },
        all: async <T>(): Promise<{ results: T[] }> => {
          const table = extractTableName(sql);
          const rows = dbData[table] || [];
          return { results: rows as T[] };
        },
        run: async () => {
          return { success: true, meta: {} };
        },
      };
    },
    batch: async (statements: any[]) => {
      return statements.map(() => ({ success: true, meta: {} }));
    },
  } as any;

  // Mock KV Namespace
  const mockKV = {
    get: async (key: string, type?: 'text' | 'json') => {
      const value = kvData[key];
      if (!value) return null;
      if (type === 'json') return JSON.parse(value);
      return value;
    },
    put: async (key: string, value: string, options?: any) => {
      kvData[key] = value;
    },
    delete: async (key: string) => {
      delete kvData[key];
    },
    list: async () => {
      return { keys: Object.keys(kvData).map(k => ({ name: k })) };
    },
  } as any;

  // Mock Durable Object Namespace
  const mockDO = {
    idFromName: (name: string) => ({ toString: () => name }),
    get: (id: any) => ({
      fetch: async (request: Request) => {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    }),
  } as any;

  return {
    DB: mockDB,
    KV: mockKV,
    WORKFLOW_STATE: mockDO,
    PROCORE_CLIENT_ID: options.procoreClientId || 'test-client-id',
    PROCORE_CLIENT_SECRET: options.procoreClientSecret || 'test-client-secret',
    COOKIE_ENCRYPTION_KEY: 'test-encryption-key',
    ENVIRONMENT: 'test',
  };
}

/**
 * Extract table name from SQL query (simple heuristic)
 */
function extractTableName(sql: string): string {
  const match = sql.match(/FROM\s+(\w+)/i) || sql.match(/INTO\s+(\w+)/i) || sql.match(/UPDATE\s+(\w+)/i);
  return match ? match[1] : 'unknown';
}

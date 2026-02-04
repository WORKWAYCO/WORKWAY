/**
 * Database Utilities
 * 
 * Helper functions for D1 database operations.
 */

import type { Env } from '../types';

/**
 * Generate a UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Execute a query and return results
 */
export async function query<T>(
  env: Env,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const stmt = env.DB.prepare(sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<T>();
  return result.results || [];
}

/**
 * Execute a query and return first result
 */
export async function queryOne<T>(
  env: Env,
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const stmt = env.DB.prepare(sql);
  return await (params.length > 0 ? stmt.bind(...params) : stmt).first<T>();
}

/**
 * Execute an insert/update/delete
 */
export async function execute(
  env: Env,
  sql: string,
  params: any[] = []
): Promise<D1Result> {
  const stmt = env.DB.prepare(sql);
  return await (params.length > 0 ? stmt.bind(...params) : stmt).run();
}

/**
 * Transaction helper (D1 doesn't support real transactions yet, but this helps with batching)
 */
export async function batch(
  env: Env,
  statements: { sql: string; params?: any[] }[]
): Promise<D1Result[]> {
  const stmts = statements.map(({ sql, params }) => {
    const stmt = env.DB.prepare(sql);
    return params?.length ? stmt.bind(...params) : stmt;
  });
  return await env.DB.batch(stmts);
}

/**
 * Workflow-specific queries
 */
export const workflows = {
  async getById(env: Env, id: string) {
    return queryOne(env, 'SELECT * FROM workflows WHERE id = ?', [id]);
  },

  async getByProjectId(env: Env, projectId: string) {
    return query(env, 'SELECT * FROM workflows WHERE project_id = ?', [projectId]);
  },

  async getActive(env: Env) {
    return query(env, 'SELECT * FROM workflows WHERE status = ?', ['active']);
  },

  async updateStatus(env: Env, id: string, status: string) {
    return execute(
      env,
      'UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?',
      [status, now(), id]
    );
  },
};

/**
 * Execution-specific queries
 */
export const executions = {
  async getById(env: Env, id: string) {
    return queryOne(env, 'SELECT * FROM executions WHERE id = ?', [id]);
  },

  async getByWorkflowId(env: Env, workflowId: string, limit = 10) {
    return query(
      env,
      'SELECT * FROM executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
      [workflowId, limit]
    );
  },

  async create(env: Env, data: {
    id: string;
    workflowId: string;
    status: string;
    inputData?: any;
  }) {
    return execute(
      env,
      'INSERT INTO executions (id, workflow_id, status, started_at, input_data) VALUES (?, ?, ?, ?, ?)',
      [data.id, data.workflowId, data.status, now(), data.inputData ? JSON.stringify(data.inputData) : null]
    );
  },

  async complete(env: Env, id: string, data: {
    status: string;
    outputData?: any;
    error?: string;
  }) {
    return execute(
      env,
      'UPDATE executions SET status = ?, completed_at = ?, output_data = ?, error = ? WHERE id = ?',
      [data.status, now(), data.outputData ? JSON.stringify(data.outputData) : null, data.error || null, id]
    );
  },
};

/**
 * OAuth token queries
 */
export const tokens = {
  async getByProvider(env: Env, provider: string) {
    return queryOne(env, 'SELECT * FROM oauth_tokens WHERE provider = ? LIMIT 1', [provider]);
  },

  async upsert(env: Env, data: {
    id: string;
    provider: string;
    userId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    companyId?: string;
  }) {
    // Delete existing token for provider
    await execute(env, 'DELETE FROM oauth_tokens WHERE provider = ?', [data.provider]);
    
    // Insert new token
    return execute(
      env,
      `INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, company_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.id, data.provider, data.userId, data.accessToken, data.refreshToken || null, data.expiresAt || null, data.companyId || null, now()]
    );
  },
};

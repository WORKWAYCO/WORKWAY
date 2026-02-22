/**
 * Database Utilities
 * 
 * Helper functions for D1 database operations.
 */

import type {
  Env,
  ApprovalRecord,
  ApprovalStatus,
  ApprovalTier,
  DecisionRecord,
  JudgmentDecisionStatus,
  JudgmentPolicy,
  PolicyVersion,
  ToolAccessPack,
} from '../types';

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

// ============================================================================
// Tenant + Judgment Axis helpers
// ============================================================================

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/**
 * Resolve tenant for a user.
 *
 * Behavior:
 * - If tenant is supplied, validates active membership.
 * - Otherwise returns first active membership.
 * - Falls back to "tenant_default" when migration is not yet applied.
 */
export async function resolveTenantId(
  env: Env,
  userId: string,
  tenantId?: string
): Promise<string | null> {
  if (!userId) return null;

  try {
    if (tenantId) {
      const membership = await queryOne<{ tenant_id: string }>(
        env,
        `
          SELECT tenant_id
          FROM tenant_memberships
          WHERE tenant_id = ? AND user_id = ? AND status = 'active'
          LIMIT 1
        `,
        [tenantId, userId]
      );
      return membership?.tenant_id || null;
    }

    const membership = await queryOne<{ tenant_id: string }>(
      env,
      `
        SELECT tenant_id
        FROM tenant_memberships
        WHERE user_id = ? AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [userId]
    );

    return membership?.tenant_id || null;
  } catch {
    // Migration may not be applied yet
    return tenantId || 'tenant_default';
  }
}

export async function getActivePolicy(
  env: Env,
  tenantId: string,
  policyType = 'default'
): Promise<{ policy: JudgmentPolicy | null; version: PolicyVersion | null }> {
  try {
    const policy = await queryOne<any>(
      env,
      `
        SELECT *
        FROM judgment_policies
        WHERE tenant_id = ? AND policy_type = ? AND status = 'active'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [tenantId, policyType]
    );

    if (!policy) {
      return { policy: null, version: null };
    }

    const version = await queryOne<any>(
      env,
      `
        SELECT *
        FROM judgment_policy_versions
        WHERE policy_id = ? AND status = 'active'
        ORDER BY version DESC, effective_at DESC
        LIMIT 1
      `,
      [policy.id]
    );

    const normalizedPolicy: JudgmentPolicy = {
      id: policy.id,
      tenantId: policy.tenant_id,
      name: policy.name,
      policyType: policy.policy_type,
      status: policy.status,
      createdBy: policy.created_by,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at,
    };

    const normalizedVersion: PolicyVersion | null = version
      ? {
          id: version.id,
          policyId: version.policy_id,
          tenantId: version.tenant_id,
          version: version.version,
          policyJson: version.policy_json,
          trustProfileJson: version.trust_profile_json,
          status: version.status,
          effectiveAt: version.effective_at,
          createdBy: version.created_by,
          createdAt: version.created_at,
        }
      : null;

    return { policy: normalizedPolicy, version: normalizedVersion };
  } catch {
    return { policy: null, version: null };
  }
}

export async function createDecision(
  env: Env,
  input: {
    tenantId: string;
    userId: string;
    projectId?: string;
    toolkitSlug?: string;
    toolSlug: string;
    provider: string;
    policyId?: string | null;
    policyVersionId?: string | null;
    riskScore: number;
    requiredApprovalTier?: ApprovalTier | null;
    status: JudgmentDecisionStatus;
    reason?: string;
    args?: Record<string, unknown>;
  }
): Promise<DecisionRecord> {
  const id = generateId();
  const timestamp = now();

  await execute(
    env,
    `
      INSERT INTO judgment_decisions (
        id, tenant_id, policy_id, policy_version_id, user_id, project_id,
        toolkit_slug, tool_slug, provider, arguments_json, risk_score,
        required_approval_tier, status, reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.tenantId,
      input.policyId || null,
      input.policyVersionId || null,
      input.userId,
      input.projectId || null,
      input.toolkitSlug || null,
      input.toolSlug,
      input.provider,
      input.args ? JSON.stringify(input.args) : null,
      input.riskScore,
      input.requiredApprovalTier || null,
      input.status,
      input.reason || null,
      timestamp,
      timestamp,
    ]
  );

  return {
    id,
    tenantId: input.tenantId,
    policyId: input.policyId || null,
    policyVersionId: input.policyVersionId || null,
    userId: input.userId,
    projectId: input.projectId || null,
    toolkitSlug: input.toolkitSlug || null,
    toolSlug: input.toolSlug,
    provider: input.provider,
    argumentsJson: input.args ? JSON.stringify(input.args) : null,
    riskScore: input.riskScore,
    requiredApprovalTier: input.requiredApprovalTier || null,
    status: input.status,
    reason: input.reason || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function updateDecision(
  env: Env,
  input: {
    decisionId: string;
    tenantId: string;
    status: JudgmentDecisionStatus;
    decidedBy?: string;
    reason?: string;
    executionResult?: unknown;
    evidenceR2Key?: string;
  }
): Promise<void> {
  await execute(
    env,
    `
      UPDATE judgment_decisions
      SET status = ?,
          decided_by = COALESCE(?, decided_by),
          decided_at = CASE WHEN ? IS NOT NULL THEN ? ELSE decided_at END,
          reason = COALESCE(?, reason),
          execution_result_json = COALESCE(?, execution_result_json),
          evidence_r2_key = COALESCE(?, evidence_r2_key),
          updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `,
    [
      input.status,
      input.decidedBy || null,
      input.decidedBy || null,
      input.decidedBy ? now() : null,
      input.reason || null,
      input.executionResult !== undefined ? JSON.stringify(input.executionResult) : null,
      input.evidenceR2Key || null,
      now(),
      input.decisionId,
      input.tenantId,
    ]
  );
}

export async function getDecision(
  env: Env,
  tenantId: string,
  decisionId: string
): Promise<DecisionRecord | null> {
  const row = await queryOne<any>(
    env,
    `
      SELECT *
      FROM judgment_decisions
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `,
    [decisionId, tenantId]
  );

  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    policyId: row.policy_id,
    policyVersionId: row.policy_version_id,
    userId: row.user_id,
    projectId: row.project_id,
    toolkitSlug: row.toolkit_slug,
    toolSlug: row.tool_slug,
    provider: row.provider,
    argumentsJson: row.arguments_json,
    riskScore: row.risk_score,
    requiredApprovalTier: row.required_approval_tier,
    status: row.status,
    reason: row.reason,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    evidenceR2Key: row.evidence_r2_key,
    executionResultJson: row.execution_result_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPendingDecisions(
  env: Env,
  tenantId: string,
  limit = 50
): Promise<DecisionRecord[]> {
  const rows = await query<any>(
    env,
    `
      SELECT *
      FROM judgment_decisions
      WHERE tenant_id = ? AND status = 'pending_approval'
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [tenantId, limit]
  );

  return rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    policyId: row.policy_id,
    policyVersionId: row.policy_version_id,
    userId: row.user_id,
    projectId: row.project_id,
    toolkitSlug: row.toolkit_slug,
    toolSlug: row.tool_slug,
    provider: row.provider,
    argumentsJson: row.arguments_json,
    riskScore: row.risk_score,
    requiredApprovalTier: row.required_approval_tier,
    status: row.status,
    reason: row.reason,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    evidenceR2Key: row.evidence_r2_key,
    executionResultJson: row.execution_result_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createApproval(
  env: Env,
  input: {
    decisionId: string;
    tenantId: string;
    approverUserId: string;
    approvalTier: ApprovalTier;
    status: ApprovalStatus;
    note?: string;
  }
): Promise<ApprovalRecord> {
  const id = generateId();
  const createdAt = now();

  await execute(
    env,
    `
      INSERT INTO judgment_approvals (
        id, decision_id, tenant_id, approver_user_id, approval_tier, status, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.decisionId,
      input.tenantId,
      input.approverUserId,
      input.approvalTier,
      input.status,
      input.note || null,
      createdAt,
    ]
  );

  return {
    id,
    decisionId: input.decisionId,
    tenantId: input.tenantId,
    approverUserId: input.approverUserId,
    approvalTier: input.approvalTier,
    status: input.status,
    note: input.note || null,
    createdAt,
  };
}

export async function listToolAccessPacks(
  env: Env,
  tenantId: string
): Promise<ToolAccessPack[]> {
  try {
    const rows = await query<any>(
      env,
      `
        SELECT *
        FROM tool_access_packs
        WHERE tenant_id = ? AND status = 'active'
        ORDER BY name ASC
      `,
      [tenantId]
    );

    return rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Returns true if explicitly allowlisted and not denied.
 * If no rules exist, fail-closed (false).
 */
export async function isToolAllowedForTenant(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string
): Promise<boolean> {
  try {
    const rows = await query<{ rule_type: 'allow' | 'deny' }>(
      env,
      `
        SELECT r.rule_type
        FROM tool_access_rules r
        INNER JOIN tool_access_packs p ON p.id = r.pack_id
        WHERE r.tenant_id = ?
          AND p.status = 'active'
          AND r.toolkit_slug = ?
          AND (r.tool_slug IS NULL OR r.tool_slug = ?)
      `,
      [tenantId, toolkitSlug, toolSlug]
    );

    if (rows.length === 0) {
      return false;
    }

    if (rows.some((row) => row.rule_type === 'deny')) {
      return false;
    }

    return rows.some((row) => row.rule_type === 'allow');
  } catch {
    return false;
  }
}

export async function upsertProviderConnection(
  env: Env,
  input: {
    tenantId: string;
    userId: string;
    provider: string;
    toolkitSlug?: string;
    authConfigId?: string;
    connectedAccountId?: string;
    status: 'active' | 'pending' | 'revoked' | 'expired' | 'error';
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const id = generateId();
    const timestamp = now();

    await execute(
      env,
      `
        INSERT INTO provider_connections (
          id, tenant_id, user_id, provider, toolkit_slug, auth_config_id,
          connected_account_id, status, metadata_json, created_at, updated_at, last_checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, user_id, provider, toolkit_slug) DO UPDATE SET
          auth_config_id = excluded.auth_config_id,
          connected_account_id = excluded.connected_account_id,
          status = excluded.status,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at,
          last_checked_at = excluded.last_checked_at
      `,
      [
        id,
        input.tenantId,
        input.userId,
        input.provider,
        input.toolkitSlug || null,
        input.authConfigId || null,
        input.connectedAccountId || null,
        input.status,
        input.metadata ? JSON.stringify(input.metadata) : null,
        timestamp,
        timestamp,
        timestamp,
      ]
    );
  } catch {
    // Keep this non-blocking for older environments.
  }
}

export async function getProviderConnection(
  env: Env,
  input: {
    tenantId: string;
    userId: string;
    provider: string;
    toolkitSlug?: string;
  }
): Promise<{
  connectedAccountId?: string | null;
  status?: string | null;
  authConfigId?: string | null;
  metadata?: string | null;
} | null> {
  try {
    return await queryOne(
      env,
      `
        SELECT connected_account_id AS connectedAccountId,
               status,
               auth_config_id AS authConfigId,
               metadata_json AS metadata
        FROM provider_connections
        WHERE tenant_id = ? AND user_id = ? AND provider = ? AND toolkit_slug IS ?
        LIMIT 1
      `,
      [input.tenantId, input.userId, input.provider, input.toolkitSlug || null]
    );
  } catch {
    return null;
  }
}

export async function appendExecutionLedger(
  env: Env,
  input: {
    tenantId: string;
    decisionId?: string;
    userId: string;
    toolkitSlug?: string;
    toolSlug: string;
    provider: string;
    status: 'executed' | 'denied' | 'pending_approval' | 'failed';
    requestArgs?: Record<string, unknown>;
    result?: unknown;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const previous = await queryOne<{ entry_hash: string }>(
      env,
      `
        SELECT entry_hash
        FROM execution_ledger
        WHERE tenant_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [input.tenantId]
    );

    const inputHash = input.requestArgs ? await sha256Hex(JSON.stringify(input.requestArgs)) : null;
    const outputHash = input.result !== undefined ? await sha256Hex(JSON.stringify(input.result)) : null;
    const previousHash = previous?.entry_hash || null;
    const createdAt = now();

    const chainPayload = JSON.stringify({
      tenantId: input.tenantId,
      decisionId: input.decisionId || null,
      userId: input.userId,
      toolkitSlug: input.toolkitSlug || null,
      toolSlug: input.toolSlug,
      provider: input.provider,
      status: input.status,
      inputHash,
      outputHash,
      previousHash,
      createdAt,
    });
    const entryHash = await sha256Hex(chainPayload);

    await execute(
      env,
      `
        INSERT INTO execution_ledger (
          id, tenant_id, decision_id, user_id, toolkit_slug, tool_slug, provider, status,
          input_hash, output_hash, previous_hash, entry_hash, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        generateId(),
        input.tenantId,
        input.decisionId || null,
        input.userId,
        input.toolkitSlug || null,
        input.toolSlug,
        input.provider,
        input.status,
        inputHash,
        outputHash,
        previousHash,
        entryHash,
        input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt,
      ]
    );

    return entryHash;
  } catch {
    // Ledger writes are best-effort until migration is universal.
    return null;
  }
}

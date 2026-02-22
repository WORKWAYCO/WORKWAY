import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../src/types';
import { createMockEnv } from '../mocks/env';

type MutableDecision = {
  id: string;
  tenantId: string;
  policyId?: string | null;
  policyVersionId?: string | null;
  userId: string;
  projectId?: string | null;
  toolkitSlug?: string | null;
  toolSlug: string;
  provider: string;
  argumentsJson?: string | null;
  riskScore: number;
  requiredApprovalTier?: string | null;
  status: 'approved' | 'pending_approval' | 'denied' | 'executed' | 'failed' | 'expired';
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  evidenceR2Key?: string | null;
  executionResultJson?: string | null;
  createdAt: string;
  updatedAt: string;
};

const dbState: {
  decisions: Map<string, MutableDecision>;
  approvals: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
  counter: number;
} = {
  decisions: new Map(),
  approvals: [],
  ledger: [],
  counter: 0,
};

function nowIso(): string {
  return new Date().toISOString();
}

vi.mock('../../src/lib/db', () => {
  const createDecisionRecord = (input: any): MutableDecision => {
    const id = `dec_${++dbState.counter}`;
    const record: MutableDecision = {
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
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    dbState.decisions.set(id, record);
    return record;
  };

  return {
    resolveTenantId: vi.fn(async (_env: Env, _userId: string, tenantId?: string) => tenantId || 'tenant_1'),
    isToolAllowedForTenant: vi.fn(async (_env: Env, _tenantId: string, _toolkitSlug: string, toolSlug: string) => {
      return toolSlug === 'SLACK_SEND_MESSAGE';
    }),
    createDecision: vi.fn(async (_env: Env, input: any) => createDecisionRecord(input)),
    updateDecision: vi.fn(async (_env: Env, input: any) => {
      const decision = dbState.decisions.get(input.decisionId);
      if (!decision) return;
      decision.status = input.status;
      decision.updatedAt = nowIso();
      if (input.reason) decision.reason = input.reason;
      if (input.decidedBy) {
        decision.decidedBy = input.decidedBy;
        decision.decidedAt = nowIso();
      }
      if (input.executionResult !== undefined) {
        decision.executionResultJson = JSON.stringify(input.executionResult);
      }
      if (input.evidenceR2Key) {
        decision.evidenceR2Key = input.evidenceR2Key;
      }
    }),
    getDecision: vi.fn(async (_env: Env, tenantId: string, decisionId: string) => {
      const decision = dbState.decisions.get(decisionId);
      if (!decision) return null;
      if (decision.tenantId !== tenantId) return null;
      return { ...decision };
    }),
    listPendingDecisions: vi.fn(async (_env: Env, tenantId: string, limit = 50) => {
      return Array.from(dbState.decisions.values())
        .filter((decision) => decision.tenantId === tenantId && decision.status === 'pending_approval')
        .slice(0, limit)
        .map((decision) => ({ ...decision }));
    }),
    createApproval: vi.fn(async (_env: Env, input: any) => {
      const id = `approval_${dbState.approvals.length + 1}`;
      const record = {
        id,
        decisionId: input.decisionId,
        tenantId: input.tenantId,
        approverUserId: input.approverUserId,
        approvalTier: input.approvalTier,
        status: input.status,
        note: input.note || null,
        createdAt: nowIso(),
      };
      dbState.approvals.push(record);
      return record;
    }),
    appendExecutionLedger: vi.fn(async (_env: Env, input: any) => {
      dbState.ledger.push({
        ...input,
        createdAt: nowIso(),
      });
      return `hash_${dbState.ledger.length}`;
    }),
    getProviderConnection: vi.fn(async () => ({
      connectedAccountId: 'ca_123',
      status: 'active',
      authConfigId: 'auth_1',
      metadata: null,
    })),
    getActivePolicy: vi.fn(async () => ({ policy: null, version: null })),
    upsertProviderConnection: vi.fn(async () => undefined),
    listToolAccessPacks: vi.fn(async () => [
      {
        id: 'pack_1',
        tenantId: 'tenant_1',
        name: 'Ops Automation Pack',
        slug: 'ops-automation',
        description: 'Core operations tool access',
        status: 'active',
        createdBy: 'user_1',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]),
  };
});

import { hubTools } from '../../src/tools/hub';
import { judgmentTools } from '../../src/tools/judgment';

describe('hub execution lifecycle', () => {
  let env: Env;
  let evidencePut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dbState.decisions.clear();
    dbState.approvals = [];
    dbState.ledger = [];
    dbState.counter = 0;

    env = createMockEnv();
    evidencePut = vi.fn(async () => undefined);
    (env as any).JUDGMENT_EVIDENCE = {
      put: evidencePut,
      get: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
      list: vi.fn(),
      createMultipartUpload: vi.fn(),
      resumeMultipartUpload: vi.fn(),
    };
  });

  it('flows pending -> approved -> executed and writes evidence artifact', async () => {
    const evaluateResult = await hubTools.execute_tool.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        tool_slug: 'workway_create_workflow',
        args: {
          name: 'Lifecycle Workflow',
          description: 'Approval-unblock path',
        },
      },
      env
    );

    expect(evaluateResult.success).toBe(true);
    expect(evaluateResult.data?.status).toBe('requires_approval');
    const decisionId = evaluateResult.data?.decision_id as string;
    expect(decisionId).toBeDefined();

    const pending = await judgmentTools.list_pending.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        limit: 10,
      },
      env
    );
    expect(pending.success).toBe(true);
    expect(pending.data?.count).toBe(1);

    const approveResult = await judgmentTools.approve_action.execute(
      {
        tenant_id: 'tenant_1',
        approver_user_id: 'approver_1',
        decision_id: decisionId,
        approval_tier: 'project_manager',
        note: 'Approved for execution.',
      },
      env
    );
    expect(approveResult.success).toBe(true);
    expect(approveResult.data?.status).toBe('approved');

    const executeResult = await hubTools.execute_tool.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        decision_id: decisionId,
        tool_slug: 'workway_create_workflow',
        args: {
          name: 'Lifecycle Workflow',
          description: 'Approval-unblock path',
        },
      },
      env
    );

    expect(executeResult.success).toBe(true);
    expect(executeResult.data?.status).toBe('executed');
    expect(executeResult.data?.decision_id).toBe(decisionId);
    expect(executeResult.data?.provider).toBe('first_party');
    expect(evidencePut).toHaveBeenCalledTimes(1);
    expect(dbState.ledger.some((entry) => entry.status === 'executed')).toBe(true);

    const decisionLookup = await judgmentTools.get_decision.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        decision_id: decisionId,
      },
      env
    );
    expect(decisionLookup.success).toBe(true);
    expect(decisionLookup.data?.decision?.status).toBe('executed');
  });

  it('opens circuit breaker after repeated failures and blocks subsequent execution', async () => {
    // Seed approved decisions so execution path is attempted immediately.
    for (let i = 0; i < 3; i++) {
      const id = `seed_fail_${i + 1}`;
      dbState.decisions.set(id, {
        id,
        tenantId: 'tenant_1',
        userId: 'user_1',
        toolSlug: 'workway_create_workflow',
        provider: 'first_party',
        riskScore: 0.7,
        status: 'approved',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } as MutableDecision);
    }

    for (let i = 0; i < 3; i++) {
      const failure = await hubTools.execute_tool.execute(
        {
          tenant_id: 'tenant_1',
          user_id: 'user_1',
          decision_id: `seed_fail_${i + 1}`,
          tool_slug: 'workway_create_workflow',
          // Invalid input (missing required `name`) forces parse failure in first-party executor
          args: {},
        },
        env
      );

      expect(failure.success).toBe(false);
    }

    dbState.decisions.set('seed_blocked', {
      id: 'seed_blocked',
      tenantId: 'tenant_1',
      userId: 'user_1',
      toolSlug: 'workway_create_workflow',
      provider: 'first_party',
      riskScore: 0.7,
      status: 'approved',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as MutableDecision);

    const blocked = await hubTools.execute_tool.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        decision_id: 'seed_blocked',
        tool_slug: 'workway_create_workflow',
        args: {
          name: 'Should Be Blocked',
        },
      },
      env
    );

    expect(blocked.success).toBe(true);
    expect(blocked.data?.status).toBe('denied');
    expect(String(blocked.data?.reason || '')).toContain('Circuit breaker is open');
  });
});

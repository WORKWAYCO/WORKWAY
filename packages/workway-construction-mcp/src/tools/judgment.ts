/**
 * Judgment Axis MCP Tools
 *
 * MCP-only governance surface for policy evaluation, approvals, and decision lookup.
 */

import { z } from 'zod';
import type { Env, MCPToolSet } from '../types';
import type { StandardResponse } from '../lib/errors';
import { success } from '../lib/errors';
import { handleError } from '../middleware/error-handler';
import {
  createApproval,
  createDecision,
  getDecision,
  listPendingDecisions,
  resolveTenantId,
  updateDecision,
} from '../lib/db';
import { evaluateActionPolicy, mapPolicyActionToDecisionStatus } from '../lib/policy-engine';

async function ensureTenantScope(
  env: Env,
  userId: string,
  tenantId?: string
): Promise<string> {
  const resolved = await resolveTenantId(env, userId, tenantId);
  if (!resolved) {
    throw new Error('Tenant scope not found for this user.');
  }
  return resolved;
}

export const judgmentTools: MCPToolSet = {
  evaluate_action: {
    name: 'workway_judgment_evaluate_action',
    description:
      'Evaluate a planned action against tenant policy and create a durable decision record.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string().describe('User performing the action'),
      project_id: z.string().optional(),
      toolkit_slug: z.string().optional(),
      tool_slug: z.string().describe('Tool/action slug being evaluated'),
      provider: z.string().optional().default('composio'),
      args: z.record(z.unknown()).optional().default({}),
      risk_hint: z.number().min(0).max(1).optional(),
    }),
    outputSchema: z.object({
      decision_id: z.string(),
      status: z.enum(['approved', 'pending_approval', 'denied']),
      action: z.enum(['allow', 'require_approval', 'deny']),
      risk_score: z.number(),
      reason: z.string(),
      required_approval_tier: z.string().nullable().optional(),
    }),
    execute: async (
      input: z.infer<typeof judgmentTools.evaluate_action.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        const tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);

        const evaluation = await evaluateActionPolicy(env, {
          tenantId,
          userId: input.user_id,
          projectId: input.project_id,
          toolkitSlug: input.toolkit_slug,
          toolSlug: input.tool_slug,
          args: input.args,
          riskHint: input.risk_hint,
        });

        const status = mapPolicyActionToDecisionStatus(evaluation.action);
        const decision = await createDecision(env, {
          tenantId,
          userId: input.user_id,
          projectId: input.project_id,
          toolkitSlug: input.toolkit_slug,
          toolSlug: input.tool_slug,
          provider: input.provider,
          args: input.args,
          riskScore: evaluation.riskScore,
          requiredApprovalTier: evaluation.requiredApprovalTier,
          status,
          reason: evaluation.reason,
          policyId: evaluation.policyId,
          policyVersionId: evaluation.policyVersionId,
        });

        return success({
          decision_id: decision.id,
          status,
          action: evaluation.action,
          risk_score: evaluation.riskScore,
          reason: evaluation.reason,
          required_approval_tier: evaluation.requiredApprovalTier || null,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  approve_action: {
    name: 'workway_judgment_approve_action',
    description: 'Approve a pending decision and record approval metadata.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      approver_user_id: z.string(),
      decision_id: z.string(),
      approval_tier: z
        .enum(['none', 'superintendent', 'project_manager', 'director', 'compliance'])
        .default('project_manager'),
      note: z.string().optional(),
    }),
    outputSchema: z.object({
      decision_id: z.string(),
      status: z.literal('approved'),
      approval_id: z.string(),
    }),
    execute: async (
      input: z.infer<typeof judgmentTools.approve_action.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        const tenantId = await ensureTenantScope(env, input.approver_user_id, input.tenant_id);
        const decision = await getDecision(env, tenantId, input.decision_id);
        if (!decision) {
          throw new Error(`Decision not found: ${input.decision_id}`);
        }

        const approval = await createApproval(env, {
          decisionId: input.decision_id,
          tenantId,
          approverUserId: input.approver_user_id,
          approvalTier: input.approval_tier,
          status: 'approved',
          note: input.note,
        });

        await updateDecision(env, {
          decisionId: input.decision_id,
          tenantId,
          status: 'approved',
          decidedBy: input.approver_user_id,
          reason: input.note || 'Approved via MCP judgment axis.',
        });

        return success({
          decision_id: input.decision_id,
          status: 'approved' as const,
          approval_id: approval.id,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  reject_action: {
    name: 'workway_judgment_reject_action',
    description: 'Reject a pending decision and persist a rejection reason.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      approver_user_id: z.string(),
      decision_id: z.string(),
      approval_tier: z
        .enum(['none', 'superintendent', 'project_manager', 'director', 'compliance'])
        .default('project_manager'),
      reason: z.string().min(3),
    }),
    outputSchema: z.object({
      decision_id: z.string(),
      status: z.literal('denied'),
      approval_id: z.string(),
    }),
    execute: async (
      input: z.infer<typeof judgmentTools.reject_action.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        const tenantId = await ensureTenantScope(env, input.approver_user_id, input.tenant_id);
        const decision = await getDecision(env, tenantId, input.decision_id);
        if (!decision) {
          throw new Error(`Decision not found: ${input.decision_id}`);
        }

        const approval = await createApproval(env, {
          decisionId: input.decision_id,
          tenantId,
          approverUserId: input.approver_user_id,
          approvalTier: input.approval_tier,
          status: 'rejected',
          note: input.reason,
        });

        await updateDecision(env, {
          decisionId: input.decision_id,
          tenantId,
          status: 'denied',
          decidedBy: input.approver_user_id,
          reason: input.reason,
        });

        return success({
          decision_id: input.decision_id,
          status: 'denied' as const,
          approval_id: approval.id,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  list_pending: {
    name: 'workway_judgment_list_pending',
    description: 'List pending approvals for a tenant.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    outputSchema: z.object({
      tenant_id: z.string(),
      count: z.number(),
      decisions: z.array(
        z.object({
          id: z.string(),
          user_id: z.string(),
          tool_slug: z.string(),
          toolkit_slug: z.string().nullable().optional(),
          provider: z.string(),
          required_approval_tier: z.string().nullable().optional(),
          risk_score: z.number(),
          reason: z.string().nullable().optional(),
          created_at: z.string(),
        })
      ),
    }),
    execute: async (
      input: z.infer<typeof judgmentTools.list_pending.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        const tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);
        const decisions = await listPendingDecisions(env, tenantId, input.limit);

        return success({
          tenant_id: tenantId,
          count: decisions.length,
          decisions: decisions.map((decision) => ({
            id: decision.id,
            user_id: decision.userId,
            tool_slug: decision.toolSlug,
            toolkit_slug: decision.toolkitSlug || null,
            provider: decision.provider,
            required_approval_tier: decision.requiredApprovalTier || null,
            risk_score: decision.riskScore,
            reason: decision.reason || null,
            created_at: decision.createdAt,
          })),
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  get_decision: {
    name: 'workway_judgment_get_decision',
    description: 'Get full details for a single decision.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string(),
      decision_id: z.string(),
    }),
    outputSchema: z.object({
      decision: z.record(z.unknown()),
    }),
    execute: async (
      input: z.infer<typeof judgmentTools.get_decision.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        const tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);
        const decision = await getDecision(env, tenantId, input.decision_id);
        if (!decision) {
          throw new Error(`Decision not found: ${input.decision_id}`);
        }

        return success({
          decision: {
            id: decision.id,
            tenant_id: decision.tenantId,
            policy_id: decision.policyId,
            policy_version_id: decision.policyVersionId,
            user_id: decision.userId,
            project_id: decision.projectId,
            toolkit_slug: decision.toolkitSlug,
            tool_slug: decision.toolSlug,
            provider: decision.provider,
            arguments_json: decision.argumentsJson,
            risk_score: decision.riskScore,
            required_approval_tier: decision.requiredApprovalTier,
            status: decision.status,
            reason: decision.reason,
            decided_by: decision.decidedBy,
            decided_at: decision.decidedAt,
            evidence_r2_key: decision.evidenceR2Key,
            execution_result_json: decision.executionResultJson,
            created_at: decision.createdAt,
            updated_at: decision.updatedAt,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },
};

/**
 * Judgment Policy Engine
 *
 * Evaluates tenant policy + trust profile and returns one of:
 * - allow
 * - require_approval
 * - deny
 */

import type {
  ApprovalTier,
  Env,
  JudgmentAction,
  PolicyDefinition,
  PolicyRule,
  PolicyRuleMatch,
} from '../types';
import { getActivePolicy } from './db';

export interface PolicyEvaluationRequest {
  tenantId: string;
  userId: string;
  toolSlug: string;
  toolkitSlug?: string;
  projectId?: string;
  args?: Record<string, unknown>;
  riskHint?: number;
}

export interface PolicyEvaluationResult {
  action: JudgmentAction;
  reason: string;
  riskScore: number;
  requiredApprovalTier?: ApprovalTier;
  policyId?: string;
  policyVersionId?: string;
  matchedRuleId?: string;
}

const DEFAULT_REQUIRE_APPROVAL_TIER: ApprovalTier = 'project_manager';

const SAFE_READ_PATTERNS = ['list_', 'get_', 'read_', 'search_', 'query_'];
const WRITE_PATTERNS = ['create_', 'update_', 'send_', 'execute_', 'connect_', 'approve_'];
const HIGH_RISK_PATTERNS = ['delete_', 'remove_', 'revoke_', 'archive_', 'purge_'];

export async function evaluateActionPolicy(
  env: Env,
  request: PolicyEvaluationRequest
): Promise<PolicyEvaluationResult> {
  const riskScore = clampRisk(calculateRiskScore(request.toolSlug, request.riskHint));

  const { policy, version } = await getActivePolicy(env, request.tenantId, 'default');
  const parsedPolicy = parsePolicy(version?.policyJson);

  const ruleMatch = parsedPolicy?.rules
    ?.map((rule) => ({ rule, matches: ruleMatches(rule.match, request, riskScore) }))
    .find((candidate) => candidate.matches);

  if (ruleMatch) {
    return {
      action: ruleMatch.rule.action,
      reason: ruleMatch.rule.reason || `Matched policy rule ${ruleMatch.rule.id}`,
      riskScore,
      requiredApprovalTier: normalizeTier(ruleMatch.rule.required_approval_tier),
      policyId: policy?.id,
      policyVersionId: version?.id,
      matchedRuleId: ruleMatch.rule.id,
    };
  }

  const defaultAction = parsedPolicy?.default_action;
  if (defaultAction) {
    return {
      action: defaultAction,
      reason: `Applied tenant default action: ${defaultAction}`,
      riskScore,
      requiredApprovalTier: normalizeTier(
        parsedPolicy.default_required_approval_tier || DEFAULT_REQUIRE_APPROVAL_TIER
      ),
      policyId: policy?.id,
      policyVersionId: version?.id,
    };
  }

  // Safe, deterministic fallback when no policy exists yet.
  if (riskScore >= 0.9) {
    return {
      action: 'deny',
      reason: 'High-risk action denied by fallback guardrail.',
      riskScore,
      policyId: policy?.id,
      policyVersionId: version?.id,
    };
  }

  if (riskScore >= 0.45) {
    return {
      action: 'require_approval',
      reason: 'Medium/high risk action requires approval by fallback policy.',
      riskScore,
      requiredApprovalTier: DEFAULT_REQUIRE_APPROVAL_TIER,
      policyId: policy?.id,
      policyVersionId: version?.id,
    };
  }

  return {
    action: 'allow',
    reason: 'Low-risk action allowed by fallback policy.',
    riskScore,
    policyId: policy?.id,
    policyVersionId: version?.id,
  };
}

function parsePolicy(policyJson?: string): PolicyDefinition | null {
  if (!policyJson) return null;
  try {
    const parsed = JSON.parse(policyJson) as PolicyDefinition;
    return parsed;
  } catch {
    return null;
  }
}

function ruleMatches(
  match: PolicyRuleMatch | undefined,
  request: PolicyEvaluationRequest,
  riskScore: number
): boolean {
  if (!match) return false;

  if (match.toolkit_slugs?.length) {
    if (!request.toolkitSlug || !match.toolkit_slugs.includes(request.toolkitSlug)) {
      return false;
    }
  }

  if (match.tool_slugs?.length && !match.tool_slugs.includes(request.toolSlug)) {
    return false;
  }

  if (match.tool_slug_prefixes?.length) {
    const hasPrefix = match.tool_slug_prefixes.some((prefix) => request.toolSlug.startsWith(prefix));
    if (!hasPrefix) return false;
  }

  if (typeof match.min_risk === 'number' && riskScore < match.min_risk) {
    return false;
  }

  if (typeof match.max_risk === 'number' && riskScore > match.max_risk) {
    return false;
  }

  if (match.operation_types?.length) {
    const operationType = inferOperationType(request.toolSlug);
    if (!match.operation_types.includes(operationType)) {
      return false;
    }
  }

  return true;
}

function inferOperationType(toolSlug: string): 'read' | 'write' | 'admin' {
  const normalized = toolSlug.toLowerCase();
  if (HIGH_RISK_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'admin';
  }
  if (WRITE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'write';
  }
  if (SAFE_READ_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'read';
  }
  return 'write';
}

function calculateRiskScore(toolSlug: string, riskHint?: number): number {
  if (typeof riskHint === 'number') return riskHint;

  const normalized = toolSlug.toLowerCase();
  if (HIGH_RISK_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 0.95;
  }
  if (WRITE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 0.65;
  }
  if (SAFE_READ_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 0.2;
  }
  return 0.55;
}

function clampRisk(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeTier(tier?: string): ApprovalTier {
  switch (tier) {
    case 'none':
    case 'superintendent':
    case 'project_manager':
    case 'director':
    case 'compliance':
      return tier;
    default:
      return DEFAULT_REQUIRE_APPROVAL_TIER;
  }
}

export function mapPolicyActionToDecisionStatus(
  action: JudgmentAction
): 'approved' | 'pending_approval' | 'denied' {
  if (action === 'allow') return 'approved';
  if (action === 'require_approval') return 'pending_approval';
  return 'denied';
}

export function mapPolicyActionToHubStatus(action: JudgmentAction): 'executed' | 'requires_approval' | 'denied' {
  if (action === 'allow') return 'executed';
  if (action === 'require_approval') return 'requires_approval';
  return 'denied';
}

export function pickDefaultPolicyRuleId(rule?: PolicyRule): string | undefined {
  return rule?.id;
}

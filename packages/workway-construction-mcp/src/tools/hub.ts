/**
 * Construction MCP Hub Tools
 *
 * MCP-only toolkit hub with policy-gated execution.
 */

import { z } from 'zod';
import type { Env, HubExecutionResponse, MCPToolSet } from '../types';
import type { StandardResponse } from '../lib/errors';
import { success } from '../lib/errors';
import { handleError } from '../middleware/error-handler';
import {
  appendExecutionLedger,
  createDecision,
  getDecision,
  getProviderConnection,
  isToolAllowedForTenant,
  listToolAccessPacks,
  resolveTenantId,
  updateDecision,
  upsertProviderConnection,
} from '../lib/db';
import {
  ComposioSessionProvider,
  executeProviderTool,
  resolveProvider,
  type HubToolkit,
} from '../lib/provider-router';
import { evaluateActionPolicy, mapPolicyActionToDecisionStatus } from '../lib/policy-engine';
import { logToolExecution } from '../lib/audit-logger';
import {
  getTenantFeatureFlag,
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
} from '../lib/tenant-controls';
import { workflowTools } from './workflow';
import { procoreTools } from './procore';
import { autodeskTools } from './autodesk';
import { shovelsTools } from './shovels';
import { droneDeployTools } from './dronedeploy';
import { notificationTools } from './notifications';
import { templateTools } from './templates';
import { debuggingTools } from './debugging';
import { skillTools } from './skills';
import { judgmentTools } from './judgment';

const FIRST_PARTY_TOOLS = [
  workflowTools,
  procoreTools,
  autodeskTools,
  shovelsTools,
  droneDeployTools,
  notificationTools,
  templateTools,
  debuggingTools,
  skillTools,
  judgmentTools,
];

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

async function listAllowlistedToolkitSlugs(
  env: Env,
  tenantId: string
): Promise<string[]> {
  try {
    const rows = await env.DB.prepare(
      `
      SELECT DISTINCT r.toolkit_slug AS toolkit_slug
      FROM tool_access_rules r
      INNER JOIN tool_access_packs p ON p.id = r.pack_id
      WHERE r.tenant_id = ? AND p.status = 'active' AND r.rule_type = 'allow'
      ORDER BY r.toolkit_slug ASC
      `
    ).bind(tenantId).all<{ toolkit_slug: string }>();

    return (rows.results || []).map((row) => row.toolkit_slug).filter(Boolean);
  } catch {
    // Migration may not be applied yet; provide a conservative default pack.
    return ['slack', 'gmail', 'google_drive', 'notion', 'jira'];
  }
}

async function isToolkitAllowlisted(
  env: Env,
  tenantId: string,
  toolkitSlug: string
): Promise<boolean> {
  const slugs = await listAllowlistedToolkitSlugs(env, tenantId);
  return slugs.includes(toolkitSlug);
}

export const hubTools: MCPToolSet = {
  list_toolkits: {
    name: 'workway_hub_list_toolkits',
    description: 'List curated allowlisted toolkits for the tenant and include Composio catalog metadata.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string(),
      include_remote_catalog: z.boolean().default(true),
    }),
    outputSchema: z.object({
      tenant_id: z.string(),
      packs: z.array(z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
      })),
      toolkits: z.array(z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string().optional(),
        connected: z.boolean(),
      })),
    }),
    execute: async (
      input: z.infer<typeof hubTools.list_toolkits.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        const tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);
        const hubEnabled = await getTenantFeatureFlag(env, tenantId, 'hub_enabled', true);
        if (!hubEnabled) {
          throw new Error('Hub is disabled for this tenant.');
        }
        const packs = await listToolAccessPacks(env, tenantId);
        const allowlistedSlugs = await listAllowlistedToolkitSlugs(env, tenantId);

        let remoteToolkits: HubToolkit[] = [];
        if (input.include_remote_catalog && env.COMPOSIO_API_KEY) {
          const composio = new ComposioSessionProvider(env);
          remoteToolkits = await composio.listToolkits();
        }

        const toolkitMap = new Map<string, HubToolkit>();
        for (const toolkit of remoteToolkits) {
          if (allowlistedSlugs.includes(toolkit.slug)) {
            toolkitMap.set(toolkit.slug, toolkit);
          }
        }

        for (const slug of allowlistedSlugs) {
          if (!toolkitMap.has(slug)) {
            toolkitMap.set(slug, {
              slug,
              name: slug,
            });
          }
        }

        const toolkits = await Promise.all(
          Array.from(toolkitMap.values()).map(async (toolkit) => {
            const connection = await getProviderConnection(env, {
              tenantId,
              userId: input.user_id,
              provider: 'composio',
              toolkitSlug: toolkit.slug,
            });
            return {
              ...toolkit,
              connected: connection?.status === 'active',
            };
          })
        );

        return success({
          tenant_id: tenantId,
          packs: packs.map((pack) => ({
            id: pack.id,
            slug: pack.slug,
            name: pack.name,
            description: pack.description || null,
          })),
          toolkits,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  connect_toolkit: {
    name: 'workway_hub_connect_toolkit',
    description: 'Create an OAuth connection link for an allowlisted toolkit.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string(),
      toolkit_slug: z.string(),
      auth_config_id: z.string().optional(),
      callback_url: z.string().url().optional(),
    }),
    outputSchema: z.object({
      tenant_id: z.string(),
      toolkit_slug: z.string(),
      auth_config_id: z.string(),
      redirect_url: z.string(),
      connected_account_id: z.string().nullable().optional(),
      connection_status: z.enum(['pending', 'active']),
    }),
    execute: async (
      input: z.infer<typeof hubTools.connect_toolkit.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        if (!env.COMPOSIO_API_KEY) {
          throw new Error('COMPOSIO_API_KEY is not configured.');
        }

        const tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);
        const hubEnabled = await getTenantFeatureFlag(env, tenantId, 'hub_enabled', true);
        if (!hubEnabled) {
          throw new Error('Hub is disabled for this tenant.');
        }
        const allowlisted = await isToolkitAllowlisted(env, tenantId, input.toolkit_slug);
        if (!allowlisted) {
          throw new Error(`Toolkit is not allowlisted for tenant: ${input.toolkit_slug}`);
        }

        const composio = new ComposioSessionProvider(env);
        const authConfigId = input.auth_config_id || (await composio.listAuthConfigs(input.toolkit_slug))[0]?.id;
        if (!authConfigId) {
          throw new Error(`No auth config available for toolkit: ${input.toolkit_slug}`);
        }

        const connection = await composio.createConnectionLink({
          authConfigId,
          userId: input.user_id,
          callbackUrl: input.callback_url,
        });

        await upsertProviderConnection(env, {
          tenantId,
          userId: input.user_id,
          provider: 'composio',
          toolkitSlug: input.toolkit_slug,
          authConfigId,
          connectedAccountId: connection.connectedAccountId,
          status: connection.connectedAccountId ? 'active' : 'pending',
          metadata: {
            redirect_url: connection.redirectUrl,
          },
        });

        return success({
          tenant_id: tenantId,
          toolkit_slug: input.toolkit_slug,
          auth_config_id: authConfigId,
          redirect_url: connection.redirectUrl,
          connected_account_id: connection.connectedAccountId || null,
          connection_status: connection.connectedAccountId ? 'active' as const : 'pending' as const,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  list_tools: {
    name: 'workway_hub_list_tools',
    description: 'List allowlisted tools for a specific toolkit.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string(),
      toolkit_slug: z.string(),
    }),
    outputSchema: z.object({
      tenant_id: z.string(),
      toolkit_slug: z.string(),
      count: z.number(),
      tools: z.array(z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })),
    }),
    execute: async (
      input: z.infer<typeof hubTools.list_tools.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      try {
        if (!env.COMPOSIO_API_KEY) {
          throw new Error('COMPOSIO_API_KEY is not configured.');
        }

        const tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);
        const hubEnabled = await getTenantFeatureFlag(env, tenantId, 'hub_enabled', true);
        if (!hubEnabled) {
          throw new Error('Hub is disabled for this tenant.');
        }
        const allowlisted = await isToolkitAllowlisted(env, tenantId, input.toolkit_slug);
        if (!allowlisted) {
          throw new Error(`Toolkit is not allowlisted for tenant: ${input.toolkit_slug}`);
        }

        const composio = new ComposioSessionProvider(env);
        const toolkitTools = await composio.listTools(input.toolkit_slug);

        const permissionChecks = await Promise.all(
          toolkitTools.map(async (tool) => ({
            tool,
            allowed: await isToolAllowedForTenant(env, tenantId, input.toolkit_slug, tool.slug),
          }))
        );

        const allowedTools = permissionChecks
          .filter((item) => item.allowed)
          .map((item) => item.tool);

        return success({
          tenant_id: tenantId,
          toolkit_slug: input.toolkit_slug,
          count: allowedTools.length,
          tools: allowedTools.map((tool) => ({
            slug: tool.slug,
            name: tool.name,
            description: tool.description,
          })),
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  execute_tool: {
    name: 'workway_hub_execute_tool',
    description:
      'Execute a tool through the judgment axis. Routes to first-party or Composio after policy and allowlist checks.',
    inputSchema: z.object({
      tenant_id: z.string().optional(),
      user_id: z.string(),
      project_id: z.string().optional(),
      toolkit_slug: z.string().optional(),
      tool_slug: z.string(),
      decision_id: z.string().optional()
        .describe('Optional existing approved decision ID to unblock and execute a pending action'),
      args: z.record(z.unknown()).optional().default({}),
      risk_hint: z.number().min(0).max(1).optional(),
      dry_run: z.boolean().optional().default(false),
    }),
    outputSchema: z.object({
      status: z.enum(['executed', 'requires_approval', 'denied']),
      decision_id: z.string(),
      provider: z.enum(['first_party', 'composio']).optional(),
      required_approval_tier: z.string().nullable().optional(),
      reason: z.string().optional(),
      result: z.unknown().optional(),
    }),
    execute: async (
      input: z.infer<typeof hubTools.execute_tool.inputSchema>,
      env: Env
    ): Promise<StandardResponse<any>> => {
      const start = Date.now();
      let tenantId = input.tenant_id || 'tenant_default';
      let decisionId: string | null = null;
      let attemptedExecution = false;

      try {
        tenantId = await ensureTenantScope(env, input.user_id, input.tenant_id);
        const provider = resolveProvider(input.tool_slug);
        const circuitToolkitSlug = provider === 'first_party' ? 'first_party' : (input.toolkit_slug || 'composio');

        const hubExecutionEnabled = await getTenantFeatureFlag(
          env,
          tenantId,
          'hub_execution_enabled',
          true
        );
        if (!hubExecutionEnabled) {
          const disabledDecision = await createDecision(env, {
            tenantId,
            userId: input.user_id,
            projectId: input.project_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            args: input.args,
            riskScore: 1,
            status: 'denied',
            reason: 'Hub execution disabled for this tenant by feature flag.',
          });
          decisionId = disabledDecision.id;

          await appendExecutionLedger(env, {
            tenantId,
            decisionId,
            userId: input.user_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            status: 'denied',
            requestArgs: input.args,
            metadata: { reason: 'feature_flag_disabled' },
          });

          return success({
            status: 'denied',
            decision_id: decisionId,
            reason: 'Hub execution disabled for this tenant.',
          } as HubExecutionResponse);
        }

        const circuit = await isCircuitOpen(env, tenantId, circuitToolkitSlug, input.tool_slug);
        if (circuit.open) {
          const openReason = circuit.state?.openUntil
            ? `Circuit breaker is open until ${circuit.state.openUntil}.`
            : 'Circuit breaker is open for this tool.';

          const blockedDecision = await createDecision(env, {
            tenantId,
            userId: input.user_id,
            projectId: input.project_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            args: input.args,
            riskScore: 1,
            status: 'denied',
            reason: openReason,
          });
          decisionId = blockedDecision.id;

          await appendExecutionLedger(env, {
            tenantId,
            decisionId,
            userId: input.user_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            status: 'denied',
            requestArgs: input.args,
            metadata: {
              reason: 'circuit_open',
              open_until: circuit.state?.openUntil || null,
            },
          });

          return success({
            status: 'denied',
            decision_id: decisionId,
            reason: openReason,
          } as HubExecutionResponse);
        }

        let skipPolicyEvaluation = false;
        if (input.decision_id) {
          const existingDecision = await getDecision(env, tenantId, input.decision_id);
          if (!existingDecision) {
            throw new Error(`Decision not found: ${input.decision_id}`);
          }

          if (existingDecision.toolSlug !== input.tool_slug) {
            throw new Error('Decision tool does not match requested tool_slug.');
          }

          decisionId = existingDecision.id;
          if (existingDecision.status === 'pending_approval') {
            return success({
              status: 'requires_approval',
              decision_id: existingDecision.id,
              required_approval_tier: existingDecision.requiredApprovalTier || null,
              reason: existingDecision.reason || 'Decision is still awaiting approval.',
            } as HubExecutionResponse);
          }

          if (existingDecision.status === 'denied') {
            return success({
              status: 'denied',
              decision_id: existingDecision.id,
              reason: existingDecision.reason || 'Decision was denied.',
            } as HubExecutionResponse);
          }

          if (existingDecision.status === 'executed') {
            return success({
              status: 'executed',
              decision_id: existingDecision.id,
              provider,
              result: existingDecision.executionResultJson
                ? JSON.parse(existingDecision.executionResultJson)
                : null,
            } as HubExecutionResponse);
          }

          if (existingDecision.status !== 'approved') {
            throw new Error(
              `Decision ${existingDecision.id} must be approved before execution (current: ${existingDecision.status}).`
            );
          }

          skipPolicyEvaluation = true;
        }

        if (provider === 'composio') {
          if (!input.toolkit_slug) {
            throw new Error('toolkit_slug is required for Composio tools.');
          }
          const allowed = await isToolAllowedForTenant(env, tenantId, input.toolkit_slug, input.tool_slug);
          if (!allowed) {
            const deniedDecision = await createDecision(env, {
              tenantId,
              userId: input.user_id,
              projectId: input.project_id,
              toolkitSlug: input.toolkit_slug,
              toolSlug: input.tool_slug,
              provider,
              args: input.args,
              riskScore: 1,
              status: 'denied',
              reason: 'Tool is not allowlisted for this tenant.',
            });
            decisionId = deniedDecision.id;

            await appendExecutionLedger(env, {
              tenantId,
              decisionId,
              userId: input.user_id,
              toolkitSlug: input.toolkit_slug,
              toolSlug: input.tool_slug,
              provider,
              status: 'denied',
              requestArgs: input.args,
              metadata: { reason: 'allowlist_denied' },
            });

            return success({
              status: 'denied',
              decision_id: decisionId,
              reason: 'Tool is not allowlisted for this tenant.',
            } as HubExecutionResponse);
          }
        }

        if (!skipPolicyEvaluation) {
          const policyResult = await evaluateActionPolicy(env, {
            tenantId,
            userId: input.user_id,
            projectId: input.project_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            args: input.args,
            riskHint: input.risk_hint,
          });

          const decision = await createDecision(env, {
            tenantId,
            userId: input.user_id,
            projectId: input.project_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            args: input.args,
            riskScore: policyResult.riskScore,
            requiredApprovalTier: policyResult.requiredApprovalTier,
            status: mapPolicyActionToDecisionStatus(policyResult.action),
            reason: policyResult.reason,
            policyId: policyResult.policyId,
            policyVersionId: policyResult.policyVersionId,
          });
          decisionId = decision.id;

          if (policyResult.action === 'deny') {
            await appendExecutionLedger(env, {
              tenantId,
              decisionId,
              userId: input.user_id,
              toolkitSlug: input.toolkit_slug,
              toolSlug: input.tool_slug,
              provider,
              status: 'denied',
              requestArgs: input.args,
              metadata: { reason: policyResult.reason },
            });

            return success({
              status: 'denied',
              decision_id: decisionId,
              reason: policyResult.reason,
            } as HubExecutionResponse);
          }

          if (policyResult.action === 'require_approval') {
            await appendExecutionLedger(env, {
              tenantId,
              decisionId,
              userId: input.user_id,
              toolkitSlug: input.toolkit_slug,
              toolSlug: input.tool_slug,
              provider,
              status: 'pending_approval',
              requestArgs: input.args,
              metadata: { required_approval_tier: policyResult.requiredApprovalTier },
            });

            return success({
              status: 'requires_approval',
              decision_id: decisionId,
              required_approval_tier: policyResult.requiredApprovalTier || null,
              reason: policyResult.reason,
            } as HubExecutionResponse);
          }
        }

        if (!decisionId) {
          throw new Error('Decision ID missing before execution.');
        }

        if (input.dry_run) {
          await appendExecutionLedger(env, {
            tenantId,
            decisionId,
            userId: input.user_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            status: 'executed',
            requestArgs: input.args,
            metadata: { dry_run: true },
          });

          return success({
            status: 'executed',
            decision_id: decisionId,
            provider,
            result: {
              dry_run: true,
              message: 'Policy approved; execution skipped because dry_run=true.',
            },
          } as HubExecutionResponse);
        }

        attemptedExecution = true;
        let connectedAccountId: string | undefined;
        if (provider === 'composio' && input.toolkit_slug) {
          const savedConnection = await getProviderConnection(env, {
            tenantId,
            userId: input.user_id,
            provider: 'composio',
            toolkitSlug: input.toolkit_slug,
          });
          connectedAccountId = savedConnection?.connectedAccountId || undefined;

          if (!connectedAccountId) {
            const composio = new ComposioSessionProvider(env);
            const accounts = await composio.listConnectedAccounts({
              userId: input.user_id,
              toolkitSlug: input.toolkit_slug,
            });
            const active = accounts.find((account) => account.status === 'active');
            connectedAccountId = active?.id;
          }

          if (!connectedAccountId) {
            await upsertProviderConnection(env, {
              tenantId,
              userId: input.user_id,
              provider: 'composio',
              toolkitSlug: input.toolkit_slug,
              status: 'expired',
              metadata: { reason: 'No active connected account found.' },
            });

            await updateDecision(env, {
              decisionId,
              tenantId,
              status: 'pending_approval',
              reason: 'Toolkit connection missing or expired. Reconnect required.',
            });

            await appendExecutionLedger(env, {
              tenantId,
              decisionId,
              userId: input.user_id,
              toolkitSlug: input.toolkit_slug,
              toolSlug: input.tool_slug,
              provider,
              status: 'pending_approval',
              requestArgs: input.args,
              metadata: { reason: 'connection_missing' },
            });

            return success({
              status: 'requires_approval',
              decision_id: decisionId,
              reason: 'Toolkit connection missing or expired. Run workway_hub_connect_toolkit.',
            } as HubExecutionResponse);
          }
        }

        const providerResult = await executeProviderTool(
          env,
          {
            tenantId,
            userId: input.user_id,
            projectId: input.project_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            args: input.args,
            connectedAccountId,
          },
          async (toolSlug, args) => {
            const tool = FIRST_PARTY_TOOLS
              .flatMap((set) => Object.values(set) as any[])
              .find((candidate: any) => candidate.name === toolSlug) as any;
            if (!tool) {
              throw new Error(`Unknown first-party tool: ${toolSlug}`);
            }
            if (toolSlug === 'workway_hub_execute_tool') {
              throw new Error('Recursive hub execution is blocked.');
            }

            const parsed = tool.inputSchema.parse(args);
            const result = await tool.execute(parsed, env);
            if (!result.success) {
              throw new Error(result.error?.message || 'Tool execution failed.');
            }
            return result.data;
          }
        );

        await recordCircuitSuccess(env, tenantId, circuitToolkitSlug, input.tool_slug);

        let evidenceKey: string | undefined;
        if (env.JUDGMENT_EVIDENCE) {
          evidenceKey = `tenant/${tenantId}/decisions/${decisionId}.json`;
          await env.JUDGMENT_EVIDENCE.put(
            evidenceKey,
            JSON.stringify({
              decision_id: decisionId,
              tool_slug: input.tool_slug,
              toolkit_slug: input.toolkit_slug || null,
              provider: providerResult.provider,
              user_id: input.user_id,
              project_id: input.project_id || null,
              args: input.args,
              result: providerResult.result,
              created_at: new Date().toISOString(),
            })
          );
        }

        await updateDecision(env, {
          decisionId,
          tenantId,
          status: 'executed',
          executionResult: providerResult.result,
          evidenceR2Key: evidenceKey,
        });

        await appendExecutionLedger(env, {
          tenantId,
          decisionId,
          userId: input.user_id,
          toolkitSlug: input.toolkit_slug,
          toolSlug: input.tool_slug,
          provider,
          status: 'executed',
          requestArgs: input.args,
          result: providerResult.result,
          metadata: {
            evidence_key: evidenceKey || null,
            provider: providerResult.provider,
          },
        });

        await logToolExecution(env, {
          toolName: 'workway_hub_execute_tool',
          userId: input.user_id,
          connectionId: input.user_id,
          projectId: input.project_id,
          success: true,
          durationMs: Date.now() - start,
          details: {
            decision_id: decisionId,
            provider: providerResult.provider,
            toolkit_slug: input.toolkit_slug,
            tool_slug: input.tool_slug,
          },
        });

        return success({
          status: 'executed',
          decision_id: decisionId,
          provider: providerResult.provider,
          result: providerResult.result,
        } as HubExecutionResponse);
      } catch (error) {
        const provider = resolveProvider(input.tool_slug);
        const circuitToolkitSlug = provider === 'first_party' ? 'first_party' : (input.toolkit_slug || 'composio');
        if (attemptedExecution) {
          await recordCircuitFailure(
            env,
            tenantId,
            circuitToolkitSlug,
            input.tool_slug,
            error instanceof Error ? error.message : String(error)
          );
        }

        if (decisionId) {
          await updateDecision(env, {
            decisionId,
            tenantId,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown execution error',
          });
          await appendExecutionLedger(env, {
            tenantId,
            decisionId,
            userId: input.user_id,
            toolkitSlug: input.toolkit_slug,
            toolSlug: input.tool_slug,
            provider,
            status: 'failed',
            requestArgs: input.args,
            metadata: { error: error instanceof Error ? error.message : String(error) },
          });
        }

        await logToolExecution(env, {
          toolName: 'workway_hub_execute_tool',
          userId: input.user_id,
          connectionId: input.user_id,
          projectId: input.project_id,
          success: false,
          durationMs: Date.now() - start,
          errorMessage: error instanceof Error ? error.message : String(error),
          details: {
            decision_id: decisionId,
            toolkit_slug: input.toolkit_slug,
            tool_slug: input.tool_slug,
          },
        });

        return handleError(error);
      }
    },
  },
};

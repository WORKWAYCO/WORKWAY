/**
 * WORKWAY Construction MCP Resources
 * 
 * Resources provide read-only context that AI agents can access.
 * Unlike tools (which perform actions), resources are passive data sources.
 * 
 * MCP Resources follow URI patterns:
 * - workflow://{id}/status - Workflow status and configuration
 * - workflow://{id}/logs - Execution logs
 * - procore://projects - Available projects
 * - construction://best-practices - Domain knowledge
 */

import type { Env } from '../types';
import { getDecision, listPendingDecisions, resolveTenantId } from '../lib/db';
import { ComposioSessionProvider } from '../lib/provider-router';

function parseResourceQuery(uri: string): URLSearchParams {
  const queryIndex = uri.indexOf('?');
  if (queryIndex === -1) return new URLSearchParams();
  return new URLSearchParams(uri.slice(queryIndex + 1));
}

// ============================================================================
// Resource Definitions
// ============================================================================

export const resources = {
  // --------------------------------------------------------------------------
  // Workflow Status
  // --------------------------------------------------------------------------
  'workflow://{id}/status': {
    name: 'Workflow Status',
    description: 'Current status, configuration, and health of a workflow',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const match = uri.match(/workflow:\/\/([^/]+)\/status/);
      if (!match) return null;
      
      const workflowId = match[1];
      
      // Single query with subqueries - reduces 3 sequential queries (90ms) to 1 (30ms)
      const result = await env.DB.prepare(`
        SELECT 
          w.*,
          (SELECT json_group_array(json_object(
            'id', wa.id, 
            'action_type', wa.action_type, 
            'sequence', wa.sequence,
            'condition', wa.condition
          )) FROM workflow_actions wa WHERE wa.workflow_id = w.id ORDER BY wa.sequence) as actions_json,
          (SELECT json_group_array(json_object(
            'id', e.id, 
            'status', e.status, 
            'started_at', e.started_at,
            'completed_at', e.completed_at,
            'error', e.error
          )) FROM (
            SELECT id, status, started_at, completed_at, error 
            FROM executions 
            WHERE workflow_id = w.id 
            ORDER BY started_at DESC 
            LIMIT 5
          ) e) as executions_json
        FROM workflows w
        WHERE w.id = ?
      `).bind(workflowId).first<any>();
      
      if (!result) return null;
      
      // Parse JSON arrays from subqueries
      const actions = result.actions_json ? JSON.parse(result.actions_json) : [];
      const execResults = result.executions_json ? JSON.parse(result.executions_json) : [];
      
      // Filter out null entries (SQLite returns [null] for empty results)
      const validActions = actions.filter((a: any) => a && a.id);
      const validExecResults = execResults.filter((e: any) => e && e.id);
      
      // Calculate health metrics
      const successRate = validExecResults.length > 0
        ? validExecResults.filter((e: any) => e.status === 'completed').length / validExecResults.length
        : null;
      
      return {
        workflow: {
          id: result.id,
          name: result.name,
          description: result.description,
          status: result.status,
          triggerType: result.trigger_type,
          triggerConfig: result.trigger_config ? JSON.parse(result.trigger_config) : null,
          projectId: result.project_id,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        },
        actions: validActions.map((a: any) => ({
          id: a.id,
          type: a.action_type,
          sequence: a.sequence,
          hasCondition: !!a.condition,
        })),
        health: {
          recentExecutions: validExecResults.length,
          successRate,
          lastExecution: validExecResults[0]?.started_at || null,
          lastError: validExecResults.find((e: any) => e.error)?.error || null,
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // Workflow Execution Logs
  // --------------------------------------------------------------------------
  'workflow://{id}/logs': {
    name: 'Workflow Logs',
    description: 'Recent execution logs with detailed step traces',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const match = uri.match(/workflow:\/\/([^/]+)\/logs/);
      if (!match) return null;
      
      const workflowId = match[1];
      
      const executions = await env.DB.prepare(`
        SELECT * FROM executions 
        WHERE workflow_id = ? 
        ORDER BY started_at DESC 
        LIMIT 20
      `).bind(workflowId).all<any>();
      
      return {
        workflowId,
        executions: executions.results?.map((e: any) => ({
          id: e.id,
          status: e.status,
          startedAt: e.started_at,
          completedAt: e.completed_at,
          durationMs: e.completed_at 
            ? new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()
            : null,
          error: e.error,
          inputSummary: e.input_data 
            ? Object.keys(JSON.parse(e.input_data)).join(', ')
            : null,
        })),
        summary: {
          total: executions.results?.length || 0,
          completed: executions.results?.filter((e: any) => e.status === 'completed').length || 0,
          failed: executions.results?.filter((e: any) => e.status === 'failed').length || 0,
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // Procore Projects
  // --------------------------------------------------------------------------
  'procore://projects': {
    name: 'Procore Projects',
    description: 'List of accessible Procore projects (requires connection)',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const token = await env.DB.prepare(`
        SELECT * FROM oauth_tokens WHERE provider = 'procore' LIMIT 1
      `).first<any>();
      
      if (!token) {
        return {
          connected: false,
          message: 'Not connected to Procore. Use workway_connect_procore first.',
          projects: [],
        };
      }
      
      // Check expiration
      const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
      
      if (isExpired) {
        return {
          connected: false,
          message: 'Procore token expired. Please reconnect.',
          projects: [],
        };
      }
      
      // In production, would fetch from Procore API
      // For now, return connection status
      return {
        connected: true,
        tokenExpiresAt: token.expires_at,
        message: 'Use workway_list_procore_projects tool to fetch projects',
      };
    },
  },

  // --------------------------------------------------------------------------
  // Construction Best Practices
  // --------------------------------------------------------------------------
  'construction://best-practices': {
    name: 'Construction Best Practices',
    description: 'Domain knowledge for construction workflow automation',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      return {
        rfiAutomation: {
          description: 'Automate RFI responses using historical patterns',
          recommendedPattern: 'ai.classify → ai.generate → human.review → system.execute',
          keyMetrics: {
            currentAvgResponseTime: '9.7 days',
            targetResponseTime: '2-3 days',
            costPerRfi: '$1,080',
          },
          tips: [
            'Always include human review before sending responses',
            'Track which AI-generated responses were accepted vs edited',
            'Build similarity index from historical RFIs',
          ],
        },
        dailyLogAutomation: {
          description: 'Generate daily logs from field data',
          recommendedPattern: 'ai.extract → ai.summarize → human.review',
          keyMetrics: {
            currentTimePerLog: '2.5 hours',
            targetTimePerLog: '30 minutes',
          },
          tips: [
            'Use photo AI to extract worker counts and equipment',
            'Integrate weather API for automatic conditions',
            'Allow superintendent to review before submission',
          ],
        },
        submittalTracking: {
          description: 'Proactive submittal compliance and tracking',
          recommendedPattern: 'ai.verify → ai.predict → human.escalate',
          keyMetrics: {
            currentReviewTime: '14-21 days',
            rejectionCycleTime: '+10-20 days each',
          },
          tips: [
            'Verify against spec requirements before submission',
            'Predict rejection likelihood based on historical data',
            'Alert PM to schedule impacts from late submittals',
          ],
        },
        atlasPatterns: {
          description: 'AI Interaction Atlas patterns for construction',
          reference: 'https://github.com/quietloudlab/ai-interaction-atlas',
          commonPatterns: [
            {
              name: 'AI-Assisted with Human Review',
              flow: 'ai.generate → human.review → system.execute',
              useCase: 'RFI responses, daily log generation',
            },
            {
              name: 'AI Verification Gate',
              flow: 'ai.verify → human.escalate (if issues) → system.execute',
              useCase: 'Submittal compliance, document validation',
            },
            {
              name: 'Predictive Alert',
              flow: 'ai.predict → system.notify → human.review',
              useCase: 'Schedule delays, cost overruns, safety risks',
            },
          ],
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // Hub Toolkits
  // --------------------------------------------------------------------------
  'hub://toolkits': {
    name: 'Hub Toolkits',
    description: 'Curated allowlisted toolkit inventory for a tenant',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const query = parseResourceQuery(uri);
      const userId = query.get('user_id') || 'default';
      const tenantHint = query.get('tenant_id') || undefined;

      const tenantId = await resolveTenantId(env, userId, tenantHint);
      if (!tenantId) {
        return {
          error: 'tenant_not_found',
          message: 'Provide tenant_id and user_id query parameters to scope hub resources.',
        };
      }

      let allowlistedToolkits: string[] = [];
      try {
        const allowlisted = await env.DB.prepare(`
          SELECT DISTINCT r.toolkit_slug AS toolkit_slug
          FROM tool_access_rules r
          INNER JOIN tool_access_packs p ON p.id = r.pack_id
          WHERE r.tenant_id = ? AND p.status = 'active' AND r.rule_type = 'allow'
          ORDER BY r.toolkit_slug ASC
        `).bind(tenantId).all<{ toolkit_slug: string }>();
        allowlistedToolkits = (allowlisted.results || []).map((row) => row.toolkit_slug);
      } catch {
        allowlistedToolkits = ['slack', 'gmail', 'google_drive', 'notion', 'jira'];
      }

      let remoteToolkits: Array<{ slug: string; name: string; description?: string }> = [];
      if (env.COMPOSIO_API_KEY) {
        try {
          const composio = new ComposioSessionProvider(env);
          const toolkits = await composio.listToolkits();
          remoteToolkits = toolkits
            .filter((toolkit) => allowlistedToolkits.includes(toolkit.slug))
            .map((toolkit) => ({
              slug: toolkit.slug,
              name: toolkit.name,
              description: toolkit.description,
            }));
        } catch {
          // Keep response useful even if remote fetch fails.
        }
      }

      const toolkits = remoteToolkits.length
        ? remoteToolkits
        : allowlistedToolkits.map((slug) => ({
            slug,
            name: slug,
          }));

      return {
        tenant_id: tenantId,
        user_id: userId,
        toolkits,
      };
    },
  },

  // --------------------------------------------------------------------------
  // Hub Toolkit Tools
  // --------------------------------------------------------------------------
  'hub://toolkits/{slug}/tools': {
    name: 'Hub Toolkit Tools',
    description: 'Allowlisted tool catalog for a specific toolkit',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const match = uri.match(/hub:\/\/toolkits\/([^/?]+)\/tools/);
      if (!match) return null;

      const toolkitSlug = decodeURIComponent(match[1]);
      const query = parseResourceQuery(uri);
      const userId = query.get('user_id') || 'default';
      const tenantHint = query.get('tenant_id') || undefined;
      const tenantId = await resolveTenantId(env, userId, tenantHint);

      if (!tenantId) {
        return {
          error: 'tenant_not_found',
          message: 'Provide tenant_id and user_id query parameters to scope toolkit resources.',
        };
      }

      if (!env.COMPOSIO_API_KEY) {
        return {
          tenant_id: tenantId,
          toolkit_slug: toolkitSlug,
          tools: [],
          message: 'COMPOSIO_API_KEY not configured.',
        };
      }

      const composio = new ComposioSessionProvider(env);
      const toolkitTools = await composio.listTools(toolkitSlug);

      const checks = await Promise.all(
        toolkitTools.map(async (tool) => {
          let allowed = false;
          try {
            const result = await env.DB.prepare(`
              SELECT r.rule_type AS rule_type
              FROM tool_access_rules r
              INNER JOIN tool_access_packs p ON p.id = r.pack_id
              WHERE r.tenant_id = ? AND p.status = 'active'
                AND r.toolkit_slug = ?
                AND (r.tool_slug IS NULL OR r.tool_slug = ?)
            `).bind(tenantId, toolkitSlug, tool.slug).all<{ rule_type: 'allow' | 'deny' }>();
            const rules = result.results || [];
            allowed = rules.length > 0 && !rules.some((rule) => rule.rule_type === 'deny') && rules.some((rule) => rule.rule_type === 'allow');
          } catch {
            allowed = false;
          }

          return {
            ...tool,
            allowed,
          };
        })
      );

      return {
        tenant_id: tenantId,
        toolkit_slug: toolkitSlug,
        tools: checks.filter((tool) => tool.allowed).map((tool) => ({
          slug: tool.slug,
          name: tool.name,
          description: tool.description,
        })),
      };
    },
  },

  // --------------------------------------------------------------------------
  // Judgment Policies
  // --------------------------------------------------------------------------
  'judgment://policies': {
    name: 'Judgment Policies',
    description: 'Active policy definitions and versions for the tenant',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const query = parseResourceQuery(uri);
      const userId = query.get('user_id') || 'default';
      const tenantHint = query.get('tenant_id') || undefined;
      const tenantId = await resolveTenantId(env, userId, tenantHint);

      if (!tenantId) {
        return {
          error: 'tenant_not_found',
          message: 'Provide tenant_id and user_id query parameters.',
        };
      }

      try {
        const policies = await env.DB.prepare(`
          SELECT p.id, p.name, p.policy_type, p.status,
                 v.id AS version_id, v.version, v.effective_at, v.policy_json
          FROM judgment_policies p
          LEFT JOIN judgment_policy_versions v ON v.policy_id = p.id
          WHERE p.tenant_id = ?
          ORDER BY p.updated_at DESC, v.version DESC
        `).bind(tenantId).all<any>();

        return {
          tenant_id: tenantId,
          policies: (policies.results || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            policy_type: row.policy_type,
            status: row.status,
            version_id: row.version_id,
            version: row.version,
            effective_at: row.effective_at,
            policy_json: row.policy_json ? JSON.parse(row.policy_json) : null,
          })),
        };
      } catch {
        return {
          tenant_id: tenantId,
          policies: [],
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // Judgment Decision Detail
  // --------------------------------------------------------------------------
  'judgment://decisions/{decision_id}': {
    name: 'Judgment Decision',
    description: 'Detailed decision record and execution metadata',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const match = uri.match(/judgment:\/\/decisions\/([^/?]+)/);
      if (!match) return null;
      const decisionId = decodeURIComponent(match[1]);

      const query = parseResourceQuery(uri);
      const userId = query.get('user_id') || 'default';
      const tenantHint = query.get('tenant_id') || undefined;
      const tenantId = await resolveTenantId(env, userId, tenantHint);

      if (!tenantId) {
        return {
          error: 'tenant_not_found',
          message: 'Provide tenant_id and user_id query parameters.',
        };
      }

      const decision = await getDecision(env, tenantId, decisionId);
      if (!decision) {
        return {
          error: 'not_found',
          message: `Decision not found: ${decisionId}`,
        };
      }

      let approvals: Array<Record<string, unknown>> = [];
      try {
        const approvalRows = await env.DB.prepare(`
          SELECT id, approver_user_id, approval_tier, status, note, created_at
          FROM judgment_approvals
          WHERE decision_id = ?
          ORDER BY created_at DESC
        `).bind(decisionId).all<any>();
        approvals = (approvalRows.results || []).map((row: any) => ({
          id: row.id,
          approver_user_id: row.approver_user_id,
          approval_tier: row.approval_tier,
          status: row.status,
          note: row.note,
          created_at: row.created_at,
        }));
      } catch {
        approvals = [];
      }

      return {
        decision,
        approvals,
      };
    },
  },

  // --------------------------------------------------------------------------
  // Pending Approvals
  // --------------------------------------------------------------------------
  'judgment://approvals/pending': {
    name: 'Pending Approvals',
    description: 'Queue of pending decisions requiring human approval',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const query = parseResourceQuery(uri);
      const userId = query.get('user_id') || 'default';
      const tenantHint = query.get('tenant_id') || undefined;
      const limit = Math.min(Number(query.get('limit') || 50), 200);
      const tenantId = await resolveTenantId(env, userId, tenantHint);

      if (!tenantId) {
        return {
          error: 'tenant_not_found',
          message: 'Provide tenant_id and user_id query parameters.',
        };
      }

      const pending = await listPendingDecisions(env, tenantId, limit);
      return {
        tenant_id: tenantId,
        count: pending.length,
        approvals: pending.map((decision) => ({
          decision_id: decision.id,
          user_id: decision.userId,
          toolkit_slug: decision.toolkitSlug,
          tool_slug: decision.toolSlug,
          provider: decision.provider,
          required_approval_tier: decision.requiredApprovalTier,
          risk_score: decision.riskScore,
          reason: decision.reason,
          created_at: decision.createdAt,
        })),
      };
    },
  },

  // --------------------------------------------------------------------------
  // Integration Capabilities
  // --------------------------------------------------------------------------
  'integration://{provider}/capabilities': {
    name: 'Integration Capabilities',
    description: 'Available actions and events for an integration',
    mimeType: 'application/json',
    fetch: async (uri: string, env: Env) => {
      const match = uri.match(/integration:\/\/([^/]+)\/capabilities/);
      if (!match) return null;
      
      const provider = match[1];
      
      // Provider-specific capabilities
      const capabilities: Record<string, any> = {
        procore: {
          provider: 'procore',
          name: 'Procore',
          description: 'Construction project management platform',
          authType: 'oauth2',
          webhookEvents: [
            { event: 'rfi.created', description: 'New RFI created' },
            { event: 'rfi.updated', description: 'RFI updated' },
            { event: 'rfi.answered', description: 'RFI answered' },
            { event: 'daily_log.submitted', description: 'Daily log submitted' },
            { event: 'submittal.created', description: 'New submittal created' },
            { event: 'submittal.updated', description: 'Submittal status changed' },
            { event: 'document.uploaded', description: 'Document uploaded' },
            { event: 'change_order.created', description: 'Change order created' },
          ],
          actions: [
            { action: 'procore.rfi.create', description: 'Create an RFI' },
            { action: 'procore.rfi.respond', description: 'Add response to RFI' },
            { action: 'procore.daily_log.create', description: 'Create daily log' },
            { action: 'procore.submittal.update', description: 'Update submittal status' },
            { action: 'procore.document.upload', description: 'Upload document' },
          ],
          rateLimits: {
            requestsPerMinute: 3600,
            requestsPerDay: 100000,
          },
        },
        slack: {
          provider: 'slack',
          name: 'Slack',
          description: 'Team communication',
          authType: 'oauth2',
          actions: [
            { action: 'slack.message.send', description: 'Send message to channel' },
            { action: 'slack.message.thread', description: 'Reply in thread' },
          ],
        },
        email: {
          provider: 'email',
          name: 'Email',
          description: 'Email notifications',
          authType: 'api_key',
          actions: [
            { action: 'email.send', description: 'Send email' },
            { action: 'email.send_template', description: 'Send templated email' },
          ],
        },
      };
      
      return capabilities[provider] || {
        provider,
        error: `Unknown provider: ${provider}`,
        availableProviders: Object.keys(capabilities),
      };
    },
  },
};

/**
 * List all available resources
 */
export function listResources() {
  return Object.entries(resources).map(([uri, resource]) => ({
    uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
  }));
}

/**
 * Fetch a resource by URI
 */
export async function fetchResource(uri: string, env: Env) {
  const uriWithoutQuery = uri.split('?')[0];
  // Find matching resource pattern
  for (const [pattern, resource] of Object.entries(resources)) {
    // Convert pattern to regex
    const regexPattern = pattern.replace(/\{[^}]+\}/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(uriWithoutQuery)) {
      return await resource.fetch(uri, env);
    }
  }
  
  return null;
}

export type Resources = typeof resources;

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
      
      const workflow = await env.DB.prepare(`
        SELECT * FROM workflows WHERE id = ?
      `).bind(workflowId).first<any>();
      
      if (!workflow) return null;
      
      const actions = await env.DB.prepare(`
        SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY sequence
      `).bind(workflowId).all<any>();
      
      const recentExecutions = await env.DB.prepare(`
        SELECT id, status, started_at, completed_at, error 
        FROM executions 
        WHERE workflow_id = ? 
        ORDER BY started_at DESC 
        LIMIT 5
      `).bind(workflowId).all<any>();
      
      // Calculate health metrics
      const execResults = recentExecutions.results || [];
      const successRate = execResults.length > 0
        ? execResults.filter((e: any) => e.status === 'completed').length / execResults.length
        : null;
      
      return {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          triggerType: workflow.trigger_type,
          triggerConfig: workflow.trigger_config ? JSON.parse(workflow.trigger_config) : null,
          projectId: workflow.project_id,
          createdAt: workflow.created_at,
          updatedAt: workflow.updated_at,
        },
        actions: actions.results?.map((a: any) => ({
          id: a.id,
          type: a.action_type,
          sequence: a.sequence,
          hasCondition: !!a.condition,
        })),
        health: {
          recentExecutions: execResults.length,
          successRate,
          lastExecution: execResults[0]?.started_at || null,
          lastError: execResults.find((e: any) => e.error)?.error || null,
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
  // Find matching resource pattern
  for (const [pattern, resource] of Object.entries(resources)) {
    // Convert pattern to regex
    const regexPattern = pattern.replace(/\{[^}]+\}/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(uri)) {
      return await resource.fetch(uri, env);
    }
  }
  
  return null;
}

export type Resources = typeof resources;

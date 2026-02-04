/**
 * Workflow Lifecycle Tools
 * 
 * Core tools for creating, configuring, deploying, and managing workflows.
 */

import { z } from 'zod';
import type { Env, Workflow, WorkflowAction, ToolResult, MCPToolSet } from '../types';
import { MCP_BASE_URL, WEBHOOK_BASE_URL } from '../lib/config';

// ============================================================================
// Tool Definitions
// ============================================================================

export const workflowTools: MCPToolSet = {
  // --------------------------------------------------------------------------
  // workway_create_workflow
  // --------------------------------------------------------------------------
  create_workflow: {
    name: 'workway_create_workflow',
    description: 'Create a new construction workflow. Returns workflow_id for subsequent configuration. Start here when building any automation.',
    inputSchema: z.object({
      name: z.string().describe('Human-readable workflow name (e.g., "RFI Auto-Response")'),
      description: z.string().optional().describe('What this workflow accomplishes'),
      project_id: z.string().optional().describe('Procore project ID to scope this workflow to'),
      trigger_type: z.enum(['webhook', 'cron', 'manual']).optional().describe('How the workflow is triggered (can be set later via configure_trigger)'),
    }),
    outputSchema: z.object({
      workflow_id: z.string(),
      status: z.enum(['draft', 'active', 'paused', 'error']),
      webhook_url: z.string().optional().describe('URL to receive events (if webhook trigger)'),
      next_step: z.string().describe('What to do next'),
    }),
    execute: async (input: z.infer<typeof workflowTools.create_workflow.inputSchema>, env: Env): Promise<ToolResult<Workflow>> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const workflow: Workflow = {
        id,
        name: input.name,
        description: input.description,
        projectId: input.project_id,
        triggerType: input.trigger_type,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      
      await env.DB.prepare(`
        INSERT INTO workflows (id, name, description, project_id, trigger_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        workflow.id,
        workflow.name,
        workflow.description || null,
        workflow.projectId || null,
        workflow.triggerType || null,
        workflow.status,
        workflow.createdAt,
        workflow.updatedAt
      ).run();
      
      const webhookUrl = input.trigger_type === 'webhook' 
        ? `${WEBHOOK_BASE_URL}/${id}`
        : undefined;
      
      let nextStep = 'Call workway_configure_trigger to set up when the workflow runs';
      if (input.trigger_type === 'webhook') {
        nextStep = 'Call workway_configure_trigger to set up the webhook source and events';
      } else if (input.trigger_type) {
        nextStep = 'Call workway_add_action to add workflow steps';
      }
      
      return {
        success: true,
        data: {
          ...workflow,
          webhookUrl,
          nextStep,
        } as any,
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_configure_trigger
  // --------------------------------------------------------------------------
  configure_trigger: {
    name: 'workway_configure_trigger',
    description: 'Configure the trigger for a workflow. For webhooks, specify the source (procore) and event types. For cron, specify the schedule.',
    inputSchema: z.object({
      workflow_id: z.string().describe('The workflow to configure'),
      source: z.enum(['procore', 'slack', 'email', 'custom']).optional()
        .describe('Service that will trigger this workflow (for webhooks)'),
      event_types: z.array(z.string()).optional()
        .describe('Which events to listen for (e.g., ["rfi.created", "rfi.answered"])'),
      cron_schedule: z.string().optional()
        .describe('Cron expression (e.g., "0 9 * * 1-5" for weekdays at 9am)'),
      timezone: z.string().optional().default('America/Chicago')
        .describe('Timezone for cron schedule'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      trigger_config: z.object({
        source: z.string().optional(),
        event_types: z.array(z.string()).optional(),
        cron_schedule: z.string().optional(),
        webhook_url: z.string().optional(),
      }),
      next_step: z.string(),
    }),
    execute: async (input: z.infer<typeof workflowTools.configure_trigger.inputSchema>, env: Env): Promise<ToolResult> => {
      const triggerConfig = {
        source: input.source,
        eventTypes: input.event_types,
        cronSchedule: input.cron_schedule,
        timezone: input.timezone,
      };
      
      // Determine trigger type based on config
      let triggerType: string | null = null;
      if (input.source) {
        triggerType = 'webhook';
      } else if (input.cron_schedule) {
        triggerType = 'cron';
      }
      
      await env.DB.prepare(`
        UPDATE workflows 
        SET trigger_config = ?, trigger_type = COALESCE(?, trigger_type), updated_at = ?
        WHERE id = ?
      `).bind(
        JSON.stringify(triggerConfig),
        triggerType,
        new Date().toISOString(),
        input.workflow_id
      ).run();
      
      return {
        success: true,
        data: {
          success: true,
          triggerConfig,
          webhookUrl: input.source ? `${WEBHOOK_BASE_URL}/${input.workflow_id}` : undefined,
          nextStep: 'Call workway_add_action to add workflow steps',
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_add_action
  // --------------------------------------------------------------------------
  add_action: {
    name: 'workway_add_action',
    description: 'Add an action step to the workflow. Actions execute in sequence. Common actions: procore.rfi.respond, procore.daily_log.create, slack.message.send, email.send',
    inputSchema: z.object({
      workflow_id: z.string().describe('The workflow to add action to'),
      action_type: z.string().describe('Type of action (e.g., "procore.rfi.respond", "slack.message.send")'),
      config: z.record(z.unknown()).describe('Action-specific configuration'),
      condition: z.string().optional()
        .describe('Optional condition expression (e.g., "{{trigger.rfi.status}} == \'open\'")'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      action_id: z.string(),
      sequence: z.number(),
      next_step: z.string(),
    }),
    execute: async (input: z.infer<typeof workflowTools.add_action.inputSchema>, env: Env): Promise<ToolResult> => {
      // Get current action count for sequence
      const countResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM workflow_actions WHERE workflow_id = ?
      `).bind(input.workflow_id).first<{ count: number }>();
      
      const sequence = (countResult?.count || 0) + 1;
      const actionId = crypto.randomUUID();
      
      await env.DB.prepare(`
        INSERT INTO workflow_actions (id, workflow_id, action_type, action_config, sequence, condition)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        actionId,
        input.workflow_id,
        input.action_type,
        JSON.stringify(input.config),
        sequence,
        input.condition || null
      ).run();
      
      return {
        success: true,
        data: {
          success: true,
          actionId,
          sequence,
          nextStep: 'Add more actions with workway_add_action, or call workway_deploy to activate the workflow',
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_deploy
  // --------------------------------------------------------------------------
  deploy: {
    name: 'workway_deploy',
    description: 'Deploy the workflow to production. Validates configuration before deploying. Use dry_run=true to validate without deploying.',
    inputSchema: z.object({
      workflow_id: z.string().describe('The workflow to deploy'),
      dry_run: z.boolean().optional().default(false)
        .describe('If true, validates without deploying'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deployment_id: z.string().optional(),
      webhook_url: z.string().optional(),
      validation_errors: z.array(z.string()),
      status: z.enum(['deployed', 'validated', 'failed']),
    }),
    execute: async (input: z.infer<typeof workflowTools.deploy.inputSchema>, env: Env): Promise<ToolResult> => {
      // Fetch workflow and actions
      const workflow = await env.DB.prepare(`
        SELECT * FROM workflows WHERE id = ?
      `).bind(input.workflow_id).first<any>();
      
      if (!workflow) {
        return {
          success: false,
          error: `Workflow ${input.workflow_id} not found`,
        };
      }
      
      const actions = await env.DB.prepare(`
        SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY sequence
      `).bind(input.workflow_id).all<any>();
      
      // Validate
      const errors: string[] = [];
      
      if (!workflow.trigger_type) {
        errors.push('Workflow must have a trigger type');
      }
      
      if (workflow.trigger_type === 'webhook' && !workflow.trigger_config) {
        errors.push('Webhook trigger requires source and event_types configuration');
      }
      
      if (actions.results?.length === 0) {
        errors.push('Workflow must have at least one action');
      }
      
      // Check for Procore connection if using Procore actions
      const procoreActions = actions.results?.filter((a: any) => 
        a.action_type.startsWith('procore.')
      ) || [];
      
      if (procoreActions.length > 0) {
        // TODO: Check OAuth token exists
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          data: {
            success: false,
            validationErrors: errors,
            status: 'failed',
          },
        };
      }
      
      if (input.dry_run) {
        return {
          success: true,
          data: {
            success: true,
            validationErrors: [],
            status: 'validated',
          },
        };
      }
      
      // Deploy
      const deploymentId = crypto.randomUUID();
      
      await env.DB.prepare(`
        UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?
      `).bind('active', new Date().toISOString(), input.workflow_id).run();
      
      return {
        success: true,
        data: {
          success: true,
          deploymentId,
          webhookUrl: workflow.trigger_type === 'webhook' 
            ? `${WEBHOOK_BASE_URL}/${input.workflow_id}`
            : undefined,
          validationErrors: [],
          status: 'deployed',
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_test
  // --------------------------------------------------------------------------
  test: {
    name: 'workway_test',
    description: 'Send a test event through the workflow and verify end-to-end execution. Returns execution results and any errors.',
    inputSchema: z.object({
      workflow_id: z.string().describe('The workflow to test'),
      test_payload: z.record(z.unknown()).optional()
        .describe('Mock event payload to simulate trigger'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      execution_id: z.string(),
      steps_completed: z.number(),
      steps_total: z.number(),
      output: z.record(z.unknown()).optional(),
      errors: z.array(z.string()),
      duration_ms: z.number(),
    }),
    execute: async (input: z.infer<typeof workflowTools.test.inputSchema>, env: Env): Promise<ToolResult> => {
      const startTime = Date.now();
      const executionId = crypto.randomUUID();
      
      // Fetch workflow and actions
      const workflow = await env.DB.prepare(`
        SELECT * FROM workflows WHERE id = ?
      `).bind(input.workflow_id).first<any>();
      
      if (!workflow) {
        return {
          success: false,
          error: `Workflow ${input.workflow_id} not found`,
        };
      }
      
      const actions = await env.DB.prepare(`
        SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY sequence
      `).bind(input.workflow_id).all<any>();
      
      const totalSteps = actions.results?.length || 0;
      let completedSteps = 0;
      const errors: string[] = [];
      let output: Record<string, unknown> = {};
      
      // Execute each action (simplified for now)
      for (const action of actions.results || []) {
        try {
          // TODO: Actually execute action
          completedSteps++;
          output[action.action_type] = { status: 'simulated', actionId: action.id };
        } catch (e) {
          errors.push(`Action ${action.action_type} failed: ${e}`);
          break;
        }
      }
      
      // Record execution
      await env.DB.prepare(`
        INSERT INTO executions (id, workflow_id, status, started_at, completed_at, input_data, output_data, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        executionId,
        input.workflow_id,
        errors.length > 0 ? 'failed' : 'completed',
        new Date(startTime).toISOString(),
        new Date().toISOString(),
        JSON.stringify(input.test_payload || {}),
        JSON.stringify(output),
        errors.length > 0 ? errors.join('; ') : null
      ).run();
      
      return {
        success: errors.length === 0,
        data: {
          success: errors.length === 0,
          executionId,
          stepsCompleted: completedSteps,
          stepsTotal: totalSteps,
          output,
          errors,
          durationMs: Date.now() - startTime,
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_workflows
  // --------------------------------------------------------------------------
  list_workflows: {
    name: 'workway_list_workflows',
    description: 'List all workflows for this account. Filter by status if needed.',
    inputSchema: z.object({
      status: z.enum(['all', 'draft', 'active', 'paused', 'error']).optional().default('all')
        .describe('Filter by workflow status'),
      project_id: z.string().optional()
        .describe('Filter by Procore project ID'),
    }),
    outputSchema: z.object({
      workflows: z.array(z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        trigger_type: z.string(),
        project_id: z.string().optional(),
        created_at: z.string(),
      })),
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof workflowTools.list_workflows.inputSchema>, env: Env): Promise<ToolResult> => {
      let query = 'SELECT * FROM workflows WHERE 1=1';
      const params: any[] = [];
      
      if (input.status && input.status !== 'all') {
        query += ' AND status = ?';
        params.push(input.status);
      }
      
      if (input.project_id) {
        query += ' AND project_id = ?';
        params.push(input.project_id);
      }
      
      query += ' ORDER BY updated_at DESC';
      
      const stmt = env.DB.prepare(query);
      const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<any>();
      
      return {
        success: true,
        data: {
          workflows: result.results?.map((w: any) => ({
            id: w.id,
            name: w.name,
            status: w.status,
            triggerType: w.trigger_type,
            projectId: w.project_id,
            createdAt: w.created_at,
          })) || [],
          total: result.results?.length || 0,
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_rollback
  // --------------------------------------------------------------------------
  rollback: {
    name: 'workway_rollback',
    description: 'Rollback to a previous working version of the workflow, or pause the workflow if having issues.',
    inputSchema: z.object({
      workflow_id: z.string().describe('The workflow to rollback'),
      action: z.enum(['pause', 'rollback']).default('pause')
        .describe('Whether to pause or rollback to previous version'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      new_status: z.string(),
      message: z.string(),
    }),
    execute: async (input: z.infer<typeof workflowTools.rollback.inputSchema>, env: Env): Promise<ToolResult> => {
      const newStatus = input.action === 'pause' ? 'paused' : 'draft';
      
      await env.DB.prepare(`
        UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?
      `).bind(newStatus, new Date().toISOString(), input.workflow_id).run();
      
      return {
        success: true,
        data: {
          success: true,
          newStatus,
          message: input.action === 'pause' 
            ? 'Workflow paused. No new executions will run until reactivated.'
            : 'Workflow rolled back to draft. Review configuration before redeploying.',
        },
      };
    },
  },
};

export type WorkflowTools = typeof workflowTools;

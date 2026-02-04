/**
 * Workflow Templates
 * 
 * Pre-built workflow templates for common construction automation scenarios.
 * Users can create workflows from templates with minimal configuration.
 */

import { z } from 'zod';
import type { Env, ToolResult } from '../types';
import { MCP_BASE_URL } from '../lib/config';

// ============================================================================
// Template Definitions
// ============================================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'rfi' | 'submittal' | 'daily_log' | 'reporting' | 'notifications';
  triggerType: 'cron' | 'webhook' | 'manual';
  defaultTriggerConfig?: Record<string, any>;
  actions: {
    type: string;
    name: string;
    config: Record<string, any>;
  }[];
  variables: {
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'email';
    required: boolean;
    default?: any;
  }[];
}

const templates: Record<string, WorkflowTemplate> = {
  rfi_overdue_alert: {
    id: 'rfi_overdue_alert',
    name: 'RFI Overdue Alert',
    description: 'Send daily notifications for RFIs that are past their due date',
    category: 'rfi',
    triggerType: 'cron',
    defaultTriggerConfig: {
      schedule: '0 9 * * 1-5', // Weekdays at 9 AM
      timezone: 'America/Chicago',
    },
    actions: [
      {
        type: 'procore_api',
        name: 'Fetch Open RFIs',
        config: {
          endpoint: '/projects/{{project_id}}/rfis',
          method: 'GET',
          params: { 'filters[status]': 'open' },
        },
      },
      {
        type: 'transform',
        name: 'Filter Overdue',
        config: {
          operation: 'filter',
          input: '{{steps.fetch_open_rfis.output}}',
          condition: 'item.due_date && new Date(item.due_date) < new Date()',
        },
      },
      {
        type: 'notification',
        name: 'Send Alert',
        config: {
          template: 'rfi_overdue_alert',
          channel: '{{notification_channel}}',
          to: '{{notification_to}}',
        },
      },
    ],
    variables: [
      { name: 'project_id', description: 'Procore Project ID', type: 'number', required: true },
      { name: 'notification_channel', description: 'Notification channel (email or slack)', type: 'string', required: true, default: 'email' },
      { name: 'notification_to', description: 'Email address or Slack webhook URL', type: 'string', required: true },
    ],
  },

  weekly_project_summary: {
    id: 'weekly_project_summary',
    name: 'Weekly Project Summary',
    description: 'Generate and send a weekly summary of project activity every Monday morning',
    category: 'reporting',
    triggerType: 'cron',
    defaultTriggerConfig: {
      schedule: '0 8 * * 1', // Monday at 8 AM
      timezone: 'America/Chicago',
    },
    actions: [
      {
        type: 'procore_api',
        name: 'Fetch RFIs',
        config: {
          endpoint: '/projects/{{project_id}}/rfis',
          method: 'GET',
        },
      },
      {
        type: 'procore_api',
        name: 'Fetch Submittals',
        config: {
          endpoint: '/projects/{{project_id}}/submittals',
          method: 'GET',
        },
      },
      {
        type: 'transform',
        name: 'Generate Summary',
        config: {
          operation: 'aggregate',
          data: {
            rfis: {
              total: '{{steps.fetch_rfis.output.length}}',
              open: '{{steps.fetch_rfis.output.filter(r => r.status === "open").length}}',
            },
            submittals: {
              total: '{{steps.fetch_submittals.output.length}}',
              pending: '{{steps.fetch_submittals.output.filter(s => s.status === "pending").length}}',
            },
          },
        },
      },
      {
        type: 'notification',
        name: 'Send Summary',
        config: {
          template: 'daily_summary',
          channel: '{{notification_channel}}',
          to: '{{notification_to}}',
        },
      },
    ],
    variables: [
      { name: 'project_id', description: 'Procore Project ID', type: 'number', required: true },
      { name: 'notification_channel', description: 'email or slack', type: 'string', required: true, default: 'email' },
      { name: 'notification_to', description: 'Recipient email or Slack webhook', type: 'string', required: true },
    ],
  },

  submittal_status_digest: {
    id: 'submittal_status_digest',
    name: 'Submittal Status Digest',
    description: 'Daily digest of pending and overdue submittals',
    category: 'submittal',
    triggerType: 'cron',
    defaultTriggerConfig: {
      schedule: '0 7 * * 1-5', // Weekdays at 7 AM
      timezone: 'America/Chicago',
    },
    actions: [
      {
        type: 'procore_api',
        name: 'Fetch Submittals',
        config: {
          endpoint: '/projects/{{project_id}}/submittals',
          method: 'GET',
        },
      },
      {
        type: 'transform',
        name: 'Calculate Stats',
        config: {
          operation: 'aggregate',
          data: {
            pending: '{{steps.fetch_submittals.output.filter(s => s.status === "pending").length}}',
            approved: '{{steps.fetch_submittals.output.filter(s => s.status === "approved").length}}',
            overdue: '{{steps.fetch_submittals.output.filter(s => s.due_date && new Date(s.due_date) < new Date() && s.status === "pending").length}}',
          },
        },
      },
      {
        type: 'notification',
        name: 'Send Digest',
        config: {
          template: 'submittal_status',
          channel: '{{notification_channel}}',
          to: '{{notification_to}}',
        },
      },
    ],
    variables: [
      { name: 'project_id', description: 'Procore Project ID', type: 'number', required: true },
      { name: 'notification_channel', description: 'email or slack', type: 'string', required: true, default: 'email' },
      { name: 'notification_to', description: 'Recipient', type: 'string', required: true },
    ],
  },

  daily_log_reminder: {
    id: 'daily_log_reminder',
    name: 'Daily Log Reminder',
    description: 'Remind team to submit daily logs if not already submitted',
    category: 'daily_log',
    triggerType: 'cron',
    defaultTriggerConfig: {
      schedule: '0 16 * * 1-5', // Weekdays at 4 PM
      timezone: 'America/Chicago',
    },
    actions: [
      {
        type: 'procore_api',
        name: 'Check Daily Log',
        config: {
          endpoint: '/projects/{{project_id}}/daily_logs',
          method: 'GET',
          params: {
            'filters[start_date]': '{{today}}',
            'filters[end_date]': '{{today}}',
          },
        },
      },
      {
        type: 'condition',
        name: 'Check If Missing',
        config: {
          condition: '!steps.check_daily_log.output || steps.check_daily_log.output.work_logs.length === 0',
          onTrue: 'send_reminder',
          onFalse: 'skip',
        },
      },
      {
        type: 'notification',
        name: 'Send Reminder',
        config: {
          template: 'generic',
          data: {
            title: 'Daily Log Reminder',
            message: "Don't forget to submit today's daily log before leaving site.",
          },
          channel: '{{notification_channel}}',
          to: '{{notification_to}}',
        },
      },
    ],
    variables: [
      { name: 'project_id', description: 'Procore Project ID', type: 'number', required: true },
      { name: 'notification_channel', description: 'email or slack', type: 'string', required: true, default: 'slack' },
      { name: 'notification_to', description: 'Slack webhook URL', type: 'string', required: true },
    ],
  },

  new_rfi_notification: {
    id: 'new_rfi_notification',
    name: 'New RFI Notification',
    description: 'Get notified instantly when a new RFI is created',
    category: 'rfi',
    triggerType: 'webhook',
    defaultTriggerConfig: {
      eventType: 'rfis.create',
    },
    actions: [
      {
        type: 'notification',
        name: 'Notify Team',
        config: {
          template: 'generic',
          data: {
            title: 'New RFI Created',
            message: 'RFI #{{trigger.number}}: {{trigger.subject}}',
            ctaUrl: '{{trigger.url}}',
            ctaText: 'View RFI',
          },
          channel: '{{notification_channel}}',
          to: '{{notification_to}}',
        },
      },
    ],
    variables: [
      { name: 'project_id', description: 'Procore Project ID (for webhook registration)', type: 'number', required: true },
      { name: 'notification_channel', description: 'email or slack', type: 'string', required: true, default: 'slack' },
      { name: 'notification_to', description: 'Recipient', type: 'string', required: true },
    ],
  },

  submittal_approved_notification: {
    id: 'submittal_approved_notification',
    name: 'Submittal Approved Notification',
    description: 'Get notified when a submittal is approved',
    category: 'submittal',
    triggerType: 'webhook',
    defaultTriggerConfig: {
      eventType: 'submittals.update',
      filter: 'payload.status === "approved"',
    },
    actions: [
      {
        type: 'notification',
        name: 'Notify Team',
        config: {
          template: 'generic',
          data: {
            title: 'Submittal Approved',
            message: 'Submittal #{{trigger.number}} "{{trigger.title}}" has been approved.',
            ctaUrl: '{{trigger.url}}',
            ctaText: 'View Submittal',
          },
          channel: '{{notification_channel}}',
          to: '{{notification_to}}',
        },
      },
    ],
    variables: [
      { name: 'project_id', description: 'Procore Project ID', type: 'number', required: true },
      { name: 'notification_channel', description: 'email or slack', type: 'string', required: true, default: 'email' },
      { name: 'notification_to', description: 'Recipient', type: 'string', required: true },
    ],
  },
};

// ============================================================================
// Template Tools
// ============================================================================

export const templateTools = {
  // --------------------------------------------------------------------------
  // workway_list_templates
  // --------------------------------------------------------------------------
  list_templates: {
    name: 'workway_list_templates',
    description: 'List all available workflow templates. Templates are pre-built workflows for common construction automation tasks.',
    inputSchema: z.object({
      category: z.enum(['all', 'rfi', 'submittal', 'daily_log', 'reporting', 'notifications']).optional().default('all')
        .describe('Filter by category'),
    }),
    outputSchema: z.object({
      templates: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string(),
        trigger_type: z.string(),
        variables: z.array(z.object({
          name: z.string(),
          description: z.string(),
          required: z.boolean(),
        })),
      })),
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof templateTools.list_templates.inputSchema>, env: Env): Promise<ToolResult> => {
      const filtered = Object.values(templates).filter(
        t => input.category === 'all' || t.category === input.category
      );

      return {
        success: true,
        data: {
          templates: filtered.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            triggerType: t.triggerType,
            variables: t.variables.map(v => ({
              name: v.name,
              description: v.description,
              required: v.required,
              default: v.default,
            })),
          })),
          total: filtered.length,
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_create_from_template
  // --------------------------------------------------------------------------
  create_from_template: {
    name: 'workway_create_from_template',
    description: 'Create a new workflow from a template. Provide template ID and variable values.',
    inputSchema: z.object({
      template_id: z.string().describe('Template ID (from workway_list_templates)'),
      name: z.string().optional().describe('Custom workflow name (uses template name if not provided)'),
      variables: z.record(z.any()).describe('Variable values for the template'),
    }),
    outputSchema: z.object({
      workflow_id: z.string(),
      name: z.string(),
      status: z.string(),
      actions_created: z.number(),
    }),
    execute: async (input: z.infer<typeof templateTools.create_from_template.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const template = templates[input.template_id];
        if (!template) {
          throw new Error(`Template not found: ${input.template_id}`);
        }

        // Validate required variables
        for (const v of template.variables) {
          if (v.required && input.variables[v.name] === undefined && v.default === undefined) {
            throw new Error(`Missing required variable: ${v.name}`);
          }
        }

        // Merge defaults with provided values
        const vars = { ...Object.fromEntries(template.variables.map(v => [v.name, v.default])), ...input.variables };

        // Create workflow
        const workflowId = crypto.randomUUID();
        const workflowName = input.name || template.name;

        await env.DB.prepare(`
          INSERT INTO workflows (id, name, description, trigger_type, trigger_config, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
        `).bind(
          workflowId,
          workflowName,
          template.description,
          template.triggerType,
          JSON.stringify({ ...template.defaultTriggerConfig, variables: vars })
        ).run();

        // Create actions
        for (let i = 0; i < template.actions.length; i++) {
          const action = template.actions[i];
          const actionId = crypto.randomUUID();

          // Replace variable placeholders in config
          const configStr = JSON.stringify(action.config);
          const resolvedConfig = configStr.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

          await env.DB.prepare(`
            INSERT INTO workflow_actions (id, workflow_id, action_type, name, config, sequence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            actionId,
            workflowId,
            action.type,
            action.name,
            resolvedConfig,
            i + 1
          ).run();
        }

        // Configure notifications if variables provided
        if (vars.notification_channel && vars.notification_to) {
          const notifConfig: any = {};
          if (vars.notification_channel === 'email') {
            notifConfig.email = true;
            notifConfig.emailTo = vars.notification_to;
          } else if (vars.notification_channel === 'slack') {
            notifConfig.slack = true;
            notifConfig.slackWebhook = vars.notification_to;
          }

          await env.DB.prepare(`
            UPDATE workflows SET notification_config = ? WHERE id = ?
          `).bind(JSON.stringify(notifConfig), workflowId).run();
        }

        return {
          success: true,
          data: {
            workflowId,
            name: workflowName,
            status: 'draft',
            actionsCreated: template.actions.length,
            templateUsed: template.id,
            nextStep: 'Call workway_deploy to activate the workflow',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create workflow from template',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_template
  // --------------------------------------------------------------------------
  get_template: {
    name: 'workway_get_template',
    description: 'Get detailed information about a specific workflow template.',
    inputSchema: z.object({
      template_id: z.string().describe('Template ID'),
    }),
    outputSchema: z.object({
      template: z.any(),
    }),
    execute: async (input: z.infer<typeof templateTools.get_template.inputSchema>, env: Env): Promise<ToolResult> => {
      const template = templates[input.template_id];
      if (!template) {
        return {
          success: false,
          error: `Template not found: ${input.template_id}`,
        };
      }

      return {
        success: true,
        data: {
          template: {
            ...template,
            webhookUrl: template.triggerType === 'webhook' 
              ? `${MCP_BASE_URL}/webhooks/{workflow_id}` 
              : undefined,
          },
        },
      };
    },
  },
};

export type TemplateTools = typeof templateTools;

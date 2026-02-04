/**
 * Notification Tools
 * 
 * Tools for sending notifications via email (Resend) and Slack webhooks.
 * Used by workflows to alert users about events.
 */

import { z } from 'zod';
import type { Env, ToolResult } from '../types';

// ============================================================================
// Email Templates
// ============================================================================

const emailTemplates = {
  rfi_overdue_alert: {
    subject: '[Action Required] Overdue RFIs Need Attention',
    html: (data: any) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Overdue RFIs Require Your Attention</h2>
        <p style="color: #666;">The following RFIs are past their due date and need immediate action:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">RFI #</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Subject</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Due Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            ${(data.rfis || []).map((rfi: any) => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${rfi.number}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${rfi.subject}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${rfi.dueDate}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; color: #dc2626;">${rfi.daysOverdue} days</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="color: #666;">Please review and respond to these RFIs as soon as possible.</p>
        <a href="${data.projectUrl || '#'}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View in Procore</a>
      </div>
    `,
  },
  
  submittal_status: {
    subject: 'Submittal Status Update',
    html: (data: any) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Submittal Status Update</h2>
        <p style="color: #666;">Here's your submittal status summary for <strong>${data.projectName}</strong>:</p>
        <div style="display: flex; gap: 16px; margin: 20px 0;">
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${data.pending || 0}</div>
            <div style="color: #92400e;">Pending</div>
          </div>
          <div style="background: #dcfce7; padding: 16px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #22c55e;">${data.approved || 0}</div>
            <div style="color: #166534;">Approved</div>
          </div>
          <div style="background: #fee2e2; padding: 16px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${data.overdue || 0}</div>
            <div style="color: #991b1b;">Overdue</div>
          </div>
        </div>
        ${data.overdue > 0 ? '<p style="color: #dc2626;">⚠️ You have overdue submittals that require immediate attention.</p>' : ''}
      </div>
    `,
  },
  
  daily_summary: {
    subject: 'Daily Project Summary',
    html: (data: any) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Daily Summary: ${data.projectName}</h2>
        <p style="color: #666;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        
        <h3 style="color: #1a1a1a; margin-top: 24px;">📋 RFIs</h3>
        <ul style="color: #666;">
          <li>Open: ${data.rfis?.open || 0}</li>
          <li>Closed today: ${data.rfis?.closedToday || 0}</li>
          <li>Overdue: ${data.rfis?.overdue || 0}</li>
        </ul>
        
        <h3 style="color: #1a1a1a; margin-top: 24px;">📄 Submittals</h3>
        <ul style="color: #666;">
          <li>Pending review: ${data.submittals?.pending || 0}</li>
          <li>Approved today: ${data.submittals?.approvedToday || 0}</li>
        </ul>
        
        <h3 style="color: #1a1a1a; margin-top: 24px;">📸 Activity</h3>
        <ul style="color: #666;">
          <li>Photos uploaded: ${data.photos?.uploadedToday || 0}</li>
          <li>Documents added: ${data.documents?.addedToday || 0}</li>
        </ul>
      </div>
    `,
  },
  
  workflow_error: {
    subject: '[Alert] Workflow Execution Failed',
    html: (data: any) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Workflow Execution Failed</h2>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Workflow:</strong> ${data.workflowName}</p>
          <p style="margin: 8px 0 0; color: #991b1b;"><strong>Error:</strong> ${data.error}</p>
          <p style="margin: 8px 0 0; color: #991b1b;"><strong>Failed at:</strong> ${data.failedAt}</p>
        </div>
        <p style="color: #666;">The workflow has been paused. Please review the error and restart when ready.</p>
        <a href="${data.dashboardUrl || '#'}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Details</a>
      </div>
    `,
  },
  
  generic: {
    subject: 'WORKWAY Notification',
    html: (data: any) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${data.title || 'Notification'}</h2>
        <p style="color: #666;">${data.message || ''}</p>
        ${data.ctaUrl ? `<a href="${data.ctaUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">${data.ctaText || 'View Details'}</a>` : ''}
      </div>
    `,
  },
};

// ============================================================================
// Notification Tools
// ============================================================================

export const notificationTools = {
  // --------------------------------------------------------------------------
  // workway_send_email
  // --------------------------------------------------------------------------
  send_email: {
    name: 'workway_send_email',
    description: 'Send an email notification. Supports templates for common construction notifications (RFI alerts, submittal status, daily summaries).',
    inputSchema: z.object({
      to: z.string().email().describe('Recipient email address'),
      subject: z.string().optional().describe('Email subject (uses template default if not provided)'),
      template: z.enum(['rfi_overdue_alert', 'submittal_status', 'daily_summary', 'workflow_error', 'generic']).optional().default('generic')
        .describe('Email template to use'),
      data: z.record(z.any()).optional().default({})
        .describe('Template data (varies by template)'),
      from_name: z.string().optional().default('WORKWAY')
        .describe('Sender name'),
    }),
    outputSchema: z.object({
      sent: z.boolean(),
      message_id: z.string().optional(),
      error: z.string().optional(),
    }),
    execute: async (input: z.infer<typeof notificationTools.send_email.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        if (!env.RESEND_API_KEY) {
          throw new Error('Email service not configured. Set RESEND_API_KEY.');
        }
        
        const template = emailTemplates[input.template || 'generic'];
        const subject = input.subject || template.subject;
        const html = template.html(input.data || {});
        
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${input.from_name} <notifications@workway.co>`,
            to: input.to,
            subject,
            html,
          }),
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to send email: ${error}`);
        }
        
        const result = await response.json() as { id: string };
        
        return {
          success: true,
          data: {
            sent: true,
            messageId: result.id,
            to: input.to,
            subject,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send email',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_send_slack
  // --------------------------------------------------------------------------
  send_slack: {
    name: 'workway_send_slack',
    description: 'Send a Slack notification via webhook. Supports rich formatting with blocks.',
    inputSchema: z.object({
      webhook_url: z.string().url().describe('Slack incoming webhook URL'),
      message: z.string().describe('Main message text'),
      title: z.string().optional().describe('Bold title for the message'),
      color: z.enum(['good', 'warning', 'danger']).optional().default('good')
        .describe('Attachment color (good=green, warning=yellow, danger=red)'),
      fields: z.array(z.object({
        title: z.string(),
        value: z.string(),
        short: z.boolean().optional().default(true),
      })).optional().describe('Additional fields to display'),
      footer: z.string().optional().describe('Footer text'),
    }),
    outputSchema: z.object({
      sent: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input: z.infer<typeof notificationTools.send_slack.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const payload: any = {
          text: input.message,
          attachments: [{
            color: input.color === 'good' ? '#22c55e' : input.color === 'warning' ? '#f59e0b' : '#dc2626',
            blocks: [
              ...(input.title ? [{
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${input.title}*\n${input.message}`,
                },
              }] : [{
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: input.message,
                },
              }]),
              ...(input.fields && input.fields.length > 0 ? [{
                type: 'section',
                fields: input.fields.map(f => ({
                  type: 'mrkdwn',
                  text: `*${f.title}*\n${f.value}`,
                })),
              }] : []),
            ],
            footer: input.footer || 'WORKWAY',
            footer_icon: 'https://workway.co/favicon.ico',
            ts: Math.floor(Date.now() / 1000),
          }],
        };
        
        const response = await fetch(input.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`Slack webhook failed: ${response.status}`);
        }
        
        return {
          success: true,
          data: {
            sent: true,
            channel: 'webhook',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send Slack message',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_notify
  // --------------------------------------------------------------------------
  notify: {
    name: 'workway_notify',
    description: 'Send a notification through configured channels. Uses workflow notification settings to route to email and/or Slack.',
    inputSchema: z.object({
      workflow_id: z.string().describe('Workflow ID to get notification settings from'),
      event_type: z.enum(['rfi_overdue', 'submittal_update', 'daily_summary', 'workflow_error', 'custom'])
        .describe('Type of event triggering the notification'),
      title: z.string().describe('Notification title'),
      message: z.string().describe('Notification message'),
      data: z.record(z.any()).optional().default({})
        .describe('Additional data for templates'),
      severity: z.enum(['info', 'warning', 'critical']).optional().default('info')
        .describe('Notification severity'),
    }),
    outputSchema: z.object({
      channels_notified: z.array(z.string()),
      errors: z.array(z.string()).optional(),
    }),
    execute: async (input: z.infer<typeof notificationTools.notify.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get workflow notification settings
        const workflow = await env.DB.prepare(`
          SELECT notification_config FROM workflows WHERE id = ?
        `).bind(input.workflow_id).first<any>();
        
        const notificationConfig = workflow?.notification_config 
          ? JSON.parse(workflow.notification_config) 
          : { email: true, slack: false };
        
        const channelsNotified: string[] = [];
        const errors: string[] = [];
        
        // Map event type to template
        const templateMap: Record<string, string> = {
          rfi_overdue: 'rfi_overdue_alert',
          submittal_update: 'submittal_status',
          daily_summary: 'daily_summary',
          workflow_error: 'workflow_error',
          custom: 'generic',
        };
        
        // Send email if configured
        if (notificationConfig.email && notificationConfig.emailTo) {
          try {
            const emailResult = await notificationTools.send_email.execute({
              to: notificationConfig.emailTo,
              template: templateMap[input.event_type] as any,
              data: { ...input.data, title: input.title, message: input.message },
            }, env);
            
            if (emailResult.success) {
              channelsNotified.push('email');
            } else {
              errors.push(`Email: ${emailResult.error}`);
            }
          } catch (e) {
            errors.push(`Email: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
        
        // Send Slack if configured
        if (notificationConfig.slack && notificationConfig.slackWebhook) {
          try {
            const slackResult = await notificationTools.send_slack.execute({
              webhook_url: notificationConfig.slackWebhook,
              title: input.title,
              message: input.message,
              color: input.severity === 'critical' ? 'danger' : input.severity === 'warning' ? 'warning' : 'good',
              fields: Object.entries(input.data || {}).slice(0, 6).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              })),
            }, env);
            
            if (slackResult.success) {
              channelsNotified.push('slack');
            } else {
              errors.push(`Slack: ${slackResult.error}`);
            }
          } catch (e) {
            errors.push(`Slack: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
        
        return {
          success: true,
          data: {
            channelsNotified,
            errors: errors.length > 0 ? errors : undefined,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send notifications',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_configure_notifications
  // --------------------------------------------------------------------------
  configure_notifications: {
    name: 'workway_configure_notifications',
    description: 'Configure notification settings for a workflow (email addresses, Slack webhooks, etc.)',
    inputSchema: z.object({
      workflow_id: z.string().describe('Workflow ID'),
      email_enabled: z.boolean().optional().describe('Enable email notifications'),
      email_to: z.string().email().optional().describe('Email recipient'),
      slack_enabled: z.boolean().optional().describe('Enable Slack notifications'),
      slack_webhook: z.string().url().optional().describe('Slack webhook URL'),
    }),
    outputSchema: z.object({
      updated: z.boolean(),
    }),
    execute: async (input: z.infer<typeof notificationTools.configure_notifications.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get current config
        const workflow = await env.DB.prepare(`
          SELECT notification_config FROM workflows WHERE id = ?
        `).bind(input.workflow_id).first<any>();
        
        if (!workflow) {
          throw new Error('Workflow not found');
        }
        
        const currentConfig = workflow.notification_config 
          ? JSON.parse(workflow.notification_config) 
          : {};
        
        // Merge with new settings
        const newConfig = {
          ...currentConfig,
          ...(input.email_enabled !== undefined && { email: input.email_enabled }),
          ...(input.email_to && { emailTo: input.email_to }),
          ...(input.slack_enabled !== undefined && { slack: input.slack_enabled }),
          ...(input.slack_webhook && { slackWebhook: input.slack_webhook }),
        };
        
        await env.DB.prepare(`
          UPDATE workflows 
          SET notification_config = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(newConfig), input.workflow_id).run();
        
        return {
          success: true,
          data: {
            updated: true,
            config: newConfig,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to configure notifications',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_alert_workflow_error
  // --------------------------------------------------------------------------
  alert_workflow_error: {
    name: 'workway_alert_workflow_error',
    description: 'Send an alert when a workflow execution fails. Automatically uses workflow notification settings.',
    inputSchema: z.object({
      workflow_id: z.string().describe('Workflow ID that failed'),
      execution_id: z.string().describe('Execution ID that failed'),
      error_message: z.string().describe('Error message'),
      failed_action: z.string().optional().describe('Name of the action that failed'),
    }),
    outputSchema: z.object({
      alerted: z.boolean(),
      channels: z.array(z.string()),
    }),
    execute: async (input: z.infer<typeof notificationTools.alert_workflow_error.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get workflow details
        const workflow = await env.DB.prepare(`
          SELECT name, notification_config FROM workflows WHERE id = ?
        `).bind(input.workflow_id).first<any>();
        
        if (!workflow) {
          throw new Error('Workflow not found');
        }
        
        const notificationConfig = workflow.notification_config 
          ? JSON.parse(workflow.notification_config) 
          : {};
        
        const channelsAlerted: string[] = [];
        
        const errorData = {
          workflowName: workflow.name,
          workflowId: input.workflow_id,
          executionId: input.execution_id,
          error: input.error_message,
          failedAt: new Date().toISOString(),
          failedAction: input.failed_action,
        };
        
        // Send email alert if configured
        if (notificationConfig.email && notificationConfig.emailTo) {
          try {
            await notificationTools.send_email.execute({
              to: notificationConfig.emailTo,
              template: 'workflow_error',
              data: errorData,
            }, env);
            channelsAlerted.push('email');
          } catch (e) {
            console.error('Failed to send email alert:', e);
          }
        }
        
        // Send Slack alert if configured
        if (notificationConfig.slack && notificationConfig.slackWebhook) {
          try {
            await notificationTools.send_slack.execute({
              webhook_url: notificationConfig.slackWebhook,
              title: '⚠️ Workflow Failed',
              message: `*${workflow.name}* failed to execute`,
              color: 'danger',
              fields: [
                { title: 'Error', value: input.error_message, short: false },
                { title: 'Execution ID', value: input.execution_id, short: true },
                { title: 'Failed At', value: new Date().toLocaleString(), short: true },
                ...(input.failed_action ? [{ title: 'Failed Action', value: input.failed_action, short: true }] : []),
              ],
            }, env);
            channelsAlerted.push('slack');
          } catch (e) {
            console.error('Failed to send Slack alert:', e);
          }
        }
        
        // Log the alert
        await env.DB.prepare(`
          INSERT INTO notification_logs (id, workflow_id, channel, recipient, subject, status, sent_at, metadata)
          VALUES (?, ?, 'error_alert', ?, 'Workflow Error Alert', 'sent', datetime('now'), ?)
        `).bind(
          crypto.randomUUID(),
          input.workflow_id,
          notificationConfig.emailTo || 'system',
          JSON.stringify(errorData)
        ).run();
        
        return {
          success: true,
          data: {
            alerted: channelsAlerted.length > 0,
            channels: channelsAlerted,
            message: channelsAlerted.length > 0 
              ? `Alert sent via: ${channelsAlerted.join(', ')}`
              : 'No notification channels configured for this workflow',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send error alert',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_configure_error_alerts
  // --------------------------------------------------------------------------
  configure_error_alerts: {
    name: 'workway_configure_error_alerts',
    description: 'Configure global error alerting for workflow failures. Alerts go to admins when any workflow fails.',
    inputSchema: z.object({
      admin_email: z.string().email().optional().describe('Admin email for error alerts'),
      slack_webhook: z.string().url().optional().describe('Slack webhook for error alerts'),
      alert_on_first_failure: z.boolean().optional().default(true)
        .describe('Alert immediately on first failure'),
      alert_threshold: z.number().optional().default(1)
        .describe('Number of failures before alerting (if not alerting on first)'),
    }),
    outputSchema: z.object({
      configured: z.boolean(),
    }),
    execute: async (input: z.infer<typeof notificationTools.configure_error_alerts.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const config = {
          adminEmail: input.admin_email,
          slackWebhook: input.slack_webhook,
          alertOnFirstFailure: input.alert_on_first_failure,
          alertThreshold: input.alert_threshold,
          updatedAt: new Date().toISOString(),
        };
        
        // Store in KV for global access
        await env.KV.put('error_alert_config', JSON.stringify(config));
        
        return {
          success: true,
          data: {
            configured: true,
            config,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to configure error alerts',
        };
      }
    },
  },
};

export type NotificationTools = typeof notificationTools;

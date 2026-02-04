/**
 * WORKWAY Construction MCP Tools
 * 
 * All tools exposed by the MCP server, organized by category:
 * - Workflow: Create, configure, deploy, test workflows
 * - Procore: Connect and interact with Procore API
 * - Notifications: Email and Slack notifications
 * - Debugging: Diagnose issues, get unstuck, observe executions
 */

export { workflowTools } from './workflow';
export { procoreTools } from './procore';
export { notificationTools } from './notifications';
export { templateTools } from './templates';
export { debuggingTools } from './debugging';

import { workflowTools } from './workflow';
import { procoreTools } from './procore';
import { notificationTools } from './notifications';
import { templateTools } from './templates';
import { debuggingTools } from './debugging';

/**
 * All tools combined for MCP registration
 */
export const allTools = {
  // Workflow lifecycle
  ...workflowTools,
  // Procore integration
  ...procoreTools,
  // Notifications
  ...notificationTools,
  // Templates
  ...templateTools,
  // Debugging & observability
  ...debuggingTools,
};

/**
 * Tool names organized by category (for documentation)
 */
export const toolCategories = {
  workflow: [
    'workway_create_workflow',
    'workway_configure_trigger',
    'workway_add_action',
    'workway_deploy',
    'workway_test',
    'workway_list_workflows',
    'workway_rollback',
  ],
  procore: [
    'workway_connect_procore',
    'workway_check_procore_connection',
    'workway_list_procore_companies',
    'workway_list_procore_projects',
    'workway_get_procore_rfis',
    'workway_get_procore_daily_logs',
    'workway_get_procore_submittals',
    'workway_get_procore_photos',
    'workway_get_procore_documents',
    'workway_get_procore_schedule',
    'workway_create_procore_rfi',
  ],
  notifications: [
    'workway_send_email',
    'workway_send_slack',
    'workway_notify',
    'workway_configure_notifications',
    'workway_alert_workflow_error',
    'workway_configure_error_alerts',
  ],
  templates: [
    'workway_list_templates',
    'workway_create_from_template',
    'workway_get_template',
  ],
  debugging: [
    'workway_diagnose',
    'workway_get_unstuck',
    'workway_observe_execution',
  ],
};

export type AllTools = typeof allTools;

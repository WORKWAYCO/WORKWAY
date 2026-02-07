/**
 * WORKWAY Construction MCP Tools
 * 
 * All tools exposed by the MCP server, organized by category:
 * 
 * AUTOMATION LAYER (MCP):
 * - Workflow: Create, configure, deploy, test workflows
 * - Procore: Connect and interact with Procore API
 * - Notifications: Email and Slack notifications
 * - Debugging: Diagnose issues, get unstuck, observe executions
 * 
 * INTELLIGENCE LAYER (Skills):
 * - Skills: AI-powered tools that produce outcomes (draft_rfi, daily_log_summary, etc.)
 */

export { workflowTools } from './workflow';
export { procoreTools } from './procore';
export { autodeskTools } from './autodesk';
export { shovelsTools } from './shovels';
export { droneDeployTools } from './dronedeploy';
export { notificationTools } from './notifications';
export { templateTools } from './templates';
export { debuggingTools } from './debugging';
export { skillTools } from './skills';
export { seederTools } from './seeder';

import { workflowTools } from './workflow';
import { procoreTools } from './procore';
import { autodeskTools } from './autodesk';
import { shovelsTools } from './shovels';
import { droneDeployTools } from './dronedeploy';
import { notificationTools } from './notifications';
import { templateTools } from './templates';
import { debuggingTools } from './debugging';
import { skillTools } from './skills';
import { seederTools } from './seeder';

/**
 * All tools combined for MCP registration
 * 
 * Note: seederTools excluded from production - dev/test only
 */
export const allTools = {
  // Workflow lifecycle
  ...workflowTools,
  // Procore integration (Automation Layer)
  ...procoreTools,
  // Autodesk APS integration (BIM, Data Management)
  ...autodeskTools,
  // Shovels.ai integration (Permit Intelligence)
  ...shovelsTools,
  // DroneDeploy integration (Reality Capture)
  ...droneDeployTools,
  // Notifications
  ...notificationTools,
  // Templates
  ...templateTools,
  // Debugging & observability
  ...debuggingTools,
  // Intelligence Layer Skills
  ...skillTools,
  // seederTools excluded - use seederTools directly for dev/test
};

/**
 * Tool names organized by category (for documentation)
 * 
 * Two layers:
 * - AUTOMATION LAYER: MCP tools for connectivity (procore, workflow, etc.)
 * - INTELLIGENCE LAYER: AI Skills that produce outcomes (draft_rfi, etc.)
 */
/**
 * Tool Naming Convention
 * 
 * Pattern: workway_{action}_{provider}_{resource}
 * 
 * Actions (verbs):
 * - get: Retrieve single item
 * - list: Retrieve multiple items
 * - create: Create new item
 * - update: Modify existing item
 * - delete: Remove item
 * - connect: Establish OAuth connection
 * - check: Verify status
 * - test: Test/validate
 * - deploy: Deploy workflow
 * - send: Send notifications
 * - configure: Configure settings
 * - diagnose: Debug/diagnose issues
 * - observe: Observe/monitor execution
 * - rollback: Rollback changes
 * - seed: Seed test data
 * 
 * Examples:
 * - workway_connect_procore (connects to provider)
 * - workway_list_procore_projects (lists from provider)
 * - workway_create_workflow (internal, no provider)
 * - workway_skill_draft_rfi (Intelligence Layer skill)
 */
export const toolCategories = {
  // === AUTOMATION LAYER (MCP) ===
  workflow: [
    'workway_create_workflow',
    'workway_configure_workflow_trigger',
    'workway_add_workflow_action',
    'workway_deploy_workflow',
    'workway_test_workflow',
    'workway_list_workflows',
    'workway_rollback_workflow',
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
    'workway_create_procore_webhook',
    'workway_list_procore_webhooks',
    'workway_delete_procore_webhook',
    'workway_test_procore_api',
  ],
  notifications: [
    'workway_send_notification_email',
    'workway_send_notification_slack',
    'workway_send_notification',
    'workway_configure_workflow_notifications',
    'workway_send_workflow_error_alert',
    'workway_configure_global_alerts',
  ],
  templates: [
    'workway_list_templates',
    'workway_create_workflow_from_template',
    'workway_get_template',
  ],
  debugging: [
    'workway_diagnose_workflow',
    'workway_get_workflow_guidance',
    'workway_observe_workflow_execution',
  ],
  autodesk: [
    'workway_list_autodesk_projects',
    'workway_get_autodesk_model',
    'workway_list_autodesk_documents',
    'workway_query_autodesk_bim',
    'workway_get_autodesk_exchanges',
  ],
  shovels: [
    'workway_search_shovels_permits',
    'workway_get_shovels_contractor',
    'workway_get_shovels_property',
    'workway_search_shovels_activity',
  ],
  dronedeploy: [
    'workway_list_dronedeploy_plans',
    'workway_get_dronedeploy_map',
    'workway_get_dronedeploy_issues',
    'workway_get_dronedeploy_volume',
  ],
  // === INTELLIGENCE LAYER (Skills) ===
  skills: [
    'workway_skill_draft_rfi',
    'workway_skill_daily_log_summary',
    'workway_skill_submittal_review',
    'workway_skill_bim_clash_summary',
    'workway_skill_design_change_impact',
    'workway_skill_market_intelligence',
    'workway_skill_contractor_vetting',
    'workway_skill_site_progress_report',
    'workway_skill_earthwork_analysis',
  ],
  // === TEST DATA SEEDING ===
  seeder: [
    'workway_seed_test_rfis',
    'workway_seed_test_daily_logs',
    'workway_seed_test_data',
    'workway_get_test_sample_data',
  ],
};

export type AllTools = typeof allTools;

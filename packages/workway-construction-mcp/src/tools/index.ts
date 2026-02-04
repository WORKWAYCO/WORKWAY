/**
 * WORKWAY Construction MCP Tools
 * 
 * All tools exposed by the MCP server, organized by category:
 * - Workflow: Create, configure, deploy, test workflows
 * - Procore: Connect and interact with Procore API
 * - Debugging: Diagnose issues, get unstuck, observe executions
 */

export { workflowTools } from './workflow';
export { procoreTools } from './procore';
export { debuggingTools } from './debugging';

import { workflowTools } from './workflow';
import { procoreTools } from './procore';
import { debuggingTools } from './debugging';

/**
 * All tools combined for MCP registration
 */
export const allTools = {
  // Workflow lifecycle
  ...workflowTools,
  // Procore integration
  ...procoreTools,
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
    'workway_list_procore_projects',
    'workway_get_procore_rfis',
    'workway_get_procore_daily_logs',
    'workway_get_procore_submittals',
  ],
  debugging: [
    'workway_diagnose',
    'workway_get_unstuck',
    'workway_observe_execution',
  ],
};

export type AllTools = typeof allTools;

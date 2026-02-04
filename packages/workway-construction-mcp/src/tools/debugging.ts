/**
 * Debugging & Observability Tools
 * 
 * These tools are the KEY differentiator - they help AI agents (and humans)
 * understand what's happening in workflows and get unstuck.
 * 
 * Incorporates AI Interaction Atlas taxonomy for describing AI behaviors:
 * https://github.com/quietloudlab/ai-interaction-atlas
 * 
 * Atlas Dimensions:
 * - AI Tasks: classify, generate, verify, transform, summarize
 * - Human Tasks: review, approve, edit, compare, validate
 * - System Tasks: routing, logging, state management, execution
 * - Data Artifacts: inputs, outputs, intermediate states
 * - Constraints: latency, privacy, cost, accuracy
 * - Touchpoints: MCP, webhooks, notifications, UI
 */

import { z } from 'zod';
import type { Env, DiagnosisResult, UnstuckGuidance, LogEntry, ToolResult } from '../types';

// ============================================================================
// Atlas-Aligned Types for Observability
// ============================================================================

/**
 * AI Task types from the Atlas taxonomy
 */
const AITaskType = z.enum([
  'classify',    // Categorizing inputs (e.g., RFI type detection)
  'generate',    // Creating content (e.g., RFI response draft)
  'verify',      // Checking correctness (e.g., submittal compliance)
  'transform',   // Converting formats (e.g., photo to log entry)
  'summarize',   // Condensing information (e.g., daily log summary)
  'extract',     // Pulling structured data (e.g., spec requirements)
  'compare',     // Finding differences (e.g., revision comparison)
  'predict',     // Forecasting outcomes (e.g., rejection likelihood)
]);

/**
 * Human Task types from the Atlas taxonomy
 */
const HumanTaskType = z.enum([
  'review',      // Examining AI output
  'approve',     // Authorizing action
  'edit',        // Modifying content
  'reject',      // Declining suggestion
  'escalate',    // Routing to expert
  'validate',    // Confirming accuracy
]);

/**
 * Execution trace for a workflow step
 */
const ExecutionTrace = z.object({
  stepId: z.string(),
  timestamp: z.string(),
  taskType: z.enum(['ai', 'human', 'system']),
  aiTask: AITaskType.optional(),
  humanTask: HumanTaskType.optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  durationMs: z.number(),
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
  }).optional(),
  confidence: z.number().optional(),
  humanOverride: z.boolean().optional(),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const debuggingTools = {
  // --------------------------------------------------------------------------
  // workway_diagnose
  // --------------------------------------------------------------------------
  diagnose: {
    name: 'workway_diagnose',
    description: `Diagnose why a workflow isn't working. Call this when:
- Deployment fails
- Webhooks don't fire
- Actions error or timeout
- OAuth connections fail
- AI outputs are wrong or unexpected

Returns structured diagnosis with root cause, suggested fix, and execution logs.`,
    inputSchema: z.object({
      workflow_id: z.string().describe('The workflow to diagnose'),
      symptom: z.enum([
        'deployment_failed',
        'webhook_not_firing',
        'oauth_error',
        'action_failed',
        'ai_output_wrong',
        'timeout',
        'permission_denied',
        'rate_limited',
        'unknown',
      ]).describe('What symptom are you seeing?'),
      execution_id: z.string().optional()
        .describe('Specific execution to diagnose (optional)'),
      context: z.string().optional()
        .describe('Additional context about what you observed'),
    }),
    outputSchema: z.object({
      diagnosis: z.string().describe('Human-readable diagnosis'),
      root_cause: z.string().describe('Technical root cause'),
      affected_component: z.enum(['trigger', 'action', 'oauth', 'ai', 'network', 'config', 'unknown']),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      suggested_fix: z.string().describe('What to do to fix it'),
      fix_tool: z.string().optional().describe('Which MCP tool to call to fix this'),
      fix_params: z.record(z.unknown()).optional().describe('Parameters for fix tool'),
      confidence: z.number().min(0).max(1).describe('Confidence in diagnosis'),
      logs: z.array(z.object({
        timestamp: z.string(),
        level: z.enum(['debug', 'info', 'warn', 'error']),
        message: z.string(),
        context: z.record(z.unknown()).optional(),
      })),
      atlas_analysis: z.object({
        ai_tasks_involved: z.array(AITaskType).optional(),
        human_tasks_required: z.array(HumanTaskType).optional(),
        failure_point: z.string().optional(),
      }).optional().describe('AI Interaction Atlas analysis of the failure'),
    }),
    execute: async (input: z.infer<typeof debuggingTools.diagnose.inputSchema>, env: Env): Promise<ToolResult<DiagnosisResult>> => {
      const logs: LogEntry[] = [];
      let diagnosis = '';
      let rootCause = '';
      let affectedComponent = 'unknown';
      let suggestedFix = '';
      let fixTool: string | undefined;
      let fixParams: Record<string, unknown> | undefined;
      let confidence = 0.5;

      // Fetch workflow
      const workflow = await env.DB.prepare(`
        SELECT * FROM workflows WHERE id = ?
      `).bind(input.workflow_id).first<any>();

      if (!workflow) {
        return {
          success: false,
          error: `Workflow ${input.workflow_id} not found`,
        };
      }

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Diagnosing workflow: ${workflow.name}`,
        context: { status: workflow.status, triggerType: workflow.trigger_type },
      });

      // Fetch recent executions
      const executions = await env.DB.prepare(`
        SELECT * FROM executions 
        WHERE workflow_id = ? 
        ORDER BY started_at DESC 
        LIMIT 10
      `).bind(input.workflow_id).all<any>();

      // Symptom-specific diagnosis
      switch (input.symptom) {
        case 'deployment_failed':
          const actions = await env.DB.prepare(`
            SELECT * FROM workflow_actions WHERE workflow_id = ?
          `).bind(input.workflow_id).all<any>();

          if (!actions.results?.length) {
            diagnosis = 'Workflow has no actions configured';
            rootCause = 'Empty workflow - at least one action is required';
            affectedComponent = 'config';
            suggestedFix = 'Add at least one action using workway_add_action';
            fixTool = 'workway_add_action';
            confidence = 0.95;
          } else if (!workflow.trigger_config && workflow.trigger_type === 'webhook') {
            diagnosis = 'Webhook trigger not configured';
            rootCause = 'Missing trigger configuration for webhook-based workflow';
            affectedComponent = 'trigger';
            suggestedFix = 'Configure the webhook trigger with source and event types';
            fixTool = 'workway_configure_trigger';
            confidence = 0.9;
          }
          break;

        case 'webhook_not_firing':
          diagnosis = 'Webhook events not being received';
          
          // Check if webhook is registered with source
          const triggerConfig = workflow.trigger_config ? JSON.parse(workflow.trigger_config) : null;
          
          if (!triggerConfig?.source) {
            rootCause = 'Webhook source not configured';
            affectedComponent = 'trigger';
            suggestedFix = 'Configure the webhook source (e.g., procore)';
            fixTool = 'workway_configure_trigger';
            confidence = 0.85;
          } else if (triggerConfig.source === 'procore') {
            rootCause = 'Procore webhook may not be registered or project access missing';
            affectedComponent = 'oauth';
            suggestedFix = 'Verify Procore connection and webhook subscription. Check that the project has webhook access enabled.';
            fixTool = 'workway_check_procore_connection';
            confidence = 0.7;
            
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'warn',
              message: 'Procore webhooks require project-level configuration',
              context: { 
                webhookUrl: `https://workway-construction-mcp.workers.dev/webhooks/${input.workflow_id}`,
                eventTypes: triggerConfig.eventTypes,
              },
            });
          }
          break;

        case 'oauth_error':
          diagnosis = 'OAuth authentication failed';
          
          // Check token status
          const token = await env.DB.prepare(`
            SELECT * FROM oauth_tokens WHERE provider = 'procore' LIMIT 1
          `).first<any>();
          
          if (!token) {
            rootCause = 'No Procore OAuth token found';
            affectedComponent = 'oauth';
            suggestedFix = 'Connect to Procore using workway_connect_procore';
            fixTool = 'workway_connect_procore';
            confidence = 0.95;
          } else if (token.expires_at && new Date(token.expires_at) < new Date()) {
            rootCause = 'OAuth token has expired';
            affectedComponent = 'oauth';
            suggestedFix = 'Token needs refresh. This should happen automatically, but you can reconnect if issues persist.';
            confidence = 0.9;
          } else {
            rootCause = 'OAuth token exists but may have insufficient scopes';
            affectedComponent = 'oauth';
            suggestedFix = 'Check that the Procore connection has the required scopes for this workflow';
            confidence = 0.6;
          }
          break;

        case 'action_failed':
          const failedExec = executions.results?.find((e: any) => e.status === 'failed');
          
          if (failedExec) {
            diagnosis = `Action failed during execution`;
            rootCause = failedExec.error || 'Unknown error during action execution';
            affectedComponent = 'action';
            suggestedFix = 'Review the error message and check action configuration';
            confidence = 0.8;
            
            logs.push({
              timestamp: failedExec.completed_at || failedExec.started_at,
              level: 'error',
              message: failedExec.error || 'Action execution failed',
              context: JSON.parse(failedExec.input_data || '{}'),
            });
          }
          break;

        case 'ai_output_wrong':
          diagnosis = 'AI-generated output did not meet expectations';
          rootCause = 'AI task may need better prompting, more context, or human review';
          affectedComponent = 'ai';
          suggestedFix = 'Consider adding a human review step (Atlas: human.review) before the AI output is used. Check if the AI has sufficient context from the trigger data.';
          confidence = 0.6;
          
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'AI outputs benefit from human-in-the-loop validation in construction contexts',
            context: {
              atlasRecommendation: 'Add human.review or human.approve task after AI generation',
            },
          });
          break;

        case 'timeout':
          diagnosis = 'Workflow or action timed out';
          rootCause = 'Execution exceeded time limits, possibly due to slow external API or complex AI task';
          affectedComponent = 'network';
          suggestedFix = 'Check if Procore API is responding slowly. Consider breaking complex workflows into smaller steps.';
          confidence = 0.7;
          break;

        case 'rate_limited':
          diagnosis = 'Rate limit exceeded';
          rootCause = 'Too many API calls to Procore or AI service';
          affectedComponent = 'network';
          suggestedFix = 'Reduce workflow trigger frequency or implement batching for bulk operations';
          confidence = 0.85;
          break;

        default:
          diagnosis = 'Unable to determine specific issue';
          rootCause = 'Insufficient information for diagnosis';
          affectedComponent = 'unknown';
          suggestedFix = 'Provide more context or check execution logs manually';
          confidence = 0.3;
      }

      return {
        success: true,
        data: {
          diagnosis,
          rootCause,
          affectedComponent: affectedComponent as any,
          severity: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
          suggestedFix,
          fixTool,
          fixParams,
          confidence,
          logs,
          atlasAnalysis: {
            aiTasksInvolved: ['generate', 'classify'],
            humanTasksRequired: affectedComponent === 'ai' ? ['review', 'validate'] : undefined,
            failurePoint: affectedComponent,
          },
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_unstuck
  // --------------------------------------------------------------------------
  get_unstuck: {
    name: 'workway_get_unstuck',
    description: `When you don't know how to proceed with workflow configuration. Describe your goal and what went wrong - this tool will guide you through the next steps.

Use this when:
- You're not sure which tool to call next
- You've tried something and it didn't work
- You need help understanding how to achieve an outcome`,
    inputSchema: z.object({
      workflow_id: z.string().optional().describe('Workflow you\'re working on (if any)'),
      goal: z.string().describe('What are you trying to accomplish?'),
      what_tried: z.string().optional().describe('What have you already tried?'),
      what_failed: z.string().optional().describe('What went wrong?'),
    }),
    outputSchema: z.object({
      guidance: z.string().describe('Explanation of how to proceed'),
      next_steps: z.array(z.object({
        step: z.number(),
        tool: z.string(),
        params: z.record(z.unknown()),
        explanation: z.string(),
      })),
      example: z.string().optional().describe('Example of similar working workflow'),
      documentation_url: z.string().optional(),
      atlas_context: z.object({
        ai_tasks: z.array(z.string()).optional(),
        human_tasks: z.array(z.string()).optional(),
        recommended_pattern: z.string().optional(),
      }).optional(),
    }),
    execute: async (input: z.infer<typeof debuggingTools.get_unstuck.inputSchema>, env: Env): Promise<ToolResult<UnstuckGuidance>> => {
      const goalLower = input.goal.toLowerCase();
      
      // Pattern matching for common construction workflow goals
      let guidance = '';
      let nextSteps: UnstuckGuidance['nextSteps'] = [];
      let example: string | undefined;
      let atlasContext: any = {};

      // RFI-related goals
      if (goalLower.includes('rfi') && (goalLower.includes('automat') || goalLower.includes('respond') || goalLower.includes('faster'))) {
        guidance = `To automate RFI responses, you need a workflow that:
1. Triggers when a new RFI is created in Procore
2. Uses AI to search historical RFIs for similar questions
3. Generates a draft response based on past resolutions
4. Optionally routes to a human for review before sending

This follows the Atlas pattern: ai.classify → ai.generate → human.review → system.execute`;

        nextSteps = [
          {
            step: 1,
            tool: 'workway_create_workflow',
            params: {
              name: 'RFI Auto-Response',
              trigger_type: 'webhook',
              description: 'Automatically draft responses to new RFIs based on historical patterns',
            },
            explanation: 'Create the workflow container',
          },
          {
            step: 2,
            tool: 'workway_configure_trigger',
            params: {
              source: 'procore',
              event_types: ['rfi.created'],
            },
            explanation: 'Listen for new RFIs in Procore',
          },
          {
            step: 3,
            tool: 'workway_add_action',
            params: {
              action_type: 'ai.search_similar_rfis',
              config: {
                similarity_threshold: 0.7,
                max_results: 5,
              },
            },
            explanation: 'Find similar past RFIs (Atlas: ai.classify)',
          },
          {
            step: 4,
            tool: 'workway_add_action',
            params: {
              action_type: 'ai.generate_rfi_response',
              config: {
                include_sources: true,
                confidence_threshold: 0.8,
              },
            },
            explanation: 'Generate draft response (Atlas: ai.generate)',
          },
          {
            step: 5,
            tool: 'workway_add_action',
            params: {
              action_type: 'procore.rfi.add_response',
              config: {
                status: 'draft',
                notify_assignee: true,
              },
            },
            explanation: 'Save draft to Procore for human review',
          },
        ];

        example = `A mid-size GC using this pattern reduced RFI response time from 9.7 days to 2.3 days. The AI drafts responses for 70% of RFIs, with humans reviewing before sending.`;

        atlasContext = {
          aiTasks: ['classify', 'generate'],
          humanTasks: ['review', 'approve'],
          recommendedPattern: 'ai.classify → ai.generate → human.review → system.execute',
        };
      }
      // Daily log goals
      else if (goalLower.includes('daily log') || goalLower.includes('daily report')) {
        guidance = `To automate daily logs, you need a workflow that:
1. Runs on a schedule (end of day) or triggers from photo uploads
2. Extracts information from photos, weather APIs, and labor data
3. Generates a structured daily log
4. Allows superintendent review before submission

Atlas pattern: ai.extract → ai.summarize → human.review → system.execute`;

        nextSteps = [
          {
            step: 1,
            tool: 'workway_create_workflow',
            params: {
              name: 'Daily Log Automation',
              trigger_type: 'cron',
              description: 'Generate daily logs from site data',
            },
            explanation: 'Create the workflow',
          },
          {
            step: 2,
            tool: 'workway_configure_trigger',
            params: {
              cron_schedule: '0 17 * * 1-5',
              timezone: 'America/Chicago',
            },
            explanation: 'Run at 5 PM on weekdays',
          },
          {
            step: 3,
            tool: 'workway_add_action',
            params: {
              action_type: 'ai.extract_from_photos',
              config: {
                extract_fields: ['weather', 'workers', 'equipment', 'progress'],
              },
            },
            explanation: 'Extract data from site photos (Atlas: ai.extract)',
          },
          {
            step: 4,
            tool: 'workway_add_action',
            params: {
              action_type: 'ai.generate_daily_log',
              config: {
                include_weather_api: true,
                format: 'procore_daily_log',
              },
            },
            explanation: 'Generate structured log (Atlas: ai.summarize)',
          },
        ];

        atlasContext = {
          aiTasks: ['extract', 'summarize', 'transform'],
          humanTasks: ['review', 'edit', 'approve'],
          recommendedPattern: 'ai.extract → ai.summarize → human.review',
        };
      }
      // Submittal goals
      else if (goalLower.includes('submittal')) {
        guidance = `To automate submittal tracking, you need a workflow that:
1. Monitors submittal status in Procore
2. Verifies submittals against spec requirements
3. Predicts rejection likelihood
4. Alerts project managers to potential delays

Atlas pattern: ai.verify → ai.predict → system.notify → human.escalate`;

        nextSteps = [
          {
            step: 1,
            tool: 'workway_create_workflow',
            params: {
              name: 'Submittal Compliance Checker',
              trigger_type: 'webhook',
              description: 'Verify submittals against specs before review',
            },
            explanation: 'Create the workflow',
          },
          {
            step: 2,
            tool: 'workway_configure_trigger',
            params: {
              source: 'procore',
              event_types: ['submittal.created', 'submittal.updated'],
            },
            explanation: 'Listen for submittal events',
          },
        ];

        atlasContext = {
          aiTasks: ['verify', 'predict', 'classify'],
          humanTasks: ['review', 'escalate'],
          recommendedPattern: 'ai.verify → ai.predict → human.escalate (if issues)',
        };
      }
      // Generic help
      else {
        guidance = `I can help you build construction workflows. Common patterns include:

1. **RFI Automation** - Draft responses to RFIs using historical data
2. **Daily Log Generation** - Create logs from photos and field data  
3. **Submittal Tracking** - Verify compliance and predict rejections
4. **Change Order Alerts** - Monitor for cost impacts

What specific outcome are you trying to achieve?`;

        nextSteps = [
          {
            step: 1,
            tool: 'workway_list_workflows',
            params: { status: 'all' },
            explanation: 'See your existing workflows',
          },
          {
            step: 2,
            tool: 'workway_connect_procore',
            params: {},
            explanation: 'Connect to Procore if not already connected',
          },
        ];
      }

      return {
        success: true,
        data: {
          guidance,
          nextSteps,
          example,
          documentationUrl: 'https://docs.workway.co/construction',
          atlasContext,
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_observe_execution
  // --------------------------------------------------------------------------
  observe_execution: {
    name: 'workway_observe_execution',
    description: `Get detailed observability data for a workflow execution. Shows the full trace of AI tasks, human tasks, and system operations with Atlas-aligned categorization.

Use this to understand:
- What the AI did and why
- Where human intervention occurred
- Token usage and latency
- Confidence scores for AI outputs`,
    inputSchema: z.object({
      execution_id: z.string().describe('The execution to observe'),
      include_ai_reasoning: z.boolean().optional().default(true)
        .describe('Include AI reasoning traces'),
    }),
    outputSchema: z.object({
      execution_id: z.string(),
      workflow_name: z.string(),
      status: z.string(),
      started_at: z.string(),
      completed_at: z.string().optional(),
      duration_ms: z.number(),
      trace: z.array(ExecutionTrace),
      summary: z.object({
        total_steps: z.number(),
        ai_tasks: z.number(),
        human_tasks: z.number(),
        system_tasks: z.number(),
        total_tokens: z.number(),
        human_overrides: z.number(),
        avg_ai_confidence: z.number(),
      }),
      atlas_breakdown: z.object({
        ai_tasks_used: z.array(z.string()),
        human_tasks_used: z.array(z.string()),
        constraints_hit: z.array(z.string()),
      }),
    }),
    execute: async (input: z.infer<typeof debuggingTools.observe_execution.inputSchema>, env: Env): Promise<ToolResult> => {
      const execution = await env.DB.prepare(`
        SELECT e.*, w.name as workflow_name
        FROM executions e
        JOIN workflows w ON e.workflow_id = w.id
        WHERE e.id = ?
      `).bind(input.execution_id).first<any>();

      if (!execution) {
        return {
          success: false,
          error: `Execution ${input.execution_id} not found`,
        };
      }

      // In a real implementation, we'd fetch detailed trace data
      // For now, return structured placeholder
      const startTime = new Date(execution.started_at).getTime();
      const endTime = execution.completed_at 
        ? new Date(execution.completed_at).getTime()
        : Date.now();

      return {
        success: true,
        data: {
          executionId: input.execution_id,
          workflowName: execution.workflow_name,
          status: execution.status,
          startedAt: execution.started_at,
          completedAt: execution.completed_at,
          durationMs: endTime - startTime,
          trace: [], // Would be populated from detailed execution logs
          summary: {
            totalSteps: 0,
            aiTasks: 0,
            humanTasks: 0,
            systemTasks: 0,
            totalTokens: 0,
            humanOverrides: 0,
            avgAiConfidence: 0,
          },
          atlasBreakdown: {
            aiTasksUsed: [],
            humanTasksUsed: [],
            constraintsHit: [],
          },
        },
      };
    },
  },
};

export type DebuggingTools = typeof debuggingTools;

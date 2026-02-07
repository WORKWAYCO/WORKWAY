/**
 * WORKWAY Intelligence Layer Skills
 * 
 * AI-powered Skills that produce outcomes, not just retrieve data.
 * These are the premium capabilities that sit on top of the Automation Layer (MCP).
 * 
 * Atlas Taxonomy:
 * - AI Tasks: generate, summarize, classify, verify
 * - Human Tasks: review, approve, edit
 * - Constraints: context limits, approval requirements
 * 
 * Philosophy: "The tool recedes; the outcome remains."
 * 
 * AI Gateway Integration:
 * When CLOUDFLARE_ACCOUNT_ID and AI_GATEWAY_ID are configured, all LLM calls
 * are routed through Cloudflare AI Gateway for automatic observability:
 * - Token counting and cost tracking
 * - Caching for repeated queries
 * - Rate limiting
 * - Analytics dashboard
 */

import { z } from 'zod';
import type { Env, ToolResult, MCPToolSet } from '../types';
import { procoreTools } from './procore';
import { 
  AIGatewayClient, 
  createAIGatewayClient, 
  callWorkersAI,
  type AIGatewayResponse,
  type AIGatewayMetadata,
} from '../lib/ai-gateway';
import { logAIUsage } from '../lib/audit-logger';

// ============================================================================
// Extended Env with AI Gateway configuration
// ============================================================================

interface EnvWithAIGateway extends Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
}

// ============================================================================
// Helper: Call LLM with AI Gateway integration
// ============================================================================

interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

interface LLMRequestWithMetadata extends LLMRequest {
  /** Metadata for AI Gateway observability */
  metadata?: AIGatewayMetadata;
  /** Model to use (defaults to llama-3.1-8b-instruct) */
  model?: string;
  /** Enable caching for this request */
  cache?: boolean;
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  latencyMs?: number;
  cached?: boolean;
}

/**
 * Call LLM with automatic AI Gateway routing when configured
 * 
 * Priority:
 * 1. AI Gateway (if CLOUDFLARE_ACCOUNT_ID and AI_GATEWAY_ID are set)
 * 2. Direct Workers AI (if AI binding is available)
 * 3. Fallback placeholder
 */
async function callLLM(
  env: EnvWithAIGateway, 
  request: LLMRequestWithMetadata
): Promise<LLMResponse> {
  const model = request.model || '@cf/meta/llama-3.1-8b-instruct';
  const startTime = Date.now();
  
  // Build messages
  const messages = [
    ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
    { role: 'user' as const, content: request.prompt },
  ];
  
  // Try AI Gateway first
  const aiGateway = createAIGatewayClient(env);
  
  if (aiGateway) {
    try {
      const response = await aiGateway.chat({
        provider: 'workers-ai',
        model,
        messages,
        maxTokens: request.maxTokens || 1024,
        metadata: request.metadata,
        cache: request.cache,
      });
      
      // Log AI usage for tracking
      if (request.metadata?.userId) {
        await logAIUsage(env, {
          toolName: request.metadata.toolName || 'unknown',
          userId: request.metadata.userId,
          projectId: request.metadata.projectId,
          model: response.model,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          cost: response.cost?.totalCost,
          latencyMs: response.latencyMs,
          cached: response.cached,
          provider: 'workers-ai',
          success: true,
        });
      }
      
      return {
        content: response.content,
        usage: response.usage,
        cost: response.cost?.totalCost,
        latencyMs: response.latencyMs,
        cached: response.cached,
      };
    } catch (error) {
      // Log failed AI usage
      if (request.metadata?.userId) {
        await logAIUsage(env, {
          toolName: request.metadata.toolName || 'unknown',
          userId: request.metadata.userId,
          projectId: request.metadata.projectId,
          model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime,
          cached: false,
          provider: 'workers-ai',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      
      // Fall through to try direct Workers AI
      console.warn('AI Gateway call failed, falling back to direct Workers AI:', error);
    }
  }
  
  // Fallback to direct Workers AI
  if (env.AI) {
    const response = await callWorkersAI(env.AI, {
      model,
      messages,
      maxTokens: request.maxTokens || 1024,
      metadata: request.metadata,
    });
    
    // Log AI usage for direct Workers AI calls too
    if (request.metadata?.userId) {
      await logAIUsage(env, {
        toolName: request.metadata.toolName || 'unknown',
        userId: request.metadata.userId,
        projectId: request.metadata.projectId,
        model: response.model,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        latencyMs: response.latencyMs,
        cached: false,
        provider: 'workers-ai-direct',
        success: true,
      });
    }
    
    return {
      content: response.content,
      usage: response.usage,
      latencyMs: response.latencyMs,
      cached: false,
    };
  }
  
  // No AI available
  return {
    content: '[AI response would be generated here - Workers AI not configured]',
  };
}

// ============================================================================
// Skill: draft_rfi
// ============================================================================

export const skillTools: MCPToolSet = {
  /**
   * Draft RFI Skill
   * 
   * AI Task: generate
   * Human Task: review, approve
   * Constraint: requires project context
   * 
   * Takes context (specs, drawings, question intent) and generates a
   * well-structured RFI ready for submission.
   */
  draft_rfi: {
    name: 'workway_skill_draft_rfi',
    description: `Intelligence Layer Skill: Draft an RFI (Request for Information) using AI.

Takes your question intent and project context, then generates a professional RFI with:
- Clear, specific subject line
- Detailed question with reference to specs/drawings
- Suggested response format
- Impact assessment if question is delayed

Human review required before submission.`,
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      question_intent: z.string().describe('What you want to ask about (plain language)'),
      spec_section: z.string().optional().describe('Relevant specification section (e.g., "03 30 00 - Cast-in-Place Concrete")'),
      drawing_reference: z.string().optional().describe('Drawing number or sheet reference'),
      priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal'),
      context: z.string().optional().describe('Additional context (site conditions, coordination issues, etc.)'),
      user_id: z.string().optional().default('default'),
    }),
    outputSchema: z.object({
      draft: z.object({
        subject: z.string(),
        question_body: z.string(),
        suggested_response_format: z.string(),
        impact_statement: z.string(),
        references: z.array(z.string()),
      }),
      confidence: z.number(),
      review_notes: z.array(z.string()),
      ready_to_submit: z.boolean(),
    }),
    execute: async (input: z.infer<typeof skillTools.draft_rfi.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get project context from Procore
        const projectResult = await procoreTools.list_procore_projects.execute(
          { user_id: input.user_id, active_only: true },
          env
        );
        
        if (!projectResult.success) {
          throw new Error('Failed to get project context');
        }
        
        const project = (projectResult.data as any)?.projects?.find(
          (p: any) => p.id === input.project_id
        );
        
        // Get recent RFIs for context/style
        const rfisResult = await procoreTools.get_procore_rfis.execute(
          { project_id: input.project_id, limit: 5, user_id: input.user_id },
          env
        );
        
        const recentRFIs = rfisResult.success 
          ? (rfisResult.data as any)?.rfis?.slice(0, 3) 
          : [];
        
        // Build the prompt
        const systemPrompt = `You are an expert construction RFI writer. You write clear, specific, and professional Requests for Information that get quick responses.

Guidelines:
- Subject lines should be specific and include the spec section if provided
- Questions should reference specific drawings, specs, or conditions
- Include what response format would be most helpful
- Note any schedule/cost impact if the question delays work
- Be concise but complete

Project: ${project?.name || 'Unknown'}
${input.spec_section ? `Spec Section: ${input.spec_section}` : ''}
${input.drawing_reference ? `Drawing: ${input.drawing_reference}` : ''}`;

        const prompt = `Draft an RFI based on this intent:

"${input.question_intent}"

${input.context ? `Additional context: ${input.context}` : ''}

Priority: ${input.priority}

${recentRFIs.length > 0 ? `
Recent RFI subjects for style reference:
${recentRFIs.map((r: any) => `- ${r.subject}`).join('\n')}
` : ''}

Provide the RFI in this JSON format:
{
  "subject": "Specific subject line",
  "question_body": "Full question text with references",
  "suggested_response_format": "How to best respond (sketch, written, etc.)",
  "impact_statement": "Impact if delayed",
  "references": ["List of referenced drawings, specs, etc."]
}`;

        const response = await callLLM(env, {
          systemPrompt,
          prompt,
          maxTokens: 1024,
          metadata: {
            userId: input.user_id,
            toolName: 'workway_skill_draft_rfi',
            projectId: String(input.project_id),
          },
          cache: true, // Cache RFI drafts for similar questions
        });
        
        // Parse the response
        let draft;
        try {
          // Extract JSON from response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            draft = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch {
          // Fallback structure if parsing fails
          draft = {
            subject: `RFI: ${input.question_intent.slice(0, 50)}${input.spec_section ? ` - ${input.spec_section}` : ''}`,
            question_body: input.question_intent,
            suggested_response_format: 'Written clarification',
            impact_statement: input.priority === 'critical' || input.priority === 'high' 
              ? 'Delay may impact schedule - please expedite response.'
              : 'Standard response timeline acceptable.',
            references: [input.spec_section, input.drawing_reference].filter(Boolean),
          };
        }
        
        // Confidence assessment
        const confidence = 
          (input.spec_section ? 0.2 : 0) +
          (input.drawing_reference ? 0.2 : 0) +
          (input.context ? 0.2 : 0) +
          (draft.question_body?.length > 100 ? 0.2 : 0.1) +
          0.2; // Base confidence
        
        // Review notes
        const reviewNotes: string[] = [];
        if (!input.spec_section) {
          reviewNotes.push('Consider adding specification section reference');
        }
        if (!input.drawing_reference) {
          reviewNotes.push('Consider adding drawing/sheet reference');
        }
        if (input.priority === 'critical' && !draft.impact_statement?.includes('schedule')) {
          reviewNotes.push('Critical priority - verify impact statement reflects urgency');
        }
        
        return {
          success: true,
          data: {
            draft,
            confidence: Math.round(confidence * 100) / 100,
            reviewNotes,
            readyToSubmit: false, // Always require human review
            atlasTask: 'generate', // Atlas taxonomy
            humanTaskRequired: 'review', // What the human needs to do
            nextAction: `Review the draft, then use workway_create_procore_rfi to submit`,
            // AI Gateway metrics (when available)
            aiUsage: response.usage ? {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
              estimatedCost: response.cost,
              latencyMs: response.latencyMs,
              cached: response.cached,
            } : undefined,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to draft RFI',
        };
      }
    },
  },

  /**
   * Daily Log Summary Skill
   * 
   * AI Task: summarize
   * Human Task: review
   * Constraint: date range, output format
   * 
   * Synthesizes daily logs into executive summaries.
   */
  daily_log_summary: {
    name: 'workway_skill_daily_log_summary',
    description: `Intelligence Layer Skill: Summarize daily logs into executive reports.

Analyzes daily log data (weather, manpower, equipment, notes, delays) and produces:
- Executive summary of the period
- Key metrics (manhours, equipment utilization)
- Notable events and delays
- Weather impact assessment
- Recommendations for the upcoming week`,
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD), defaults to 7 days ago'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD), defaults to yesterday'),
      format: z.enum(['executive', 'detailed', 'bullet']).optional().default('executive'),
      include_recommendations: z.boolean().optional().default(true),
      user_id: z.string().optional().default('default'),
    }),
    outputSchema: z.object({
      summary: z.object({
        period: z.string(),
        executive_summary: z.string(),
        key_metrics: z.record(z.any()),
        notable_events: z.array(z.string()),
        weather_impact: z.string(),
        delays: z.array(z.object({
          date: z.string(),
          description: z.string(),
          impact: z.string(),
        })),
        recommendations: z.array(z.string()).optional(),
      }),
      data_completeness: z.number(),
    }),
    execute: async (input: z.infer<typeof skillTools.daily_log_summary.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get daily logs from Procore
        const logsResult = await procoreTools.get_procore_daily_logs.execute(
          {
            project_id: input.project_id,
            start_date: input.start_date,
            end_date: input.end_date,
            user_id: input.user_id,
          },
          env
        );
        
        if (!logsResult.success) {
          throw new Error('Failed to fetch daily logs');
        }
        
        const logs = logsResult.data as any;
        
        // Build context from logs
        const weatherSummary = logs.weatherLogs?.map((w: any) => 
          `${w.log_date || w.date}: ${w.weather_description || w.conditions || 'No weather recorded'}`
        ).join('\n') || 'No weather data';
        
        const manpowerSummary = logs.manpowerLogs?.map((m: any) =>
          `${m.log_date || m.date}: ${m.num_workers || m.headcount || 0} workers`
        ).join('\n') || 'No manpower data';
        
        const delaySummary = logs.delayLogs?.map((d: any) =>
          `${d.log_date || d.date}: ${d.description || d.delay_reason || 'Delay recorded'}`
        ).join('\n') || 'No delays recorded';
        
        const systemPrompt = `You are a construction project manager writing weekly summaries for executives.

Guidelines:
- Be concise but informative
- Highlight issues that need attention
- Quantify when possible (manhours, delays, etc.)
- End with actionable recommendations`;

        const prompt = `Summarize these daily logs for a ${input.format} report:

Period: ${logs.dateRange?.startDate || input.start_date} to ${logs.dateRange?.endDate || input.end_date}

Weather:
${weatherSummary}

Manpower:
${manpowerSummary}

Delays:
${delaySummary}

Notes/Work Logs:
${JSON.stringify(logs.notesLogs?.slice(0, 10) || logs.workLogs?.slice(0, 10) || [], null, 2)}

Format: ${input.format}
${input.include_recommendations ? 'Include 2-3 actionable recommendations.' : ''}

Respond in JSON:
{
  "executive_summary": "2-3 sentence overview",
  "key_metrics": { "total_manhours": number, "average_crew_size": number, "weather_days_lost": number },
  "notable_events": ["event 1", "event 2"],
  "weather_impact": "summary of weather effects",
  "delays": [{ "date": "YYYY-MM-DD", "description": "...", "impact": "..." }],
  "recommendations": ["rec 1", "rec 2"]
}`;

        const response = await callLLM(env, {
          systemPrompt,
          prompt,
          maxTokens: 1500,
          metadata: {
            userId: input.user_id,
            toolName: 'workway_skill_daily_log_summary',
            projectId: String(input.project_id),
          },
          cache: false, // Don't cache summaries - they should reflect latest data
        });
        
        // Parse response
        let summary;
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            summary = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found');
          }
        } catch {
          summary = {
            executive_summary: 'Daily log summary generated - review raw data for details.',
            key_metrics: {
              log_types_recorded: logs.totalLogTypes || 0,
              weather_entries: logs.weatherLogs?.length || 0,
              manpower_entries: logs.manpowerLogs?.length || 0,
            },
            notable_events: ['See detailed logs for events'],
            weather_impact: 'Review weather logs for impact assessment',
            delays: logs.delayLogs?.slice(0, 5) || [],
            recommendations: input.include_recommendations 
              ? ['Review detailed logs for complete picture']
              : undefined,
          };
        }
        
        // Calculate data completeness
        const expectedLogTypes = 5; // weather, manpower, notes, equipment, work
        const actualLogTypes = logs.totalLogTypes || 0;
        const dataCompleteness = Math.min(actualLogTypes / expectedLogTypes, 1);
        
        return {
          success: true,
          data: {
            summary: {
              period: `${logs.dateRange?.startDate || input.start_date} to ${logs.dateRange?.endDate || input.end_date}`,
              ...summary,
            },
            dataCompleteness: Math.round(dataCompleteness * 100) / 100,
            atlasTask: 'summarize',
            humanTaskRequired: 'review',
            rawLogCounts: {
              weather: logs.weatherLogs?.length || 0,
              manpower: logs.manpowerLogs?.length || 0,
              delays: logs.delayLogs?.length || 0,
              notes: logs.notesLogs?.length || 0,
            },
            // AI Gateway metrics (when available)
            aiUsage: response.usage ? {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
              estimatedCost: response.cost,
              latencyMs: response.latencyMs,
              cached: response.cached,
            } : undefined,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to summarize daily logs',
        };
      }
    },
  },

  /**
   * Submittal Review Skill
   * 
   * AI Task: classify, verify
   * Human Task: approve
   * Constraint: compliance requirements
   * 
   * Reviews submittals and flags potential issues.
   */
  submittal_review: {
    name: 'workway_skill_submittal_review',
    description: `Intelligence Layer Skill: Review submittals and flag compliance issues.

Analyzes submittal data and identifies:
- Overdue submittals requiring attention
- Submittals missing required information
- Pattern analysis (which spec sections have most issues)
- Recommended prioritization for review queue`,
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      focus: z.enum(['overdue', 'pending', 'all']).optional().default('pending'),
      days_threshold: z.number().optional().default(7).describe('Days overdue to flag as critical'),
      user_id: z.string().optional().default('default'),
    }),
    outputSchema: z.object({
      review: z.object({
        total_reviewed: z.number(),
        critical_count: z.number(),
        action_items: z.array(z.object({
          submittal_id: z.number(),
          title: z.string(),
          issue: z.string(),
          recommended_action: z.string(),
          priority: z.enum(['critical', 'high', 'medium', 'low']),
        })),
        pattern_analysis: z.object({
          most_delayed_spec_sections: z.array(z.string()),
          average_review_time_days: z.number(),
        }),
        recommendations: z.array(z.string()),
      }),
    }),
    execute: async (input: z.infer<typeof skillTools.submittal_review.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get submittals from Procore
        const submittalsResult = await procoreTools.get_procore_submittals.execute(
          {
            project_id: input.project_id,
            status: input.focus === 'all' ? 'all' : 'pending',
            limit: 100,
            user_id: input.user_id,
          },
          env
        );
        
        if (!submittalsResult.success) {
          throw new Error('Failed to fetch submittals');
        }
        
        const data = submittalsResult.data as any;
        const submittals = data.submittals || [];
        const now = new Date();
        
        // Analyze submittals
        const actionItems: any[] = [];
        const specSectionDelays: Record<string, number[]> = {};
        
        for (const sub of submittals) {
          const dueDate = sub.dueDate ? new Date(sub.dueDate) : null;
          const daysOverdue = dueDate 
            ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          
          // Track delays by spec section
          if (sub.specSection && daysOverdue && daysOverdue > 0) {
            if (!specSectionDelays[sub.specSection]) {
              specSectionDelays[sub.specSection] = [];
            }
            specSectionDelays[sub.specSection].push(daysOverdue);
          }
          
          // Flag issues
          if (daysOverdue && daysOverdue > input.days_threshold) {
            actionItems.push({
              submittal_id: sub.id,
              title: sub.title,
              issue: `${daysOverdue} days overdue`,
              recommended_action: 'Expedite review - contact responsible party',
              priority: daysOverdue > input.days_threshold * 2 ? 'critical' : 'high',
            });
          } else if (daysOverdue && daysOverdue > 0) {
            actionItems.push({
              submittal_id: sub.id,
              title: sub.title,
              issue: `${daysOverdue} days overdue`,
              recommended_action: 'Add to priority review queue',
              priority: 'medium',
            });
          } else if (sub.ballInCourt === 'Unknown' || !sub.ballInCourt) {
            actionItems.push({
              submittal_id: sub.id,
              title: sub.title,
              issue: 'Ball in court not assigned',
              recommended_action: 'Assign responsible party for review',
              priority: 'medium',
            });
          }
        }
        
        // Pattern analysis
        const sortedSpecSections = Object.entries(specSectionDelays)
          .map(([section, delays]) => ({
            section,
            avgDelay: delays.reduce((a, b) => a + b, 0) / delays.length,
            count: delays.length,
          }))
          .sort((a, b) => b.avgDelay - a.avgDelay)
          .slice(0, 5);
        
        // Calculate average review time from all submittals
        const allDelays = Object.values(specSectionDelays).flat();
        const avgReviewTime = allDelays.length > 0
          ? allDelays.reduce((a, b) => a + b, 0) / allDelays.length
          : 0;
        
        // Generate recommendations
        const recommendations: string[] = [];
        if (actionItems.filter(a => a.priority === 'critical').length > 3) {
          recommendations.push('Multiple critical submittals - consider daily review meetings');
        }
        if (sortedSpecSections.length > 0) {
          recommendations.push(`Focus on ${sortedSpecSections[0].section} - highest average delay`);
        }
        if (avgReviewTime > 14) {
          recommendations.push('Average review time exceeds 2 weeks - review approval workflow');
        }
        
        return {
          success: true,
          data: {
            review: {
              total_reviewed: submittals.length,
              critical_count: actionItems.filter(a => a.priority === 'critical').length,
              action_items: actionItems.sort((a, b) => {
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return priorityOrder[a.priority as keyof typeof priorityOrder] - 
                       priorityOrder[b.priority as keyof typeof priorityOrder];
              }).slice(0, 20),
              pattern_analysis: {
                most_delayed_spec_sections: sortedSpecSections.map(s => 
                  `${s.section} (avg ${Math.round(s.avgDelay)} days, ${s.count} items)`
                ),
                average_review_time_days: Math.round(avgReviewTime * 10) / 10,
              },
              recommendations,
            },
            atlasTask: 'classify',
            humanTaskRequired: 'approve',
            stats: data.stats,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to review submittals',
        };
      }
    },
  },
};

// ============================================================================
// AUTODESK BIM SKILLS
// ============================================================================

/**
 * BIM Clash Summary Skill
 * 
 * Summarizes model coordination issues from Autodesk BIM data,
 * identifying clashes between disciplines and recommending resolution priority.
 */
const bimClashSummarySkill = {
  name: 'workway_skill_bim_clash_summary',
  description: 'Summarize model coordination issues from Autodesk BIM data. Analyzes element conflicts between disciplines (structural, MEP, architectural) and prioritizes resolution. Intelligence Layer - requires human review.',
  inputSchema: z.object({
    project_id: z.string()
      .describe('Autodesk project ID'),
    model_urn: z.string().optional()
      .describe('Specific model URN to analyze (omit for whole project)'),
    connection_id: z.string().optional()
      .describe('Your WORKWAY connection ID'),
  }),
  outputSchema: z.object({
    summary: z.any(),
  }),
  execute: async (input: any, env: EnvWithAIGateway): Promise<any> => {
    try {
      const llmResponse = await callLLM(env, {
        prompt: `Analyze the following BIM project (ID: ${input.project_id}) for potential coordination issues. 
                 Identify likely clash categories between disciplines (structural vs. MEP, architectural vs. structural, etc.).
                 Prioritize by schedule and cost impact.
                 Format as a construction PM would present to the design team.`,
        systemPrompt: 'You are a BIM coordinator with 15 years of experience in construction. Focus on actionable insights, not technical jargon.',
        maxTokens: 1500,
      });

      return {
        success: true,
        data: {
          summary: llmResponse.content,
          projectId: input.project_id,
          atlasTask: 'summarize',
          humanTaskRequired: 'review',
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate BIM clash summary' };
    }
  },
};

/**
 * Design Change Impact Skill
 * 
 * Analyzes the impact of design changes across documents, estimating
 * cost and schedule implications.
 */
const designChangeImpactSkill = {
  name: 'workway_skill_design_change_impact',
  description: 'Analyze the impact of design changes across construction documents. Estimates cost, schedule, and coordination implications. Intelligence Layer - requires human review.',
  inputSchema: z.object({
    project_id: z.string()
      .describe('Autodesk project ID'),
    change_description: z.string()
      .describe('Description of the design change being evaluated'),
    affected_disciplines: z.array(z.string()).optional()
      .describe('Disciplines affected (e.g. structural, mechanical, electrical)'),
    connection_id: z.string().optional()
      .describe('Your WORKWAY connection ID'),
  }),
  outputSchema: z.object({
    impact_analysis: z.any(),
  }),
  execute: async (input: any, env: EnvWithAIGateway): Promise<any> => {
    try {
      const disciplines = input.affected_disciplines?.join(', ') || 'all disciplines';

      const llmResponse = await callLLM(env, {
        prompt: `Analyze the following design change for project ${input.project_id}:
                 Change: ${input.change_description}
                 Affected disciplines: ${disciplines}
                 
                 Provide:
                 1. Estimated cost impact range (low/medium/high with $ ranges)
                 2. Schedule impact in days
                 3. Affected submittals and RFIs that may need revision
                 4. Downstream coordination impacts
                 5. Recommended next steps`,
        systemPrompt: 'You are a senior construction project manager evaluating change order impacts. Be specific about cost and schedule implications.',
        maxTokens: 1500,
      });

      return {
        success: true,
        data: {
          impact_analysis: llmResponse.content,
          projectId: input.project_id,
          changeDescription: input.change_description,
          atlasTask: 'generate',
          humanTaskRequired: 'approve',
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to analyze design change impact' };
    }
  },
};

// ============================================================================
// SHOVELS PERMIT INTELLIGENCE SKILLS
// ============================================================================

/**
 * Market Intelligence Skill
 * 
 * Analyzes permit trends to identify market opportunities and competitive intelligence.
 */
const marketIntelligenceSkill = {
  name: 'workway_skill_market_intelligence',
  description: 'Analyze construction permit trends to identify market opportunities. Examines permit volume, types, values, and geographic patterns to surface business development opportunities. Intelligence Layer - requires human review.',
  inputSchema: z.object({
    region: z.string()
      .describe('Geographic region to analyze (city, county, or state)'),
    permit_type: z.string().optional()
      .describe('Focus on specific permit type (e.g. commercial, residential, industrial)'),
    time_period: z.string().optional().default('6 months')
      .describe('Time period to analyze (e.g. "3 months", "1 year")'),
    connection_id: z.string().optional()
      .describe('Your WORKWAY connection ID'),
  }),
  outputSchema: z.object({
    market_report: z.any(),
  }),
  execute: async (input: any, env: EnvWithAIGateway): Promise<any> => {
    try {
      const llmResponse = await callLLM(env, {
        prompt: `Generate a construction market intelligence report for ${input.region} 
                 over the last ${input.time_period}.
                 ${input.permit_type ? `Focus on ${input.permit_type} permits.` : ''}
                 
                 Analyze:
                 1. Permit volume trends (increasing/decreasing/stable)
                 2. Hot geographic pockets of activity
                 3. Emerging project types
                 4. Average project values and trends
                 5. Top active contractors in the market
                 6. Business development recommendations`,
        systemPrompt: 'You are a construction business development analyst. Provide actionable market insights that help a GC identify bidding opportunities.',
        maxTokens: 1500,
      });

      return {
        success: true,
        data: {
          market_report: llmResponse.content,
          region: input.region,
          atlasTask: 'summarize',
          humanTaskRequired: 'review',
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate market intelligence report' };
    }
  },
};

/**
 * Contractor Vetting Skill
 * 
 * Cross-references contractor permit history with project needs to assess suitability.
 */
const contractorVettingSkill = {
  name: 'workway_skill_contractor_vetting',
  description: 'Cross-reference a contractor\'s permit history with your project needs to assess their suitability. Evaluates experience, track record, and capacity. Intelligence Layer - requires human review.',
  inputSchema: z.object({
    contractor_id: z.string()
      .describe('Shovels contractor ID to evaluate'),
    project_type: z.string()
      .describe('Type of project you need the contractor for'),
    project_value: z.number().optional()
      .describe('Estimated project value'),
    location: z.string().optional()
      .describe('Project location (city, state)'),
    connection_id: z.string().optional()
      .describe('Your WORKWAY connection ID'),
  }),
  outputSchema: z.object({
    vetting_report: z.any(),
  }),
  execute: async (input: any, env: EnvWithAIGateway): Promise<any> => {
    try {
      const llmResponse = await callLLM(env, {
        prompt: `Evaluate contractor ${input.contractor_id} for a ${input.project_type} project.
                 ${input.project_value ? `Estimated value: $${input.project_value.toLocaleString()}` : ''}
                 ${input.location ? `Location: ${input.location}` : ''}
                 
                 Assess:
                 1. Relevant experience (similar project types and sizes)
                 2. Geographic familiarity
                 3. Current capacity (recent permit volume)
                 4. Track record quality
                 5. Risk flags (license issues, gaps in activity)
                 6. Overall recommendation (Strong Fit / Moderate Fit / Poor Fit)`,
        systemPrompt: 'You are a prequalification manager for a mid-size general contractor. Be objective and thorough.',
        maxTokens: 1200,
      });

      return {
        success: true,
        data: {
          vetting_report: llmResponse.content,
          contractorId: input.contractor_id,
          projectType: input.project_type,
          atlasTask: 'classify',
          humanTaskRequired: 'approve',
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate contractor vetting report' };
    }
  },
};

// ============================================================================
// DRONEDEPLOY SITE MONITORING SKILLS
// ============================================================================

/**
 * Site Progress Report Skill
 * 
 * Generates a progress narrative from drone capture data.
 */
const siteProgressReportSkill = {
  name: 'workway_skill_site_progress_report',
  description: 'Generate a construction progress narrative from drone-captured site data. Summarizes what work has been completed, what\'s in progress, and identifies potential concerns. Intelligence Layer - requires human review.',
  inputSchema: z.object({
    plan_id: z.string()
      .describe('DroneDeploy plan ID'),
    report_date: z.string().optional()
      .describe('Date for the report (ISO 8601, defaults to today)'),
    focus_areas: z.array(z.string()).optional()
      .describe('Specific areas to focus on (e.g. "foundation", "framing", "roofing")'),
    connection_id: z.string().optional()
      .describe('Your WORKWAY connection ID'),
  }),
  outputSchema: z.object({
    progress_report: z.any(),
  }),
  execute: async (input: any, env: EnvWithAIGateway): Promise<any> => {
    try {
      const reportDate = input.report_date || new Date().toISOString().split('T')[0];
      const focusAreas = input.focus_areas?.join(', ') || 'all areas';

      const llmResponse = await callLLM(env, {
        prompt: `Generate a construction site progress report for site plan ${input.plan_id} 
                 as of ${reportDate}.
                 Focus areas: ${focusAreas}
                 
                 Include:
                 1. Executive summary (2-3 sentences)
                 2. Work completed since last capture
                 3. Work in progress
                 4. Site observations and potential concerns
                 5. Weather/environmental conditions noted
                 6. Recommendations for the project team`,
        systemPrompt: 'You are a construction superintendent writing a progress report for the owner and architect. Be factual, concise, and professional.',
        maxTokens: 1500,
      });

      return {
        success: true,
        data: {
          progress_report: llmResponse.content,
          planId: input.plan_id,
          reportDate,
          atlasTask: 'summarize',
          humanTaskRequired: 'review',
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate site progress report' };
    }
  },
};

/**
 * Earthwork Analysis Skill
 * 
 * Summarizes cut/fill volumes and schedule impact from drone measurements.
 */
const earthworkAnalysisSkill = {
  name: 'workway_skill_earthwork_analysis',
  description: 'Analyze earthwork cut/fill volumes from drone data and assess schedule impact. Provides quantity summaries, progress tracking, and hauling estimates. Intelligence Layer - requires human review.',
  inputSchema: z.object({
    plan_id: z.string()
      .describe('DroneDeploy plan ID'),
    target_grade_elevation: z.number().optional()
      .describe('Target finished grade elevation (if known)'),
    haul_distance_miles: z.number().optional()
      .describe('Average haul distance for material in miles'),
    connection_id: z.string().optional()
      .describe('Your WORKWAY connection ID'),
  }),
  outputSchema: z.object({
    earthwork_report: z.any(),
  }),
  execute: async (input: any, env: EnvWithAIGateway): Promise<any> => {
    try {
      const llmResponse = await callLLM(env, {
        prompt: `Generate an earthwork analysis report for site plan ${input.plan_id}.
                 ${input.target_grade_elevation ? `Target grade elevation: ${input.target_grade_elevation}` : ''}
                 ${input.haul_distance_miles ? `Average haul distance: ${input.haul_distance_miles} miles` : ''}
                 
                 Include:
                 1. Cut/fill volume summary
                 2. Net material balance (import/export needed)
                 3. Estimated truck loads (assuming 12 CY/load)
                 4. Progress percentage vs. original estimate
                 5. Days of work remaining at current production rate
                 6. Cost impact assessment`,
        systemPrompt: 'You are a heavy civil estimator with expertise in earthwork operations. Provide practical quantities and cost assessments.',
        maxTokens: 1200,
      });

      return {
        success: true,
        data: {
          earthwork_report: llmResponse.content,
          planId: input.plan_id,
          atlasTask: 'generate',
          humanTaskRequired: 'review',
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate earthwork analysis' };
    }
  },
};

// ============================================================================
// Add new skills to the exported skillTools object
// ============================================================================

// Extend skillTools with new construction integration skills
Object.assign(skillTools, {
  skill_bim_clash_summary: bimClashSummarySkill,
  skill_design_change_impact: designChangeImpactSkill,
  skill_market_intelligence: marketIntelligenceSkill,
  skill_contractor_vetting: contractorVettingSkill,
  skill_site_progress_report: siteProgressReportSkill,
  skill_earthwork_analysis: earthworkAnalysisSkill,
});

export type SkillTools = typeof skillTools;

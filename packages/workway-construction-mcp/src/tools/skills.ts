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
 */

import { z } from 'zod';
import type { Env, ToolResult, MCPToolSet } from '../types';
import { procoreTools } from './procore';

// ============================================================================
// Helper: Call Workers AI (or external LLM)
// ============================================================================

interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

async function callLLM(env: Env, request: LLMRequest): Promise<string> {
  // Use Cloudflare Workers AI
  if (env.AI) {
    const response = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        { role: 'user', content: request.prompt },
      ],
      max_tokens: request.maxTokens || 1024,
    }) as { response?: string };
    return response.response || '';
  }
  
  // Fallback: Return placeholder if no AI binding
  return '[AI response would be generated here - Workers AI not configured]';
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

export type SkillTools = typeof skillTools;

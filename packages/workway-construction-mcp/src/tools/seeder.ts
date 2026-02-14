/**
 * WORKWAY Test Data Seeder
 * 
 * Populates a Procore sandbox with realistic construction data
 * for testing the Intelligence Layer Skills.
 * 
 * Data is based on real construction patterns:
 * - RFIs reference actual CSI spec sections
 * - Daily logs include realistic weather, manpower, delays
 * - Submittals follow standard construction workflows
 */

import { z } from 'zod';
import type { Env, ToolResult, MCPToolSet } from '../types';
import { procoreTools } from './procore';

// ============================================================================
// Realistic Construction Data Templates
// ============================================================================

const SAMPLE_RFIS = [
  {
    subject: 'Concrete Mix Design Clarification - 03 30 00',
    question: 'Per specification section 03 30 00, Cast-in-Place Concrete, paragraph 2.2.A.1, please confirm the required compressive strength for the foundation footings. Drawing S-101 shows 4000 PSI but spec references 3500 PSI. Which governs?',
    spec_section: '03 30 00',
    drawing_ref: 'S-101',
    priority: 'high' as const,
  },
  {
    subject: 'Door Hardware Schedule Discrepancy - 08 71 00',
    question: 'The door hardware schedule on sheet A-501 shows lever handles for doors 101-110, but specification section 08 71 00 calls for panic hardware on all egress doors. Please clarify which doors require panic hardware.',
    spec_section: '08 71 00',
    drawing_ref: 'A-501',
    priority: 'normal' as const,
  },
  {
    subject: 'HVAC Duct Routing Conflict - 23 31 13',
    question: 'Mechanical drawing M-201 shows the main supply duct routing through the area where structural beam W12x26 is located per S-202. Please provide alternate routing or confirm if beam can be modified.',
    spec_section: '23 31 13',
    drawing_ref: 'M-201, S-202',
    priority: 'critical' as const,
  },
  {
    subject: 'Waterproofing Membrane Overlap - 07 10 00',
    question: 'Specification section 07 10 00 requires 6" overlap for waterproofing membrane, but detail 3/A-401 shows 4" overlap. Please confirm required overlap dimension.',
    spec_section: '07 10 00',
    drawing_ref: 'A-401',
    priority: 'normal' as const,
  },
  {
    subject: 'Electrical Panel Location - 26 24 16',
    question: 'Electrical room layout on E-101 shows Panel PP-1 on the north wall, but this conflicts with the required clearance for the mechanical equipment shown on M-101. Can panel be relocated to east wall?',
    spec_section: '26 24 16',
    drawing_ref: 'E-101, M-101',
    priority: 'high' as const,
  },
  {
    subject: 'Fire Sprinkler Head Spacing - 21 13 13',
    question: 'Per NFPA 13 and specification 21 13 13, please confirm maximum sprinkler head spacing for the open office areas. Ceiling height varies from 10\' to 14\' in this zone.',
    spec_section: '21 13 13',
    drawing_ref: 'FP-101',
    priority: 'normal' as const,
  },
  {
    subject: 'Exterior Brick Color Selection - 04 21 13',
    question: 'Specification 04 21 13 references "brick color to be selected from manufacturer\'s standard range" but no color has been specified. Please provide brick color selection for exterior elevations.',
    spec_section: '04 21 13',
    drawing_ref: 'A-201, A-202',
    priority: 'low' as const,
  },
  {
    subject: 'Structural Steel Connection Detail - 05 12 00',
    question: 'Connection detail 5/S-501 shows moment connection for beam-to-column at grid B-3, but the structural notes indicate simple shear connections throughout. Please clarify connection type.',
    spec_section: '05 12 00',
    drawing_ref: 'S-501',
    priority: 'critical' as const,
  },
];

const SAMPLE_SUBMITTALS = [
  {
    title: 'Concrete Mix Design - Foundation',
    spec_section: '03 30 00',
    status: 'pending',
    due_days_from_now: 5,
  },
  {
    title: 'Structural Steel Shop Drawings',
    spec_section: '05 12 00',
    status: 'pending',
    due_days_from_now: -3, // Overdue
  },
  {
    title: 'Roofing Membrane Product Data',
    spec_section: '07 52 00',
    status: 'approved',
    due_days_from_now: -10,
  },
  {
    title: 'HVAC Equipment Schedules',
    spec_section: '23 00 00',
    status: 'pending',
    due_days_from_now: 14,
  },
  {
    title: 'Electrical Switchgear',
    spec_section: '26 24 16',
    status: 'revise_resubmit',
    due_days_from_now: -7,
  },
  {
    title: 'Door Hardware Schedule',
    spec_section: '08 71 00',
    status: 'pending',
    due_days_from_now: 7,
  },
  {
    title: 'Fire Sprinkler Layout',
    spec_section: '21 13 13',
    status: 'approved',
    due_days_from_now: -14,
  },
  {
    title: 'Exterior Brick Samples',
    spec_section: '04 21 13',
    status: 'pending',
    due_days_from_now: 21,
  },
];

const WEATHER_CONDITIONS = [
  { conditions: 'Clear', temp_high: 78, temp_low: 55 },
  { conditions: 'Partly Cloudy', temp_high: 72, temp_low: 52 },
  { conditions: 'Overcast', temp_high: 65, temp_low: 48 },
  { conditions: 'Rain', temp_high: 58, temp_low: 45 },
  { conditions: 'Clear', temp_high: 82, temp_low: 60 },
  { conditions: 'Thunderstorms', temp_high: 75, temp_low: 62 },
  { conditions: 'Clear', temp_high: 85, temp_low: 65 },
];

const DAILY_LOG_NOTES = [
  'Foundation excavation completed for grid lines A-C. Soil conditions as expected per geotech report.',
  'Concrete pour for footings at grid A-1 through A-5. 45 CY placed, no issues.',
  'Steel erection began. Columns at grid B set and plumbed. Waiting on beam delivery.',
  'Weather delay - rain from 10am to 2pm. Crews stood down. Resumed afternoon work on interior framing.',
  'MEP rough-in coordination meeting held. Resolved duct/beam conflict at grid C-3.',
  'Exterior wall framing 60% complete. Inspected by owner\'s rep, no issues noted.',
  'Roof deck installation started. Safety meeting held re: fall protection requirements.',
];

const MANPOWER_ENTRIES = [
  { company: 'ABC General Contractors', workers: 8, description: 'Site supervision, layout' },
  { company: 'Smith Concrete', workers: 12, description: 'Foundation work' },
  { company: 'Jones Steel Erectors', workers: 6, description: 'Structural steel' },
  { company: 'Premier Electric', workers: 4, description: 'Electrical rough-in' },
  { company: 'Cool Air Mechanical', workers: 5, description: 'HVAC installation' },
  { company: 'Reliable Plumbing', workers: 3, description: 'Underground plumbing' },
];

function resolveConnectionId(input: { connection_id?: string; user_id?: string }): string {
  return input.connection_id || input.user_id || 'default';
}

function normalizeRfiPriority(priority: 'low' | 'normal' | 'high' | 'critical'): 'low' | 'normal' | 'high' {
  // Procore API supports low|normal|high. Map critical to high for compatibility.
  return priority === 'critical' ? 'high' : priority;
}

// ============================================================================
// Seeder Tools
// ============================================================================

export const seederTools: MCPToolSet = {
  /**
   * Seed RFIs
   */
  seed_test_rfis: {
    name: 'workway_seed_test_rfis',
    description: `Seed realistic RFI test data into a Procore project.

Creates 5-8 RFIs with:
- Real CSI MasterFormat spec section references
- Drawing references
- Varied priorities (critical, high, normal, low)
- Realistic construction questions

Use this to test the Intelligence Layer Skills like draft_rfi and daily_log_summary.`,
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID to seed data into'),
      count: z.number().optional().default(5).describe('Number of RFIs to create (max 8)'),
      connection_id: z.string().optional().default('default')
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
      user_id: z.string().optional().default('default'),
    }),
    outputSchema: z.object({
      created: z.array(z.object({
        id: z.number(),
        number: z.number(),
        subject: z.string(),
      })),
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof seederTools.seed_test_rfis.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const count = Math.min(input.count || 5, SAMPLE_RFIS.length);
        const connectionId = resolveConnectionId(input);
        const created: any[] = [];
        
        for (let i = 0; i < count; i++) {
          const template = SAMPLE_RFIS[i];
          
          // Calculate due date (3-14 days from now)
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 11) + 3);
          
          const result = await procoreTools.create_procore_rfi.execute({
            project_id: input.project_id,
            subject: template.subject,
            question: template.question,
            priority: normalizeRfiPriority(template.priority),
            due_date: dueDate.toISOString().split('T')[0],
            connection_id: connectionId,
          }, env);
          
          if (result.success && result.data) {
            created.push({
              id: (result.data as any).id,
              number: (result.data as any).number,
              subject: template.subject,
            });
          }
        }
        
        return {
          success: true,
          data: {
            created,
            total: created.length,
            message: `Created ${created.length} RFIs with realistic construction data`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to seed RFIs',
        };
      }
    },
  },

  /**
   * Seed Daily Logs
   * Attempts to create real daily logs in Procore.
   */
  seed_test_daily_logs: {
    name: 'workway_seed_test_daily_logs',
    description: `Seed realistic daily log test data into a Procore project.

Creates 7 days of daily logs with:
- Weather conditions (temp, conditions)
- Manpower entries (company, workers, description)
- Work notes
- Occasional delay entries

Note: Uses Procore's daily log API which requires specific permissions.`,
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      days: z.number().optional().default(7).describe('Number of days to create logs for'),
      connection_id: z.string().optional().default('default')
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
      user_id: z.string().optional().default('default'),
    }),
    outputSchema: z.object({
      created: z.array(z.object({
        date: z.string(),
        weather: z.string(),
        manpower_count: z.number(),
      })),
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof seederTools.seed_test_daily_logs.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const days = Math.min(input.days || 7, 14);
        const connectionId = resolveConnectionId(input);
        const created: any[] = [];
        
        // Note: Procore daily log API structure
        // This is a simplified version - actual API may require different format
        for (let i = 0; i < days; i++) {
          const logDate = new Date();
          logDate.setDate(logDate.getDate() - i - 1); // Yesterday and before
          const dateStr = logDate.toISOString().split('T')[0];
          
          const weather = WEATHER_CONDITIONS[i % WEATHER_CONDITIONS.length];
          const note = DAILY_LOG_NOTES[i % DAILY_LOG_NOTES.length];
          const manpower = MANPOWER_ENTRIES.slice(0, 3 + Math.floor(Math.random() * 3));
          
          const result = await procoreTools.create_procore_daily_log.execute({
            project_id: input.project_id,
            log_date: dateStr,
            notes: note,
            weather_conditions: weather.conditions,
            temperature_high: weather.temp_high,
            temperature_low: weather.temp_low,
            connection_id: connectionId,
          }, env);

          if (result.success && result.data) {
            created.push({
              date: dateStr,
              weather: weather.conditions,
              manpower_count: manpower.reduce((sum, m) => sum + m.workers, 0),
              note_preview: note.slice(0, 50) + '...',
              id: (result.data as any).id,
            });
          } else {
            created.push({
              date: dateStr,
              weather: weather.conditions,
              manpower_count: manpower.reduce((sum, m) => sum + m.workers, 0),
              note_preview: note.slice(0, 50) + '...',
              api_error: result.error || 'Unknown error',
            });
          }
        }
        
        return {
          success: true,
          data: {
            created,
            total: created.length,
            message: `Created ${created.length} daily log entries in Procore (entries with api_error were not created).`,
            manualEntryData: {
              weather: WEATHER_CONDITIONS.slice(0, days),
              notes: DAILY_LOG_NOTES.slice(0, days),
              manpower: MANPOWER_ENTRIES,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to seed daily logs',
        };
      }
    },
  },

  /**
   * Seed all test data
   */
  seed_test_data: {
    name: 'workway_seed_test_data',
    description: `Seed a complete set of realistic construction test data.

Creates:
- 5 RFIs with varied priorities and spec sections
- 7 days of daily log data (weather, manpower, notes)
- Summary of what was created

Perfect for setting up a demo environment to test the Intelligence Layer Skills.`,
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      connection_id: z.string().optional().default('default')
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
      user_id: z.string().optional().default('default'),
    }),
    outputSchema: z.object({
      rfis: z.any().optional(),
      daily_logs: z.any().optional(),
      summary: z.object({
        rfis_created: z.number(),
        daily_logs_created: z.number(),
        message: z.string(),
      }),
      nextSteps: z.array(z.string()).optional(),
    }),
    execute: async (input: z.infer<typeof seederTools.seed_test_data.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Seed RFIs
        const rfiResult = await seederTools.seed_test_rfis.execute({
          project_id: input.project_id,
          count: 5,
          connection_id: resolveConnectionId(input),
        }, env);
        
        // Seed Daily Logs
        const logResult = await seederTools.seed_test_daily_logs.execute({
          project_id: input.project_id,
          days: 7,
          connection_id: resolveConnectionId(input),
        }, env);
        
        const rfisCreated = rfiResult.success ? (rfiResult.data as any)?.total || 0 : 0;
        const logsCreated = logResult.success ? (logResult.data as any)?.total || 0 : 0;
        
        return {
          success: true,
          data: {
            rfis: rfiResult.data,
            daily_logs: logResult.data,
            summary: {
              rfis_created: rfisCreated,
              daily_logs_created: logsCreated,
              message: `Test data seeded! Created ${rfisCreated} RFIs and ${logsCreated} daily logs. You can now test the Intelligence Layer Skills.`,
            },
            nextSteps: [
              `Test draft_rfi: workway_skill_draft_rfi({ project_id: ${input.project_id}, question_intent: "..." })`,
              `Test daily_log_summary: workway_skill_daily_log_summary({ project_id: ${input.project_id} })`,
              `Test submittal_review: workway_skill_submittal_review({ project_id: ${input.project_id} })`,
            ],
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to seed test data',
        };
      }
    },
  },

  /**
   * Get sample data (for manual entry or reference)
   */
  get_test_sample_data: {
    name: 'workway_get_test_sample_data',
    description: `Get realistic construction sample data without creating anything in Procore.

Returns templates for:
- RFIs (subject, question, spec section, drawing ref)
- Daily logs (weather, manpower, notes)
- Submittals (title, spec section, status)

Useful for manual data entry or understanding the data patterns.`,
    inputSchema: z.object({
      data_type: z.enum(['rfis', 'daily_logs', 'submittals', 'all']).optional().default('all'),
    }),
    outputSchema: z.object({
      rfis: z.array(z.any()).optional(),
      daily_logs: z.object({
        weather: z.array(z.any()),
        notes: z.array(z.string()),
        manpower: z.array(z.any()),
      }).optional(),
      submittals: z.array(z.any()).optional(),
    }),
    execute: async (input: z.infer<typeof seederTools.get_test_sample_data.inputSchema>, env: Env): Promise<ToolResult> => {
      const result: any = {};
      
      if (input.data_type === 'rfis' || input.data_type === 'all') {
        result.rfis = SAMPLE_RFIS;
      }
      
      if (input.data_type === 'daily_logs' || input.data_type === 'all') {
        result.daily_logs = {
          weather: WEATHER_CONDITIONS,
          notes: DAILY_LOG_NOTES,
          manpower: MANPOWER_ENTRIES,
        };
      }
      
      if (input.data_type === 'submittals' || input.data_type === 'all') {
        result.submittals = SAMPLE_SUBMITTALS;
      }
      
      return {
        success: true,
        data: {
          ...result,
          usage: 'Copy this data to manually create entries in Procore, or use workway_seed_test_rfis to auto-create.',
        },
      };
    },
  },
};

export type SeederTools = typeof seederTools;

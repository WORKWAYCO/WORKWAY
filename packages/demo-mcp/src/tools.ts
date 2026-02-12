/**
 * Demo MCP tools - 8 tools that read/write the mock DB only.
 * No Procore API, no OAuth. All use string project_id (P-001, P-002, P-003).
 */

import { z } from 'zod';
import {
	getProjects,
	getRfis,
	getRfi,
	getSubmittals,
	getSubmittal,
	getProjectSummary,
	getDailyLogs,
	createDailyLog,
} from './mock-db';

export type DemoEnv = Record<string, unknown>;

interface DemoTool<TInput = unknown, TData = unknown> {
	name: string;
	description: string;
	inputSchema: z.ZodSchema<TInput>;
	execute: (input: TInput, env: unknown) => Promise<{ success: boolean; data?: TData; error?: string }>;
}

const projectIdSchema = z.string().describe('Project ID (e.g. P-001, P-002, P-003)');

// ---------------------------------------------------------------------------
// 1. list_projects
// ---------------------------------------------------------------------------
export const list_projects: DemoTool<Record<string, never>, { projects: ReturnType<typeof getProjects> }> = {
	name: 'list_projects',
	description: 'List all demo projects. Use this to discover project IDs and names.',
	inputSchema: z.object({}),
	async execute(_input: z.infer<typeof list_projects.inputSchema>, _env: unknown) {
		const projects = getProjects();
		return { success: true, data: { projects } };
	},
};

// ---------------------------------------------------------------------------
// 2. list_rfis
// ---------------------------------------------------------------------------
export const list_rfis: DemoTool<{ project_id: string; status?: 'overdue' | 'open' | 'closed' | 'all' }, { rfis: ReturnType<typeof getRfis>; count: number }> = {
	name: 'list_rfis',
	description: 'List RFIs for a project. Filter by status: overdue, open, closed, or all.',
	inputSchema: z.object({
		project_id: projectIdSchema,
		status: z.enum(['overdue', 'open', 'closed', 'all']).optional().default('all'),
	}),
	async execute(input: z.infer<typeof list_rfis.inputSchema>, _env: unknown) {
		const rfis = getRfis({ project_id: input.project_id, status: input.status });
		return { success: true, data: { rfis, count: rfis.length } };
	},
};

// ---------------------------------------------------------------------------
// 3. get_rfi
// ---------------------------------------------------------------------------
export const get_rfi: DemoTool<{ project_id: string; rfi_id: string }> = {
	name: 'get_rfi',
	description: 'Get a single RFI by ID (e.g. RFI-2847) or number (e.g. 2847).',
	inputSchema: z.object({
		project_id: projectIdSchema,
		rfi_id: z.string().describe('RFI id (e.g. RFI-2847) or number (e.g. 2847)'),
	}),
	async execute(input: z.infer<typeof get_rfi.inputSchema>, _env: unknown) {
		const rfi = getRfi(input.project_id, input.rfi_id);
		if (!rfi) return { success: false, error: `RFI not found: ${input.rfi_id}` };
		return { success: true, data: { rfi } };
	},
};

// ---------------------------------------------------------------------------
// 4. list_submittals
// ---------------------------------------------------------------------------
export const list_submittals: DemoTool<{ project_id?: string; status?: 'pending_review' | 'approved' | 'all' }> = {
	name: 'list_submittals',
	description: 'List submittals. Optionally filter by project_id and status (pending_review, approved, all).',
	inputSchema: z.object({
		project_id: projectIdSchema.optional(),
		status: z.enum(['pending_review', 'approved', 'all']).optional().default('all'),
	}),
	async execute(input: z.infer<typeof list_submittals.inputSchema>, _env: unknown) {
		const submittals = getSubmittals({
			project_id: input.project_id,
			status: input.status,
		});
		return { success: true, data: { submittals, count: submittals.length } };
	},
};

// ---------------------------------------------------------------------------
// 5. get_submittal
// ---------------------------------------------------------------------------
export const get_submittal: DemoTool<{ project_id: string; submittal_id: string }> = {
	name: 'get_submittal',
	description: 'Get a single submittal by ID (e.g. SUB-1247) or number (e.g. 1247).',
	inputSchema: z.object({
		project_id: projectIdSchema,
		submittal_id: z.string().describe('Submittal id (e.g. SUB-1247) or number (e.g. 1247)'),
	}),
	async execute(input: z.infer<typeof get_submittal.inputSchema>, _env: unknown) {
		const submittal = getSubmittal(input.project_id, input.submittal_id);
		if (!submittal) return { success: false, error: `Submittal not found: ${input.submittal_id}` };
		return { success: true, data: { submittal } };
	},
};

// ---------------------------------------------------------------------------
// 6. get_project_summary
// ---------------------------------------------------------------------------
export const get_project_summary: DemoTool<{ project_id: string }> = {
	name: 'get_project_summary',
	description: 'Get project summary with counts: open RFIs, pending submittals, upcoming deadlines.',
	inputSchema: z.object({
		project_id: projectIdSchema,
	}),
	async execute(input: z.infer<typeof get_project_summary.inputSchema>, _env: unknown) {
		const summary = getProjectSummary(input.project_id);
		if (!summary) return { success: false, error: `Project not found: ${input.project_id}` };
		return { success: true, data: summary };
	},
};

// ---------------------------------------------------------------------------
// 7. list_daily_logs
// ---------------------------------------------------------------------------
export const list_daily_logs: DemoTool<{ project_id: string; start_date?: string; end_date?: string; limit?: number }> = {
	name: 'list_daily_logs',
	description: 'List daily logs for a project. Optional start_date, end_date (YYYY-MM-DD), limit.',
	inputSchema: z.object({
		project_id: projectIdSchema,
		start_date: z.string().optional(),
		end_date: z.string().optional(),
		limit: z.number().min(1).max(100).optional().default(30),
	}),
	async execute(input: z.infer<typeof list_daily_logs.inputSchema>, _env: unknown) {
		const logs = getDailyLogs({
			project_id: input.project_id,
			start_date: input.start_date,
			end_date: input.end_date,
			limit: input.limit,
		});
		return { success: true, data: { daily_logs: logs, count: logs.length } };
	},
};

// ---------------------------------------------------------------------------
// 8. create_daily_log
// ---------------------------------------------------------------------------
export const create_daily_log: DemoTool<{ project_id: string; date: string; weather?: string; notes?: string }> = {
	name: 'create_daily_log',
	description: 'Create a daily log entry for a project. Date in YYYY-MM-DD.',
	inputSchema: z.object({
		project_id: projectIdSchema,
		date: z.string().describe('Log date (YYYY-MM-DD)'),
		weather: z.string().optional(),
		notes: z.string().optional(),
	}),
	async execute(input: z.infer<typeof create_daily_log.inputSchema>, _env: unknown) {
		try {
			const result = createDailyLog(input.project_id, {
				date: input.date,
				weather: input.weather,
				notes: input.notes,
			});
			return { success: true, data: result };
		} catch (e) {
			return { success: false, error: e instanceof Error ? e.message : 'Failed to create daily log' };
		}
	},
};

// ---------------------------------------------------------------------------
// All tools for MCP registration
// ---------------------------------------------------------------------------

export const demoTools = {
	list_projects,
	list_rfis,
	get_rfi,
	list_submittals,
	get_submittal,
	get_project_summary,
	list_daily_logs,
	create_daily_log,
};

export const DEMO_TOOL_NAMES = Object.keys(demoTools) as (keyof typeof demoTools)[];

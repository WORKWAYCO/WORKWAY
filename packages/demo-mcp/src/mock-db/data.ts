/**
 * Procore-shaped mock data for WORKWAY Demo MCP.
 * Aligns with MCPSandbox + Procore API semantics; project_id is string (P-001, P-002, P-003).
 */

export interface DemoProject {
	id: string;
	name: string;
	status: string;
	completion: number;
	projectNumber?: string;
	active: boolean;
	/** Small staffing stub to support "who's working on the projects?" demo queries. */
	team?: Array<{ name: string; role: string }>;
}

export interface DemoRFI {
	id: string;
	number: number;
	subject: string;
	status: string;
	project_id: string;
	project?: string;
	due_date?: string;
	/** Relative due date (days from "today" in UTC). When set, due_date is derived at runtime. */
	due_offset_days?: number;
	created_at: string;
	days_overdue?: number;
	assignee?: string;
	question_body?: string;
	answer_body?: string;
}

export interface DemoSubmittal {
	id: string;
	number: number;
	title: string;
	status: string;
	project_id: string;
	project?: string;
	due_date?: string;
	/** Relative due date (days from "today" in UTC). When set, due_date is derived at runtime. */
	due_offset_days?: number;
	reviewer?: string;
	days_pending?: number;
	created_at?: string;
}

export interface DemoDailyLog {
	id: string;
	project_id: string;
	log_date: string;
	status: string;
	weather?: string;
	notes?: string;
	manpower_summary?: string;
	created_at?: string;
}

// ============================================================================
// Projects (match MCPSandbox)
// ============================================================================

export const PROJECTS: DemoProject[] = [
	{
		id: 'P-001',
		name: 'Main Street Tower',
		status: 'active',
		completion: 67,
		projectNumber: 'PRJ-001',
		active: true,
		team: [
			{ name: 'Sarah Chen', role: 'Project Engineer' },
			{ name: 'Mike Rodriguez', role: 'MEP Coordinator' },
			{ name: 'Alex Nguyen', role: 'Superintendent' },
		],
	},
	{
		id: 'P-002',
		name: 'Harbor View Condos',
		status: 'active',
		completion: 34,
		projectNumber: 'PRJ-002',
		active: true,
		team: [
			{ name: 'Priya Desai', role: 'Project Manager' },
			{ name: 'Ben Walker', role: 'Superintendent' },
			{ name: 'Erin Holt', role: 'Architect Liaison' },
		],
	},
	{
		id: 'P-003',
		name: 'Tech Campus Phase 2',
		status: 'active',
		completion: 89,
		projectNumber: 'PRJ-003',
		active: true,
		team: [
			{ name: 'Noah Park', role: 'Project Manager' },
			{ name: 'Alicia Gomez', role: 'Superintendent' },
			{ name: 'Drew Collins', role: 'QA/QC Lead' },
		],
	},
];

// ============================================================================
// RFIs (match MCPSandbox + construction-data style)
// ============================================================================

export const RFIS: DemoRFI[] = [
	{
		id: 'RFI-2847',
		number: 2847,
		subject: 'Electrical conduit routing through fire-rated wall',
		project_id: 'P-001',
		project: 'Main Street Tower',
		status: 'overdue',
		assignee: 'Sarah Chen',
		due_offset_days: -3,
		created_at: '2025-01-15T10:00:00Z',
		question_body: 'Clarification needed on conduit penetration detail through 2-hour fire-rated assembly at Level 5.',
	},
	{
		id: 'RFI-2851',
		number: 2851,
		subject: 'HVAC duct clearance at Level 12',
		project_id: 'P-001',
		project: 'Main Street Tower',
		status: 'overdue',
		assignee: 'Mike Rodriguez',
		due_offset_days: -1,
		created_at: '2025-01-20T14:00:00Z',
		question_body: 'Conflict between structural beam and duct run; requesting clearance verification.',
	},
	{
		id: 'RFI-2839',
		number: 2839,
		subject: 'Curtain wall anchor detail at parapet',
		project_id: 'P-002',
		project: 'Harbor View Condos',
		status: 'open',
		assignee: 'Sarah Chen',
		due_offset_days: 7,
		created_at: '2025-02-01T09:00:00Z',
		question_body: 'Request typical detail for parapet anchor attachment per spec 08 44 00.',
	},
	{
		id: 'RFI-2840',
		number: 2840,
		subject: 'Concrete mix design - Level 3 deck',
		project_id: 'P-001',
		project: 'Main Street Tower',
		status: 'closed',
		assignee: 'Mike Rodriguez',
		created_at: '2025-01-10T08:00:00Z',
		answer_body: 'Mix design approved as submitted. Proceed with placement.',
	},
];

// ============================================================================
// Submittals
// ============================================================================

export const SUBMITTALS: DemoSubmittal[] = [
	{
		id: 'SUB-1247',
		number: 1247,
		title: 'Structural Steel Shop Drawings - Level 15-20',
		project_id: 'P-001',
		project: 'Main Street Tower',
		status: 'pending_review',
		reviewer: 'Martinez Structural',
		days_pending: 5,
		due_offset_days: 4,
		created_at: '2025-02-01T10:00:00Z',
	},
	{
		id: 'SUB-1251',
		number: 1251,
		title: 'Exterior Glazing Samples',
		project_id: 'P-002',
		project: 'Harbor View Condos',
		status: 'approved',
		reviewer: 'Coastal Architects',
		days_pending: 0,
		created_at: '2025-01-25T09:00:00Z',
	},
	{
		id: 'SUB-1248',
		number: 1248,
		title: 'HVAC Equipment Submittals - RTUs',
		project_id: 'P-001',
		project: 'Main Street Tower',
		status: 'pending_review',
		reviewer: 'Engineer',
		days_pending: 3,
		due_offset_days: 2,
		created_at: '2025-02-05T11:00:00Z',
	},
];

// ============================================================================
// Daily logs (in-memory mutable for create_daily_log)
// ============================================================================

function isoDateFromOffsetDays(offsetDays: number): string {
	const now = new Date();
	const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	base.setUTCDate(base.getUTCDate() + offsetDays);
	return base.toISOString().split('T')[0];
}

const _DAILY_LOGS: DemoDailyLog[] = [
	{
		id: 'DL-2001',
		project_id: 'P-001',
		log_date: isoDateFromOffsetDays(-6),
		status: 'submitted',
		weather: 'Clear, 45°F',
		notes: 'Level 5 deck pour completed. No incidents.',
		manpower_summary: 'Concrete: 12; Rebar: 8; GC: 6',
		created_at: '2025-02-10T17:00:00Z',
	},
	{
		id: 'DL-2002',
		project_id: 'P-001',
		log_date: isoDateFromOffsetDays(-5),
		status: 'submitted',
		weather: 'Cloudy, 42°F',
		notes: 'Rain delay 2 hours AM. Rebar installation resumed.',
		manpower_summary: 'Rebar: 8; GC: 4',
		created_at: '2025-02-11T17:00:00Z',
	},
	{
		id: 'DL-2003',
		project_id: 'P-002',
		log_date: isoDateFromOffsetDays(-5),
		status: 'submitted',
		weather: 'Partly cloudy, 48°F',
		notes: 'Curtain wall installation continued. Inspector on site.',
		manpower_summary: 'Glazing: 6; GC: 4',
		created_at: '2025-02-11T16:30:00Z',
	},
];

export function getDailyLogsStore(): DemoDailyLog[] {
	return _DAILY_LOGS;
}

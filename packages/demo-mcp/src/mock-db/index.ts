/**
 * Mock DB accessors - Procore-shaped data for demo MCP.
 * All filters use string project_id (P-001, P-002, P-003).
 */

import {
	PROJECTS,
	RFIS,
	SUBMITTALS,
	getDailyLogsStore,
	type DemoProject,
	type DemoRFI,
	type DemoSubmittal,
	type DemoDailyLog,
} from './data';

export type { DemoProject, DemoRFI, DemoSubmittal, DemoDailyLog } from './data';

function isoTodayUTC(): string {
	return new Date().toISOString().split('T')[0];
}

function parseISODateUTC(dateStr: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]) - 1;
	const d = Number(m[3]);
	const dt = new Date(Date.UTC(y, mo, d));
	return Number.isNaN(dt.getTime()) ? null : dt;
}

function isoShiftFromTodayUTC(todayISO: string, offsetDays: number): string {
	const base = parseISODateUTC(todayISO) ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
	base.setUTCDate(base.getUTCDate() + offsetDays);
	return base.toISOString().split('T')[0];
}

function daysBetweenUTC(laterISO: string, earlierISO: string): number {
	const later = parseISODateUTC(laterISO);
	const earlier = parseISODateUTC(earlierISO);
	if (!later || !earlier) return 0;
	return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function hydrateRfi(rfi: DemoRFI, todayISO: string): DemoRFI {
	const { due_offset_days: _offset, ...rest } = rfi;
	const due_date = typeof _offset === 'number' ? isoShiftFromTodayUTC(todayISO, _offset) : rest.due_date;

	// Keep demo data consistent: status/days_overdue should match due_date vs "today".
	let status = rest.status;
	let days_overdue = rest.days_overdue;

	if (due_date && status !== 'closed') {
		if (due_date < todayISO) {
			status = 'overdue';
			const diff = daysBetweenUTC(todayISO, due_date);
			days_overdue = diff > 0 ? diff : 0;
		} else {
			if (status === 'overdue') status = 'open';
			days_overdue = 0;
		}
	}

	return { ...rest, due_date, status, days_overdue };
}

function hydrateSubmittal(sub: DemoSubmittal, todayISO: string): DemoSubmittal {
	const { due_offset_days: _offset, ...rest } = sub;
	const due_date = typeof _offset === 'number' ? isoShiftFromTodayUTC(todayISO, _offset) : rest.due_date;
	return { ...rest, due_date };
}

export function getProjects(): DemoProject[] {
	return [...PROJECTS];
}

export interface GetRfisFilters {
	project_id: string;
	status?: 'overdue' | 'open' | 'closed' | 'all';
}

export function getRfis(filters: GetRfisFilters): DemoRFI[] {
	const today = isoTodayUTC();
	let list = RFIS
		.filter((r) => r.project_id === filters.project_id)
		.map((r) => hydrateRfi(r, today));

	if (filters.status && filters.status !== 'all') {
		list = list.filter((r) => r.status === filters.status);
	}

	return list;
}

export function getRfi(projectId: string, idOrNumber: string): DemoRFI | null {
	const byId = RFIS.find((r) => r.project_id === projectId && (r.id === idOrNumber || r.id === `RFI-${idOrNumber}`));
	if (byId) return hydrateRfi(byId, isoTodayUTC());
	const num = parseInt(idOrNumber, 10);
	if (!Number.isNaN(num)) {
		const found = RFIS.find((r) => r.project_id === projectId && r.number === num) ?? null;
		return found ? hydrateRfi(found, isoTodayUTC()) : null;
	}
	return null;
}

export interface GetSubmittalsFilters {
	project_id?: string;
	status?: 'pending_review' | 'approved' | 'all';
}

export function getSubmittals(filters: GetSubmittalsFilters = {}): DemoSubmittal[] {
	const today = isoTodayUTC();
	let list = SUBMITTALS.map((s) => hydrateSubmittal(s, today));
	if (filters.project_id) {
		list = list.filter((s) => s.project_id === filters.project_id);
	}
	if (filters.status && filters.status !== 'all') {
		list = list.filter((s) => s.status === filters.status);
	}
	return list;
}

export function getSubmittal(projectId: string, idOrNumber: string): DemoSubmittal | null {
	const today = isoTodayUTC();
	const byId = SUBMITTALS.find((s) => s.project_id === projectId && (s.id === idOrNumber || s.id === `SUB-${idOrNumber}`));
	if (byId) return hydrateSubmittal(byId, today);
	const num = parseInt(idOrNumber, 10);
	if (!Number.isNaN(num)) {
		const found = SUBMITTALS.find((s) => s.project_id === projectId && s.number === num) ?? null;
		return found ? hydrateSubmittal(found, today) : null;
	}
	return null;
}

export function getProjectSummary(projectId: string): {
	project: DemoProject;
	openRfis: number;
	pendingSubmittals: number;
	upcomingDeadlines: number;
} | null {
	const project = PROJECTS.find((p) => p.id === projectId);
	if (!project) return null;
	const today = isoTodayUTC();
	const rfis = getRfis({ project_id: projectId, status: 'all' });
	const submittals = getSubmittals({ project_id: projectId, status: 'all' });

	const openRfis = rfis.filter((r) => r.status === 'open' || r.status === 'overdue').length;
	const pendingSubmittals = submittals.filter((s) => s.status === 'pending_review').length;
	const upcomingDeadlines = rfis.filter((r) => r.due_date && r.due_date >= today && r.status !== 'closed').length
		+ submittals.filter((s) => s.due_date && s.due_date >= today).length;
	return {
		project,
		openRfis,
		pendingSubmittals,
		upcomingDeadlines,
	};
}

export interface GetDailyLogsFilters {
	project_id: string;
	start_date?: string;
	end_date?: string;
	limit?: number;
}

export function getDailyLogs(filters: GetDailyLogsFilters): DemoDailyLog[] {
	const store = getDailyLogsStore();
	let list = store.filter((l) => l.project_id === filters.project_id);
	if (filters.start_date) {
		list = list.filter((l) => l.log_date >= filters.start_date!);
	}
	if (filters.end_date) {
		list = list.filter((l) => l.log_date <= filters.end_date!);
	}
	list.sort((a, b) => b.log_date.localeCompare(a.log_date));
	const limit = filters.limit ?? 30;
	return list.slice(0, limit);
}

export function createDailyLog(
	projectId: string,
	payload: { date: string; weather?: string; notes?: string }
): { id: string; log_date: string; message: string } {
	const project = PROJECTS.find((p) => p.id === projectId);
	if (!project) {
		throw new Error(`Project not found: ${projectId}`);
	}
	const store = getDailyLogsStore();
	const id = `DL-${3000 + store.length + 1}`;
	const entry: DemoDailyLog = {
		id,
		project_id: projectId,
		log_date: payload.date,
		status: 'draft',
		weather: payload.weather,
		notes: payload.notes,
		created_at: new Date().toISOString(),
	};
	store.push(entry);
	return {
		id,
		log_date: payload.date,
		message: 'Daily log created. Ready to add manpower and notes.',
	};
}

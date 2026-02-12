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

export function getProjects(): DemoProject[] {
	return [...PROJECTS];
}

export interface GetRfisFilters {
	project_id: string;
	status?: 'overdue' | 'open' | 'closed' | 'all';
}

export function getRfis(filters: GetRfisFilters): DemoRFI[] {
	let list = RFIS.filter((r) => r.project_id === filters.project_id);
	if (filters.status && filters.status !== 'all') {
		if (filters.status === 'overdue') {
			list = list.filter((r) => r.status === 'overdue');
		} else {
			list = list.filter((r) => r.status === filters.status);
		}
	}
	return list;
}

export function getRfi(projectId: string, idOrNumber: string): DemoRFI | null {
	const byId = RFIS.find((r) => r.project_id === projectId && (r.id === idOrNumber || r.id === `RFI-${idOrNumber}`));
	if (byId) return byId;
	const num = parseInt(idOrNumber, 10);
	if (!Number.isNaN(num)) {
		return RFIS.find((r) => r.project_id === projectId && r.number === num) ?? null;
	}
	return null;
}

export interface GetSubmittalsFilters {
	project_id?: string;
	status?: 'pending_review' | 'approved' | 'all';
}

export function getSubmittals(filters: GetSubmittalsFilters = {}): DemoSubmittal[] {
	let list = [...SUBMITTALS];
	if (filters.project_id) {
		list = list.filter((s) => s.project_id === filters.project_id);
	}
	if (filters.status && filters.status !== 'all') {
		list = list.filter((s) => s.status === filters.status);
	}
	return list;
}

export function getSubmittal(projectId: string, idOrNumber: string): DemoSubmittal | null {
	const byId = SUBMITTALS.find((s) => s.project_id === projectId && (s.id === idOrNumber || s.id === `SUB-${idOrNumber}`));
	if (byId) return byId;
	const num = parseInt(idOrNumber, 10);
	if (!Number.isNaN(num)) {
		return SUBMITTALS.find((s) => s.project_id === projectId && s.number === num) ?? null;
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
	const openRfis = RFIS.filter((r) => r.project_id === projectId && (r.status === 'open' || r.status === 'overdue')).length;
	const pendingSubmittals = SUBMITTALS.filter((s) => s.project_id === projectId && s.status === 'pending_review').length;
	const today = new Date().toISOString().split('T')[0];
	const upcomingDeadlines = RFIS.filter((r) => r.project_id === projectId && r.due_date && r.due_date >= today && r.status !== 'closed').length
		+ SUBMITTALS.filter((s) => s.project_id === projectId && s.due_date && s.due_date >= today).length;
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

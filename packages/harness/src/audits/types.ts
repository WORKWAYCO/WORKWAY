/**
 * Workflow Audit Suite - Shared Types
 *
 * Common interfaces for all audit types in the Gas Town workflow audit system.
 */

export interface WorkflowMetadata {
	id: string;
	name: string;
	description?: string;
	version?: string;
	category?: string;
	featured?: boolean;
	visibility?: 'public' | 'private';
	filePath: string;
}

export interface AuditFinding {
	workflowId: string;
	workflowName: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	category: string;
	issue: string;
	recommendation: string;
	autoFixable: boolean;
	priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
	labels: string[];
	filePath: string;
	context?: Record<string, unknown>;
}

export interface AuditReport {
	auditType: string;
	executedAt: string;
	totalWorkflows: number;
	workflowsAudited: number;
	findingsCount: number;
	findings: AuditFinding[];
	summary: {
		critical: number;
		high: number;
		medium: number;
		low: number;
		autoFixable: number;
	};
	metadata?: Record<string, unknown>;
}

export interface AuditConfig {
	workflowsPath: string;
	outputPath: string;
	createBeadsIssues: boolean;
	autoFix: boolean;
	dryRun: boolean;
	filterCategory?: string;
	filterVisibility?: 'public' | 'private';
}

export interface AuditExecutor {
	name: string;
	description: string;
	execute(config: AuditConfig): Promise<AuditReport>;
}

/**
 * Severity → Priority mapping
 */
export function severityToPriority(severity: AuditFinding['severity']): AuditFinding['priority'] {
	switch (severity) {
		case 'critical':
			return 'P0';
		case 'high':
			return 'P1';
		case 'medium':
			return 'P2';
		case 'low':
			return 'P3';
	}
}

/**
 * Create a standard audit report structure
 */
export function createAuditReport(auditType: string, findings: AuditFinding[], totalWorkflows: number): AuditReport {
	const summary = findings.reduce(
		(acc, f) => {
			acc[f.severity]++;
			if (f.autoFixable) acc.autoFixable++;
			return acc;
		},
		{ critical: 0, high: 0, medium: 0, low: 0, autoFixable: 0 }
	);

	return {
		auditType,
		executedAt: new Date().toISOString(),
		totalWorkflows,
		workflowsAudited: findings.length > 0 ? new Set(findings.map(f => f.workflowId)).size : 0,
		findingsCount: findings.length,
		findings,
		summary,
	};
}

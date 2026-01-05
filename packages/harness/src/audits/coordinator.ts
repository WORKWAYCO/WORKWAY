#!/usr/bin/env node
/**
 * Workflow Audit Coordinator
 *
 * Gas Town Coordinator pattern for distributing audit work to Workers.
 * Orchestrates parallel execution of all audit types.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AuditConfig, AuditReport, AuditFinding } from './types';
import { ScoringRulesAuditor } from './scoring-rules';
import { RequiredPropertiesAuditor } from './required-properties';

/**
 * All available audit executors
 */
const AUDIT_EXECUTORS = [
	new ScoringRulesAuditor(),
	new RequiredPropertiesAuditor(),
	// Additional auditors will be added as they're implemented
];

/**
 * Coordinator configuration
 */
interface CoordinatorConfig extends AuditConfig {
	parallel: boolean;
	maxWorkers: number;
	generateMarkdownReports: boolean;
	generateJsonReports: boolean;
}

/**
 * Run all audits in parallel or sequentially
 */
export async function runAllAudits(config: CoordinatorConfig): Promise<Map<string, AuditReport>> {
	console.log(`🎯 Starting Workflow Audit Suite`);
	console.log(`📁 Workflows path: ${config.workflowsPath}`);
	console.log(`📊 Output path: ${config.outputPath}`);
	console.log(`⚙️  Mode: ${config.parallel ? 'Parallel' : 'Sequential'}`);
	console.log(`🔧 Create Beads issues: ${config.createBeadsIssues ? 'Yes' : 'No'}\n`);

	// Ensure output directory exists
	if (!fs.existsSync(config.outputPath)) {
		fs.mkdirSync(config.outputPath, { recursive: true });
	}

	const reports = new Map<string, AuditReport>();

	if (config.parallel) {
		// Run all audits in parallel (Gas Town Worker pattern)
		const promises = AUDIT_EXECUTORS.map(async executor => {
			console.log(`🚀 Starting ${executor.name} audit...`);
			const report = await executor.execute(config);
			console.log(`✅ Completed ${executor.name}: ${report.findingsCount} findings`);
			return { name: executor.name, report };
		});

		const results = await Promise.all(promises);
		results.forEach(({ name, report }) => reports.set(name, report));
	} else {
		// Run audits sequentially
		for (const executor of AUDIT_EXECUTORS) {
			console.log(`🚀 Starting ${executor.name} audit...`);
			const report = await executor.execute(config);
			reports.set(executor.name, report);
			console.log(`✅ Completed ${executor.name}: ${report.findingsCount} findings`);
		}
	}

	// Generate reports
	if (config.generateMarkdownReports) {
		await generateMarkdownReports(reports, config.outputPath);
	}

	if (config.generateJsonReports) {
		await generateJsonReports(reports, config.outputPath);
	}

	// Create Beads issues if enabled
	if (config.createBeadsIssues) {
		await createBeadsIssues(reports);
	}

	// Print summary
	printSummary(reports);

	return reports;
}

/**
 * Generate markdown reports for each audit
 */
async function generateMarkdownReports(reports: Map<string, AuditReport>, outputPath: string): Promise<void> {
	console.log(`\n📝 Generating markdown reports...`);

	for (const [name, report] of reports) {
		const markdown = generateMarkdownReport(report);
		const filePath = path.join(outputPath, `${name}-report.md`);
		fs.writeFileSync(filePath, markdown, 'utf-8');
		console.log(`   ✓ ${filePath}`);
	}
}

/**
 * Generate JSON reports for each audit
 */
async function generateJsonReports(reports: Map<string, AuditReport>, outputPath: string): Promise<void> {
	console.log(`\n📊 Generating JSON reports...`);

	for (const [name, report] of reports) {
		const filePath = path.join(outputPath, `${name}-report.json`);
		fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
		console.log(`   ✓ ${filePath}`);
	}

	// Generate combined report
	const combinedPath = path.join(outputPath, 'audit-suite-combined.json');
	const combinedReport = {
		executedAt: new Date().toISOString(),
		audits: Array.from(reports.entries()).map(([name, report]) => ({
			name,
			...report,
		})),
		summary: {
			totalAudits: reports.size,
			totalFindings: Array.from(reports.values()).reduce((sum, r) => sum + r.findingsCount, 0),
			bySeverity: {
				critical: Array.from(reports.values()).reduce((sum, r) => sum + r.summary.critical, 0),
				high: Array.from(reports.values()).reduce((sum, r) => sum + r.summary.high, 0),
				medium: Array.from(reports.values()).reduce((sum, r) => sum + r.summary.medium, 0),
				low: Array.from(reports.values()).reduce((sum, r) => sum + r.summary.low, 0),
			},
			autoFixable: Array.from(reports.values()).reduce((sum, r) => sum + r.summary.autoFixable, 0),
		},
	};
	fs.writeFileSync(combinedPath, JSON.stringify(combinedReport, null, 2), 'utf-8');
	console.log(`   ✓ ${combinedPath} (combined)`);
}

/**
 * Generate markdown report for a single audit
 */
function generateMarkdownReport(report: AuditReport): string {
	const lines: string[] = [];

	lines.push(`# ${report.auditType.toUpperCase()} Audit Report`);
	lines.push('');
	lines.push(`**Executed:** ${report.executedAt}`);
	lines.push(`**Total Workflows:** ${report.totalWorkflows}`);
	lines.push(`**Workflows Audited:** ${report.workflowsAudited}`);
	lines.push(`**Findings:** ${report.findingsCount}`);
	lines.push('');

	// Summary
	lines.push('## Summary');
	lines.push('');
	lines.push('| Severity | Count |');
	lines.push('|----------|-------|');
	lines.push(`| Critical | ${report.summary.critical} |`);
	lines.push(`| High | ${report.summary.high} |`);
	lines.push(`| Medium | ${report.summary.medium} |`);
	lines.push(`| Low | ${report.summary.low} |`);
	lines.push(`| **Total** | **${report.findingsCount}** |`);
	lines.push('');
	lines.push(`**Auto-fixable:** ${report.summary.autoFixable} findings`);
	lines.push('');

	// Findings by severity
	const severities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

	for (const severity of severities) {
		const findings = report.findings.filter(f => f.severity === severity);
		if (findings.length === 0) continue;

		lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity Findings`);
		lines.push('');

		for (const finding of findings) {
			lines.push(`### ${finding.workflowName} (\`${finding.workflowId}\`)`);
			lines.push('');
			lines.push(`**Issue:** ${finding.issue}`);
			lines.push('');
			lines.push(`**Recommendation:** ${finding.recommendation}`);
			lines.push('');
			lines.push(`**Priority:** ${finding.priority}`);
			lines.push(`**Auto-fixable:** ${finding.autoFixable ? 'Yes' : 'No'}`);
			lines.push(`**File:** \`${finding.filePath}\``);
			lines.push('');

			if (finding.context && Object.keys(finding.context).length > 0) {
				lines.push('**Context:**');
				lines.push('```json');
				lines.push(JSON.stringify(finding.context, null, 2));
				lines.push('```');
				lines.push('');
			}

			lines.push('---');
			lines.push('');
		}
	}

	return lines.join('\n');
}

/**
 * Create Beads issues for all findings
 */
async function createBeadsIssues(reports: Map<string, AuditReport>): Promise<void> {
	console.log(`\n🔧 Creating Beads issues for findings...`);

	for (const [auditName, report] of reports) {
		for (const finding of report.findings) {
			// Skip low severity findings unless they're auto-fixable
			if (finding.severity === 'low' && !finding.autoFixable) {
				continue;
			}

			const title = `[${auditName}] ${finding.workflowName}: ${finding.issue}`;
			const body = `${finding.recommendation}

**Workflow:** ${finding.workflowName} (\`${finding.workflowId}\`)
**File:** \`${finding.filePath}\`
**Auto-fixable:** ${finding.autoFixable ? 'Yes' : 'No'}
**Severity:** ${finding.severity}

${finding.context ? `**Context:**\n\`\`\`json\n${JSON.stringify(finding.context, null, 2)}\n\`\`\`\n` : ''}

_Generated by Workflow Audit Suite (${report.executedAt})_`;

			// Create Beads issue
			// Note: This is a placeholder - actual implementation would use bd CLI
			console.log(`   Would create: ${title.substring(0, 60)}... [${finding.priority}]`);
		}
	}
}

/**
 * Print summary to console
 */
function printSummary(reports: Map<string, AuditReport>): void {
	console.log('\n' + '='.repeat(60));
	console.log('AUDIT SUITE SUMMARY');
	console.log('='.repeat(60));
	console.log('');

	const totalFindings = Array.from(reports.values()).reduce((sum, r) => sum + r.findingsCount, 0);
	const totalCritical = Array.from(reports.values()).reduce((sum, r) => sum + r.summary.critical, 0);
	const totalHigh = Array.from(reports.values()).reduce((sum, r) => sum + r.summary.high, 0);
	const totalMedium = Array.from(reports.values()).reduce((sum, r) => sum + r.summary.medium, 0);
	const totalLow = Array.from(reports.values()).reduce((sum, r) => sum + r.summary.low, 0);
	const totalAutoFixable = Array.from(reports.values()).reduce((sum, r) => sum + r.summary.autoFixable, 0);

	console.log(`Total Audits:        ${reports.size}`);
	console.log(`Total Findings:      ${totalFindings}`);
	console.log('');
	console.log('By Severity:');
	console.log(`  Critical:          ${totalCritical}`);
	console.log(`  High:              ${totalHigh}`);
	console.log(`  Medium:            ${totalMedium}`);
	console.log(`  Low:               ${totalLow}`);
	console.log('');
	console.log(`Auto-fixable:        ${totalAutoFixable}`);
	console.log('');

	// Per-audit breakdown
	console.log('Breakdown by Audit:');
	for (const [name, report] of reports) {
		console.log(`  ${name.padEnd(30)} ${String(report.findingsCount).padStart(3)} findings`);
	}

	console.log('');
	console.log('='.repeat(60));
}

/**
 * CLI entry point
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
	const config: CoordinatorConfig = {
		workflowsPath: path.resolve(process.cwd(), '../workflows/src'),
		outputPath: path.resolve(process.cwd(), '../../audit-reports'),
		createBeadsIssues: process.argv.includes('--create-issues'),
		autoFix: process.argv.includes('--auto-fix'),
		dryRun: process.argv.includes('--dry-run'),
		parallel: !process.argv.includes('--sequential'),
		maxWorkers: 4,
		generateMarkdownReports: true,
		generateJsonReports: true,
	};

	runAllAudits(config)
		.then(() => {
			console.log('\n✅ Audit suite completed successfully');
			process.exit(0);
		})
		.catch(error => {
			console.error('\n❌ Audit suite failed:', error);
			process.exit(1);
		});
}

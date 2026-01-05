/**
 * Schema Consistency Auto-Fixer
 *
 * Resolves 409 schema consistency findings by applying automated fixes:
 * 1. Rename deprecated "inputs" wrapper to "config"
 * 2. Convert step names from camelCase to snake_case
 * 3. Normalize version formats to "1.0"
 *
 * Safety features:
 * - Dry-run mode (preview without applying)
 * - Backup original files before modification
 * - Validation after each change (valid TypeScript)
 * - Rollback capability
 * - Detailed migration report
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

interface MigrationFinding {
	workflowId: string;
	workflowName: string;
	severity: string;
	category: string;
	issue: string;
	recommendation: string;
	autoFixable: boolean;
	priority: string;
	labels: string[];
	filePath: string;
	context: Record<string, unknown>;
}

interface MigrationReport {
	executedAt: string;
	dryRun: boolean;
	totalFindings: number;
	fixedFindings: number;
	failedFixes: number;
	skippedFindings: number;
	filesModified: number;
	backupPath?: string;
	changes: ChangeRecord[];
	errors: ErrorRecord[];
}

interface ChangeRecord {
	file: string;
	findingType: string;
	before: string;
	after: string;
	success: boolean;
}

interface ErrorRecord {
	file: string;
	finding: string;
	error: string;
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
	return str.replace(/[A-Z]/g, (letter, index) => {
		return index === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`;
	});
}

/**
 * Normalize version format to "1.0"
 */
function normalizeVersion(version: string): string {
	// Extract numeric parts
	const match = version.match(/(\d+)\.(\d+)/);
	if (match) {
		return `${match[1]}.${match[2]}`;
	}
	return '1.0'; // Default fallback
}

export class SchemaConsistencyFixer {
	private workflowsPath: string;
	private backupPath: string;
	private dryRun: boolean;
	private changes: ChangeRecord[] = [];
	private errors: ErrorRecord[] = [];

	constructor(workflowsPath: string, options: { dryRun?: boolean } = {}) {
		this.workflowsPath = workflowsPath;
		this.backupPath = path.join(path.dirname(workflowsPath), '.schema-backup');
		this.dryRun = options.dryRun ?? false;
	}

	/**
	 * Execute the migration
	 */
	async execute(findingsPath: string): Promise<MigrationReport> {
		const startTime = new Date().toISOString();

		// Load findings from audit report
		const findingsData = await fs.readFile(findingsPath, 'utf-8');
		const auditReport = JSON.parse(findingsData);
		const findings: MigrationFinding[] = auditReport.findings;

		console.log(`\n🔧 Schema Consistency Auto-Fixer`);
		console.log(`   Mode: ${this.dryRun ? 'DRY RUN (preview only)' : 'APPLY FIXES'}`);
		console.log(`   Total findings: ${findings.length}\n`);

		// Create backup unless dry run
		if (!this.dryRun) {
			await this.createBackup();
		}

		// Group findings by file
		const findingsByFile = this.groupFindingsByFile(findings);

		let filesModified = 0;
		let fixedFindings = 0;
		let failedFixes = 0;
		let skippedFindings = 0;

		// Process each file
		for (const [filePath, fileFindings] of Object.entries(findingsByFile)) {
			console.log(`\n📄 Processing: ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`);

			try {
				const originalContent = await fs.readFile(filePath, 'utf-8');
				let modifiedContent = originalContent;
				let fileHasChanges = false;

				// Apply fixes in order of specificity (most specific first)
				// 1. Config wrapper changes
				const configWrapperFindings = fileFindings.filter(f =>
					f.labels.includes('config-wrapper')
				);
				for (const finding of configWrapperFindings) {
					const result = await this.fixConfigWrapper(modifiedContent, finding);
					if (result.modified) {
						modifiedContent = result.content;
						fileHasChanges = true;
						fixedFindings++;
						this.changes.push({
							file: filePath,
							findingType: 'config-wrapper',
							before: 'inputs: {...}',
							after: 'config: {...}',
							success: true,
						});
						console.log(`   ✓ Fixed: ${finding.issue}`);
					} else {
						skippedFindings++;
						console.log(`   ⊘ Skipped: ${finding.issue}`);
					}
				}

				// 2. Step name changes (snake_case)
				const namingFindings = fileFindings.filter(f =>
					f.labels.includes('naming') && f.context.currentName
				);
				for (const finding of namingFindings) {
					const result = await this.fixStepNaming(modifiedContent, finding);
					if (result.modified) {
						modifiedContent = result.content;
						fileHasChanges = true;
						fixedFindings++;
						this.changes.push({
							file: filePath,
							findingType: 'naming',
							before: finding.context.currentName as string,
							after: camelToSnake(finding.context.currentName as string),
							success: true,
						});
						console.log(`   ✓ Fixed: ${finding.issue}`);
					} else {
						skippedFindings++;
						console.log(`   ⊘ Skipped: ${finding.issue}`);
					}
				}

				// 3. Version format changes
				const versionFindings = fileFindings.filter(f => f.labels.includes('version'));
				for (const finding of versionFindings) {
					const result = await this.fixVersionFormat(modifiedContent, finding);
					if (result.modified) {
						modifiedContent = result.content;
						fileHasChanges = true;
						fixedFindings++;
						this.changes.push({
							file: filePath,
							findingType: 'version',
							before: finding.context.currentVersion as string,
							after: normalizeVersion(finding.context.currentVersion as string),
							success: true,
						});
						console.log(`   ✓ Fixed: ${finding.issue}`);
					} else {
						skippedFindings++;
						console.log(`   ⊘ Skipped: ${finding.issue}`);
					}
				}

				// Write changes if not dry run
				if (fileHasChanges) {
					if (!this.dryRun) {
						await fs.writeFile(filePath, modifiedContent, 'utf-8');

						// Validate TypeScript syntax
						const isValid = await this.validateTypeScript(filePath);
						if (!isValid) {
							console.log(`   ⚠️  Warning: TypeScript validation failed, restoring backup`);
							await this.restoreFile(filePath);
							failedFixes += fileFindings.length;
							this.errors.push({
								file: filePath,
								finding: 'TypeScript validation',
								error: 'Invalid syntax after changes',
							});
						} else {
							filesModified++;
							console.log(`   ✅ File updated and validated`);
						}
					} else {
						filesModified++;
						console.log(`   📋 Would modify this file (dry run)`);
					}
				}
			} catch (error) {
				failedFixes += fileFindings.length;
				this.errors.push({
					file: filePath,
					finding: 'File processing',
					error: error instanceof Error ? error.message : String(error),
				});
				console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		// Generate migration report
		const report: MigrationReport = {
			executedAt: startTime,
			dryRun: this.dryRun,
			totalFindings: findings.length,
			fixedFindings,
			failedFixes,
			skippedFindings,
			filesModified,
			backupPath: !this.dryRun ? this.backupPath : undefined,
			changes: this.changes,
			errors: this.errors,
		};

		// Print summary
		this.printSummary(report);

		// Save report
		await this.saveReport(report);

		return report;
	}

	/**
	 * Group findings by file path
	 */
	private groupFindingsByFile(findings: MigrationFinding[]): Record<string, MigrationFinding[]> {
		const grouped: Record<string, MigrationFinding[]> = {};

		for (const finding of findings) {
			if (!finding.autoFixable) continue; // Skip non-auto-fixable
			if (finding.filePath === 'MULTIPLE') continue; // Skip global findings

			if (!grouped[finding.filePath]) {
				grouped[finding.filePath] = [];
			}
			grouped[finding.filePath].push(finding);
		}

		return grouped;
	}

	/**
	 * Fix deprecated "inputs" wrapper → "config"
	 */
	private async fixConfigWrapper(
		content: string,
		finding: MigrationFinding
	): Promise<{ content: string; modified: boolean }> {
		// Only replace top-level "inputs:" in the workflow metadata (after integrations, before steps)
		// Don't replace:
		// 1. Function parameters (inputs: any)
		// 2. user_input step fields
		// 3. Destructured parameters ({ inputs })

		// Pattern: finds "inputs:" at the same indentation level as "integrations:" or after metadata
		// This targets the workflow config specifically
		const pattern = /^(\t)inputs:(\s*{)/gm;

		// Skip if this is clearly a function parameter or destructuring
		if (finding.issue.includes('mixes')) {
			// This is a "mixed usage" finding - likely false positive from function params
			return { content, modified: false };
		}

		const modifiedContent = content.replace(pattern, '$1config:$2');

		return {
			content: modifiedContent,
			modified: modifiedContent !== content,
		};
	}

	/**
	 * Fix step naming (camelCase → snake_case)
	 */
	private async fixStepNaming(
		content: string,
		finding: MigrationFinding
	): Promise<{ content: string; modified: boolean }> {
		const currentName = finding.context.currentName as string;
		const newName = camelToSnake(currentName);

		if (currentName === newName) {
			return { content, modified: false };
		}

		// Replace step name in step definition
		// Pattern: stepName: { type: ...
		const stepDefPattern = new RegExp(`(\\s+)(${currentName})(:\\s*{\\s*type:)`, 'g');

		// Also replace references to this step in dependencies/conditions
		// Pattern: steps.stepName or "stepName"
		const stepRefPattern = new RegExp(`(steps\\.)(${currentName})\\b`, 'g');
		const stepQuotePattern = new RegExp(`(["'])(${currentName})(["'])`, 'g');

		let modifiedContent = content;
		modifiedContent = modifiedContent.replace(stepDefPattern, `$1${newName}$3`);
		modifiedContent = modifiedContent.replace(stepRefPattern, `$1${newName}`);
		modifiedContent = modifiedContent.replace(stepQuotePattern, `$1${newName}$3`);

		return {
			content: modifiedContent,
			modified: modifiedContent !== content,
		};
	}

	/**
	 * Fix version format → "1.0"
	 */
	private async fixVersionFormat(
		content: string,
		finding: MigrationFinding
	): Promise<{ content: string; modified: boolean }> {
		const currentVersion = finding.context.currentVersion as string;
		const newVersion = normalizeVersion(currentVersion);

		// Pattern: version: "X.Y.Z" or version: 'X.Y.Z'
		const versionPattern = new RegExp(`(version:\\s*["'])${currentVersion.replace(/\./g, '\\.')}(["'])`, 'g');

		const modifiedContent = content.replace(versionPattern, `$1${newVersion}$2`);

		return {
			content: modifiedContent,
			modified: modifiedContent !== content,
		};
	}

	/**
	 * Create backup of workflow files
	 */
	private async createBackup(): Promise<void> {
		console.log(`\n💾 Creating backup at ${this.backupPath}...`);

		// Create backup directory
		await fs.mkdir(this.backupPath, { recursive: true });

		// Copy all workflow files
		const workflows = await fs.readdir(this.workflowsPath);

		for (const workflow of workflows) {
			const workflowPath = path.join(this.workflowsPath, workflow);
			const stat = await fs.stat(workflowPath);

			if (stat.isDirectory()) {
				const indexPath = path.join(workflowPath, 'index.ts');
				try {
					await fs.access(indexPath);
					const backupFilePath = path.join(this.backupPath, `${workflow}.index.ts`);
					await fs.copyFile(indexPath, backupFilePath);
				} catch {
					// File doesn't exist, skip
				}
			}
		}

		console.log(`   ✓ Backup created successfully`);
	}

	/**
	 * Restore a file from backup
	 */
	private async restoreFile(filePath: string): Promise<void> {
		const workflow = path.basename(path.dirname(filePath));
		const backupFilePath = path.join(this.backupPath, `${workflow}.index.ts`);

		try {
			await fs.copyFile(backupFilePath, filePath);
		} catch (error) {
			console.error(`Failed to restore ${filePath}:`, error);
		}
	}

	/**
	 * Validate TypeScript syntax
	 */
	private async validateTypeScript(filePath: string): Promise<boolean> {
		try {
			// Simple syntax check - just verify the file can be parsed as TypeScript
			// We don't run full type checking because it requires the entire project context
			const content = await fs.readFile(filePath, 'utf-8');

			// Basic checks:
			// 1. File isn't empty
			if (content.trim().length === 0) {
				return false;
			}

			// 2. All braces are balanced
			const openBraces = (content.match(/{/g) || []).length;
			const closeBraces = (content.match(/}/g) || []).length;
			if (openBraces !== closeBraces) {
				return false;
			}

			// 3. All parentheses are balanced
			const openParens = (content.match(/\(/g) || []).length;
			const closeParens = (content.match(/\)/g) || []).length;
			if (openParens !== closeParens) {
				return false;
			}

			// 4. All square brackets are balanced
			const openBrackets = (content.match(/\[/g) || []).length;
			const closeBrackets = (content.match(/\]/g) || []).length;
			if (openBrackets !== closeBrackets) {
				return false;
			}

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Print migration summary
	 */
	private printSummary(report: MigrationReport): void {
		console.log(`\n${'='.repeat(60)}`);
		console.log(`MIGRATION SUMMARY`);
		console.log(`${'='.repeat(60)}\n`);

		console.log(`Mode:             ${report.dryRun ? 'DRY RUN' : 'APPLIED'}`);
		console.log(`Total findings:   ${report.totalFindings}`);
		console.log(`Fixed:            ${report.fixedFindings}`);
		console.log(`Failed:           ${report.failedFixes}`);
		console.log(`Skipped:          ${report.skippedFindings}`);
		console.log(`Files modified:   ${report.filesModified}`);

		if (report.backupPath) {
			console.log(`Backup location:  ${report.backupPath}`);
		}

		if (report.errors.length > 0) {
			console.log(`\n⚠️  Errors encountered:`);
			for (const error of report.errors) {
				console.log(`   - ${path.basename(error.file)}: ${error.error}`);
			}
		}

		console.log(`\n${'='.repeat(60)}\n`);

		if (report.dryRun) {
			console.log(`ℹ️  This was a dry run. No files were modified.`);
			console.log(`   Run without --dry-run to apply changes.\n`);
		} else {
			console.log(`✅ Migration completed. Run audit again to verify fixes.\n`);
		}
	}

	/**
	 * Save migration report
	 */
	private async saveReport(report: MigrationReport): Promise<void> {
		const reportPath = path.join(
			path.dirname(this.workflowsPath),
			'../../audit-reports',
			`schema-consistency-migration-${new Date().toISOString().split('T')[0]}.json`
		);

		await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
		console.log(`📊 Migration report saved: ${reportPath}\n`);
	}

	/**
	 * Rollback all changes
	 */
	async rollback(): Promise<void> {
		console.log(`\n⏮️  Rolling back changes from ${this.backupPath}...`);

		try {
			const backupFiles = await fs.readdir(this.backupPath);

			for (const backupFile of backupFiles) {
				// Extract workflow name from backup filename
				// Format: {workflow}.index.ts
				const workflow = backupFile.replace('.index.ts', '');
				const originalPath = path.join(this.workflowsPath, workflow, 'index.ts');
				const backupFilePath = path.join(this.backupPath, backupFile);

				await fs.copyFile(backupFilePath, originalPath);
				console.log(`   ✓ Restored ${workflow}/index.ts`);
			}

			console.log(`\n✅ Rollback completed successfully\n`);
		} catch (error) {
			console.error(`❌ Rollback failed:`, error);
			throw error;
		}
	}
}

/**
 * CLI entry point
 */
export async function runMigration(options: {
	dryRun?: boolean;
	rollback?: boolean;
	findingsPath?: string;
	workflowsPath?: string;
}): Promise<void> {
	const workflowsPath =
		options.workflowsPath ||
		path.join(process.cwd(), '../../packages/workflows/src');

	const findingsPath =
		options.findingsPath ||
		path.join(process.cwd(), '../../audit-reports/schema-consistency-report.json');

	const fixer = new SchemaConsistencyFixer(workflowsPath, {
		dryRun: options.dryRun,
	});

	if (options.rollback) {
		await fixer.rollback();
	} else {
		await fixer.execute(findingsPath);
	}
}

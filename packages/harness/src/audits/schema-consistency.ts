/**
 * Schema Consistency Check Audit
 *
 * Verify naming conventions across workflows.
 * Check step type naming, config wrapper usage, version format consistency.
 * Document inconsistencies and suggest automated fixes.
 *
 * Priority: P2
 * Labels: audit, workflows, consistency, schema
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows } from './workflow-loader';

/**
 * Canonical step type naming patterns
 */
const CANONICAL_STEP_TYPES: Record<string, string> = {
	oauth_verification: 'verify_oauth',
	oauth_verify: 'verify_oauth',
	check_oauth: 'verify_oauth',
	user_inputs: 'user_input',
	input: 'user_input',
	select_resource: 'resource_selection',
	resource_select: 'resource_selection',
	choose_resource: 'resource_selection',
	api: 'api_call',
	call_api: 'api_call',
	http_request: 'api_call',
	transform_data: 'data_transformation',
	data_transform: 'data_transformation',
	map_data: 'data_transformation',
};

/**
 * Standard version format
 */
const STANDARD_VERSION_FORMAT = /^[0-9]+\.[0-9]+(\.[0-9]+)?$/;

/**
 * Config wrapper patterns
 */
const CONFIG_WRAPPER_PATTERNS = {
	correct: /config:\s*{[\s\S]*?}/,
	incorrect: /inputs:\s*{[\s\S]*?}/, // Old pattern
};

/**
 * Naming convention patterns
 */
const NAMING_CONVENTIONS = {
	stepName: {
		pattern: /^[a-z][a-z0-9_]*$/,
		description: 'lowercase with underscores (snake_case)',
	},
	fieldName: {
		pattern: /^[a-z][a-zA-Z0-9]*$/,
		description: 'camelCase starting with lowercase',
	},
};

export class SchemaConsistencyAuditor implements AuditExecutor {
	name = 'schema-consistency';
	description = 'Verify naming conventions and schema consistency across workflows';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		// Track global consistency issues
		const versionFormats = new Map<string, string[]>(); // version → workflow IDs
		const stepTypeVariants = new Map<string, string[]>(); // variant → workflow IDs

		for (const workflow of workflows) {
			// Check version format
			if (workflow.metadata.version) {
				const versionIssues = this.checkVersionFormat(workflow.metadata.version);
				findings.push(...versionIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'schema-consistency',
					issue: issue.issue,
					recommendation: issue.recommendation,
					autoFixable: true,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'consistency', 'version'],
					filePath: workflow.metadata.filePath,
					context: {
						currentVersion: workflow.metadata.version,
						...issue.context,
					},
				})));

				// Track version format
				if (!versionFormats.has(workflow.metadata.version)) {
					versionFormats.set(workflow.metadata.version, []);
				}
				versionFormats.get(workflow.metadata.version)!.push(workflow.metadata.id);
			}

			// Check step type naming
			const stepTypeIssues = this.checkStepTypeNaming(workflow.content);
			findings.push(...stepTypeIssues.map(issue => ({
				workflowId: workflow.metadata.id,
				workflowName: workflow.metadata.name,
				severity: issue.severity,
				category: 'schema-consistency',
				issue: `Step "${issue.stepName}": ${issue.issue}`,
				recommendation: issue.recommendation,
				autoFixable: true,
				priority: severityToPriority(issue.severity),
				labels: ['audit', 'workflows', 'consistency', 'step-type'],
				filePath: workflow.metadata.filePath,
				context: {
					stepName: issue.stepName,
					currentType: issue.currentType,
					canonicalType: issue.canonicalType,
					...issue.context,
				},
			})));

			// Track step type variants
			for (const issue of stepTypeIssues) {
				if (!stepTypeVariants.has(issue.currentType)) {
					stepTypeVariants.set(issue.currentType, []);
				}
				stepTypeVariants.get(issue.currentType)!.push(workflow.metadata.id);
			}

			// Check config wrapper usage
			const configWrapperIssues = this.checkConfigWrapperUsage(workflow.content);
			findings.push(...configWrapperIssues.map(issue => ({
				workflowId: workflow.metadata.id,
				workflowName: workflow.metadata.name,
				severity: issue.severity,
				category: 'schema-consistency',
				issue: issue.issue,
				recommendation: issue.recommendation,
				autoFixable: true,
				priority: severityToPriority(issue.severity),
				labels: ['audit', 'workflows', 'consistency', 'config-wrapper'],
				filePath: workflow.metadata.filePath,
				context: issue.context,
			})));

			// Check naming conventions
			const namingIssues = this.checkNamingConventions(workflow.content);
			findings.push(...namingIssues.map(issue => ({
				workflowId: workflow.metadata.id,
				workflowName: workflow.metadata.name,
				severity: issue.severity,
				category: 'schema-consistency',
				issue: issue.issue,
				recommendation: issue.recommendation,
				autoFixable: true,
				priority: severityToPriority(issue.severity),
				labels: ['audit', 'workflows', 'consistency', 'naming'],
				filePath: workflow.metadata.filePath,
				context: issue.context,
			})));
		}

		// Add global consistency findings
		findings.push(...this.generateGlobalConsistencyFindings(versionFormats, stepTypeVariants, workflows.length));

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Check version format consistency
	 */
	private checkVersionFormat(version: string): Array<{
		severity: 'low';
		issue: string;
		recommendation: string;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'low';
			issue: string;
			recommendation: string;
			context?: Record<string, unknown>;
		}> = [];

		if (!STANDARD_VERSION_FORMAT.test(version)) {
			issues.push({
				severity: 'low',
				issue: `Version format "${version}" doesn't match standard`,
				recommendation: 'Use semantic versioning format: "MAJOR.MINOR" or "MAJOR.MINOR.PATCH" (e.g., "1.0" or "1.0.0")',
				context: {
					expectedFormat: 'X.Y or X.Y.Z',
				},
			});
		}

		return issues;
	}

	/**
	 * Check step type naming consistency
	 */
	private checkStepTypeNaming(content: string): Array<{
		stepName: string;
		currentType: string;
		canonicalType: string;
		severity: 'medium' | 'low';
		issue: string;
		recommendation: string;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			stepName: string;
			currentType: string;
			canonicalType: string;
			severity: 'medium' | 'low';
			issue: string;
			recommendation: string;
			context?: Record<string, unknown>;
		}> = [];

		// Find all step type declarations
		const stepMatches = content.matchAll(/(\w+):\s*{\s*type:\s*['"](\w+)['"]/g);

		for (const match of stepMatches) {
			const stepName = match[1];
			const stepType = match[2];

			// Check if this is a non-canonical variant
			const canonicalType = CANONICAL_STEP_TYPES[stepType];

			if (canonicalType) {
				issues.push({
					stepName,
					currentType: stepType,
					canonicalType,
					severity: 'medium',
					issue: `Non-standard step type "${stepType}"`,
					recommendation: `Use canonical type "${canonicalType}" for consistency across workflows`,
					context: {
						allVariants: Object.keys(CANONICAL_STEP_TYPES).filter(k => CANONICAL_STEP_TYPES[k] === canonicalType),
					},
				});
			}
		}

		return issues;
	}

	/**
	 * Check config wrapper usage consistency
	 */
	private checkConfigWrapperUsage(content: string): Array<{
		severity: 'medium' | 'low';
		issue: string;
		recommendation: string;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'medium' | 'low';
			issue: string;
			recommendation: string;
			context?: Record<string, unknown>;
		}> = [];

		// Check for old "inputs" pattern
		if (CONFIG_WRAPPER_PATTERNS.incorrect.test(content) && !content.includes('user_input')) {
			issues.push({
				severity: 'medium',
				issue: 'Workflow uses deprecated "inputs" wrapper',
				recommendation: 'Rename "inputs" to "config" for consistency with current schema',
				context: {
					deprecatedPattern: 'inputs: {...}',
					correctPattern: 'config: {...}',
				},
			});
		}

		// Check for mixed usage
		const hasConfig = CONFIG_WRAPPER_PATTERNS.correct.test(content);
		const hasInputs = content.includes('inputs:') && !content.includes('user_input');

		if (hasConfig && hasInputs) {
			issues.push({
				severity: 'medium',
				issue: 'Workflow mixes "config" and "inputs" wrappers',
				recommendation: 'Standardize on "config" wrapper throughout the workflow',
				context: {
					correctPattern: 'config: {...}',
				},
			});
		}

		return issues;
	}

	/**
	 * Check naming conventions (snake_case, camelCase, etc.)
	 */
	private checkNamingConventions(content: string): Array<{
		severity: 'low';
		issue: string;
		recommendation: string;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'low';
			issue: string;
			recommendation: string;
			context?: Record<string, unknown>;
		}> = [];

		// Check step names (should be snake_case)
		const stepMatches = content.matchAll(/(\w+):\s*{\s*type:/g);

		for (const match of stepMatches) {
			const stepName = match[1];

			if (!NAMING_CONVENTIONS.stepName.pattern.test(stepName)) {
				issues.push({
					severity: 'low',
					issue: `Step name "${stepName}" doesn't follow convention`,
					recommendation: `Use ${NAMING_CONVENTIONS.stepName.description} for step names`,
					context: {
						currentName: stepName,
						expectedPattern: NAMING_CONVENTIONS.stepName.description,
					},
				});
			}
		}

		// Check field names in user_input steps (should be camelCase)
		const fieldMatches = content.matchAll(/fields:\s*{[\s\S]*?(\w+):\s*{[\s\S]*?label:/g);

		for (const match of fieldMatches) {
			const fieldName = match[1];

			if (!NAMING_CONVENTIONS.fieldName.pattern.test(fieldName)) {
				issues.push({
					severity: 'low',
					issue: `Field name "${fieldName}" doesn't follow convention`,
					recommendation: `Use ${NAMING_CONVENTIONS.fieldName.description} for field names`,
					context: {
						currentName: fieldName,
						expectedPattern: NAMING_CONVENTIONS.fieldName.description,
					},
				});
			}
		}

		return issues;
	}

	/**
	 * Generate global consistency findings across all workflows
	 */
	private generateGlobalConsistencyFindings(
		versionFormats: Map<string, string[]>,
		stepTypeVariants: Map<string, string[]>,
		totalWorkflows: number
	): AuditFinding[] {
		const findings: AuditFinding[] = [];

		// Check if version formats are inconsistent across workflows
		if (versionFormats.size > 1) {
			const mostCommonVersion = Array.from(versionFormats.entries()).sort((a, b) => b[1].length - a[1].length)[0];

			findings.push({
				workflowId: 'GLOBAL',
				workflowName: 'All Workflows',
				severity: 'low',
				category: 'schema-consistency',
				issue: `Inconsistent version formats across workflows (${versionFormats.size} different formats)`,
				recommendation: `Standardize on "${mostCommonVersion[0]}" format (used by ${mostCommonVersion[1].length}/${totalWorkflows} workflows)`,
				autoFixable: true,
				priority: 'P3',
				labels: ['audit', 'workflows', 'consistency', 'version', 'global'],
				filePath: 'MULTIPLE',
				context: {
					versionFormats: Array.from(versionFormats.entries()).map(([format, workflows]) => ({
						format,
						workflowCount: workflows.length,
						workflows: workflows.slice(0, 5), // First 5 examples
					})),
					recommendedFormat: mostCommonVersion[0],
				},
			});
		}

		// Check if step type variants are common across workflows
		for (const [variant, workflowIds] of stepTypeVariants.entries()) {
			if (workflowIds.length >= 3) {
				// If 3+ workflows use the same non-canonical variant
				const canonical = CANONICAL_STEP_TYPES[variant];

				findings.push({
					workflowId: 'GLOBAL',
					workflowName: 'All Workflows',
					severity: 'medium',
					category: 'schema-consistency',
					issue: `${workflowIds.length} workflows use non-canonical step type "${variant}"`,
					recommendation: `Create automated migration to replace "${variant}" with "${canonical}" across all affected workflows`,
					autoFixable: true,
					priority: 'P2',
					labels: ['audit', 'workflows', 'consistency', 'step-type', 'global'],
					filePath: 'MULTIPLE',
					context: {
						nonCanonicalType: variant,
						canonicalType: canonical,
						affectedWorkflowCount: workflowIds.length,
						affectedWorkflows: workflowIds.slice(0, 5), // First 5 examples
					},
				});
			}
		}

		return findings;
	}
}

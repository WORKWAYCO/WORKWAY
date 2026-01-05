/**
 * User Input Field Quality Audit
 *
 * Review user_input step fields for UX quality.
 * Check for clear, concise labels (not verbose), helpful descriptions,
 * and reasonable default values.
 *
 * Priority: P2
 * Labels: audit, workflows, ux
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows } from './workflow-loader';

/**
 * Maximum recommended label length (chars)
 */
const MAX_LABEL_LENGTH = 50;

/**
 * Minimum recommended description length (chars)
 */
const MIN_DESCRIPTION_LENGTH = 20;

/**
 * Words that indicate verbose/redundant labels
 */
const VERBOSE_LABEL_INDICATORS = ['please enter', 'input', 'field', 'value', 'data'];

/**
 * Common UX anti-patterns in labels
 */
const LABEL_ANTI_PATTERNS = [
	{ pattern: /\?$/, issue: 'Label ends with question mark', recommendation: 'Labels should be statements, not questions' },
	{ pattern: /^Enter /, issue: 'Label starts with "Enter"', recommendation: 'Remove "Enter" - it\'s implied by the input field' },
	{ pattern: /^Please /, issue: 'Label starts with "Please"', recommendation: 'Be direct - remove "Please"' },
	{ pattern: /\.\.\.$/, issue: 'Label ends with ellipsis', recommendation: 'Remove ellipsis - unclear what it indicates' },
];

export class UserInputFieldQualityAuditor implements AuditExecutor {
	name = 'user-input-field-quality';
	description = 'Review user_input step fields for UX quality';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			// Extract user_input steps
			const userInputSteps = this.extractUserInputSteps(workflow.content);

			if (userInputSteps.length === 0) {
				continue;
			}

			for (const step of userInputSteps) {
				// Check label quality
				const labelIssues = this.checkLabelQuality(step.label, step.fieldName);
				findings.push(...labelIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'user-input-field-quality',
					issue: `Field "${step.fieldName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: issue.autoFixable,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'ux', 'user-input'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: step.stepName,
						fieldName: step.fieldName,
						currentLabel: step.label,
						...issue.context,
					},
				})));

				// Check description quality
				const descriptionIssues = this.checkDescriptionQuality(step.description, step.label, step.fieldName);
				findings.push(...descriptionIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'user-input-field-quality',
					issue: `Field "${step.fieldName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'ux', 'user-input', 'description'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: step.stepName,
						fieldName: step.fieldName,
						currentDescription: step.description,
						currentLabel: step.label,
						...issue.context,
					},
				})));

				// Check default value appropriateness
				const defaultIssues = this.checkDefaultValue(step.defaultValue, step.fieldName, step.type);
				findings.push(...defaultIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'user-input-field-quality',
					issue: `Field "${step.fieldName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'ux', 'user-input', 'default-value'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: step.stepName,
						fieldName: step.fieldName,
						currentDefaultValue: step.defaultValue,
						fieldType: step.type,
						...issue.context,
					},
				})));
			}
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Extract user_input steps from workflow content
	 */
	private extractUserInputSteps(content: string): Array<{
		stepName: string;
		fieldName: string;
		label: string;
		description?: string;
		defaultValue?: string;
		type?: string;
	}> {
		const steps: Array<{
			stepName: string;
			fieldName: string;
			label: string;
			description?: string;
			defaultValue?: string;
			type?: string;
		}> = [];

		// Find user_input step blocks
		const stepMatches = content.matchAll(/(\w+):\s*{\s*type:\s*['"]user_input['"][\s\S]*?}/g);

		for (const stepMatch of stepMatches) {
			const stepName = stepMatch[1];
			const stepBlock = stepMatch[0];

			// Extract fields within the step
			const fieldsMatch = stepBlock.match(/fields:\s*{([\s\S]*?)}/);
			if (!fieldsMatch) continue;

			const fieldsBlock = fieldsMatch[1];

			// Extract individual field definitions
			const fieldMatches = fieldsBlock.matchAll(/(\w+):\s*{[\s\S]*?label:\s*['"]([^'"]+)['"][\s\S]*?}/g);

			for (const fieldMatch of fieldMatches) {
				const fieldName = fieldMatch[1];
				const fieldBlock = fieldMatch[0];
				const label = fieldMatch[2];

				// Extract optional fields
				const descriptionMatch = fieldBlock.match(/description:\s*['"]([^'"]+)['"]/);
				const defaultMatch = fieldBlock.match(/default:\s*['"]([^'"]+)['"]/);
				const typeMatch = fieldBlock.match(/type:\s*['"]([^'"]+)['"]/);

				steps.push({
					stepName,
					fieldName,
					label,
					description: descriptionMatch?.[1],
					defaultValue: defaultMatch?.[1],
					type: typeMatch?.[1],
				});
			}
		}

		return steps;
	}

	/**
	 * Check label quality
	 */
	private checkLabelQuality(
		label: string,
		fieldName: string
	): Array<{
		severity: 'medium' | 'low';
		issue: string;
		recommendation: string;
		autoFixable: boolean;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'medium' | 'low';
			issue: string;
			recommendation: string;
			autoFixable: boolean;
			context?: Record<string, unknown>;
		}> = [];

		// Check length
		if (label.length > MAX_LABEL_LENGTH) {
			issues.push({
				severity: 'medium',
				issue: `Label is too long (${label.length} chars)`,
				recommendation: `Shorten label to ${MAX_LABEL_LENGTH} chars or less. Move verbose text to description.`,
				autoFixable: false,
				context: {
					currentLength: label.length,
					maxLength: MAX_LABEL_LENGTH,
				},
			});
		}

		// Check for verbose indicators
		const verboseIndicators = VERBOSE_LABEL_INDICATORS.filter(indicator => label.toLowerCase().includes(indicator));
		if (verboseIndicators.length > 0) {
			issues.push({
				severity: 'low',
				issue: `Label contains verbose words: ${verboseIndicators.join(', ')}`,
				recommendation: 'Remove verbose words. Labels should be concise.',
				autoFixable: true,
				context: {
					verboseWords: verboseIndicators,
				},
			});
		}

		// Check anti-patterns
		for (const antiPattern of LABEL_ANTI_PATTERNS) {
			if (antiPattern.pattern.test(label)) {
				issues.push({
					severity: 'low',
					issue: antiPattern.issue,
					recommendation: antiPattern.recommendation,
					autoFixable: true,
				});
			}
		}

		// Check if label is just a restated field name
		const normalizedLabel = label.toLowerCase().replace(/[^a-z]/g, '');
		const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z]/g, '');

		if (normalizedLabel === normalizedFieldName) {
			issues.push({
				severity: 'low',
				issue: 'Label is identical to field name',
				recommendation: 'Provide a more descriptive, user-friendly label that explains what the field is for.',
				autoFixable: false,
			});
		}

		return issues;
	}

	/**
	 * Check description quality
	 */
	private checkDescriptionQuality(
		description: string | undefined,
		label: string,
		fieldName: string
	): Array<{
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

		// Missing description
		if (!description) {
			issues.push({
				severity: 'medium',
				issue: 'Missing description',
				recommendation: 'Add a helpful description that explains what the field is used for or provides examples.',
			});
			return issues;
		}

		// Too short
		if (description.length < MIN_DESCRIPTION_LENGTH) {
			issues.push({
				severity: 'low',
				issue: `Description is too short (${description.length} chars)`,
				recommendation: `Expand description to at least ${MIN_DESCRIPTION_LENGTH} chars. Provide context or examples.`,
				context: {
					currentLength: description.length,
					minLength: MIN_DESCRIPTION_LENGTH,
				},
			});
		}

		// Description just restates label
		const descLower = description.toLowerCase().replace(/[^a-z]/g, '');
		const labelLower = label.toLowerCase().replace(/[^a-z]/g, '');

		if (descLower === labelLower || descLower.includes(labelLower) && descLower.length < labelLower.length + 10) {
			issues.push({
				severity: 'medium',
				issue: 'Description just restates the label',
				recommendation: 'Provide additional context beyond the label. Explain why the field is needed or give examples.',
			});
		}

		// Check for example/placeholder indicators
		const hasExample = /example|e\.g\.|for instance|such as/i.test(description);
		if (!hasExample && description.length < 50) {
			issues.push({
				severity: 'low',
				issue: 'Description lacks examples',
				recommendation: 'Consider adding an example to help users understand expected input.',
			});
		}

		return issues;
	}

	/**
	 * Check default value appropriateness
	 */
	private checkDefaultValue(
		defaultValue: string | undefined,
		fieldName: string,
		fieldType?: string
	): Array<{
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

		if (!defaultValue) {
			// Check if this field type should typically have a default
			if (fieldType === 'boolean') {
				issues.push({
					severity: 'low',
					issue: 'Boolean field missing default value',
					recommendation: 'Consider providing a sensible default (true or false) for boolean fields.',
					context: { fieldType },
				});
			}
			return issues;
		}

		// Check if default looks like placeholder text
		const placeholderIndicators = ['example', 'your', 'enter', 'xxx', '...'];
		const hasPlaceholder = placeholderIndicators.some(indicator => defaultValue.toLowerCase().includes(indicator));

		if (hasPlaceholder) {
			issues.push({
				severity: 'medium',
				issue: 'Default value appears to be placeholder text',
				recommendation: 'Use actual default values, not placeholders. Move example text to description field.',
				context: {
					currentDefault: defaultValue,
					detectedIndicators: placeholderIndicators.filter(ind => defaultValue.toLowerCase().includes(ind)),
				},
			});
		}

		// Type-specific validation
		if (fieldType === 'email' && defaultValue && !defaultValue.includes('@')) {
			issues.push({
				severity: 'medium',
				issue: 'Email field has invalid default value',
				recommendation: 'Provide a valid email format or remove default.',
				context: { fieldType, currentDefault: defaultValue },
			});
		}

		if (fieldType === 'url' && defaultValue && !defaultValue.startsWith('http')) {
			issues.push({
				severity: 'medium',
				issue: 'URL field has invalid default value',
				recommendation: 'Provide a valid URL format (starting with http:// or https://) or remove default.',
				context: { fieldType, currentDefault: defaultValue },
			});
		}

		return issues;
	}
}

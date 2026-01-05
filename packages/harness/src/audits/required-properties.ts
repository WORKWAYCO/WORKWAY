/**
 * Required Properties Validation Audit
 *
 * Validate that requiredProperties match actual workflow use cases.
 * Check property weights are balanced and sum to reasonable totals.
 *
 * Priority: P1
 * Labels: audit, workflows
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows, extractPathway, extractIntegrations } from './workflow-loader';

/**
 * Maximum reasonable weight for any single property
 */
const MAX_SINGLE_PROPERTY_WEIGHT = 0.5;

/**
 * Reasonable total weight range
 */
const REASONABLE_TOTAL_WEIGHT_RANGE = { min: 0.3, max: 1.5 };

/**
 * Common required properties and their typical use cases
 */
const PROPERTY_USE_CASES: Record<string, string[]> = {
	invoice_amount: ['finance', 'billing', 'accounting', 'payment'],
	customer_email: ['crm', 'sales', 'support', 'customer'],
	appointment_time: ['calendar', 'scheduling', 'booking', 'appointment'],
	project_name: ['project', 'task', 'work', 'construction'],
	deal_stage: ['crm', 'sales', 'deal', 'pipeline'],
	ticket_status: ['support', 'issue', 'ticket', 'helpdesk'],
	event_date: ['calendar', 'event', 'meeting', 'conference'],
};

export class RequiredPropertiesAuditor implements AuditExecutor {
	name = 'required-properties';
	description = 'Validate requiredProperties match workflow use cases';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			const pathway = extractPathway(workflow.content);
			if (!pathway) {
				// Already flagged by scoring-rules audit
				continue;
			}

			// Extract requiredProperties from content
			const requiredPropsMatch = workflow.content.match(/requiredProperties:\s*(\[[^\]]*\]|{[^}]*})/s);
			if (!requiredPropsMatch) {
				// Check if this workflow should have required properties
				const needsRequiredProperties = this.shouldHaveRequiredProperties(workflow.content, workflow.metadata.category);

				if (needsRequiredProperties) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'medium',
						category: 'required-properties',
						issue: 'Missing requiredProperties configuration',
						recommendation: 'Add requiredProperties to ensure workflow has necessary data inputs',
						autoFixable: false,
						priority: severityToPriority('medium'),
						labels: ['audit', 'workflows', 'required-properties'],
						filePath: workflow.metadata.filePath,
						context: {
							category: workflow.metadata.category,
							suggestedProperties: this.suggestPropertiesForCategory(workflow.metadata.category),
						},
					});
				}
				continue;
			}

			// Parse required properties (simplified - in production use AST parser)
			const properties = this.parseRequiredProperties(requiredPropsMatch[1]);

			// Check if properties align with workflow purpose
			const alignmentIssues = this.checkPropertyAlignment(properties, workflow.metadata.name, workflow.metadata.category);
			findings.push(...alignmentIssues.map(issue => ({
				workflowId: workflow.metadata.id,
				workflowName: workflow.metadata.name,
				severity: issue.severity,
				category: 'required-properties',
				issue: issue.issue,
				recommendation: issue.recommendation,
				autoFixable: false,
				priority: severityToPriority(issue.severity),
				labels: ['audit', 'workflows', 'required-properties', 'alignment'],
				filePath: workflow.metadata.filePath,
				context: issue.context,
			})));

			// Check property weights
			const weightIssues = this.checkPropertyWeights(properties);
			findings.push(...weightIssues.map(issue => ({
				workflowId: workflow.metadata.id,
				workflowName: workflow.metadata.name,
				severity: issue.severity,
				category: 'required-properties',
				issue: issue.issue,
				recommendation: issue.recommendation,
				autoFixable: true,
				priority: severityToPriority(issue.severity),
				labels: ['audit', 'workflows', 'required-properties', 'weights'],
				filePath: workflow.metadata.filePath,
				context: issue.context,
			})));
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Check if workflow should have required properties based on its purpose
	 */
	private shouldHaveRequiredProperties(content: string, category?: string): boolean {
		// Workflows with resource_selection or data transformation should have required properties
		if (content.includes('resource_selection') || content.includes('fieldMappings')) {
			return true;
		}

		// Certain categories typically need required properties
		const categoriesNeedingProperties = ['finance', 'crm', 'scheduling', 'project-management', 'support'];
		if (category && categoriesNeedingProperties.some(cat => category.includes(cat))) {
			return true;
		}

		return false;
	}

	/**
	 * Parse required properties from string
	 */
	private parseRequiredProperties(propsStr: string): Array<{ name: string; weight?: number }> {
		const properties: Array<{ name: string; weight?: number }> = [];

		// Array format: ['prop1', 'prop2']
		if (propsStr.trim().startsWith('[')) {
			const matches = propsStr.matchAll(/['"]([^'"]+)['"]/g);
			for (const match of matches) {
				properties.push({ name: match[1] });
			}
		}
		// Object format: { prop1: { weight: 0.5 }, prop2: { weight: 0.3 } }
		else if (propsStr.trim().startsWith('{')) {
			const propMatches = propsStr.matchAll(/(\w+):\s*{[\s\S]*?weight:\s*([0-9.]+)[\s\S]*?}/g);
			for (const match of propMatches) {
				properties.push({
					name: match[1],
					weight: parseFloat(match[2]),
				});
			}
		}

		return properties;
	}

	/**
	 * Check if properties align with workflow purpose
	 */
	private checkPropertyAlignment(
		properties: Array<{ name: string; weight?: number }>,
		workflowName: string,
		category?: string
	): Array<{ severity: 'medium' | 'low'; issue: string; recommendation: string; context?: Record<string, unknown> }> {
		const issues: Array<{ severity: 'medium' | 'low'; issue: string; recommendation: string; context?: Record<string, unknown> }> = [];

		// Check each property against known use cases
		for (const prop of properties) {
			const useCase = PROPERTY_USE_CASES[prop.name];
			if (useCase) {
				// Check if workflow category/name matches use case
				const hasMatchingContext = useCase.some(uc => workflowName.toLowerCase().includes(uc) || category?.toLowerCase().includes(uc));

				if (!hasMatchingContext) {
					issues.push({
						severity: 'low',
						issue: `Property "${prop.name}" may not align with workflow purpose`,
						recommendation: `Review if "${prop.name}" is necessary for this workflow. Typically used in: ${useCase.join(', ')}`,
						context: {
							property: prop.name,
							typicalUseCases: useCase,
							workflowCategory: category,
						},
					});
				}
			}
		}

		// Check for missing critical properties based on workflow type
		const suggestedProperties = this.suggestPropertiesForCategory(category);
		const missingCritical = suggestedProperties.filter(suggested => !properties.some(p => p.name.includes(suggested.name)));

		if (missingCritical.length > 0) {
			issues.push({
				severity: 'medium',
				issue: `Workflow may be missing critical properties: ${missingCritical.map(p => p.name).join(', ')}`,
				recommendation: `Consider adding these properties based on workflow category "${category}"`,
				context: {
					missingProperties: missingCritical,
					workflowCategory: category,
				},
			});
		}

		return issues;
	}

	/**
	 * Check property weight distribution
	 */
	private checkPropertyWeights(
		properties: Array<{ name: string; weight?: number }>
	): Array<{ severity: 'medium' | 'low'; issue: string; recommendation: string; context?: Record<string, unknown> }> {
		const issues: Array<{ severity: 'medium' | 'low'; issue: string; recommendation: string; context?: Record<string, unknown> }> = [];

		const weightedProps = properties.filter(p => p.weight !== undefined);
		if (weightedProps.length === 0) {
			return issues; // No weights defined - OK
		}

		// Check individual property weights
		for (const prop of weightedProps) {
			if (prop.weight! > MAX_SINGLE_PROPERTY_WEIGHT) {
				issues.push({
					severity: 'medium',
					issue: `Property "${prop.name}" has weight ${prop.weight} (> ${MAX_SINGLE_PROPERTY_WEIGHT})`,
					recommendation: `Reduce weight to ${MAX_SINGLE_PROPERTY_WEIGHT} or below. No single property should dominate scoring.`,
					context: {
						property: prop.name,
						currentWeight: prop.weight,
						maxRecommended: MAX_SINGLE_PROPERTY_WEIGHT,
					},
				});
			}

			if (prop.weight! <= 0) {
				issues.push({
					severity: 'low',
					issue: `Property "${prop.name}" has weight ${prop.weight} (<= 0)`,
					recommendation: 'Remove property or assign positive weight. Zero-weight properties are redundant.',
					context: {
						property: prop.name,
						currentWeight: prop.weight,
					},
				});
			}
		}

		// Check total weight
		const totalWeight = weightedProps.reduce((sum, p) => sum + (p.weight || 0), 0);
		if (totalWeight < REASONABLE_TOTAL_WEIGHT_RANGE.min || totalWeight > REASONABLE_TOTAL_WEIGHT_RANGE.max) {
			issues.push({
				severity: 'low',
				issue: `Total property weight is ${totalWeight.toFixed(2)} (outside recommended range)`,
				recommendation: `Adjust weights to sum between ${REASONABLE_TOTAL_WEIGHT_RANGE.min} and ${REASONABLE_TOTAL_WEIGHT_RANGE.max}`,
				context: {
					totalWeight,
					recommendedRange: REASONABLE_TOTAL_WEIGHT_RANGE,
					properties: weightedProps.map(p => ({ name: p.name, weight: p.weight })),
				},
			});
		}

		return issues;
	}

	/**
	 * Suggest properties based on workflow category
	 */
	private suggestPropertiesForCategory(category?: string): Array<{ name: string; rationale: string }> {
		if (!category) return [];

		const suggestions: Array<{ name: string; rationale: string }> = [];

		if (category.includes('finance') || category.includes('billing')) {
			suggestions.push({ name: 'invoice_amount', rationale: 'Financial workflows typically need amount tracking' });
			suggestions.push({ name: 'customer_email', rationale: 'Customer identification for billing' });
		}

		if (category.includes('crm') || category.includes('sales')) {
			suggestions.push({ name: 'customer_email', rationale: 'Customer identification' });
			suggestions.push({ name: 'deal_stage', rationale: 'Sales pipeline tracking' });
		}

		if (category.includes('calendar') || category.includes('scheduling')) {
			suggestions.push({ name: 'event_date', rationale: 'Scheduling requires date tracking' });
			suggestions.push({ name: 'appointment_time', rationale: 'Time-based workflows need time data' });
		}

		if (category.includes('project')) {
			suggestions.push({ name: 'project_name', rationale: 'Project management needs project identification' });
		}

		if (category.includes('support') || category.includes('helpdesk')) {
			suggestions.push({ name: 'ticket_status', rationale: 'Support workflows track issue status' });
		}

		return suggestions;
	}
}

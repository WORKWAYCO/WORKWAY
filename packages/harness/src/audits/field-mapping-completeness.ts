/**
 * Field Mapping Completeness Audit
 *
 * For resource_selection steps, check if fieldMappings are defined where needed.
 * Verify target properties exist in destination system.
 * Identify critical missing field mappings.
 *
 * Priority: P3
 * Labels: audit, workflows, field-mapping
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows, extractIntegrations } from './workflow-loader';

/**
 * Known critical field mappings for common integrations
 */
const CRITICAL_FIELD_MAPPINGS: Record<string, Array<{ source: string; target: string; rationale: string }>> = {
	notion: [
		{ source: 'title', target: 'Name', rationale: 'Every Notion database entry needs a title' },
		{ source: 'content', target: 'Content', rationale: 'Primary content field' },
		{ source: 'created_at', target: 'Created', rationale: 'Timestamp for when entry was created' },
	],
	slack: [
		{ source: 'message', target: 'text', rationale: 'Message content is required' },
		{ source: 'channel', target: 'channel', rationale: 'Destination channel is required' },
	],
	gmail: [
		{ source: 'to', target: 'to', rationale: 'Recipient email is required' },
		{ source: 'subject', target: 'subject', rationale: 'Email subject is critical' },
		{ source: 'body', target: 'body', rationale: 'Email body content is required' },
	],
	airtable: [
		{ source: 'record_name', target: 'Name', rationale: 'Primary field for Airtable records' },
		{ source: 'table_id', target: 'tableId', rationale: 'Target table must be specified' },
	],
	hubspot: [
		{ source: 'contact_email', target: 'email', rationale: 'Email is primary identifier for contacts' },
		{ source: 'company_name', target: 'name', rationale: 'Company name is required for company objects' },
	],
	salesforce: [
		{ source: 'account_name', target: 'Name', rationale: 'Account name is required' },
		{ source: 'contact_email', target: 'Email', rationale: 'Contact email is critical identifier' },
	],
};

/**
 * Common source field naming patterns
 */
const SOURCE_FIELD_PATTERNS = {
	title: ['title', 'name', 'heading', 'subject'],
	content: ['content', 'body', 'text', 'description', 'message'],
	timestamp: ['created_at', 'updated_at', 'timestamp', 'date', 'time'],
	email: ['email', 'from', 'to', 'sender', 'recipient'],
};

/**
 * Integration-specific property schemas
 */
const INTEGRATION_SCHEMAS: Record<
	string,
	{
		requiredProperties: string[];
		commonProperties: string[];
	}
> = {
	notion: {
		requiredProperties: ['Name'],
		commonProperties: ['Content', 'Tags', 'Status', 'Created', 'Updated'],
	},
	slack: {
		requiredProperties: ['text', 'channel'],
		commonProperties: ['username', 'icon_emoji', 'attachments'],
	},
	gmail: {
		requiredProperties: ['to', 'subject', 'body'],
		commonProperties: ['cc', 'bcc', 'from', 'attachments'],
	},
	airtable: {
		requiredProperties: ['Name', 'tableId'],
		commonProperties: ['fields'],
	},
};

export class FieldMappingCompletenessAuditor implements AuditExecutor {
	name = 'field-mapping-completeness';
	description = 'Check field mapping completeness for resource_selection steps';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			// Extract integrations to understand destination systems
			const integrations = extractIntegrations(workflow.content);

			// Find resource_selection steps
			const resourceSelectionSteps = this.extractResourceSelectionSteps(workflow.content);

			if (resourceSelectionSteps.length === 0) {
				continue;
			}

			for (const step of resourceSelectionSteps) {
				// Check if fieldMappings are defined
				if (!step.hasFieldMappings) {
					const needsFieldMappings = this.shouldHaveFieldMappings(step.stepName, integrations);

					if (needsFieldMappings) {
						findings.push({
							workflowId: workflow.metadata.id,
							workflowName: workflow.metadata.name,
							severity: 'medium',
							category: 'field-mapping-completeness',
							issue: `Step "${step.stepName}" lacks fieldMappings configuration`,
							recommendation: 'Add fieldMappings to define how source data maps to destination properties',
							autoFixable: false,
							priority: severityToPriority('medium'),
							labels: ['audit', 'workflows', 'field-mapping', 'missing'],
							filePath: workflow.metadata.filePath,
							context: {
								stepName: step.stepName,
								integrations: integrations.map(i => i.service),
								suggestedMappings: this.suggestFieldMappings(integrations),
							},
						});
					}
					continue;
				}

				// Parse field mappings
				const mappings = this.parseFieldMappings(step.fieldMappingsContent);

				// Check for missing critical mappings
				const missingCriticalIssues = this.checkMissingCriticalMappings(mappings, integrations);
				findings.push(...missingCriticalIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'field-mapping-completeness',
					issue: `Step "${step.stepName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'field-mapping', 'critical-missing'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: step.stepName,
						currentMappings: mappings,
						...issue.context,
					},
				})));

				// Check for mappings to non-existent properties
				const nonExistentPropertyIssues = this.checkNonExistentProperties(mappings, integrations);
				findings.push(...nonExistentPropertyIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'field-mapping-completeness',
					issue: `Step "${step.stepName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'field-mapping', 'invalid-property'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: step.stepName,
						mapping: issue.mapping,
						...issue.context,
					},
				})));

				// Check for redundant/duplicate mappings
				const redundancyIssues = this.checkRedundantMappings(mappings);
				findings.push(...redundancyIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'field-mapping-completeness',
					issue: `Step "${step.stepName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: true,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'field-mapping', 'redundant'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: step.stepName,
						...issue.context,
					},
				})));
			}
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Extract resource_selection steps from workflow content
	 */
	private extractResourceSelectionSteps(content: string): Array<{
		stepName: string;
		hasFieldMappings: boolean;
		fieldMappingsContent?: string;
	}> {
		const steps: Array<{
			stepName: string;
			hasFieldMappings: boolean;
			fieldMappingsContent?: string;
		}> = [];

		// Find resource_selection step blocks
		const stepMatches = content.matchAll(/(\w+):\s*{\s*type:\s*['"]resource_selection['"][\s\S]*?}(?=\s*\w+:\s*{|\s*})/g);

		for (const stepMatch of stepMatches) {
			const stepName = stepMatch[1];
			const stepBlock = stepMatch[0];

			// Check if fieldMappings exists
			const fieldMappingsMatch = stepBlock.match(/fieldMappings:\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/);

			steps.push({
				stepName,
				hasFieldMappings: !!fieldMappingsMatch,
				fieldMappingsContent: fieldMappingsMatch?.[1],
			});
		}

		return steps;
	}

	/**
	 * Check if step should have field mappings
	 */
	private shouldHaveFieldMappings(stepName: string, integrations: Array<{ service: string; scopes: string[] }>): boolean {
		// If workflow has write integrations (creating/updating data), field mappings are important
		const hasWriteIntegration = integrations.some(integration => {
			const service = integration.service.toLowerCase();
			return (
				CRITICAL_FIELD_MAPPINGS[service] !== undefined ||
				integration.scopes.some(scope => scope.includes('write') || scope.includes('create') || scope.includes('update'))
			);
		});

		return hasWriteIntegration;
	}

	/**
	 * Parse field mappings from content
	 */
	private parseFieldMappings(content?: string): Array<{ source: string; target: string }> {
		if (!content) return [];

		const mappings: Array<{ source: string; target: string }> = [];

		// Object format: { source1: 'target1', source2: 'target2' }
		if (content.trim().startsWith('{')) {
			const mappingMatches = content.matchAll(/['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g);

			for (const match of mappingMatches) {
				mappings.push({
					source: match[1],
					target: match[2],
				});
			}
		}
		// Array format: [{ source: 'x', target: 'y' }, ...]
		else if (content.trim().startsWith('[')) {
			const objectMatches = content.matchAll(/{\s*source:\s*['"](\w+)['"],\s*target:\s*['"]([^'"]+)['"]\s*}/g);

			for (const match of objectMatches) {
				mappings.push({
					source: match[1],
					target: match[2],
				});
			}
		}

		return mappings;
	}

	/**
	 * Suggest field mappings based on integrations
	 */
	private suggestFieldMappings(integrations: Array<{ service: string; scopes: string[] }>): Array<{ source: string; target: string; rationale: string }> {
		const suggestions: Array<{ source: string; target: string; rationale: string }> = [];

		for (const integration of integrations) {
			const service = integration.service.toLowerCase();
			const criticalMappings = CRITICAL_FIELD_MAPPINGS[service];

			if (criticalMappings) {
				suggestions.push(...criticalMappings);
			}
		}

		return suggestions;
	}

	/**
	 * Check for missing critical field mappings
	 */
	private checkMissingCriticalMappings(
		mappings: Array<{ source: string; target: string }>,
		integrations: Array<{ service: string; scopes: string[] }>
	): Array<{
		severity: 'high' | 'medium' | 'low';
		issue: string;
		recommendation: string;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'high' | 'medium' | 'low';
			issue: string;
			recommendation: string;
			context?: Record<string, unknown>;
		}> = [];

		for (const integration of integrations) {
			const service = integration.service.toLowerCase();
			const criticalMappings = CRITICAL_FIELD_MAPPINGS[service];

			if (!criticalMappings) continue;

			// Check which critical mappings are missing
			const missingMappings = criticalMappings.filter(critical => !mappings.some(m => m.target === critical.target));

			if (missingMappings.length > 0) {
				issues.push({
					severity: 'high',
					issue: `Missing ${missingMappings.length} critical field mapping(s) for ${integration.service}`,
					recommendation: `Add these mappings: ${missingMappings.map(m => `${m.source} → ${m.target}`).join(', ')}`,
					context: {
						integration: integration.service,
						missingMappings: missingMappings.map(m => ({
							suggestedSource: m.source,
							target: m.target,
							rationale: m.rationale,
						})),
					},
				});
			}
		}

		return issues;
	}

	/**
	 * Check for mappings to non-existent properties
	 */
	private checkNonExistentProperties(
		mappings: Array<{ source: string; target: string }>,
		integrations: Array<{ service: string; scopes: string[] }>
	): Array<{
		severity: 'medium' | 'low';
		issue: string;
		recommendation: string;
		mapping: { source: string; target: string };
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'medium' | 'low';
			issue: string;
			recommendation: string;
			mapping: { source: string; target: string };
			context?: Record<string, unknown>;
		}> = [];

		for (const integration of integrations) {
			const service = integration.service.toLowerCase();
			const schema = INTEGRATION_SCHEMAS[service];

			if (!schema) continue;

			// Check if target properties exist in schema
			for (const mapping of mappings) {
				const propertyExists =
					schema.requiredProperties.includes(mapping.target) || schema.commonProperties.includes(mapping.target);

				if (!propertyExists) {
					issues.push({
						severity: 'medium',
						issue: `Mapping to non-existent property: ${mapping.source} → ${mapping.target}`,
						recommendation: `Verify "${mapping.target}" exists in ${integration.service}. Valid properties: ${[...schema.requiredProperties, ...schema.commonProperties].join(', ')}`,
						mapping,
						context: {
							integration: integration.service,
							validProperties: [...schema.requiredProperties, ...schema.commonProperties],
						},
					});
				}
			}
		}

		return issues;
	}

	/**
	 * Check for redundant/duplicate mappings
	 */
	private checkRedundantMappings(mappings: Array<{ source: string; target: string }>): Array<{
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

		// Check for duplicate target properties
		const targetCounts = new Map<string, number>();
		for (const mapping of mappings) {
			targetCounts.set(mapping.target, (targetCounts.get(mapping.target) || 0) + 1);
		}

		for (const [target, count] of targetCounts.entries()) {
			if (count > 1) {
				const duplicateSources = mappings.filter(m => m.target === target).map(m => m.source);

				issues.push({
					severity: 'low',
					issue: `Multiple sources map to same target "${target}"`,
					recommendation: `Remove redundant mappings. Sources: ${duplicateSources.join(', ')}. Keep the most appropriate one.`,
					context: {
						target,
						sources: duplicateSources,
						count,
					},
				});
			}
		}

		// Check for identity mappings (source === target)
		const identityMappings = mappings.filter(m => m.source.toLowerCase() === m.target.toLowerCase());

		if (identityMappings.length > 0) {
			issues.push({
				severity: 'low',
				issue: `${identityMappings.length} identity mapping(s) found (source === target)`,
				recommendation: 'Identity mappings may be unnecessary unless renaming for clarity. Review: ' + identityMappings.map(m => m.source).join(', '),
				context: {
					identityMappings: identityMappings.map(m => m.source),
				},
			});
		}

		return issues;
	}
}

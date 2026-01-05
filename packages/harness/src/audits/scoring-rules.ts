/**
 * Scoring Rules Audit
 *
 * Review nameKeywords (strong/moderate) and scoring tiers for semantic appropriateness.
 * Ensure keywords match workflow use cases and tiers follow consistent thresholds.
 *
 * Priority: P1
 * Labels: audit, workflows
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows, extractPathway } from './workflow-loader';

/**
 * Standard score tiers (platform-wide consistency)
 */
const STANDARD_SCORE_TIERS = {
	excellent: 0.7,
	good: 0.5,
	fair: 0.3,
};

/**
 * Keywords that should typically be "strong" matches
 */
const TYPICALLY_STRONG_KEYWORDS = ['invoice', 'payment', 'booking', 'appointment', 'order', 'customer', 'lead', 'deal', 'ticket', 'issue', 'meeting', 'event'];

/**
 * Keywords that should typically be "moderate" matches
 */
const TYPICALLY_MODERATE_KEYWORDS = ['sync', 'update', 'notify', 'track', 'monitor', 'report', 'digest', 'summary'];

export class ScoringRulesAuditor implements AuditExecutor {
	name = 'scoring-rules';
	description = 'Review nameKeywords and scoring tiers for semantic appropriateness';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			// Extract pathway configuration
			const pathway = extractPathway(workflow.content);
			if (!pathway) {
				findings.push({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: 'medium',
					category: 'scoring-rules',
					issue: 'Missing pathway configuration',
					recommendation: 'Add pathway.discoveryMoments with appropriate scoring configuration',
					autoFixable: false,
					priority: severityToPriority('medium'),
					labels: ['audit', 'workflows', 'pathway'],
					filePath: workflow.metadata.filePath,
				});
				continue;
			}

			// Check discoveryMoments
			const discoveryMoments = pathway.discoveryMoments;
			if (!discoveryMoments) {
				findings.push({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: 'medium',
					category: 'scoring-rules',
					issue: 'Missing discoveryMoments configuration',
					recommendation: 'Add pathway.discoveryMoments to enable workflow discovery',
					autoFixable: false,
					priority: severityToPriority('medium'),
					labels: ['audit', 'workflows', 'discovery'],
					filePath: workflow.metadata.filePath,
				});
				continue;
			}

			// Extract nameKeywords from discoveryMoments
			// This is a simplified check - in production we'd parse the AST properly
			const hasNameKeywords = workflow.content.includes('nameKeywords');
			if (!hasNameKeywords) {
				// This is actually OK - not all workflows use nameKeywords
				continue;
			}

			// Check for consistent tier usage
			const hasConsistentTiers = this.checkScoreTierConsistency(workflow.content);
			if (!hasConsistentTiers) {
				findings.push({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: 'low',
					category: 'scoring-rules',
					issue: 'Inconsistent score tier values',
					recommendation: `Use standard tiers: excellent: ${STANDARD_SCORE_TIERS.excellent}, good: ${STANDARD_SCORE_TIERS.good}, fair: ${STANDARD_SCORE_TIERS.fair}`,
					autoFixable: true,
					priority: severityToPriority('low'),
					labels: ['audit', 'workflows', 'scoring', 'consistency'],
					filePath: workflow.metadata.filePath,
					context: {
						standardTiers: STANDARD_SCORE_TIERS,
					},
				});
			}

			// Check for reasonable keyword strategies
			const keywordIssues = this.checkKeywordStrategies(workflow.content, workflow.metadata.name);
			findings.push(...keywordIssues.map(issue => ({
				workflowId: workflow.metadata.id,
				workflowName: workflow.metadata.name,
				severity: 'low' as const,
				category: 'scoring-rules',
				issue: issue.issue,
				recommendation: issue.recommendation,
				autoFixable: false,
				priority: 'P3' as const,
				labels: ['audit', 'workflows', 'keywords'],
				filePath: workflow.metadata.filePath,
				context: issue.context,
			})));
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Check if score tiers follow platform-wide consistency
	 */
	private checkScoreTierConsistency(content: string): boolean {
		// Extract score tier values
		const tierMatches = [
			...content.matchAll(/excellent:\s*([0-9.]+)/g),
			...content.matchAll(/good:\s*([0-9.]+)/g),
			...content.matchAll(/fair:\s*([0-9.]+)/g),
		];

		for (const match of tierMatches) {
			const value = parseFloat(match[1]);
			const tierName = match[0].split(':')[0] as keyof typeof STANDARD_SCORE_TIERS;

			if (STANDARD_SCORE_TIERS[tierName] && Math.abs(value - STANDARD_SCORE_TIERS[tierName]) > 0.01) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check for reasonable keyword strategies
	 */
	private checkKeywordStrategies(content: string, workflowName: string): Array<{ issue: string; recommendation: string; context?: Record<string, unknown> }> {
		const issues: Array<{ issue: string; recommendation: string; context?: Record<string, unknown> }> = [];

		// Extract strong and moderate keywords
		const strongKeywordsMatch = content.match(/strong:\s*\[([^\]]+)\]/);
		const moderateKeywordsMatch = content.match(/moderate:\s*\[([^\]]+)\]/);

		if (!strongKeywordsMatch && !moderateKeywordsMatch) {
			// No keywords defined - this is OK for some workflows
			return issues;
		}

		// Parse keywords
		const strongKeywords = strongKeywordsMatch
			? strongKeywordsMatch[1]
					.split(',')
					.map(k => k.trim().replace(/['"]/g, ''))
					.filter(Boolean)
			: [];

		const moderateKeywords = moderateKeywordsMatch
			? moderateKeywordsMatch[1]
					.split(',')
					.map(k => k.trim().replace(/['"]/g, ''))
					.filter(Boolean)
			: [];

		// Check if strong keywords are actually strong concepts
		for (const keyword of strongKeywords) {
			if (TYPICALLY_MODERATE_KEYWORDS.includes(keyword.toLowerCase())) {
				issues.push({
					issue: `Keyword "${keyword}" marked as strong but typically indicates moderate match`,
					recommendation: `Consider moving "${keyword}" to moderate keywords or justify why it's a strong match for this workflow`,
					context: { keyword, currentLevel: 'strong', suggestedLevel: 'moderate' },
				});
			}
		}

		// Check if moderate keywords might be strong
		for (const keyword of moderateKeywords) {
			if (TYPICALLY_STRONG_KEYWORDS.includes(keyword.toLowerCase())) {
				issues.push({
					issue: `Keyword "${keyword}" marked as moderate but typically indicates strong match`,
					recommendation: `Consider moving "${keyword}" to strong keywords or justify why it's only a moderate match`,
					context: { keyword, currentLevel: 'moderate', suggestedLevel: 'strong' },
				});
			}
		}

		// Check for duplicate keywords across levels
		const duplicates = strongKeywords.filter(k => moderateKeywords.includes(k));
		if (duplicates.length > 0) {
			issues.push({
				issue: `Keywords appear in both strong and moderate: ${duplicates.join(', ')}`,
				recommendation: 'Remove duplicate keywords - each keyword should only appear in one category',
				context: { duplicates },
			});
		}

		// Check if keywords are semantically related to workflow
		const workflowNameLower = workflowName.toLowerCase();
		const allKeywords = [...strongKeywords, ...moderateKeywords];

		// Simple heuristic: at least one keyword should appear in workflow name or vice versa
		const hasSemanticMatch = allKeywords.some(k => workflowNameLower.includes(k.toLowerCase())) || allKeywords.some(k => workflowNameLower.includes(k.toLowerCase()));

		if (!hasSemanticMatch && allKeywords.length > 0) {
			issues.push({
				issue: 'Keywords may not be semantically related to workflow purpose',
				recommendation: `Review if keywords (${allKeywords.join(', ')}) accurately represent discovery signals for "${workflowName}"`,
				context: { workflowName, keywords: allKeywords },
			});
		}

		return issues;
	}
}

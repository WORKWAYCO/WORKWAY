/**
 * learn_analyze Tool
 *
 * Analyze workflow code against WORKWAY patterns.
 */

import { readFileSync, existsSync } from 'node:fs';
import type { WorkflowAnalysis } from '../../types/index.js';

export const definition = {
	name: 'learn_analyze',
	description: 'Analyze workflow code against WORKWAY patterns and Zuhandenheit principles',
	inputSchema: {
		type: 'object' as const,
		properties: {
			source: {
				type: 'string',
				enum: ['file', 'inline'],
				description: 'Source type: file (path to file) or inline (code string)'
			},
			path: {
				type: 'string',
				description: 'File path (for source: file)'
			},
			code: {
				type: 'string',
				description: 'Workflow code (for source: inline)'
			},
			analysisDepth: {
				type: 'string',
				enum: ['quick', 'comprehensive'],
				description: 'Analysis depth'
			}
		},
		required: ['source']
	}
};

export interface LearnAnalyzeInput {
	source: 'file' | 'inline';
	path?: string;
	code?: string;
	analysisDepth?: 'quick' | 'comprehensive';
}

export async function handler(input: LearnAnalyzeInput): Promise<WorkflowAnalysis> {
	const { source, path, code, analysisDepth = 'quick' } = input;

	// Get code
	let workflowCode = code;
	if (source === 'file' && path) {
		if (!existsSync(path)) {
			throw new Error(`File not found: ${path}`);
		}
		workflowCode = readFileSync(path, 'utf-8');
	}

	if (!workflowCode) {
		throw new Error('No code provided. Use path for files or code for inline.');
	}

	return analyzeWorkflow(workflowCode, analysisDepth === 'comprehensive');
}

/**
 * Perform comprehensive workflow analysis
 */
function analyzeWorkflow(code: string, comprehensive: boolean): WorkflowAnalysis {
	const analysis: WorkflowAnalysis = {
		overall: {
			score: 0,
			grade: 'F',
			summary: ''
		},
		patterns: {
			defineWorkflow: { present: false, valid: false, notes: '' },
			integrations: { listed: [], properlyTyped: false, baseAPIClientPattern: false, notes: '' },
			configSchema: { present: false, valid: false, sensibleDefaults: false, notes: '' },
			errorHandling: { hasOnError: false, gracefulDegradation: false, notes: '' },
			triggers: { type: 'none', valid: false, notes: '' }
		},
		zuhandenheit: {
			score: 0,
			toolRecession: '',
			outcomeFocus: '',
			recommendations: []
		},
		suggestions: [],
		relatedLessons: []
	};

	let score = 0;

	// =========================================================================
	// Pattern Analysis
	// =========================================================================

	// defineWorkflow
	const defineWorkflowMatch = code.match(/defineWorkflow\s*\(\s*\{/);
	analysis.patterns.defineWorkflow.present = !!defineWorkflowMatch;
	if (defineWorkflowMatch) {
		score += 15;
		analysis.patterns.defineWorkflow.valid = true;
		analysis.patterns.defineWorkflow.notes = 'Correctly uses defineWorkflow()';
	} else {
		analysis.patterns.defineWorkflow.notes = 'Missing defineWorkflow() wrapper';
		analysis.suggestions.push({
			priority: 'high',
			category: 'structure',
			suggestion: 'Wrap your workflow in defineWorkflow()',
			codeExample: "import { defineWorkflow } from '@workwayco/sdk';\n\nexport default defineWorkflow({\n  // ...\n});"
		});
		analysis.relatedLessons.push({
			pathId: 'workflow-foundations',
			lessonId: 'define-workflow-pattern',
			title: 'The defineWorkflow() Pattern',
			relevance: 'Learn the foundational workflow structure'
		});
	}

	// Integrations
	const integrationsMatch = code.match(/integrations\s*:\s*\[([^\]]*)\]/);
	if (integrationsMatch) {
		const integrations = integrationsMatch[1]
			.split(',')
			.map((i) => i.trim().replace(/['"]/g, ''))
			.filter(Boolean);
		analysis.patterns.integrations.listed = integrations;
		analysis.patterns.integrations.properlyTyped = true;
		score += 10;
		analysis.patterns.integrations.notes = `Uses ${integrations.length} integration(s): ${integrations.join(', ')}`;

		// Check for BaseAPIClient pattern
		if (code.includes('BaseAPIClient') || code.includes('integrations.')) {
			analysis.patterns.integrations.baseAPIClientPattern = true;
			score += 5;
		}
	} else {
		analysis.patterns.integrations.notes = 'No integrations declared';
		analysis.relatedLessons.push({
			pathId: 'workflow-foundations',
			lessonId: 'integrations-oauth',
			title: 'Integrations & OAuth',
			relevance: 'Learn how to use WORKWAY integrations'
		});
	}

	// Config Schema
	const configSchemaMatch = code.match(/configSchema\s*:\s*\{/);
	if (configSchemaMatch) {
		analysis.patterns.configSchema.present = true;
		analysis.patterns.configSchema.valid = true;
		score += 10;

		// Check for defaults
		if (code.includes('default:') || code.includes('default :')) {
			analysis.patterns.configSchema.sensibleDefaults = true;
			score += 5;
			analysis.patterns.configSchema.notes = 'Has sensible defaults';
		} else {
			analysis.patterns.configSchema.notes = 'Present but could use more defaults';
			analysis.suggestions.push({
				priority: 'medium',
				category: 'usability',
				suggestion: 'Add sensible defaults to reduce user configuration burden'
			});
		}
	} else {
		analysis.patterns.configSchema.notes = 'No config schema defined';
		analysis.relatedLessons.push({
			pathId: 'workflow-foundations',
			lessonId: 'config-schemas',
			title: 'Configuration Schemas',
			relevance: 'Learn to create user-friendly configuration'
		});
	}

	// Error Handling
	const hasOnError = code.includes('onError');
	const hasTryCatch = code.includes('try {') || code.includes('try{');
	const hasCatch = code.includes('.catch(');

	analysis.patterns.errorHandling.hasOnError = hasOnError;
	analysis.patterns.errorHandling.gracefulDegradation = hasOnError || hasTryCatch || hasCatch;

	if (analysis.patterns.errorHandling.gracefulDegradation) {
		score += 10;
		analysis.patterns.errorHandling.notes = hasOnError
			? 'Uses onError handler'
			: 'Has error handling';
	} else {
		analysis.patterns.errorHandling.notes = 'No error handling detected';
		analysis.suggestions.push({
			priority: 'medium',
			category: 'resilience',
			suggestion: 'Add error handling with onError or try/catch',
			codeExample: 'onError: async ({ error, context }) => {\n  // Handle gracefully\n}'
		});
		analysis.relatedLessons.push({
			pathId: 'building-workflows',
			lessonId: 'error-handling',
			title: 'Error Handling',
			relevance: 'Learn graceful degradation patterns'
		});
	}

	// Triggers
	const triggerMatch = code.match(/triggers?\s*:\s*\{[^}]*type\s*:\s*['"](\w+)['"]/);
	if (triggerMatch) {
		analysis.patterns.triggers.type = triggerMatch[1];
		analysis.patterns.triggers.valid = true;
		score += 10;
		analysis.patterns.triggers.notes = `Trigger type: ${triggerMatch[1]}`;
	} else {
		analysis.patterns.triggers.notes = 'No trigger defined';
		analysis.relatedLessons.push({
			pathId: 'workflow-foundations',
			lessonId: 'triggers',
			title: 'Triggers',
			relevance: 'Learn about workflow triggers'
		});
	}

	// =========================================================================
	// Zuhandenheit Analysis
	// =========================================================================

	let zuhandenheitScore = 0;

	// Check naming - is it outcome-focused?
	const nameMatch = code.match(/name\s*:\s*['"]([^'"]+)['"]/);
	if (nameMatch) {
		const name = nameMatch[1].toLowerCase();
		const outcomeWords = ['after', 'when', 'follow', 'sync', 'save', 'notify', 'update', 'create', 'send', 'archive'];
		const mechanismWords = ['api', 'webhook', 'endpoint', 'http', 'rest', 'json'];

		const hasOutcomeWord = outcomeWords.some((w) => name.includes(w));
		const hasMechanismWord = mechanismWords.some((w) => name.includes(w));

		if (hasOutcomeWord && !hasMechanismWord) {
			zuhandenheitScore += 40;
			analysis.zuhandenheit.outcomeFocus = 'Good! Name describes outcome, not mechanism.';
		} else if (hasMechanismWord) {
			analysis.zuhandenheit.outcomeFocus = 'Name mentions technology. Consider focusing on the outcome.';
			analysis.zuhandenheit.recommendations.push('Rename to describe what disappears from the user\'s to-do list');
		} else {
			zuhandenheitScore += 20;
			analysis.zuhandenheit.outcomeFocus = 'Name is neutral. Could be more outcome-focused.';
		}
	}

	// Check description
	const descMatch = code.match(/description\s*:\s*['"]([^'"]+)['"]/);
	if (descMatch) {
		const desc = descMatch[1].toLowerCase();
		if (desc.includes('automatically') || desc.includes('when') || desc.includes('after')) {
			zuhandenheitScore += 30;
			analysis.zuhandenheit.toolRecession = 'Description emphasizes automation over mechanism.';
		} else {
			analysis.zuhandenheit.toolRecession = 'Description could better emphasize how the tool recedes.';
			analysis.zuhandenheit.recommendations.push('Describe what the user no longer has to think about');
		}
	}

	// Check for minimal configuration
	if (analysis.patterns.configSchema.sensibleDefaults) {
		zuhandenheitScore += 30;
	} else {
		analysis.zuhandenheit.recommendations.push('Add more defaults so users can start without configuration');
	}

	analysis.zuhandenheit.score = zuhandenheitScore;

	// =========================================================================
	// Final Scoring
	// =========================================================================

	// Add zuhandenheit to overall score
	score += Math.round(zuhandenheitScore * 0.3); // 30% weight

	analysis.overall.score = Math.min(score, 100);

	// Determine grade
	if (analysis.overall.score >= 90) analysis.overall.grade = 'A';
	else if (analysis.overall.score >= 80) analysis.overall.grade = 'B';
	else if (analysis.overall.score >= 70) analysis.overall.grade = 'C';
	else if (analysis.overall.score >= 60) analysis.overall.grade = 'D';
	else analysis.overall.grade = 'F';

	// Generate summary
	if (analysis.overall.score >= 80) {
		analysis.overall.summary = 'Excellent workflow! Follows WORKWAY patterns and embodies Zuhandenheit.';
	} else if (analysis.overall.score >= 60) {
		analysis.overall.summary = 'Good structure with room for improvement in patterns and tool recession.';
	} else if (analysis.overall.score >= 40) {
		analysis.overall.summary = 'Basic workflow. Review core patterns and focus on user outcomes.';
	} else {
		analysis.overall.summary = 'Needs significant work. Start with the Workflow Foundations path.';
	}

	return analysis;
}

/**
 * Error Message Helpfulness Audit
 *
 * Audit failureMessage strings for actionability.
 * Check that messages specify what user needs to do, not just that something failed.
 *
 * Priority: P2
 * Labels: audit, workflows, ux, error-handling
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows } from './workflow-loader';

/**
 * Vague error message indicators (anti-patterns)
 */
const VAGUE_ERROR_INDICATORS = [
	'failed',
	'error',
	'something went wrong',
	'try again',
	'unsuccessful',
	'could not',
	'unable to',
];

/**
 * Good error message indicators (actionable)
 */
const ACTIONABLE_ERROR_INDICATORS = [
	'please',
	'connect',
	'configure',
	'verify',
	'check',
	'ensure',
	'contact',
	'update',
	'add',
	'remove',
	'set',
];

/**
 * Common error message anti-patterns
 */
const ERROR_MESSAGE_ANTI_PATTERNS = [
	{
		pattern: /^(failed|error|unsuccessful)/i,
		issue: 'Error message starts with generic failure word',
		recommendation: 'Start with what action the user should take, not just that it failed.',
		example: 'Bad: "Failed to authenticate" → Good: "Please connect your Zoom account to continue"',
	},
	{
		pattern: /try again/i,
		issue: 'Error message says "try again" without explaining why it failed',
		recommendation: 'Explain what went wrong and what to fix before retrying.',
		example: 'Bad: "Please try again" → Good: "Connection timed out. Check your internet and retry."',
	},
	{
		pattern: /something went wrong/i,
		issue: 'Error message is too generic',
		recommendation: 'Be specific about what went wrong and how to fix it.',
		example: 'Bad: "Something went wrong" → Good: "API key is invalid. Update your credentials in Settings."',
	},
];

/**
 * Error context patterns that should be mentioned
 */
const CONTEXT_PATTERNS = {
	oauth: ['connect', 'authorize', 'account', 'permission'],
	api_key: ['api key', 'credentials', 'settings', 'configuration'],
	network: ['connection', 'internet', 'network', 'timeout'],
	validation: ['format', 'required', 'valid', 'check'],
};

export class ErrorMessageHelpfulnessAuditor implements AuditExecutor {
	name = 'error-message-helpfulness';
	description = 'Audit failureMessage strings for actionability';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			// Extract error messages
			const errorMessages = this.extractErrorMessages(workflow.content);

			if (errorMessages.length === 0) {
				// Workflow has no explicit error messages - this might be OK or might be missing error handling
				const hasErrorHandling = this.hasErrorHandling(workflow.content);
				if (!hasErrorHandling) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'medium',
						category: 'error-message-helpfulness',
						issue: 'Workflow lacks explicit error handling',
						recommendation: 'Add failureMessage to critical steps to provide user feedback when things go wrong.',
						autoFixable: false,
						priority: severityToPriority('medium'),
						labels: ['audit', 'workflows', 'error-handling', 'missing'],
						filePath: workflow.metadata.filePath,
					});
				}
				continue;
			}

			for (const errorMsg of errorMessages) {
				// Check if message is actionable
				const actionabilityIssues = this.checkActionability(errorMsg.message, errorMsg.stepName);
				findings.push(...actionabilityIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'error-message-helpfulness',
					issue: `Step "${errorMsg.stepName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'error-handling', 'actionability'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: errorMsg.stepName,
						currentMessage: errorMsg.message,
						...issue.context,
					},
				})));

				// Check for anti-patterns
				const antiPatternIssues = this.checkAntiPatterns(errorMsg.message, errorMsg.stepName);
				findings.push(...antiPatternIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'error-message-helpfulness',
					issue: `Step "${errorMsg.stepName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'error-handling', 'anti-pattern'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: errorMsg.stepName,
						currentMessage: errorMsg.message,
						example: issue.example,
						...issue.context,
					},
				})));

				// Check context appropriateness
				const contextIssues = this.checkContextAppropriate(errorMsg.message, errorMsg.stepName, errorMsg.stepType);
				findings.push(...contextIssues.map(issue => ({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: issue.severity,
					category: 'error-message-helpfulness',
					issue: `Step "${errorMsg.stepName}": ${issue.issue}`,
					recommendation: issue.recommendation,
					autoFixable: false,
					priority: severityToPriority(issue.severity),
					labels: ['audit', 'workflows', 'error-handling', 'context'],
					filePath: workflow.metadata.filePath,
					context: {
						stepName: errorMsg.stepName,
						stepType: errorMsg.stepType,
						currentMessage: errorMsg.message,
						...issue.context,
					},
				})));
			}
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Extract error messages from workflow content
	 */
	private extractErrorMessages(content: string): Array<{
		stepName: string;
		stepType?: string;
		message: string;
	}> {
		const messages: Array<{
			stepName: string;
			stepType?: string;
			message: string;
		}> = [];

		// Find all failureMessage occurrences
		const failureMatches = content.matchAll(/failureMessage:\s*['"]([^'"]+)['"]/g);

		for (const match of failureMatches) {
			const message = match[1];

			// Find the step this belongs to (search backwards from match index)
			const beforeMatch = content.substring(0, match.index);
			const stepMatch = beforeMatch.match(/(\w+):\s*{\s*type:\s*['"](\w+)['"][\s\S]*$/);

			if (stepMatch) {
				messages.push({
					stepName: stepMatch[1],
					stepType: stepMatch[2],
					message,
				});
			} else {
				// Couldn't determine step, just record the message
				messages.push({
					stepName: 'unknown',
					message,
				});
			}
		}

		return messages;
	}

	/**
	 * Check if workflow has any error handling
	 */
	private hasErrorHandling(content: string): boolean {
		return (
			content.includes('failureMessage') ||
			content.includes('catch') ||
			content.includes('try {') ||
			content.includes('error')
		);
	}

	/**
	 * Check if error message is actionable
	 */
	private checkActionability(
		message: string,
		stepName: string
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

		const messageLower = message.toLowerCase();

		// Check if message is purely descriptive (no action words)
		const hasActionIndicator = ACTIONABLE_ERROR_INDICATORS.some(indicator => messageLower.includes(indicator));
		const hasVagueIndicator = VAGUE_ERROR_INDICATORS.some(indicator => messageLower.includes(indicator));

		if (!hasActionIndicator && hasVagueIndicator) {
			issues.push({
				severity: 'high',
				issue: 'Error message is not actionable',
				recommendation: 'Rewrite to tell user what action to take. Use verbs like: connect, configure, verify, check, update.',
				context: {
					vagueIndicators: VAGUE_ERROR_INDICATORS.filter(ind => messageLower.includes(ind)),
					suggestedActionWords: ACTIONABLE_ERROR_INDICATORS.slice(0, 5),
				},
			});
		}

		// Check if message is too short to be helpful
		if (message.length < 20) {
			issues.push({
				severity: 'medium',
				issue: `Error message is too short (${message.length} chars)`,
				recommendation: 'Expand to provide context about what went wrong and what to do next.',
				context: {
					currentLength: message.length,
					minRecommended: 20,
				},
			});
		}

		// Check if message is too long/verbose
		if (message.length > 200) {
			issues.push({
				severity: 'low',
				issue: `Error message is very long (${message.length} chars)`,
				recommendation: 'Simplify message. Focus on the immediate action needed. Move details to documentation.',
				context: {
					currentLength: message.length,
					maxRecommended: 200,
				},
			});
		}

		return issues;
	}

	/**
	 * Check for common error message anti-patterns
	 */
	private checkAntiPatterns(
		message: string,
		stepName: string
	): Array<{
		severity: 'medium' | 'low';
		issue: string;
		recommendation: string;
		example?: string;
		context?: Record<string, unknown>;
	}> {
		const issues: Array<{
			severity: 'medium' | 'low';
			issue: string;
			recommendation: string;
			example?: string;
			context?: Record<string, unknown>;
		}> = [];

		for (const antiPattern of ERROR_MESSAGE_ANTI_PATTERNS) {
			if (antiPattern.pattern.test(message)) {
				issues.push({
					severity: 'medium',
					issue: antiPattern.issue,
					recommendation: antiPattern.recommendation,
					example: antiPattern.example,
				});
			}
		}

		// Check for technical jargon without explanation
		const technicalTerms = ['400', '401', '403', '404', '500', 'null', 'undefined', 'timeout', 'exception'];
		const foundTerms = technicalTerms.filter(term => message.toLowerCase().includes(term));

		if (foundTerms.length > 0) {
			issues.push({
				severity: 'low',
				issue: `Error message contains technical jargon: ${foundTerms.join(', ')}`,
				recommendation: 'Translate technical terms to user-friendly language. Explain what the error means in context.',
				context: {
					technicalTerms: foundTerms,
				},
			});
		}

		return issues;
	}

	/**
	 * Check if error message context matches step type
	 */
	private checkContextAppropriate(
		message: string,
		stepName: string,
		stepType?: string
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

		if (!stepType) return issues;

		const messageLower = message.toLowerCase();

		// Check OAuth step has appropriate context
		if (stepType === 'verify_oauth' || stepType === 'oauth') {
			const hasOAuthContext = CONTEXT_PATTERNS.oauth.some(term => messageLower.includes(term));

			if (!hasOAuthContext) {
				issues.push({
					severity: 'medium',
					issue: 'OAuth error message lacks authentication context',
					recommendation: `Mention connecting/authorizing account. Example: "Please connect your [Service] account to continue"`,
					context: {
						stepType,
						suggestedContextWords: CONTEXT_PATTERNS.oauth,
					},
				});
			}
		}

		// Check API step mentions credentials/keys if appropriate
		if (stepType === 'api_call' || stepName.includes('api')) {
			const hasApiContext = CONTEXT_PATTERNS.api_key.some(term => messageLower.includes(term));

			if (!hasApiContext && (messageLower.includes('401') || messageLower.includes('403') || messageLower.includes('auth'))) {
				issues.push({
					severity: 'low',
					issue: 'API authentication error lacks credential context',
					recommendation: 'Guide user to check/update API credentials in settings.',
					context: {
						stepType,
						suggestedContextWords: CONTEXT_PATTERNS.api_key,
					},
				});
			}
		}

		// Check validation step provides format guidance
		if (stepType === 'validate' || stepName.includes('validat')) {
			const hasValidationContext = CONTEXT_PATTERNS.validation.some(term => messageLower.includes(term));

			if (!hasValidationContext) {
				issues.push({
					severity: 'low',
					issue: 'Validation error lacks format guidance',
					recommendation: 'Explain what format is expected or what validation rule failed.',
					context: {
						stepType,
						suggestedContextWords: CONTEXT_PATTERNS.validation,
					},
				});
			}
		}

		return issues;
	}
}

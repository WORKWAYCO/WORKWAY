/**
 * OAuth Provider Coverage Audit
 *
 * Ensure all OAuth providers referenced in workflows exist in platform.
 * Cross-reference with workway-platform OAuth registry.
 * Check OAuth scopes match provider capabilities.
 * Report workflows with non-existent providers.
 *
 * Priority: P1
 * Labels: audit, workflows, oauth
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows, extractIntegrations } from './workflow-loader';

/**
 * Known OAuth providers registered in workway-platform
 *
 * This list should be synced with workway-platform/apps/api/src/integrations/registry.ts
 * In production, this would query the platform API directly.
 */
const REGISTERED_OAUTH_PROVIDERS = [
	'github',
	'linear',
	'slack',
	'discord',
	'notion',
	'google',
	'zoom',
	'airtable',
	'asana',
	'trello',
	'jira',
	'hubspot',
	'salesforce',
	'stripe',
	'shopify',
	'mailchimp',
	'sendgrid',
	'twilio',
	'figma',
	'miro',
];

/**
 * Known scopes for each provider
 * Used to validate that requested scopes are valid for the provider
 */
const PROVIDER_SCOPES: Record<string, string[]> = {
	github: ['repo:read', 'repo:write', 'issues:read', 'issues:write', 'pull_requests:read', 'webhooks', 'user:read', 'user:email'],
	linear: ['issues:read', 'issues:write', 'projects:read', 'projects:write', 'teams:read', 'user:read'],
	slack: ['chat:write', 'chat:read', 'channels:read', 'channels:write', 'users:read', 'team:read', 'files:write'],
	discord: ['bot', 'messages.read', 'messages.write', 'guilds', 'channels.read'],
	notion: ['pages:read', 'pages:write', 'databases:read', 'databases:write', 'users:read', 'comments:read'],
	google: [
		'gmail.readonly',
		'gmail.send',
		'gmail.modify',
		'calendar.readonly',
		'calendar.events',
		'drive.readonly',
		'drive.file',
		'spreadsheets',
		'userinfo.email',
		'userinfo.profile',
	],
	zoom: ['meeting:read', 'meeting:write', 'recording:read', 'user:read', 'webinar:read', 'cloud_recording:read'],
	airtable: ['data.records:read', 'data.records:write', 'schema.bases:read', 'schema.bases:write'],
	asana: ['default', 'tasks:read', 'tasks:write', 'projects:read', 'projects:write', 'workspaces:read'],
	trello: ['read', 'write', 'account'],
	jira: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'manage:jira-webhook'],
	hubspot: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
	salesforce: ['api', 'refresh_token', 'offline_access', 'full'],
	stripe: ['read_only', 'read_write'],
	shopify: ['read_products', 'write_products', 'read_orders', 'write_orders', 'read_customers', 'write_customers'],
	mailchimp: ['campaigns', 'lists', 'automations'],
	sendgrid: ['mail.send', 'templates.read', 'templates.write'],
	twilio: ['messaging', 'voice', 'video'],
	figma: ['file_read', 'file_write', 'file_comments:write'],
	miro: ['boards:read', 'boards:write'],
};

export class OAuthProviderCoverageAuditor implements AuditExecutor {
	name = 'oauth-provider-coverage';
	description = 'Ensure all OAuth providers referenced in workflows exist in platform';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			// Extract integrations configuration
			const integrations = extractIntegrations(workflow.content);

			if (integrations.length === 0) {
				// Some workflows don't use OAuth (e.g., webhook-only or scheduled)
				continue;
			}

			for (const integration of integrations) {
				// Check if provider is registered
				if (!REGISTERED_OAUTH_PROVIDERS.includes(integration.service)) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'high',
						category: 'oauth-provider-coverage',
						issue: `OAuth provider "${integration.service}" is not registered in platform`,
						recommendation: `Register "${integration.service}" in workway-platform OAuth registry or remove from workflow integrations`,
						autoFixable: false,
						priority: severityToPriority('high'),
						labels: ['audit', 'workflows', 'oauth', 'missing-provider'],
						filePath: workflow.metadata.filePath,
						context: {
							provider: integration.service,
							scopes: integration.scopes,
							optional: integration.optional,
							registeredProviders: REGISTERED_OAUTH_PROVIDERS,
						},
					});
				}

				// Check if scopes are valid for this provider
				const invalidScopes = this.checkScopesValid(integration.service, integration.scopes);
				if (invalidScopes.length > 0) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'medium',
						category: 'oauth-provider-coverage',
						issue: `Invalid OAuth scopes for provider "${integration.service}": ${invalidScopes.join(', ')}`,
						recommendation: `Use valid scopes for ${integration.service}. See provider's OAuth documentation.`,
						autoFixable: false,
						priority: severityToPriority('medium'),
						labels: ['audit', 'workflows', 'oauth', 'invalid-scopes'],
						filePath: workflow.metadata.filePath,
						context: {
							provider: integration.service,
							invalidScopes,
							requestedScopes: integration.scopes,
							validScopes: PROVIDER_SCOPES[integration.service] || [],
						},
					});
				}

				// Check for overly broad scopes
				const broadScopes = this.checkScopesTooBroad(integration.service, integration.scopes);
				if (broadScopes.length > 0) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'low',
						category: 'oauth-provider-coverage',
						issue: `Potentially overly broad OAuth scopes: ${broadScopes.join(', ')}`,
						recommendation: 'Review if narrower scopes would suffice. Follow principle of least privilege.',
						autoFixable: false,
						priority: severityToPriority('low'),
						labels: ['audit', 'workflows', 'oauth', 'broad-scopes', 'security'],
						filePath: workflow.metadata.filePath,
						context: {
							provider: integration.service,
							broadScopes,
							allScopes: integration.scopes,
						},
					});
				}

				// Check for missing critical scopes based on workflow usage
				const missingScopes = this.checkMissingCriticalScopes(workflow.content, integration.service, integration.scopes);
				if (missingScopes.length > 0) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'medium',
						category: 'oauth-provider-coverage',
						issue: `Workflow may be missing critical OAuth scopes: ${missingScopes.join(', ')}`,
						recommendation: `Add missing scopes or verify workflow doesn't use these operations`,
						autoFixable: false,
						priority: severityToPriority('medium'),
						labels: ['audit', 'workflows', 'oauth', 'missing-scopes'],
						filePath: workflow.metadata.filePath,
						context: {
							provider: integration.service,
							missingScopes,
							currentScopes: integration.scopes,
						},
					});
				}
			}

			// Check for duplicate providers
			const duplicateProviders = this.findDuplicateProviders(integrations);
			if (duplicateProviders.length > 0) {
				findings.push({
					workflowId: workflow.metadata.id,
					workflowName: workflow.metadata.name,
					severity: 'low',
					category: 'oauth-provider-coverage',
					issue: `Duplicate OAuth provider entries: ${duplicateProviders.join(', ')}`,
					recommendation: 'Consolidate duplicate provider entries into a single integration with combined scopes',
					autoFixable: true,
					priority: severityToPriority('low'),
					labels: ['audit', 'workflows', 'oauth', 'duplicates'],
					filePath: workflow.metadata.filePath,
					context: {
						duplicateProviders,
						integrations,
					},
				});
			}
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Check if requested scopes are valid for the provider
	 */
	private checkScopesValid(provider: string, requestedScopes: string[]): string[] {
		const validScopes = PROVIDER_SCOPES[provider];
		if (!validScopes) {
			// Provider not in our scope registry - can't validate
			return [];
		}

		const invalidScopes: string[] = [];
		for (const scope of requestedScopes) {
			// Check exact match or prefix match (e.g., "gmail." matches "gmail.readonly")
			const isValid = validScopes.some(
				validScope =>
					validScope === scope || scope.startsWith(validScope + '.') || validScope.startsWith(scope + '.') || validScope.includes(scope)
			);

			if (!isValid) {
				invalidScopes.push(scope);
			}
		}

		return invalidScopes;
	}

	/**
	 * Check for overly broad scopes (security risk)
	 */
	private checkScopesTooBroad(provider: string, requestedScopes: string[]): string[] {
		const broadScopePatterns: Record<string, string[]> = {
			github: ['repo:write'], // repo:read is safer if workflow is read-only
			salesforce: ['full'], // Too permissive
			google: ['drive.file'], // Consider drive.readonly if read-only
			slack: ['chat:write'], // Only if actually sending messages
		};

		const providerBroadScopes = broadScopePatterns[provider] || [];
		return requestedScopes.filter(scope => providerBroadScopes.includes(scope));
	}

	/**
	 * Check if workflow code suggests missing scopes
	 */
	private checkMissingCriticalScopes(content: string, provider: string, currentScopes: string[]): string[] {
		const missingScopes: string[] = [];

		// Provider-specific scope detection based on code patterns
		switch (provider) {
			case 'github':
				if (content.includes('createIssue') || content.includes('issues.create')) {
					if (!currentScopes.some(s => s.includes('issues:write'))) {
						missingScopes.push('issues:write');
					}
				}
				if (content.includes('createWebhook') || content.includes('webhook')) {
					if (!currentScopes.some(s => s.includes('webhooks'))) {
						missingScopes.push('webhooks');
					}
				}
				break;

			case 'slack':
				if (content.includes('postMessage') || content.includes('chat.post')) {
					if (!currentScopes.some(s => s.includes('chat:write'))) {
						missingScopes.push('chat:write');
					}
				}
				if (content.includes('channels.list') || content.includes('getChannels')) {
					if (!currentScopes.some(s => s.includes('channels:read'))) {
						missingScopes.push('channels:read');
					}
				}
				break;

			case 'notion':
				if (content.includes('createPage') || content.includes('pages.create')) {
					if (!currentScopes.some(s => s.includes('pages:write'))) {
						missingScopes.push('pages:write');
					}
				}
				if (content.includes('queryDatabase') || content.includes('databases.query')) {
					if (!currentScopes.some(s => s.includes('databases:read'))) {
						missingScopes.push('databases:read');
					}
				}
				break;

			case 'google':
				if (content.includes('sendEmail') || content.includes('gmail.send')) {
					if (!currentScopes.some(s => s.includes('gmail.send'))) {
						missingScopes.push('gmail.send');
					}
				}
				if (content.includes('createEvent') || content.includes('calendar.events')) {
					if (!currentScopes.some(s => s.includes('calendar.events'))) {
						missingScopes.push('calendar.events');
					}
				}
				break;
		}

		return missingScopes;
	}

	/**
	 * Find duplicate provider entries
	 */
	private findDuplicateProviders(integrations: Array<{ service: string; scopes: string[]; optional?: boolean }>): string[] {
		const seen = new Set<string>();
		const duplicates = new Set<string>();

		for (const integration of integrations) {
			if (seen.has(integration.service)) {
				duplicates.add(integration.service);
			} else {
				seen.add(integration.service);
			}
		}

		return Array.from(duplicates);
	}
}

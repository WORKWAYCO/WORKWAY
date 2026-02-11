/**
 * Composio-backed Jira Integration
 *
 * Typed wrapper around ComposioAdapter for Jira project management operations.
 * Standard Integration tier — commodity CRUD backed by Composio.
 *
 * When to use this vs building a custom Jira integration:
 * - Use ComposioJira for basic operations (create/read issues, transitions)
 * - Build custom for deep workflows (sprint planning, custom field logic,
 *   JQL-heavy queries, webhook automation, etc.)
 *
 * @example
 * ```typescript
 * import { ComposioJira } from '@workwayco/integrations/composio';
 *
 * const jira = new ComposioJira({
 *   composioApiKey: env.COMPOSIO_API_KEY,
 *   connectedAccountId: 'user_jira_account_id',
 * });
 *
 * const result = await jira.createIssue({
 *   projectKey: 'PROJ',
 *   summary: 'Bug: Login button unresponsive',
 *   issueType: 'Bug',
 * });
 * ```
 */

import type { ActionResult } from '@workwayco/sdk';
import { ComposioAdapter, type ComposioAdapterConfig } from './adapter.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ComposioJiraIssue {
	id: string;
	key: string;
	self?: string;
	fields?: {
		summary?: string;
		description?: string;
		status?: { name: string; id: string };
		assignee?: { displayName: string; emailAddress?: string };
		reporter?: { displayName: string; emailAddress?: string };
		priority?: { name: string; id: string };
		issuetype?: { name: string; id: string };
		project?: { key: string; name: string };
		created?: string;
		updated?: string;
		[key: string]: unknown;
	};
}

export interface ComposioJiraProject {
	id: string;
	key: string;
	name: string;
	projectTypeKey?: string;
}

export interface CreateJiraIssueOptions {
	projectKey: string;
	summary: string;
	issueType?: string;
	description?: string;
	assignee?: string;
	priority?: string;
	labels?: string[];
}

export interface ComposioJiraConfig {
	composioApiKey: string;
	connectedAccountId?: string;
	entityId?: string;
	apiUrl?: string;
	timeout?: number;
}

// ============================================================================
// COMPOSIO JIRA
// ============================================================================

export class ComposioJira extends ComposioAdapter {
	constructor(config: ComposioJiraConfig) {
		super({
			...config,
			appName: 'jira',
		});
	}

	/**
	 * Create a new Jira issue
	 */
	async createIssue(
		options: CreateJiraIssueOptions
	): Promise<ActionResult<ComposioJiraIssue>> {
		return this.executeAction<ComposioJiraIssue>('JIRA_CREATE_ISSUE', {
			project_key: options.projectKey,
			summary: options.summary,
			issue_type: options.issueType || 'Task',
			description: options.description,
			assignee: options.assignee,
			priority: options.priority,
			labels: options.labels?.join(','),
		});
	}

	/**
	 * Get a Jira issue by key
	 */
	async getIssue(
		issueKey: string
	): Promise<ActionResult<ComposioJiraIssue>> {
		return this.executeAction<ComposioJiraIssue>('JIRA_GET_ISSUE', {
			issue_key: issueKey,
		});
	}

	/**
	 * Search issues using JQL
	 */
	async searchIssues(
		jql: string,
		options: { maxResults?: number } = {}
	): Promise<ActionResult<ComposioJiraIssue[]>> {
		return this.executeAction<ComposioJiraIssue[]>('JIRA_SEARCH_ISSUES', {
			jql,
			max_results: options.maxResults || 20,
		});
	}

	/**
	 * Update an issue
	 */
	async updateIssue(
		issueKey: string,
		updates: Partial<{
			summary: string;
			description: string;
			assignee: string;
			priority: string;
			labels: string[];
		}>
	): Promise<ActionResult<ComposioJiraIssue>> {
		return this.executeAction<ComposioJiraIssue>('JIRA_UPDATE_ISSUE', {
			issue_key: issueKey,
			...updates,
		});
	}

	/**
	 * Transition an issue (change status)
	 */
	async transitionIssue(
		issueKey: string,
		transitionId: string
	): Promise<ActionResult<{ success: boolean }>> {
		return this.executeAction<{ success: boolean }>('JIRA_TRANSITION_ISSUE', {
			issue_key: issueKey,
			transition_id: transitionId,
		});
	}

	/**
	 * Add a comment to an issue
	 */
	async addComment(
		issueKey: string,
		comment: string
	): Promise<ActionResult<{ id: string }>> {
		return this.executeAction<{ id: string }>('JIRA_ADD_COMMENT', {
			issue_key: issueKey,
			comment,
		});
	}

	/**
	 * List projects
	 */
	async listProjects(
		options: { maxResults?: number } = {}
	): Promise<ActionResult<ComposioJiraProject[]>> {
		return this.executeAction<ComposioJiraProject[]>('JIRA_LIST_PROJECTS', {
			max_results: options.maxResults || 50,
		});
	}
}

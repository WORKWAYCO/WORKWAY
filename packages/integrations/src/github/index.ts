/**
 * GitHub Integration for WORKWAY
 *
 * REST API integration for GitHub repositories, issues, and pull requests.
 * Zuhandenheit: Developer thinks "create issue" not "POST to /repos/:owner/:repo/issues"
 *
 * @example
 * ```typescript
 * import { GitHub } from '@workwayco/integrations/github';
 *
 * const github = new GitHub({ accessToken: tokens.github.access_token });
 *
 * // Create an issue
 * const issue = await github.issues.create({
 *   owner: 'workwayco',
 *   repo: 'workway',
 *   title: 'Bug: Login not working',
 *   body: 'Users cannot login with SSO',
 *   labels: ['bug', 'priority:high']
 * });
 *
 * // List pull requests
 * const prs = await github.pulls.list({
 *   owner: 'workwayco',
 *   repo: 'workway',
 *   state: 'open'
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type StandardTask,
	type StandardList,
} from '@workwayco/sdk';
import { BaseAPIClient, buildQueryString, type BaseClientConfig } from '../core/base-client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GitHubUser {
	id: number;
	login: string;
	avatar_url: string;
	html_url: string;
	type: 'User' | 'Organization' | 'Bot';
}

export interface GitHubLabel {
	id: number;
	name: string;
	color: string;
	description?: string;
}

export interface GitHubMilestone {
	id: number;
	number: number;
	title: string;
	description?: string;
	state: 'open' | 'closed';
	due_on?: string;
}

export interface GitHubIssue {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: 'open' | 'closed';
	state_reason?: 'completed' | 'not_planned' | 'reopened' | null;
	html_url: string;
	created_at: string;
	updated_at: string;
	closed_at?: string;
	user: GitHubUser;
	assignee?: GitHubUser;
	assignees: GitHubUser[];
	labels: GitHubLabel[];
	milestone?: GitHubMilestone;
	comments: number;
	locked: boolean;
	repository_url: string;
}

export interface GitHubPullRequest {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: 'open' | 'closed';
	html_url: string;
	diff_url: string;
	patch_url: string;
	created_at: string;
	updated_at: string;
	closed_at?: string;
	merged_at?: string;
	user: GitHubUser;
	assignee?: GitHubUser;
	assignees: GitHubUser[];
	labels: GitHubLabel[];
	milestone?: GitHubMilestone;
	head: {
		ref: string;
		sha: string;
		repo: GitHubRepository;
	};
	base: {
		ref: string;
		sha: string;
		repo: GitHubRepository;
	};
	draft: boolean;
	merged: boolean;
	mergeable?: boolean;
	mergeable_state?: string;
	comments: number;
	review_comments: number;
	commits: number;
	additions: number;
	deletions: number;
	changed_files: number;
}

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	description?: string;
	html_url: string;
	clone_url: string;
	ssh_url: string;
	private: boolean;
	fork: boolean;
	archived: boolean;
	disabled: boolean;
	owner: GitHubUser;
	default_branch: string;
	created_at: string;
	updated_at: string;
	pushed_at: string;
	language?: string;
	stargazers_count: number;
	watchers_count: number;
	forks_count: number;
	open_issues_count: number;
	topics: string[];
}

export interface GitHubComment {
	id: number;
	body: string;
	html_url: string;
	created_at: string;
	updated_at: string;
	user: GitHubUser;
}

export interface GitHubReview {
	id: number;
	user: GitHubUser;
	body?: string;
	state: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
	html_url: string;
	submitted_at: string;
}

export interface GitHubCommit {
	sha: string;
	message: string;
	html_url: string;
	author: {
		name: string;
		email: string;
		date: string;
	};
	committer: {
		name: string;
		email: string;
		date: string;
	};
}

// ============================================================================
// CLIENT CONFIG
// ============================================================================

export interface GitHubConfig {
	/** OAuth access token or Personal Access Token */
	accessToken: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
}

// ============================================================================
// GITHUB CLIENT
// ============================================================================

/**
 * GitHub REST API client
 *
 * Zuhandenheit principles:
 * - Namespace-based API (issues, pulls, repos)
 * - Consistent ActionResult pattern
 * - Label names, not IDs
 */
export class GitHub extends BaseAPIClient {
	constructor(config: GitHubConfig) {
		super({
			accessToken: config.accessToken,
			apiUrl: 'https://api.github.com',
			timeout: config.timeout,
			errorContext: { integration: 'github' },
		});
	}

	/**
	 * Override request to add GitHub-specific headers
	 */
	protected override async request(
		path: string,
		options: RequestInit = {},
		additionalHeaders: Record<string, string> = {},
		isRetry = false
	): Promise<Response> {
		return super.request(path, options, {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...additionalHeaders,
		}, isRetry);
	}

	// ============================================================================
	// ISSUES
	// ============================================================================

	issues = {
		/**
		 * Create an issue
		 */
		create: async (options: {
			owner: string;
			repo: string;
			title: string;
			body?: string;
			assignees?: string[];
			labels?: string[];
			milestone?: number;
		}): Promise<ActionResult<GitHubIssue>> => {
			try {
				const issue = await this.postJson<GitHubIssue>(
					`/repos/${options.owner}/${options.repo}/issues`,
					{
						title: options.title,
						body: options.body,
						assignees: options.assignees,
						labels: options.labels,
						milestone: options.milestone,
					}
				);
				return createActionResult({ success: true, data: issue });
			} catch (error) {
				return this.handleError(error, 'issues.create');
			}
		},

		/**
		 * Update an issue
		 */
		update: async (options: {
			owner: string;
			repo: string;
			issue_number: number;
			title?: string;
			body?: string;
			state?: 'open' | 'closed';
			state_reason?: 'completed' | 'not_planned' | 'reopened';
			assignees?: string[];
			labels?: string[];
			milestone?: number | null;
		}): Promise<ActionResult<GitHubIssue>> => {
			try {
				const issue = await this.patchJson<GitHubIssue>(
					`/repos/${options.owner}/${options.repo}/issues/${options.issue_number}`,
					{
						title: options.title,
						body: options.body,
						state: options.state,
						state_reason: options.state_reason,
						assignees: options.assignees,
						labels: options.labels,
						milestone: options.milestone,
					}
				);
				return createActionResult({ success: true, data: issue });
			} catch (error) {
				return this.handleError(error, 'issues.update');
			}
		},

		/**
		 * Get an issue
		 */
		get: async (options: {
			owner: string;
			repo: string;
			issue_number: number;
		}): Promise<ActionResult<GitHubIssue>> => {
			try {
				const issue = await this.getJson<GitHubIssue>(
					`/repos/${options.owner}/${options.repo}/issues/${options.issue_number}`
				);
				return createActionResult({ success: true, data: issue });
			} catch (error) {
				return this.handleError(error, 'issues.get');
			}
		},

		/**
		 * List issues
		 */
		list: async (options: {
			owner: string;
			repo: string;
			state?: 'open' | 'closed' | 'all';
			labels?: string;
			assignee?: string;
			creator?: string;
			sort?: 'created' | 'updated' | 'comments';
			direction?: 'asc' | 'desc';
			per_page?: number;
			page?: number;
		}): Promise<ActionResult<StandardList<GitHubIssue>>> => {
			try {
				const query = buildQueryString({
					state: options.state || 'open',
					labels: options.labels,
					assignee: options.assignee,
					creator: options.creator,
					sort: options.sort,
					direction: options.direction,
					per_page: options.per_page || 30,
					page: options.page || 1,
				});

				const issues = await this.getJson<GitHubIssue[]>(
					`/repos/${options.owner}/${options.repo}/issues${query}`
				);

				// Filter out pull requests (GitHub API returns PRs as issues)
				const actualIssues = issues.filter((i) => !('pull_request' in i));

				return createActionResult({
					success: true,
					data: {
						items: actualIssues,
						hasMore: issues.length === (options.per_page || 30),
					},
				});
			} catch (error) {
				return this.handleError(error, 'issues.list');
			}
		},

		/**
		 * Add a comment to an issue
		 */
		comment: async (options: {
			owner: string;
			repo: string;
			issue_number: number;
			body: string;
		}): Promise<ActionResult<GitHubComment>> => {
			try {
				const comment = await this.postJson<GitHubComment>(
					`/repos/${options.owner}/${options.repo}/issues/${options.issue_number}/comments`,
					{ body: options.body }
				);
				return createActionResult({ success: true, data: comment });
			} catch (error) {
				return this.handleError(error, 'issues.comment');
			}
		},

		/**
		 * Add labels to an issue
		 */
		addLabels: async (options: {
			owner: string;
			repo: string;
			issue_number: number;
			labels: string[];
		}): Promise<ActionResult<GitHubLabel[]>> => {
			try {
				const labels = await this.postJson<GitHubLabel[]>(
					`/repos/${options.owner}/${options.repo}/issues/${options.issue_number}/labels`,
					{ labels: options.labels }
				);
				return createActionResult({ success: true, data: labels });
			} catch (error) {
				return this.handleError(error, 'issues.addLabels');
			}
		},
	};

	// ============================================================================
	// PULL REQUESTS
	// ============================================================================

	pulls = {
		/**
		 * Create a pull request
		 */
		create: async (options: {
			owner: string;
			repo: string;
			title: string;
			body?: string;
			head: string;
			base: string;
			draft?: boolean;
		}): Promise<ActionResult<GitHubPullRequest>> => {
			try {
				const pr = await this.postJson<GitHubPullRequest>(
					`/repos/${options.owner}/${options.repo}/pulls`,
					{
						title: options.title,
						body: options.body,
						head: options.head,
						base: options.base,
						draft: options.draft,
					}
				);
				return createActionResult({ success: true, data: pr });
			} catch (error) {
				return this.handleError(error, 'pulls.create');
			}
		},

		/**
		 * Get a pull request
		 */
		get: async (options: {
			owner: string;
			repo: string;
			pull_number: number;
		}): Promise<ActionResult<GitHubPullRequest>> => {
			try {
				const pr = await this.getJson<GitHubPullRequest>(
					`/repos/${options.owner}/${options.repo}/pulls/${options.pull_number}`
				);
				return createActionResult({ success: true, data: pr });
			} catch (error) {
				return this.handleError(error, 'pulls.get');
			}
		},

		/**
		 * List pull requests
		 */
		list: async (options: {
			owner: string;
			repo: string;
			state?: 'open' | 'closed' | 'all';
			head?: string;
			base?: string;
			sort?: 'created' | 'updated' | 'popularity' | 'long-running';
			direction?: 'asc' | 'desc';
			per_page?: number;
			page?: number;
		}): Promise<ActionResult<StandardList<GitHubPullRequest>>> => {
			try {
				const query = buildQueryString({
					state: options.state || 'open',
					head: options.head,
					base: options.base,
					sort: options.sort,
					direction: options.direction,
					per_page: options.per_page || 30,
					page: options.page || 1,
				});

				const prs = await this.getJson<GitHubPullRequest[]>(
					`/repos/${options.owner}/${options.repo}/pulls${query}`
				);

				return createActionResult({
					success: true,
					data: {
						items: prs,
						hasMore: prs.length === (options.per_page || 30),
					},
				});
			} catch (error) {
				return this.handleError(error, 'pulls.list');
			}
		},

		/**
		 * List reviews on a pull request
		 */
		listReviews: async (options: {
			owner: string;
			repo: string;
			pull_number: number;
		}): Promise<ActionResult<GitHubReview[]>> => {
			try {
				const reviews = await this.getJson<GitHubReview[]>(
					`/repos/${options.owner}/${options.repo}/pulls/${options.pull_number}/reviews`
				);
				return createActionResult({ success: true, data: reviews });
			} catch (error) {
				return this.handleError(error, 'pulls.listReviews');
			}
		},

		/**
		 * Request reviewers for a pull request
		 */
		requestReviewers: async (options: {
			owner: string;
			repo: string;
			pull_number: number;
			reviewers?: string[];
			team_reviewers?: string[];
		}): Promise<ActionResult<GitHubPullRequest>> => {
			try {
				const pr = await this.postJson<GitHubPullRequest>(
					`/repos/${options.owner}/${options.repo}/pulls/${options.pull_number}/requested_reviewers`,
					{
						reviewers: options.reviewers,
						team_reviewers: options.team_reviewers,
					}
				);
				return createActionResult({ success: true, data: pr });
			} catch (error) {
				return this.handleError(error, 'pulls.requestReviewers');
			}
		},

		/**
		 * Merge a pull request
		 */
		merge: async (options: {
			owner: string;
			repo: string;
			pull_number: number;
			commit_title?: string;
			commit_message?: string;
			merge_method?: 'merge' | 'squash' | 'rebase';
		}): Promise<ActionResult<{ sha: string; merged: boolean; message: string }>> => {
			try {
				const result = await this.putJson<{ sha: string; merged: boolean; message: string }>(
					`/repos/${options.owner}/${options.repo}/pulls/${options.pull_number}/merge`,
					{
						commit_title: options.commit_title,
						commit_message: options.commit_message,
						merge_method: options.merge_method || 'merge',
					}
				);
				return createActionResult({ success: true, data: result });
			} catch (error) {
				return this.handleError(error, 'pulls.merge');
			}
		},
	};

	// ============================================================================
	// REPOSITORIES
	// ============================================================================

	repos = {
		/**
		 * Get a repository
		 */
		get: async (options: {
			owner: string;
			repo: string;
		}): Promise<ActionResult<GitHubRepository>> => {
			try {
				const repo = await this.getJson<GitHubRepository>(
					`/repos/${options.owner}/${options.repo}`
				);
				return createActionResult({ success: true, data: repo });
			} catch (error) {
				return this.handleError(error, 'repos.get');
			}
		},

		/**
		 * List user repositories
		 */
		list: async (options: {
			type?: 'all' | 'owner' | 'public' | 'private' | 'member';
			sort?: 'created' | 'updated' | 'pushed' | 'full_name';
			direction?: 'asc' | 'desc';
			per_page?: number;
			page?: number;
		} = {}): Promise<ActionResult<StandardList<GitHubRepository>>> => {
			try {
				const query = buildQueryString({
					type: options.type || 'all',
					sort: options.sort,
					direction: options.direction,
					per_page: options.per_page || 30,
					page: options.page || 1,
				});

				const repos = await this.getJson<GitHubRepository[]>(`/user/repos${query}`);

				return createActionResult({
					success: true,
					data: {
						items: repos,
						hasMore: repos.length === (options.per_page || 30),
					},
				});
			} catch (error) {
				return this.handleError(error, 'repos.list');
			}
		},

		/**
		 * List commits
		 */
		listCommits: async (options: {
			owner: string;
			repo: string;
			sha?: string;
			path?: string;
			author?: string;
			since?: string;
			until?: string;
			per_page?: number;
			page?: number;
		}): Promise<ActionResult<StandardList<{ sha: string; commit: GitHubCommit; author: GitHubUser | null }>>> => {
			try {
				const query = buildQueryString({
					sha: options.sha,
					path: options.path,
					author: options.author,
					since: options.since,
					until: options.until,
					per_page: options.per_page || 30,
					page: options.page || 1,
				});

				const commits = await this.getJson<Array<{ sha: string; commit: GitHubCommit; author: GitHubUser | null }>>(
					`/repos/${options.owner}/${options.repo}/commits${query}`
				);

				return createActionResult({
					success: true,
					data: {
						items: commits,
						hasMore: commits.length === (options.per_page || 30),
					},
				});
			} catch (error) {
				return this.handleError(error, 'repos.listCommits');
			}
		},
	};

	// ============================================================================
	// USER
	// ============================================================================

	user = {
		/**
		 * Get the authenticated user
		 */
		me: async (): Promise<ActionResult<GitHubUser>> => {
			try {
				const user = await this.getJson<GitHubUser>('/user');
				return createActionResult({ success: true, data: user });
			} catch (error) {
				return this.handleError(error, 'user.me');
			}
		},
	};

	// ============================================================================
	// ERROR HANDLING
	// ============================================================================

	private handleError(error: unknown, operation: string): ActionResult<any> {
		if (error instanceof IntegrationError) {
			return createActionResult({
				success: false,
				error: {
					message: error.message,
					code: error.code,
				},
			});
		}

		return createActionResult({
			success: false,
			error: {
				message: error instanceof Error ? error.message : `GitHub ${operation} failed`,
				code: ErrorCode.EXTERNAL_SERVICE_ERROR,
			},
		});
	}
}

// ============================================================================
// STANDARD DATA CONVERSION
// ============================================================================

/**
 * Convert GitHub issue to StandardTask
 */
export function toStandardTask(issue: GitHubIssue): StandardTask {
	// Derive priority from labels (convention: priority:high, priority:low, etc.)
	let priority: 'urgent' | 'high' | 'medium' | 'low' | undefined;
	for (const label of issue.labels) {
		const name = label.name.toLowerCase();
		if (name.includes('urgent') || name.includes('critical')) {
			priority = 'urgent';
			break;
		} else if (name.includes('high') || name.includes('p1')) {
			priority = 'high';
		} else if (name.includes('medium') || name.includes('p2')) {
			priority = priority || 'medium';
		} else if (name.includes('low') || name.includes('p3')) {
			priority = priority || 'low';
		}
	}

	return {
		type: 'task' as const,
		id: String(issue.id),
		title: issue.title,
		description: issue.body,
		status: issue.state === 'closed' ? 'done' : 'todo',
		priority,
		assignee: issue.assignee?.login,
		labels: issue.labels.map((l) => l.name),
		timestamp: Date.now(),
		metadata: {
			number: issue.number,
			url: issue.html_url,
			comments: issue.comments,
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			closedAt: issue.closed_at,
		},
	};
}

export default GitHub;

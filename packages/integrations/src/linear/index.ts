/**
 * Linear Integration for WORKWAY
 *
 * GraphQL-based integration for Linear project management.
 * Zuhandenheit: Developer thinks "create task" not "GraphQL mutation with teamId lookup"
 *
 * @example
 * ```typescript
 * import { Linear } from '@workwayco/integrations/linear';
 *
 * const linear = new Linear({ accessToken: tokens.linear.access_token });
 *
 * // Create an issue (Zuhandenheit: assignee by name, not ID)
 * const issue = await linear.createIssue({
 *   teamId: 'TEAM-123',
 *   title: 'Fix login bug',
 *   description: 'Users cannot login with SSO',
 *   assigneeByName: 'john',
 *   labels: ['bug', 'urgent']
 * });
 *
 * // List issues
 * const issues = await linear.listIssues({ teamId: 'TEAM-123', limit: 20 });
 *
 * // Get current user
 * const me = await linear.getViewer();
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	type StandardTask,
	type StandardList,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	validateAccessToken,
	createErrorHandler,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Linear issue object
 */
export interface LinearIssue {
	id: string;
	identifier: string; // e.g., "ENG-123"
	title: string;
	description?: string;
	priority: number; // 0-4, 0 = no priority, 1 = urgent, 4 = low
	estimate?: number;
	url: string;
	createdAt: string;
	updatedAt: string;
	archivedAt?: string;
	state: {
		id: string;
		name: string;
		type: string; // backlog, unstarted, started, completed, canceled
	};
	team: {
		id: string;
		name: string;
		key: string;
	};
	assignee?: {
		id: string;
		name: string;
		email: string;
	};
	creator?: {
		id: string;
		name: string;
		email: string;
	};
	labels: {
		nodes: Array<{
			id: string;
			name: string;
			color: string;
		}>;
	};
	project?: {
		id: string;
		name: string;
	};
	cycle?: {
		id: string;
		name: string;
		number: number;
	};
	parent?: {
		id: string;
		identifier: string;
		title: string;
	};
	children?: {
		nodes: Array<{
			id: string;
			identifier: string;
			title: string;
		}>;
	};
	comments?: {
		nodes: Array<{
			id: string;
			body: string;
			createdAt: string;
			user: {
				id: string;
				name: string;
			};
		}>;
	};
}

/**
 * Linear team object
 */
export interface LinearTeam {
	id: string;
	name: string;
	key: string;
	description?: string;
	icon?: string;
	color?: string;
	private: boolean;
	states: {
		nodes: Array<{
			id: string;
			name: string;
			type: string;
			position: number;
		}>;
	};
	labels: {
		nodes: Array<{
			id: string;
			name: string;
			color: string;
		}>;
	};
}

/**
 * Linear user object
 */
export interface LinearUser {
	id: string;
	name: string;
	displayName: string;
	email: string;
	avatarUrl?: string;
	active: boolean;
	admin: boolean;
	createdAt: string;
}

/**
 * Linear project object
 */
export interface LinearProject {
	id: string;
	name: string;
	description?: string;
	icon?: string;
	color?: string;
	state: string;
	progress: number;
	targetDate?: string;
	startedAt?: string;
	completedAt?: string;
	url: string;
}

/**
 * Linear comment object
 */
export interface LinearComment {
	id: string;
	body: string;
	createdAt: string;
	updatedAt: string;
	user: {
		id: string;
		name: string;
		email: string;
	};
	issue: {
		id: string;
		identifier: string;
	};
}

// ============================================================================
// GRAPHQL FRAGMENTS
// ============================================================================

const ISSUE_FRAGMENT = `
	id
	identifier
	title
	description
	priority
	estimate
	url
	createdAt
	updatedAt
	archivedAt
	state {
		id
		name
		type
	}
	team {
		id
		name
		key
	}
	assignee {
		id
		name
		email
	}
	creator {
		id
		name
		email
	}
	labels {
		nodes {
			id
			name
			color
		}
	}
	project {
		id
		name
	}
	cycle {
		id
		name
		number
	}
	parent {
		id
		identifier
		title
	}
`;

const TEAM_FRAGMENT = `
	id
	name
	key
	description
	icon
	color
	private
	states {
		nodes {
			id
			name
			type
			position
		}
	}
	labels {
		nodes {
			id
			name
			color
		}
	}
`;

const USER_FRAGMENT = `
	id
	name
	displayName
	email
	avatarUrl
	active
	admin
	createdAt
`;

// ============================================================================
// CLIENT CONFIG
// ============================================================================

export interface LinearConfig {
	/** OAuth access token or API key */
	accessToken: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
}

// ============================================================================
// LINEAR CLIENT
// ============================================================================

/**
 * Linear GraphQL API client
 *
 * Zuhandenheit principles:
 * - `assigneeByName` resolves user IDs automatically
 * - `labels` accepts names, not IDs
 * - Consistent ActionResult pattern across all methods
 */
export class Linear {
	private readonly accessToken: string;
	private readonly apiUrl = 'https://api.linear.app/graphql';
	private readonly timeout: number;

	// Cache for user/team lookups
	private userCache: Map<string, LinearUser> = new Map();
	private teamCache: Map<string, LinearTeam> = new Map();

	constructor(config: LinearConfig) {
		validateAccessToken(config.accessToken, 'Linear');
		this.accessToken = config.accessToken;
		this.timeout = config.timeout ?? 30000;
	}

	// ============================================================================
	// GRAPHQL HELPERS
	// ============================================================================

	/**
	 * Execute a GraphQL query/mutation
	 */
	private async graphql<T>(
		query: string,
		variables?: Record<string, unknown>
	): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': this.accessToken, // Linear accepts token directly
				},
				body: JSON.stringify({ query, variables }),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
			}

			return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Execute GraphQL and return ActionResult
	 */
	private async execute<T>(
		query: string,
		variables?: Record<string, unknown>,
		extractData?: (result: any) => T
	): Promise<ActionResult<T>> {
		try {
			const result = await this.graphql<any>(query, variables);

			if (result.errors?.length) {
				return createActionResult({
					success: false,
					error: {
						message: result.errors[0].message,
						code: ErrorCode.EXTERNAL_SERVICE_ERROR,
					},
				});
			}

			const data = extractData ? extractData(result.data) : result.data;
			return createActionResult({ success: true, data });
		} catch (error) {
			return createErrorHandler('Linear')(error as Error, 'execute');
		}
	}

	// ============================================================================
	// ISSUES (Zuhandenheit API)
	// ============================================================================

	/**
	 * Create an issue
	 *
	 * Zuhandenheit: Developer thinks "assign to john" not "lookup john's user ID"
	 *
	 * @example
	 * ```typescript
	 * const issue = await linear.createIssue({
	 *   teamId: 'TEAM-123',
	 *   title: 'Fix login bug',
	 *   assigneeByName: 'john',
	 *   labels: ['bug', 'urgent']
	 * });
	 * ```
	 */
	async createIssue(options: {
		teamId: string;
		title: string;
		description?: string;
		priority?: 0 | 1 | 2 | 3 | 4; // 0=none, 1=urgent, 2=high, 3=medium, 4=low
		estimate?: number;
		assigneeId?: string;
		assigneeByName?: string; // Zuhandenheit: resolve by name
		stateId?: string;
		projectId?: string;
		cycleId?: string;
		parentId?: string;
		labelIds?: string[];
		labels?: string[]; // Zuhandenheit: resolve by name
	}): Promise<ActionResult<LinearIssue>> {
		// Resolve assignee by name if provided
		let assigneeId = options.assigneeId;
		if (options.assigneeByName && !assigneeId) {
			const user = await this.findUserByName(options.assigneeByName);
			if (user) {
				assigneeId = user.id;
			}
		}

		// Resolve labels by name if provided
		let labelIds = options.labelIds || [];
		if (options.labels?.length && !labelIds.length) {
			const team = await this.getTeamById(options.teamId);
			if (team.data) {
				const teamLabels = team.data.labels.nodes;
				for (const labelName of options.labels) {
					const label = teamLabels.find(
						(l) => l.name.toLowerCase() === labelName.toLowerCase()
					);
					if (label) {
						labelIds.push(label.id);
					}
				}
			}
		}

		const mutation = `
			mutation IssueCreate($input: IssueCreateInput!) {
				issueCreate(input: $input) {
					success
					issue {
						${ISSUE_FRAGMENT}
					}
				}
			}
		`;

		const input: Record<string, unknown> = {
			teamId: options.teamId,
			title: options.title,
		};

		if (options.description) input.description = options.description;
		if (options.priority !== undefined) input.priority = options.priority;
		if (options.estimate !== undefined) input.estimate = options.estimate;
		if (assigneeId) input.assigneeId = assigneeId;
		if (options.stateId) input.stateId = options.stateId;
		if (options.projectId) input.projectId = options.projectId;
		if (options.cycleId) input.cycleId = options.cycleId;
		if (options.parentId) input.parentId = options.parentId;
		if (labelIds.length) input.labelIds = labelIds;

		return this.execute<LinearIssue>(
			mutation,
			{ input },
			(data) => data.issueCreate.issue
		);
	}

	/**
	 * Update an issue
	 */
	async updateIssue(options: {
		issueId: string;
		title?: string;
		description?: string;
		priority?: 0 | 1 | 2 | 3 | 4;
		estimate?: number;
		assigneeId?: string;
		assigneeByName?: string;
		stateId?: string;
		projectId?: string;
		cycleId?: string;
		parentId?: string;
		labelIds?: string[];
	}): Promise<ActionResult<LinearIssue>> {
		// Resolve assignee by name if provided
		let assigneeId = options.assigneeId;
		if (options.assigneeByName && !assigneeId) {
			const user = await this.findUserByName(options.assigneeByName);
			if (user) {
				assigneeId = user.id;
			}
		}

		const mutation = `
			mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
				issueUpdate(id: $id, input: $input) {
					success
					issue {
						${ISSUE_FRAGMENT}
					}
				}
			}
		`;

		const input: Record<string, unknown> = {};
		if (options.title) input.title = options.title;
		if (options.description !== undefined) input.description = options.description;
		if (options.priority !== undefined) input.priority = options.priority;
		if (options.estimate !== undefined) input.estimate = options.estimate;
		if (assigneeId) input.assigneeId = assigneeId;
		if (options.stateId) input.stateId = options.stateId;
		if (options.projectId) input.projectId = options.projectId;
		if (options.cycleId) input.cycleId = options.cycleId;
		if (options.parentId) input.parentId = options.parentId;
		if (options.labelIds) input.labelIds = options.labelIds;

		return this.execute<LinearIssue>(
			mutation,
			{ id: options.issueId, input },
			(data) => data.issueUpdate.issue
		);
	}

	/**
	 * Get an issue by ID or identifier (e.g., "ENG-123")
	 */
	async getIssue(issueId: string): Promise<ActionResult<LinearIssue>> {
		const query = `
			query Issue($id: String!) {
				issue(id: $id) {
					${ISSUE_FRAGMENT}
					children {
						nodes {
							id
							identifier
							title
						}
					}
					comments {
						nodes {
							id
							body
							createdAt
							user {
								id
								name
							}
						}
					}
				}
			}
		`;

		return this.execute<LinearIssue>(query, { id: issueId }, (data) => data.issue);
	}

	/**
	 * List issues with filtering
	 */
	async listIssues(options: {
		teamId?: string;
		projectId?: string;
		assigneeId?: string;
		stateType?: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
		first?: number;
		after?: string;
	} = {}): Promise<ActionResult<StandardList<LinearIssue>>> {
		const query = `
			query Issues($filter: IssueFilter, $first: Int, $after: String) {
				issues(filter: $filter, first: $first, after: $after) {
					nodes {
						${ISSUE_FRAGMENT}
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		`;

		const filter: Record<string, unknown> = {};
		if (options.teamId) filter.team = { id: { eq: options.teamId } };
		if (options.projectId) filter.project = { id: { eq: options.projectId } };
		if (options.assigneeId) filter.assignee = { id: { eq: options.assigneeId } };
		if (options.stateType) filter.state = { type: { eq: options.stateType } };

		return this.execute<StandardList<LinearIssue>>(
			query,
			{
				filter: Object.keys(filter).length ? filter : undefined,
				first: options.first || 50,
				after: options.after,
			},
			(data) => ({
				items: data.issues.nodes,
				hasMore: data.issues.pageInfo.hasNextPage,
				cursor: data.issues.pageInfo.endCursor,
			})
		);
	}

	/**
	 * Archive an issue (soft delete)
	 */
	async archiveIssue(issueId: string): Promise<ActionResult<{ success: boolean }>> {
		const mutation = `
			mutation IssueArchive($id: String!) {
				issueArchive(id: $id) {
					success
				}
			}
		`;

		return this.execute(mutation, { id: issueId }, (data) => ({
			success: data.issueArchive.success,
		}));
	}

	// ============================================================================
	// COMMENTS
	// ============================================================================

	/**
	 * Add a comment to an issue
	 */
	async createComment(options: {
		issueId: string;
		body: string;
	}): Promise<ActionResult<LinearComment>> {
		const mutation = `
			mutation CommentCreate($input: CommentCreateInput!) {
				commentCreate(input: $input) {
					success
					comment {
						id
						body
						createdAt
						updatedAt
						user {
							id
							name
							email
						}
						issue {
							id
							identifier
						}
					}
				}
			}
		`;

		return this.execute<LinearComment>(
			mutation,
			{ input: { issueId: options.issueId, body: options.body } },
			(data) => data.commentCreate.comment
		);
	}

	// ============================================================================
	// TEAMS
	// ============================================================================

	/**
	 * List teams
	 */
	async listTeams(options: {
		first?: number;
	} = {}): Promise<ActionResult<StandardList<LinearTeam>>> {
		const query = `
			query Teams($first: Int) {
				teams(first: $first) {
					nodes {
						${TEAM_FRAGMENT}
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		`;

		return this.execute<StandardList<LinearTeam>>(
			query,
			{ first: options.first || 50 },
			(data) => ({
				items: data.teams.nodes,
				hasMore: data.teams.pageInfo.hasNextPage,
				cursor: data.teams.pageInfo.endCursor,
			})
		);
	}

	/**
	 * Get a team by ID
	 */
	async getTeamById(teamId: string): Promise<ActionResult<LinearTeam>> {
		// Check cache first
		if (this.teamCache.has(teamId)) {
			return createActionResult({ success: true, data: this.teamCache.get(teamId)! });
		}

		const query = `
			query Team($id: String!) {
				team(id: $id) {
					${TEAM_FRAGMENT}
				}
			}
		`;

		const result = await this.execute<LinearTeam>(query, { id: teamId }, (data) => data.team);

		if (result.success && result.data) {
			this.teamCache.set(teamId, result.data);
		}

		return result;
	}

	// ============================================================================
	// USERS
	// ============================================================================

	/**
	 * Get the current authenticated user
	 */
	async getViewer(): Promise<ActionResult<LinearUser>> {
		const query = `
			query Viewer {
				viewer {
					${USER_FRAGMENT}
				}
			}
		`;

		return this.execute<LinearUser>(query, undefined, (data) => data.viewer);
	}

	/**
	 * List users in the organization
	 */
	async listUsers(options: {
		first?: number;
	} = {}): Promise<ActionResult<StandardList<LinearUser>>> {
		const query = `
			query Users($first: Int) {
				users(first: $first) {
					nodes {
						${USER_FRAGMENT}
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		`;

		const result = await this.execute<StandardList<LinearUser>>(
			query,
			{ first: options.first || 100 },
			(data) => ({
				items: data.users.nodes,
				hasMore: data.users.pageInfo.hasNextPage,
				cursor: data.users.pageInfo.endCursor,
			})
		);

		// Cache users
		if (result.success && result.data) {
			for (const user of result.data.items) {
				this.userCache.set(user.name.toLowerCase(), user);
				this.userCache.set(user.email.toLowerCase(), user);
			}
		}

		return result;
	}

	/**
	 * Find user by name or email (Zuhandenheit helper)
	 */
	async findUserByName(nameOrEmail: string): Promise<LinearUser | null> {
		const key = nameOrEmail.toLowerCase();

		// Check cache
		if (this.userCache.has(key)) {
			return this.userCache.get(key)!;
		}

		// Fetch all users and cache
		const users = await this.listUsers({ first: 100 });
		if (!users.success) return null;

		// Search in freshly cached users
		return this.userCache.get(key) || null;
	}

	// ============================================================================
	// PROJECTS
	// ============================================================================

	/**
	 * List projects
	 */
	async listProjects(options: {
		teamId?: string;
		first?: number;
	} = {}): Promise<ActionResult<StandardList<LinearProject>>> {
		const query = `
			query Projects($filter: ProjectFilter, $first: Int) {
				projects(filter: $filter, first: $first) {
					nodes {
						id
						name
						description
						icon
						color
						state
						progress
						targetDate
						startedAt
						completedAt
						url
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		`;

		const filter: Record<string, unknown> = {};
		if (options.teamId) {
			filter.accessibleTeams = { id: { eq: options.teamId } };
		}

		return this.execute<StandardList<LinearProject>>(
			query,
			{
				filter: Object.keys(filter).length ? filter : undefined,
				first: options.first || 50,
			},
			(data) => ({
				items: data.projects.nodes,
				hasMore: data.projects.pageInfo.hasNextPage,
				cursor: data.projects.pageInfo.endCursor,
			})
		);
	}

	// ============================================================================
	// ZUHANDENHEIT: High-Level Intent-Based Methods
	// ============================================================================

	/**
	 * Namespace for issue operations (matches workflow integration pattern)
	 */
	issues = {
		/**
		 * Create an issue with Zuhandenheit patterns
		 */
		create: (options: Parameters<Linear['createIssue']>[0]) =>
			this.createIssue(options),

		/**
		 * Update an issue
		 */
		update: (options: Parameters<Linear['updateIssue']>[0]) =>
			this.updateIssue(options),

		/**
		 * Get an issue by ID
		 */
		get: (issueId: string) => this.getIssue(issueId),

		/**
		 * List issues with filtering
		 */
		list: (options?: Parameters<Linear['listIssues']>[0]) =>
			this.listIssues(options),

		/**
		 * Archive an issue
		 */
		archive: (issueId: string) => this.archiveIssue(issueId),

		/**
		 * Add a comment
		 */
		comment: (issueId: string, body: string) =>
			this.createComment({ issueId, body }),
	};

	/**
	 * Namespace for team operations
	 */
	teams = {
		list: (options?: Parameters<Linear['listTeams']>[0]) =>
			this.listTeams(options),
		get: (teamId: string) => this.getTeamById(teamId),
	};

	/**
	 * Namespace for user operations
	 */
	users = {
		list: (options?: Parameters<Linear['listUsers']>[0]) =>
			this.listUsers(options),
		me: () => this.getViewer(),
		find: (nameOrEmail: string) => this.findUserByName(nameOrEmail),
	};

	/**
	 * Namespace for project operations
	 */
	projects = {
		list: (options?: Parameters<Linear['listProjects']>[0]) =>
			this.listProjects(options),
	};
}

// ============================================================================
// STANDARD DATA CONVERSION
// ============================================================================

/**
 * Convert Linear issue to StandardTask
 */
export function toStandardTask(issue: LinearIssue): StandardTask {
	// Map Linear priority (1-4) to StandardTask priority
	const priorityMap: Record<number, 'urgent' | 'high' | 'medium' | 'low' | 'none'> = {
		0: 'none',
		1: 'urgent',
		2: 'high',
		3: 'medium',
		4: 'low',
	};

	// Map Linear state type to StandardTask status
	const statusMap: Record<string, 'todo' | 'in_progress' | 'done' | 'canceled'> = {
		backlog: 'todo',
		unstarted: 'todo',
		started: 'in_progress',
		completed: 'done',
		canceled: 'canceled',
	};

	return {
		id: issue.id,
		title: issue.title,
		description: issue.description,
		status: statusMap[issue.state.type] || 'todo',
		priority: priorityMap[issue.priority] || 'none',
		assignee: issue.assignee ? {
			id: issue.assignee.id,
			name: issue.assignee.name,
			email: issue.assignee.email,
		} : undefined,
		labels: issue.labels.nodes.map((l) => l.name),
		url: issue.url,
		createdAt: issue.createdAt,
		updatedAt: issue.updatedAt,
		metadata: {
			identifier: issue.identifier,
			team: issue.team.name,
			project: issue.project?.name,
			cycle: issue.cycle?.name,
			estimate: issue.estimate,
		},
	};
}

/**
 * Export default class
 */
export default Linear;

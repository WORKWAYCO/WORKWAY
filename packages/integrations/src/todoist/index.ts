/**
 * Todoist Integration for WORKWAY
 *
 * Enables task management automation: sync tasks to Notion,
 * alert teams on Slack, create follow-ups, and compound workflows.
 *
 * Key use cases:
 * - Task Created → Notion page + Slack alert
 * - Task Completed → Update records + trigger follow-up workflows
 * - Project sync → Bidirectional Notion database sync
 *
 * @example
 * ```typescript
 * import { Todoist } from '@workwayco/integrations/todoist';
 *
 * const todoist = new Todoist({ accessToken: tokens.todoist.access_token });
 *
 * // Get all tasks
 * const tasks = await todoist.listTasks();
 *
 * // Create a task
 * const task = await todoist.createTask({
 *   content: 'Review meeting notes',
 *   projectId: 'project-123',
 *   dueString: 'tomorrow at 10am',
 *   priority: 4, // Highest priority
 * });
 *
 * // Complete a task
 * await todoist.closeTask(task.data.id);
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	BaseAPIClient,
	buildQueryString,
	validateAccessToken,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Todoist integration configuration
 */
export interface TodoistConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ============================================================================
// TASK TYPES
// ============================================================================

/**
 * Todoist task
 */
export interface TodoistTask {
	id: string;
	project_id: string;
	section_id: string | null;
	content: string;
	description: string;
	is_completed: boolean;
	labels: string[];
	parent_id: string | null;
	order: number;
	priority: 1 | 2 | 3 | 4; // 1=normal, 4=urgent
	due: TodoistDue | null;
	url: string;
	comment_count: number;
	created_at: string;
	creator_id: string;
	assignee_id: string | null;
	assigner_id: string | null;
	duration: TodoistDuration | null;
}

/**
 * Task due date
 */
export interface TodoistDue {
	date: string;
	string: string;
	lang: string;
	is_recurring: boolean;
	datetime?: string;
	timezone?: string;
}

/**
 * Task duration
 */
export interface TodoistDuration {
	amount: number;
	unit: 'minute' | 'day';
}

/**
 * Options for creating a task
 */
export interface CreateTaskOptions {
	/** Task content (required) */
	content: string;
	/** Task description (markdown) */
	description?: string;
	/** Project ID */
	projectId?: string;
	/** Section ID */
	sectionId?: string;
	/** Parent task ID (for subtasks) */
	parentId?: string;
	/** Label names */
	labels?: string[];
	/** Priority (1=normal, 4=urgent) */
	priority?: 1 | 2 | 3 | 4;
	/** Due date string (natural language) */
	dueString?: string;
	/** Due date (YYYY-MM-DD) */
	dueDate?: string;
	/** Due datetime (RFC3339) */
	dueDatetime?: string;
	/** Language for due string parsing */
	dueLang?: string;
	/** Assignee user ID */
	assigneeId?: string;
	/** Duration amount */
	duration?: number;
	/** Duration unit */
	durationUnit?: 'minute' | 'day';
}

/**
 * Options for updating a task
 */
export interface UpdateTaskOptions {
	/** Task content */
	content?: string;
	/** Task description */
	description?: string;
	/** Label names */
	labels?: string[];
	/** Priority (1=normal, 4=urgent) */
	priority?: 1 | 2 | 3 | 4;
	/** Due date string (natural language) */
	dueString?: string;
	/** Due date (YYYY-MM-DD) */
	dueDate?: string;
	/** Due datetime (RFC3339) */
	dueDatetime?: string;
	/** Language for due string parsing */
	dueLang?: string;
	/** Assignee user ID */
	assigneeId?: string;
	/** Duration amount */
	duration?: number;
	/** Duration unit */
	durationUnit?: 'minute' | 'day';
}

/**
 * Options for listing tasks
 */
export interface ListTasksOptions {
	/** Filter by project ID */
	projectId?: string;
	/** Filter by section ID */
	sectionId?: string;
	/** Filter by label name */
	label?: string;
	/** Filter expression */
	filter?: string;
	/** Language for filter */
	lang?: string;
	/** Specific task IDs to retrieve */
	ids?: string[];
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

/**
 * Todoist project
 */
export interface TodoistProject {
	id: string;
	name: string;
	color: string;
	parent_id: string | null;
	order: number;
	comment_count: number;
	is_shared: boolean;
	is_favorite: boolean;
	is_inbox_project: boolean;
	is_team_inbox: boolean;
	view_style: 'list' | 'board';
	url: string;
}

/**
 * Options for creating a project
 */
export interface CreateProjectOptions {
	/** Project name (required) */
	name: string;
	/** Parent project ID */
	parentId?: string;
	/** Color name */
	color?: string;
	/** Mark as favorite */
	isFavorite?: boolean;
	/** View style */
	viewStyle?: 'list' | 'board';
}

/**
 * Options for updating a project
 */
export interface UpdateProjectOptions {
	/** Project name */
	name?: string;
	/** Color name */
	color?: string;
	/** Mark as favorite */
	isFavorite?: boolean;
	/** View style */
	viewStyle?: 'list' | 'board';
}

/**
 * Project collaborator
 */
export interface TodoistCollaborator {
	id: string;
	name: string;
	email: string;
}

// ============================================================================
// SECTION TYPES
// ============================================================================

/**
 * Todoist section
 */
export interface TodoistSection {
	id: string;
	project_id: string;
	order: number;
	name: string;
}

/**
 * Options for creating a section
 */
export interface CreateSectionOptions {
	/** Section name (required) */
	name: string;
	/** Project ID (required) */
	projectId: string;
	/** Order position */
	order?: number;
}

// ============================================================================
// LABEL TYPES
// ============================================================================

/**
 * Todoist personal label
 */
export interface TodoistLabel {
	id: string;
	name: string;
	color: string;
	order: number;
	is_favorite: boolean;
}

/**
 * Options for creating a label
 */
export interface CreateLabelOptions {
	/** Label name (required) */
	name: string;
	/** Color name */
	color?: string;
	/** Order position */
	order?: number;
	/** Mark as favorite */
	isFavorite?: boolean;
}

/**
 * Options for updating a label
 */
export interface UpdateLabelOptions {
	/** Label name */
	name?: string;
	/** Color name */
	color?: string;
	/** Order position */
	order?: number;
	/** Mark as favorite */
	isFavorite?: boolean;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

/**
 * Todoist comment
 */
export interface TodoistComment {
	id: string;
	task_id?: string;
	project_id?: string;
	posted_at: string;
	content: string;
	attachment?: TodoistAttachment;
}

/**
 * Comment attachment
 */
export interface TodoistAttachment {
	file_name: string;
	file_type: string;
	file_url: string;
	resource_type: string;
}

/**
 * Options for creating a comment
 */
export interface CreateCommentOptions {
	/** Comment content (required) */
	content: string;
	/** Task ID (required if no projectId) */
	taskId?: string;
	/** Project ID (required if no taskId) */
	projectId?: string;
	/** Attachment object */
	attachment?: {
		fileName: string;
		fileType: string;
		fileUrl: string;
		resourceType?: string;
	};
}

// ============================================================================
// TODOIST INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Todoist integration */
const handleError = createErrorHandler('todoist');

/**
 * Todoist Integration
 *
 * Weniger, aber besser: Task data for compound workflows.
 */
export class Todoist extends BaseAPIClient {
	constructor(config: TodoistConfig) {
		validateAccessToken(config.accessToken, 'todoist');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.todoist.com/rest/v2',
			timeout: config.timeout,
		});
	}

	// ==========================================================================
	// TASKS
	// ==========================================================================

	/**
	 * List active tasks
	 */
	async listTasks(options: ListTasksOptions = {}): Promise<ActionResult<TodoistTask[]>> {
		try {
			const queryString = buildQueryString({
				project_id: options.projectId,
				section_id: options.sectionId,
				label: options.label,
				filter: options.filter,
				lang: options.lang,
				ids: options.ids?.join(','),
			});

			const response = await this.get(`/tasks${queryString}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'list-tasks',
			});

			const data = (await response.json()) as TodoistTask[];

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'list-tasks',
				schema: 'todoist.tasks.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-tasks');
		}
	}

	/**
	 * Get a task by ID
	 */
	async getTask(taskId: string): Promise<ActionResult<TodoistTask>> {
		try {
			const response = await this.get(`/tasks/${taskId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'get-task',
			});

			const data = (await response.json()) as TodoistTask;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'get-task',
				schema: 'todoist.task.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-task');
		}
	}

	/**
	 * Create a new task
	 */
	async createTask(options: CreateTaskOptions): Promise<ActionResult<TodoistTask>> {
		if (!options.content) {
			return ActionResult.error(
				'Task content is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-task' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				content: options.content,
			};

			if (options.description) body.description = options.description;
			if (options.projectId) body.project_id = options.projectId;
			if (options.sectionId) body.section_id = options.sectionId;
			if (options.parentId) body.parent_id = options.parentId;
			if (options.labels) body.labels = options.labels;
			if (options.priority) body.priority = options.priority;
			if (options.dueString) body.due_string = options.dueString;
			if (options.dueDate) body.due_date = options.dueDate;
			if (options.dueDatetime) body.due_datetime = options.dueDatetime;
			if (options.dueLang) body.due_lang = options.dueLang;
			if (options.assigneeId) body.assignee_id = options.assigneeId;
			if (options.duration) body.duration = options.duration;
			if (options.durationUnit) body.duration_unit = options.durationUnit;

			const response = await this.post('/tasks', body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'create-task',
			});

			const data = (await response.json()) as TodoistTask;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'create-task',
				schema: 'todoist.task.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-task');
		}
	}

	/**
	 * Update a task
	 */
	async updateTask(taskId: string, options: UpdateTaskOptions): Promise<ActionResult<TodoistTask>> {
		try {
			const body: Record<string, unknown> = {};

			if (options.content !== undefined) body.content = options.content;
			if (options.description !== undefined) body.description = options.description;
			if (options.labels !== undefined) body.labels = options.labels;
			if (options.priority !== undefined) body.priority = options.priority;
			if (options.dueString !== undefined) body.due_string = options.dueString;
			if (options.dueDate !== undefined) body.due_date = options.dueDate;
			if (options.dueDatetime !== undefined) body.due_datetime = options.dueDatetime;
			if (options.dueLang !== undefined) body.due_lang = options.dueLang;
			if (options.assigneeId !== undefined) body.assignee_id = options.assigneeId;
			if (options.duration !== undefined) body.duration = options.duration;
			if (options.durationUnit !== undefined) body.duration_unit = options.durationUnit;

			const response = await this.post(`/tasks/${taskId}`, body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'update-task',
			});

			const data = (await response.json()) as TodoistTask;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'update-task',
				schema: 'todoist.task.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-task');
		}
	}

	/**
	 * Close (complete) a task
	 */
	async closeTask(taskId: string): Promise<ActionResult<{ closed: boolean }>> {
		try {
			const response = await this.post(`/tasks/${taskId}/close`, {});
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'close-task',
			});

			return createActionResult({
				data: { closed: true },
				integration: 'todoist',
				action: 'close-task',
				schema: 'todoist.close-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'close-task');
		}
	}

	/**
	 * Reopen a completed task
	 */
	async reopenTask(taskId: string): Promise<ActionResult<{ reopened: boolean }>> {
		try {
			const response = await this.post(`/tasks/${taskId}/reopen`, {});
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'reopen-task',
			});

			return createActionResult({
				data: { reopened: true },
				integration: 'todoist',
				action: 'reopen-task',
				schema: 'todoist.reopen-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'reopen-task');
		}
	}

	/**
	 * Delete a task
	 */
	async deleteTask(taskId: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.delete(`/tasks/${taskId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'delete-task',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'todoist',
				action: 'delete-task',
				schema: 'todoist.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-task');
		}
	}

	// ==========================================================================
	// PROJECTS
	// ==========================================================================

	/**
	 * List all projects
	 */
	async listProjects(): Promise<ActionResult<TodoistProject[]>> {
		try {
			const response = await this.get('/projects');
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'list-projects',
			});

			const data = (await response.json()) as TodoistProject[];

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'list-projects',
				schema: 'todoist.projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-projects');
		}
	}

	/**
	 * Get a project by ID
	 */
	async getProject(projectId: string): Promise<ActionResult<TodoistProject>> {
		try {
			const response = await this.get(`/projects/${projectId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'get-project',
			});

			const data = (await response.json()) as TodoistProject;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'get-project',
				schema: 'todoist.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-project');
		}
	}

	/**
	 * Create a new project
	 */
	async createProject(options: CreateProjectOptions): Promise<ActionResult<TodoistProject>> {
		if (!options.name) {
			return ActionResult.error(
				'Project name is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-project' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				name: options.name,
			};

			if (options.parentId) body.parent_id = options.parentId;
			if (options.color) body.color = options.color;
			if (options.isFavorite !== undefined) body.is_favorite = options.isFavorite;
			if (options.viewStyle) body.view_style = options.viewStyle;

			const response = await this.post('/projects', body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'create-project',
			});

			const data = (await response.json()) as TodoistProject;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'create-project',
				schema: 'todoist.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-project');
		}
	}

	/**
	 * Update a project
	 */
	async updateProject(
		projectId: string,
		options: UpdateProjectOptions
	): Promise<ActionResult<TodoistProject>> {
		try {
			const body: Record<string, unknown> = {};

			if (options.name !== undefined) body.name = options.name;
			if (options.color !== undefined) body.color = options.color;
			if (options.isFavorite !== undefined) body.is_favorite = options.isFavorite;
			if (options.viewStyle !== undefined) body.view_style = options.viewStyle;

			const response = await this.post(`/projects/${projectId}`, body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'update-project',
			});

			const data = (await response.json()) as TodoistProject;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'update-project',
				schema: 'todoist.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-project');
		}
	}

	/**
	 * Archive a project
	 */
	async archiveProject(projectId: string): Promise<ActionResult<{ archived: boolean }>> {
		try {
			const response = await this.post(`/projects/${projectId}/archive`, {});
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'archive-project',
			});

			return createActionResult({
				data: { archived: true },
				integration: 'todoist',
				action: 'archive-project',
				schema: 'todoist.archive-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'archive-project');
		}
	}

	/**
	 * Unarchive a project
	 */
	async unarchiveProject(projectId: string): Promise<ActionResult<{ unarchived: boolean }>> {
		try {
			const response = await this.post(`/projects/${projectId}/unarchive`, {});
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'unarchive-project',
			});

			return createActionResult({
				data: { unarchived: true },
				integration: 'todoist',
				action: 'unarchive-project',
				schema: 'todoist.unarchive-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'unarchive-project');
		}
	}

	/**
	 * Delete a project
	 */
	async deleteProject(projectId: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.delete(`/projects/${projectId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'delete-project',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'todoist',
				action: 'delete-project',
				schema: 'todoist.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-project');
		}
	}

	/**
	 * Get project collaborators
	 */
	async getCollaborators(projectId: string): Promise<ActionResult<TodoistCollaborator[]>> {
		try {
			const response = await this.get(`/projects/${projectId}/collaborators`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'get-collaborators',
			});

			const data = (await response.json()) as TodoistCollaborator[];

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'get-collaborators',
				schema: 'todoist.collaborators.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-collaborators');
		}
	}

	// ==========================================================================
	// SECTIONS
	// ==========================================================================

	/**
	 * List sections
	 */
	async listSections(projectId?: string): Promise<ActionResult<TodoistSection[]>> {
		try {
			const queryString = projectId ? buildQueryString({ project_id: projectId }) : '';
			const response = await this.get(`/sections${queryString}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'list-sections',
			});

			const data = (await response.json()) as TodoistSection[];

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'list-sections',
				schema: 'todoist.sections.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-sections');
		}
	}

	/**
	 * Get a section by ID
	 */
	async getSection(sectionId: string): Promise<ActionResult<TodoistSection>> {
		try {
			const response = await this.get(`/sections/${sectionId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'get-section',
			});

			const data = (await response.json()) as TodoistSection;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'get-section',
				schema: 'todoist.section.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-section');
		}
	}

	/**
	 * Create a section
	 */
	async createSection(options: CreateSectionOptions): Promise<ActionResult<TodoistSection>> {
		if (!options.name) {
			return ActionResult.error(
				'Section name is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-section' }
			);
		}

		if (!options.projectId) {
			return ActionResult.error(
				'Project ID is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-section' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				name: options.name,
				project_id: options.projectId,
			};

			if (options.order !== undefined) body.order = options.order;

			const response = await this.post('/sections', body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'create-section',
			});

			const data = (await response.json()) as TodoistSection;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'create-section',
				schema: 'todoist.section.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-section');
		}
	}

	/**
	 * Update a section
	 */
	async updateSection(sectionId: string, name: string): Promise<ActionResult<TodoistSection>> {
		if (!name) {
			return ActionResult.error(
				'Section name is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'update-section' }
			);
		}

		try {
			const response = await this.post(`/sections/${sectionId}`, { name });
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'update-section',
			});

			const data = (await response.json()) as TodoistSection;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'update-section',
				schema: 'todoist.section.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-section');
		}
	}

	/**
	 * Delete a section
	 */
	async deleteSection(sectionId: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.delete(`/sections/${sectionId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'delete-section',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'todoist',
				action: 'delete-section',
				schema: 'todoist.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-section');
		}
	}

	// ==========================================================================
	// LABELS
	// ==========================================================================

	/**
	 * List personal labels
	 */
	async listLabels(): Promise<ActionResult<TodoistLabel[]>> {
		try {
			const response = await this.get('/labels');
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'list-labels',
			});

			const data = (await response.json()) as TodoistLabel[];

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'list-labels',
				schema: 'todoist.labels.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-labels');
		}
	}

	/**
	 * Get a label by ID
	 */
	async getLabel(labelId: string): Promise<ActionResult<TodoistLabel>> {
		try {
			const response = await this.get(`/labels/${labelId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'get-label',
			});

			const data = (await response.json()) as TodoistLabel;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'get-label',
				schema: 'todoist.label.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-label');
		}
	}

	/**
	 * Create a label
	 */
	async createLabel(options: CreateLabelOptions): Promise<ActionResult<TodoistLabel>> {
		if (!options.name) {
			return ActionResult.error(
				'Label name is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-label' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				name: options.name,
			};

			if (options.color) body.color = options.color;
			if (options.order !== undefined) body.order = options.order;
			if (options.isFavorite !== undefined) body.is_favorite = options.isFavorite;

			const response = await this.post('/labels', body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'create-label',
			});

			const data = (await response.json()) as TodoistLabel;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'create-label',
				schema: 'todoist.label.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-label');
		}
	}

	/**
	 * Update a label
	 */
	async updateLabel(labelId: string, options: UpdateLabelOptions): Promise<ActionResult<TodoistLabel>> {
		try {
			const body: Record<string, unknown> = {};

			if (options.name !== undefined) body.name = options.name;
			if (options.color !== undefined) body.color = options.color;
			if (options.order !== undefined) body.order = options.order;
			if (options.isFavorite !== undefined) body.is_favorite = options.isFavorite;

			const response = await this.post(`/labels/${labelId}`, body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'update-label',
			});

			const data = (await response.json()) as TodoistLabel;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'update-label',
				schema: 'todoist.label.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-label');
		}
	}

	/**
	 * Delete a label
	 */
	async deleteLabel(labelId: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.delete(`/labels/${labelId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'delete-label',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'todoist',
				action: 'delete-label',
				schema: 'todoist.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-label');
		}
	}

	// ==========================================================================
	// COMMENTS
	// ==========================================================================

	/**
	 * List comments for a task or project
	 */
	async listComments(options: { taskId?: string; projectId?: string }): Promise<ActionResult<TodoistComment[]>> {
		if (!options.taskId && !options.projectId) {
			return ActionResult.error(
				'Either taskId or projectId is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'list-comments' }
			);
		}

		try {
			const queryString = buildQueryString({
				task_id: options.taskId,
				project_id: options.projectId,
			});

			const response = await this.get(`/comments${queryString}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'list-comments',
			});

			const data = (await response.json()) as TodoistComment[];

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'list-comments',
				schema: 'todoist.comments.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-comments');
		}
	}

	/**
	 * Get a comment by ID
	 */
	async getComment(commentId: string): Promise<ActionResult<TodoistComment>> {
		try {
			const response = await this.get(`/comments/${commentId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'get-comment',
			});

			const data = (await response.json()) as TodoistComment;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'get-comment',
				schema: 'todoist.comment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-comment');
		}
	}

	/**
	 * Create a comment
	 */
	async createComment(options: CreateCommentOptions): Promise<ActionResult<TodoistComment>> {
		if (!options.content) {
			return ActionResult.error(
				'Comment content is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-comment' }
			);
		}

		if (!options.taskId && !options.projectId) {
			return ActionResult.error(
				'Either taskId or projectId is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'create-comment' }
			);
		}

		try {
			const body: Record<string, unknown> = {
				content: options.content,
			};

			if (options.taskId) body.task_id = options.taskId;
			if (options.projectId) body.project_id = options.projectId;
			if (options.attachment) {
				body.attachment = {
					file_name: options.attachment.fileName,
					file_type: options.attachment.fileType,
					file_url: options.attachment.fileUrl,
					resource_type: options.attachment.resourceType || 'file',
				};
			}

			const response = await this.post('/comments', body);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'create-comment',
			});

			const data = (await response.json()) as TodoistComment;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'create-comment',
				schema: 'todoist.comment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-comment');
		}
	}

	/**
	 * Update a comment
	 */
	async updateComment(commentId: string, content: string): Promise<ActionResult<TodoistComment>> {
		if (!content) {
			return ActionResult.error(
				'Comment content is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'todoist', action: 'update-comment' }
			);
		}

		try {
			const response = await this.post(`/comments/${commentId}`, { content });
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'update-comment',
			});

			const data = (await response.json()) as TodoistComment;

			return createActionResult({
				data,
				integration: 'todoist',
				action: 'update-comment',
				schema: 'todoist.comment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-comment');
		}
	}

	/**
	 * Delete a comment
	 */
	async deleteComment(commentId: string): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.delete(`/comments/${commentId}`);
			await assertResponseOk(response, {
				integration: 'todoist',
				action: 'delete-comment',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'todoist',
				action: 'delete-comment',
				schema: 'todoist.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-comment');
		}
	}

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	/**
	 * Extract task summary for display
	 *
	 * Zuhandenheit: Developer thinks "get task summary"
	 * not "navigate task object structure"
	 */
	static extractTaskSummary(task: TodoistTask): {
		id: string;
		content: string;
		description: string;
		isCompleted: boolean;
		priority: 'normal' | 'low' | 'medium' | 'high';
		dueString: string | null;
		dueDate: string | null;
		isRecurring: boolean;
		labels: string[];
		projectId: string;
		url: string;
	} {
		const priorityMap: Record<number, 'normal' | 'low' | 'medium' | 'high'> = {
			1: 'normal',
			2: 'low',
			3: 'medium',
			4: 'high',
		};

		return {
			id: task.id,
			content: task.content,
			description: task.description,
			isCompleted: task.is_completed,
			priority: priorityMap[task.priority] || 'normal',
			dueString: task.due?.string || null,
			dueDate: task.due?.date || null,
			isRecurring: task.due?.is_recurring || false,
			labels: task.labels,
			projectId: task.project_id,
			url: task.url,
		};
	}

	/**
	 * Format due date for display
	 */
	static formatDueDate(due: TodoistDue | null, timezone?: string): string {
		if (!due) return 'No due date';

		// If it has a datetime, format with time
		if (due.datetime) {
			const date = new Date(due.datetime);
			const options: Intl.DateTimeFormatOptions = {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				timeZone: timezone || due.timezone || 'UTC',
			};
			return date.toLocaleString('en-US', options);
		}

		// Otherwise just format the date
		const date = new Date(due.date + 'T00:00:00');
		const options: Intl.DateTimeFormatOptions = {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		};
		return date.toLocaleDateString('en-US', options);
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Get capabilities for Todoist actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: true, // Task descriptions support markdown
			canHandleImages: false,
			canHandleAttachments: true, // Comments can have attachments
			supportsSearch: true, // Filter parameter
			supportsPagination: false, // Todoist REST v2 doesn't paginate
			supportsNesting: true, // Subtasks, subprojects
			supportsRelations: true, // Tasks in projects/sections
			supportsMetadata: true,
		};
	}
}

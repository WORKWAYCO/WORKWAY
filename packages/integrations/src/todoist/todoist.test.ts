/**
 * Todoist Integration Tests
 *
 * Tests for all Todoist API methods following the BaseAPIClient pattern.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Todoist } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

describe('Todoist', () => {
	const validConfig = {
		accessToken: 'test-access-token',
	};

	beforeEach(() => {
		mockFetch.mockReset();
	});

	describe('constructor', () => {
		it('should create instance with valid config', () => {
			const client = new Todoist(validConfig);
			expect(client).toBeInstanceOf(Todoist);
		});

		it('should throw error with empty access token', () => {
			expect(() => new Todoist({ accessToken: '' })).toThrow('access token is required');
		});

		it('should throw error with missing access token', () => {
			// @ts-expect-error - testing invalid input
			expect(() => new Todoist({})).toThrow('access token is required');
		});

		it('should use default API URL', () => {
			const client = new Todoist(validConfig);
			// The client should be configured with default URL
			expect(client).toBeInstanceOf(Todoist);
		});

		it('should use custom API URL when provided', () => {
			const client = new Todoist({
				...validConfig,
				apiUrl: 'https://custom.api.todoist.com',
			});
			expect(client).toBeInstanceOf(Todoist);
		});
	});

	// ==========================================================================
	// TASKS
	// ==========================================================================

	describe('listTasks', () => {
		it('should list all tasks', async () => {
			const mockTasks = [
				{
					id: '123',
					project_id: 'proj-1',
					content: 'Test task',
					description: '',
					is_completed: false,
					labels: ['work'],
					priority: 1,
					due: null,
					url: 'https://todoist.com/showTask?id=123',
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockTasks),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.listTasks();

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockTasks);
		});

		it('should filter tasks by project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([]),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			await client.listTasks({ projectId: 'proj-123' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('project_id=proj-123'),
				expect.any(Object)
			);
		});

		it('should filter tasks by label', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([]),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			await client.listTasks({ label: 'work' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('label=work'),
				expect.any(Object)
			);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: () => Promise.resolve({ error: 'Invalid token' }),
			});

			const client = new Todoist(validConfig);
			const result = await client.listTasks();

			expect(result.success).toBe(false);
		});
	});

	describe('getTask', () => {
		it('should get a task by ID', async () => {
			const mockTask = {
				id: '123',
				content: 'Test task',
				is_completed: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockTask),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.getTask('123');

			expect(result.success).toBe(true);
			expect(result.data?.id).toBe('123');
		});
	});

	describe('createTask', () => {
		it('should create a task with content only', async () => {
			const mockTask = {
				id: '123',
				content: 'New task',
				is_completed: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockTask),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.createTask({ content: 'New task' });

			expect(result.success).toBe(true);
			expect(result.data?.content).toBe('New task');
		});

		it('should create a task with all options', async () => {
			const mockTask = {
				id: '123',
				content: 'New task',
				description: 'Description',
				project_id: 'proj-1',
				priority: 4,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockTask),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.createTask({
				content: 'New task',
				description: 'Description',
				projectId: 'proj-1',
				priority: 4,
				dueString: 'tomorrow at 10am',
				labels: ['work', 'urgent'],
			});

			expect(result.success).toBe(true);
		});

		it('should return error when content is missing', async () => {
			const client = new Todoist(validConfig);
			// @ts-expect-error - testing invalid input
			const result = await client.createTask({});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('updateTask', () => {
		it('should update a task', async () => {
			const mockTask = {
				id: '123',
				content: 'Updated task',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockTask),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.updateTask('123', { content: 'Updated task' });

			expect(result.success).toBe(true);
			expect(result.data?.content).toBe('Updated task');
		});
	});

	describe('closeTask', () => {
		it('should close a task', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.closeTask('123');

			expect(result.success).toBe(true);
			expect(result.data?.closed).toBe(true);
		});
	});

	describe('reopenTask', () => {
		it('should reopen a task', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.reopenTask('123');

			expect(result.success).toBe(true);
			expect(result.data?.reopened).toBe(true);
		});
	});

	describe('deleteTask', () => {
		it('should delete a task', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.deleteTask('123');

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ==========================================================================
	// PROJECTS
	// ==========================================================================

	describe('listProjects', () => {
		it('should list all projects', async () => {
			const mockProjects = [
				{
					id: 'proj-1',
					name: 'Work',
					color: 'blue',
					is_favorite: false,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockProjects),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.listProjects();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
		});
	});

	describe('getProject', () => {
		it('should get a project by ID', async () => {
			const mockProject = {
				id: 'proj-1',
				name: 'Work',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockProject),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.getProject('proj-1');

			expect(result.success).toBe(true);
			expect(result.data?.name).toBe('Work');
		});
	});

	describe('createProject', () => {
		it('should create a project', async () => {
			const mockProject = {
				id: 'proj-1',
				name: 'New Project',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockProject),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.createProject({ name: 'New Project' });

			expect(result.success).toBe(true);
			expect(result.data?.name).toBe('New Project');
		});

		it('should return error when name is missing', async () => {
			const client = new Todoist(validConfig);
			// @ts-expect-error - testing invalid input
			const result = await client.createProject({});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('updateProject', () => {
		it('should update a project', async () => {
			const mockProject = {
				id: 'proj-1',
				name: 'Updated Project',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockProject),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.updateProject('proj-1', { name: 'Updated Project' });

			expect(result.success).toBe(true);
		});
	});

	describe('archiveProject', () => {
		it('should archive a project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.archiveProject('proj-1');

			expect(result.success).toBe(true);
			expect(result.data?.archived).toBe(true);
		});
	});

	describe('unarchiveProject', () => {
		it('should unarchive a project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.unarchiveProject('proj-1');

			expect(result.success).toBe(true);
			expect(result.data?.unarchived).toBe(true);
		});
	});

	describe('deleteProject', () => {
		it('should delete a project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.deleteProject('proj-1');

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	describe('getCollaborators', () => {
		it('should get project collaborators', async () => {
			const mockCollaborators = [
				{ id: 'user-1', name: 'John Doe', email: 'john@example.com' },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockCollaborators),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.getCollaborators('proj-1');

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
		});
	});

	// ==========================================================================
	// SECTIONS
	// ==========================================================================

	describe('listSections', () => {
		it('should list all sections', async () => {
			const mockSections = [
				{ id: 'sec-1', name: 'To Do', project_id: 'proj-1' },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSections),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.listSections();

			expect(result.success).toBe(true);
		});

		it('should filter sections by project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([]),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			await client.listSections('proj-1');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('project_id=proj-1'),
				expect.any(Object)
			);
		});
	});

	describe('getSection', () => {
		it('should get a section by ID', async () => {
			const mockSection = {
				id: 'sec-1',
				name: 'To Do',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSection),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.getSection('sec-1');

			expect(result.success).toBe(true);
		});
	});

	describe('createSection', () => {
		it('should create a section', async () => {
			const mockSection = {
				id: 'sec-1',
				name: 'New Section',
				project_id: 'proj-1',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSection),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.createSection({
				name: 'New Section',
				projectId: 'proj-1',
			});

			expect(result.success).toBe(true);
		});

		it('should return error when name is missing', async () => {
			const client = new Todoist(validConfig);
			// @ts-expect-error - testing invalid input
			const result = await client.createSection({ projectId: 'proj-1' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should return error when projectId is missing', async () => {
			const client = new Todoist(validConfig);
			// @ts-expect-error - testing invalid input
			const result = await client.createSection({ name: 'Section' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('updateSection', () => {
		it('should update a section', async () => {
			const mockSection = {
				id: 'sec-1',
				name: 'Updated Section',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSection),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.updateSection('sec-1', 'Updated Section');

			expect(result.success).toBe(true);
		});

		it('should return error when name is empty', async () => {
			const client = new Todoist(validConfig);
			const result = await client.updateSection('sec-1', '');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('deleteSection', () => {
		it('should delete a section', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.deleteSection('sec-1');

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ==========================================================================
	// LABELS
	// ==========================================================================

	describe('listLabels', () => {
		it('should list all labels', async () => {
			const mockLabels = [
				{ id: 'label-1', name: 'work', color: 'blue' },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockLabels),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.listLabels();

			expect(result.success).toBe(true);
		});
	});

	describe('getLabel', () => {
		it('should get a label by ID', async () => {
			const mockLabel = {
				id: 'label-1',
				name: 'work',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockLabel),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.getLabel('label-1');

			expect(result.success).toBe(true);
		});
	});

	describe('createLabel', () => {
		it('should create a label', async () => {
			const mockLabel = {
				id: 'label-1',
				name: 'new-label',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockLabel),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.createLabel({ name: 'new-label' });

			expect(result.success).toBe(true);
		});

		it('should return error when name is missing', async () => {
			const client = new Todoist(validConfig);
			// @ts-expect-error - testing invalid input
			const result = await client.createLabel({});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('updateLabel', () => {
		it('should update a label', async () => {
			const mockLabel = {
				id: 'label-1',
				name: 'updated-label',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockLabel),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.updateLabel('label-1', { name: 'updated-label' });

			expect(result.success).toBe(true);
		});
	});

	describe('deleteLabel', () => {
		it('should delete a label', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.deleteLabel('label-1');

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ==========================================================================
	// COMMENTS
	// ==========================================================================

	describe('listComments', () => {
		it('should list comments for a task', async () => {
			const mockComments = [
				{ id: 'comment-1', content: 'Test comment', task_id: '123' },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockComments),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.listComments({ taskId: '123' });

			expect(result.success).toBe(true);
		});

		it('should list comments for a project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([]),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			await client.listComments({ projectId: 'proj-1' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('project_id=proj-1'),
				expect.any(Object)
			);
		});

		it('should return error when neither taskId nor projectId provided', async () => {
			const client = new Todoist(validConfig);
			const result = await client.listComments({});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('getComment', () => {
		it('should get a comment by ID', async () => {
			const mockComment = {
				id: 'comment-1',
				content: 'Test comment',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockComment),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.getComment('comment-1');

			expect(result.success).toBe(true);
		});
	});

	describe('createComment', () => {
		it('should create a comment on a task', async () => {
			const mockComment = {
				id: 'comment-1',
				content: 'New comment',
				task_id: '123',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockComment),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.createComment({
				content: 'New comment',
				taskId: '123',
			});

			expect(result.success).toBe(true);
		});

		it('should return error when content is missing', async () => {
			const client = new Todoist(validConfig);
			// @ts-expect-error - testing invalid input
			const result = await client.createComment({ taskId: '123' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should return error when neither taskId nor projectId provided', async () => {
			const client = new Todoist(validConfig);
			const result = await client.createComment({ content: 'Test' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('updateComment', () => {
		it('should update a comment', async () => {
			const mockComment = {
				id: 'comment-1',
				content: 'Updated comment',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockComment),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.updateComment('comment-1', 'Updated comment');

			expect(result.success).toBe(true);
		});

		it('should return error when content is empty', async () => {
			const client = new Todoist(validConfig);
			const result = await client.updateComment('comment-1', '');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});
	});

	describe('deleteComment', () => {
		it('should delete a comment', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
				headers: expect.any(Object),
			});

			const client = new Todoist(validConfig);
			const result = await client.deleteComment('comment-1');

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
		});
	});

	// ==========================================================================
	// STATIC HELPERS
	// ==========================================================================

	describe('extractTaskSummary', () => {
		it('should extract task summary correctly', () => {
			const task = {
				id: '123',
				project_id: 'proj-1',
				section_id: null,
				content: 'Test task',
				description: 'Task description',
				is_completed: false,
				labels: ['work', 'urgent'],
				parent_id: null,
				order: 1,
				priority: 4 as const,
				due: {
					date: '2024-12-25',
					string: 'Dec 25',
					lang: 'en',
					is_recurring: false,
				},
				url: 'https://todoist.com/showTask?id=123',
				comment_count: 2,
				created_at: '2024-01-01T00:00:00Z',
				creator_id: 'user-1',
				assignee_id: null,
				assigner_id: null,
				duration: null,
			};

			const summary = Todoist.extractTaskSummary(task);

			expect(summary.id).toBe('123');
			expect(summary.content).toBe('Test task');
			expect(summary.priority).toBe('high');
			expect(summary.dueString).toBe('Dec 25');
			expect(summary.labels).toEqual(['work', 'urgent']);
		});

		it('should handle task without due date', () => {
			const task = {
				id: '123',
				project_id: 'proj-1',
				section_id: null,
				content: 'Test task',
				description: '',
				is_completed: false,
				labels: [],
				parent_id: null,
				order: 1,
				priority: 1 as const,
				due: null,
				url: 'https://todoist.com/showTask?id=123',
				comment_count: 0,
				created_at: '2024-01-01T00:00:00Z',
				creator_id: 'user-1',
				assignee_id: null,
				assigner_id: null,
				duration: null,
			};

			const summary = Todoist.extractTaskSummary(task);

			expect(summary.dueString).toBeNull();
			expect(summary.dueDate).toBeNull();
			expect(summary.isRecurring).toBe(false);
		});
	});

	describe('formatDueDate', () => {
		it('should format date-only due', () => {
			const due = {
				date: '2024-12-25',
				string: 'Dec 25',
				lang: 'en',
				is_recurring: false,
			};

			const formatted = Todoist.formatDueDate(due);

			expect(formatted).toContain('Dec');
			expect(formatted).toContain('25');
		});

		it('should format datetime due', () => {
			const due = {
				date: '2024-12-25',
				string: 'Dec 25 at 10am',
				lang: 'en',
				is_recurring: false,
				datetime: '2024-12-25T10:00:00Z',
				timezone: 'UTC',
			};

			const formatted = Todoist.formatDueDate(due);

			expect(formatted).toContain('Dec');
			expect(formatted).toContain('25');
		});

		it('should return message when due is null', () => {
			const formatted = Todoist.formatDueDate(null);

			expect(formatted).toBe('No due date');
		});
	});
});

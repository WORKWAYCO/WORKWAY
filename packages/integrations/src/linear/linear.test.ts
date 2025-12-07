/**
 * Linear Integration Tests
 *
 * Tests for the Linear GraphQL integration client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Linear, toStandardTask } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Linear', () => {
	const testConfig = {
		accessToken: 'lin_api_test_token',
	};

	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	// ============================================================================
	// CONSTRUCTOR TESTS
	// ============================================================================

	describe('constructor', () => {
		it('should create instance with valid config', () => {
			const client = new Linear(testConfig);
			expect(client).toBeInstanceOf(Linear);
		});

		it('should throw error if access token is missing', () => {
			expect(() => new Linear({ accessToken: '' })).toThrow();
		});
	});

	// ============================================================================
	// ISSUES TESTS
	// ============================================================================

	describe('issues', () => {
		describe('create', () => {
			it('should create an issue', async () => {
				const mockResponse = {
					data: {
						issueCreate: {
							success: true,
							issue: {
								id: 'issue-123',
								identifier: 'ENG-42',
								title: 'Fix login bug',
								description: 'Users cannot login with SSO',
								priority: 1,
								url: 'https://linear.app/team/issue/ENG-42',
								createdAt: '2024-01-15T10:00:00Z',
								updatedAt: '2024-01-15T10:00:00Z',
								state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
								team: { id: 'team-1', name: 'Engineering', key: 'ENG' },
								assignee: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
								labels: { nodes: [{ id: 'label-1', name: 'bug', color: '#ff0000' }] },
							},
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.issues.create({
					teamId: 'team-1',
					title: 'Fix login bug',
					description: 'Users cannot login with SSO',
				});

				expect(result.success).toBe(true);
				expect(result.data?.identifier).toBe('ENG-42');
				expect(result.data?.title).toBe('Fix login bug');
			});
		});

		describe('update', () => {
			it('should update an issue', async () => {
				const mockResponse = {
					data: {
						issueUpdate: {
							success: true,
							issue: {
								id: 'issue-123',
								identifier: 'ENG-42',
								title: 'Updated Title',
								priority: 2,
								url: 'https://linear.app/team/issue/ENG-42',
								createdAt: '2024-01-15T10:00:00Z',
								updatedAt: '2024-01-15T12:00:00Z',
								state: { id: 'state-2', name: 'In Progress', type: 'started' },
								team: { id: 'team-1', name: 'Engineering', key: 'ENG' },
								labels: { nodes: [] },
							},
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.issues.update({
					issueId: 'issue-123',
					title: 'Updated Title',
					priority: 2,
				});

				expect(result.success).toBe(true);
				expect(result.data?.title).toBe('Updated Title');
			});
		});

		describe('get', () => {
			it('should get an issue by ID', async () => {
				const mockResponse = {
					data: {
						issue: {
							id: 'issue-123',
							identifier: 'ENG-42',
							title: 'Test Issue',
							priority: 3,
							url: 'https://linear.app/team/issue/ENG-42',
							createdAt: '2024-01-15T10:00:00Z',
							updatedAt: '2024-01-15T10:00:00Z',
							state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
							team: { id: 'team-1', name: 'Engineering', key: 'ENG' },
							labels: { nodes: [] },
							children: { nodes: [] },
							comments: { nodes: [] },
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.issues.get('issue-123');

				expect(result.success).toBe(true);
				expect(result.data?.identifier).toBe('ENG-42');
			});
		});

		describe('list', () => {
			it('should list issues', async () => {
				const mockResponse = {
					data: {
						issues: {
							nodes: [
								{
									id: 'issue-1',
									identifier: 'ENG-1',
									title: 'Issue 1',
									priority: 1,
									url: 'https://linear.app/team/issue/ENG-1',
									createdAt: '2024-01-15T10:00:00Z',
									updatedAt: '2024-01-15T10:00:00Z',
									state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
									team: { id: 'team-1', name: 'Engineering', key: 'ENG' },
									labels: { nodes: [] },
								},
								{
									id: 'issue-2',
									identifier: 'ENG-2',
									title: 'Issue 2',
									priority: 2,
									url: 'https://linear.app/team/issue/ENG-2',
									createdAt: '2024-01-15T11:00:00Z',
									updatedAt: '2024-01-15T11:00:00Z',
									state: { id: 'state-2', name: 'In Progress', type: 'started' },
									team: { id: 'team-1', name: 'Engineering', key: 'ENG' },
									labels: { nodes: [] },
								},
							],
							pageInfo: {
								hasNextPage: false,
								endCursor: null,
							},
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.issues.list({ teamId: 'team-1' });

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
				expect(result.data?.hasMore).toBe(false);
			});

			it('should filter by state type', async () => {
				const mockResponse = {
					data: {
						issues: {
							nodes: [],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				await client.issues.list({ stateType: 'completed' });

				// Verify filter was included in request
				expect(mockFetch).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						body: expect.stringContaining('completed'),
					})
				);
			});
		});

		describe('archive', () => {
			it('should archive an issue', async () => {
				const mockResponse = {
					data: {
						issueArchive: {
							success: true,
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.issues.archive('issue-123');

				expect(result.success).toBe(true);
				expect(result.data?.success).toBe(true);
			});
		});

		describe('comment', () => {
			it('should add a comment to an issue', async () => {
				const mockResponse = {
					data: {
						commentCreate: {
							success: true,
							comment: {
								id: 'comment-123',
								body: 'This is a comment',
								createdAt: '2024-01-15T10:00:00Z',
								updatedAt: '2024-01-15T10:00:00Z',
								user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
								issue: { id: 'issue-123', identifier: 'ENG-42' },
							},
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.issues.comment('issue-123', 'This is a comment');

				expect(result.success).toBe(true);
				expect(result.data?.body).toBe('This is a comment');
			});
		});
	});

	// ============================================================================
	// TEAMS TESTS
	// ============================================================================

	describe('teams', () => {
		describe('list', () => {
			it('should list teams', async () => {
				const mockResponse = {
					data: {
						teams: {
							nodes: [
								{
									id: 'team-1',
									name: 'Engineering',
									key: 'ENG',
									private: false,
									states: { nodes: [] },
									labels: { nodes: [] },
								},
								{
									id: 'team-2',
									name: 'Design',
									key: 'DES',
									private: false,
									states: { nodes: [] },
									labels: { nodes: [] },
								},
							],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.teams.list();

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});

		describe('get', () => {
			it('should get a team by ID', async () => {
				const mockResponse = {
					data: {
						team: {
							id: 'team-1',
							name: 'Engineering',
							key: 'ENG',
							private: false,
							states: {
								nodes: [
									{ id: 'state-1', name: 'Backlog', type: 'backlog', position: 0 },
									{ id: 'state-2', name: 'Todo', type: 'unstarted', position: 1 },
								],
							},
							labels: {
								nodes: [
									{ id: 'label-1', name: 'bug', color: '#ff0000' },
									{ id: 'label-2', name: 'feature', color: '#00ff00' },
								],
							},
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.teams.get('team-1');

				expect(result.success).toBe(true);
				expect(result.data?.name).toBe('Engineering');
				expect(result.data?.states.nodes).toHaveLength(2);
				expect(result.data?.labels.nodes).toHaveLength(2);
			});
		});
	});

	// ============================================================================
	// USERS TESTS
	// ============================================================================

	describe('users', () => {
		describe('me', () => {
			it('should get the current user', async () => {
				const mockResponse = {
					data: {
						viewer: {
							id: 'user-123',
							name: 'John Doe',
							displayName: 'John',
							email: 'john@example.com',
							avatarUrl: 'https://avatars.example.com/john',
							active: true,
							admin: false,
							createdAt: '2023-01-01T00:00:00Z',
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.users.me();

				expect(result.success).toBe(true);
				expect(result.data?.name).toBe('John Doe');
				expect(result.data?.email).toBe('john@example.com');
			});
		});

		describe('list', () => {
			it('should list users', async () => {
				const mockResponse = {
					data: {
						users: {
							nodes: [
								{
									id: 'user-1',
									name: 'John Doe',
									displayName: 'John',
									email: 'john@example.com',
									active: true,
									admin: true,
									createdAt: '2023-01-01T00:00:00Z',
								},
								{
									id: 'user-2',
									name: 'Jane Smith',
									displayName: 'Jane',
									email: 'jane@example.com',
									active: true,
									admin: false,
									createdAt: '2023-02-01T00:00:00Z',
								},
							],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.users.list();

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});
	});

	// ============================================================================
	// PROJECTS TESTS
	// ============================================================================

	describe('projects', () => {
		describe('list', () => {
			it('should list projects', async () => {
				const mockResponse = {
					data: {
						projects: {
							nodes: [
								{
									id: 'project-1',
									name: 'Q1 Release',
									state: 'started',
									progress: 0.5,
									url: 'https://linear.app/team/project/q1-release',
								},
								{
									id: 'project-2',
									name: 'Infrastructure',
									state: 'planned',
									progress: 0,
									url: 'https://linear.app/team/project/infrastructure',
								},
							],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				});

				const client = new Linear(testConfig);
				const result = await client.projects.list();

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});
	});

	// ============================================================================
	// ERROR HANDLING TESTS
	// ============================================================================

	describe('error handling', () => {
		it('should handle GraphQL errors', async () => {
			const mockResponse = {
				errors: [{ message: 'Issue not found' }],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new Linear(testConfig);
			const result = await client.issues.get('nonexistent');

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain('Issue not found');
		});

		it('should handle HTTP errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
			});

			const client = new Linear(testConfig);
			const result = await client.users.me();

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const client = new Linear(testConfig);
			const result = await client.users.me();

			expect(result.success).toBe(false);
		});
	});
});

// ============================================================================
// STANDARD CONVERSION TESTS
// ============================================================================

describe('toStandardTask', () => {
	it('should convert Linear issue to StandardTask', () => {
		const linearIssue = {
			id: 'issue-123',
			identifier: 'ENG-42',
			title: 'Fix login bug',
			description: 'Users cannot login',
			priority: 1,
			url: 'https://linear.app/team/issue/ENG-42',
			createdAt: '2024-01-15T10:00:00Z',
			updatedAt: '2024-01-15T12:00:00Z',
			state: { id: 'state-1', name: 'In Progress', type: 'started' },
			team: { id: 'team-1', name: 'Engineering', key: 'ENG' },
			assignee: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
			labels: {
				nodes: [
					{ id: 'label-1', name: 'bug', color: '#ff0000' },
					{ id: 'label-2', name: 'urgent', color: '#ff6600' },
				],
			},
			project: { id: 'project-1', name: 'Q1 Release' },
		};

		const standardTask = toStandardTask(linearIssue);

		expect(standardTask.type).toBe('task');
		expect(standardTask.id).toBe('issue-123');
		expect(standardTask.title).toBe('Fix login bug');
		expect(standardTask.description).toBe('Users cannot login');
		expect(standardTask.status).toBe('in_progress');
		expect(standardTask.priority).toBe('urgent');
		expect(standardTask.assignee).toBe('John Doe');
		expect(standardTask.labels).toEqual(['bug', 'urgent']);
		expect(standardTask.metadata?.identifier).toBe('ENG-42');
		expect(standardTask.metadata?.team).toBe('Engineering');
	});

	it('should map priority correctly', () => {
		const createIssue = (priority: number) => ({
			id: 'test',
			identifier: 'TEST-1',
			title: 'Test',
			priority,
			url: 'https://linear.app',
			createdAt: '2024-01-15T10:00:00Z',
			updatedAt: '2024-01-15T10:00:00Z',
			state: { id: '1', name: 'Todo', type: 'unstarted' },
			team: { id: '1', name: 'Test', key: 'TEST' },
			labels: { nodes: [] },
		});

		expect(toStandardTask(createIssue(0)).priority).toBeUndefined();
		expect(toStandardTask(createIssue(1)).priority).toBe('urgent');
		expect(toStandardTask(createIssue(2)).priority).toBe('high');
		expect(toStandardTask(createIssue(3)).priority).toBe('medium');
		expect(toStandardTask(createIssue(4)).priority).toBe('low');
	});

	it('should map state type correctly', () => {
		const createIssue = (stateType: string) => ({
			id: 'test',
			identifier: 'TEST-1',
			title: 'Test',
			priority: 0,
			url: 'https://linear.app',
			createdAt: '2024-01-15T10:00:00Z',
			updatedAt: '2024-01-15T10:00:00Z',
			state: { id: '1', name: 'State', type: stateType },
			team: { id: '1', name: 'Test', key: 'TEST' },
			labels: { nodes: [] },
		});

		expect(toStandardTask(createIssue('backlog')).status).toBe('todo');
		expect(toStandardTask(createIssue('unstarted')).status).toBe('todo');
		expect(toStandardTask(createIssue('started')).status).toBe('in_progress');
		expect(toStandardTask(createIssue('completed')).status).toBe('done');
		expect(toStandardTask(createIssue('canceled')).status).toBe('cancelled');
	});
});

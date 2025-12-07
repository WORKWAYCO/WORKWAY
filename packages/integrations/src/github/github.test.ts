/**
 * GitHub Integration Tests
 *
 * Tests for the GitHub integration client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHub } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHub', () => {
	const testConfig = {
		accessToken: 'ghp_test_access_token',
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
			const client = new GitHub(testConfig);
			expect(client).toBeInstanceOf(GitHub);
		});

		it('should create instance even with empty token (validation happens on request)', () => {
			// BaseAPIClient doesn't validate token in constructor
			// Validation happens when making requests
			const client = new GitHub({ accessToken: '' });
			expect(client).toBeInstanceOf(GitHub);
		});
	});

	// ============================================================================
	// ISSUES TESTS
	// ============================================================================

	describe('issues', () => {
		describe('list', () => {
			it('should list issues successfully', async () => {
				const mockIssues = [
					{
						id: 1,
						number: 42,
						title: 'Bug: Login not working',
						state: 'open',
						body: 'Users cannot log in',
						user: { login: 'testuser', id: 123 },
						labels: [{ name: 'bug' }],
						created_at: '2024-01-15T10:00:00Z',
						updated_at: '2024-01-15T12:00:00Z',
					},
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockIssues),
				});

				const client = new GitHub(testConfig);
				const result = await client.issues.list({
					owner: 'testorg',
					repo: 'testrepo',
				});

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(1);
				expect(result.data?.items[0].title).toBe('Bug: Login not working');
			});

			it('should handle state filter', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([]),
				});

				const client = new GitHub(testConfig);
				await client.issues.list({
					owner: 'testorg',
					repo: 'testrepo',
					state: 'closed',
				});

				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining('state=closed'),
					expect.any(Object)
				);
			});
		});

		describe('create', () => {
			it('should create an issue successfully', async () => {
				const mockIssue = {
					id: 1,
					number: 43,
					title: 'New Feature Request',
					state: 'open',
					body: 'Please add dark mode',
					user: { login: 'testuser', id: 123 },
					labels: [],
					created_at: '2024-01-15T10:00:00Z',
					updated_at: '2024-01-15T10:00:00Z',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 201,
					json: () => Promise.resolve(mockIssue),
				});

				const client = new GitHub(testConfig);
				const result = await client.issues.create({
					owner: 'testorg',
					repo: 'testrepo',
					title: 'New Feature Request',
					body: 'Please add dark mode',
				});

				expect(result.success).toBe(true);
				expect(result.data?.number).toBe(43);
			});
		});

		describe('get', () => {
			it('should get a specific issue', async () => {
				const mockIssue = {
					id: 1,
					number: 42,
					title: 'Bug: Login not working',
					state: 'open',
					body: 'Users cannot log in',
					user: { login: 'testuser', id: 123 },
					labels: [],
					created_at: '2024-01-15T10:00:00Z',
					updated_at: '2024-01-15T12:00:00Z',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockIssue),
				});

				const client = new GitHub(testConfig);
				const result = await client.issues.get({
					owner: 'testorg',
					repo: 'testrepo',
					issue_number: 42,
				});

				expect(result.success).toBe(true);
				expect(result.data?.number).toBe(42);
			});
		});

		describe('update', () => {
			it('should update an issue', async () => {
				const mockIssue = {
					id: 1,
					number: 42,
					title: 'Updated Title',
					state: 'closed',
					body: 'Updated body',
					user: { login: 'testuser', id: 123 },
					labels: [],
					created_at: '2024-01-15T10:00:00Z',
					updated_at: '2024-01-16T10:00:00Z',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockIssue),
				});

				const client = new GitHub(testConfig);
				const result = await client.issues.update({
					owner: 'testorg',
					repo: 'testrepo',
					issue_number: 42,
					state: 'closed',
				});

				expect(result.success).toBe(true);
				expect(result.data?.state).toBe('closed');
			});
		});

		describe('comment', () => {
			it('should add a comment to an issue', async () => {
				const mockComment = {
					id: 100,
					body: 'This is a comment',
					user: { login: 'testuser', id: 123 },
					created_at: '2024-01-15T10:00:00Z',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 201,
					json: () => Promise.resolve(mockComment),
				});

				const client = new GitHub(testConfig);
				const result = await client.issues.comment({
					owner: 'testorg',
					repo: 'testrepo',
					issue_number: 42,
					body: 'This is a comment',
				});

				expect(result.success).toBe(true);
				expect(result.data?.body).toBe('This is a comment');
			});
		});
	});

	// ============================================================================
	// PULL REQUESTS TESTS
	// ============================================================================

	describe('pulls', () => {
		describe('list', () => {
			it('should list pull requests', async () => {
				const mockPRs = [
					{
						id: 1,
						number: 100,
						title: 'Add new feature',
						state: 'open',
						body: 'This PR adds a new feature',
						user: { login: 'testuser', id: 123 },
						head: { ref: 'feature-branch', sha: 'abc123' },
						base: { ref: 'main', sha: 'def456' },
						created_at: '2024-01-15T10:00:00Z',
						updated_at: '2024-01-15T12:00:00Z',
					},
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockPRs),
				});

				const client = new GitHub(testConfig);
				const result = await client.pulls.list({
					owner: 'testorg',
					repo: 'testrepo',
				});

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(1);
				expect(result.data?.items[0].title).toBe('Add new feature');
			});
		});

		describe('get', () => {
			it('should get a specific pull request', async () => {
				const mockPR = {
					id: 1,
					number: 100,
					title: 'Add new feature',
					state: 'open',
					body: 'This PR adds a new feature',
					user: { login: 'testuser', id: 123 },
					head: { ref: 'feature-branch', sha: 'abc123' },
					base: { ref: 'main', sha: 'def456' },
					mergeable: true,
					merged: false,
					created_at: '2024-01-15T10:00:00Z',
					updated_at: '2024-01-15T12:00:00Z',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockPR),
				});

				const client = new GitHub(testConfig);
				const result = await client.pulls.get({
					owner: 'testorg',
					repo: 'testrepo',
					pull_number: 100,
				});

				expect(result.success).toBe(true);
				expect(result.data?.number).toBe(100);
				expect(result.data?.mergeable).toBe(true);
			});
		});
	});

	// ============================================================================
	// REPOS TESTS
	// ============================================================================

	describe('repos', () => {
		describe('get', () => {
			it('should get repository info', async () => {
				const mockRepo = {
					id: 1,
					name: 'testrepo',
					full_name: 'testorg/testrepo',
					description: 'A test repository',
					private: false,
					owner: { login: 'testorg', id: 456 },
					default_branch: 'main',
					stargazers_count: 100,
					forks_count: 25,
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockRepo),
				});

				const client = new GitHub(testConfig);
				const result = await client.repos.get({
					owner: 'testorg',
					repo: 'testrepo',
				});

				expect(result.success).toBe(true);
				expect(result.data?.full_name).toBe('testorg/testrepo');
			});
		});

		describe('list', () => {
			it('should list user repositories', async () => {
				const mockRepos = [
					{
						id: 1,
						name: 'repo1',
						full_name: 'testuser/repo1',
						private: false,
						owner: { login: 'testuser', id: 123 },
					},
					{
						id: 2,
						name: 'repo2',
						full_name: 'testuser/repo2',
						private: true,
						owner: { login: 'testuser', id: 123 },
					},
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockRepos),
				});

				const client = new GitHub(testConfig);
				const result = await client.repos.list();

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});
	});

	// ============================================================================
	// USER TESTS
	// ============================================================================

	describe('user', () => {
		describe('me', () => {
			it('should get authenticated user', async () => {
				const mockUser = {
					id: 123,
					login: 'testuser',
					name: 'Test User',
					email: 'test@example.com',
					avatar_url: 'https://avatars.githubusercontent.com/u/123',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockUser),
				});

				const client = new GitHub(testConfig);
				const result = await client.user.me();

				expect(result.success).toBe(true);
				expect(result.data?.login).toBe('testuser');
			});
		});
	});

	// ============================================================================
	// ERROR HANDLING TESTS
	// ============================================================================

	describe('error handling', () => {
		it('should handle 401 unauthorized', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: () => Promise.resolve({ message: 'Bad credentials' }),
			});

			const client = new GitHub(testConfig);
			const result = await client.user.me();

			expect(result.success).toBe(false);
		});

		it('should handle 404 not found', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				json: () => Promise.resolve({ message: 'Not Found' }),
			});

			const client = new GitHub(testConfig);
			const result = await client.issues.get({
				owner: 'testorg',
				repo: 'testrepo',
				issue_number: 99999,
			});

			expect(result.success).toBe(false);
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 403,
				statusText: 'Forbidden',
				json: () => Promise.resolve({ message: 'API rate limit exceeded' }),
			});

			const client = new GitHub(testConfig);
			const result = await client.issues.list({
				owner: 'testorg',
				repo: 'testrepo',
			});

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const client = new GitHub(testConfig);
			const result = await client.user.me();

			expect(result.success).toBe(false);
		});
	});
});

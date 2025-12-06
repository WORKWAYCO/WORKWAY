/**
 * Dribbble Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dribbble, type DribbbleShot, type DribbbleUser } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Dribbble', () => {
	const accessToken = 'test-access-token';
	let dribbble: Dribbble;

	beforeEach(() => {
		vi.clearAllMocks();
		dribbble = new Dribbble({ accessToken });
	});

	// ==========================================================================
	// CONSTRUCTOR
	// ==========================================================================

	describe('constructor', () => {
		it('should create instance with valid config', () => {
			expect(dribbble).toBeInstanceOf(Dribbble);
		});

		it('should throw error without access token', () => {
			expect(() => new Dribbble({ accessToken: '' })).toThrow();
		});

		it('should use default API URL', () => {
			const client = new Dribbble({ accessToken });
			expect(client).toBeInstanceOf(Dribbble);
		});

		it('should accept custom API URL', () => {
			const client = new Dribbble({
				accessToken,
				apiUrl: 'https://custom.api.dribbble.com/v2',
			});
			expect(client).toBeInstanceOf(Dribbble);
		});
	});

	// ==========================================================================
	// USER
	// ==========================================================================

	describe('getCurrentUser', () => {
		it('should get the current user', async () => {
			const mockUser: DribbbleUser = {
				id: 123456,
				name: 'Test Designer',
				login: 'testdesigner',
				html_url: 'https://dribbble.com/testdesigner',
				avatar_url: 'https://cdn.dribbble.com/avatars/123.png',
				bio: '<p>UI/UX Designer</p>',
				location: 'San Francisco, CA',
				links: {
					web: 'https://testdesigner.com',
					twitter: 'testdesigner',
				},
				can_upload_shot: true,
				pro: true,
				followers_count: 1500,
				created_at: '2020-01-01T00:00:00.000Z',
				type: 'User',
				teams: [],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockUser),
			});

			const result = await dribbble.getCurrentUser();

			expect(result.success).toBe(true);
			expect(result.data?.name).toBe('Test Designer');
			expect(result.data?.login).toBe('testdesigner');
			expect(result.data?.pro).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.dribbble.com/v2/user',
				expect.any(Object)
			);
		});

		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: () => Promise.resolve('Invalid token'),
			});

			const result = await dribbble.getCurrentUser();

			expect(result.success).toBe(false);
		});
	});

	// ==========================================================================
	// SHOTS
	// ==========================================================================

	describe('listShots', () => {
		it('should list user shots', async () => {
			const mockShots: DribbbleShot[] = [
				{
					id: 111111,
					title: 'Dashboard Design',
					description: '<p>A clean dashboard design</p>',
					width: 800,
					height: 600,
					images: {
						hidpi: 'https://cdn.dribbble.com/shots/111111-hidpi.png',
						normal: 'https://cdn.dribbble.com/shots/111111.png',
						teaser: 'https://cdn.dribbble.com/shots/111111-teaser.png',
					},
					published_at: '2024-01-15T10:00:00.000Z',
					updated_at: '2024-01-15T10:00:00.000Z',
					html_url: 'https://dribbble.com/shots/111111-dashboard-design',
					animated: false,
					tags: ['dashboard', 'ui', 'design'],
					attachments: [],
					projects: [],
					team: null,
					video: null,
					low_profile: false,
				},
				{
					id: 222222,
					title: 'Mobile App UI',
					description: '<p>Mobile banking app</p>',
					width: 800,
					height: 600,
					images: {
						hidpi: null,
						normal: 'https://cdn.dribbble.com/shots/222222.png',
						teaser: 'https://cdn.dribbble.com/shots/222222-teaser.png',
					},
					published_at: '2024-01-10T10:00:00.000Z',
					updated_at: '2024-01-10T10:00:00.000Z',
					html_url: 'https://dribbble.com/shots/222222-mobile-app-ui',
					animated: true,
					tags: ['mobile', 'app', 'banking'],
					attachments: [],
					projects: [],
					team: null,
					video: null,
					low_profile: false,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockShots),
			});

			const result = await dribbble.listShots();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data?.[0].title).toBe('Dashboard Design');
			expect(result.data?.[1].animated).toBe(true);
		});

		it('should handle pagination parameters', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve([]),
			});

			await dribbble.listShots({ page: 2, perPage: 10 });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('page=2'),
				expect.any(Object)
			);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('per_page=10'),
				expect.any(Object)
			);
		});
	});

	describe('getShot', () => {
		it('should get a shot by ID', async () => {
			const mockShot: DribbbleShot = {
				id: 111111,
				title: 'Dashboard Design',
				description: '<p>A clean dashboard design</p>',
				width: 800,
				height: 600,
				images: {
					hidpi: 'https://cdn.dribbble.com/shots/111111-hidpi.png',
					normal: 'https://cdn.dribbble.com/shots/111111.png',
					teaser: 'https://cdn.dribbble.com/shots/111111-teaser.png',
				},
				published_at: '2024-01-15T10:00:00.000Z',
				updated_at: '2024-01-15T10:00:00.000Z',
				html_url: 'https://dribbble.com/shots/111111-dashboard-design',
				animated: false,
				tags: ['dashboard', 'ui', 'design'],
				attachments: [
					{
						id: 1,
						url: 'https://cdn.dribbble.com/attachments/1.zip',
						thumbnail_url: 'https://cdn.dribbble.com/attachments/1-thumb.png',
						size: 1024000,
						content_type: 'application/zip',
						created_at: '2024-01-15T10:00:00.000Z',
					},
				],
				projects: [
					{
						id: 999,
						name: 'Dashboard Collection',
						description: 'All dashboard designs',
						shots_count: 5,
						created_at: '2024-01-01T00:00:00.000Z',
						updated_at: '2024-01-15T00:00:00.000Z',
					},
				],
				team: null,
				video: null,
				low_profile: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockShot),
			});

			const result = await dribbble.getShot(111111);

			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('Dashboard Design');
			expect(result.data?.attachments).toHaveLength(1);
			expect(result.data?.projects).toHaveLength(1);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.dribbble.com/v2/shots/111111',
				expect.any(Object)
			);
		});

		it('should accept string ID', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ id: 111111, title: 'Test' }),
			});

			await dribbble.getShot('111111');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.dribbble.com/v2/shots/111111',
				expect.any(Object)
			);
		});
	});

	describe('createShot', () => {
		it('should require title', async () => {
			const result = await dribbble.createShot({
				title: '',
				image: new Blob(['test'], { type: 'image/png' }),
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should require image', async () => {
			const result = await dribbble.createShot({
				title: 'Test Shot',
				image: undefined as any,
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
		});

		it('should create a shot with all fields', async () => {
			const mockShot: Partial<DribbbleShot> = {
				id: 333333,
				title: 'New Design',
				description: '<p>Brand new design</p>',
				tags: ['new', 'design'],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: () => Promise.resolve(mockShot),
			});

			const imageBlob = new Blob(['fake image data'], { type: 'image/png' });
			const result = await dribbble.createShot({
				title: 'New Design',
				description: '<p>Brand new design</p>',
				tags: ['new', 'design'],
				low_profile: false,
				image: imageBlob,
			});

			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('New Design');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.dribbble.com/v2/shots',
				expect.objectContaining({
					method: 'POST',
				})
			);
		});
	});

	describe('updateShot', () => {
		it('should update a shot', async () => {
			const mockShot: Partial<DribbbleShot> = {
				id: 111111,
				title: 'Updated Dashboard Design',
				description: '<p>Updated description</p>',
				tags: ['updated', 'dashboard'],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockShot),
			});

			const result = await dribbble.updateShot(111111, {
				title: 'Updated Dashboard Design',
				description: '<p>Updated description</p>',
				tags: ['updated', 'dashboard'],
			});

			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('Updated Dashboard Design');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.dribbble.com/v2/shots/111111',
				expect.objectContaining({
					method: 'PUT',
				})
			);
		});
	});

	describe('deleteShot', () => {
		it('should delete a shot', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: () => Promise.resolve({}),
			});

			const result = await dribbble.deleteShot(111111);

			expect(result.success).toBe(true);
			expect(result.data?.deleted).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.dribbble.com/v2/shots/111111',
				expect.objectContaining({
					method: 'DELETE',
				})
			);
		});
	});

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	describe('extractShotDetails', () => {
		it('should extract shot details', () => {
			const shot: DribbbleShot = {
				id: 111111,
				title: 'Dashboard Design',
				description: '<p>A clean dashboard design</p>',
				width: 800,
				height: 600,
				images: {
					hidpi: 'https://cdn.dribbble.com/shots/111111-hidpi.png',
					normal: 'https://cdn.dribbble.com/shots/111111.png',
					teaser: 'https://cdn.dribbble.com/shots/111111-teaser.png',
				},
				published_at: '2024-01-15T10:00:00.000Z',
				updated_at: '2024-01-15T10:00:00.000Z',
				html_url: 'https://dribbble.com/shots/111111-dashboard-design',
				animated: false,
				tags: ['dashboard', 'ui', 'design'],
				attachments: [],
				projects: [],
				team: null,
				video: null,
				low_profile: false,
			};

			const details = Dribbble.extractShotDetails(shot);

			expect(details.id).toBe(111111);
			expect(details.title).toBe('Dashboard Design');
			expect(details.imageUrl).toBe('https://cdn.dribbble.com/shots/111111.png');
			expect(details.thumbnailUrl).toBe('https://cdn.dribbble.com/shots/111111-teaser.png');
			expect(details.hdImageUrl).toBe('https://cdn.dribbble.com/shots/111111-hidpi.png');
			expect(details.isAnimated).toBe(false);
			expect(details.tags).toEqual(['dashboard', 'ui', 'design']);
			expect(details.webUrl).toBe('https://dribbble.com/shots/111111-dashboard-design');
			expect(details.dimensions).toEqual({ width: 800, height: 600 });
			expect(details.hasVideo).toBe(false);
			expect(details.videoUrl).toBeNull();
		});

		it('should handle animated shots with video', () => {
			const shot: DribbbleShot = {
				id: 222222,
				title: 'Animated Logo',
				description: null,
				width: 800,
				height: 600,
				images: {
					hidpi: null,
					normal: 'https://cdn.dribbble.com/shots/222222.png',
					teaser: 'https://cdn.dribbble.com/shots/222222-teaser.png',
				},
				published_at: '2024-01-15T10:00:00.000Z',
				updated_at: '2024-01-15T10:00:00.000Z',
				html_url: 'https://dribbble.com/shots/222222-animated-logo',
				animated: true,
				tags: [],
				attachments: [],
				projects: [],
				team: null,
				video: {
					id: 1,
					duration: 5,
					width: 800,
					height: 600,
					silent: true,
					previews: { p480: 'https://cdn.dribbble.com/videos/222222-480p.mp4' },
					url: 'https://cdn.dribbble.com/videos/222222.mp4',
				},
				low_profile: false,
			};

			const details = Dribbble.extractShotDetails(shot);

			expect(details.isAnimated).toBe(true);
			expect(details.hasVideo).toBe(true);
			expect(details.videoUrl).toBe('https://cdn.dribbble.com/videos/222222.mp4');
			expect(details.hdImageUrl).toBeNull();
			expect(details.description).toBe('');
		});
	});

	describe('formatShotForDisplay', () => {
		it('should format shot for display', () => {
			const shot: DribbbleShot = {
				id: 111111,
				title: 'Dashboard Design',
				description: '<p>A clean dashboard design</p>',
				width: 800,
				height: 600,
				images: {
					hidpi: 'https://cdn.dribbble.com/shots/111111-hidpi.png',
					normal: 'https://cdn.dribbble.com/shots/111111.png',
					teaser: 'https://cdn.dribbble.com/shots/111111-teaser.png',
				},
				published_at: '2024-01-15T10:00:00.000Z',
				updated_at: '2024-01-15T10:00:00.000Z',
				html_url: 'https://dribbble.com/shots/111111-dashboard-design',
				animated: false,
				tags: ['dashboard', 'ui'],
				attachments: [],
				projects: [],
				team: null,
				video: null,
				low_profile: false,
			};

			const display = Dribbble.formatShotForDisplay(shot);

			expect(display.title).toBe('Dashboard Design');
			expect(display.description).toBe('<p>A clean dashboard design</p>');
			expect(display.image.url).toBe('https://cdn.dribbble.com/shots/111111-hidpi.png');
			expect(display.image.alt).toBe('Dashboard Design');
			expect(display.metadata).toHaveLength(4);
			expect(display.metadata[1].label).toBe('Tags');
			expect(display.metadata[1].value).toBe('dashboard, ui');
		});

		it('should handle shots without description', () => {
			const shot: DribbbleShot = {
				id: 111111,
				title: 'Test',
				description: null,
				width: 800,
				height: 600,
				images: {
					hidpi: null,
					normal: 'https://cdn.dribbble.com/shots/111111.png',
					teaser: 'https://cdn.dribbble.com/shots/111111-teaser.png',
				},
				published_at: '2024-01-15T10:00:00.000Z',
				updated_at: '2024-01-15T10:00:00.000Z',
				html_url: 'https://dribbble.com/shots/111111',
				animated: false,
				tags: [],
				attachments: [],
				projects: [],
				team: null,
				video: null,
				low_profile: false,
			};

			const display = Dribbble.formatShotForDisplay(shot);

			expect(display.description).toBe('No description');
			expect(display.image.url).toBe('https://cdn.dribbble.com/shots/111111.png');
			expect(display.metadata[1].value).toBe('None');
		});
	});

	describe('isPro', () => {
		it('should return true for pro users', () => {
			const user: DribbbleUser = {
				id: 123,
				name: 'Pro User',
				login: 'prouser',
				html_url: 'https://dribbble.com/prouser',
				avatar_url: 'https://cdn.dribbble.com/avatars/123.png',
				bio: '',
				location: null,
				links: { web: null, twitter: null },
				can_upload_shot: true,
				pro: true,
				followers_count: 100,
				created_at: '2020-01-01T00:00:00.000Z',
				type: 'User',
				teams: [],
			};

			expect(Dribbble.isPro(user)).toBe(true);
		});

		it('should return false for non-pro users', () => {
			const user: DribbbleUser = {
				id: 123,
				name: 'Free User',
				login: 'freeuser',
				html_url: 'https://dribbble.com/freeuser',
				avatar_url: 'https://cdn.dribbble.com/avatars/123.png',
				bio: '',
				location: null,
				links: { web: null, twitter: null },
				can_upload_shot: false,
				pro: false,
				followers_count: 10,
				created_at: '2020-01-01T00:00:00.000Z',
				type: 'User',
				teams: [],
			};

			expect(Dribbble.isPro(user)).toBe(false);
		});
	});

	describe('getUserDisplayInfo', () => {
		it('should extract user display info', () => {
			const user: DribbbleUser = {
				id: 123456,
				name: 'Test Designer',
				login: 'testdesigner',
				html_url: 'https://dribbble.com/testdesigner',
				avatar_url: 'https://cdn.dribbble.com/avatars/123.png',
				bio: '<p>UI/UX Designer</p>',
				location: 'San Francisco, CA',
				links: {
					web: 'https://testdesigner.com',
					twitter: 'testdesigner',
				},
				can_upload_shot: true,
				pro: true,
				followers_count: 1500,
				created_at: '2020-01-01T00:00:00.000Z',
				type: 'User',
				teams: [
					{
						id: 1,
						name: 'Design Team',
						login: 'designteam',
						html_url: 'https://dribbble.com/designteam',
						avatar_url: 'https://cdn.dribbble.com/teams/1.png',
						bio: 'A design team',
						location: null,
						links: { web: null, twitter: null },
						type: 'Team',
						created_at: '2020-01-01T00:00:00.000Z',
						updated_at: '2020-01-01T00:00:00.000Z',
					},
				],
			};

			const info = Dribbble.getUserDisplayInfo(user);

			expect(info.name).toBe('Test Designer');
			expect(info.username).toBe('testdesigner');
			expect(info.isPro).toBe(true);
			expect(info.followersCount).toBe(1500);
			expect(info.website).toBe('https://testdesigner.com');
			expect(info.twitter).toBe('testdesigner');
			expect(info.teams).toHaveLength(1);
			expect(info.teams[0].name).toBe('Design Team');
		});
	});

	// ==========================================================================
	// ERROR HANDLING
	// ==========================================================================

	describe('error handling', () => {
		it('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: () => Promise.resolve('Invalid token'),
			});

			const result = await dribbble.getCurrentUser();

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await dribbble.getCurrentUser();

			expect(result.success).toBe(false);
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				text: () => Promise.resolve('Rate limited'),
			});

			const result = await dribbble.listShots();

			expect(result.success).toBe(false);
		});

		it('should handle 404 for non-existent shot', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: () => Promise.resolve('Shot not found'),
			});

			const result = await dribbble.getShot(999999999);

			expect(result.success).toBe(false);
		});
	});
});

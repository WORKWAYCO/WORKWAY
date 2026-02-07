/**
 * Oracle Primavera P6 Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrimaveraP6 } from './index.js';
import { ErrorCode } from '@workwayco/sdk';

describe('PrimaveraP6 constructor', () => {
	it('should require base URL', () => {
		expect(() => new PrimaveraP6({
			baseUrl: '',
			username: 'admin',
			password: 'pass',
		})).toThrow();
	});

	it('should require credentials', () => {
		expect(() => new PrimaveraP6({
			baseUrl: 'https://p6.example.com/p6ws/restapi',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new PrimaveraP6({
			baseUrl: 'https://p6.example.com/p6ws/restapi',
			username: 'admin',
			password: 'pass',
		});
		expect(client).toBeInstanceOf(PrimaveraP6);
	});

	it('should accept access token', () => {
		const client = new PrimaveraP6({
			baseUrl: 'https://p6.example.com/p6ws/restapi',
			accessToken: 'pre-auth-token',
		});
		expect(client).toBeInstanceOf(PrimaveraP6);
	});
});

describe('PrimaveraP6 API methods', () => {
	let client: PrimaveraP6;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new PrimaveraP6({
			baseUrl: 'https://p6.example.com/p6ws/restapi',
			accessToken: 'test-token',
		});
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getProjects', () => {
		it('should return projects', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ ProjectObjectId: 1, Id: 'PROJ-001', Name: 'Highway Bridge', Status: 'Active' },
				],
			});

			const result = await client.getProjects();
			expect(result.success).toBe(true);
			expect(result.data[0].Name).toBe('Highway Bridge');
		});
	});

	describe('getActivities', () => {
		it('should return activities for a project', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						ActivityObjectId: 100,
						Id: 'A1000',
						Name: 'Pour foundation',
						Status: 'In Progress',
						IsCritical: true,
						TotalFloat: 0,
					},
				],
			});

			const result = await client.getActivities('1');
			expect(result.success).toBe(true);
			expect(result.data[0].IsCritical).toBe(true);
		});
	});

	describe('getWBS', () => {
		it('should return WBS elements', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ ObjectId: 10, Code: 'WBS-01', Name: 'Substructure', ProjectObjectId: 1 },
				],
			});

			const result = await client.getWBS('1');
			expect(result.success).toBe(true);
			expect(result.data[0].Name).toBe('Substructure');
		});
	});

	describe('scheduleProject', () => {
		it('should trigger scheduling', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ Status: 'Scheduled', JobId: 'j123' }),
			});

			const result = await client.scheduleProject('1', '2024-06-01');
			expect(result.success).toBe(true);
		});
	});

	describe('getRelationships', () => {
		it('should return activity dependencies', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						ObjectId: 50,
						PredecessorActivityId: 'A1000',
						SuccessorActivityId: 'A1010',
						Type: 'FS',
						Lag: 0,
					},
				],
			});

			const result = await client.getRelationships('1');
			expect(result.success).toBe(true);
			expect(result.data[0].Type).toBe('FS');
		});
	});
});

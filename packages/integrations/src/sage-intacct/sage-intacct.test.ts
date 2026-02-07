/**
 * Sage Intacct Construction Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SageIntacct } from './index.js';

describe('SageIntacct constructor', () => {
	it('should require company ID', () => {
		expect(() => new SageIntacct({
			companyId: '',
			userId: 'user',
			userPassword: 'pass',
			senderId: 'sender',
			senderPassword: 'spass',
		})).toThrow();
	});

	it('should accept valid config', () => {
		const client = new SageIntacct({
			companyId: 'COMP-1',
			userId: 'user',
			userPassword: 'pass',
			senderId: 'sender',
			senderPassword: 'spass',
		});
		expect(client).toBeInstanceOf(SageIntacct);
	});
});

describe('SageIntacct API methods', () => {
	let client: SageIntacct;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new SageIntacct({
			companyId: 'COMP-1',
			userId: 'user',
			userPassword: 'pass',
			senderId: 'sender',
			senderPassword: 'spass',
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
					{ PROJECTID: 'P-001', NAME: 'School Renovation', STATUS: 'Active' },
				],
			});

			const result = await client.getProjects();
			expect(result.success).toBe(true);
			expect(result.data[0].NAME).toBe('School Renovation');
		});
	});

	describe('getVendors', () => {
		it('should return vendors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ VENDORID: 'V-001', NAME: 'Steel Supply Co', STATUS: 'Active' },
				],
			});

			const result = await client.getVendors();
			expect(result.success).toBe(true);
			expect(result.data[0].NAME).toBe('Steel Supply Co');
		});
	});

	describe('getJobCosts', () => {
		it('should return job cost transactions', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{ RECORDNO: 1, PROJECTID: 'P-001', COSTTYPE: 'Material', AMOUNT: 15000 },
				],
			});

			const result = await client.getJobCosts('P-001');
			expect(result.success).toBe(true);
			expect(result.data[0].AMOUNT).toBe(15000);
		});
	});
});

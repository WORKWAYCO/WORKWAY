/**
 * HubSpot Integration Tests
 *
 * Tests for the HubSpot CRM integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubSpot } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HubSpot Constructor', () => {
	it('should require access token', () => {
		expect(() => new HubSpot({ accessToken: '' })).toThrow('hubspot access token is required');
	});

	it('should create instance with valid token', () => {
		const hubspot = new HubSpot({ accessToken: 'test-token' });
		expect(hubspot).toBeInstanceOf(HubSpot);
	});

	it('should allow custom API URL', () => {
		const hubspot = new HubSpot({
			accessToken: 'test-token',
			apiUrl: 'https://custom-api.hubspot.com',
		});
		expect(hubspot).toBeInstanceOf(HubSpot);
	});
});

describe('HubSpot Contacts', () => {
	let hubspot: HubSpot;

	beforeEach(() => {
		hubspot = new HubSpot({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should search contacts', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{
						id: 'contact-123',
						properties: {
							firstname: 'John',
							lastname: 'Doe',
							email: 'john@example.com',
						},
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
					},
				],
			}),
		});

		const result = await hubspot.searchContacts({ query: 'John' });

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].properties.firstname).toBe('John');
		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.hubapi.com/crm/v3/objects/contacts/search',
			expect.objectContaining({
				method: 'POST',
			})
		);
	});

	it('should get contact by email', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{
						id: 'contact-123',
						properties: { email: 'john@example.com' },
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
					},
				],
			}),
		});

		const result = await hubspot.getContactByEmail('john@example.com');

		expect(result.success).toBe(true);
		expect(result.data?.properties.email).toBe('john@example.com');
	});

	it('should return null for non-existent contact', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ results: [] }),
		});

		const result = await hubspot.getContactByEmail('unknown@example.com');

		expect(result.success).toBe(true);
		expect(result.data).toBeNull();
	});
});

describe('HubSpot Deals', () => {
	let hubspot: HubSpot;

	beforeEach(() => {
		hubspot = new HubSpot({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should search deals', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{
						id: 'deal-123',
						properties: {
							dealname: 'Acme Corp Deal',
							dealstage: 'qualifiedtobuy',
							amount: '50000',
						},
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
					},
				],
			}),
		});

		const result = await hubspot.searchDeals({ query: 'Acme' });

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].properties.dealname).toBe('Acme Corp Deal');
	});

	it('should get deal by ID', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'deal-123',
				properties: {
					dealname: 'Test Deal',
					dealstage: 'qualifiedtobuy',
				},
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
			}),
		});

		const result = await hubspot.getDeal('deal-123');

		expect(result.success).toBe(true);
		expect(result.data.id).toBe('deal-123');
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/crm/v3/objects/deals/deal-123'),
			expect.any(Object)
		);
	});

	it('should update deal', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'deal-123',
				properties: {
					dealname: 'Updated Deal',
					dealstage: 'closedwon',
				},
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
			}),
		});

		const result = await hubspot.updateDeal({
			dealId: 'deal-123',
			properties: { dealstage: 'closedwon' },
		});

		expect(result.success).toBe(true);
		expect(result.data.properties.dealstage).toBe('closedwon');
	});

	it('should require deal ID for update', async () => {
		const result = await hubspot.updateDeal({
			dealId: '',
			properties: { dealstage: 'closedwon' },
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});

	it('should update deal from meeting', async () => {
		// First call: getDeal to get current description
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'deal-123',
				properties: {
					dealname: 'Test Deal',
					description: 'Existing notes',
				},
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
			}),
		});

		// Second call: updateDeal with appended notes
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'deal-123',
				properties: {
					dealname: 'Test Deal',
					description: 'Existing notes\n\n---\n**Meeting: Q4 Planning**...',
				},
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
			}),
		});

		const result = await hubspot.updateDealFromMeeting({
			dealId: 'deal-123',
			meetingTitle: 'Q4 Planning',
			summary: 'Discussed roadmap for next quarter',
			actionItems: [
				{ task: 'Send proposal', assignee: 'John' },
				{ task: 'Schedule follow-up' },
			],
			notionUrl: 'https://notion.so/meeting-notes',
		});

		expect(result.success).toBe(true);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});

describe('HubSpot Meeting Activities', () => {
	let hubspot: HubSpot;

	beforeEach(() => {
		hubspot = new HubSpot({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should log meeting activity with deal', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'meeting-123',
				type: 'MEETING',
				timestamp: Date.now(),
				metadata: {},
				associations: { dealIds: ['deal-123'] },
			}),
		});

		const result = await hubspot.logMeetingActivity({
			dealId: 'deal-123',
			meetingTitle: 'Product Demo',
			duration: 30,
			notes: 'Showed new features',
		});

		expect(result.success).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.hubapi.com/crm/v3/objects/meetings',
			expect.objectContaining({
				method: 'POST',
			})
		);
	});

	it('should log meeting activity with contacts', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'meeting-123',
				type: 'MEETING',
				timestamp: Date.now(),
				metadata: {},
				associations: { contactIds: ['contact-1', 'contact-2'] },
			}),
		});

		const result = await hubspot.logMeetingActivity({
			contactIds: ['contact-1', 'contact-2'],
			meetingTitle: 'Team Sync',
			notes: 'Weekly sync meeting',
		});

		expect(result.success).toBe(true);
	});

	it('should require at least one association', async () => {
		const result = await hubspot.logMeetingActivity({
			meetingTitle: 'Meeting with nobody',
			notes: 'This should fail',
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('missing_required_field');
	});

	it('should include external URL in meeting notes', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				id: 'meeting-123',
				type: 'MEETING',
				timestamp: Date.now(),
				metadata: {},
				associations: { dealIds: ['deal-123'] },
			}),
		});

		await hubspot.logMeetingActivity({
			dealId: 'deal-123',
			meetingTitle: 'Strategy Meeting',
			notes: 'Discussed strategy',
			externalUrl: 'https://notion.so/meeting-notes',
		});

		// Verify the request body includes the external URL
		const [, requestOptions] = mockFetch.mock.calls[0];
		const body = JSON.parse(requestOptions.body);
		expect(body.properties.hs_meeting_body).toContain('notion.so/meeting-notes');
	});
});

describe('HubSpot Pipelines', () => {
	let hubspot: HubSpot;

	beforeEach(() => {
		hubspot = new HubSpot({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should get deal pipelines', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{
						id: 'default',
						label: 'Sales Pipeline',
						stages: [
							{ id: 'lead', label: 'Lead' },
							{ id: 'qualified', label: 'Qualified' },
							{ id: 'closedwon', label: 'Closed Won' },
						],
					},
				],
			}),
		});

		const result = await hubspot.getDealPipelines();

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].stages).toHaveLength(3);
	});
});

describe('HubSpot Error Handling', () => {
	let hubspot: HubSpot;

	beforeEach(() => {
		hubspot = new HubSpot({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should handle authentication error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			json: async () => ({ message: 'Invalid API key' }),
		});

		const result = await hubspot.searchDeals({ query: 'test' });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('auth_expired');
	});

	it('should handle rate limit error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 429,
			statusText: 'Too Many Requests',
			json: async () => ({ message: 'Rate limit exceeded' }),
		});

		const result = await hubspot.searchDeals({ query: 'test' });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('api_error');
	});

	it('should handle not found error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: 'Not Found',
			json: async () => ({ message: 'Deal not found' }),
		});

		const result = await hubspot.getDeal('nonexistent-deal');

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('not_found');
	});

	it('should handle server error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			json: async () => ({ message: 'Server error' }),
		});

		const result = await hubspot.searchDeals({ query: 'test' });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('provider_down');
	});

	it('should handle network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await hubspot.searchDeals({ query: 'test' });

		expect(result.success).toBe(false);
	});
});

describe('HubSpot Companies', () => {
	let hubspot: HubSpot;

	beforeEach(() => {
		hubspot = new HubSpot({ accessToken: 'test-token' });
		mockFetch.mockReset();
	});

	it('should search companies', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{
						id: 'company-123',
						properties: {
							name: 'Acme Corp',
							domain: 'acme.com',
							industry: 'Technology',
						},
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
					},
				],
			}),
		});

		const result = await hubspot.searchCompanies({ query: 'Acme' });

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].properties.name).toBe('Acme Corp');
	});
});

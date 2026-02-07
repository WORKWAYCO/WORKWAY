/**
 * Shovels.ai Integration Tools
 *
 * Tools for searching construction permit data, contractor profiles,
 * and property-level construction activity.
 *
 * Shovels.ai Documentation: https://docs.shovels.ai
 */

import { z } from 'zod';
import type { Env } from '../types';
import type { StandardResponse } from '../lib/errors';
import { success } from '../lib/errors';
import { handleError } from '../middleware/error-handler';

// ============================================================================
// Helper: Get Shovels API key from config
// ============================================================================

async function getShovelsApiKey(env: Env, userId: string = 'default'): Promise<string> {
	const token = await env.DB.prepare(`
		SELECT access_token FROM oauth_tokens WHERE provider = 'shovels' AND user_id = ? LIMIT 1
	`).bind(userId).first<any>();

	if (!token) {
		throw new Error('Shovels.ai not connected. Store your API key to use permit intelligence tools.');
	}

	return token.access_token;
}

async function shovelsRequest<T>(env: Env, path: string, userId: string = 'default'): Promise<T> {
	const apiKey = await getShovelsApiKey(env, userId);

	const response = await fetch(`https://api.shovels.ai${path}`, {
		headers: {
			'X-API-Key': apiKey,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Shovels API error (${response.status}): ${await response.text()}`);
	}

	return response.json() as Promise<T>;
}

// ============================================================================
// Shovels Tools
// ============================================================================

export const shovelsTools = {
	// --------------------------------------------------------------------------
	// workway_search_shovels_permits
	// --------------------------------------------------------------------------
	search_shovels_permits: {
		name: 'workway_search_shovels_permits',
		description: 'Search construction permits by location, type, date range, and value. Returns enriched, AI-standardized permit data from thousands of US municipalities.',
		inputSchema: z.object({
			zip_code: z.string().optional()
				.describe('Filter by zip code'),
			city: z.string().optional()
				.describe('Filter by city name'),
			state: z.string().optional()
				.describe('Filter by state (2-letter code, e.g. CA)'),
			type: z.string().optional()
				.describe('Filter by permit type (e.g. residential, commercial, demolition)'),
			issued_after: z.string().optional()
				.describe('Only permits issued after this date (ISO 8601)'),
			issued_before: z.string().optional()
				.describe('Only permits issued before this date (ISO 8601)'),
			min_value: z.number().optional()
				.describe('Minimum estimated project value'),
			max_value: z.number().optional()
				.describe('Maximum estimated project value'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			permits: z.array(z.any()),
			count: z.number(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const params = new URLSearchParams();
				if (input.zip_code) params.set('zip_code', input.zip_code);
				if (input.city) params.set('city', input.city);
				if (input.state) params.set('state', input.state);
				if (input.type) params.set('type', input.type);
				if (input.issued_after) params.set('issued_after', input.issued_after);
				if (input.issued_before) params.set('issued_before', input.issued_before);
				if (input.min_value) params.set('min_value', String(input.min_value));
				if (input.max_value) params.set('max_value', String(input.max_value));

				const query = params.toString() ? `?${params.toString()}` : '';
				const permits = await shovelsRequest<any[]>(env, `/v2/permits${query}`, userId);

				return success({
					permits: permits.map((p: any) => ({
						id: p.id,
						type: p.type,
						status: p.status,
						address: p.address,
						city: p.city,
						state: p.state,
						zip_code: p.zip_code,
						issue_date: p.issue_date,
						estimated_value: p.estimated_value,
						contractor: p.contractor?.name,
						description: p.description,
					})),
					count: permits.length,
				});
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_shovels_contractor
	// --------------------------------------------------------------------------
	get_shovels_contractor: {
		name: 'workway_get_shovels_contractor',
		description: 'Look up a contractor profile with their permit history, specialties, and track record. Useful for vetting subcontractors before awarding work.',
		inputSchema: z.object({
			contractor_id: z.string()
				.describe('Shovels contractor ID'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			contractor: z.any(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';
				const contractor = await shovelsRequest<any>(env, `/v2/contractors/${input.contractor_id}`, userId);

				return success({
					contractor: {
						id: contractor.id,
						name: contractor.name,
						business_name: contractor.business_name,
						license_number: contractor.license_number,
						license_status: contractor.license_status,
						state: contractor.state,
						specialties: contractor.specialties,
						permit_count: contractor.permit_count,
						first_permit_date: contractor.first_permit_date,
						last_permit_date: contractor.last_permit_date,
						average_project_value: contractor.average_project_value,
						total_project_value: contractor.total_project_value,
					},
				});
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_shovels_property
	// --------------------------------------------------------------------------
	get_shovels_property: {
		name: 'workway_get_shovels_property',
		description: 'Get property-level permit history. See all construction activity that has occurred at a specific address.',
		inputSchema: z.object({
			property_id: z.string()
				.describe('Shovels property ID'),
			include_permits: z.boolean().optional().default(true)
				.describe('Include full permit history'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			property: z.any(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';
				const includePermits = input.include_permits ? '?include_permits=true' : '';
				const property = await shovelsRequest<any>(env, `/v2/properties/${input.property_id}${includePermits}`, userId);

				return success({ property });
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_search_shovels_activity
	// --------------------------------------------------------------------------
	search_shovels_activity: {
		name: 'workway_search_shovels_activity',
		description: 'Search for construction activity within a geographic radius. Find all permits issued near a given location.',
		inputSchema: z.object({
			latitude: z.number()
				.describe('Center latitude'),
			longitude: z.number()
				.describe('Center longitude'),
			radius_miles: z.number().optional().default(5)
				.describe('Search radius in miles (default: 5)'),
			type: z.string().optional()
				.describe('Filter by permit type'),
			issued_after: z.string().optional()
				.describe('Only permits issued after this date'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			permits: z.array(z.any()),
			count: z.number(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const params = new URLSearchParams({
					latitude: String(input.latitude),
					longitude: String(input.longitude),
					radius_miles: String(input.radius_miles || 5),
				});
				if (input.type) params.set('type', input.type);
				if (input.issued_after) params.set('issued_after', input.issued_after);

				const permits = await shovelsRequest<any[]>(env, `/v2/permits/geo?${params.toString()}`, userId);

				return success({
					permits: permits.map((p: any) => ({
						id: p.id,
						type: p.type,
						address: p.address,
						city: p.city,
						state: p.state,
						latitude: p.latitude,
						longitude: p.longitude,
						issue_date: p.issue_date,
						estimated_value: p.estimated_value,
						contractor: p.contractor?.name,
					})),
					count: permits.length,
				});
			} catch (error) {
				return handleError(error);
			}
		},
	},
};

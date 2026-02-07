/**
 * Autodesk APS Integration Tools
 *
 * Tools for connecting to and interacting with Autodesk Platform Services
 * (Data Management, Model Derivative, AEC Data Model).
 *
 * Autodesk APS Documentation: https://aps.autodesk.com
 */

import { z } from 'zod';
import type { Env } from '../types';
import type { StandardResponse } from '../lib/errors';
import { success } from '../lib/errors';
import { handleError } from '../middleware/error-handler';

// ============================================================================
// Autodesk Tools
// ============================================================================

export const autodeskTools = {
	// --------------------------------------------------------------------------
	// workway_list_autodesk_projects
	// --------------------------------------------------------------------------
	list_autodesk_projects: {
		name: 'workway_list_autodesk_projects',
		description: 'List all projects the user has access to in Autodesk Construction Cloud. Returns projects across all hubs.',
		inputSchema: z.object({
			hub_id: z.string().optional()
				.describe('Filter by specific hub ID. If omitted, lists projects from all hubs.'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			projects: z.array(z.object({
				id: z.string(),
				name: z.string(),
				hubId: z.string(),
				hubName: z.string().optional(),
			})),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const token = await env.DB.prepare(`
					SELECT * FROM oauth_tokens WHERE provider = 'autodesk' AND user_id = ? LIMIT 1
				`).bind(userId).first<any>();

				if (!token) {
					return success({
						projects: [],
						message: 'Autodesk not connected. Configure your Autodesk OAuth credentials to use this tool.',
					});
				}

				// Fetch hubs first, then projects per hub
				const hubsResponse = await fetch('https://developer.api.autodesk.com/project/v1/hubs', {
					headers: { 'Authorization': `Bearer ${token.access_token}` },
				});

				if (!hubsResponse.ok) {
					throw new Error(`Autodesk API error: ${hubsResponse.status}`);
				}

				const hubsData = await hubsResponse.json() as any;
				const hubs = hubsData.data || [];

				const targetHubs = input.hub_id
					? hubs.filter((h: any) => h.id === input.hub_id)
					: hubs;

				const allProjects: any[] = [];
				for (const hub of targetHubs) {
					const projResponse = await fetch(
						`https://developer.api.autodesk.com/project/v1/hubs/${hub.id}/projects`,
						{ headers: { 'Authorization': `Bearer ${token.access_token}` } }
					);
					if (projResponse.ok) {
						const projData = await projResponse.json() as any;
						for (const p of (projData.data || [])) {
							allProjects.push({
								id: p.id,
								name: p.attributes?.name || p.id,
								hubId: hub.id,
								hubName: hub.attributes?.name,
							});
						}
					}
				}

				return success({ projects: allProjects });
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_autodesk_model
	// --------------------------------------------------------------------------
	get_autodesk_model: {
		name: 'workway_get_autodesk_model',
		description: 'Get model metadata and translation status for a BIM model in Autodesk. Provide the Base64-encoded URN of the model.',
		inputSchema: z.object({
			urn: z.string()
				.describe('Base64-encoded URN of the model file'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			status: z.string(),
			progress: z.string().optional(),
			derivatives: z.array(z.any()).optional(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const token = await env.DB.prepare(`
					SELECT * FROM oauth_tokens WHERE provider = 'autodesk' AND user_id = ? LIMIT 1
				`).bind(userId).first<any>();

				if (!token) {
					throw new Error('Autodesk not connected.');
				}

				const response = await fetch(
					`https://developer.api.autodesk.com/modelderivative/v2/designdata/${input.urn}/manifest`,
					{ headers: { 'Authorization': `Bearer ${token.access_token}` } }
				);

				if (!response.ok) {
					throw new Error(`Autodesk API error: ${response.status}`);
				}

				const manifest = await response.json() as any;

				return success({
					status: manifest.status,
					progress: manifest.progress,
					derivatives: manifest.derivatives?.map((d: any) => ({
						name: d.name,
						outputType: d.outputType,
						status: d.status,
					})),
				});
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_list_autodesk_documents
	// --------------------------------------------------------------------------
	list_autodesk_documents: {
		name: 'workway_list_autodesk_documents',
		description: 'Browse documents in an Autodesk Construction Cloud project folder.',
		inputSchema: z.object({
			project_id: z.string()
				.describe('Autodesk project ID'),
			folder_id: z.string()
				.describe('Folder ID to browse'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			items: z.array(z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
			})),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const token = await env.DB.prepare(`
					SELECT * FROM oauth_tokens WHERE provider = 'autodesk' AND user_id = ? LIMIT 1
				`).bind(userId).first<any>();

				if (!token) {
					throw new Error('Autodesk not connected.');
				}

				const response = await fetch(
					`https://developer.api.autodesk.com/data/v1/projects/${input.project_id}/folders/${input.folder_id}/contents`,
					{ headers: { 'Authorization': `Bearer ${token.access_token}` } }
				);

				if (!response.ok) {
					throw new Error(`Autodesk API error: ${response.status}`);
				}

				const data = await response.json() as any;
				const items = (data.data || []).map((item: any) => ({
					id: item.id,
					name: item.attributes?.displayName || item.attributes?.name || item.id,
					type: item.type,
				}));

				return success({ items });
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_query_autodesk_bim
	// --------------------------------------------------------------------------
	query_autodesk_bim: {
		name: 'workway_query_autodesk_bim',
		description: 'Query BIM element data via the Autodesk AEC Data Model GraphQL API. Use this for structured queries about building elements, properties, and classifications.',
		inputSchema: z.object({
			query: z.string()
				.describe('GraphQL query string for the AEC Data Model API'),
			variables: z.record(z.unknown()).optional()
				.describe('GraphQL variables object'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			data: z.any(),
			errors: z.array(z.any()).optional(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const token = await env.DB.prepare(`
					SELECT * FROM oauth_tokens WHERE provider = 'autodesk' AND user_id = ? LIMIT 1
				`).bind(userId).first<any>();

				if (!token) {
					throw new Error('Autodesk not connected.');
				}

				const response = await fetch('https://developer.api.autodesk.com/aec/graphql', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						query: input.query,
						variables: input.variables,
					}),
				});

				if (!response.ok) {
					throw new Error(`Autodesk GraphQL error: ${response.status}`);
				}

				const result = await response.json() as any;

				return success({
					data: result.data,
					errors: result.errors,
				});
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_autodesk_exchanges
	// --------------------------------------------------------------------------
	get_autodesk_exchanges: {
		name: 'workway_get_autodesk_exchanges',
		description: 'List data exchanges in an Autodesk project. Data exchanges enable selective sharing of BIM model components.',
		inputSchema: z.object({
			collection_id: z.string()
				.describe('Collection ID (project or folder ID)'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			exchanges: z.array(z.object({
				id: z.string(),
				name: z.string(),
				status: z.string(),
			})),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const token = await env.DB.prepare(`
					SELECT * FROM oauth_tokens WHERE provider = 'autodesk' AND user_id = ? LIMIT 1
				`).bind(userId).first<any>();

				if (!token) {
					throw new Error('Autodesk not connected.');
				}

				const response = await fetch(
					`https://developer.api.autodesk.com/exchange/v1/collections/${input.collection_id}/exchanges`,
					{ headers: { 'Authorization': `Bearer ${token.access_token}` } }
				);

				if (!response.ok) {
					throw new Error(`Autodesk API error: ${response.status}`);
				}

				const data = await response.json() as any;
				const exchanges = (data.data || []).map((ex: any) => ({
					id: ex.id,
					name: ex.attributes?.name || ex.id,
					status: ex.attributes?.status || 'unknown',
				}));

				return success({ exchanges });
			} catch (error) {
				return handleError(error);
			}
		},
	},
};

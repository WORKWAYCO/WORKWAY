/**
 * DroneDeploy Integration Tools
 *
 * Tools for accessing drone-captured site data: plans, maps,
 * annotations, issues, and volume reports.
 *
 * DroneDeploy Documentation: https://developer-docs.dronedeploy.com
 */

import { z } from 'zod';
import type { Env } from '../types';
import type { StandardResponse } from '../lib/errors';
import { success } from '../lib/errors';
import { handleError } from '../middleware/error-handler';

// ============================================================================
// Helper: DroneDeploy GraphQL request
// ============================================================================

async function droneDeployGraphQL<T>(
	env: Env,
	query: string,
	variables: Record<string, unknown> = {},
	userId: string = 'default'
): Promise<T> {
	const token = await env.DB.prepare(`
		SELECT access_token FROM oauth_tokens WHERE provider = 'dronedeploy' AND user_id = ? LIMIT 1
	`).bind(userId).first<any>();

	if (!token) {
		throw new Error('DroneDeploy not connected. Store your API key to use site monitoring tools.');
	}

	const response = await fetch('https://www.dronedeploy.com/graphql', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token.access_token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		throw new Error(`DroneDeploy API error (${response.status}): ${await response.text()}`);
	}

	const result = await response.json() as any;

	if (result.errors?.length) {
		throw new Error(`DroneDeploy GraphQL error: ${result.errors.map((e: any) => e.message).join('; ')}`);
	}

	return result.data as T;
}

// ============================================================================
// DroneDeploy Tools
// ============================================================================

export const droneDeployTools = {
	// --------------------------------------------------------------------------
	// workway_list_dronedeploy_plans
	// --------------------------------------------------------------------------
	list_dronedeploy_plans: {
		name: 'workway_list_dronedeploy_plans',
		description: 'List all DroneDeploy plans (sites/projects). Each plan represents a jobsite with captured imagery, maps, and analysis.',
		inputSchema: z.object({
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			plans: z.array(z.object({
				id: z.string(),
				name: z.string(),
				location: z.any().optional(),
				imageCount: z.number().optional(),
			})),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const data = await droneDeployGraphQL<any>(env, `{
					viewer {
						plans {
							edges {
								node {
									id name
									location { lat lng }
									imageCount
								}
							}
						}
					}
				}`, {}, userId);

				const plans = data.viewer.plans.edges.map((e: any) => ({
					id: e.node.id,
					name: e.node.name,
					location: e.node.location,
					imageCount: e.node.imageCount,
				}));

				return success({ plans });
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_dronedeploy_map
	// --------------------------------------------------------------------------
	get_dronedeploy_map: {
		name: 'workway_get_dronedeploy_map',
		description: 'Get processed map data for a DroneDeploy plan. Returns orthomosaic, DSM, and DTM information.',
		inputSchema: z.object({
			plan_id: z.string()
				.describe('DroneDeploy plan ID'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			maps: z.array(z.object({
				id: z.string(),
				status: z.string(),
				dateCreation: z.string().optional(),
			})),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const data = await droneDeployGraphQL<any>(env, `
					query($planId: ID!) {
						node(id: $planId) {
							... on Plan {
								maps {
									edges {
										node {
											id status dateCreation dateComplete
											mapType resolution
											location { lat lng }
										}
									}
								}
							}
						}
					}
				`, { planId: input.plan_id }, userId);

				const maps = data.node.maps.edges.map((e: any) => ({
					id: e.node.id,
					status: e.node.status,
					dateCreation: e.node.dateCreation,
					dateComplete: e.node.dateComplete,
					mapType: e.node.mapType,
					resolution: e.node.resolution,
				}));

				return success({ maps });
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_dronedeploy_issues
	// --------------------------------------------------------------------------
	get_dronedeploy_issues: {
		name: 'workway_get_dronedeploy_issues',
		description: 'Get site issues captured from drone imagery. Returns issues with location, status, priority, and assignee information.',
		inputSchema: z.object({
			plan_id: z.string()
				.describe('DroneDeploy plan ID'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			issues: z.array(z.object({
				id: z.string(),
				title: z.string(),
				status: z.string(),
				priority: z.string().optional(),
			})),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const data = await droneDeployGraphQL<any>(env, `
					query($planId: ID!) {
						node(id: $planId) {
							... on Plan {
								issues {
									edges {
										node {
											id title description status priority
											assignee
											location { lat lng }
											dateCreation dateModified dateResolved
											tags
										}
									}
								}
							}
						}
					}
				`, { planId: input.plan_id }, userId);

				const issues = data.node.issues.edges.map((e: any) => ({
					id: e.node.id,
					title: e.node.title,
					description: e.node.description,
					status: e.node.status,
					priority: e.node.priority,
					assignee: e.node.assignee,
					location: e.node.location,
					dateCreation: e.node.dateCreation,
					tags: e.node.tags,
				}));

				return success({ issues });
			} catch (error) {
				return handleError(error);
			}
		},
	},

	// --------------------------------------------------------------------------
	// workway_get_dronedeploy_volume
	// --------------------------------------------------------------------------
	get_dronedeploy_volume: {
		name: 'workway_get_dronedeploy_volume',
		description: 'Get volume/cut-fill measurement report from drone-captured elevation data. Useful for earthwork analysis and progress tracking.',
		inputSchema: z.object({
			map_id: z.string()
				.describe('DroneDeploy map ID'),
			annotation_id: z.string()
				.describe('Annotation ID defining the measurement area'),
			connection_id: z.string().optional()
				.describe('Your WORKWAY connection ID'),
		}),
		outputSchema: z.object({
			volume: z.number().optional(),
			area: z.number().optional(),
			unit: z.string().optional(),
		}),
		execute: async (input: any, env: Env): Promise<StandardResponse<any>> => {
			try {
				const userId = input.connection_id || 'default';

				const data = await droneDeployGraphQL<any>(env, `
					query($mapId: ID!, $annotationId: ID!) {
						node(id: $mapId) {
							... on Map {
								annotation(id: $annotationId) {
									id
									measurements {
										volume area unit
									}
								}
							}
						}
					}
				`, { mapId: input.map_id, annotationId: input.annotation_id }, userId);

				const measurements = data.node.annotation?.measurements || {};

				return success({
					volume: measurements.volume,
					area: measurements.area,
					unit: measurements.unit,
					annotationId: input.annotation_id,
				});
			} catch (error) {
				return handleError(error);
			}
		},
	},
};

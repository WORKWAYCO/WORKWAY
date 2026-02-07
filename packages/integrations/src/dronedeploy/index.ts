/**
 * DroneDeploy API Integration for WORKWAY
 *
 * Reality capture and site monitoring via drones, 360 cameras, and robots.
 * GraphQL-first API for plans, maps, annotations, issues, and volume reports.
 *
 * Zuhandenheit: PMs don't want "GraphQL mutations" - they want:
 * - Site progress visible without driving there
 * - Earthwork volumes calculated automatically
 * - Issues captured from the air and assigned to trades
 * - Before/after comparisons that settle disputes
 *
 * @example
 * ```typescript
 * import { DroneDeploy } from '@workwayco/integrations/dronedeploy';
 *
 * const dd = new DroneDeploy({
 *   apiKey: process.env.DRONEDEPLOY_API_KEY,
 * });
 *
 * // List all plans (sites)
 * const plans = await dd.getPlans();
 *
 * // Get maps for a plan
 * const maps = await dd.getMaps('plan-id');
 *
 * // Get volume report
 * const volume = await dd.getVolumeReport('map-id', 'area-id');
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { BaseAPIClient } from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * DroneDeploy integration configuration
 *
 * Authentication: Bearer token (API key from Account Preferences)
 */
export interface DroneDeployConfig {
	/** DroneDeploy API key */
	apiKey: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Plan (Site/Project) Resources
// ----------------------------------------------------------------------------

/** DroneDeploy plan (site or project) */
export interface DroneDeployPlan {
	id: string;
	name: string;
	geometry?: {
		lat: number;
		lng: number;
	};
	location?: {
		lat: number;
		lng: number;
	};
	status?: string;
	dateCreation?: string;
	imageCount?: number;
}

// ----------------------------------------------------------------------------
// Map Resources
// ----------------------------------------------------------------------------

/** Processed map/orthomosaic */
export interface DroneDeployMap {
	id: string;
	planId: string;
	name?: string;
	status: string;
	dateCreation: string;
	dateComplete?: string;
	mapType?: string;
	resolution?: number;
	location?: {
		lat: number;
		lng: number;
	};
	tileUrl?: string;
	orthomosaicUrl?: string;
	dsmUrl?: string;
	dtmUrl?: string;
}

// ----------------------------------------------------------------------------
// Annotation Resources
// ----------------------------------------------------------------------------

/** Annotation on a map */
export interface DroneDeployAnnotation {
	id: string;
	mapId: string;
	type: string;
	description?: string;
	geometry?: {
		type: string;
		coordinates: number[] | number[][] | number[][][];
	};
	measurements?: {
		area?: number;
		length?: number;
		volume?: number;
		unit?: string;
	};
	dateCreation: string;
	dateModified?: string;
	createdBy?: string;
	color?: string;
	fillColor?: string;
}

// ----------------------------------------------------------------------------
// Issue Resources
// ----------------------------------------------------------------------------

/** Site issue */
export interface DroneDeployIssue {
	id: string;
	planId: string;
	title: string;
	description?: string;
	status: string;
	priority?: string;
	assignee?: string;
	location?: {
		lat: number;
		lng: number;
	};
	dateCreation: string;
	dateModified?: string;
	dateResolved?: string;
	tags?: string[];
	images?: string[];
}

// ----------------------------------------------------------------------------
// Asset Resources
// ----------------------------------------------------------------------------

/** Captured asset (image, 3D model, point cloud) */
export interface DroneDeployAsset {
	id: string;
	planId: string;
	type: string;
	filename?: string;
	fileSize?: number;
	mimeType?: string;
	url?: string;
	thumbnailUrl?: string;
	dateCreation: string;
	location?: {
		lat: number;
		lng: number;
		altitude?: number;
	};
	metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Volume / Elevation Resources
// ----------------------------------------------------------------------------

/** Volume measurement report */
export interface DroneDeployVolumeReport {
	id: string;
	mapId: string;
	name?: string;
	cut: number;
	fill: number;
	net: number;
	unit: string;
	baseElevation?: number;
	area?: number;
	areaUnit?: string;
	dateCreation: string;
}

/** Elevation profile data point */
export interface DroneDeployElevationPoint {
	distance: number;
	elevation: number;
	lat: number;
	lng: number;
}

// ----------------------------------------------------------------------------
// GraphQL wrapper
// ----------------------------------------------------------------------------

/** GraphQL response wrapper */
export interface DroneDeployGraphQLResult<T = unknown> {
	data: T;
	errors?: Array<{
		message: string;
		locations?: Array<{ line: number; column: number }>;
		path?: string[];
	}>;
}

// ============================================================================
// DRONEDEPLOY INTEGRATION CLASS
// ============================================================================

/**
 * DroneDeploy API Integration
 *
 * Weniger, aber besser: Reality capture intelligence for construction sites.
 *
 * API: GraphQL (primary)
 * Auth: Bearer token (API key)
 * Rate Limit: Enterprise-level
 * Pagination: Cursor-based (GraphQL)
 */
export class DroneDeploy extends BaseAPIClient {
	constructor(config: DroneDeployConfig) {
		if (!config.apiKey) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'DroneDeploy API key is required',
				{ integration: 'dronedeploy' }
			);
		}

		super({
			accessToken: config.apiKey,
			apiUrl: 'https://www.dronedeploy.com',
			timeout: config.timeout,
			errorContext: { integration: 'dronedeploy' },
		});
	}

	// ==========================================================================
	// GRAPHQL CORE
	// ==========================================================================

	/**
	 * Execute a raw GraphQL query
	 */
	async query<T = unknown>(
		graphql: string,
		variables?: Record<string, unknown>
	): Promise<ActionResult<DroneDeployGraphQLResult<T>>> {
		try {
			const result = await this.postJson<DroneDeployGraphQLResult<T>>(
				'/graphql',
				{ query: graphql, variables }
			);

			if (result.errors && result.errors.length > 0) {
				return ActionResult.error(
					`GraphQL errors: ${result.errors.map(e => e.message).join('; ')}`,
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'query' }
				);
			}

			return createActionResult({
				data: result,
				integration: 'dronedeploy',
				action: 'query',
				schema: 'dronedeploy.graphql.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'query');
		}
	}

	// ==========================================================================
	// PLANS
	// ==========================================================================

	/**
	 * Get all plans (sites/projects)
	 */
	async getPlans(): Promise<ActionResult<DroneDeployPlan[]>> {
		const graphql = `{
			viewer {
				plans {
					edges {
						node {
							id
							name
							geometry { lat lng }
							location { lat lng }
							status
							dateCreation
							imageCount
						}
					}
				}
			}
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{
				viewer: { plans: { edges: Array<{ node: DroneDeployPlan }> } }
			}>>('/graphql', { query: graphql });

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-plans' }
				);
			}

			const plans = result.data.viewer.plans.edges.map(e => e.node);

			return createActionResult({
				data: plans,
				integration: 'dronedeploy',
				action: 'get-plans',
				schema: 'dronedeploy.plans.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-plans');
		}
	}

	/**
	 * Get a specific plan
	 */
	async getPlan(planId: string): Promise<ActionResult<DroneDeployPlan>> {
		const graphql = `query($id: ID!) {
			node(id: $id) {
				... on Plan {
					id name
					geometry { lat lng }
					location { lat lng }
					status dateCreation imageCount
				}
			}
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{ node: DroneDeployPlan }>>(
				'/graphql',
				{ query: graphql, variables: { id: planId } }
			);

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-plan' }
				);
			}

			return createActionResult({
				data: result.data.node,
				integration: 'dronedeploy',
				action: 'get-plan',
				schema: 'dronedeploy.plan.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-plan');
		}
	}

	// ==========================================================================
	// MAPS
	// ==========================================================================

	/**
	 * Get maps for a plan
	 */
	async getMaps(planId: string): Promise<ActionResult<DroneDeployMap[]>> {
		const graphql = `query($planId: ID!) {
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
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{
				node: { maps: { edges: Array<{ node: DroneDeployMap }> } }
			}>>('/graphql', { query: graphql, variables: { planId } });

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-maps' }
				);
			}

			const maps = result.data.node.maps.edges.map(e => ({
				...e.node,
				planId,
			}));

			return createActionResult({
				data: maps,
				integration: 'dronedeploy',
				action: 'get-maps',
				schema: 'dronedeploy.maps.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-maps');
		}
	}

	// ==========================================================================
	// ANNOTATIONS
	// ==========================================================================

	/**
	 * Get annotations for a map
	 */
	async getAnnotations(mapId: string): Promise<ActionResult<DroneDeployAnnotation[]>> {
		const graphql = `query($mapId: ID!) {
			node(id: $mapId) {
				... on Map {
					annotations {
						edges {
							node {
								id type description
								geometry { type coordinates }
								measurements { area length volume unit }
								dateCreation dateModified createdBy
								color fillColor
							}
						}
					}
				}
			}
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{
				node: { annotations: { edges: Array<{ node: DroneDeployAnnotation }> } }
			}>>('/graphql', { query: graphql, variables: { mapId } });

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-annotations' }
				);
			}

			const annotations = result.data.node.annotations.edges.map(e => ({
				...e.node,
				mapId,
			}));

			return createActionResult({
				data: annotations,
				integration: 'dronedeploy',
				action: 'get-annotations',
				schema: 'dronedeploy.annotations.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-annotations');
		}
	}

	// ==========================================================================
	// ISSUES
	// ==========================================================================

	/**
	 * Get issues for a plan
	 */
	async getIssues(planId: string): Promise<ActionResult<DroneDeployIssue[]>> {
		const graphql = `query($planId: ID!) {
			node(id: $planId) {
				... on Plan {
					issues {
						edges {
							node {
								id title description status priority
								assignee
								location { lat lng }
								dateCreation dateModified dateResolved
								tags images
							}
						}
					}
				}
			}
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{
				node: { issues: { edges: Array<{ node: DroneDeployIssue }> } }
			}>>('/graphql', { query: graphql, variables: { planId } });

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-issues' }
				);
			}

			const issues = result.data.node.issues.edges.map(e => ({
				...e.node,
				planId,
			}));

			return createActionResult({
				data: issues,
				integration: 'dronedeploy',
				action: 'get-issues',
				schema: 'dronedeploy.issues.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-issues');
		}
	}

	// ==========================================================================
	// ASSETS
	// ==========================================================================

	/**
	 * Get assets (images, models, point clouds) for a plan
	 */
	async getAssets(planId: string): Promise<ActionResult<DroneDeployAsset[]>> {
		const graphql = `query($planId: ID!) {
			node(id: $planId) {
				... on Plan {
					uploads {
						edges {
							node {
								id filename fileSize mimeType
								url thumbnailUrl dateCreation
								location { lat lng altitude }
							}
						}
					}
				}
			}
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{
				node: { uploads: { edges: Array<{ node: DroneDeployAsset }> } }
			}>>('/graphql', { query: graphql, variables: { planId } });

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-assets' }
				);
			}

			const assets = result.data.node.uploads.edges.map(e => ({
				...e.node,
				planId,
				type: e.node.mimeType || 'unknown',
			}));

			return createActionResult({
				data: assets,
				integration: 'dronedeploy',
				action: 'get-assets',
				schema: 'dronedeploy.assets.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-assets');
		}
	}

	// ==========================================================================
	// VOLUMES & ELEVATION
	// ==========================================================================

	/**
	 * Get volume measurement report
	 */
	async getVolumeReport(mapId: string, annotationId: string): Promise<ActionResult<DroneDeployVolumeReport>> {
		const graphql = `query($mapId: ID!, $annotationId: ID!) {
			node(id: $mapId) {
				... on Map {
					annotation(id: $annotationId) {
						id
						measurements {
							volume
							area
							unit
						}
					}
				}
			}
		}`;

		try {
			const result = await this.postJson<DroneDeployGraphQLResult<{
				node: { annotation: { id: string; measurements: { volume: number; area: number; unit: string } } }
			}>>('/graphql', { query: graphql, variables: { mapId, annotationId } });

			if (result.errors?.length) {
				return ActionResult.error(
					result.errors.map(e => e.message).join('; '),
					ErrorCode.API_ERROR,
					{ integration: 'dronedeploy', action: 'get-volume-report' }
				);
			}

			const ann = result.data.node.annotation;
			const report: DroneDeployVolumeReport = {
				id: ann.id,
				mapId,
				cut: 0,
				fill: 0,
				net: ann.measurements.volume,
				unit: ann.measurements.unit,
				area: ann.measurements.area,
				areaUnit: ann.measurements.unit,
				dateCreation: new Date().toISOString(),
			};

			return createActionResult({
				data: report,
				integration: 'dronedeploy',
				action: 'get-volume-report',
				schema: 'dronedeploy.volume-report.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-volume-report');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'dronedeploy',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'dronedeploy',
			action,
		});
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: true,
			canHandleAttachments: true,
			supportsSearch: false,
			supportsPagination: true,
			supportsNesting: true,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// STANDARD DATA CONVERTERS
// ============================================================================

export function toStandardSite(plan: DroneDeployPlan) {
	return {
		id: plan.id,
		name: plan.name,
		location: plan.location ? {
			coordinates: { lat: plan.location.lat, lng: plan.location.lng },
		} : undefined,
		imageCount: plan.imageCount,
		source: 'dronedeploy' as const,
		sourceId: plan.id,
	};
}

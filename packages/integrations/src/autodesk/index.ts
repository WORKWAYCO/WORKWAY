/**
 * Autodesk Platform Services (APS) Integration for WORKWAY
 *
 * BIM data access, document management, and model coordination for AEC projects.
 * Covers Data Management, Model Derivative, Data Exchange, and AEC Data Model APIs.
 *
 * Zuhandenheit: Construction teams don't want "GraphQL queries" - they want:
 * - Models that coordinate themselves
 * - Design changes that surface impact automatically
 * - Documents that live where the work is
 * - BIM data that flows into scheduling and cost without re-entry
 *
 * @example
 * ```typescript
 * import { Autodesk } from '@workwayco/integrations/autodesk';
 *
 * const autodesk = new Autodesk({
 *   accessToken: process.env.AUTODESK_ACCESS_TOKEN,
 * });
 *
 * // List all hubs
 * const hubs = await autodesk.getHubs();
 *
 * // Get projects in a hub
 * const projects = await autodesk.getProjects('hub-id');
 *
 * // Query BIM data via AEC Data Model GraphQL
 * const result = await autodesk.queryAECDataModel(`{
 *   projects { results { id name } }
 * }`);
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { BaseAPIClient, buildQueryString } from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Autodesk APS integration configuration
 *
 * Authentication: OAuth 2.0 (2-legged for app context, 3-legged for user context)
 * - 2-legged: client_credentials grant for app-level access
 * - 3-legged: authorization_code grant for user-delegated access
 */
export interface AutodeskConfig {
	/** OAuth access token */
	accessToken: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** OAuth token refresh configuration */
	tokenRefresh?: {
		refreshToken: string;
		clientId: string;
		clientSecret: string;
		onTokenRefreshed: (accessToken: string, refreshToken?: string) => void | Promise<void>;
	};
}

// ----------------------------------------------------------------------------
// Data Management Resources
// ----------------------------------------------------------------------------

/** Autodesk hub (BIM 360 account, ACC account, or Fusion Team) */
export interface AutodeskHub {
	type: string;
	id: string;
	attributes: {
		name: string;
		region: string;
		extension: {
			type: string;
			version: string;
			data?: Record<string, unknown>;
		};
	};
	relationships?: Record<string, unknown>;
	links?: Record<string, string>;
}

/** Autodesk project within a hub */
export interface AutodeskProject {
	type: string;
	id: string;
	attributes: {
		name: string;
		scopes: string[];
		extension: {
			type: string;
			version: string;
			data?: Record<string, unknown>;
		};
	};
	relationships?: {
		hub?: { data: { type: string; id: string } };
		rootFolder?: { data: { type: string; id: string } };
	};
	links?: Record<string, string>;
}

/** Folder in Autodesk project */
export interface AutodeskFolder {
	type: string;
	id: string;
	attributes: {
		name: string;
		displayName: string;
		objectCount: number;
		createTime: string;
		createUserId: string;
		lastModifiedTime: string;
		lastModifiedUserId: string;
		extension: {
			type: string;
			version: string;
			data?: Record<string, unknown>;
		};
	};
	relationships?: Record<string, unknown>;
}

/** Item (file) in Autodesk project */
export interface AutodeskItem {
	type: string;
	id: string;
	attributes: {
		displayName: string;
		createTime: string;
		createUserId: string;
		lastModifiedTime: string;
		lastModifiedUserId: string;
		extension: {
			type: string;
			version: string;
			data?: Record<string, unknown>;
		};
	};
	relationships?: {
		tip?: { data: { type: string; id: string } };
		versions?: { links: { related: string } };
	};
}

/** Version of an item */
export interface AutodeskVersion {
	type: string;
	id: string;
	attributes: {
		name: string;
		displayName: string;
		versionNumber: number;
		mimeType?: string;
		fileType?: string;
		storageSize?: number;
		createTime: string;
		createUserId: string;
		lastModifiedTime: string;
		lastModifiedUserId: string;
		extension: {
			type: string;
			version: string;
			data?: Record<string, unknown>;
		};
	};
}

// ----------------------------------------------------------------------------
// Model Derivative Resources
// ----------------------------------------------------------------------------

/** Model translation job manifest */
export interface AutodeskManifest {
	type: string;
	hasThumbnail: string;
	status: 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout';
	progress: string;
	region: string;
	urn: string;
	version: string;
	derivatives?: AutodeskDerivative[];
}

/** Model derivative (viewable, SVF, etc.) */
export interface AutodeskDerivative {
	name: string;
	hasThumbnail: string;
	status: string;
	progress: string;
	outputType: string;
	children?: AutodeskDerivativeChild[];
}

/** Child of a derivative (geometry, property database, etc.) */
export interface AutodeskDerivativeChild {
	guid: string;
	type: string;
	role: string;
	name?: string;
	status: string;
	progress?: string;
	mime?: string;
	urn?: string;
}

/** Model metadata (object tree, properties) */
export interface AutodeskModelMetadata {
	type: string;
	name: string;
	guid: string;
	role: string;
}

// ----------------------------------------------------------------------------
// Data Exchange Resources
// ----------------------------------------------------------------------------

/** Data exchange container */
export interface AutodeskExchange {
	id: string;
	type: string;
	attributes: {
		name: string;
		description?: string;
		status: string;
		createdBy: string;
		createdDate: string;
		lastModifiedDate: string;
		fileUrn?: string;
	};
}

/** Data exchange snapshot */
export interface AutodeskExchangeSnapshot {
	id: string;
	collectionId: string;
	createdDate: string;
	components?: AutodeskExchangeComponent[];
}

/** Component within a data exchange */
export interface AutodeskExchangeComponent {
	id: string;
	type: string;
	name: string;
	properties?: Record<string, unknown>;
	geometry?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// AEC Data Model (GraphQL) Resources
// ----------------------------------------------------------------------------

/** GraphQL query result wrapper */
export interface AutodeskGraphQLResult<T = unknown> {
	data: T;
	errors?: Array<{
		message: string;
		locations?: Array<{ line: number; column: number }>;
		path?: string[];
		extensions?: Record<string, unknown>;
	}>;
}

/** AEC project from Data Model */
export interface AECProject {
	id: string;
	name: string;
	alternativeIdentifiers?: {
		externalId?: string;
		externalSystem?: string;
	};
}

/** AEC element from Data Model */
export interface AECElement {
	id: string;
	name: string;
	category: string;
	properties?: Record<string, unknown>;
	classification?: {
		uniformat?: string;
		omniclass?: string;
	};
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetProjectsOptions {
	hubId: string;
	/** Page number */
	pageNumber?: number;
	/** Page limit (max 200) */
	pageLimit?: number;
}

export interface GetFolderContentsOptions {
	projectId: string;
	folderId: string;
	/** Page number */
	pageNumber?: number;
	/** Page limit */
	pageLimit?: number;
	/** Filter by file extension */
	filterExtension?: string;
}

export interface TranslateModelOptions {
	/** Base64-encoded URN of the source file */
	urn: string;
	/** Output format */
	outputFormat?: 'svf' | 'svf2' | 'obj' | 'step' | 'stl' | 'iges';
	/** Output views */
	views?: ('2d' | '3d')[];
}

export interface GetExchangesOptions {
	/** Collection ID (typically the project/folder ID) */
	collectionId: string;
	/** Page cursor for pagination */
	cursor?: string;
	/** Page limit */
	limit?: number;
}

// ============================================================================
// AUTODESK INTEGRATION CLASS
// ============================================================================

/**
 * Autodesk Platform Services (APS) API Integration
 *
 * Weniger, aber besser: BIM data coordination for AEC projects.
 *
 * APIs covered:
 * - Data Management API (hubs, projects, folders, items, versions)
 * - Model Derivative API (model translation, metadata extraction)
 * - Data Exchange API (selective BIM data sharing)
 * - AEC Data Model API (GraphQL for BIM element queries)
 *
 * Auth: OAuth 2.0 (2-legged or 3-legged)
 * Rate Limit: Varies by endpoint (typically 100-600 req/min)
 * Pagination: JSON:API cursor-based or page-based
 */
export class Autodesk extends BaseAPIClient {
	private static readonly DATA_API = 'https://developer.api.autodesk.com';
	private static readonly DERIV_API = 'https://developer.api.autodesk.com';
	private static readonly EXCHANGE_API = 'https://developer.api.autodesk.com';
	private static readonly AEC_DM_API = 'https://developer.api.autodesk.com/aec/graphql';

	constructor(config: AutodeskConfig) {
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Autodesk access token is required',
				{ integration: 'autodesk' }
			);
		}

		super({
			accessToken: config.accessToken,
			apiUrl: Autodesk.DATA_API,
			timeout: config.timeout,
			errorContext: { integration: 'autodesk' },
			tokenRefresh: config.tokenRefresh ? {
				refreshToken: config.tokenRefresh.refreshToken,
				tokenEndpoint: 'https://developer.api.autodesk.com/authentication/v2/token',
				clientId: config.tokenRefresh.clientId,
				clientSecret: config.tokenRefresh.clientSecret,
				onTokenRefreshed: config.tokenRefresh.onTokenRefreshed,
			} : undefined,
		});
	}

	// ==========================================================================
	// DATA MANAGEMENT - HUBS
	// ==========================================================================

	/**
	 * Get all hubs the user has access to
	 */
	async getHubs(): Promise<ActionResult<AutodeskHub[]>> {
		try {
			const response = await this.getJson<{ data: AutodeskHub[] }>(
				'/project/v1/hubs'
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-hubs',
				schema: 'autodesk.hubs.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-hubs');
		}
	}

	/**
	 * Get a specific hub
	 */
	async getHub(hubId: string): Promise<ActionResult<AutodeskHub>> {
		try {
			const response = await this.getJson<{ data: AutodeskHub }>(
				`/project/v1/hubs/${hubId}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-hub',
				schema: 'autodesk.hub.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-hub');
		}
	}

	// ==========================================================================
	// DATA MANAGEMENT - PROJECTS
	// ==========================================================================

	/**
	 * Get projects in a hub
	 */
	async getProjects(hubId: string, options: Omit<GetProjectsOptions, 'hubId'> = {}): Promise<ActionResult<AutodeskProject[]>> {
		const { pageNumber, pageLimit } = options;

		const query = buildQueryString({
			'page[number]': pageNumber,
			'page[limit]': pageLimit ? Math.min(pageLimit, 200) : undefined,
		});

		try {
			const response = await this.getJson<{ data: AutodeskProject[] }>(
				`/project/v1/hubs/${hubId}/projects${query}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-projects',
				schema: 'autodesk.projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-projects');
		}
	}

	/**
	 * Get a specific project
	 */
	async getProject(hubId: string, projectId: string): Promise<ActionResult<AutodeskProject>> {
		try {
			const response = await this.getJson<{ data: AutodeskProject }>(
				`/project/v1/hubs/${hubId}/projects/${projectId}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-project',
				schema: 'autodesk.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-project');
		}
	}

	// ==========================================================================
	// DATA MANAGEMENT - FOLDERS & ITEMS
	// ==========================================================================

	/**
	 * Get top-level folders in a project
	 */
	async getTopFolders(hubId: string, projectId: string): Promise<ActionResult<AutodeskFolder[]>> {
		try {
			const response = await this.getJson<{ data: AutodeskFolder[] }>(
				`/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-top-folders',
				schema: 'autodesk.folders.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-top-folders');
		}
	}

	/**
	 * Get folder contents (items and sub-folders)
	 */
	async getFolderContents(projectId: string, folderId: string, options: Omit<GetFolderContentsOptions, 'projectId' | 'folderId'> = {}): Promise<ActionResult<(AutodeskItem | AutodeskFolder)[]>> {
		const { pageNumber, pageLimit, filterExtension } = options;

		const query = buildQueryString({
			'page[number]': pageNumber,
			'page[limit]': pageLimit,
			'filter[extension.type]': filterExtension,
		});

		try {
			const response = await this.getJson<{ data: (AutodeskItem | AutodeskFolder)[] }>(
				`/data/v1/projects/${projectId}/folders/${folderId}/contents${query}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-folder-contents',
				schema: 'autodesk.folder-contents.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-folder-contents');
		}
	}

	/**
	 * Get item details
	 */
	async getItem(projectId: string, itemId: string): Promise<ActionResult<AutodeskItem>> {
		try {
			const response = await this.getJson<{ data: AutodeskItem }>(
				`/data/v1/projects/${projectId}/items/${itemId}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-item',
				schema: 'autodesk.item.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-item');
		}
	}

	/**
	 * Get versions of an item
	 */
	async getVersions(projectId: string, itemId: string): Promise<ActionResult<AutodeskVersion[]>> {
		try {
			const response = await this.getJson<{ data: AutodeskVersion[] }>(
				`/data/v1/projects/${projectId}/items/${itemId}/versions`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-versions',
				schema: 'autodesk.versions.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-versions');
		}
	}

	// ==========================================================================
	// MODEL DERIVATIVE
	// ==========================================================================

	/**
	 * Submit a model for translation (conversion to viewable format)
	 */
	async translateModel(options: TranslateModelOptions): Promise<ActionResult<{ urn: string; result: string }>> {
		const { urn, outputFormat = 'svf2', views = ['2d', '3d'] } = options;

		try {
			const result = await this.postJson<{ urn: string; result: string }>(
				'/modelderivative/v2/designdata/job',
				{
					input: { urn },
					output: {
						destination: { region: 'us' },
						formats: [{
							type: outputFormat,
							views,
						}],
					},
				}
			);

			return createActionResult({
				data: result,
				integration: 'autodesk',
				action: 'translate-model',
				schema: 'autodesk.translation-job.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'translate-model');
		}
	}

	/**
	 * Get translation status/manifest
	 */
	async getManifest(urn: string): Promise<ActionResult<AutodeskManifest>> {
		try {
			const manifest = await this.getJson<AutodeskManifest>(
				`/modelderivative/v2/designdata/${urn}/manifest`
			);

			return createActionResult({
				data: manifest,
				integration: 'autodesk',
				action: 'get-manifest',
				schema: 'autodesk.manifest.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-manifest');
		}
	}

	/**
	 * Get model metadata (object tree)
	 */
	async getModelMetadata(urn: string): Promise<ActionResult<AutodeskModelMetadata[]>> {
		try {
			const response = await this.getJson<{ data: { metadata: AutodeskModelMetadata[] } }>(
				`/modelderivative/v2/designdata/${urn}/metadata`
			);

			return createActionResult({
				data: response.data.metadata,
				integration: 'autodesk',
				action: 'get-model-metadata',
				schema: 'autodesk.model-metadata.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-model-metadata');
		}
	}

	/**
	 * Get properties of objects in a model view
	 */
	async getModelProperties(urn: string, modelGuid: string): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const response = await this.getJson<Record<string, unknown>>(
				`/modelderivative/v2/designdata/${urn}/metadata/${modelGuid}/properties`
			);

			return createActionResult({
				data: response,
				integration: 'autodesk',
				action: 'get-model-properties',
				schema: 'autodesk.model-properties.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-model-properties');
		}
	}

	// ==========================================================================
	// DATA EXCHANGE
	// ==========================================================================

	/**
	 * Get data exchanges for a collection
	 */
	async getExchanges(collectionId: string, options: Omit<GetExchangesOptions, 'collectionId'> = {}): Promise<ActionResult<AutodeskExchange[]>> {
		const { cursor, limit } = options;

		const query = buildQueryString({
			'page[cursor]': cursor,
			'page[limit]': limit,
		});

		try {
			const response = await this.getJson<{ data: AutodeskExchange[] }>(
				`/exchange/v1/collections/${collectionId}/exchanges${query}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-exchanges',
				schema: 'autodesk.exchanges.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-exchanges');
		}
	}

	/**
	 * Get data exchange details
	 */
	async getExchange(exchangeId: string): Promise<ActionResult<AutodeskExchange>> {
		try {
			const response = await this.getJson<{ data: AutodeskExchange }>(
				`/exchange/v1/exchanges/${exchangeId}`
			);

			return createActionResult({
				data: response.data,
				integration: 'autodesk',
				action: 'get-exchange',
				schema: 'autodesk.exchange.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-exchange');
		}
	}

	/**
	 * Get exchange snapshot (full data payload)
	 */
	async getExchangeSnapshot(exchangeId: string): Promise<ActionResult<AutodeskExchangeSnapshot>> {
		try {
			const snapshot = await this.getJson<AutodeskExchangeSnapshot>(
				`/exchange/v1/exchanges/${exchangeId}/snapshots:exchange`
			);

			return createActionResult({
				data: snapshot,
				integration: 'autodesk',
				action: 'get-exchange-snapshot',
				schema: 'autodesk.exchange-snapshot.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-exchange-snapshot');
		}
	}

	// ==========================================================================
	// AEC DATA MODEL (GraphQL)
	// ==========================================================================

	/**
	 * Execute a GraphQL query against the AEC Data Model API
	 *
	 * The AEC Data Model API uses GraphQL, enabling precise queries for
	 * BIM element data, properties, and relationships.
	 */
	async queryAECDataModel<T = unknown>(
		query: string,
		variables?: Record<string, unknown>
	): Promise<ActionResult<AutodeskGraphQLResult<T>>> {
		try {
			const result = await this.postJson<AutodeskGraphQLResult<T>>(
				'/aec/graphql',
				{ query, variables }
			);

			if (result.errors && result.errors.length > 0) {
				return ActionResult.error(
					`GraphQL errors: ${result.errors.map(e => e.message).join('; ')}`,
					ErrorCode.API_ERROR,
					{ integration: 'autodesk', action: 'query-aec-data-model' }
				);
			}

			return createActionResult({
				data: result,
				integration: 'autodesk',
				action: 'query-aec-data-model',
				schema: 'autodesk.aec-data-model.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'query-aec-data-model');
		}
	}

	/**
	 * Get AEC projects via GraphQL
	 */
	async getAECProjects(): Promise<ActionResult<AECProject[]>> {
		const query = `{
			projects {
				pagination { cursor }
				results {
					id
					name
					alternativeIdentifiers { externalId externalSystem }
				}
			}
		}`;

		try {
			const result = await this.postJson<AutodeskGraphQLResult<{ projects: { results: AECProject[] } }>>(
				'/aec/graphql',
				{ query }
			);

			if (result.errors && result.errors.length > 0) {
				return ActionResult.error(
					`GraphQL errors: ${result.errors.map(e => e.message).join('; ')}`,
					ErrorCode.API_ERROR,
					{ integration: 'autodesk', action: 'get-aec-projects' }
				);
			}

			return createActionResult({
				data: result.data.projects.results,
				integration: 'autodesk',
				action: 'get-aec-projects',
				schema: 'autodesk.aec-projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-aec-projects');
		}
	}

	/**
	 * Get elements for an AEC project via GraphQL
	 */
	async getAECElements(projectId: string, category?: string): Promise<ActionResult<AECElement[]>> {
		const filter = category ? `filter: { category: "${category}" }` : '';
		const query = `{
			elements(projectId: "${projectId}" ${filter}) {
				pagination { cursor }
				results {
					id
					name
					category
					properties
					classification { uniformat omniclass }
				}
			}
		}`;

		try {
			const result = await this.postJson<AutodeskGraphQLResult<{ elements: { results: AECElement[] } }>>(
				'/aec/graphql',
				{ query }
			);

			if (result.errors && result.errors.length > 0) {
				return ActionResult.error(
					`GraphQL errors: ${result.errors.map(e => e.message).join('; ')}`,
					ErrorCode.API_ERROR,
					{ integration: 'autodesk', action: 'get-aec-elements' }
				);
			}

			return createActionResult({
				data: result.data.elements.results,
				integration: 'autodesk',
				action: 'get-aec-elements',
				schema: 'autodesk.aec-elements.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-aec-elements');
		}
	}

	// ==========================================================================
	// DESIGN AUTOMATION
	// ==========================================================================

	/**
	 * Get design automation work item status
	 */
	async getWorkItemStatus(workItemId: string): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.getJson<Record<string, unknown>>(
				`/da/us-east/v3/workitems/${workItemId}`
			);

			return createActionResult({
				data: result,
				integration: 'autodesk',
				action: 'get-work-item-status',
				schema: 'autodesk.work-item.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-work-item-status');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'autodesk',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'autodesk',
			action,
		});
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true,
			supportsSearch: true,
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

/**
 * Convert Autodesk project to standard project format
 */
export function toStandardProject(project: AutodeskProject) {
	return {
		id: project.id,
		name: project.attributes.name,
		status: 'active',
		source: 'autodesk' as const,
		sourceId: project.id,
	};
}

/**
 * Convert Autodesk hub to standard organization format
 */
export function toStandardOrganization(hub: AutodeskHub) {
	return {
		id: hub.id,
		name: hub.attributes.name,
		region: hub.attributes.region,
		source: 'autodesk' as const,
		sourceId: hub.id,
	};
}

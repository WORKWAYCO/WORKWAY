/**
 * Bridgit Bench API Integration for WORKWAY
 *
 * Workforce planning and resource management for construction companies.
 * Covers projects, people, roles, allocations, and certifications.
 *
 * Zuhandenheit: Ops teams don't want "resource allocation APIs" - they want:
 * - The right superintendent on the right job
 * - Visibility into who's available next month
 * - Certs that don't expire without someone noticing
 * - Project staffing that doesn't require a spreadsheet
 *
 * @example
 * ```typescript
 * import { BridgitBench } from '@workwayco/integrations/bridgit-bench';
 *
 * const bench = new BridgitBench({
 *   serviceAccountId: process.env.BRIDGIT_SERVICE_ACCOUNT_ID,
 *   password: process.env.BRIDGIT_PASSWORD,
 *   orgUrl: 'https://app.gobridgit.com',
 * });
 *
 * // Authenticate
 * await bench.authenticate();
 *
 * // Get all projects
 * const projects = await bench.getProjects();
 *
 * // Get people and their allocations
 * const people = await bench.getPeople();
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
 * Bridgit Bench integration configuration
 *
 * Authentication: Service account (GUID + password) -> Bearer token
 * Sessions: max 3 concurrent, expire after 24h inactivity
 */
export interface BridgitBenchConfig {
	/** Service account GUID */
	serviceAccountId: string;
	/** Service account password */
	password: string;
	/** Organization URL (e.g. https://app.gobridgit.com) */
	orgUrl?: string;
	/** Pre-authenticated access token (skips authenticate()) */
	accessToken?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Auth Resources
// ----------------------------------------------------------------------------

/** Authentication response */
export interface BridgitAuthResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

// ----------------------------------------------------------------------------
// Project Resources
// ----------------------------------------------------------------------------

/** Bridgit project */
export interface BridgitProject {
	id: string;
	name: string;
	number?: string;
	status?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	start_date?: string;
	end_date?: string;
	value?: number;
	client_name?: string;
	project_type?: string;
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// People Resources
// ----------------------------------------------------------------------------

/** Person (team member) */
export interface BridgitPerson {
	id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone?: string;
	title?: string;
	department?: string;
	status: string;
	hire_date?: string;
	skills?: string[];
	certifications?: BridgitCertification[];
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// Role Resources
// ----------------------------------------------------------------------------

/** Role on a project */
export interface BridgitRole {
	id: string;
	project_id: string;
	title: string;
	start_date?: string;
	end_date?: string;
	person_id?: string;
	person_name?: string;
	status: string;
	required_skills?: string[];
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// Allocation Resources
// ----------------------------------------------------------------------------

/** Resource allocation */
export interface BridgitAllocation {
	id: string;
	person_id: string;
	project_id: string;
	role_id?: string;
	start_date: string;
	end_date: string;
	percentage?: number;
	status: string;
}

// ----------------------------------------------------------------------------
// Certification Resources
// ----------------------------------------------------------------------------

/** Worker certification */
export interface BridgitCertification {
	id: string;
	person_id: string;
	name: string;
	issuer?: string;
	issue_date?: string;
	expiration_date?: string;
	status: string;
	certificate_number?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface CreateProjectOptions {
	name: string;
	number?: string;
	address?: string;
	city?: string;
	state?: string;
	startDate?: string;
	endDate?: string;
	value?: number;
	clientName?: string;
	projectType?: string;
}

export interface CreateRoleOptions {
	projectId: string;
	title: string;
	startDate?: string;
	endDate?: string;
	requiredSkills?: string[];
}

export interface GetAllocationsOptions {
	personId?: string;
	projectId?: string;
	startDate?: string;
	endDate?: string;
}

// ============================================================================
// BRIDGIT BENCH INTEGRATION CLASS
// ============================================================================

/**
 * Bridgit Bench API Integration
 *
 * Weniger, aber besser: Workforce planning for construction companies.
 *
 * API: REST
 * Auth: Service account -> Bearer token (POST /auth/signin)
 * Rate Limit: Not documented
 * Sessions: max 3 concurrent, 24h inactivity timeout
 */
export class BridgitBench extends BaseAPIClient {
	private readonly serviceAccountId: string;
	private readonly serviceAccountPassword: string;
	private bearerToken: string;
	private refreshTokenValue: string = '';

	constructor(config: BridgitBenchConfig) {
		if (!config.serviceAccountId && !config.accessToken) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Bridgit Bench service account ID or access token is required',
				{ integration: 'bridgit-bench' }
			);
		}

		const baseUrl = config.orgUrl || 'https://app.gobridgit.com';

		super({
			accessToken: config.accessToken || 'pending-auth',
			apiUrl: baseUrl,
			timeout: config.timeout,
			errorContext: { integration: 'bridgit-bench' },
		});

		this.serviceAccountId = config.serviceAccountId;
		this.serviceAccountPassword = config.password || '';
		this.bearerToken = config.accessToken || '';
	}

	// ==========================================================================
	// AUTHENTICATION
	// ==========================================================================

	/**
	 * Authenticate with service account credentials
	 */
	async authenticate(): Promise<ActionResult<BridgitAuthResponse>> {
		try {
			const response = await this.postJson<BridgitAuthResponse>(
				'/rp/api/v1/auth/signin',
				{
					username: this.serviceAccountId,
					password: this.serviceAccountPassword,
				}
			);

			this.bearerToken = response.access_token;
			this.refreshTokenValue = response.refresh_token;

			return createActionResult({
				data: response,
				integration: 'bridgit-bench',
				action: 'authenticate',
				schema: 'bridgit-bench.auth.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'authenticate');
		}
	}

	/**
	 * Refresh the access token
	 */
	async refreshToken(token?: string): Promise<ActionResult<BridgitAuthResponse>> {
		try {
			const response = await this.postJson<BridgitAuthResponse>(
				'/rp/api/v1/auth/refresh',
				{ refresh_token: token || this.refreshTokenValue }
			);

			this.bearerToken = response.access_token;
			this.refreshTokenValue = response.refresh_token;

			return createActionResult({
				data: response,
				integration: 'bridgit-bench',
				action: 'refresh-token',
				schema: 'bridgit-bench.auth.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'refresh-token');
		}
	}

	// ==========================================================================
	// PROJECTS
	// ==========================================================================

	/**
	 * Get all projects
	 */
	async getProjects(): Promise<ActionResult<BridgitProject[]>> {
		try {
			const projects = await this.getJson<BridgitProject[]>('/rp/api/v1/projects');

			return createActionResult({
				data: projects,
				integration: 'bridgit-bench',
				action: 'get-projects',
				schema: 'bridgit-bench.projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-projects');
		}
	}

	/**
	 * Get a specific project
	 */
	async getProject(projectId: string): Promise<ActionResult<BridgitProject>> {
		try {
			const project = await this.getJson<BridgitProject>(`/rp/api/v1/projects/${projectId}`);

			return createActionResult({
				data: project,
				integration: 'bridgit-bench',
				action: 'get-project',
				schema: 'bridgit-bench.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-project');
		}
	}

	/**
	 * Create a project
	 */
	async createProject(options: CreateProjectOptions): Promise<ActionResult<BridgitProject>> {
		try {
			const project = await this.postJson<BridgitProject>(
				'/rp/api/v1/projects',
				{
					name: options.name,
					number: options.number,
					address: options.address,
					city: options.city,
					state: options.state,
					start_date: options.startDate,
					end_date: options.endDate,
					value: options.value,
					client_name: options.clientName,
					project_type: options.projectType,
				}
			);

			return createActionResult({
				data: project,
				integration: 'bridgit-bench',
				action: 'create-project',
				schema: 'bridgit-bench.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-project');
		}
	}

	/**
	 * Update a project
	 */
	async updateProject(projectId: string, data: Partial<CreateProjectOptions>): Promise<ActionResult<BridgitProject>> {
		try {
			const project = await this.patchJson<BridgitProject>(
				`/rp/api/v1/projects/${projectId}`,
				data
			);

			return createActionResult({
				data: project,
				integration: 'bridgit-bench',
				action: 'update-project',
				schema: 'bridgit-bench.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'update-project');
		}
	}

	// ==========================================================================
	// PEOPLE
	// ==========================================================================

	/**
	 * Get all people
	 */
	async getPeople(): Promise<ActionResult<BridgitPerson[]>> {
		try {
			const people = await this.getJson<BridgitPerson[]>('/rp/api/v1/people');

			return createActionResult({
				data: people,
				integration: 'bridgit-bench',
				action: 'get-people',
				schema: 'bridgit-bench.people.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-people');
		}
	}

	/**
	 * Get a specific person
	 */
	async getPerson(personId: string): Promise<ActionResult<BridgitPerson>> {
		try {
			const person = await this.getJson<BridgitPerson>(`/rp/api/v1/people/${personId}`);

			return createActionResult({
				data: person,
				integration: 'bridgit-bench',
				action: 'get-person',
				schema: 'bridgit-bench.person.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-person');
		}
	}

	// ==========================================================================
	// ROLES
	// ==========================================================================

	/**
	 * Get roles for a project
	 */
	async getRoles(projectId: string): Promise<ActionResult<BridgitRole[]>> {
		try {
			const roles = await this.getJson<BridgitRole[]>(`/rp/api/v1/projects/${projectId}/roles`);

			return createActionResult({
				data: roles,
				integration: 'bridgit-bench',
				action: 'get-roles',
				schema: 'bridgit-bench.roles.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-roles');
		}
	}

	/**
	 * Create a role on a project
	 */
	async createRole(options: CreateRoleOptions): Promise<ActionResult<BridgitRole>> {
		try {
			const role = await this.postJson<BridgitRole>(
				`/rp/api/v1/projects/${options.projectId}/roles`,
				{
					title: options.title,
					start_date: options.startDate,
					end_date: options.endDate,
					required_skills: options.requiredSkills,
				}
			);

			return createActionResult({
				data: role,
				integration: 'bridgit-bench',
				action: 'create-role',
				schema: 'bridgit-bench.role.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-role');
		}
	}

	// ==========================================================================
	// ALLOCATIONS
	// ==========================================================================

	/**
	 * Get resource allocations
	 */
	async getAllocations(options: GetAllocationsOptions = {}): Promise<ActionResult<BridgitAllocation[]>> {
		const query = buildQueryString({
			person_id: options.personId,
			project_id: options.projectId,
			start_date: options.startDate,
			end_date: options.endDate,
		});

		try {
			const allocations = await this.getJson<BridgitAllocation[]>(`/rp/api/v1/allocations${query}`);

			return createActionResult({
				data: allocations,
				integration: 'bridgit-bench',
				action: 'get-allocations',
				schema: 'bridgit-bench.allocations.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-allocations');
		}
	}

	// ==========================================================================
	// CERTIFICATIONS
	// ==========================================================================

	/**
	 * Get certifications for a person
	 */
	async getCertifications(personId: string): Promise<ActionResult<BridgitCertification[]>> {
		try {
			const certs = await this.getJson<BridgitCertification[]>(`/rp/api/v1/people/${personId}/certifications`);

			return createActionResult({
				data: certs,
				integration: 'bridgit-bench',
				action: 'get-certifications',
				schema: 'bridgit-bench.certifications.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-certifications');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'bridgit-bench',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'bridgit-bench',
			action,
		});
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: false,
			supportsSearch: false,
			supportsPagination: false,
			supportsNesting: false,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

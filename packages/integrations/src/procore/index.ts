/**
 * Procore API Integration for WORKWAY
 *
 * Construction project management integration for 2M+ users worldwide.
 * Covers projects, RFIs, submittals, daily logs, change orders, and more.
 *
 * Zuhandenheit: Contractors don't want "API endpoints" - they want:
 * - RFIs that get answered
 * - Submittals that don't hold up the job
 * - Change orders tracked before they become disputes
 * - Daily logs that write themselves
 *
 * @example
 * ```typescript
 * import { Procore } from '@workwayco/integrations/procore';
 *
 * const procore = new Procore({
 *   accessToken: process.env.PROCORE_ACCESS_TOKEN,
 *   companyId: process.env.PROCORE_COMPANY_ID,
 * });
 *
 * // Get all projects
 * const projects = await procore.getProjects();
 *
 * // Get open RFIs for a project
 * const rfis = await procore.getRFIs({
 *   projectId: '12345',
 *   status: 'open',
 * });
 *
 * // Get today's daily logs
 * const logs = await procore.getDailyLogs({
 *   projectId: '12345',
 *   date: new Date(),
 * });
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
 * Procore integration configuration
 *
 * Authentication: OAuth 2.0 (Authorization Code or Client Credentials)
 * - Authorization Code: For user-context operations
 * - Client Credentials (DMSA): For data sync, reports, backend operations
 */
export interface ProcoreConfig {
	/** OAuth access token */
	accessToken: string;
	/** Procore company ID (required for most operations) */
	companyId: string;
	/** Environment: 'production' | 'sandbox' | 'sandbox-monthly' */
	environment?: 'production' | 'sandbox' | 'sandbox-monthly';
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
// Core Resources
// ----------------------------------------------------------------------------

/**
 * Procore company
 */
export interface ProcoreCompany {
	id: number;
	name: string;
	is_active: boolean;
	logo?: {
		url: string;
	};
	address?: string;
	city?: string;
	state_code?: string;
	zip?: string;
	country_code?: string;
	phone?: string;
	fax?: string;
}

/**
 * Procore project
 */
export interface ProcoreProject {
	id: number;
	name: string;
	display_name?: string;
	project_number?: string;
	address?: string;
	city?: string;
	state_code?: string;
	zip?: string;
	country_code?: string;
	latitude?: number;
	longitude?: number;
	stage?: string;
	project_type?: {
		id: number;
		name: string;
	};
	start_date?: string;
	completion_date?: string;
	active: boolean;
	created_at: string;
	updated_at: string;
	photo_url?: string;
	company?: {
		id: number;
		name: string;
	};
}

/**
 * Procore user
 */
export interface ProcoreUser {
	id: number;
	login: string;
	name: string;
	first_name?: string;
	last_name?: string;
	email_address?: string;
	job_title?: string;
	mobile_phone?: string;
	business_phone?: string;
	is_active: boolean;
	is_employee: boolean;
	vendor?: {
		id: number;
		name: string;
	};
}

// ----------------------------------------------------------------------------
// RFIs (Requests for Information)
// ----------------------------------------------------------------------------

/**
 * Procore RFI (Request for Information)
 */
export interface ProcoreRFI {
	id: number;
	number: string;
	subject: string;
	status: 'draft' | 'open' | 'closed';
	question?: {
		body?: string;
		plain_text_body?: string;
	};
	answer?: {
		body?: string;
		plain_text_body?: string;
	};
	due_date?: string;
	ball_in_court?: ProcoreUser;
	responsible_contractor?: {
		id: number;
		name: string;
	};
	rfi_manager?: ProcoreUser;
	created_at: string;
	updated_at: string;
	closed_at?: string;
	assignees?: ProcoreUser[];
	distribution_list?: ProcoreUser[];
	cost_impact?: 'yes' | 'no' | 'tbd' | 'n/a';
	cost_impact_amount?: number;
	schedule_impact?: 'yes' | 'no' | 'tbd' | 'n/a';
	schedule_impact_days?: number;
	spec_section?: {
		id: number;
		name: string;
	};
	location?: {
		id: number;
		name: string;
	};
}

// ----------------------------------------------------------------------------
// Submittals
// ----------------------------------------------------------------------------

/**
 * Procore submittal
 */
export interface ProcoreSubmittal {
	id: number;
	number: string;
	title: string;
	description?: string;
	status: {
		id: number;
		name: string;
	};
	submittal_type?: string;
	spec_section?: {
		id: number;
		name: string;
	};
	location?: {
		id: number;
		name: string;
	};
	responsible_contractor?: {
		id: number;
		name: string;
	};
	received_from?: ProcoreUser;
	received_date?: string;
	submit_by_date?: string;
	due_date?: string;
	required_on_site_date?: string;
	revision: number;
	ball_in_court?: ProcoreUser;
	approvers?: ProcoreUser[];
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// Daily Logs
// ----------------------------------------------------------------------------

/**
 * Procore daily log header
 */
export interface ProcoreDailyLog {
	id: number;
	log_date: string;
	project_id: number;
	created_at: string;
	updated_at: string;
	weather_conditions?: {
		temperature_high?: number;
		temperature_low?: number;
		conditions?: string;
		precipitation?: string;
	};
	notes?: string;
}

/**
 * Procore manpower log entry
 */
export interface ProcoreManpowerLog {
	id: number;
	daily_log_id: number;
	vendor?: {
		id: number;
		name: string;
	};
	num_workers: number;
	hours_worked?: number;
	notes?: string;
	created_at: string;
	updated_at: string;
}

/**
 * Procore equipment log entry
 */
export interface ProcoreEquipmentLog {
	id: number;
	daily_log_id: number;
	equipment_description: string;
	quantity?: number;
	hours_operated?: number;
	inspection_type?: string;
	notes?: string;
	created_at: string;
	updated_at: string;
}

/**
 * Procore notes log entry
 */
export interface ProcoreNotesLog {
	id: number;
	daily_log_id: number;
	notes: string;
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// Change Orders
// ----------------------------------------------------------------------------

/**
 * Procore change order
 */
export interface ProcoreChangeOrder {
	id: number;
	number: string;
	title: string;
	description?: string;
	status: string;
	due_date?: string;
	invoiced_date?: string;
	paid_date?: string;
	signed_change_order_received_date?: string;
	created_at: string;
	updated_at: string;
	contract_id?: number;
	contractor?: {
		id: number;
		name: string;
	};
	change_order_request?: {
		id: number;
		number: string;
	};
	line_items?: ProcoreChangeOrderLineItem[];
}

/**
 * Procore change order line item
 */
export interface ProcoreChangeOrderLineItem {
	id: number;
	description: string;
	amount: number;
	cost_code?: {
		id: number;
		full_code: string;
		name: string;
	};
}

// ----------------------------------------------------------------------------
// Budget
// ----------------------------------------------------------------------------

/**
 * Procore budget line item
 */
export interface ProcoreBudgetLineItem {
	id: number;
	cost_code: {
		id: number;
		full_code: string;
		name: string;
	};
	budget_line_item_type?: string;
	original_budget_amount: number;
	approved_change_orders: number;
	revised_budget: number;
	committed_costs: number;
	pending_budget_changes: number;
	pending_committed_costs: number;
	projected_cost: number;
	projected_over_under: number;
	forecast_to_complete: number;
	estimated_cost_at_completion: number;
}

// ----------------------------------------------------------------------------
// Drawings
// ----------------------------------------------------------------------------

/**
 * Procore drawing
 */
export interface ProcoreDrawing {
	id: number;
	number: string;
	title: string;
	discipline?: string;
	current_revision?: {
		id: number;
		revision: string;
		revision_date: string;
	};
	drawing_set?: {
		id: number;
		name: string;
	};
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// Webhooks
// ----------------------------------------------------------------------------

/**
 * Procore webhook event
 */
export interface ProcoreWebhookEvent {
	resource_name: string;
	event_type: 'create' | 'update' | 'delete';
	resource_id: number;
	project_id?: number;
	company_id: number;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetProjectsOptions {
	/** Filter by active status */
	active?: boolean;
	/** Filter by stage */
	stage?: string;
	/** Maximum records per page (default: 100, max: 100) */
	perPage?: number;
	/** Page number (default: 1) */
	page?: number;
}

export interface GetRFIsOptions {
	projectId: string;
	/** Filter by status */
	status?: 'draft' | 'open' | 'closed';
	/** Filter by responsible contractor ID */
	responsibleContractorId?: number;
	/** Filter by due date before */
	dueDateBefore?: Date;
	perPage?: number;
	page?: number;
}

export interface GetSubmittalsOptions {
	projectId: string;
	/** Filter by status ID */
	statusId?: number;
	/** Filter by received from ID */
	receivedFromId?: number;
	/** Filter by responsible contractor ID */
	responsibleContractorId?: number;
	perPage?: number;
	page?: number;
}

export interface GetDailyLogsOptions {
	projectId: string;
	/** Filter by specific date */
	date?: Date;
	/** Filter by date range start */
	startDate?: Date;
	/** Filter by date range end */
	endDate?: Date;
	perPage?: number;
	page?: number;
}

export interface GetChangeOrdersOptions {
	projectId: string;
	/** Filter by contract ID */
	contractId?: number;
	/** Filter by status */
	status?: string;
	perPage?: number;
	page?: number;
}

export interface GetBudgetOptions {
	projectId: string;
	/** Include pending costs */
	includePending?: boolean;
	perPage?: number;
	page?: number;
}

export interface CreateRFIOptions {
	projectId: string;
	subject: string;
	question: string;
	/** Due date for response */
	dueDate?: Date;
	/** Assignee user IDs */
	assigneeIds?: number[];
	/** Ball in court user ID */
	ballInCourtId?: number;
	/** Responsible contractor ID */
	responsibleContractorId?: number;
	/** Spec section ID */
	specSectionId?: number;
	/** Location ID */
	locationId?: number;
	/** Whether RFI is draft */
	draft?: boolean;
}

export interface CreateDailyLogOptions {
	projectId: string;
	date: Date;
	notes?: string;
	weatherConditions?: {
		temperatureHigh?: number;
		temperatureLow?: number;
		conditions?: string;
		precipitation?: string;
	};
}

export interface AddManpowerLogOptions {
	projectId: string;
	dailyLogId: number;
	vendorId?: number;
	numWorkers: number;
	hoursWorked?: number;
	notes?: string;
}

// ============================================================================
// PROCORE INTEGRATION CLASS
// ============================================================================

/**
 * Procore API Integration
 *
 * Weniger, aber besser: Construction project management for 2M+ users.
 *
 * API: REST v1.0/v2.0
 * Auth: OAuth 2.0 (Authorization Code or Client Credentials/DMSA)
 * Rate Limit: 3,600 requests/hour (can request increase to 7,200 or 14,400)
 * Pagination: Page-based (page, per_page; max 100)
 */
export class Procore extends BaseAPIClient {
	private readonly companyId: string;

	constructor(config: ProcoreConfig) {
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Procore access token is required',
				{ integration: 'procore' }
			);
		}
		if (!config.companyId) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Procore company ID is required',
				{ integration: 'procore' }
			);
		}

		// Determine API URL based on environment
		const apiUrl = config.environment === 'sandbox'
			? 'https://sandbox.procore.com'
			: config.environment === 'sandbox-monthly'
				? 'https://sandbox-monthly.procore.com'
				: 'https://api.procore.com';

		// Determine token endpoint based on environment
		const tokenEndpoint = config.environment === 'sandbox'
			? 'https://login-sandbox.procore.com/oauth/token'
			: config.environment === 'sandbox-monthly'
				? 'https://login-sandbox-monthly.procore.com/oauth/token'
				: 'https://login.procore.com/oauth/token';

		super({
			accessToken: config.accessToken,
			apiUrl,
			timeout: config.timeout,
			errorContext: { integration: 'procore' },
			tokenRefresh: config.tokenRefresh ? {
				refreshToken: config.tokenRefresh.refreshToken,
				tokenEndpoint,
				clientId: config.tokenRefresh.clientId,
				clientSecret: config.tokenRefresh.clientSecret,
				onTokenRefreshed: config.tokenRefresh.onTokenRefreshed,
			} : undefined,
		});

		this.companyId = config.companyId;
	}

	/**
	 * Get default headers for Procore API requests
	 */
	private getProcoreHeaders(): Record<string, string> {
		return {
			'Procore-Company-Id': this.companyId,
		};
	}

	// ==========================================================================
	// COMPANY & PROJECTS
	// ==========================================================================

	/**
	 * Get company information
	 */
	async getCompany(): Promise<ActionResult<ProcoreCompany>> {
		try {
			const company = await this.getJson<ProcoreCompany>(
				`/rest/v1.0/companies/${this.companyId}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: company,
				integration: 'procore',
				action: 'get-company',
				schema: 'procore.company.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-company');
		}
	}

	/**
	 * Get all projects for the company
	 */
	async getProjects(options: GetProjectsOptions = {}): Promise<ActionResult<ProcoreProject[]>> {
		const { active, stage, perPage = 100, page = 1 } = options;

		const query = buildQueryString({
			company_id: this.companyId,
			'filters[active]': active,
			'filters[stage]': stage,
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const projects = await this.getJson<ProcoreProject[]>(
				`/rest/v1.0/projects${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: projects,
				integration: 'procore',
				action: 'get-projects',
				schema: 'procore.projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-projects');
		}
	}

	/**
	 * Get a single project by ID
	 */
	async getProject(projectId: string): Promise<ActionResult<ProcoreProject>> {
		try {
			const project = await this.getJson<ProcoreProject>(
				`/rest/v1.0/projects/${projectId}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: project,
				integration: 'procore',
				action: 'get-project',
				schema: 'procore.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-project');
		}
	}

	// ==========================================================================
	// RFIs (Requests for Information)
	// ==========================================================================

	/**
	 * Get RFIs for a project
	 *
	 * Zuhandenheit: "What RFIs need answers?" not "GET /rfis?status=open"
	 */
	async getRFIs(options: GetRFIsOptions): Promise<ActionResult<ProcoreRFI[]>> {
		const { projectId, status, responsibleContractorId, dueDateBefore, perPage = 100, page = 1 } = options;

		const query = buildQueryString({
			'filters[status]': status,
			'filters[responsible_contractor_id]': responsibleContractorId,
			'filters[due_date][lt]': dueDateBefore?.toISOString().split('T')[0],
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const rfis = await this.getJson<ProcoreRFI[]>(
				`/rest/v1.0/projects/${projectId}/rfis${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: rfis,
				integration: 'procore',
				action: 'get-rfis',
				schema: 'procore.rfis.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-rfis');
		}
	}

	/**
	 * Get open RFIs for a project (convenience method)
	 */
	async getOpenRFIs(projectId: string): Promise<ActionResult<ProcoreRFI[]>> {
		return this.getRFIs({ projectId, status: 'open' });
	}

	/**
	 * Get overdue RFIs
	 */
	async getOverdueRFIs(projectId: string): Promise<ActionResult<ProcoreRFI[]>> {
		return this.getRFIs({
			projectId,
			status: 'open',
			dueDateBefore: new Date(),
		});
	}

	/**
	 * Get a single RFI by ID
	 */
	async getRFI(projectId: string, rfiId: number): Promise<ActionResult<ProcoreRFI>> {
		try {
			const rfi = await this.getJson<ProcoreRFI>(
				`/rest/v1.0/projects/${projectId}/rfis/${rfiId}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: rfi,
				integration: 'procore',
				action: 'get-rfi',
				schema: 'procore.rfi.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-rfi');
		}
	}

	/**
	 * Create a new RFI
	 */
	async createRFI(options: CreateRFIOptions): Promise<ActionResult<ProcoreRFI>> {
		const {
			projectId,
			subject,
			question,
			dueDate,
			assigneeIds,
			ballInCourtId,
			responsibleContractorId,
			specSectionId,
			locationId,
			draft = false,
		} = options;

		try {
			const rfi = await this.postJson<ProcoreRFI>(
				`/rest/v1.0/projects/${projectId}/rfis`,
				{
					rfi: {
						subject,
						question_body: question,
						due_date: dueDate?.toISOString().split('T')[0],
						assignee_ids: assigneeIds,
						ball_in_court_id: ballInCourtId,
						responsible_contractor_id: responsibleContractorId,
						spec_section_id: specSectionId,
						location_id: locationId,
						status: draft ? 'draft' : 'open',
					},
				},
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: rfi,
				integration: 'procore',
				action: 'create-rfi',
				schema: 'procore.rfi.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-rfi');
		}
	}

	// ==========================================================================
	// SUBMITTALS
	// ==========================================================================

	/**
	 * Get submittals for a project
	 */
	async getSubmittals(options: GetSubmittalsOptions): Promise<ActionResult<ProcoreSubmittal[]>> {
		const { projectId, statusId, receivedFromId, responsibleContractorId, perPage = 100, page = 1 } = options;

		const query = buildQueryString({
			'filters[status_id]': statusId,
			'filters[received_from_id]': receivedFromId,
			'filters[responsible_contractor_id]': responsibleContractorId,
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const submittals = await this.getJson<ProcoreSubmittal[]>(
				`/rest/v1.0/projects/${projectId}/submittals${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: submittals,
				integration: 'procore',
				action: 'get-submittals',
				schema: 'procore.submittals.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-submittals');
		}
	}

	/**
	 * Get a single submittal by ID
	 */
	async getSubmittal(projectId: string, submittalId: number): Promise<ActionResult<ProcoreSubmittal>> {
		try {
			const submittal = await this.getJson<ProcoreSubmittal>(
				`/rest/v1.0/projects/${projectId}/submittals/${submittalId}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: submittal,
				integration: 'procore',
				action: 'get-submittal',
				schema: 'procore.submittal.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-submittal');
		}
	}

	// ==========================================================================
	// DAILY LOGS
	// ==========================================================================

	/**
	 * Get daily logs for a project
	 *
	 * Zuhandenheit: "What happened on site today?" not "GET /daily_logs?date=..."
	 */
	async getDailyLogs(options: GetDailyLogsOptions): Promise<ActionResult<ProcoreDailyLog[]>> {
		const { projectId, date, startDate, endDate, perPage = 100, page = 1 } = options;

		const query = buildQueryString({
			'filters[log_date]': date?.toISOString().split('T')[0],
			'filters[log_date][gte]': startDate?.toISOString().split('T')[0],
			'filters[log_date][lte]': endDate?.toISOString().split('T')[0],
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const logs = await this.getJson<ProcoreDailyLog[]>(
				`/rest/v1.0/projects/${projectId}/daily_logs${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: logs,
				integration: 'procore',
				action: 'get-daily-logs',
				schema: 'procore.daily-logs.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-daily-logs');
		}
	}

	/**
	 * Get today's daily log
	 */
	async getTodaysDailyLog(projectId: string): Promise<ActionResult<ProcoreDailyLog[]>> {
		return this.getDailyLogs({ projectId, date: new Date() });
	}

	/**
	 * Create a daily log
	 */
	async createDailyLog(options: CreateDailyLogOptions): Promise<ActionResult<ProcoreDailyLog>> {
		const { projectId, date, notes, weatherConditions } = options;

		try {
			const log = await this.postJson<ProcoreDailyLog>(
				`/rest/v1.0/projects/${projectId}/daily_logs`,
				{
					daily_log: {
						log_date: date.toISOString().split('T')[0],
						notes,
						weather_conditions: weatherConditions ? {
							temperature_high: weatherConditions.temperatureHigh,
							temperature_low: weatherConditions.temperatureLow,
							conditions: weatherConditions.conditions,
							precipitation: weatherConditions.precipitation,
						} : undefined,
					},
				},
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: log,
				integration: 'procore',
				action: 'create-daily-log',
				schema: 'procore.daily-log.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-daily-log');
		}
	}

	/**
	 * Get manpower logs for a daily log
	 */
	async getManpowerLogs(projectId: string, dailyLogId: number): Promise<ActionResult<ProcoreManpowerLog[]>> {
		try {
			const logs = await this.getJson<ProcoreManpowerLog[]>(
				`/rest/v1.0/projects/${projectId}/daily_logs/${dailyLogId}/manpower_logs`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: logs,
				integration: 'procore',
				action: 'get-manpower-logs',
				schema: 'procore.manpower-logs.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-manpower-logs');
		}
	}

	/**
	 * Add manpower log entry
	 */
	async addManpowerLog(options: AddManpowerLogOptions): Promise<ActionResult<ProcoreManpowerLog>> {
		const { projectId, dailyLogId, vendorId, numWorkers, hoursWorked, notes } = options;

		try {
			const log = await this.postJson<ProcoreManpowerLog>(
				`/rest/v1.0/projects/${projectId}/daily_logs/${dailyLogId}/manpower_logs`,
				{
					manpower_log: {
						vendor_id: vendorId,
						num_workers: numWorkers,
						hours_worked: hoursWorked,
						notes,
					},
				},
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: log,
				integration: 'procore',
				action: 'add-manpower-log',
				schema: 'procore.manpower-log.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'add-manpower-log');
		}
	}

	// ==========================================================================
	// CHANGE ORDERS
	// ==========================================================================

	/**
	 * Get change orders for a project
	 */
	async getChangeOrders(options: GetChangeOrdersOptions): Promise<ActionResult<ProcoreChangeOrder[]>> {
		const { projectId, contractId, status, perPage = 100, page = 1 } = options;

		const query = buildQueryString({
			'filters[contract_id]': contractId,
			'filters[status]': status,
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const changeOrders = await this.getJson<ProcoreChangeOrder[]>(
				`/rest/v1.0/projects/${projectId}/change_orders${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: changeOrders,
				integration: 'procore',
				action: 'get-change-orders',
				schema: 'procore.change-orders.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-change-orders');
		}
	}

	/**
	 * Get a single change order by ID
	 */
	async getChangeOrder(projectId: string, changeOrderId: number): Promise<ActionResult<ProcoreChangeOrder>> {
		try {
			const changeOrder = await this.getJson<ProcoreChangeOrder>(
				`/rest/v1.0/projects/${projectId}/change_orders/${changeOrderId}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: changeOrder,
				integration: 'procore',
				action: 'get-change-order',
				schema: 'procore.change-order.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-change-order');
		}
	}

	// ==========================================================================
	// BUDGET
	// ==========================================================================

	/**
	 * Get budget line items for a project
	 */
	async getBudget(options: GetBudgetOptions): Promise<ActionResult<ProcoreBudgetLineItem[]>> {
		const { projectId, includePending, perPage = 100, page = 1 } = options;

		const query = buildQueryString({
			include_pending: includePending,
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const budget = await this.getJson<ProcoreBudgetLineItem[]>(
				`/rest/v1.0/projects/${projectId}/budget_line_items${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: budget,
				integration: 'procore',
				action: 'get-budget',
				schema: 'procore.budget.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-budget');
		}
	}

	// ==========================================================================
	// DRAWINGS
	// ==========================================================================

	/**
	 * Get drawings for a project
	 */
	async getDrawings(projectId: string, perPage = 100, page = 1): Promise<ActionResult<ProcoreDrawing[]>> {
		const query = buildQueryString({
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const drawings = await this.getJson<ProcoreDrawing[]>(
				`/rest/v1.0/projects/${projectId}/drawings${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: drawings,
				integration: 'procore',
				action: 'get-drawings',
				schema: 'procore.drawings.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-drawings');
		}
	}

	// ==========================================================================
	// USERS
	// ==========================================================================

	/**
	 * Get users in the company
	 */
	async getUsers(perPage = 100, page = 1): Promise<ActionResult<ProcoreUser[]>> {
		const query = buildQueryString({
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const users = await this.getJson<ProcoreUser[]>(
				`/rest/v1.0/companies/${this.companyId}/users${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: users,
				integration: 'procore',
				action: 'get-users',
				schema: 'procore.users.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-users');
		}
	}

	/**
	 * Get project users
	 */
	async getProjectUsers(projectId: string, perPage = 100, page = 1): Promise<ActionResult<ProcoreUser[]>> {
		const query = buildQueryString({
			per_page: Math.min(perPage, 100),
			page,
		});

		try {
			const users = await this.getJson<ProcoreUser[]>(
				`/rest/v1.0/projects/${projectId}/users${query}`,
				this.getProcoreHeaders()
			);

			return createActionResult({
				data: users,
				integration: 'procore',
				action: 'get-project-users',
				schema: 'procore.users.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-project-users');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Handle errors consistently
	 */
	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'procore',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'procore',
			action,
		});
	}

	/**
	 * Get capabilities for Procore actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: true,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true,
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// STANDARD DATA CONVERTERS
// ============================================================================

/**
 * Convert Procore project to standard project format
 */
export function toStandardProject(project: ProcoreProject) {
	return {
		id: String(project.id),
		name: project.name,
		displayName: project.display_name,
		number: project.project_number,
		status: project.active ? 'active' : 'inactive',
		stage: project.stage,
		startDate: project.start_date,
		endDate: project.completion_date,
		location: project.address ? {
			address: project.address,
			city: project.city,
			state: project.state_code,
			zip: project.zip,
			country: project.country_code,
			coordinates: project.latitude && project.longitude ? {
				lat: project.latitude,
				lng: project.longitude,
			} : undefined,
		} : undefined,
		source: 'procore' as const,
		sourceId: String(project.id),
	};
}

/**
 * Convert Procore RFI to standard task/issue format
 */
export function toStandardIssue(rfi: ProcoreRFI) {
	return {
		id: String(rfi.id),
		type: 'rfi' as const,
		number: rfi.number,
		title: rfi.subject,
		description: rfi.question?.plain_text_body || rfi.question?.body,
		status: rfi.status,
		dueDate: rfi.due_date,
		assignee: rfi.ball_in_court ? {
			id: String(rfi.ball_in_court.id),
			name: rfi.ball_in_court.name,
		} : undefined,
		costImpact: rfi.cost_impact === 'yes' ? rfi.cost_impact_amount : undefined,
		scheduleImpact: rfi.schedule_impact === 'yes' ? rfi.schedule_impact_days : undefined,
		createdAt: rfi.created_at,
		updatedAt: rfi.updated_at,
		closedAt: rfi.closed_at,
		source: 'procore' as const,
		sourceId: String(rfi.id),
	};
}

/**
 * Convert Procore daily log to standard log format
 */
export function toStandardDailyLog(log: ProcoreDailyLog) {
	return {
		id: String(log.id),
		date: log.log_date,
		projectId: String(log.project_id),
		weather: log.weather_conditions ? {
			high: log.weather_conditions.temperature_high,
			low: log.weather_conditions.temperature_low,
			conditions: log.weather_conditions.conditions,
			precipitation: log.weather_conditions.precipitation,
		} : undefined,
		notes: log.notes,
		createdAt: log.created_at,
		updatedAt: log.updated_at,
		source: 'procore' as const,
		sourceId: String(log.id),
	};
}

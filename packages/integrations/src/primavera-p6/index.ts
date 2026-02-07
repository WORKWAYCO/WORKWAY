/**
 * Oracle Primavera P6 EPPM API Integration for WORKWAY
 *
 * Enterprise project portfolio management and scheduling.
 * Covers projects, activities, WBS, resources, relationships, calendars, and baselines.
 *
 * Zuhandenheit: Schedulers don't want "REST API endpoints" - they want:
 * - Schedules that update themselves from the field
 * - Critical path visibility without opening P6
 * - Resource conflicts surfaced before they cause delays
 * - Baselines compared automatically to current progress
 *
 * @example
 * ```typescript
 * import { PrimaveraP6 } from '@workwayco/integrations/primavera-p6';
 *
 * const p6 = new PrimaveraP6({
 *   baseUrl: 'https://p6.example.com/p6ws/restapi',
 *   username: process.env.P6_USERNAME,
 *   password: process.env.P6_PASSWORD,
 * });
 *
 * // Get projects
 * const projects = await p6.getProjects();
 *
 * // Get activities for a project
 * const activities = await p6.getActivities('project-id');
 *
 * // Trigger CPM scheduling
 * const result = await p6.scheduleProject('project-id', '2024-01-15');
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
 * Primavera P6 integration configuration
 *
 * Authentication: Username/password or token-based
 * Requires licensed P6 EPPM deployment with Integration API module enabled
 */
export interface PrimaveraP6Config {
	/** P6 REST API base URL */
	baseUrl: string;
	/** Username (for auth) */
	username?: string;
	/** Password (for auth) */
	password?: string;
	/** Pre-authenticated token */
	accessToken?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Project Resources
// ----------------------------------------------------------------------------

/** P6 Project */
export interface P6Project {
	ProjectObjectId: number;
	Id: string;
	Name: string;
	Description?: string;
	Status: string;
	StartDate?: string;
	FinishDate?: string;
	DataDate?: string;
	PlannedStartDate?: string;
	PlannedFinishDate?: string;
	MustFinishByDate?: string;
	ActualStartDate?: string;
	ActualFinishDate?: string;
	PercentComplete?: number;
	ScheduleType?: string;
	CalendarObjectId?: number;
	ParentEPSObjectId?: number;
	CreateDate: string;
	LastUpdateDate: string;
}

// ----------------------------------------------------------------------------
// Activity Resources
// ----------------------------------------------------------------------------

/** P6 Activity */
export interface P6Activity {
	ActivityObjectId: number;
	Id: string;
	Name: string;
	ProjectObjectId: number;
	WBSObjectId?: number;
	Type: string;
	Status: string;
	StartDate?: string;
	FinishDate?: string;
	PlannedStartDate?: string;
	PlannedFinishDate?: string;
	ActualStartDate?: string;
	ActualFinishDate?: string;
	RemainingDuration?: number;
	ActualDuration?: number;
	PlannedDuration?: number;
	PercentComplete?: number;
	TotalFloat?: number;
	FreeFloat?: number;
	IsCritical?: boolean;
	CalendarObjectId?: number;
	PrimaryConstraintType?: string;
	PrimaryConstraintDate?: string;
	CreateDate: string;
	LastUpdateDate: string;
}

// ----------------------------------------------------------------------------
// WBS Resources
// ----------------------------------------------------------------------------

/** P6 Work Breakdown Structure element */
export interface P6WBS {
	ObjectId: number;
	Code: string;
	Name: string;
	ProjectObjectId: number;
	ParentObjectId?: number;
	SequenceNumber?: number;
	Status?: string;
	SummaryPercentComplete?: number;
	SummaryPlannedStartDate?: string;
	SummaryPlannedFinishDate?: string;
	SummaryActualStartDate?: string;
	SummaryActualFinishDate?: string;
}

// ----------------------------------------------------------------------------
// Resource Resources
// ----------------------------------------------------------------------------

/** P6 Resource */
export interface P6Resource {
	ObjectId: number;
	Id: string;
	Name: string;
	ResourceType: string;
	EmailAddress?: string;
	EmployeeId?: string;
	Title?: string;
	MaxUnitsPerTime?: number;
	DefaultUnitsPerTime?: number;
	PricePerUnit?: number;
	IsActive: boolean;
	ParentObjectId?: number;
	CalendarObjectId?: number;
	CreateDate: string;
	LastUpdateDate: string;
}

/** P6 Resource Assignment */
export interface P6ResourceAssignment {
	ObjectId: number;
	ActivityObjectId: number;
	ResourceObjectId: number;
	ResourceId: string;
	ResourceName: string;
	ProjectObjectId: number;
	PlannedUnitsPerTime?: number;
	ActualUnitsPerTime?: number;
	RemainingUnitsPerTime?: number;
	PlannedCost?: number;
	ActualCost?: number;
	RemainingCost?: number;
	StartDate?: string;
	FinishDate?: string;
}

// ----------------------------------------------------------------------------
// Relationship Resources
// ----------------------------------------------------------------------------

/** P6 Activity Relationship (dependency) */
export interface P6Relationship {
	ObjectId: number;
	PredecessorActivityObjectId: number;
	SuccessorActivityObjectId: number;
	PredecessorActivityId: string;
	SuccessorActivityId: string;
	Type: 'FS' | 'FF' | 'SS' | 'SF';
	Lag?: number;
	PredecessorProjectObjectId: number;
	SuccessorProjectObjectId: number;
}

// ----------------------------------------------------------------------------
// Calendar Resources
// ----------------------------------------------------------------------------

/** P6 Calendar */
export interface P6Calendar {
	ObjectId: number;
	Name: string;
	Type: string;
	IsDefault: boolean;
	HoursPerDay?: number;
	HoursPerWeek?: number;
	HoursPerMonth?: number;
	HoursPerYear?: number;
}

// ----------------------------------------------------------------------------
// Baseline Resources
// ----------------------------------------------------------------------------

/** P6 Project Baseline */
export interface P6Baseline {
	ObjectId: number;
	ProjectObjectId: number;
	BaselineTypeName: string;
	BaselineTypeObjectId: number;
	Name: string;
	IsTemplate: boolean;
	LastUpdateDate: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetActivitiesOptions {
	projectId: string;
	/** Filter by WBS */
	wbsObjectId?: number;
	/** Only critical activities */
	criticalOnly?: boolean;
	/** Filter by status */
	status?: string;
	/** Fields to return */
	fields?: string[];
}

export interface ScheduleProjectOptions {
	projectId: string;
	/** Data date for scheduling (ISO 8601) */
	dataDate: string;
}

// ============================================================================
// PRIMAVERA P6 INTEGRATION CLASS
// ============================================================================

/**
 * Oracle Primavera P6 EPPM API Integration
 *
 * Weniger, aber besser: Enterprise scheduling for construction portfolios.
 *
 * API: REST
 * Auth: Username/password or token
 * Rate Limit: Depends on deployment
 * Requires: Licensed P6 EPPM with Integration API module
 */
export class PrimaveraP6 extends BaseAPIClient {
	private readonly p6Username: string;
	private readonly p6Password: string;

	constructor(config: PrimaveraP6Config) {
		if (!config.baseUrl) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Primavera P6 base URL is required',
				{ integration: 'primavera-p6' }
			);
		}
		if (!config.accessToken && (!config.username || !config.password)) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Primavera P6 credentials (username/password or accessToken) are required',
				{ integration: 'primavera-p6' }
			);
		}

		super({
			accessToken: config.accessToken || 'pending-auth',
			apiUrl: config.baseUrl,
			timeout: config.timeout,
			errorContext: { integration: 'primavera-p6' },
		});

		this.p6Username = config.username || '';
		this.p6Password = config.password || '';
	}

	// ==========================================================================
	// PROJECTS
	// ==========================================================================

	/**
	 * Get all projects
	 */
	async getProjects(): Promise<ActionResult<P6Project[]>> {
		try {
			const projects = await this.getJson<P6Project[]>('/project');

			return createActionResult({
				data: projects,
				integration: 'primavera-p6',
				action: 'get-projects',
				schema: 'primavera-p6.projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-projects');
		}
	}

	/**
	 * Get a specific project
	 */
	async getProject(projectObjectId: string): Promise<ActionResult<P6Project>> {
		try {
			const projects = await this.getJson<P6Project[]>(
				`/project?Filter=ProjectObjectId='${projectObjectId}'`
			);

			if (!projects.length) {
				return ActionResult.error('Project not found', ErrorCode.NOT_FOUND, {
					integration: 'primavera-p6',
					action: 'get-project',
				});
			}

			return createActionResult({
				data: projects[0],
				integration: 'primavera-p6',
				action: 'get-project',
				schema: 'primavera-p6.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-project');
		}
	}

	// ==========================================================================
	// ACTIVITIES
	// ==========================================================================

	/**
	 * Get activities for a project
	 */
	async getActivities(projectObjectId: string, options: Omit<GetActivitiesOptions, 'projectId'> = {}): Promise<ActionResult<P6Activity[]>> {
		let filter = `ProjectObjectId='${projectObjectId}'`;
		if (options.criticalOnly) {
			filter += ` AND IsCritical=true`;
		}
		if (options.status) {
			filter += ` AND Status='${options.status}'`;
		}
		if (options.wbsObjectId) {
			filter += ` AND WBSObjectId='${options.wbsObjectId}'`;
		}

		const query = buildQueryString({ Filter: filter });

		try {
			const activities = await this.getJson<P6Activity[]>(`/activity${query}`);

			return createActionResult({
				data: activities,
				integration: 'primavera-p6',
				action: 'get-activities',
				schema: 'primavera-p6.activities.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-activities');
		}
	}

	/**
	 * Get a specific activity
	 */
	async getActivity(activityObjectId: string): Promise<ActionResult<P6Activity>> {
		try {
			const activities = await this.getJson<P6Activity[]>(
				`/activity?Filter=ActivityObjectId='${activityObjectId}'`
			);

			if (!activities.length) {
				return ActionResult.error('Activity not found', ErrorCode.NOT_FOUND, {
					integration: 'primavera-p6',
					action: 'get-activity',
				});
			}

			return createActionResult({
				data: activities[0],
				integration: 'primavera-p6',
				action: 'get-activity',
				schema: 'primavera-p6.activity.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-activity');
		}
	}

	// ==========================================================================
	// WBS
	// ==========================================================================

	/**
	 * Get WBS for a project
	 */
	async getWBS(projectObjectId: string): Promise<ActionResult<P6WBS[]>> {
		try {
			const wbs = await this.getJson<P6WBS[]>(
				`/wbs?Filter=ProjectObjectId='${projectObjectId}'`
			);

			return createActionResult({
				data: wbs,
				integration: 'primavera-p6',
				action: 'get-wbs',
				schema: 'primavera-p6.wbs.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-wbs');
		}
	}

	// ==========================================================================
	// RESOURCES
	// ==========================================================================

	/**
	 * Get all resources
	 */
	async getResources(): Promise<ActionResult<P6Resource[]>> {
		try {
			const resources = await this.getJson<P6Resource[]>('/resource');

			return createActionResult({
				data: resources,
				integration: 'primavera-p6',
				action: 'get-resources',
				schema: 'primavera-p6.resources.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-resources');
		}
	}

	/**
	 * Get resource assignments for an activity
	 */
	async getResourceAssignments(activityObjectId: string): Promise<ActionResult<P6ResourceAssignment[]>> {
		try {
			const assignments = await this.getJson<P6ResourceAssignment[]>(
				`/resourceAssignment?Filter=ActivityObjectId='${activityObjectId}'`
			);

			return createActionResult({
				data: assignments,
				integration: 'primavera-p6',
				action: 'get-resource-assignments',
				schema: 'primavera-p6.resource-assignments.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-resource-assignments');
		}
	}

	// ==========================================================================
	// RELATIONSHIPS
	// ==========================================================================

	/**
	 * Get activity relationships (dependencies) for a project
	 */
	async getRelationships(projectObjectId: string): Promise<ActionResult<P6Relationship[]>> {
		try {
			const relationships = await this.getJson<P6Relationship[]>(
				`/relationship?Filter=PredecessorProjectObjectId='${projectObjectId}'`
			);

			return createActionResult({
				data: relationships,
				integration: 'primavera-p6',
				action: 'get-relationships',
				schema: 'primavera-p6.relationships.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-relationships');
		}
	}

	// ==========================================================================
	// SCHEDULING
	// ==========================================================================

	/**
	 * Trigger CPM scheduling for a project
	 */
	async scheduleProject(projectObjectId: string, dataDate: string): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.postJson<Record<string, unknown>>(
				'/action/scheduleproject',
				{
					ProjectObjectId: projectObjectId,
					DataDate: dataDate,
				}
			);

			return createActionResult({
				data: result,
				integration: 'primavera-p6',
				action: 'schedule-project',
				schema: 'primavera-p6.schedule-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'schedule-project');
		}
	}

	// ==========================================================================
	// CALENDARS
	// ==========================================================================

	/**
	 * Get calendars
	 */
	async getCalendars(): Promise<ActionResult<P6Calendar[]>> {
		try {
			const calendars = await this.getJson<P6Calendar[]>('/calendar');

			return createActionResult({
				data: calendars,
				integration: 'primavera-p6',
				action: 'get-calendars',
				schema: 'primavera-p6.calendars.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-calendars');
		}
	}

	// ==========================================================================
	// BASELINES
	// ==========================================================================

	/**
	 * Get baselines for a project
	 */
	async getBaselines(projectObjectId: string): Promise<ActionResult<P6Baseline[]>> {
		try {
			const baselines = await this.getJson<P6Baseline[]>(
				`/projectBaseline?Filter=ProjectObjectId='${projectObjectId}'`
			);

			return createActionResult({
				data: baselines,
				integration: 'primavera-p6',
				action: 'get-baselines',
				schema: 'primavera-p6.baselines.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-baselines');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'primavera-p6',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'primavera-p6',
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
			supportsSearch: true,
			supportsPagination: false,
			supportsNesting: true,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// STANDARD DATA CONVERTERS
// ============================================================================

export function toStandardProject(project: P6Project) {
	return {
		id: String(project.ProjectObjectId),
		name: project.Name,
		status: project.Status,
		startDate: project.StartDate,
		endDate: project.FinishDate,
		percentComplete: project.PercentComplete,
		source: 'primavera-p6' as const,
		sourceId: project.Id,
	};
}

export function toStandardActivity(activity: P6Activity) {
	return {
		id: String(activity.ActivityObjectId),
		name: activity.Name,
		status: activity.Status,
		startDate: activity.StartDate,
		endDate: activity.FinishDate,
		duration: activity.PlannedDuration,
		percentComplete: activity.PercentComplete,
		isCritical: activity.IsCritical,
		totalFloat: activity.TotalFloat,
		source: 'primavera-p6' as const,
		sourceId: activity.Id,
	};
}

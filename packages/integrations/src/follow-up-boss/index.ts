/**
 * Follow Up Boss Integration for WORKWAY
 *
 * Real estate CRM integration for lead management, contact tracking,
 * and deal pipeline automation. Designed for real estate workflows -
 * lead capture, nurturing sequences, and showing follow-ups.
 *
 * @example
 * ```typescript
 * import { FollowUpBoss } from '@workwayco/integrations/follow-up-boss';
 *
 * const fub = new FollowUpBoss({
 *   apiKey: 'fka_xxxxx',
 *   systemName: 'MyApp',
 *   systemKey: 'my-system-key',
 * });
 *
 * // Create a new lead from inquiry
 * await fub.createLead({
 *   firstName: 'John',
 *   lastName: 'Smith',
 *   emails: ['john@example.com'],
 *   phones: ['555-555-5555'],
 *   source: 'Website',
 *   message: 'Looking for homes under $500k',
 * });
 *
 * // Get today's follow-ups
 * const tasks = await fub.getTodaysTasks();
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	BaseAPIClient,
	buildQueryString,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Follow Up Boss configuration
 */
export interface FollowUpBossConfig {
	/** API Key (from Admin → API screen) */
	apiKey: string;
	/** System name for X-System header */
	systemName: string;
	/** System key for X-System-Key header */
	systemKey: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Follow Up Boss person (contact/lead)
 */
export interface FUBPerson {
	id: number;
	created: string;
	updated: string;
	firstName: string;
	lastName: string;
	stage: FUBStage;
	source: string;
	sourceUrl?: string;
	contacted: boolean;
	price?: number;
	assignedTo?: number;
	assignedUserId?: number;
	collaborators?: number[];
	tags?: string[];
	emails?: FUBEmail[];
	phones?: FUBPhone[];
	addresses?: FUBAddress[];
	background?: string;
	claims?: string;
	lastActivity?: string;
	assignedPondId?: number;
}

/**
 * Contact stages in Follow Up Boss
 */
export type FUBStage =
	| 'Lead'
	| 'Active'
	| 'Past Client'
	| 'Inactive'
	| 'Trash';

/**
 * Email object
 */
export interface FUBEmail {
	value: string;
	type?: 'home' | 'work' | 'other';
	isPrimary?: boolean;
}

/**
 * Phone object
 */
export interface FUBPhone {
	value: string;
	type?: 'home' | 'work' | 'mobile' | 'fax' | 'other';
	isPrimary?: boolean;
}

/**
 * Address object
 */
export interface FUBAddress {
	street?: string;
	city?: string;
	state?: string;
	code?: string;
	country?: string;
	type?: 'home' | 'work' | 'mailing' | 'property' | 'other';
}

/**
 * Follow Up Boss deal
 */
export interface FUBDeal {
	id: number;
	created: string;
	updated: string;
	name: string;
	stage: string;
	stageId: number;
	pipelineId: number;
	price?: number;
	closeDate?: string;
	closedWon?: boolean;
	assignedUserId?: number;
	people?: number[];
	properties?: FUBProperty[];
	customFields?: Record<string, unknown>;
}

/**
 * Property associated with a deal
 */
export interface FUBProperty {
	street?: string;
	city?: string;
	state?: string;
	code?: string;
	mlsNumber?: string;
	price?: number;
	type?: 'buyer' | 'seller' | 'rental' | 'other';
}

/**
 * Follow Up Boss task
 */
export interface FUBTask {
	id: number;
	created: string;
	updated: string;
	name: string;
	dueDate: string;
	completed: boolean;
	completedAt?: string;
	assignedUserId: number;
	personId?: number;
	dealId?: number;
	description?: string;
}

/**
 * Follow Up Boss note
 */
export interface FUBNote {
	id: number;
	created: string;
	updated: string;
	personId: number;
	subject?: string;
	body: string;
	isHtml: boolean;
	userId: number;
}

/**
 * Follow Up Boss appointment
 */
export interface FUBAppointment {
	id: number;
	created: string;
	updated: string;
	title: string;
	description?: string;
	startTime: string;
	endTime: string;
	assignedUserId: number;
	personId?: number;
	dealId?: number;
	location?: string;
	outcomeId?: number;
}

/**
 * Follow Up Boss user
 */
export interface FUBUser {
	id: number;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	active: boolean;
}

/**
 * Event for lead submission
 */
export interface FUBEvent {
	source: string;
	system: string;
	type: string;
	message?: string;
	description?: string;
	person: {
		firstName?: string;
		lastName?: string;
		emails?: Array<{ value: string }>;
		phones?: Array<{ value: string }>;
		tags?: string[];
		source?: string;
	};
	property?: {
		street?: string;
		city?: string;
		state?: string;
		code?: string;
		mlsNumber?: string;
		price?: number;
		type?: string;
		forRent?: boolean;
		url?: string;
	};
}

/**
 * Webhook event from Follow Up Boss
 */
export interface FUBWebhookEvent {
	event: 'peopleCreated' | 'peopleUpdated' | 'peopleDeleted' | 'peopleTagsCreated' | 'peopleTagsDeleted' | 'notesCreated' | 'notesUpdated' | 'notesDeleted' | 'tasksCreated' | 'tasksUpdated' | 'tasksDeleted';
	data: Record<string, unknown>;
	timestamp: string;
}

/**
 * Paginated response
 */
export interface FUBPaginatedResponse<T> {
	people?: T[];
	deals?: T[];
	tasks?: T[];
	notes?: T[];
	appointments?: T[];
	users?: T[];
	_metadata: {
		collection: string;
		offset: number;
		limit: number;
		total: number;
	};
}

// ============================================================================
// OPTIONS INTERFACES
// ============================================================================

export interface ListPeopleOptions {
	/** Filter by stage */
	stage?: FUBStage;
	/** Filter by source */
	source?: string;
	/** Filter by tag */
	tag?: string;
	/** Filter by assigned user */
	assignedUserId?: number;
	/** Sort field */
	sort?: string;
	/** Results limit (default: 25, max: 100) */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

export interface CreatePersonOptions {
	firstName: string;
	lastName?: string;
	emails?: string[];
	phones?: string[];
	stage?: FUBStage;
	source?: string;
	tags?: string[];
	assignedUserId?: number;
	background?: string;
	price?: number;
}

export interface UpdatePersonOptions {
	firstName?: string;
	lastName?: string;
	emails?: string[];
	phones?: string[];
	stage?: FUBStage;
	source?: string;
	tags?: string[];
	assignedUserId?: number;
	background?: string;
	price?: number;
}

export interface CreateLeadOptions {
	firstName: string;
	lastName?: string;
	emails?: string[];
	phones?: string[];
	source: string;
	message?: string;
	tags?: string[];
	propertyStreet?: string;
	propertyCity?: string;
	propertyState?: string;
	propertyMls?: string;
	propertyPrice?: number;
	propertyType?: 'buyer' | 'seller' | 'rental';
}

export interface CreateNoteOptions {
	personId: number;
	body: string;
	subject?: string;
	isHtml?: boolean;
}

export interface CreateTaskOptions {
	name: string;
	dueDate: string;
	assignedUserId: number;
	personId?: number;
	dealId?: number;
	description?: string;
}

export interface ListTasksOptions {
	/** Filter by completed status */
	completed?: boolean;
	/** Filter by assigned user */
	assignedUserId?: number;
	/** Filter by person */
	personId?: number;
	/** Filter tasks due before this date */
	dueBefore?: string;
	/** Filter tasks due after this date */
	dueAfter?: string;
	/** Results limit */
	limit?: number;
	/** Offset */
	offset?: number;
}

export interface CreateDealOptions {
	name: string;
	pipelineId: number;
	stageId: number;
	price?: number;
	closeDate?: string;
	assignedUserId?: number;
	people?: number[];
	properties?: FUBProperty[];
}

export interface ListDealsOptions {
	/** Filter by pipeline */
	pipelineId?: number;
	/** Filter by stage */
	stageId?: number;
	/** Filter by assigned user */
	assignedUserId?: number;
	/** Filter by person */
	personId?: number;
	/** Results limit */
	limit?: number;
	/** Offset */
	offset?: number;
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

const handleError = createErrorHandler('follow-up-boss');

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * Follow Up Boss API Client
 *
 * Real estate CRM for lead management, contact tracking, and deal pipelines.
 */
export class FollowUpBoss extends BaseAPIClient {
	private readonly systemName: string;
	private readonly systemKey: string;

	/**
	 * Action capabilities for workflow SDK integration
	 */
	static readonly capabilities: ActionCapabilities = {
		id: 'follow-up-boss',
		name: 'Follow Up Boss',
		description: 'Real estate CRM - leads, contacts, deals, tasks',
		actions: [
			// People
			{ id: 'listPeople', description: 'List contacts/leads' },
			{ id: 'getPerson', description: 'Get a person by ID' },
			{ id: 'createPerson', description: 'Create a new contact' },
			{ id: 'updatePerson', description: 'Update a contact' },
			{ id: 'createLead', description: 'Create a new lead via events API' },
			// Zuhandenheit APIs
			{ id: 'getNewLeads', description: 'Get leads from last N days' },
			{ id: 'getUncontactedLeads', description: 'Get leads not yet contacted' },
			{ id: 'getTodaysTasks', description: 'Get tasks due today' },
			{ id: 'getOverdueTasks', description: 'Get overdue tasks' },
			// Notes
			{ id: 'createNote', description: 'Add a note to a contact' },
			{ id: 'listNotes', description: 'List notes for a contact' },
			// Tasks
			{ id: 'createTask', description: 'Create a follow-up task' },
			{ id: 'completeTask', description: 'Mark task as complete' },
			{ id: 'listTasks', description: 'List tasks' },
			// Deals
			{ id: 'createDeal', description: 'Create a new deal' },
			{ id: 'listDeals', description: 'List deals' },
			{ id: 'updateDealStage', description: 'Move deal to new stage' },
		],
	};

	constructor(config: FollowUpBossConfig) {
		if (!config.apiKey) {
			throw new Error('Follow Up Boss API key is required');
		}
		if (!config.systemName || !config.systemKey) {
			throw new Error('Follow Up Boss system name and key are required');
		}

		// HTTP Basic Auth: API key as username, empty password
		const authToken = btoa(`${config.apiKey}:`);

		super({
			accessToken: authToken,
			apiUrl: config.apiUrl || 'https://api.followupboss.com/v1',
			timeout: config.timeout || 30000,
		});

		this.systemName = config.systemName;
		this.systemKey = config.systemKey;
	}

	/**
	 * Override request to add system headers and use Basic Auth
	 */
	protected override async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<T> {
		const url = `${this.apiUrl}${path}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Authorization: `Basic ${this.accessToken}`,
			'X-System': this.systemName,
			'X-System-Key': this.systemKey,
		};

		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(this.timeout),
		});

		await assertResponseOk(response, 'follow-up-boss');

		return response.json() as Promise<T>;
	}

	// ==========================================================================
	// PEOPLE (Contacts/Leads)
	// ==========================================================================

	/**
	 * List people (contacts/leads)
	 */
	async listPeople(options: ListPeopleOptions = {}): Promise<ActionResult<FUBPerson[]>> {
		try {
			const params: Record<string, string> = {};
			if (options.stage) params.stage = options.stage;
			if (options.source) params.source = options.source;
			if (options.tag) params.tag = options.tag;
			if (options.assignedUserId) params.assignedUserId = options.assignedUserId.toString();
			if (options.sort) params.sort = options.sort;
			if (options.limit) params.limit = options.limit.toString();
			if (options.offset) params.offset = options.offset.toString();

			const query = buildQueryString(params);
			const response = await this.request<FUBPaginatedResponse<FUBPerson>>(
				'GET',
				`/people${query}`
			);

			return createActionResult.success(response.people || []);
		} catch (error) {
			return handleError(error, 'list-people');
		}
	}

	/**
	 * Get a person by ID
	 */
	async getPerson(personId: number): Promise<ActionResult<FUBPerson>> {
		try {
			const response = await this.request<FUBPerson>('GET', `/people/${personId}`);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'get-person');
		}
	}

	/**
	 * Create a new person (contact)
	 */
	async createPerson(options: CreatePersonOptions): Promise<ActionResult<FUBPerson>> {
		try {
			const body: Record<string, unknown> = {
				firstName: options.firstName,
			};

			if (options.lastName) body.lastName = options.lastName;
			if (options.stage) body.stage = options.stage;
			if (options.source) body.source = options.source;
			if (options.assignedUserId) body.assignedUserId = options.assignedUserId;
			if (options.background) body.background = options.background;
			if (options.price) body.price = options.price;
			if (options.tags) body.tags = options.tags;

			if (options.emails) {
				body.emails = options.emails.map(email => ({ value: email }));
			}
			if (options.phones) {
				body.phones = options.phones.map(phone => ({ value: phone }));
			}

			const response = await this.request<FUBPerson>('POST', '/people', body);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'create-person');
		}
	}

	/**
	 * Update a person
	 */
	async updatePerson(personId: number, options: UpdatePersonOptions): Promise<ActionResult<FUBPerson>> {
		try {
			const body: Record<string, unknown> = {};

			if (options.firstName) body.firstName = options.firstName;
			if (options.lastName) body.lastName = options.lastName;
			if (options.stage) body.stage = options.stage;
			if (options.source) body.source = options.source;
			if (options.assignedUserId) body.assignedUserId = options.assignedUserId;
			if (options.background) body.background = options.background;
			if (options.price) body.price = options.price;
			if (options.tags) body.tags = options.tags;

			if (options.emails) {
				body.emails = options.emails.map(email => ({ value: email }));
			}
			if (options.phones) {
				body.phones = options.phones.map(phone => ({ value: phone }));
			}

			const response = await this.request<FUBPerson>('PUT', `/people/${personId}`, body);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'update-person');
		}
	}

	/**
	 * Create a new lead via the Events API
	 *
	 * This is the preferred method for submitting new leads from external sources.
	 * It triggers Follow Up Boss's lead routing and automation rules.
	 */
	async createLead(options: CreateLeadOptions): Promise<ActionResult<{ success: boolean }>> {
		try {
			const event: FUBEvent = {
				source: options.source,
				system: this.systemName,
				type: options.propertyType === 'seller' ? 'Seller Inquiry' :
					options.propertyType === 'rental' ? 'Rental Inquiry' :
						options.propertyMls ? 'Property Inquiry' : 'General Inquiry',
				message: options.message,
				person: {
					firstName: options.firstName,
					lastName: options.lastName,
					source: options.source,
				},
			};

			if (options.emails?.length) {
				event.person.emails = options.emails.map(e => ({ value: e }));
			}
			if (options.phones?.length) {
				event.person.phones = options.phones.map(p => ({ value: p }));
			}
			if (options.tags?.length) {
				event.person.tags = options.tags;
			}

			if (options.propertyStreet || options.propertyMls) {
				event.property = {
					street: options.propertyStreet,
					city: options.propertyCity,
					state: options.propertyState,
					mlsNumber: options.propertyMls,
					price: options.propertyPrice,
					type: options.propertyType,
				};
			}

			await this.request<unknown>('POST', '/events', event);
			return createActionResult.success({ success: true });
		} catch (error) {
			return handleError(error, 'create-lead');
		}
	}

	// ==========================================================================
	// ZUHANDENHEIT APIs (Outcome-focused)
	// ==========================================================================

	/**
	 * Get new leads from the last N days
	 *
	 * Zuhandenheit: "New leads that need attention" not "filter by created date"
	 */
	async getNewLeads(days: number = 7): Promise<ActionResult<FUBPerson[]>> {
		try {
			const result = await this.listPeople({
				stage: 'Lead',
				sort: '-created',
				limit: 100,
			});

			if (!result.success) {
				return result;
			}

			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - days);

			const newLeads = (result.data || []).filter(person => {
				const createdDate = new Date(person.created);
				return createdDate >= cutoffDate;
			});

			return createActionResult.success(newLeads);
		} catch (error) {
			return handleError(error, 'get-new-leads');
		}
	}

	/**
	 * Get leads that haven't been contacted yet
	 *
	 * Zuhandenheit: "Leads waiting for first contact" not "filter by contacted flag"
	 */
	async getUncontactedLeads(): Promise<ActionResult<FUBPerson[]>> {
		try {
			const result = await this.listPeople({
				stage: 'Lead',
				sort: '-created',
				limit: 100,
			});

			if (!result.success) {
				return result;
			}

			const uncontacted = (result.data || []).filter(person => !person.contacted);
			return createActionResult.success(uncontacted);
		} catch (error) {
			return handleError(error, 'get-uncontacted-leads');
		}
	}

	/**
	 * Get hot leads (high price, recent activity)
	 *
	 * Zuhandenheit: "Leads likely to convert" not "filter by price and date"
	 */
	async getHotLeads(minPrice: number = 500000): Promise<ActionResult<FUBPerson[]>> {
		try {
			const result = await this.listPeople({
				stage: 'Active',
				sort: '-lastActivity',
				limit: 50,
			});

			if (!result.success) {
				return result;
			}

			const hotLeads = (result.data || []).filter(person =>
				person.price && person.price >= minPrice
			);

			return createActionResult.success(hotLeads);
		} catch (error) {
			return handleError(error, 'get-hot-leads');
		}
	}

	// ==========================================================================
	// NOTES
	// ==========================================================================

	/**
	 * Create a note on a contact
	 */
	async createNote(options: CreateNoteOptions): Promise<ActionResult<FUBNote>> {
		try {
			const body: Record<string, unknown> = {
				personId: options.personId,
				body: options.body,
			};

			if (options.subject) body.subject = options.subject;
			if (options.isHtml !== undefined) body.isHtml = options.isHtml;

			const response = await this.request<FUBNote>('POST', '/notes', body);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'create-note');
		}
	}

	/**
	 * List notes for a contact
	 */
	async listNotes(personId: number, limit: number = 25): Promise<ActionResult<FUBNote[]>> {
		try {
			const response = await this.request<FUBPaginatedResponse<FUBNote>>(
				'GET',
				`/notes?personId=${personId}&limit=${limit}`
			);
			return createActionResult.success(response.notes || []);
		} catch (error) {
			return handleError(error, 'list-notes');
		}
	}

	// ==========================================================================
	// TASKS
	// ==========================================================================

	/**
	 * Create a task
	 */
	async createTask(options: CreateTaskOptions): Promise<ActionResult<FUBTask>> {
		try {
			const body: Record<string, unknown> = {
				name: options.name,
				dueDate: options.dueDate,
				assignedUserId: options.assignedUserId,
			};

			if (options.personId) body.personId = options.personId;
			if (options.dealId) body.dealId = options.dealId;
			if (options.description) body.description = options.description;

			const response = await this.request<FUBTask>('POST', '/tasks', body);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'create-task');
		}
	}

	/**
	 * List tasks
	 */
	async listTasks(options: ListTasksOptions = {}): Promise<ActionResult<FUBTask[]>> {
		try {
			const params: Record<string, string> = {};
			if (options.completed !== undefined) params.completed = options.completed.toString();
			if (options.assignedUserId) params.assignedUserId = options.assignedUserId.toString();
			if (options.personId) params.personId = options.personId.toString();
			if (options.dueBefore) params.dueBefore = options.dueBefore;
			if (options.dueAfter) params.dueAfter = options.dueAfter;
			if (options.limit) params.limit = options.limit.toString();
			if (options.offset) params.offset = options.offset.toString();

			const query = buildQueryString(params);
			const response = await this.request<FUBPaginatedResponse<FUBTask>>(
				'GET',
				`/tasks${query}`
			);

			return createActionResult.success(response.tasks || []);
		} catch (error) {
			return handleError(error, 'list-tasks');
		}
	}

	/**
	 * Complete a task
	 */
	async completeTask(taskId: number): Promise<ActionResult<FUBTask>> {
		try {
			const response = await this.request<FUBTask>('PUT', `/tasks/${taskId}`, {
				completed: true,
			});
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'complete-task');
		}
	}

	/**
	 * Get tasks due today
	 *
	 * Zuhandenheit: "What needs attention today" not "filter by due date"
	 */
	async getTodaysTasks(userId?: number): Promise<ActionResult<FUBTask[]>> {
		try {
			const today = new Date();
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			const options: ListTasksOptions = {
				completed: false,
				dueBefore: tomorrow.toISOString().split('T')[0],
				dueAfter: today.toISOString().split('T')[0],
				limit: 100,
			};

			if (userId) options.assignedUserId = userId;

			return await this.listTasks(options);
		} catch (error) {
			return handleError(error, 'get-todays-tasks');
		}
	}

	/**
	 * Get overdue tasks
	 *
	 * Zuhandenheit: "Tasks that slipped through" not "filter by past due date"
	 */
	async getOverdueTasks(userId?: number): Promise<ActionResult<FUBTask[]>> {
		try {
			const today = new Date().toISOString().split('T')[0];

			const options: ListTasksOptions = {
				completed: false,
				dueBefore: today,
				limit: 100,
			};

			if (userId) options.assignedUserId = userId;

			return await this.listTasks(options);
		} catch (error) {
			return handleError(error, 'get-overdue-tasks');
		}
	}

	// ==========================================================================
	// DEALS
	// ==========================================================================

	/**
	 * Create a deal
	 */
	async createDeal(options: CreateDealOptions): Promise<ActionResult<FUBDeal>> {
		try {
			const body: Record<string, unknown> = {
				name: options.name,
				pipelineId: options.pipelineId,
				stageId: options.stageId,
			};

			if (options.price) body.price = options.price;
			if (options.closeDate) body.closeDate = options.closeDate;
			if (options.assignedUserId) body.assignedUserId = options.assignedUserId;
			if (options.people) body.people = options.people;
			if (options.properties) body.properties = options.properties;

			const response = await this.request<FUBDeal>('POST', '/deals', body);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'create-deal');
		}
	}

	/**
	 * List deals
	 */
	async listDeals(options: ListDealsOptions = {}): Promise<ActionResult<FUBDeal[]>> {
		try {
			const params: Record<string, string> = {};
			if (options.pipelineId) params.pipelineId = options.pipelineId.toString();
			if (options.stageId) params.stageId = options.stageId.toString();
			if (options.assignedUserId) params.assignedUserId = options.assignedUserId.toString();
			if (options.personId) params.personId = options.personId.toString();
			if (options.limit) params.limit = options.limit.toString();
			if (options.offset) params.offset = options.offset.toString();

			const query = buildQueryString(params);
			const response = await this.request<FUBPaginatedResponse<FUBDeal>>(
				'GET',
				`/deals${query}`
			);

			return createActionResult.success(response.deals || []);
		} catch (error) {
			return handleError(error, 'list-deals');
		}
	}

	/**
	 * Get a deal by ID
	 */
	async getDeal(dealId: number): Promise<ActionResult<FUBDeal>> {
		try {
			const response = await this.request<FUBDeal>('GET', `/deals/${dealId}`);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'get-deal');
		}
	}

	/**
	 * Update deal stage
	 */
	async updateDealStage(dealId: number, stageId: number): Promise<ActionResult<FUBDeal>> {
		try {
			const response = await this.request<FUBDeal>('PUT', `/deals/${dealId}`, {
				stageId,
			});
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'update-deal-stage');
		}
	}

	/**
	 * Close a deal as won
	 */
	async closeDealWon(dealId: number, closeDate?: string): Promise<ActionResult<FUBDeal>> {
		try {
			const body: Record<string, unknown> = {
				closedWon: true,
				closeDate: closeDate || new Date().toISOString().split('T')[0],
			};

			const response = await this.request<FUBDeal>('PUT', `/deals/${dealId}`, body);
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'close-deal-won');
		}
	}

	// ==========================================================================
	// USERS
	// ==========================================================================

	/**
	 * Get current user (me)
	 */
	async getMe(): Promise<ActionResult<FUBUser>> {
		try {
			const response = await this.request<FUBUser>('GET', '/me');
			return createActionResult.success(response);
		} catch (error) {
			return handleError(error, 'get-me');
		}
	}

	/**
	 * List users in the account
	 */
	async listUsers(): Promise<ActionResult<FUBUser[]>> {
		try {
			const response = await this.request<FUBPaginatedResponse<FUBUser>>('GET', '/users');
			return createActionResult.success(response.users || []);
		} catch (error) {
			return handleError(error, 'list-users');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * Verify webhook signature
	 *
	 * Follow Up Boss webhooks use a simple shared secret verification
	 */
	static verifyWebhook(
		payload: string,
		signature: string,
		secret: string
	): boolean {
		// Follow Up Boss uses a simple HMAC verification
		// The signature is typically in the X-FUB-Signature header
		const encoder = new TextEncoder();
		const key = encoder.encode(secret);
		const data = encoder.encode(payload);

		// Use Web Crypto API for HMAC
		return crypto.subtle
			.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
			.then(cryptoKey =>
				crypto.subtle.verify(
					'HMAC',
					cryptoKey,
					hexToBytes(signature),
					data
				)
			)
			.then(isValid => isValid)
			.catch(() => false) as unknown as boolean;
	}

	/**
	 * Parse webhook payload
	 */
	static parseWebhook(payload: string): FUBWebhookEvent {
		return JSON.parse(payload) as FUBWebhookEvent;
	}
}

// ============================================================================
// HELPERS
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

// ============================================================================
// STANDARD DATA CONVERTERS
// ============================================================================

/**
 * Convert Follow Up Boss person to StandardContact
 */
export function toStandardContact(person: FUBPerson) {
	return {
		id: person.id.toString(),
		name: `${person.firstName} ${person.lastName || ''}`.trim(),
		email: person.emails?.[0]?.value,
		phone: person.phones?.[0]?.value,
		source: 'follow-up-boss' as const,
		raw: person,
	};
}

/**
 * Convert Follow Up Boss task to StandardTask
 */
export function toStandardTask(task: FUBTask) {
	return {
		id: task.id.toString(),
		title: task.name,
		description: task.description,
		status: task.completed ? 'done' : 'pending',
		dueDate: task.dueDate,
		source: 'follow-up-boss' as const,
		raw: task,
	};
}

/**
 * HubSpot CRM Integration for WORKWAY
 *
 * Unified client for HubSpot CRM operations: Contacts, Companies, Deals.
 * Designed for meeting follow-up automation - update deal stages,
 * log meeting activities, and track engagement.
 *
 * @example
 * ```typescript
 * import { HubSpot } from '@workwayco/integrations/hubspot';
 *
 * const hubspot = new HubSpot({ accessToken: tokens.hubspot.access_token });
 *
 * // Search for a deal by name
 * const deals = await hubspot.searchDeals({ query: 'Acme Corp' });
 *
 * // Update deal after meeting
 * await hubspot.updateDealFromMeeting({
 *   dealId: '123',
 *   meetingTitle: 'Q4 Planning',
 *   summary: 'Discussed roadmap...',
 *   nextSteps: ['Send proposal', 'Schedule follow-up'],
 * });
 *
 * // Log a meeting activity
 * await hubspot.logMeetingActivity({
 *   dealId: '123',
 *   meetingTitle: 'Demo Call',
 *   duration: 30,
 *   notes: 'Showed product features...',
 * });
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
	validateAccessToken,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * HubSpot integration configuration
 */
export interface HubSpotConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * HubSpot contact object
 */
export interface HubSpotContact {
	id: string;
	properties: {
		firstname?: string;
		lastname?: string;
		email?: string;
		phone?: string;
		company?: string;
		jobtitle?: string;
		[key: string]: string | undefined;
	};
	createdAt: string;
	updatedAt: string;
}

/**
 * HubSpot company object
 */
export interface HubSpotCompany {
	id: string;
	properties: {
		name?: string;
		domain?: string;
		industry?: string;
		phone?: string;
		city?: string;
		state?: string;
		country?: string;
		[key: string]: string | undefined;
	};
	createdAt: string;
	updatedAt: string;
}

/**
 * HubSpot deal object
 */
export interface HubSpotDeal {
	id: string;
	properties: {
		dealname?: string;
		dealstage?: string;
		amount?: string;
		closedate?: string;
		pipeline?: string;
		hubspot_owner_id?: string;
		description?: string;
		notes_last_updated?: string;
		[key: string]: string | undefined;
	};
	createdAt: string;
	updatedAt: string;
}

/**
 * HubSpot engagement (activity) object
 */
export interface HubSpotEngagement {
	id: string;
	type: 'MEETING' | 'NOTE' | 'CALL' | 'EMAIL' | 'TASK';
	timestamp: number;
	metadata: Record<string, unknown>;
	associations: {
		contactIds?: string[];
		companyIds?: string[];
		dealIds?: string[];
	};
}

/**
 * Search options
 */
export interface SearchOptions {
	/** Search query */
	query: string;
	/** Maximum results (default: 10) */
	limit?: number;
	/** Properties to return */
	properties?: string[];
}

/**
 * Deal update options
 */
export interface UpdateDealOptions {
	/** Deal ID */
	dealId: string;
	/** Properties to update */
	properties: Record<string, string>;
}

/**
 * Options for updating deal after a meeting
 *
 * Zuhandenheit: Outcome-focused interface
 * Developer thinks "update CRM after meeting" not "construct property object"
 */
export interface UpdateDealAfterMeetingOptions {
	/** Deal ID */
	dealId: string;
	/** Meeting summary - what was discussed */
	summary: string;
	/**
	 * Meeting outcome - infers stage progression
	 * - 'progressed': Move to next stage in pipeline
	 * - 'stalled': Keep current stage, log concern
	 * - 'closed-won': Move to closed-won
	 * - 'closed-lost': Move to closed-lost
	 */
	outcome?: 'progressed' | 'stalled' | 'closed-won' | 'closed-lost';
	/** Link to full notes (Notion, Google Doc, etc) */
	notesUrl?: string;
}

/**
 * @deprecated Use UpdateDealAfterMeetingOptions instead
 * Legacy interface kept for backwards compatibility
 */
export interface UpdateDealFromMeetingOptions {
	/** Deal ID */
	dealId: string;
	/** Meeting title */
	meetingTitle: string;
	/** Meeting summary */
	summary?: string;
	/** Action items from the meeting */
	actionItems?: Array<{ task: string; assignee?: string }>;
	/** Next steps */
	nextSteps?: string[];
	/** Move deal to this stage (optional) */
	newStage?: string;
	/** Notion URL for full notes */
	notionUrl?: string;
}

/**
 * Options for logging meeting activity
 */
export interface LogMeetingActivityOptions {
	/** Deal ID to associate with */
	dealId?: string;
	/** Contact IDs to associate with */
	contactIds?: string[];
	/** Company ID to associate with */
	companyId?: string;
	/** Meeting title */
	meetingTitle: string;
	/** Meeting duration in minutes */
	duration?: number;
	/** Meeting notes/summary */
	notes?: string;
	/** Meeting start time (ISO string or timestamp) */
	startTime?: string | number;
	/** External meeting URL (e.g., Notion page) */
	externalUrl?: string;
}

// ============================================================================
// HUBSPOT INTEGRATION CLASS
// ============================================================================

/** Error handler bound to HubSpot integration */
const handleError = createErrorHandler('hubspot');

/**
 * HubSpot CRM Integration
 *
 * Weniger, aber besser: Unified CRM client for meeting follow-up automation.
 */
export class HubSpot extends BaseAPIClient {
	constructor(config: HubSpotConfig) {
		validateAccessToken(config.accessToken, 'hubspot');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.hubapi.com',
			timeout: config.timeout,
		});
	}

	// ==========================================================================
	// CONTACTS
	// ==========================================================================

	/**
	 * Search for contacts
	 */
	async searchContacts(options: SearchOptions): Promise<ActionResult<HubSpotContact[]>> {
		const { query, limit = 10, properties = ['firstname', 'lastname', 'email', 'company'] } = options;

		try {
			const response = await this.post('/crm/v3/objects/contacts/search', {
				query,
				limit,
				properties,
			});
			await assertResponseOk(response, { integration: 'hubspot', action: 'search-contacts' });

			const data = (await response.json()) as { results: HubSpotContact[] };

			return createActionResult({
				data: data.results,
				integration: 'hubspot',
				action: 'search-contacts',
				schema: 'hubspot.contacts.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'search-contacts');
		}
	}

	/**
	 * Get a contact by ID
	 */
	async getContact(contactId: string): Promise<ActionResult<HubSpotContact>> {
		try {
			const response = await this.get(`/crm/v3/objects/contacts/${contactId}`);
			await assertResponseOk(response, { integration: 'hubspot', action: 'get-contact' });

			const contact = (await response.json()) as HubSpotContact;

			return createActionResult({
				data: contact,
				integration: 'hubspot',
				action: 'get-contact',
				schema: 'hubspot.contact.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-contact');
		}
	}

	/**
	 * Get contact by email
	 */
	async getContactByEmail(email: string): Promise<ActionResult<HubSpotContact | null>> {
		try {
			const response = await this.post('/crm/v3/objects/contacts/search', {
				filterGroups: [
					{
						filters: [
							{
								propertyName: 'email',
								operator: 'EQ',
								value: email,
							},
						],
					},
				],
				properties: ['firstname', 'lastname', 'email', 'company', 'phone'],
				limit: 1,
			});
			await assertResponseOk(response, { integration: 'hubspot', action: 'get-contact-by-email' });

			const data = (await response.json()) as { results: HubSpotContact[] };

			return createActionResult({
				data: data.results[0] || null,
				integration: 'hubspot',
				action: 'get-contact-by-email',
				schema: 'hubspot.contact.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-contact-by-email');
		}
	}

	// ==========================================================================
	// COMPANIES
	// ==========================================================================

	/**
	 * Search for companies
	 */
	async searchCompanies(options: SearchOptions): Promise<ActionResult<HubSpotCompany[]>> {
		const { query, limit = 10, properties = ['name', 'domain', 'industry'] } = options;

		try {
			const response = await this.post('/crm/v3/objects/companies/search', {
				query,
				limit,
				properties,
			});
			await assertResponseOk(response, { integration: 'hubspot', action: 'search-companies' });

			const data = (await response.json()) as { results: HubSpotCompany[] };

			return createActionResult({
				data: data.results,
				integration: 'hubspot',
				action: 'search-companies',
				schema: 'hubspot.companies.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'search-companies');
		}
	}

	// ==========================================================================
	// DEALS
	// ==========================================================================

	/**
	 * Search for deals
	 */
	async searchDeals(options: SearchOptions): Promise<ActionResult<HubSpotDeal[]>> {
		const { query, limit = 10, properties = ['dealname', 'dealstage', 'amount', 'closedate', 'pipeline'] } = options;

		try {
			const response = await this.post('/crm/v3/objects/deals/search', {
				query,
				limit,
				properties,
			});
			await assertResponseOk(response, { integration: 'hubspot', action: 'search-deals' });

			const data = (await response.json()) as { results: HubSpotDeal[] };

			return createActionResult({
				data: data.results,
				integration: 'hubspot',
				action: 'search-deals',
				schema: 'hubspot.deals.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'search-deals');
		}
	}

	/**
	 * Get a deal by ID
	 */
	async getDeal(dealId: string): Promise<ActionResult<HubSpotDeal>> {
		try {
			const response = await this.get(
				`/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,amount,closedate,pipeline,description`
			);
			await assertResponseOk(response, { integration: 'hubspot', action: 'get-deal' });

			const deal = (await response.json()) as HubSpotDeal;

			return createActionResult({
				data: deal,
				integration: 'hubspot',
				action: 'get-deal',
				schema: 'hubspot.deal.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-deal');
		}
	}

	/**
	 * Update a deal
	 */
	async updateDeal(options: UpdateDealOptions): Promise<ActionResult<HubSpotDeal>> {
		const { dealId, properties } = options;

		if (!dealId) {
			return ActionResult.error('Deal ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'hubspot',
				action: 'update-deal',
			});
		}

		try {
			const response = await this.patch(`/crm/v3/objects/deals/${dealId}`, {
				properties,
			});
			await assertResponseOk(response, { integration: 'hubspot', action: 'update-deal' });

			const deal = (await response.json()) as HubSpotDeal;

			return createActionResult({
				data: deal,
				integration: 'hubspot',
				action: 'update-deal',
				schema: 'hubspot.deal.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-deal');
		}
	}

	/**
	 * Update deal after a meeting (Zuhandenheit API)
	 *
	 * Outcome-focused: Developer thinks "meeting went well, deal progressed"
	 * not "PATCH description, lookup stage ID, format timestamp"
	 *
	 * @example
	 * ```typescript
	 * await hubspot.updateDealAfterMeeting({
	 *   dealId: '123',
	 *   summary: 'Discussed Q4 roadmap, client approved budget',
	 *   outcome: 'progressed',
	 *   notesUrl: 'https://notion.so/meeting-notes/abc'
	 * });
	 * ```
	 */
	async updateDealAfterMeeting(options: UpdateDealAfterMeetingOptions): Promise<ActionResult<HubSpotDeal>> {
		const { dealId, summary, outcome, notesUrl } = options;

		if (!dealId) {
			return ActionResult.error('Deal ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'hubspot',
				action: 'update-deal-after-meeting',
			});
		}

		if (!summary) {
			return ActionResult.error('Meeting summary is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'hubspot',
				action: 'update-deal-after-meeting',
			});
		}

		// Get current deal state
		const currentDealResult = await this.getDeal(dealId);
		if (!currentDealResult.success) {
			return currentDealResult;
		}

		const currentDescription = currentDealResult.data.properties.description || '';
		const timestamp = new Date().toISOString().split('T')[0];

		// Build concise meeting note
		const meetingNote = [
			`---`,
			`**Meeting** (${timestamp})`,
			``,
			summary,
			notesUrl ? `\n[Full notes](${notesUrl})` : '',
			`---`,
		].filter(Boolean).join('\n');

		const properties: Record<string, string> = {
			description: `${currentDescription}\n\n${meetingNote}`.trim(),
			notes_last_updated: new Date().toISOString(),
		};

		// Infer stage changes from outcome
		if (outcome === 'closed-won') {
			properties.dealstage = 'closedwon';
		} else if (outcome === 'closed-lost') {
			properties.dealstage = 'closedlost';
		}
		// 'progressed' and 'stalled' don't auto-change stage - that requires pipeline context

		return this.updateDeal({ dealId, properties });
	}

	/**
	 * @deprecated Use updateDealAfterMeeting instead
	 * Legacy method kept for backwards compatibility
	 */
	async updateDealFromMeeting(options: UpdateDealFromMeetingOptions): Promise<ActionResult<HubSpotDeal>> {
		const { dealId, meetingTitle, summary, actionItems, nextSteps, newStage, notionUrl } = options;

		if (!dealId) {
			return ActionResult.error('Deal ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'hubspot',
				action: 'update-deal-from-meeting',
			});
		}

		// Build meeting note
		const timestamp = new Date().toISOString().split('T')[0];
		const actionItemsList = actionItems?.length
			? actionItems.map((item) => `- ${item.task}${item.assignee ? ` (@${item.assignee})` : ''}`).join('\n')
			: '';
		const nextStepsList = nextSteps?.length ? nextSteps.map((s) => `- ${s}`).join('\n') : '';

		const meetingNote = `
---
**Meeting: ${meetingTitle}** (${timestamp})

${summary || ''}

${actionItemsList ? `**Action Items:**\n${actionItemsList}` : ''}

${nextStepsList ? `**Next Steps:**\n${nextStepsList}` : ''}

${notionUrl ? `[Full meeting notes](${notionUrl})` : ''}
---
`.trim();

		// Get current deal to append to description
		const currentDealResult = await this.getDeal(dealId);
		const currentDescription = currentDealResult.success
			? currentDealResult.data.properties.description || ''
			: '';

		const properties: Record<string, string> = {
			description: `${currentDescription}\n\n${meetingNote}`.trim(),
			notes_last_updated: new Date().toISOString(),
		};

		if (newStage) {
			properties.dealstage = newStage;
		}

		return this.updateDeal({ dealId, properties });
	}

	// ==========================================================================
	// ENGAGEMENTS (Activities)
	// ==========================================================================

	/**
	 * Log a meeting activity
	 *
	 * Creates a meeting engagement in HubSpot associated with deals, contacts, or companies.
	 */
	async logMeetingActivity(options: LogMeetingActivityOptions): Promise<ActionResult<HubSpotEngagement>> {
		const { dealId, contactIds, companyId, meetingTitle, duration, notes, startTime, externalUrl } = options;

		if (!dealId && !contactIds?.length && !companyId) {
			return ActionResult.error(
				'At least one association (dealId, contactIds, or companyId) is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'hubspot', action: 'log-meeting-activity' }
			);
		}

		try {
			const timestamp = startTime
				? typeof startTime === 'string'
					? new Date(startTime).getTime()
					: startTime
				: Date.now();

			// Build associations
			const associations: Array<{ to: { id: string }; types: Array<{ associationCategory: string; associationTypeId: number }> }> = [];

			if (dealId) {
				associations.push({
					to: { id: dealId },
					types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 206 }], // meeting to deal
				});
			}

			if (contactIds) {
				for (const contactId of contactIds) {
					associations.push({
						to: { id: contactId },
						types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }], // meeting to contact
					});
				}
			}

			if (companyId) {
				associations.push({
					to: { id: companyId },
					types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 188 }], // meeting to company
				});
			}

			// Build meeting body with notes
			let meetingBody = notes || '';
			if (externalUrl) {
				meetingBody += `\n\n[View full meeting notes](${externalUrl})`;
			}

			const response = await this.post('/crm/v3/objects/meetings', {
				properties: {
					hs_meeting_title: meetingTitle,
					hs_meeting_body: meetingBody,
					hs_meeting_start_time: new Date(timestamp).toISOString(),
					hs_meeting_end_time: duration
						? new Date(timestamp + duration * 60 * 1000).toISOString()
						: new Date(timestamp + 30 * 60 * 1000).toISOString(), // Default 30 min
					hs_meeting_outcome: 'COMPLETED',
				},
				associations,
			});
			await assertResponseOk(response, { integration: 'hubspot', action: 'log-meeting-activity' });

			const engagement = (await response.json()) as HubSpotEngagement;

			return createActionResult({
				data: engagement,
				integration: 'hubspot',
				action: 'log-meeting-activity',
				schema: 'hubspot.engagement.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'log-meeting-activity');
		}
	}

	// ==========================================================================
	// PIPELINE UTILITIES
	// ==========================================================================

	/**
	 * Get deal pipelines and stages
	 */
	async getDealPipelines(): Promise<ActionResult<Array<{
		id: string;
		label: string;
		stages: Array<{ id: string; label: string }>;
	}>>> {
		try {
			const response = await this.get('/crm/v3/pipelines/deals');
			await assertResponseOk(response, { integration: 'hubspot', action: 'get-deal-pipelines' });

			const data = (await response.json()) as {
				results: Array<{
					id: string;
					label: string;
					stages: Array<{ id: string; label: string }>;
				}>;
			};

			return createActionResult({
				data: data.results,
				integration: 'hubspot',
				action: 'get-deal-pipelines',
				schema: 'hubspot.pipelines.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-deal-pipelines');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Get capabilities for HubSpot actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: true,
			canHandleImages: false,
			canHandleAttachments: false,
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

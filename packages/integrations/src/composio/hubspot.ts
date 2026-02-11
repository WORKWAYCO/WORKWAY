/**
 * Composio-backed HubSpot Integration
 *
 * Typed wrapper around ComposioAdapter for HubSpot CRM operations.
 * Standard Integration tier — commodity CRUD backed by Composio.
 *
 * When to use this vs custom HubSpot integration:
 * - Use ComposioHubSpot for basic CRM operations (create/read contacts, deals)
 * - Use custom for deep workflows (pipeline automation, custom properties,
 *   deal scoring, engagement tracking, etc.)
 *
 * @example
 * ```typescript
 * import { ComposioHubSpot } from '@workwayco/integrations/composio';
 *
 * const hubspot = new ComposioHubSpot({
 *   composioApiKey: env.COMPOSIO_API_KEY,
 *   connectedAccountId: 'user_hubspot_account_id',
 * });
 *
 * const result = await hubspot.createContact({
 *   email: 'client@example.com',
 *   firstname: 'Jane',
 *   lastname: 'Doe',
 * });
 * ```
 */

import type { ActionResult } from '@workwayco/sdk';
import { ComposioAdapter, type ComposioAdapterConfig } from './adapter.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ComposioHubSpotContact {
	id: string;
	properties: {
		email?: string;
		firstname?: string;
		lastname?: string;
		company?: string;
		phone?: string;
		[key: string]: unknown;
	};
	createdAt?: string;
	updatedAt?: string;
}

export interface ComposioHubSpotDeal {
	id: string;
	properties: {
		dealname?: string;
		amount?: string;
		pipeline?: string;
		dealstage?: string;
		closedate?: string;
		[key: string]: unknown;
	};
	createdAt?: string;
	updatedAt?: string;
}

export interface ComposioHubSpotConfig {
	composioApiKey: string;
	connectedAccountId?: string;
	entityId?: string;
	apiUrl?: string;
	timeout?: number;
}

// ============================================================================
// COMPOSIO HUBSPOT
// ============================================================================

export class ComposioHubSpot extends ComposioAdapter {
	constructor(config: ComposioHubSpotConfig) {
		super({
			...config,
			appName: 'hubspot',
		});
	}

	/**
	 * Create a new contact
	 */
	async createContact(
		properties: Record<string, string>
	): Promise<ActionResult<ComposioHubSpotContact>> {
		return this.executeAction<ComposioHubSpotContact>(
			'HUBSPOT_CREATE_CONTACT',
			{ properties }
		);
	}

	/**
	 * Get a contact by ID
	 */
	async getContact(
		contactId: string
	): Promise<ActionResult<ComposioHubSpotContact>> {
		return this.executeAction<ComposioHubSpotContact>(
			'HUBSPOT_GET_CONTACT',
			{ contact_id: contactId }
		);
	}

	/**
	 * Search contacts
	 */
	async searchContacts(
		query: string,
		options: { limit?: number } = {}
	): Promise<ActionResult<ComposioHubSpotContact[]>> {
		return this.executeAction<ComposioHubSpotContact[]>(
			'HUBSPOT_SEARCH_CONTACTS',
			{ query, limit: options.limit || 10 }
		);
	}

	/**
	 * Create a new deal
	 */
	async createDeal(
		properties: Record<string, string>
	): Promise<ActionResult<ComposioHubSpotDeal>> {
		return this.executeAction<ComposioHubSpotDeal>(
			'HUBSPOT_CREATE_DEAL',
			{ properties }
		);
	}

	/**
	 * Update a deal
	 */
	async updateDeal(
		dealId: string,
		properties: Record<string, string>
	): Promise<ActionResult<ComposioHubSpotDeal>> {
		return this.executeAction<ComposioHubSpotDeal>(
			'HUBSPOT_UPDATE_DEAL',
			{ deal_id: dealId, properties }
		);
	}

	/**
	 * List deals
	 */
	async listDeals(
		options: { limit?: number } = {}
	): Promise<ActionResult<ComposioHubSpotDeal[]>> {
		return this.executeAction<ComposioHubSpotDeal[]>(
			'HUBSPOT_LIST_DEALS',
			{ limit: options.limit || 10 }
		);
	}
}

/**
 * Bluebeam API Integration for WORKWAY
 *
 * Document collaboration, markup, and Studio Sessions for construction teams.
 * Covers Studio Sessions, documents, markups, snapshots, and user management.
 *
 * Zuhandenheit: Teams don't want "Studio Session APIs" - they want:
 * - Drawings marked up in real-time across trades
 * - RFI responses annotated directly on plans
 * - Submittals reviewed without printing a single page
 * - Markups that become the record of decisions
 *
 * @example
 * ```typescript
 * import { Bluebeam } from '@workwayco/integrations/bluebeam';
 *
 * const bb = new Bluebeam({
 *   accessToken: process.env.BLUEBEAM_ACCESS_TOKEN,
 *   region: 'US',
 * });
 *
 * // List active sessions
 * const sessions = await bb.getSessions();
 *
 * // Get markups on a document
 * const markups = await bb.getMarkups('session-id', 'doc-id');
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

export type BluebeamRegion = 'US' | 'AU' | 'DE' | 'UK' | 'SE';

/**
 * Bluebeam integration configuration
 *
 * Authentication: OAuth 2.0 (Authorization Code + Refresh Token)
 * Region-specific API endpoints
 */
export interface BluebeamConfig {
	/** OAuth access token */
	accessToken: string;
	/** Bluebeam region */
	region?: BluebeamRegion;
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
// Studio Session Resources
// ----------------------------------------------------------------------------

/** Studio Session */
export interface BluebeamSession {
	Id: string;
	Name: string;
	Description?: string;
	Restricted: boolean;
	Notification: boolean;
	Status: 'Active' | 'Ended';
	SessionEndDate?: string;
	Owner: string;
	InviteUrl?: string;
	Created: string;
	Updated: string;
}

/** Document in a session */
export interface BluebeamDocument {
	Id: string;
	SessionId: string;
	Name: string;
	FileName: string;
	FileSize?: number;
	PageCount?: number;
	IsCheckedOut: boolean;
	CheckedOutBy?: string;
	Created: string;
	Updated: string;
}

/** Markup annotation */
export interface BluebeamMarkup {
	Id: string;
	SessionId: string;
	DocumentId: string;
	Author: string;
	Subject?: string;
	Comments?: string;
	Label?: string;
	Color?: string;
	Page: number;
	Type: string;
	Status?: string;
	Layer?: string;
	Space?: string;
	Created: string;
	Modified: string;
}

/** Session snapshot */
export interface BluebeamSnapshot {
	Id: string;
	SessionId: string;
	Name: string;
	Created: string;
	Creator: string;
}

/** Session user/participant */
export interface BluebeamUser {
	Id: string;
	Email: string;
	Name?: string;
	Permission: 'Owner' | 'Admin' | 'User' | 'ReadOnly';
	Status: 'Active' | 'Pending' | 'Removed';
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface CreateSessionOptions {
	name: string;
	description?: string;
	restricted?: boolean;
	notification?: boolean;
	sessionEndDate?: string;
}

export interface AddMarkupOptions {
	sessionId: string;
	documentId: string;
	subject?: string;
	comments?: string;
	label?: string;
	page: number;
	type: string;
	color?: string;
}

// ============================================================================
// REGION CONFIGURATION
// ============================================================================

const REGION_URLS: Record<BluebeamRegion, string> = {
	US: 'https://studioapi.bluebeam.com',
	AU: 'https://studioapi-au.bluebeam.com',
	DE: 'https://studioapi-de.bluebeam.com',
	UK: 'https://studioapi-uk.bluebeam.com',
	SE: 'https://studioapi-se.bluebeam.com',
};

const REGION_AUTH_URLS: Record<BluebeamRegion, string> = {
	US: 'https://authserver.bluebeam.com',
	AU: 'https://authserver-au.bluebeam.com',
	DE: 'https://authserver-de.bluebeam.com',
	UK: 'https://authserver-uk.bluebeam.com',
	SE: 'https://authserver-se.bluebeam.com',
};

// ============================================================================
// BLUEBEAM INTEGRATION CLASS
// ============================================================================

/**
 * Bluebeam API Integration
 *
 * Weniger, aber besser: Document collaboration for construction teams.
 *
 * API: REST (JSON)
 * Auth: OAuth 2.0
 * Regions: US, AU, DE, UK, SE (separate endpoints per region)
 */
export class Bluebeam extends BaseAPIClient {
	private readonly region: BluebeamRegion;

	constructor(config: BluebeamConfig) {
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Bluebeam access token is required',
				{ integration: 'bluebeam' }
			);
		}

		const region = config.region || 'US';

		super({
			accessToken: config.accessToken,
			apiUrl: REGION_URLS[region],
			timeout: config.timeout,
			errorContext: { integration: 'bluebeam' },
			tokenRefresh: config.tokenRefresh ? {
				refreshToken: config.tokenRefresh.refreshToken,
				tokenEndpoint: `${REGION_AUTH_URLS[region]}/auth/token`,
				clientId: config.tokenRefresh.clientId,
				clientSecret: config.tokenRefresh.clientSecret,
				onTokenRefreshed: config.tokenRefresh.onTokenRefreshed,
			} : undefined,
		});

		this.region = region;
	}

	// ==========================================================================
	// SESSIONS
	// ==========================================================================

	/**
	 * Get all sessions
	 */
	async getSessions(): Promise<ActionResult<BluebeamSession[]>> {
		try {
			const sessions = await this.getJson<BluebeamSession[]>('/publicapi/v1/sessions');

			return createActionResult({
				data: sessions,
				integration: 'bluebeam',
				action: 'get-sessions',
				schema: 'bluebeam.sessions.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-sessions');
		}
	}

	/**
	 * Get a specific session
	 */
	async getSession(sessionId: string): Promise<ActionResult<BluebeamSession>> {
		try {
			const session = await this.getJson<BluebeamSession>(`/publicapi/v1/sessions/${sessionId}`);

			return createActionResult({
				data: session,
				integration: 'bluebeam',
				action: 'get-session',
				schema: 'bluebeam.session.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-session');
		}
	}

	/**
	 * Create a new session
	 */
	async createSession(options: CreateSessionOptions): Promise<ActionResult<BluebeamSession>> {
		try {
			const session = await this.postJson<BluebeamSession>(
				'/publicapi/v1/sessions',
				{
					Name: options.name,
					Description: options.description,
					Restricted: options.restricted ?? false,
					Notification: options.notification ?? true,
					SessionEndDate: options.sessionEndDate,
				}
			);

			return createActionResult({
				data: session,
				integration: 'bluebeam',
				action: 'create-session',
				schema: 'bluebeam.session.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-session');
		}
	}

	/**
	 * End a session
	 */
	async endSession(sessionId: string): Promise<ActionResult<{ success: boolean }>> {
		try {
			await this.delete(`/publicapi/v1/sessions/${sessionId}`);

			return createActionResult({
				data: { success: true },
				integration: 'bluebeam',
				action: 'end-session',
				schema: 'bluebeam.session-action.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'end-session');
		}
	}

	// ==========================================================================
	// DOCUMENTS
	// ==========================================================================

	/**
	 * Get documents in a session
	 */
	async getSessionDocuments(sessionId: string): Promise<ActionResult<BluebeamDocument[]>> {
		try {
			const documents = await this.getJson<BluebeamDocument[]>(
				`/publicapi/v1/sessions/${sessionId}/documents`
			);

			return createActionResult({
				data: documents,
				integration: 'bluebeam',
				action: 'get-session-documents',
				schema: 'bluebeam.documents.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-session-documents');
		}
	}

	// ==========================================================================
	// MARKUPS
	// ==========================================================================

	/**
	 * Get markups on a document
	 */
	async getMarkups(sessionId: string, documentId: string): Promise<ActionResult<BluebeamMarkup[]>> {
		try {
			const markups = await this.getJson<BluebeamMarkup[]>(
				`/publicapi/v1/sessions/${sessionId}/documents/${documentId}/markups`
			);

			return createActionResult({
				data: markups,
				integration: 'bluebeam',
				action: 'get-markups',
				schema: 'bluebeam.markups.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-markups');
		}
	}

	/**
	 * Add a markup to a document
	 */
	async addMarkup(options: AddMarkupOptions): Promise<ActionResult<BluebeamMarkup>> {
		try {
			const markup = await this.postJson<BluebeamMarkup>(
				`/publicapi/v1/sessions/${options.sessionId}/documents/${options.documentId}/markups`,
				{
					Subject: options.subject,
					Comments: options.comments,
					Label: options.label,
					Page: options.page,
					Type: options.type,
					Color: options.color,
				}
			);

			return createActionResult({
				data: markup,
				integration: 'bluebeam',
				action: 'add-markup',
				schema: 'bluebeam.markup.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'add-markup');
		}
	}

	// ==========================================================================
	// SNAPSHOTS
	// ==========================================================================

	/**
	 * Get snapshots for a session
	 */
	async getSnapshots(sessionId: string): Promise<ActionResult<BluebeamSnapshot[]>> {
		try {
			const snapshots = await this.getJson<BluebeamSnapshot[]>(
				`/publicapi/v1/sessions/${sessionId}/snapshots`
			);

			return createActionResult({
				data: snapshots,
				integration: 'bluebeam',
				action: 'get-snapshots',
				schema: 'bluebeam.snapshots.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-snapshots');
		}
	}

	// ==========================================================================
	// USERS
	// ==========================================================================

	/**
	 * Get session participants
	 */
	async getUsers(sessionId: string): Promise<ActionResult<BluebeamUser[]>> {
		try {
			const users = await this.getJson<BluebeamUser[]>(
				`/publicapi/v1/sessions/${sessionId}/users`
			);

			return createActionResult({
				data: users,
				integration: 'bluebeam',
				action: 'get-users',
				schema: 'bluebeam.users.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-users');
		}
	}

	/**
	 * Invite a user to a session
	 */
	async inviteUser(sessionId: string, email: string, permission: BluebeamUser['Permission'] = 'User'): Promise<ActionResult<BluebeamUser>> {
		try {
			const user = await this.postJson<BluebeamUser>(
				`/publicapi/v1/sessions/${sessionId}/users`,
				{ Email: email, Permission: permission }
			);

			return createActionResult({
				data: user,
				integration: 'bluebeam',
				action: 'invite-user',
				schema: 'bluebeam.user.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'invite-user');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'bluebeam',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'bluebeam',
			action,
		});
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: true,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true,
			supportsSearch: false,
			supportsPagination: false,
			supportsNesting: false,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

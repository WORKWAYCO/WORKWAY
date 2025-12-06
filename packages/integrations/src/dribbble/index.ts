/**
 * Dribbble Integration for WORKWAY
 *
 * Enables design portfolio automation: sync shots to Notion,
 * showcase work on websites, track design engagement, and inspire teams.
 *
 * Key use cases:
 * - New Shot Published → Notion portfolio + Slack announcement
 * - Design Inspiration → Curate trending shots for team
 * - Portfolio Sync → Auto-update website with latest work
 *
 * @example
 * ```typescript
 * import { Dribbble } from '@workwayco/integrations/dribbble';
 *
 * const dribbble = new Dribbble({ accessToken: tokens.dribbble.access_token });
 *
 * // Get current user
 * const user = await dribbble.getCurrentUser();
 *
 * // List shots
 * const shots = await dribbble.listShots({ perPage: 10 });
 *
 * // Get a specific shot
 * const shot = await dribbble.getShot('12345678');
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
 * Dribbble integration configuration
 */
export interface DribbbleConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ============================================================================
// IMAGE TYPES
// ============================================================================

/**
 * Shot image URLs in different sizes
 */
export interface DribbbleImages {
	/** High DPI image (if available) */
	hidpi: string | null;
	/** Normal resolution image */
	normal: string;
	/** Teaser/thumbnail image */
	teaser: string;
}

/**
 * Video information (for animated shots)
 */
export interface DribbbleVideo {
	/** Video ID */
	id: number;
	/** Video duration in seconds */
	duration: number;
	/** Video dimensions */
	width: number;
	height: number;
	/** Silent video (no audio) */
	silent: boolean;
	/** Preview frame URLs */
	previews: {
		p480: string;
	};
	/** Video URL */
	url: string;
}

// ============================================================================
// ATTACHMENT TYPES
// ============================================================================

/**
 * File attachment on a shot
 */
export interface DribbbleAttachment {
	/** Attachment ID */
	id: number;
	/** Direct URL to the attachment file */
	url: string;
	/** Thumbnail URL */
	thumbnail_url: string;
	/** File size in bytes */
	size: number;
	/** MIME type */
	content_type: string;
	/** When the attachment was created */
	created_at: string;
}

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * Social/web links for a user
 */
export interface DribbbleLinks {
	/** Personal website URL */
	web: string | null;
	/** Twitter handle */
	twitter: string | null;
}

/**
 * Team that a user belongs to
 */
export interface DribbbleTeam {
	/** Team ID */
	id: number;
	/** Team display name */
	name: string;
	/** Team username/handle */
	login: string;
	/** Team profile URL */
	html_url: string;
	/** Team avatar URL */
	avatar_url: string;
	/** Team bio (HTML) */
	bio: string;
	/** Team location */
	location: string | null;
	/** Team links */
	links: DribbbleLinks;
	/** Resource type (always "Team") */
	type: 'Team';
	/** When the team was created */
	created_at: string;
	/** When the team was last updated */
	updated_at: string;
}

/**
 * Dribbble user
 */
export interface DribbbleUser {
	/** User ID */
	id: number;
	/** Full display name */
	name: string;
	/** Username/handle */
	login: string;
	/** Profile URL */
	html_url: string;
	/** Avatar image URL */
	avatar_url: string;
	/** Bio/description (HTML) */
	bio: string;
	/** Location */
	location: string | null;
	/** Social/web links */
	links: DribbbleLinks;
	/** Whether user can upload shots */
	can_upload_shot: boolean;
	/** Pro account status */
	pro: boolean;
	/** Number of followers */
	followers_count: number;
	/** When the account was created */
	created_at: string;
	/** Resource type (always "User") */
	type: 'User';
	/** Teams the user belongs to */
	teams: DribbbleTeam[];
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

/**
 * Project that groups related shots
 */
export interface DribbbleProject {
	/** Project ID */
	id: number;
	/** Project name */
	name: string;
	/** Project description */
	description: string;
	/** Number of shots in project */
	shots_count: number;
	/** When the project was created */
	created_at: string;
	/** When the project was last updated */
	updated_at: string;
}

// ============================================================================
// SHOT TYPES
// ============================================================================

/**
 * A Dribbble shot (design post)
 */
export interface DribbbleShot {
	/** Shot ID */
	id: number;
	/** Shot title */
	title: string;
	/** Shot description (HTML) */
	description: string | null;
	/** Image width in pixels */
	width: number;
	/** Image height in pixels */
	height: number;
	/** Image URLs in different sizes */
	images: DribbbleImages;
	/** When the shot was published */
	published_at: string;
	/** When the shot was last updated */
	updated_at: string;
	/** URL to the shot page */
	html_url: string;
	/** Whether the shot is animated */
	animated: boolean;
	/** Tags associated with the shot */
	tags: string[];
	/** File attachments */
	attachments: DribbbleAttachment[];
	/** Projects this shot belongs to */
	projects: DribbbleProject[];
	/** Team that owns this shot (if any) */
	team: DribbbleTeam | null;
	/** Video information (for animated shots) */
	video: DribbbleVideo | null;
	/** Low profile mode (limited comments/likes) */
	low_profile: boolean;
}

/**
 * Shot data for creating a new shot
 */
export interface CreateShotData {
	/** Shot title (required) */
	title: string;
	/** Shot description (HTML supported) */
	description?: string;
	/** Tags (max 12) */
	tags?: string[];
	/** Low profile mode */
	low_profile?: boolean;
	/** Team ID to post under */
	team_id?: number;
	/** Schedule publish time (ISO 8601) */
	scheduled_for?: string;
	/** Image file - must be 400x300 or 800x600, max 8MB */
	image: File | Blob;
}

/**
 * Shot data for updating an existing shot
 */
export interface UpdateShotData {
	/** Shot title */
	title?: string;
	/** Shot description (HTML supported) */
	description?: string;
	/** Tags (max 12) */
	tags?: string[];
	/** Low profile mode */
	low_profile?: boolean;
	/** Team ID */
	team_id?: number;
	/** Schedule publish time (ISO 8601) */
	scheduled_for?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

/**
 * Options for listing shots
 */
export interface ListShotsOptions {
	/** Page number (default: 1) */
	page?: number;
	/** Results per page (default: 30, max: 100) */
	perPage?: number;
}

// ============================================================================
// DRIBBBLE INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Dribbble integration */
const handleError = createErrorHandler('dribbble');

/**
 * Dribbble Integration
 *
 * Weniger, aber besser: Design portfolio data for compound workflows.
 */
export class Dribbble extends BaseAPIClient {
	constructor(config: DribbbleConfig) {
		validateAccessToken(config.accessToken, 'dribbble');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://api.dribbble.com/v2',
			timeout: config.timeout,
		});
	}

	// ==========================================================================
	// USER
	// ==========================================================================

	/**
	 * Get the current authenticated user
	 */
	async getCurrentUser(): Promise<ActionResult<DribbbleUser>> {
		try {
			const response = await this.get('/user');
			await assertResponseOk(response, {
				integration: 'dribbble',
				action: 'get-current-user',
			});

			const data = (await response.json()) as DribbbleUser;

			return createActionResult({
				data,
				integration: 'dribbble',
				action: 'get-current-user',
				schema: 'dribbble.user.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-current-user');
		}
	}

	// ==========================================================================
	// SHOTS
	// ==========================================================================

	/**
	 * List the authenticated user's shots
	 */
	async listShots(
		options: ListShotsOptions = {}
	): Promise<ActionResult<DribbbleShot[]>> {
		try {
			const queryString = buildQueryString({
				page: options.page,
				per_page: options.perPage,
			});

			const response = await this.get(`/user/shots${queryString}`);
			await assertResponseOk(response, {
				integration: 'dribbble',
				action: 'list-shots',
			});

			const data = (await response.json()) as DribbbleShot[];

			return createActionResult({
				data,
				integration: 'dribbble',
				action: 'list-shots',
				schema: 'dribbble.shots.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-shots');
		}
	}

	/**
	 * Get a specific shot by ID
	 */
	async getShot(shotId: string | number): Promise<ActionResult<DribbbleShot>> {
		try {
			const response = await this.get(`/shots/${shotId}`);
			await assertResponseOk(response, {
				integration: 'dribbble',
				action: 'get-shot',
			});

			const data = (await response.json()) as DribbbleShot;

			return createActionResult({
				data,
				integration: 'dribbble',
				action: 'get-shot',
				schema: 'dribbble.shot.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-shot');
		}
	}

	/**
	 * Create a new shot
	 *
	 * Note: Requires the 'upload' OAuth scope.
	 * Image must be exactly 400x300 or 800x600, and no larger than 8MB.
	 */
	async createShot(data: CreateShotData): Promise<ActionResult<DribbbleShot>> {
		if (!data.title) {
			return ActionResult.error(
				'Shot title is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'dribbble', action: 'create-shot' }
			);
		}

		if (!data.image) {
			return ActionResult.error(
				'Shot image is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'dribbble', action: 'create-shot' }
			);
		}

		try {
			// Dribbble expects multipart/form-data for image upload
			const formData = new FormData();
			formData.append('title', data.title);
			formData.append('image', data.image);

			if (data.description) {
				formData.append('description', data.description);
			}
			if (data.tags && data.tags.length > 0) {
				// Dribbble expects tags as comma-separated or individual entries
				formData.append('tags', data.tags.slice(0, 12).join(','));
			}
			if (data.low_profile !== undefined) {
				formData.append('low_profile', String(data.low_profile));
			}
			if (data.team_id) {
				formData.append('team_id', String(data.team_id));
			}
			if (data.scheduled_for) {
				formData.append('scheduled_for', data.scheduled_for);
			}

			const response = await this.postFormData('/shots', formData);
			await assertResponseOk(response, {
				integration: 'dribbble',
				action: 'create-shot',
			});

			const result = (await response.json()) as DribbbleShot;

			return createActionResult({
				data: result,
				integration: 'dribbble',
				action: 'create-shot',
				schema: 'dribbble.shot.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-shot');
		}
	}

	/**
	 * Update an existing shot
	 *
	 * Note: Requires the 'upload' OAuth scope and ownership of the shot.
	 */
	async updateShot(
		shotId: string | number,
		data: UpdateShotData
	): Promise<ActionResult<DribbbleShot>> {
		try {
			const response = await this.put(`/shots/${shotId}`, data);
			await assertResponseOk(response, {
				integration: 'dribbble',
				action: 'update-shot',
			});

			const result = (await response.json()) as DribbbleShot;

			return createActionResult({
				data: result,
				integration: 'dribbble',
				action: 'update-shot',
				schema: 'dribbble.shot.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'update-shot');
		}
	}

	/**
	 * Delete a shot
	 *
	 * Note: Requires the 'upload' OAuth scope and ownership of the shot.
	 */
	async deleteShot(shotId: string | number): Promise<ActionResult<{ deleted: boolean }>> {
		try {
			const response = await this.delete(`/shots/${shotId}`);
			await assertResponseOk(response, {
				integration: 'dribbble',
				action: 'delete-shot',
			});

			return createActionResult({
				data: { deleted: true },
				integration: 'dribbble',
				action: 'delete-shot',
				schema: 'dribbble.delete-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'delete-shot');
		}
	}

	// ==========================================================================
	// HELPER METHODS
	// ==========================================================================

	/**
	 * Extract shot details for easy consumption in workflows
	 *
	 * Zuhandenheit: Developer thinks "get shot details"
	 * not "navigate nested shot object structure"
	 */
	static extractShotDetails(shot: DribbbleShot): {
		id: number;
		title: string;
		description: string;
		imageUrl: string;
		thumbnailUrl: string;
		hdImageUrl: string | null;
		isAnimated: boolean;
		tags: string[];
		publishedAt: Date;
		webUrl: string;
		dimensions: { width: number; height: number };
		hasVideo: boolean;
		videoUrl: string | null;
	} {
		return {
			id: shot.id,
			title: shot.title,
			description: shot.description || '',
			imageUrl: shot.images.normal,
			thumbnailUrl: shot.images.teaser,
			hdImageUrl: shot.images.hidpi,
			isAnimated: shot.animated,
			tags: shot.tags,
			publishedAt: new Date(shot.published_at),
			webUrl: shot.html_url,
			dimensions: {
				width: shot.width,
				height: shot.height,
			},
			hasVideo: shot.video !== null,
			videoUrl: shot.video?.url || null,
		};
	}

	/**
	 * Format shot for Notion-style display
	 */
	static formatShotForDisplay(shot: DribbbleShot): {
		title: string;
		description: string;
		image: { url: string; alt: string };
		metadata: Array<{ label: string; value: string }>;
	} {
		return {
			title: shot.title,
			description: shot.description || 'No description',
			image: {
				url: shot.images.hidpi || shot.images.normal,
				alt: shot.title,
			},
			metadata: [
				{ label: 'Published', value: new Date(shot.published_at).toLocaleDateString() },
				{ label: 'Tags', value: shot.tags.join(', ') || 'None' },
				{ label: 'Dimensions', value: `${shot.width}x${shot.height}` },
				{ label: 'Animated', value: shot.animated ? 'Yes' : 'No' },
			],
		};
	}

	/**
	 * Check if user is a Pro member (for premium features)
	 */
	static isPro(user: DribbbleUser): boolean {
		return user.pro === true;
	}

	/**
	 * Get user's display info for profiles
	 */
	static getUserDisplayInfo(user: DribbbleUser): {
		name: string;
		username: string;
		avatar: string;
		bio: string;
		location: string;
		isPro: boolean;
		followersCount: number;
		profileUrl: string;
		website: string | null;
		twitter: string | null;
		teams: Array<{ name: string; url: string }>;
	} {
		return {
			name: user.name,
			username: user.login,
			avatar: user.avatar_url,
			bio: user.bio,
			location: user.location || '',
			isPro: user.pro,
			followersCount: user.followers_count,
			profileUrl: user.html_url,
			website: user.links.web,
			twitter: user.links.twitter,
			teams: user.teams.map((team) => ({
				name: team.name,
				url: team.html_url,
			})),
		};
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * POST with FormData (for file uploads)
	 */
	private async postFormData(path: string, formData: FormData): Promise<Response> {
		const url = `${this.apiUrl}${path}`;
		return fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
			},
			body: formData,
		});
	}

	/**
	 * Get capabilities for Dribbble actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: true, // HTML descriptions
			canHandleMarkdown: false,
			canHandleImages: true, // Shot images
			canHandleAttachments: true, // Shot attachments
			supportsSearch: false, // API v2 removed search
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true, // Shots have projects, teams
			supportsMetadata: true,
		};
	}
}

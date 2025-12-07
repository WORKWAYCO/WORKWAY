/**
 * WORKWAY OAuth Operations
 *
 * Check OAuth provider status and connection state.
 * Progressive disclosure: read this file when you need OAuth operations.
 *
 * @example
 * ```typescript
 * import { oauth } from './servers/workway';
 *
 * // List all providers
 * const providers = oauth.providers();
 * console.log(`${providers.length} OAuth providers supported`);
 *
 * // Check specific provider
 * const zoom = oauth.provider('zoom');
 * console.log(`Zoom scopes: ${zoom?.scopes.join(', ')}`);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface OAuthProvider {
	id: string;
	name: string;
	authorizationUrl: string;
	tokenUrl: string;
	scopes: string[];
	supportsPKCE: boolean;
	docsUrl: string;
}

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

const PROVIDERS: Record<string, OAuthProvider> = {
	zoom: {
		id: 'zoom',
		name: 'Zoom',
		authorizationUrl: 'https://zoom.us/oauth/authorize',
		tokenUrl: 'https://zoom.us/oauth/token',
		scopes: ['meeting:read', 'recording:read', 'user:read'],
		supportsPKCE: false,
		docsUrl: 'https://developers.zoom.us/docs/integrations/create/',
	},
	notion: {
		id: 'notion',
		name: 'Notion',
		authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
		tokenUrl: 'https://api.notion.com/v1/oauth/token',
		scopes: [],
		supportsPKCE: false,
		docsUrl: 'https://developers.notion.com/docs/authorization',
	},
	slack: {
		id: 'slack',
		name: 'Slack',
		authorizationUrl: 'https://slack.com/oauth/v2/authorize',
		tokenUrl: 'https://slack.com/api/oauth.v2.access',
		scopes: ['chat:write', 'channels:read', 'users:read'],
		supportsPKCE: false,
		docsUrl: 'https://api.slack.com/authentication/oauth-v2',
	},
	discord: {
		id: 'discord',
		name: 'Discord',
		authorizationUrl: 'https://discord.com/api/oauth2/authorize',
		tokenUrl: 'https://discord.com/api/oauth2/token',
		scopes: ['bot', 'guilds', 'messages.read'],
		supportsPKCE: false,
		docsUrl: 'https://discord.com/developers/applications',
	},
	github: {
		id: 'github',
		name: 'GitHub',
		authorizationUrl: 'https://github.com/login/oauth/authorize',
		tokenUrl: 'https://github.com/login/oauth/access_token',
		scopes: ['repo', 'read:user', 'read:org'],
		supportsPKCE: false,
		docsUrl: 'https://github.com/settings/developers',
	},
	linear: {
		id: 'linear',
		name: 'Linear',
		authorizationUrl: 'https://linear.app/oauth/authorize',
		tokenUrl: 'https://api.linear.app/oauth/token',
		scopes: ['read', 'write', 'issues:create'],
		supportsPKCE: false,
		docsUrl: 'https://developers.linear.app/docs/oauth/authentication',
	},
	hubspot: {
		id: 'hubspot',
		name: 'HubSpot',
		authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
		tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
		scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
		supportsPKCE: false,
		docsUrl: 'https://developers.hubspot.com/docs/api/oauth-quickstart-guide',
	},
	stripe: {
		id: 'stripe',
		name: 'Stripe',
		authorizationUrl: 'https://connect.stripe.com/oauth/authorize',
		tokenUrl: 'https://connect.stripe.com/oauth/token',
		scopes: ['read_write'],
		supportsPKCE: false,
		docsUrl: 'https://stripe.com/docs/connect/oauth-reference',
	},
	calendly: {
		id: 'calendly',
		name: 'Calendly',
		authorizationUrl: 'https://auth.calendly.com/oauth/authorize',
		tokenUrl: 'https://auth.calendly.com/oauth/token',
		scopes: ['default'],
		supportsPKCE: false,
		docsUrl: 'https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-getting-started',
	},
	typeform: {
		id: 'typeform',
		name: 'Typeform',
		authorizationUrl: 'https://api.typeform.com/oauth/authorize',
		tokenUrl: 'https://api.typeform.com/oauth/token',
		scopes: ['forms:read', 'responses:read', 'webhooks:write'],
		supportsPKCE: false,
		docsUrl: 'https://developer.typeform.com/get-started/applications/',
	},
	todoist: {
		id: 'todoist',
		name: 'Todoist',
		authorizationUrl: 'https://todoist.com/oauth/authorize',
		tokenUrl: 'https://todoist.com/oauth/access_token',
		scopes: ['data:read_write'],
		supportsPKCE: false,
		docsUrl: 'https://developer.todoist.com/guides/#authorization',
	},
	airtable: {
		id: 'airtable',
		name: 'Airtable',
		authorizationUrl: 'https://airtable.com/oauth2/v1/authorize',
		tokenUrl: 'https://airtable.com/oauth2/v1/token',
		scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'],
		supportsPKCE: true,
		docsUrl: 'https://airtable.com/developers/web/guides/oauth-integrations',
	},
	dribbble: {
		id: 'dribbble',
		name: 'Dribbble',
		authorizationUrl: 'https://dribbble.com/oauth/authorize',
		tokenUrl: 'https://dribbble.com/oauth/token',
		scopes: ['public', 'upload'],
		supportsPKCE: false,
		docsUrl: 'https://developer.dribbble.com/v2/oauth/',
	},
	'google-sheets': {
		id: 'google-sheets',
		name: 'Google Sheets',
		authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		scopes: [
			'https://www.googleapis.com/auth/spreadsheets',
			'https://www.googleapis.com/auth/drive.readonly',
		],
		supportsPKCE: true,
		docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
	},
	'google-calendar': {
		id: 'google-calendar',
		name: 'Google Calendar',
		authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		scopes: [
			'https://www.googleapis.com/auth/calendar.readonly',
			'https://www.googleapis.com/auth/calendar.events',
		],
		supportsPKCE: true,
		docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
	},
	'google-drive': {
		id: 'google-drive',
		name: 'Google Drive',
		authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		scopes: [
			'https://www.googleapis.com/auth/drive.readonly',
			'https://www.googleapis.com/auth/drive.file',
		],
		supportsPKCE: true,
		docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
	},
};

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * List all OAuth providers
 *
 * @example
 * ```typescript
 * const providers = oauth.providers();
 * console.log(`${providers.length} OAuth providers`);
 *
 * // Providers that support PKCE
 * const pkce = providers.filter(p => p.supportsPKCE);
 * console.log(`PKCE supported: ${pkce.map(p => p.name).join(', ')}`);
 * ```
 */
export function providers(): OAuthProvider[] {
	return Object.values(PROVIDERS);
}

/**
 * Get a specific OAuth provider
 *
 * @example
 * ```typescript
 * const zoom = oauth.provider('zoom');
 * if (zoom) {
 *   console.log(`Auth URL: ${zoom.authorizationUrl}`);
 *   console.log(`Scopes: ${zoom.scopes.join(', ')}`);
 * }
 * ```
 */
export function provider(id: string): OAuthProvider | null {
	return PROVIDERS[id.toLowerCase()] || null;
}

/**
 * Check if a provider is supported
 *
 * @example
 * ```typescript
 * if (oauth.isSupported('zoom')) {
 *   console.log('Zoom is supported');
 * }
 * ```
 */
export function isSupported(id: string): boolean {
	return id.toLowerCase() in PROVIDERS;
}

/**
 * Get provider IDs
 *
 * @example
 * ```typescript
 * const ids = oauth.providerIds();
 * console.log(`Providers: ${ids.join(', ')}`);
 * ```
 */
export function providerIds(): string[] {
	return Object.keys(PROVIDERS);
}

/**
 * Get providers grouped by type
 *
 * @example
 * ```typescript
 * const grouped = oauth.byType();
 * console.log('Google providers:', grouped.google.map(p => p.name));
 * console.log('Communication:', grouped.communication.map(p => p.name));
 * ```
 */
export function byType(): Record<string, OAuthProvider[]> {
	return {
		google: [PROVIDERS['google-sheets'], PROVIDERS['google-calendar'], PROVIDERS['google-drive']],
		communication: [PROVIDERS.slack, PROVIDERS.discord],
		productivity: [PROVIDERS.notion, PROVIDERS.airtable, PROVIDERS.linear, PROVIDERS.todoist],
		meetings: [PROVIDERS.zoom, PROVIDERS.calendly],
		crm: [PROVIDERS.hubspot],
		forms: [PROVIDERS.typeform],
		payments: [PROVIDERS.stripe],
		developer: [PROVIDERS.github],
		design: [PROVIDERS.dribbble],
	};
}

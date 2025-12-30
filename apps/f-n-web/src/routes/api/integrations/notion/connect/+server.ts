import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Configured via environment - fallback for local dev
const getRedirectUri = (platform?: App.Platform) => {
	const baseUrl = platform?.env?.SITE_URL || 'https://fn.workway.co';
	return `${baseUrl}/api/integrations/notion/callback`;
};

export const GET: RequestHandler = async ({ locals, url, platform }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	// Get client ID from environment
	const clientId = platform?.env?.NOTION_CLIENT_ID;

	if (!clientId) {
		throw redirect(302, '/dashboard?error=notion_not_configured');
	}

	// Generate state for CSRF protection
	const state = crypto.randomUUID();

	// Store state in KV for verification (include email for user creation if needed)
	if (platform?.env?.SESSIONS) {
		await platform.env.SESSIONS.put(
			`notion_oauth_state:${state}`,
			JSON.stringify({ userId: locals.user.id, email: locals.user.email }),
			{ expirationTtl: 600 } // 10 minutes
		);
	}

	const redirectUri = getRedirectUri(platform);
	const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize');
	notionAuthUrl.searchParams.set('client_id', clientId);
	notionAuthUrl.searchParams.set('response_type', 'code');
	notionAuthUrl.searchParams.set('owner', 'user');
	notionAuthUrl.searchParams.set('redirect_uri', redirectUri);
	notionAuthUrl.searchParams.set('state', state);

	throw redirect(302, notionAuthUrl.toString());
};

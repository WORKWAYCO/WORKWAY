import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Configured via environment - fallback for local dev
const getRedirectUri = (platform?: App.Platform) => {
	const baseUrl = platform?.env?.SITE_URL || 'https://fn.workway.co';
	return `${baseUrl}/api/integrations/youtube/callback`;
};

export const GET: RequestHandler = async ({ locals, url, platform }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	// Get client ID from environment
	const clientId = platform?.env?.YOUTUBE_CLIENT_ID;

	if (!clientId) {
		throw redirect(302, '/dashboard?error=youtube_not_configured');
	}

	// Generate state for CSRF protection
	const state = crypto.randomUUID();

	// Store state in KV for verification (include email for user creation if needed)
	if (platform?.env?.SESSIONS) {
		await platform.env.SESSIONS.put(
			`youtube_oauth_state:${state}`,
			JSON.stringify({ userId: locals.user.id, email: locals.user.email }),
			{ expirationTtl: 600 } // 10 minutes
		);
	}

	const redirectUri = getRedirectUri(platform);
	const youtubeAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	youtubeAuthUrl.searchParams.set('client_id', clientId);
	youtubeAuthUrl.searchParams.set('response_type', 'code');
	youtubeAuthUrl.searchParams.set('redirect_uri', redirectUri);
	youtubeAuthUrl.searchParams.set('state', state);
	youtubeAuthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly');
	youtubeAuthUrl.searchParams.set('access_type', 'offline'); // Request refresh token
	youtubeAuthUrl.searchParams.set('prompt', 'consent'); // Force consent to ensure refresh token

	throw redirect(302, youtubeAuthUrl.toString());
};

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Configured via environment - fallback for local dev
const getRedirectUri = (platform?: App.Platform) => {
	const baseUrl = platform?.env?.SITE_URL || 'https://fn.workway.co';
	return `${baseUrl}/api/integrations/notion/callback`;
};

export const GET: RequestHandler = async ({ url, platform }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	if (error) {
		throw redirect(302, `/dashboard?error=${error}`);
	}

	if (!code || !state) {
		throw redirect(302, '/dashboard?error=invalid_callback');
	}

	if (!platform?.env) {
		throw redirect(302, '/dashboard?error=server_error');
	}

	const { DB, SESSIONS } = platform.env;
	const clientId = platform.env.NOTION_CLIENT_ID;
	const clientSecret = platform.env.NOTION_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw redirect(302, '/dashboard?error=notion_not_configured');
	}

	// Verify state
	const stateData = await SESSIONS.get(`notion_oauth_state:${state}`, 'json') as { userId: string; email?: string } | null;

	if (!stateData) {
		throw redirect(302, '/dashboard?error=invalid_state');
	}

	// Clean up state
	await SESSIONS.delete(`notion_oauth_state:${state}`);

	// Exchange code for access token
	const redirectUri = getRedirectUri(platform);
	const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
		method: 'POST',
		headers: {
			'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!tokenResponse.ok) {
		const errorData = await tokenResponse.json().catch(() => ({}));
		console.error('Notion token exchange failed:', errorData);
		throw redirect(302, '/dashboard?error=token_exchange_failed');
	}

	const tokenData = await tokenResponse.json() as {
		access_token: string;
		workspace_id: string;
		workspace_name: string;
		bot_id: string;
	};

	try {
		// Ensure user exists in local database (handles Identity Worker users without local record)
		const userExists = await DB.prepare('SELECT id FROM users WHERE id = ?')
			.bind(stateData.userId)
			.first();

		if (!userExists) {
			// Create local user record for Identity Worker user
			await DB.prepare(
				'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)'
			)
				.bind(stateData.userId, stateData.email || 'unknown@user.local', `identity:${stateData.userId}`)
				.run();

			// Create default subscription
			await DB.prepare(
				'INSERT INTO subscriptions (id, user_id, tier, status, sync_count, sync_count_reset_at) VALUES (?, ?, ?, ?, 0, ?)'
			)
				.bind(crypto.randomUUID(), stateData.userId, 'free', 'free', new Date().toISOString())
				.run();
		}

		// Check for existing connection
		const existing = await DB.prepare(
			'SELECT id FROM connected_accounts WHERE user_id = ? AND provider = ?'
		)
			.bind(stateData.userId, 'notion')
			.first();

		if (existing) {
			// Update existing
			await DB.prepare(
				`UPDATE connected_accounts
				 SET access_token = ?, workspace_id = ?, workspace_name = ?, updated_at = datetime("now")
				 WHERE user_id = ? AND provider = ?`
			)
				.bind(tokenData.access_token, tokenData.workspace_id, tokenData.workspace_name, stateData.userId, 'notion')
				.run();
		} else {
			// Create new
			await DB.prepare(
				`INSERT INTO connected_accounts (id, user_id, provider, access_token, workspace_id, workspace_name)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
				.bind(
					crypto.randomUUID(),
					stateData.userId,
					'notion',
					tokenData.access_token,
					tokenData.workspace_id,
					tokenData.workspace_name
				)
				.run();
		}
	} catch (dbError) {
		console.error('Database error saving Notion connection:', dbError);
		throw redirect(302, '/dashboard?error=database_error');
	}

	throw redirect(302, '/dashboard?success=notion_connected');
};

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Get session from cookie
	const sessionToken = event.cookies.get('fn_session');

	if (sessionToken && event.platform?.env) {
		try {
			// Look up session in KV
			const sessionData = await event.platform.env.SESSIONS.get(`session:${sessionToken}`, 'json');

			if (sessionData && typeof sessionData === 'object' && 'userId' in sessionData) {
				const session = sessionData as { userId: string; email: string; expiresAt: number };

				// Check if session is expired
				if (session.expiresAt > Date.now()) {
					event.locals.user = {
						id: session.userId,
						email: session.email
					};
				} else {
					// Session expired, clear cookie
					event.cookies.delete('fn_session', { path: '/' });
					await event.platform.env.SESSIONS.delete(`session:${sessionToken}`);
				}
			}
		} catch (e) {
			// Invalid session, clear cookie
			event.cookies.delete('fn_session', { path: '/' });
		}
	}

	// Default to no user
	if (!event.locals.user) {
		event.locals.user = null;
	}

	return resolve(event);
};

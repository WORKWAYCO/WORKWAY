import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies, platform }) => {
		const sessionToken = cookies.get('fn_session');

		if (sessionToken && platform?.env) {
			// Delete session from KV
			await platform.env.SESSIONS.delete(`session:${sessionToken}`);
		}

		// Clear cookie
		cookies.delete('fn_session', { path: '/' });

		throw redirect(302, '/');
	}
};

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	// Delete cookies with same options they were set with
	const cookieOptions = {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax' as const
	};

	cookies.delete('learn_access_token', cookieOptions);
	cookies.delete('learn_refresh_token', cookieOptions);

	throw redirect(303, '/');
};

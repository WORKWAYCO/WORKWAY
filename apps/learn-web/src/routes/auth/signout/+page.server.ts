import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	cookies.delete('learn_access_token', { path: '/' });
	cookies.delete('learn_refresh_token', { path: '/' });

	throw redirect(303, '/');
};

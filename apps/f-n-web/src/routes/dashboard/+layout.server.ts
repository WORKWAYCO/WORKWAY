import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Auth guard — redirect to login if not authenticated
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	return {
		user: locals.user
	};
};

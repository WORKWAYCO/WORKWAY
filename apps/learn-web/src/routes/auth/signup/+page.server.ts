import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, platform }) => {
	const identityUrl = platform?.env?.IDENTITY_WORKER_URL || 'https://id.createsomething.space';

	// Build redirect_uri to return to after signup
	const returnUrl = url.searchParams.get('returnUrl') || '/paths';
	const origin = url.origin;
	const redirectUri = `${origin}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`;

	// Redirect to Identity Worker signup page with redirect_uri
	const signupUrl = new URL(`${identityUrl}/signup`);
	signupUrl.searchParams.set('redirect_uri', redirectUri);

	throw redirect(303, signupUrl.toString());
};

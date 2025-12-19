import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

interface TokenPayload {
	sub: string;
	email: string;
	displayName?: string;
	exp: number;
}

function decodeJWT(token: string): TokenPayload | null {
	try {
		const [, payload] = token.split('.');
		const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
		return JSON.parse(decoded);
	} catch {
		return null;
	}
}

async function validateAccessToken(
	token: string,
	env: App.Platform['env']
): Promise<App.Locals['user'] | null> {
	const payload = decodeJWT(token);

	if (!payload) return null;

	// Check expiration
	if (payload.exp * 1000 < Date.now()) {
		return null;
	}

	return {
		id: payload.sub,
		email: payload.email,
		displayName: payload.displayName
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	const accessToken = event.cookies.get('learn_access_token');

	if (accessToken && event.platform?.env) {
		const user = await validateAccessToken(accessToken, event.platform.env);
		if (user) {
			event.locals.user = user;
		}
	}

	// Protected routes - require authentication
	// Note: /paths/ is public for SEO, only /progress requires auth
	const protectedPaths = ['/progress'];
	const isProtected = protectedPaths.some((path) => event.url.pathname.startsWith(path));

	if (isProtected && !event.locals.user) {
		const returnUrl = encodeURIComponent(event.url.pathname);
		throw redirect(303, `/auth/login?returnUrl=${returnUrl}`);
	}

	return resolve(event);
};

/**
 * Client Setup Flow - Server
 *
 * Handles invitation redemption and account creation.
 * Canon: Client receives link → creates account → connects integrations → done.
 */

import { redirect, fail, error } from '@sveltejs/kit';
import { isInvitationValid } from '$lib/server/admin';
import type { PageServerLoad, Actions } from './$types';

const IDENTITY_WORKER = 'https://id.createsomething.space';

interface Invitation {
	id: string;
	invite_code: string;
	email: string | null;
	tier: string;
	created_by_email: string;
	expires_at: number;
	redeemed_at: number | null;
	created_at: string;
	complimentary?: number;
}

export const load: PageServerLoad = async ({ params, locals, platform }) => {
	// If already logged in, check if they're coming from an invitation link
	// and redirect to dashboard
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	if (!platform?.env) {
		throw error(500, 'Server configuration error');
	}

	const { DB } = platform.env;
	const { code } = params;

	// Look up invitation
	const invitation = await DB.prepare(
		'SELECT id, invite_code, email, tier, created_by_email, expires_at, redeemed_at, created_at, complimentary FROM client_invitations WHERE invite_code = ?'
	).bind(code).first<Invitation>();

	if (!invitation) {
		throw error(404, 'Invitation not found');
	}

	const validation = isInvitationValid(invitation);
	if (!validation.valid) {
		throw error(410, validation.reason || 'Invitation is no longer valid');
	}

	return {
		inviteCode: code,
		restrictedEmail: invitation.email,
		tier: invitation.tier
	};
};

export const actions: Actions = {
	/**
	 * Register a new account via invitation
	 */
	default: async ({ request, params, cookies, platform }) => {
		if (!platform?.env) {
			return fail(500, { message: 'Server configuration error' });
		}

		const { DB, SESSIONS } = platform.env;
		const { code } = params;

		// Get invitation
		const invitation = await DB.prepare(
			'SELECT id, invite_code, email, tier, expires_at, redeemed_at, created_by_email, complimentary FROM client_invitations WHERE invite_code = ?'
		).bind(code).first<Invitation>();

		if (!invitation) {
			return fail(404, { message: 'Invitation not found' });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString().toLowerCase().trim();
		const password = formData.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required' });
		}

		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		// Validate invitation with claimant email
		const validation = isInvitationValid(invitation, email);
		if (!validation.valid) {
			return fail(400, { message: validation.reason || 'Invitation is not valid' });
		}

		// Register via Identity Worker
		try {
			const response = await fetch(`${IDENTITY_WORKER}/v1/auth/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					password,
					source: 'workway'
				})
			});

			if (!response.ok) {
				const errorData = await response.json() as { message?: string };
				return fail(response.status, { message: errorData.message || 'Registration failed' });
			}

			const data = await response.json() as {
				access_token: string;
				refresh_token: string;
				expires_in: number;
				user: { id: string; email: string };
			};

			// Create local F(n) user record with the tier from invitation
			try {
				await DB.prepare(
					'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)'
				)
					.bind(data.user.id, email, `identity:${data.user.id}`)
					.run();

				// Create subscription with tier from invitation
				// If complimentary, store sponsor info
				const complimentary = invitation.complimentary || 0;
				const sponsoredBy = complimentary ? invitation.created_by_email : null;

				await DB.prepare(
					'INSERT INTO subscriptions (id, user_id, tier, status, sync_count, sync_count_reset_at, complimentary, sponsored_by) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
				)
					.bind(crypto.randomUUID(), data.user.id, invitation.tier, invitation.tier, new Date().toISOString(), complimentary, sponsoredBy)
					.run();
			} catch (dbError) {
				// User might already exist locally, continue
				console.error('Local user creation error:', dbError);
			}

			// Mark invitation as redeemed
			await DB.prepare(
				'UPDATE client_invitations SET redeemed_at = ?, redeemed_by_user_id = ? WHERE id = ?'
			)
				.bind(Date.now(), data.user.id, invitation.id)
				.run();

			// Create session
			const sessionToken = crypto.randomUUID();

			await SESSIONS.put(
				`session:${sessionToken}`,
				JSON.stringify({
					accessToken: data.access_token,
					refreshToken: data.refresh_token,
					userId: data.user.id,
					email: data.user.email
				}),
				{ expirationTtl: 7 * 24 * 60 * 60 }
			);

			cookies.set('fn_session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: 7 * 24 * 60 * 60
			});

			throw redirect(302, '/dashboard');
		} catch (e) {
			// If it's a redirect, re-throw it
			if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) {
				throw e;
			}

			console.error('Identity Worker signup error:', e);
			return fail(500, { message: 'Unable to create account. Please try again.' });
		}
	}
};

/**
 * Signup Action
 *
 * Registers via Identity Worker, creating a unified identity.
 * Also creates local F(n) user record for backwards compatibility.
 *
 * Canon: One identity, many manifestations.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const IDENTITY_WORKER = 'https://id.createsomething.space';

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().toLowerCase().trim();
		const password = formData.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required' });
		}

		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		// Basic email validation
		if (!email.includes('@') || !email.includes('.')) {
			return fail(400, { message: 'Please enter a valid email address' });
		}

		if (!platform?.env) {
			return fail(500, { message: 'Server configuration error' });
		}

		const { DB, SESSIONS } = platform.env;

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

			if (response.ok) {
				const data = await response.json() as {
					access_token: string;
					refresh_token: string;
					expires_in: number;
					user: { id: string; email: string };
				};

				// Create local F(n) user record for backwards compatibility
				// This allows local features to work while we migrate
				try {
					await DB.prepare(
						'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)'
					)
						.bind(data.user.id, email, `identity:${data.user.id}`)
						.run();

					// Create default subscription (free tier)
					await DB.prepare(
						'INSERT INTO subscriptions (id, user_id, tier, status, sync_count, sync_count_reset_at) VALUES (?, ?, ?, ?, 0, ?)'
					)
						.bind(crypto.randomUUID(), data.user.id, 'free', 'free', new Date().toISOString())
						.run();
				} catch (dbError) {
					// User might already exist locally (edge case), continue
					console.error('Local user creation error:', dbError);
				}

				// Create session with Identity Worker tokens
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
			}

			// Handle errors from Identity Worker
			const error = await response.json() as { message?: string };
			return fail(response.status, { message: error.message || 'Signup failed' });
		} catch (e) {
			// If it's a redirect, re-throw it
			if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) {
				throw e;
			}

			// Network error
			console.error('Identity Worker signup error:', e);
			return fail(500, { message: 'Unable to create account. Please try again.' });
		}
	}
};

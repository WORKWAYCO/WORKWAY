/**
 * Login Action
 *
 * Bridge pattern: Try Identity Worker first, fall back to local DB for unmigrated users.
 * On successful Identity Worker auth, stores JWT tokens in KV session.
 *
 * Canon: One identity, many manifestations.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { bufferToHex, hexToBuffer } from '@workwayco/sdk/encryption';

const IDENTITY_WORKER = 'https://id.createsomething.space';

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().toLowerCase().trim();
		const password = formData.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required' });
		}

		if (!platform?.env) {
			return fail(500, { message: 'Server configuration error' });
		}

		const { DB, SESSIONS } = platform.env;

		// Try Identity Worker first
		try {
			const response = await fetch(`${IDENTITY_WORKER}/v1/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (response.ok) {
				const data = await response.json() as {
					access_token: string;
					refresh_token: string;
					expires_in: number;
					user: { id: string; email: string };
				};

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

			// If Identity Worker returns 401, try local fallback
			// Otherwise, return the error
			if (response.status !== 401) {
				const error = await response.json() as { message?: string };
				return fail(response.status, { message: error.message || 'Login failed' });
			}
		} catch (e) {
			// If it's a redirect, re-throw it
			if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) {
				throw e;
			}
			// Network error - fall through to local auth
			console.error('Identity Worker login error:', e);
		}

		// Fallback: Local authentication for unmigrated users
		const user = await DB.prepare('SELECT id, email, password_hash, email_verified FROM users WHERE email = ?')
			.bind(email)
			.first<{ id: string; email: string; password_hash: string; email_verified: number }>();

		if (!user) {
			return fail(401, { message: 'Invalid email or password' });
		}

		// Verify password using Web Crypto API
		const passwordValid = await verifyPassword(password, user.password_hash);

		if (!passwordValid) {
			return fail(401, { message: 'Invalid email or password' });
		}

		// Create legacy session
		const sessionToken = crypto.randomUUID();
		const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

		await SESSIONS.put(
			`session:${sessionToken}`,
			JSON.stringify({
				userId: user.id,
				email: user.email,
				createdAt: Date.now(),
				expiresAt
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
};

async function verifyPassword(password: string, hash: string): Promise<boolean> {
	// Hash format: algorithm:salt:hash
	const [algorithm, salt, storedHash] = hash.split(':');

	if (algorithm !== 'pbkdf2') {
		return false;
	}

	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: hexToBuffer(salt),
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		256
	);

	const derivedHash = bufferToHex(new Uint8Array(derivedBits));
	return derivedHash === storedHash;
}

// bufferToHex, hexToBuffer imported from @workwayco/sdk/encryption

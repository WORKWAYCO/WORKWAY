import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

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

		// Check if user exists
		const existingUser = await DB.prepare('SELECT id FROM users WHERE email = ?')
			.bind(email)
			.first();

		if (existingUser) {
			return fail(400, { message: 'An account with this email already exists' });
		}

		// Hash password
		const passwordHash = await hashPassword(password);
		const userId = crypto.randomUUID();

		// Create user
		await DB.prepare(
			'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)'
		)
			.bind(userId, email, passwordHash)
			.run();

		// Create default subscription (free tier)
		await DB.prepare(
			'INSERT INTO subscriptions (id, user_id, tier, status, sync_count, sync_count_reset_at) VALUES (?, ?, ?, ?, 0, ?)'
		)
			.bind(crypto.randomUUID(), userId, 'free', 'free', new Date().toISOString())
			.run();

		// Create session immediately (skip email verification for MVP)
		const sessionToken = crypto.randomUUID();
		const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

		await SESSIONS.put(
			`session:${sessionToken}`,
			JSON.stringify({
				userId,
				email,
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

async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();

	// Generate random salt
	const salt = crypto.getRandomValues(new Uint8Array(16));

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
			salt,
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		256
	);

	const hash = bufferToHex(new Uint8Array(derivedBits));
	const saltHex = bufferToHex(salt);

	return `pbkdf2:${saltHex}:${hash}`;
}

function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

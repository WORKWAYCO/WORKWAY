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

		if (!platform?.env) {
			return fail(500, { message: 'Server configuration error' });
		}

		const { DB, SESSIONS } = platform.env;

		// Find user
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

		// Check email verification (optional, uncomment to enforce)
		// if (!user.email_verified) {
		// 	return fail(401, { message: 'Please verify your email first' });
		// }

		// Create session
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
			{ expirationTtl: 7 * 24 * 60 * 60 } // 7 days in seconds
		);

		// Set cookie
		cookies.set('fn_session', sessionToken, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60 // 7 days
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

function hexToBuffer(hex: string): ArrayBuffer {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
	}
	return bytes.buffer;
}

function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

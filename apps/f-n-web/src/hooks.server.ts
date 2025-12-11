/**
 * SvelteKit Server Hooks
 *
 * Bridge pattern: Authenticates via Identity Worker first, falls back to legacy for unmigrated users.
 * Sessions in KV can contain either:
 * - New: { accessToken, refreshToken, userId, email }
 * - Legacy: { userId, email, expiresAt }
 *
 * Canon: One identity, many manifestations.
 */

import type { Handle } from '@sveltejs/kit';

const IDENTITY_WORKER = 'https://id.createsomething.space';
const ISSUER = 'https://id.createsomething.space';

// Cache JWKS for 5 minutes
let jwksCache: { keys: JWK[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 5 * 60 * 1000;

interface JWK {
	kty: string;
	crv: string;
	x: string;
	y: string;
	kid: string;
	alg: string;
	use: string;
}

interface JWTPayload {
	sub: string;
	email: string;
	tier: string;
	source: string;
	iss: string;
	aud: string[];
	iat: number;
	exp: number;
}

interface NewSession {
	accessToken: string;
	refreshToken: string;
	userId: string;
	email: string;
}

interface LegacySession {
	userId: string;
	email: string;
	expiresAt: number;
}

type SessionData = NewSession | LegacySession;

function isNewSession(session: SessionData): session is NewSession {
	return 'accessToken' in session;
}

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('fn_session');

	if (sessionToken && event.platform?.env) {
		try {
			const sessionData = await event.platform.env.SESSIONS.get(`session:${sessionToken}`, 'json');

			if (sessionData && typeof sessionData === 'object') {
				const session = sessionData as SessionData;

				if (isNewSession(session)) {
					// New system: validate Identity Worker JWT
					const payload = await validateJWT(session.accessToken);

					if (payload) {
						event.locals.user = {
							id: payload.sub,
							email: payload.email
						};
					} else {
						// Access token expired, try refresh
						const newTokens = await refreshTokens(session.refreshToken);

						if (newTokens) {
							// Update session with new tokens
							const newSession: NewSession = {
								accessToken: newTokens.access_token,
								refreshToken: newTokens.refresh_token,
								userId: session.userId,
								email: session.email
							};

							await event.platform.env.SESSIONS.put(
								`session:${sessionToken}`,
								JSON.stringify(newSession),
								{ expirationTtl: 7 * 24 * 60 * 60 }
							);

							event.locals.user = {
								id: session.userId,
								email: session.email
							};
						} else {
							// Refresh failed, clear session
							event.cookies.delete('fn_session', { path: '/' });
							await event.platform.env.SESSIONS.delete(`session:${sessionToken}`);
						}
					}
				} else if ('expiresAt' in session) {
					// Legacy system: local session
					if (session.expiresAt > Date.now()) {
						event.locals.user = {
							id: session.userId,
							email: session.email
						};
					} else {
						// Session expired, clear cookie
						event.cookies.delete('fn_session', { path: '/' });
						await event.platform.env.SESSIONS.delete(`session:${sessionToken}`);
					}
				}
			}
		} catch (e) {
			// Invalid session, clear cookie
			event.cookies.delete('fn_session', { path: '/' });
		}
	}

	// Default to no user
	if (!event.locals.user) {
		event.locals.user = null;
	}

	return resolve(event);
};

/**
 * Fetch JWKS from Identity Worker (with caching)
 */
async function getJWKS(): Promise<JWK[]> {
	if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
		return jwksCache.keys;
	}

	try {
		const response = await fetch(`${IDENTITY_WORKER}/.well-known/jwks.json`);
		if (!response.ok) {
			console.error('Failed to fetch JWKS:', response.status);
			return jwksCache?.keys ?? [];
		}

		const data = (await response.json()) as { keys: JWK[] };
		jwksCache = { keys: data.keys, fetchedAt: Date.now() };
		return data.keys;
	} catch (error) {
		console.error('JWKS fetch error:', error);
		return jwksCache?.keys ?? [];
	}
}

/**
 * Validate a JWT and return the payload
 */
async function validateJWT(token: string): Promise<JWTPayload | null> {
	try {
		const [headerB64, payloadB64, signatureB64] = token.split('.');
		if (!headerB64 || !payloadB64 || !signatureB64) return null;

		// Parse header to get kid
		const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
		const kid = header.kid;

		// Get public key from JWKS
		const keys = await getJWKS();
		const jwk = keys.find((k) => k.kid === kid);
		if (!jwk) return null;

		// Import public key
		const publicKey = await crypto.subtle.importKey(
			'jwk',
			{ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
			{ name: 'ECDSA', namedCurve: 'P-256' },
			true,
			['verify']
		);

		// Verify signature
		const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
		const signature = base64UrlDecode(signatureB64);

		const valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			publicKey,
			signature,
			data
		);

		if (!valid) return null;

		// Parse and validate payload
		const payload = JSON.parse(
			atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
		) as JWTPayload;

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) return null;

		// Check issuer
		if (payload.iss !== ISSUER) return null;

		return payload;
	} catch {
		return null;
	}
}

/**
 * Refresh tokens via Identity Worker
 */
async function refreshTokens(
	refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
	try {
		const response = await fetch(`${IDENTITY_WORKER}/v1/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: refreshToken })
		});

		if (!response.ok) return null;

		return response.json();
	} catch {
		return null;
	}
}

/**
 * Base64URL decode
 */
function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
	const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
	const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

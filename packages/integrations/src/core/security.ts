/**
 * Security Utilities
 *
 * Shared security functions for webhook verification and cryptographic operations.
 * DRY Fix: Consolidated from typeform, calendly, weave, nexhealth integrations.
 */

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * Used for comparing webhook signatures, API keys, and other sensitive values
 * where timing attacks could reveal information about the expected value.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = secureCompare(receivedSignature, expectedSignature);
 * ```
 */
export function secureCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

/**
 * Verify HMAC-SHA256 webhook signature
 *
 * Common pattern for webhook verification across integrations.
 *
 * @param payload - Raw webhook payload (string or buffer)
 * @param signature - Signature from webhook header
 * @param secret - Webhook secret for HMAC computation
 * @param algorithm - Hash algorithm (default: SHA-256)
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * const isValid = await verifyHmacSignature(
 *   request.body,
 *   request.headers['x-signature'],
 *   webhookSecret
 * );
 * ```
 */
export async function verifyHmacSignature(
	payload: string | ArrayBuffer,
	signature: string,
	secret: string,
	algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'
): Promise<boolean> {
	try {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: algorithm },
			false,
			['sign']
		);

		const payloadBuffer = typeof payload === 'string' 
			? encoder.encode(payload) 
			: payload;

		const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadBuffer);
		const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');

		return secureCompare(signature.toLowerCase(), expectedSignature.toLowerCase());
	} catch {
		return false;
	}
}

/**
 * Generate a random token for CSRF protection or state parameters
 *
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
	const buffer = new Uint8Array(length);
	crypto.getRandomValues(buffer);
	return Array.from(buffer)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

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
 * Verify HMAC webhook signature
 *
 * Common pattern for webhook verification across integrations.
 *
 * @param payload - Raw webhook payload (string or buffer)
 * @param signature - Signature from webhook header
 * @param secret - Webhook secret for HMAC computation
 * @param options - Optional configuration
 * @param options.algorithm - Hash algorithm (default: SHA-256)
 * @param options.encoding - Signature encoding format (default: hex)
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * // Hex encoding (default - used by most webhooks)
 * const isValid = await verifyHmacSignature(
 *   request.body,
 *   request.headers['x-signature'],
 *   webhookSecret
 * );
 *
 * // Base64 encoding (used by DocuSign, QuickBooks)
 * const isValid = await verifyHmacSignature(
 *   request.body,
 *   request.headers['x-signature'],
 *   webhookSecret,
 *   { encoding: 'base64' }
 * );
 * ```
 */
export async function verifyHmacSignature(
	payload: string | ArrayBuffer,
	signature: string,
	secret: string,
	options: { algorithm?: 'SHA-256' | 'SHA-1'; encoding?: 'hex' | 'base64' } = {}
): Promise<boolean> {
	const { algorithm = 'SHA-256', encoding = 'hex' } = options;
	
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
		const bytes = new Uint8Array(signatureBuffer);
		
		const expectedSignature = encoding === 'base64'
			? btoa(String.fromCharCode.apply(null, Array.from(bytes)))
			: Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

		// Use case-insensitive compare for hex, exact for base64
		return encoding === 'hex'
			? secureCompare(signature.toLowerCase(), expectedSignature.toLowerCase())
			: secureCompare(signature, expectedSignature);
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

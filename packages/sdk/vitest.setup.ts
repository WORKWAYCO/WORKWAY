/**
 * Vitest Setup for SDK Tests
 *
 * Polyfills the global crypto object to match Cloudflare Workers environment.
 * This is needed because Node.js doesn't expose crypto as a global by default.
 */

import { webcrypto } from 'node:crypto';

// Polyfill globalThis.crypto if not available
if (!globalThis.crypto) {
	// @ts-expect-error - webcrypto is compatible but types differ slightly
	globalThis.crypto = webcrypto;
}

/**
 * Encryption Utilities for BYOO
 *
 * Provides AES-256-GCM encryption for storing sensitive credentials
 * like OAuth client secrets. Uses Web Crypto API for Cloudflare Workers compatibility.
 *
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Key rotation support via keyId tracking
 * - JSON-serialized encrypted payloads
 *
 * @example
 * ```typescript
 * import { encryptSecret, decryptSecret } from '@workwayco/sdk/encryption';
 *
 * // Encrypt a client secret
 * const encrypted = await encryptSecret('my-client-secret', keyMaterial, 'key-v1');
 *
 * // Store encrypted.payload in database
 * // Later, decrypt it
 * const decrypted = await decryptSecret(encrypted.payload, keyMaterial);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Encrypted payload with metadata
 */
export interface EncryptedPayload {
	/** Base64-encoded ciphertext (without auth tag) */
	ciphertext: string;
	/** Base64-encoded initialization vector */
	iv: string;
	/** Base64-encoded authentication tag */
	tag: string;
	/** Key ID used for encryption (supports rotation) */
	keyId: string;
	/** Algorithm used (for future-proofing) */
	algorithm: 'AES-256-GCM';
	/** Version of the encryption format */
	version: 1;
}

/**
 * Result of encryption operation
 */
export interface EncryptionResult {
	/** JSON-serialized encrypted payload */
	payload: string;
	/** Key ID used */
	keyId: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert hex string to Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Convert Uint8Array to Base64 string
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Generate a new 256-bit encryption key
 * Store the returned hex string securely (e.g., in Cloudflare KV)
 */
export async function generateEncryptionKey(): Promise<string> {
	const key = crypto.getRandomValues(new Uint8Array(32));
	return bufferToHex(key);
}

/**
 * Import a hex key string as a CryptoKey for encryption
 */
async function importKey(keyHex: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		hexToBuffer(keyHex),
		{ name: 'AES-GCM', length: 256 },
		false,
		[usage]
	);
}

// ============================================================================
// ENCRYPTION / DECRYPTION
// ============================================================================

/**
 * Encrypt a secret using AES-256-GCM
 *
 * @param plaintext - The secret to encrypt
 * @param keyHex - 256-bit key as hex string (64 characters)
 * @param keyId - Identifier for this key (for rotation tracking)
 * @returns Encrypted payload as JSON string and keyId
 */
export async function encryptSecret(
	plaintext: string,
	keyHex: string,
	keyId: string
): Promise<EncryptionResult> {
	// Validate key length
	if (keyHex.length !== 64) {
		throw new Error('Encryption key must be 256 bits (64 hex characters)');
	}

	const key = await importKey(keyHex, 'encrypt');

	// Generate random 96-bit IV (recommended for GCM)
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encode plaintext
	const encoded = new TextEncoder().encode(plaintext);

	// Encrypt - GCM appends 128-bit auth tag to ciphertext
	const ciphertextWithTag = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		encoded
	);

	// Split ciphertext and tag (tag is last 16 bytes)
	const ciphertextWithTagArray = new Uint8Array(ciphertextWithTag);
	const ciphertext = ciphertextWithTagArray.slice(0, -16);
	const tag = ciphertextWithTagArray.slice(-16);

	const payload: EncryptedPayload = {
		ciphertext: bufferToBase64(ciphertext),
		iv: bufferToBase64(iv),
		tag: bufferToBase64(tag),
		keyId,
		algorithm: 'AES-256-GCM',
		version: 1,
	};

	return {
		payload: JSON.stringify(payload),
		keyId,
	};
}

/**
 * Decrypt a secret encrypted with AES-256-GCM
 *
 * @param encryptedJson - JSON-serialized EncryptedPayload
 * @param keyHex - 256-bit key as hex string (must match the keyId in payload)
 * @returns Decrypted plaintext
 */
export async function decryptSecret(encryptedJson: string, keyHex: string): Promise<string> {
	const payload: EncryptedPayload = JSON.parse(encryptedJson);

	// Validate version
	if (payload.version !== 1) {
		throw new Error(`Unsupported encryption version: ${payload.version}`);
	}

	// Validate algorithm
	if (payload.algorithm !== 'AES-256-GCM') {
		throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
	}

	const key = await importKey(keyHex, 'decrypt');

	// Reconstruct ciphertext with tag
	const ciphertext = base64ToBuffer(payload.ciphertext);
	const tag = base64ToBuffer(payload.tag);
	const iv = base64ToBuffer(payload.iv);

	const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
	ciphertextWithTag.set(ciphertext);
	ciphertextWithTag.set(tag, ciphertext.length);

	// Decrypt
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextWithTag);

	return new TextDecoder().decode(decrypted);
}

/**
 * Extract keyId from encrypted payload without decrypting
 * Useful for key rotation - find which key was used
 */
export function getKeyIdFromPayload(encryptedJson: string): string {
	const payload: EncryptedPayload = JSON.parse(encryptedJson);
	return payload.keyId;
}

/**
 * Re-encrypt a secret with a new key (for key rotation)
 *
 * @param encryptedJson - Current encrypted payload
 * @param oldKeyHex - Current encryption key
 * @param newKeyHex - New encryption key
 * @param newKeyId - Identifier for the new key
 * @returns New encrypted payload
 */
export async function rotateEncryption(
	encryptedJson: string,
	oldKeyHex: string,
	newKeyHex: string,
	newKeyId: string
): Promise<EncryptionResult> {
	// Decrypt with old key
	const plaintext = await decryptSecret(encryptedJson, oldKeyHex);

	// Re-encrypt with new key
	return encryptSecret(plaintext, newKeyHex, newKeyId);
}

// ============================================================================
// KV KEY MANAGEMENT HELPERS
// ============================================================================

/**
 * Key management configuration
 */
export interface KeyManagementConfig {
	/** KV namespace for storing encryption keys */
	kv: KVNamespace;
	/** Prefix for key storage */
	prefix?: string;
}

/**
 * Get the current active encryption key ID
 */
export async function getCurrentKeyId(config: KeyManagementConfig): Promise<string | null> {
	const prefix = config.prefix || 'encryption';
	return config.kv.get(`${prefix}:current_key_id`);
}

/**
 * Get an encryption key by ID
 */
export async function getKeyById(
	config: KeyManagementConfig,
	keyId: string
): Promise<string | null> {
	const prefix = config.prefix || 'encryption';
	return config.kv.get(`${prefix}:key:${keyId}`);
}

/**
 * Store a new encryption key
 */
export async function storeKey(
	config: KeyManagementConfig,
	keyId: string,
	keyHex: string,
	makeCurrent: boolean = false
): Promise<void> {
	const prefix = config.prefix || 'encryption';

	// Store the key
	await config.kv.put(`${prefix}:key:${keyId}`, keyHex);

	// Optionally make it the current key
	if (makeCurrent) {
		await config.kv.put(`${prefix}:current_key_id`, keyId);
	}
}

/**
 * Initialize key management with a new key if none exists
 */
export async function initializeKeyManagement(
	config: KeyManagementConfig
): Promise<{ keyId: string; isNew: boolean }> {
	const currentKeyId = await getCurrentKeyId(config);

	if (currentKeyId) {
		return { keyId: currentKeyId, isNew: false };
	}

	// Generate new key
	const keyHex = await generateEncryptionKey();
	const keyId = `v1-${Date.now()}`;

	await storeKey(config, keyId, keyHex, true);

	return { keyId, isNew: true };
}

/**
 * Encryption Module Tests
 *
 * Tests for AES-256-GCM encryption utilities used by BYOO.
 *
 * Security considerations tested:
 * - Encryption produces ciphertext different from plaintext
 * - Decryption recovers original plaintext
 * - Different IVs produce different ciphertexts
 * - Invalid keys fail decryption
 * - Key rotation works correctly
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
	encryptSecret,
	decryptSecret,
	generateEncryptionKey,
	rotateEncryption,
	getKeyIdFromPayload,
	hexToBuffer,
	bufferToHex,
	bufferToBase64,
	base64ToBuffer,
} from './encryption.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

// Pre-generated test key (64 hex characters = 256 bits)
const TEST_KEY_HEX = 'a'.repeat(64);
const TEST_KEY_ID = 'test-key-v1';

// ============================================================================
// BUFFER UTILITY TESTS
// ============================================================================

describe('Buffer Utilities', () => {
	describe('hexToBuffer / bufferToHex', () => {
		it('should round-trip hex string correctly', () => {
			// Must use even-length hex (pairs of characters)
			const original = 'deadbeef01234567890abcde';
			const buffer = hexToBuffer(original);
			const result = bufferToHex(buffer);
			expect(result).toBe(original);
		});

		it('should handle empty string', () => {
			const buffer = hexToBuffer('');
			expect(buffer.length).toBe(0);
			expect(bufferToHex(buffer)).toBe('');
		});

		it('should convert 256-bit key correctly', () => {
			const keyHex = 'a'.repeat(64);
			const buffer = hexToBuffer(keyHex);
			expect(buffer.length).toBe(32); // 256 bits = 32 bytes
		});
	});

	describe('bufferToBase64 / base64ToBuffer', () => {
		it('should round-trip binary data correctly', () => {
			const original = new Uint8Array([0, 127, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
			const base64 = bufferToBase64(original);
			const result = base64ToBuffer(base64);
			expect(Array.from(result)).toEqual(Array.from(original));
		});

		it('should handle empty buffer', () => {
			const empty = new Uint8Array(0);
			const base64 = bufferToBase64(empty);
			expect(base64).toBe('');
		});
	});
});

// ============================================================================
// KEY GENERATION TESTS
// ============================================================================

describe('generateEncryptionKey', () => {
	it('should generate a 256-bit key as 64 hex characters', async () => {
		const key = await generateEncryptionKey();
		expect(key).toHaveLength(64);
		expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
	});

	it('should generate unique keys each time', async () => {
		const key1 = await generateEncryptionKey();
		const key2 = await generateEncryptionKey();
		expect(key1).not.toBe(key2);
	});
});

// ============================================================================
// ENCRYPTION / DECRYPTION TESTS
// ============================================================================

describe('encryptSecret / decryptSecret', () => {
	it('should encrypt and decrypt a simple string', async () => {
		const plaintext = 'my-secret-client-id';
		const result = await encryptSecret(plaintext, TEST_KEY_HEX, TEST_KEY_ID);

		expect(result.payload).toBeTruthy();
		expect(result.keyId).toBe(TEST_KEY_ID);

		const decrypted = await decryptSecret(result.payload, TEST_KEY_HEX);
		expect(decrypted).toBe(plaintext);
	});

	it('should encrypt and decrypt unicode strings', async () => {
		const plaintext = '🔐 Secret with émojis and spëcial çharacters 日本語';
		const result = await encryptSecret(plaintext, TEST_KEY_HEX, TEST_KEY_ID);
		const decrypted = await decryptSecret(result.payload, TEST_KEY_HEX);
		expect(decrypted).toBe(plaintext);
	});

	it('should encrypt and decrypt long strings', async () => {
		const plaintext = 'x'.repeat(10000);
		const result = await encryptSecret(plaintext, TEST_KEY_HEX, TEST_KEY_ID);
		const decrypted = await decryptSecret(result.payload, TEST_KEY_HEX);
		expect(decrypted).toBe(plaintext);
	});

	it('should produce different ciphertext for same plaintext (random IV)', async () => {
		const plaintext = 'same-secret';
		const result1 = await encryptSecret(plaintext, TEST_KEY_HEX, TEST_KEY_ID);
		const result2 = await encryptSecret(plaintext, TEST_KEY_HEX, TEST_KEY_ID);

		// Payloads should differ due to random IV
		expect(result1.payload).not.toBe(result2.payload);

		// But both should decrypt to same plaintext
		const decrypted1 = await decryptSecret(result1.payload, TEST_KEY_HEX);
		const decrypted2 = await decryptSecret(result2.payload, TEST_KEY_HEX);
		expect(decrypted1).toBe(plaintext);
		expect(decrypted2).toBe(plaintext);
	});

	it('should fail with wrong key', async () => {
		const plaintext = 'secret-data';
		const result = await encryptSecret(plaintext, TEST_KEY_HEX, TEST_KEY_ID);

		const wrongKey = 'b'.repeat(64);
		await expect(decryptSecret(result.payload, wrongKey)).rejects.toThrow();
	});

	it('should fail with invalid key length', async () => {
		const plaintext = 'secret-data';
		const shortKey = 'a'.repeat(32); // 128 bits, not 256

		await expect(encryptSecret(plaintext, shortKey, TEST_KEY_ID)).rejects.toThrow(
			'Encryption key must be 256 bits'
		);
	});

	it('should include keyId in encrypted payload', async () => {
		const plaintext = 'secret';
		const result = await encryptSecret(plaintext, TEST_KEY_HEX, 'my-key-v2');

		const payload = JSON.parse(result.payload);
		expect(payload.keyId).toBe('my-key-v2');
		expect(payload.algorithm).toBe('AES-256-GCM');
		expect(payload.version).toBe(1);
	});
});

// ============================================================================
// KEY ID EXTRACTION
// ============================================================================

describe('getKeyIdFromPayload', () => {
	it('should extract keyId without decrypting', async () => {
		const result = await encryptSecret('secret', TEST_KEY_HEX, 'extract-test-key');
		const keyId = getKeyIdFromPayload(result.payload);
		expect(keyId).toBe('extract-test-key');
	});
});

// ============================================================================
// KEY ROTATION
// ============================================================================

describe('rotateEncryption', () => {
	it('should re-encrypt data with new key', async () => {
		const plaintext = 'rotate-this-secret';
		const oldKey = 'a'.repeat(64);
		const newKey = 'b'.repeat(64);
		const newKeyId = 'rotated-key-v2';

		// Encrypt with old key
		const original = await encryptSecret(plaintext, oldKey, 'old-key-v1');

		// Rotate to new key
		const rotated = await rotateEncryption(original.payload, oldKey, newKey, newKeyId);

		// Should have new keyId
		expect(rotated.keyId).toBe(newKeyId);

		// Old key should NOT decrypt the rotated payload
		await expect(decryptSecret(rotated.payload, oldKey)).rejects.toThrow();

		// New key SHOULD decrypt to original plaintext
		const decrypted = await decryptSecret(rotated.payload, newKey);
		expect(decrypted).toBe(plaintext);
	});
});

// ============================================================================
// PAYLOAD FORMAT VALIDATION
// ============================================================================

describe('Encrypted Payload Format', () => {
	it('should produce valid JSON payload', async () => {
		const result = await encryptSecret('test', TEST_KEY_HEX, TEST_KEY_ID);
		const payload = JSON.parse(result.payload);

		expect(payload).toHaveProperty('ciphertext');
		expect(payload).toHaveProperty('iv');
		expect(payload).toHaveProperty('tag');
		expect(payload).toHaveProperty('keyId');
		expect(payload).toHaveProperty('algorithm');
		expect(payload).toHaveProperty('version');
	});

	it('should have correct Base64 encoded fields', async () => {
		const result = await encryptSecret('test', TEST_KEY_HEX, TEST_KEY_ID);
		const payload = JSON.parse(result.payload);

		// IV should be 12 bytes (96 bits) for GCM
		const iv = base64ToBuffer(payload.iv);
		expect(iv.length).toBe(12);

		// Tag should be 16 bytes (128 bits) for GCM
		const tag = base64ToBuffer(payload.tag);
		expect(tag.length).toBe(16);
	});
});

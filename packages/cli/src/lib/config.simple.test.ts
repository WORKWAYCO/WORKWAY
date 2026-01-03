/**
 * Simple integration tests for config.ts - Configuration management
 * These tests verify the logic without heavy mocking
 */

import { describe, it, expect } from 'vitest';
import { getDefaultConfig, getDefaultProjectConfig } from './config.js';

describe('config.ts - Simple Tests', () => {
	describe('Default Config', () => {
		it('should return default config with correct structure', () => {
			const config = getDefaultConfig();

			expect(config).toHaveProperty('apiUrl');
			expect(config).toHaveProperty('oauth');
			expect(config).toHaveProperty('editor');
			expect(config.oauth).toHaveProperty('callbackPort');
			expect(typeof config.oauth.callbackPort).toBe('number');
		});

		it('should use default API URL', () => {
			delete process.env.WORKWAY_API_URL;
			const config = getDefaultConfig();

			expect(config.apiUrl).toBe('https://marketplace-api.half-dozen.workers.dev');
		});

		it('should accept localhost API URL for development', () => {
			const originalUrl = process.env.WORKWAY_API_URL;
			process.env.WORKWAY_API_URL = 'http://localhost:8787';

			const config = getDefaultConfig();

			expect(config.apiUrl).toBe('http://localhost:8787');

			if (originalUrl) {
				process.env.WORKWAY_API_URL = originalUrl;
			} else {
				delete process.env.WORKWAY_API_URL;
			}
		});

		it('should accept 127.0.0.1 API URL for development', () => {
			const originalUrl = process.env.WORKWAY_API_URL;
			process.env.WORKWAY_API_URL = 'http://127.0.0.1:8787';

			const config = getDefaultConfig();

			expect(config.apiUrl).toBe('http://127.0.0.1:8787');

			if (originalUrl) {
				process.env.WORKWAY_API_URL = originalUrl;
			} else {
				delete process.env.WORKWAY_API_URL;
			}
		});

		it('should reject non-HTTPS URLs in production', () => {
			const originalUrl = process.env.WORKWAY_API_URL;
			process.env.WORKWAY_API_URL = 'http://evil.com';

			const config = getDefaultConfig();

			// Should fall back to default
			expect(config.apiUrl).toBe('https://marketplace-api.half-dozen.workers.dev');

			if (originalUrl) {
				process.env.WORKWAY_API_URL = originalUrl;
			} else {
				delete process.env.WORKWAY_API_URL;
			}
		});

		it('should reject domains not in whitelist', () => {
			const originalUrl = process.env.WORKWAY_API_URL;
			process.env.WORKWAY_API_URL = 'https://untrusted-domain.com';

			const config = getDefaultConfig();

			// Should fall back to default
			expect(config.apiUrl).toBe('https://marketplace-api.half-dozen.workers.dev');

			if (originalUrl) {
				process.env.WORKWAY_API_URL = originalUrl;
			} else {
				delete process.env.WORKWAY_API_URL;
			}
		});

		it('should accept whitelisted production domain', () => {
			const originalUrl = process.env.WORKWAY_API_URL;
			process.env.WORKWAY_API_URL = 'https://api.workway.co';

			const config = getDefaultConfig();

			expect(config.apiUrl).toBe('https://api.workway.co');

			if (originalUrl) {
				process.env.WORKWAY_API_URL = originalUrl;
			} else {
				delete process.env.WORKWAY_API_URL;
			}
		});

		it('should handle invalid URL format', () => {
			const originalUrl = process.env.WORKWAY_API_URL;
			process.env.WORKWAY_API_URL = 'not-a-valid-url';

			const config = getDefaultConfig();

			// Should fall back to default
			expect(config.apiUrl).toBe('https://marketplace-api.half-dozen.workers.dev');

			if (originalUrl) {
				process.env.WORKWAY_API_URL = originalUrl;
			} else {
				delete process.env.WORKWAY_API_URL;
			}
		});

		it('should use default callback port', () => {
			const config = getDefaultConfig();

			expect(config.oauth.callbackPort).toBe(3456);
		});

		it('should use EDITOR environment variable if set', () => {
			const originalEditor = process.env.EDITOR;
			process.env.EDITOR = 'vim';

			const config = getDefaultConfig();

			expect(config.editor).toBe('vim');

			if (originalEditor) {
				process.env.EDITOR = originalEditor;
			} else {
				delete process.env.EDITOR;
			}
		});

		it('should use default editor if EDITOR not set', () => {
			const originalEditor = process.env.EDITOR;
			delete process.env.EDITOR;

			const config = getDefaultConfig();

			expect(config.editor).toBe('code');

			if (originalEditor) {
				process.env.EDITOR = originalEditor;
			}
		});
	});

	describe('Default Project Config', () => {
		it('should return default project config with correct structure', () => {
			const config = getDefaultProjectConfig();

			expect(config).toHaveProperty('dev');
			expect(config).toHaveProperty('test');
			expect(config).toHaveProperty('build');
		});

		it('should have correct dev config defaults', () => {
			const config = getDefaultProjectConfig();

			expect(config.dev).toEqual({
				port: 3000,
				hotReload: true,
				mockMode: true,
			});
		});

		it('should have correct test config defaults', () => {
			const config = getDefaultProjectConfig();

			expect(config.test).toEqual({
				testDataFile: './test-data.json',
				timeout: 30000,
			});
		});

		it('should have correct build config defaults', () => {
			const config = getDefaultProjectConfig();

			expect(config.build).toEqual({
				outDir: './dist',
				minify: false,
			});
		});
	});
});

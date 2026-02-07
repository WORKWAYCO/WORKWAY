/**
 * Test Setup
 * 
 * Configures test environment with Cloudflare Workers mocks
 */

import { beforeEach, vi } from 'vitest';

// Mock Cloudflare Workers globals
// Use Object.defineProperty since global.crypto is getter-only in Node.js
if (!global.crypto || !global.crypto.randomUUID) {
  const mockCrypto = {
    randomUUID: () => {
      let uuid = '';
      for (let i = 0; i < 32; i++) {
        if (i === 8 || i === 12 || i === 16 || i === 20) uuid += '-';
        uuid += Math.floor(Math.random() * 16).toString(16);
      }
      return uuid;
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: global.crypto?.subtle,
  };
  
  try {
    Object.defineProperty(global, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true,
    });
  } catch {
    // If we can't override, the native crypto should work
  }
}

// Mock fetch globally (can be overridden in tests)
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Test Setup
 * 
 * Configures test environment with Cloudflare Workers mocks
 */

import { beforeEach, vi } from 'vitest';

// Mock Cloudflare Workers globals
global.crypto = {
  randomUUID: () => {
    let uuid = '';
    for (let i = 0; i < 32; i++) {
      if (i === 8 || i === 12 || i === 16 || i === 20) uuid += '-';
      uuid += Math.floor(Math.random() * 16).toString(16);
    }
    return uuid;
  },
} as any;

// Mock fetch globally (can be overridden in tests)
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

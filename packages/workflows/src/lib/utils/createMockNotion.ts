/**
 * Mock Notion Client for Testing
 *
 * Unified test utility for mocking Notion integration methods.
 * Supports both playlist sync and catalog workflows.
 */

import { vi } from 'vitest';

export interface MockNotionClient {
	createPage: ReturnType<typeof vi.fn>;
	updatePage: ReturnType<typeof vi.fn>;
	queryDatabase: ReturnType<typeof vi.fn>;
	appendBlocksInBatches: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock Notion client with all common methods.
 *
 * Usage:
 * ```typescript
 * const notion = createMockNotion();
 * notion.createPage.mockResolvedValueOnce({ success: true, data: { id: 'page123' } });
 * ```
 */
export function createMockNotion(): MockNotionClient {
	return {
		createPage: vi.fn(),
		updatePage: vi.fn(),
		queryDatabase: vi.fn(),
		appendBlocksInBatches: vi.fn(),
	};
}

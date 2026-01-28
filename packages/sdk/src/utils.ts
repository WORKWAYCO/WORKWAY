/**
 * SDK Utilities
 *
 * Shared utility functions used across the SDK.
 * DRY Fix: Consolidated from http.ts, retry.ts, and other modules.
 */

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * await sleep(100);  // Wait 100ms between retries
 * ```
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delay alias for sleep (semantic naming)
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export const delay = sleep;

/**
 * Generate a unique ID with optional prefix
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique identifier string
 *
 * @example
 * ```typescript
 * generateId();        // 'lxk3m2n1'
 * generateId('wf');    // 'wf_lxk3m2n1'
 * ```
 */
export function generateId(prefix?: string): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}${random}`;
}

// ============================================================================
// WORKFLOW UTILITIES
// ============================================================================

/**
 * Workflow definition type (minimal interface for ID extraction)
 */
export interface WorkflowDefinitionMinimal {
	name?: string;
	metadata?: {
		id?: string;
		name?: string;
		pathway?: unknown;
	};
	pathway?: {
		primaryPair?: {
			workflowId?: string;
		};
	};
}

/**
 * Get workflow ID from a WorkflowDefinition
 * Handles both shorthand (pathway.primaryPair.workflowId) and metadata patterns
 *
 * @param workflow - Workflow definition object
 * @returns Workflow ID string
 *
 * @example
 * ```typescript
 * const id = getWorkflowId(workflow);
 * // Returns: 'meeting-intelligence' or derived from name
 * ```
 */
export function getWorkflowId(workflow: WorkflowDefinitionMinimal): string {
	// Try metadata first (legacy pattern)
	if (workflow.metadata?.id) {
		return workflow.metadata.id;
	}
	// Try pathway (Heideggerian discovery pattern)
	if (workflow.pathway?.primaryPair?.workflowId) {
		return workflow.pathway.primaryPair.workflowId;
	}
	// Fallback: derive from name
	const name = workflow.metadata?.name || workflow.name || 'unknown';
	return name.toLowerCase().replace(/\s+/g, '-');
}

// ============================================================================
// YOUTUBE UTILITIES
// ============================================================================

/**
 * Extract playlist ID from various YouTube URL formats or return the ID if already valid
 *
 * @param urlOrId - YouTube playlist URL or playlist ID
 * @returns Playlist ID or null if invalid
 *
 * @example
 * ```typescript
 * extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx123');  // 'PLxxx123'
 * extractPlaylistId('https://www.youtube.com/watch?v=abc&list=PLxxx123'); // 'PLxxx123'
 * extractPlaylistId('PLxxx123');  // 'PLxxx123' (already an ID)
 * extractPlaylistId('UUxxx123');  // 'UUxxx123' (uploads playlist)
 * extractPlaylistId('invalid');   // null
 * ```
 */
export function extractPlaylistId(urlOrId: string): string | null {
	// Already a playlist ID (starts with PL, UU, LL, FL, RD, OL)
	if (/^(PL|UU|LL|FL|RD|OL)[a-zA-Z0-9_-]+$/.test(urlOrId)) {
		return urlOrId;
	}

	// youtube.com/playlist?list=PLAYLIST_ID
	const listMatch = urlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
	if (listMatch) return listMatch[1];

	return null;
}

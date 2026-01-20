/**
 * Agent Utilities
 *
 * Shared utility functions for agent implementations.
 * DRY Fix: Consolidated from tracker.ts and claims.ts.
 */

/**
 * Generate a unique ID with prefix
 *
 * Creates IDs in the format: prefix_timestamp_random
 * - timestamp: base36 encoded milliseconds
 * - random: 6 character base36 string
 *
 * @param prefix - Prefix for the ID (e.g., 'task', 'claim', 'trace')
 * @returns Unique identifier string
 *
 * @example
 * ```typescript
 * generateId('task');  // 'task_lxk3m2n1_a1b2c3'
 * generateId('claim'); // 'claim_lxk3m2n2_d4e5f6'
 * ```
 */
export function generateId(prefix: string): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `${prefix}_${timestamp}_${random}`;
}

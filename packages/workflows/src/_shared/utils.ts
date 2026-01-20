/**
 * Shared Workflow Utilities
 *
 * Common utility functions used across multiple workflows.
 * DRY Fix: Consolidated from various workflow files.
 */

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Delay helper for rate limiting
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * await delay(1000); // Wait 1 second
 * ```
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// DISPLAY UTILITIES
// ============================================================================

/**
 * Generate a visual progress bar
 *
 * @param percentage - Progress percentage (0-100)
 * @returns Progress bar string with filled/empty blocks
 *
 * @example
 * ```typescript
 * getProgressBar(75); // '███████░░░'
 * ```
 */
export function getProgressBar(percentage: number): string {
	const filled = Math.round(percentage / 10);
	const empty = 10 - filled;
	return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get emoji indicator based on score
 *
 * @param score - Score value (0-100)
 * @returns Appropriate emoji for the score level
 */
export function getScoreEmoji(score: number): string {
	if (score >= 80) return '🌟';
	if (score >= 60) return '✅';
	if (score >= 40) return '📈';
	return '💪';
}

// ============================================================================
// SPREADSHEET UTILITIES
// ============================================================================

/**
 * Convert column letter (A, B, AA) to zero-based index (0, 1, 26)
 *
 * @param letter - Column letter(s)
 * @returns Zero-based column index
 *
 * @example
 * ```typescript
 * columnLetterToIndex('A');  // 0
 * columnLetterToIndex('B');  // 1
 * columnLetterToIndex('AA'); // 26
 * ```
 */
export function columnLetterToIndex(letter: string): number {
	const upper = letter.toUpperCase();
	let index = 0;
	for (let i = 0; i < upper.length; i++) {
		index = index * 26 + (upper.charCodeAt(i) - 64);
	}
	return index - 1;
}

/**
 * Convert zero-based column index to letter
 *
 * @param index - Zero-based column index
 * @returns Column letter(s)
 *
 * @example
 * ```typescript
 * columnIndexToLetter(0);  // 'A'
 * columnIndexToLetter(1);  // 'B'
 * columnIndexToLetter(26); // 'AA'
 * ```
 */
export function columnIndexToLetter(index: number): string {
	let letter = '';
	let temp = index + 1;
	while (temp > 0) {
		const mod = (temp - 1) % 26;
		letter = String.fromCharCode(65 + mod) + letter;
		temp = Math.floor((temp - mod) / 26);
	}
	return letter;
}

/**
 * Simple hash function for change detection
 *
 * @param str - String to hash
 * @returns Hex hash string
 *
 * @example
 * ```typescript
 * simpleHash('hello'); // '5d41402a'
 * ```
 */
export function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return hash.toString(16);
}

/**
 * Convert row array to object with headers as keys
 *
 * @param row - Array of cell values
 * @param headers - Array of header names
 * @returns Object with headers as keys
 */
export function rowToObject(row: string[], headers: string[]): Record<string, string> {
	const obj: Record<string, string> = {};
	for (let i = 0; i < headers.length && i < row.length; i++) {
		obj[headers[i]] = row[i];
	}
	return obj;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Parse appointment time string to Date
 *
 * @param timeStr - Time string in various formats
 * @returns Date object or null if parsing fails
 */
export function parseAppointmentTime(timeStr: string): Date | null {
	const date = new Date(timeStr);
	return isNaN(date.getTime()) ? null : date;
}

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate a random ID
 *
 * @param prefix - Optional prefix for the ID
 * @param length - Length of random portion (default: 8)
 * @returns Generated ID string
 *
 * @example
 * ```typescript
 * generateId();        // 'a1b2c3d4'
 * generateId('task');  // 'task_a1b2c3d4'
 * ```
 */
export function generateId(prefix?: string, length: number = 8): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < length; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return prefix ? `${prefix}_${id}` : id;
}

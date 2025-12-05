/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Date Utilities - Weniger, aber besser
 *
 * Shared date/time utilities used across integrations.
 * Eliminates ~60 lines of duplicate code.
 *
 * Zuhandenheit: The developer thinks "get last 24 hours" not
 * "convert milliseconds to seconds and format as string"
 */

// ============================================================================
// DURATION PARSING
// ============================================================================

/**
 * Duration units supported by parseDuration
 */
export type DurationUnit = 'm' | 'h' | 'd' | 'w';

/**
 * Parse a human-friendly duration string into milliseconds
 *
 * @param duration - Duration string like "1h", "24h", "7d", "2w", "30m"
 * @returns Milliseconds, or undefined if format is invalid
 *
 * @example
 * ```typescript
 * parseDurationMs('1h');   // 3600000
 * parseDurationMs('24h');  // 86400000
 * parseDurationMs('7d');   // 604800000
 * parseDurationMs('2w');   // 1209600000
 * parseDurationMs('30m');  // 1800000
 * ```
 */
export function parseDurationMs(duration: string): number | undefined {
	const match = duration.match(/^(\d+)(m|h|d|w)$/i);
	if (!match) return undefined;

	const value = parseInt(match[1], 10);
	const unit = match[2].toLowerCase() as DurationUnit;

	switch (unit) {
		case 'm':
			return value * 60 * 1000;
		case 'h':
			return value * 60 * 60 * 1000;
		case 'd':
			return value * 24 * 60 * 60 * 1000;
		case 'w':
			return value * 7 * 24 * 60 * 60 * 1000;
		default:
			return undefined;
	}
}

/**
 * Parse a "since" value into a Unix timestamp (seconds)
 *
 * Zuhandenheit: Abstracts the conversion so developers think in
 * human terms ("last 24 hours") rather than Unix timestamps.
 *
 * @param since - Duration string ("1h", "24h", "7d"), Date, or raw timestamp string
 * @returns Unix timestamp in seconds as string
 *
 * @example
 * ```typescript
 * // Duration strings
 * parseSinceToUnixSeconds('1h');   // "1733392800" (1 hour ago)
 * parseSinceToUnixSeconds('24h');  // "1733309200" (24 hours ago)
 * parseSinceToUnixSeconds('7d');   // "1732787600" (7 days ago)
 *
 * // Date objects
 * parseSinceToUnixSeconds(new Date('2024-01-01'));  // "1704067200"
 *
 * // Raw timestamps (pass through)
 * parseSinceToUnixSeconds('1704067200');  // "1704067200"
 * ```
 */
export function parseSinceToUnixSeconds(since: string | Date): string {
	// If it's a Date object, convert to Unix seconds
	if (since instanceof Date) {
		return Math.floor(since.getTime() / 1000).toString();
	}

	// If it looks like a raw timestamp (all digits), pass through
	if (/^\d+(\.\d+)?$/.test(since)) {
		return since;
	}

	// Parse duration strings: "30m", "1h", "24h", "7d", "2w"
	const ms = parseDurationMs(since);
	if (ms !== undefined) {
		return Math.floor((Date.now() - ms) / 1000).toString();
	}

	// Try parsing as ISO date string
	const parsed = Date.parse(since);
	if (!isNaN(parsed)) {
		return Math.floor(parsed / 1000).toString();
	}

	// If nothing works, return as-is
	return since;
}

/**
 * Parse a "since" value into a Date object
 *
 * @param since - Duration string, Date, or date string
 * @returns Date object
 */
export function parseSinceToDate(since: string | Date): Date {
	if (since instanceof Date) {
		return since;
	}

	// Parse duration strings
	const ms = parseDurationMs(since);
	if (ms !== undefined) {
		return new Date(Date.now() - ms);
	}

	// Try parsing as date string
	const parsed = Date.parse(since);
	if (!isNaN(parsed)) {
		return new Date(parsed);
	}

	// If it's a Unix timestamp string
	if (/^\d+$/.test(since)) {
		const num = parseInt(since, 10);
		// If it's in seconds (less than year 2100 in ms), convert to ms
		return new Date(num < 4102444800 ? num * 1000 : num);
	}

	return new Date();
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date to YYYY-MM-DD
 *
 * Used by Zoom and other APIs that expect date-only format.
 *
 * @param date - Date object or ISO string
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * formatDateYMD(new Date('2024-01-15T10:30:00Z'));  // "2024-01-15"
 * formatDateYMD('2024-01-15T10:30:00Z');            // "2024-01-15"
 * ```
 */
export function formatDateYMD(date: string | Date): string {
	if (typeof date === 'string') {
		// If already in YYYY-MM-DD format, return as-is
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return date;
		}
		date = new Date(date);
	}
	return date.toISOString().split('T')[0];
}

/**
 * Format date to ISO string
 *
 * Used by APIs that expect full ISO 8601 format.
 *
 * @param date - Date object or date string
 * @returns ISO 8601 string
 *
 * @example
 * ```typescript
 * formatDateISO(new Date('2024-01-15T10:30:00Z'));  // "2024-01-15T10:30:00.000Z"
 * ```
 */
export function formatDateISO(date: string | Date): string {
	if (typeof date === 'string') {
		// If already an ISO string, return as-is
		if (date.includes('T') && date.includes('Z')) {
			return date;
		}
		date = new Date(date);
	}
	return date.toISOString();
}

/**
 * Format date to Unix timestamp in seconds
 *
 * @param date - Date object or date string
 * @returns Unix timestamp in seconds as string
 */
export function formatDateUnix(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return Math.floor(d.getTime() / 1000).toString();
}

// ============================================================================
// RELATIVE TIME
// ============================================================================

/**
 * Get a Date representing a relative time from now
 *
 * @param duration - Duration string like "1h", "24h", "7d"
 * @param direction - 'past' (default) or 'future'
 * @returns Date object
 *
 * @example
 * ```typescript
 * getRelativeDate('24h');           // 24 hours ago
 * getRelativeDate('7d', 'past');    // 7 days ago
 * getRelativeDate('1h', 'future');  // 1 hour from now
 * ```
 */
export function getRelativeDate(duration: string, direction: 'past' | 'future' = 'past'): Date {
	const ms = parseDurationMs(duration);
	if (ms === undefined) {
		throw new Error(`Invalid duration format: ${duration}`);
	}

	const now = Date.now();
	return new Date(direction === 'past' ? now - ms : now + ms);
}

/**
 * Create a date range for API queries
 *
 * @param since - Duration string like "24h", "7d", or Date
 * @param until - End date (defaults to now)
 * @returns Object with from/to dates formatted as YYYY-MM-DD
 *
 * @example
 * ```typescript
 * createDateRange('7d');
 * // { from: "2024-12-01", to: "2024-12-08" }
 *
 * createDateRange('30d', new Date('2024-06-15'));
 * // { from: "2024-05-16", to: "2024-06-15" }
 * ```
 */
export function createDateRange(
	since: string | Date,
	until: Date = new Date()
): { from: string; to: string } {
	const fromDate = parseSinceToDate(since);

	return {
		from: formatDateYMD(fromDate),
		to: formatDateYMD(until),
	};
}

// ============================================================================
// TIMEZONE UTILITIES
// ============================================================================

/**
 * Get the user's timezone identifier
 *
 * @returns IANA timezone identifier (e.g., "America/New_York")
 */
export function getUserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return 'UTC';
	}
}

/**
 * Get the current timezone offset in minutes
 *
 * @returns Offset in minutes (e.g., -300 for EST)
 */
export function getTimezoneOffset(): number {
	return new Date().getTimezoneOffset();
}

/**
 * Format a date in the user's local timezone
 *
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatLocalDate(
	date: Date,
	options: Intl.DateTimeFormatOptions = {
		dateStyle: 'medium',
		timeStyle: 'short',
	}
): string {
	return new Intl.DateTimeFormat(undefined, options).format(date);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if a string is a valid duration format
 */
export function isValidDuration(value: string): boolean {
	return /^(\d+)(m|h|d|w)$/i.test(value);
}

/**
 * Check if a value represents a valid date
 */
export function isValidDate(value: string | Date): boolean {
	if (value instanceof Date) {
		return !isNaN(value.getTime());
	}
	return !isNaN(Date.parse(value));
}

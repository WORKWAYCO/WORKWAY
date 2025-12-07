/**
 * Date Utilities Tests
 *
 * Tests for the shared date/time utilities used across integrations.
 * These utilities embody Zuhandenheit - developers think in human terms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	parseDurationMs,
	parseSinceToUnixSeconds,
	parseSinceToDate,
	formatDateYMD,
	formatDateISO,
	formatDateUnix,
	getRelativeDate,
	createDateRange,
	getUserTimezone,
	getTimezoneOffset,
	formatLocalDate,
	isValidDuration,
	isValidDate,
	type DurationUnit,
} from './date-utils.js';

// ============================================================================
// DURATION PARSING TESTS
// ============================================================================

describe('parseDurationMs', () => {
	describe('minutes', () => {
		it('should parse minutes correctly', () => {
			expect(parseDurationMs('1m')).toBe(60 * 1000);
			expect(parseDurationMs('30m')).toBe(30 * 60 * 1000);
			expect(parseDurationMs('60m')).toBe(60 * 60 * 1000);
		});

		it('should handle uppercase M', () => {
			expect(parseDurationMs('30M')).toBe(30 * 60 * 1000);
		});
	});

	describe('hours', () => {
		it('should parse hours correctly', () => {
			expect(parseDurationMs('1h')).toBe(60 * 60 * 1000);
			expect(parseDurationMs('24h')).toBe(24 * 60 * 60 * 1000);
			expect(parseDurationMs('48h')).toBe(48 * 60 * 60 * 1000);
		});

		it('should handle uppercase H', () => {
			expect(parseDurationMs('24H')).toBe(24 * 60 * 60 * 1000);
		});
	});

	describe('days', () => {
		it('should parse days correctly', () => {
			expect(parseDurationMs('1d')).toBe(24 * 60 * 60 * 1000);
			expect(parseDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
			expect(parseDurationMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
		});

		it('should handle uppercase D', () => {
			expect(parseDurationMs('7D')).toBe(7 * 24 * 60 * 60 * 1000);
		});
	});

	describe('weeks', () => {
		it('should parse weeks correctly', () => {
			expect(parseDurationMs('1w')).toBe(7 * 24 * 60 * 60 * 1000);
			expect(parseDurationMs('2w')).toBe(14 * 24 * 60 * 60 * 1000);
			expect(parseDurationMs('4w')).toBe(28 * 24 * 60 * 60 * 1000);
		});

		it('should handle uppercase W', () => {
			expect(parseDurationMs('2W')).toBe(14 * 24 * 60 * 60 * 1000);
		});
	});

	describe('invalid formats', () => {
		it('should return undefined for invalid formats', () => {
			expect(parseDurationMs('')).toBeUndefined();
			expect(parseDurationMs('h')).toBeUndefined();
			expect(parseDurationMs('24')).toBeUndefined();
			expect(parseDurationMs('abc')).toBeUndefined();
			expect(parseDurationMs('24hours')).toBeUndefined();
			expect(parseDurationMs('1s')).toBeUndefined(); // seconds not supported
			expect(parseDurationMs('1y')).toBeUndefined(); // years not supported
		});

		it('should return undefined for negative values', () => {
			expect(parseDurationMs('-1h')).toBeUndefined();
		});

		it('should return undefined for decimal values', () => {
			expect(parseDurationMs('1.5h')).toBeUndefined();
		});
	});
});

// ============================================================================
// parseSinceToUnixSeconds TESTS
// ============================================================================

describe('parseSinceToUnixSeconds', () => {
	beforeEach(() => {
		// Fix time for predictable tests
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-12-08T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('duration strings', () => {
		it('should convert duration strings to Unix seconds', () => {
			const now = Date.now() / 1000;

			// 1 hour ago
			const result1h = parseSinceToUnixSeconds('1h');
			expect(parseInt(result1h)).toBeCloseTo(now - 3600, 0);

			// 24 hours ago
			const result24h = parseSinceToUnixSeconds('24h');
			expect(parseInt(result24h)).toBeCloseTo(now - 86400, 0);

			// 7 days ago
			const result7d = parseSinceToUnixSeconds('7d');
			expect(parseInt(result7d)).toBeCloseTo(now - 604800, 0);
		});
	});

	describe('Date objects', () => {
		it('should convert Date objects to Unix seconds', () => {
			const date = new Date('2024-01-01T00:00:00Z');
			const result = parseSinceToUnixSeconds(date);
			expect(result).toBe('1704067200');
		});
	});

	describe('raw timestamps', () => {
		it('should pass through raw timestamp strings', () => {
			expect(parseSinceToUnixSeconds('1704067200')).toBe('1704067200');
			expect(parseSinceToUnixSeconds('1733659200')).toBe('1733659200');
		});

		it('should handle decimal timestamps', () => {
			expect(parseSinceToUnixSeconds('1704067200.5')).toBe('1704067200.5');
		});
	});

	describe('ISO date strings', () => {
		it('should parse ISO date strings', () => {
			const result = parseSinceToUnixSeconds('2024-01-01T00:00:00Z');
			expect(result).toBe('1704067200');
		});
	});

	describe('invalid values', () => {
		it('should return invalid strings as-is', () => {
			expect(parseSinceToUnixSeconds('invalid')).toBe('invalid');
		});
	});
});

// ============================================================================
// parseSinceToDate TESTS
// ============================================================================

describe('parseSinceToDate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-12-08T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('Date objects', () => {
		it('should return Date objects as-is', () => {
			const date = new Date('2024-01-01T00:00:00Z');
			const result = parseSinceToDate(date);
			expect(result).toBe(date);
		});
	});

	describe('duration strings', () => {
		it('should convert duration strings to Date objects', () => {
			const result1h = parseSinceToDate('1h');
			expect(result1h.getTime()).toBe(Date.now() - 3600000);

			const result24h = parseSinceToDate('24h');
			expect(result24h.getTime()).toBe(Date.now() - 86400000);
		});
	});

	describe('date strings', () => {
		it('should parse ISO date strings', () => {
			const result = parseSinceToDate('2024-01-01T00:00:00Z');
			expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		});
	});

	describe('Unix timestamps', () => {
		it('should convert Unix timestamp strings (seconds)', () => {
			const result = parseSinceToDate('1704067200');
			expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		});

		it('should handle millisecond timestamps', () => {
			// Timestamps after year 2100 are assumed to be in milliseconds
			const msTimestamp = '1704067200000';
			const result = parseSinceToDate(msTimestamp);
			// Should interpret as milliseconds since it's a large number
			expect(result.getTime()).toBe(1704067200000);
		});
	});

	describe('invalid values', () => {
		it('should return current date for invalid strings', () => {
			const result = parseSinceToDate('invalid');
			expect(result.getTime()).toBeCloseTo(Date.now(), -3);
		});
	});
});

// ============================================================================
// DATE FORMATTING TESTS
// ============================================================================

describe('formatDateYMD', () => {
	it('should format Date objects to YYYY-MM-DD', () => {
		const date = new Date('2024-01-15T10:30:00Z');
		expect(formatDateYMD(date)).toBe('2024-01-15');
	});

	it('should format ISO date strings to YYYY-MM-DD', () => {
		expect(formatDateYMD('2024-01-15T10:30:00Z')).toBe('2024-01-15');
		expect(formatDateYMD('2024-12-08T23:59:59.999Z')).toBe('2024-12-08');
	});

	it('should pass through YYYY-MM-DD strings', () => {
		expect(formatDateYMD('2024-01-15')).toBe('2024-01-15');
		expect(formatDateYMD('2024-12-08')).toBe('2024-12-08');
	});

	it('should handle date-only strings', () => {
		expect(formatDateYMD('2024-06-15')).toBe('2024-06-15');
	});
});

describe('formatDateISO', () => {
	it('should format Date objects to ISO 8601', () => {
		const date = new Date('2024-01-15T10:30:00Z');
		expect(formatDateISO(date)).toBe('2024-01-15T10:30:00.000Z');
	});

	it('should pass through ISO strings with Z', () => {
		expect(formatDateISO('2024-01-15T10:30:00.000Z')).toBe('2024-01-15T10:30:00.000Z');
	});

	it('should convert date strings to ISO format', () => {
		const result = formatDateISO('2024-01-15');
		expect(result).toContain('2024-01-15');
		expect(result).toContain('T');
		expect(result).toContain('Z');
	});
});

describe('formatDateUnix', () => {
	it('should format Date objects to Unix timestamp', () => {
		const date = new Date('2024-01-01T00:00:00Z');
		expect(formatDateUnix(date)).toBe('1704067200');
	});

	it('should format date strings to Unix timestamp', () => {
		expect(formatDateUnix('2024-01-01T00:00:00Z')).toBe('1704067200');
	});
});

// ============================================================================
// RELATIVE TIME TESTS
// ============================================================================

describe('getRelativeDate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-12-08T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('past direction', () => {
		it('should calculate past dates (default)', () => {
			const result24h = getRelativeDate('24h');
			expect(result24h.toISOString()).toBe('2024-12-07T12:00:00.000Z');

			const result7d = getRelativeDate('7d');
			expect(result7d.toISOString()).toBe('2024-12-01T12:00:00.000Z');

			const result7dExplicit = getRelativeDate('7d', 'past');
			expect(result7dExplicit.toISOString()).toBe('2024-12-01T12:00:00.000Z');
		});
	});

	describe('future direction', () => {
		it('should calculate future dates', () => {
			const result24h = getRelativeDate('24h', 'future');
			expect(result24h.toISOString()).toBe('2024-12-09T12:00:00.000Z');

			const result7d = getRelativeDate('7d', 'future');
			expect(result7d.toISOString()).toBe('2024-12-15T12:00:00.000Z');
		});
	});

	describe('invalid formats', () => {
		it('should throw for invalid duration formats', () => {
			expect(() => getRelativeDate('invalid')).toThrow('Invalid duration format');
			expect(() => getRelativeDate('24hours')).toThrow('Invalid duration format');
		});
	});
});

describe('createDateRange', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-12-08T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should create date range from duration string', () => {
		const range = createDateRange('7d');
		expect(range.from).toBe('2024-12-01');
		expect(range.to).toBe('2024-12-08');
	});

	it('should create date range with custom until date', () => {
		const range = createDateRange('30d', new Date('2024-06-15T12:00:00Z'));
		expect(range.to).toBe('2024-06-15');
	});

	it('should handle Date objects as since', () => {
		const fromDate = new Date('2024-11-01T00:00:00Z');
		const toDate = new Date('2024-12-01T00:00:00Z');
		const range = createDateRange(fromDate, toDate);
		expect(range.from).toBe('2024-11-01');
		expect(range.to).toBe('2024-12-01');
	});
});

// ============================================================================
// TIMEZONE TESTS
// ============================================================================

describe('getUserTimezone', () => {
	it('should return a timezone string', () => {
		const tz = getUserTimezone();
		expect(typeof tz).toBe('string');
		expect(tz.length).toBeGreaterThan(0);
	});

	it('should return a valid IANA timezone', () => {
		const tz = getUserTimezone();
		// Common patterns: America/*, Europe/*, Asia/*, UTC, etc.
		expect(tz).toMatch(/^[A-Z][a-z]+\/[A-Za-z_]+|UTC$/);
	});
});

describe('getTimezoneOffset', () => {
	it('should return a number', () => {
		const offset = getTimezoneOffset();
		expect(typeof offset).toBe('number');
	});

	it('should return offset in minutes', () => {
		const offset = getTimezoneOffset();
		// Offsets are typically between -720 and +840 minutes
		expect(offset).toBeGreaterThanOrEqual(-720);
		expect(offset).toBeLessThanOrEqual(840);
	});
});

describe('formatLocalDate', () => {
	it('should format date with default options', () => {
		const date = new Date('2024-01-15T10:30:00Z');
		const formatted = formatLocalDate(date);
		expect(typeof formatted).toBe('string');
		expect(formatted.length).toBeGreaterThan(0);
	});

	it('should accept custom format options', () => {
		const date = new Date('2024-01-15T10:30:00Z');
		const formatted = formatLocalDate(date, { dateStyle: 'full' });
		expect(typeof formatted).toBe('string');
		// Full date style includes day of week
	});
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('isValidDuration', () => {
	it('should return true for valid durations', () => {
		expect(isValidDuration('1m')).toBe(true);
		expect(isValidDuration('30m')).toBe(true);
		expect(isValidDuration('1h')).toBe(true);
		expect(isValidDuration('24h')).toBe(true);
		expect(isValidDuration('1d')).toBe(true);
		expect(isValidDuration('7d')).toBe(true);
		expect(isValidDuration('1w')).toBe(true);
		expect(isValidDuration('2w')).toBe(true);
	});

	it('should handle uppercase units', () => {
		expect(isValidDuration('24H')).toBe(true);
		expect(isValidDuration('7D')).toBe(true);
		expect(isValidDuration('2W')).toBe(true);
	});

	it('should return false for invalid durations', () => {
		expect(isValidDuration('')).toBe(false);
		expect(isValidDuration('h')).toBe(false);
		expect(isValidDuration('24')).toBe(false);
		expect(isValidDuration('abc')).toBe(false);
		expect(isValidDuration('1s')).toBe(false);
		expect(isValidDuration('1y')).toBe(false);
		expect(isValidDuration('-1h')).toBe(false);
		expect(isValidDuration('1.5h')).toBe(false);
	});
});

describe('isValidDate', () => {
	describe('Date objects', () => {
		it('should return true for valid Date objects', () => {
			expect(isValidDate(new Date())).toBe(true);
			expect(isValidDate(new Date('2024-01-01'))).toBe(true);
		});

		it('should return false for invalid Date objects', () => {
			expect(isValidDate(new Date('invalid'))).toBe(false);
			expect(isValidDate(new Date(NaN))).toBe(false);
		});
	});

	describe('date strings', () => {
		it('should return true for valid date strings', () => {
			expect(isValidDate('2024-01-01')).toBe(true);
			expect(isValidDate('2024-01-01T00:00:00Z')).toBe(true);
			expect(isValidDate('Jan 1, 2024')).toBe(true);
		});

		it('should return false for invalid date strings', () => {
			expect(isValidDate('invalid')).toBe(false);
			expect(isValidDate('abc123')).toBe(false);
			expect(isValidDate('')).toBe(false);
		});
	});
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
	it('should handle zero durations', () => {
		expect(parseDurationMs('0h')).toBe(0);
		expect(parseDurationMs('0d')).toBe(0);
	});

	it('should handle large durations', () => {
		const result = parseDurationMs('365d');
		expect(result).toBe(365 * 24 * 60 * 60 * 1000);
	});

	it('should handle Date at epoch', () => {
		const epoch = new Date(0);
		expect(formatDateUnix(epoch)).toBe('0');
		expect(formatDateYMD(epoch)).toBe('1970-01-01');
	});

	it('should handle end of day dates', () => {
		const endOfDay = new Date('2024-12-31T23:59:59.999Z');
		expect(formatDateYMD(endOfDay)).toBe('2024-12-31');
	});

	it('should handle leap year dates', () => {
		const leapDay = new Date('2024-02-29T12:00:00Z');
		expect(formatDateYMD(leapDay)).toBe('2024-02-29');
		expect(isValidDate(leapDay)).toBe(true);
	});
});

// ============================================================================
// ZUHANDENHEIT: DEVELOPER EXPERIENCE
// ============================================================================

describe('Zuhandenheit: Developer thinks in human terms', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-12-08T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should let developer say "last 24 hours" naturally', () => {
		// Instead of: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000).toString()
		// Developer writes:
		const since = parseSinceToUnixSeconds('24h');
		expect(typeof since).toBe('string');
		expect(parseInt(since)).toBeLessThan(Date.now() / 1000);
	});

	it('should let developer say "last 7 days" naturally', () => {
		// Instead of calculating days in milliseconds
		// Developer writes:
		const range = createDateRange('7d');
		expect(range.from).toBe('2024-12-01');
		expect(range.to).toBe('2024-12-08');
	});

	it('should handle mixed input types gracefully', () => {
		// Developer doesn't need to care about input format
		const fromDate = parseSinceToDate(new Date('2024-01-01'));
		const fromString = parseSinceToDate('2024-01-01');
		const fromDuration = parseSinceToDate('7d');

		expect(fromDate instanceof Date).toBe(true);
		expect(fromString instanceof Date).toBe(true);
		expect(fromDuration instanceof Date).toBe(true);
	});
});

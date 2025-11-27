/**
 * Transform Module
 *
 * Data transformation utilities for workflow development.
 * Includes array operations, parsing, and formatting helpers.
 */

// Re-export existing transform utilities
export * from './transform-utils';

// ============================================================================
// ARRAY OPERATIONS
// ============================================================================

/**
 * Filter array with predicate
 */
export function filter<T>(array: T[], predicate: (item: T, index: number) => boolean): T[] {
	return array.filter(predicate);
}

/**
 * Map array with transformer
 */
export function map<T, U>(array: T[], mapper: (item: T, index: number) => U): U[] {
	return array.map(mapper);
}

/**
 * Reduce array
 */
export function reduce<T, U>(
	array: T[],
	reducer: (acc: U, item: T, index: number) => U,
	initial: U
): U {
	return array.reduce(reducer, initial);
}

/**
 * Find first item matching predicate
 */
export function find<T>(array: T[], predicate: (item: T, index: number) => boolean): T | undefined {
	return array.find(predicate);
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
	return array.reduce((groups, item) => {
		const key = keyFn(item);
		if (!groups[key]) groups[key] = [];
		groups[key].push(item);
		return groups;
	}, {} as Record<string, T[]>);
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
	if (!keyFn) {
		return [...new Set(array)];
	}
	const seen = new Set();
	return array.filter(item => {
		const key = keyFn(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

/**
 * Flatten nested array
 */
export function flatten<T>(array: (T | T[])[]): T[] {
	return array.flat() as T[];
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], keyFn: (item: T) => any, order: 'asc' | 'desc' = 'asc'): T[] {
	return [...array].sort((a, b) => {
		const aVal = keyFn(a);
		const bVal = keyFn(b);
		const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
		return order === 'asc' ? comparison : -comparison;
	});
}

// ============================================================================
// DATA PARSING
// ============================================================================

/**
 * Parse JSON safely
 */
export function parseJSON<T = any>(text: string, fallback?: T): T | null {
	try {
		return JSON.parse(text);
	} catch {
		return fallback ?? null;
	}
}

/**
 * Parse CSV to array of objects
 */
export function parseCSV(
	text: string,
	options: { delimiter?: string; headers?: boolean } = {}
): Record<string, string>[] | string[][] {
	const { delimiter = ',', headers = true } = options;
	const lines = text.trim().split('\n');

	if (lines.length === 0) return [];

	const parseRow = (line: string): string[] => {
		const row: string[] = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (char === '"') {
				if (inQuotes && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (char === delimiter && !inQuotes) {
				row.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
		row.push(current.trim());
		return row;
	};

	const rows = lines.map(parseRow);

	if (!headers) {
		return rows;
	}

	const headerRow = rows[0];
	return rows.slice(1).map(row => {
		const obj: Record<string, string> = {};
		headerRow.forEach((header, i) => {
			obj[header] = row[i] || '';
		});
		return obj;
	});
}

/**
 * Convert array of objects to CSV
 */
export function toCSV(
	data: Record<string, any>[],
	options: { delimiter?: string; headers?: string[] } = {}
): string {
	if (data.length === 0) return '';

	const { delimiter = ',', headers = Object.keys(data[0]) } = options;

	const escapeValue = (val: any): string => {
		const str = String(val ?? '');
		if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};

	const headerLine = headers.map(escapeValue).join(delimiter);
	const dataLines = data.map(row =>
		headers.map(h => escapeValue(row[h])).join(delimiter)
	);

	return [headerLine, ...dataLines].join('\n');
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date with pattern
 */
export function formatDate(date: Date | string | number, pattern: string = 'YYYY-MM-DD'): string {
	const d = new Date(date);

	const pad = (n: number): string => n.toString().padStart(2, '0');

	const replacements: Record<string, string> = {
		'YYYY': d.getFullYear().toString(),
		'YY': d.getFullYear().toString().slice(-2),
		'MM': pad(d.getMonth() + 1),
		'M': (d.getMonth() + 1).toString(),
		'DD': pad(d.getDate()),
		'D': d.getDate().toString(),
		'HH': pad(d.getHours()),
		'H': d.getHours().toString(),
		'mm': pad(d.getMinutes()),
		'm': d.getMinutes().toString(),
		'ss': pad(d.getSeconds()),
		's': d.getSeconds().toString(),
	};

	let result = pattern;
	for (const [token, value] of Object.entries(replacements)) {
		result = result.replace(token, value);
	}

	return result;
}

/**
 * Get relative time string
 */
export function relativeTime(date: Date | string | number): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);
	const diffWeek = Math.floor(diffDay / 7);
	const diffMonth = Math.floor(diffDay / 30);
	const diffYear = Math.floor(diffDay / 365);

	if (diffSec < 60) return 'just now';
	if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
	if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
	if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
	if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
	if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
	return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}

// ============================================================================
// STRING OPERATIONS
// ============================================================================

/**
 * Convert string to URL-friendly slug
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert to title case
 */
export function titleCase(text: string): string {
	return text
		.toLowerCase()
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Simple string template
 */
export function template(text: string, data: Record<string, any>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''));
}

// ============================================================================
// EXPORT CONSOLIDATED TRANSFORM OBJECT
// ============================================================================

export const transform = {
	// Array
	filter,
	map,
	reduce,
	find,
	groupBy,
	unique,
	chunk,
	flatten,
	sortBy,
	// Parsing
	parseJSON,
	parseCSV,
	toCSV,
	// Date
	formatDate,
	relativeTime,
	// String
	slugify,
	truncate,
	capitalize,
	titleCase,
	template,
};

export default transform;

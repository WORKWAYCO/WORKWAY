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
 * Standard Transform Utilities
 *
 * Generic data transformation functions for integrations.
 * These are NOT integration-specific (no Notion-specific or Slack-specific logic).
 * Integration-specific transforms belong in the integration's own directory.
 *
 * Pattern: Narrow waist utilities that all integrations can use
 */

// ============================================================================
// HTML / TEXT CONVERSIONS
// ============================================================================

/**
 * Convert HTML to plain text
 * Strips all HTML tags and decodes entities
 */
export function htmlToText(html: string): string {
	if (!html) return '';

	// Strip HTML tags
	let text = html.replace(/<[^>]*>/g, '');

	// Decode common HTML entities
	text = text
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'");

	// Normalize whitespace
	text = text.replace(/\s+/g, ' ').trim();

	return text;
}

/**
 * Convert HTML to Markdown (basic conversion)
 * Preserves links, bold, italic, headings, lists
 */
export function htmlToMarkdown(html: string): string {
	if (!html) return '';

	let markdown = html;

	// Headings
	markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
	markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
	markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
	markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');

	// Bold
	markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
	markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

	// Italic
	markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
	markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

	// Links
	markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

	// Line breaks
	markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

	// Paragraphs
	markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

	// Lists
	markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
	markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n');
	markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n');

	// Code
	markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
	markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n');

	// Strip remaining HTML tags
	markdown = markdown.replace(/<[^>]*>/g, '');

	// Decode HTML entities
	markdown = markdown
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");

	// Clean up excessive whitespace
	markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

	return markdown;
}

/**
 * Convert Markdown to HTML (basic conversion)
 * Converts headings, bold, italic, links, lists
 */
export function markdownToHtml(markdown: string): string {
	if (!markdown) return '';

	let html = markdown;

	// Escape HTML entities first
	html = html
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// Headings
	html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
	html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
	html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
	html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

	// Bold
	html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

	// Italic
	html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
	html = html.replace(/_(.*?)_/g, '<em>$1</em>');

	// Links
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

	// Code
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Line breaks
	html = html.replace(/\n/g, '<br>');

	return html;
}

// ============================================================================
// DATE / TIME CONVERSIONS
// ============================================================================

/**
 * Convert various date formats to ISO 8601 string
 * Handles: Date objects, Unix timestamps (ms or s), ISO strings
 */
export function dateToISO8601(date: Date | number | string): string {
	if (typeof date === 'string') {
		// Already a string, try to parse and re-format
		const parsed = new Date(date);
		if (isNaN(parsed.getTime())) {
			throw new Error(`Invalid date string: ${date}`);
		}
		return parsed.toISOString();
	}

	if (typeof date === 'number') {
		// Assume milliseconds if > 10000000000 (after year 2286 in seconds)
		// Otherwise assume seconds and convert to milliseconds
		const timestamp = date > 10000000000 ? date : date * 1000;
		return new Date(timestamp).toISOString();
	}

	if (date instanceof Date) {
		return date.toISOString();
	}

	throw new Error(`Unsupported date type: ${typeof date}`);
}

/**
 * Parse ISO 8601 date string to Unix timestamp (milliseconds)
 */
export function iso8601ToTimestamp(isoString: string): number {
	const date = new Date(isoString);
	if (isNaN(date.getTime())) {
		throw new Error(`Invalid ISO 8601 date: ${isoString}`);
	}
	return date.getTime();
}

/**
 * Format timestamp as human-readable date string
 * Example: "January 15, 2024 at 3:30 PM"
 */
export function formatTimestamp(timestamp: number, options?: Intl.DateTimeFormatOptions): string {
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		...options,
	};

	return new Date(timestamp).toLocaleString('en-US', defaultOptions);
}

// ============================================================================
// TEXT PROCESSING
// ============================================================================

/**
 * Truncate text to specified length with ellipsis
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
	if (!text || text.length <= maxLength) return text;
	return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract first N words from text
 */
export function extractWords(text: string, wordCount: number): string {
	if (!text) return '';
	const words = text.split(/\s+/);
	return words.slice(0, wordCount).join(' ');
}

/**
 * Slugify text for URLs (lowercase, hyphens, remove special chars)
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '') // Remove special characters
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/-+/g, '-'); // Remove consecutive hyphens
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(text: string): string {
	return text
		.toLowerCase()
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Remove extra whitespace and normalize line endings
 */
export function normalizeWhitespace(text: string): string {
	return text
		.replace(/\r\n/g, '\n') // Normalize line endings
		.replace(/\t/g, '  ') // Convert tabs to spaces
		.replace(/ +/g, ' ') // Remove multiple spaces
		.trim();
}

// ============================================================================
// URL / EMAIL EXTRACTION
// ============================================================================

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	return text.match(urlRegex) || [];
}

/**
 * Extract all email addresses from text
 */
export function extractEmails(text: string): string[] {
	const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
	return text.match(emailRegex) || [];
}

/**
 * Check if text contains a URL
 */
export function hasUrl(text: string): boolean {
	return /https?:\/\/[^\s]+/.test(text);
}

/**
 * Check if text is a valid email
 */
export function isEmail(text: string): boolean {
	return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+$/.test(text);
}

// ============================================================================
// JSON / OBJECT UTILITIES
// ============================================================================

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T = any>(json: string, fallback: T): T {
	try {
		return JSON.parse(json);
	} catch {
		return fallback;
	}
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Get nested object property by dot notation path
 * Example: get({ user: { name: 'John' } }, 'user.name') => 'John'
 */
export function getNestedProperty(obj: any, path: string): any {
	return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

/**
 * Set nested object property by dot notation path
 * Example: set({}, 'user.name', 'John') => { user: { name: 'John' } }
 */
export function setNestedProperty(obj: any, path: string, value: any): void {
	const parts = path.split('.');
	const last = parts.pop()!;
	const target = parts.reduce((current, prop) => {
		if (!current[prop]) current[prop] = {};
		return current[prop];
	}, obj);
	target[last] = value;
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Chunk array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
	return [...new Set(array)];
}

/**
 * Group array items by key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
	return array.reduce(
		(groups, item) => {
			const key = keyFn(item);
			if (!groups[key]) groups[key] = [];
			groups[key].push(item);
			return groups;
		},
		{} as Record<string, T[]>
	);
}

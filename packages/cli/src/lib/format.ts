/**
 * Format Utilities
 *
 * Shared formatting functions for the CLI.
 * DRY Fix: Consolidated from marketplace/info.ts, workflow/install.ts, ai/estimate.ts, ai/models.ts
 */

/**
 * Price type from workflow details
 */
export interface WorkflowPrice {
	type: 'free' | 'paid' | 'usage';
	amount?: number;
	currency?: string;
}

/**
 * Format price for display
 *
 * @param price - Price object from workflow details
 * @returns Formatted price string
 *
 * @example
 * ```typescript
 * formatPrice({ type: 'free' }); // 'Free'
 * formatPrice({ type: 'paid', amount: 9.99, currency: 'USD' }); // '$9.99/mo'
 * formatPrice({ type: 'usage' }); // 'Usage-based pricing'
 * ```
 */
export function formatPrice(price: WorkflowPrice): string {
	switch (price.type) {
		case 'free':
			return 'Free';
		case 'paid':
			return `$${price.amount}/${price.currency === 'USD' ? 'mo' : price.currency}`;
		case 'usage':
			return 'Usage-based pricing';
		default:
			return 'Unknown';
	}
}

/**
 * Pad string to the right
 *
 * @param str - String to pad
 * @param length - Target length
 * @returns Padded string
 *
 * @example
 * ```typescript
 * padRight('hello', 10); // 'hello     '
 * ```
 */
export function padRight(str: string, length: number): string {
	return str.padEnd(length);
}

/**
 * Pad string to the left
 *
 * @param str - String to pad
 * @param length - Target length
 * @returns Padded string
 */
export function padLeft(str: string, length: number): string {
	return str.padStart(length);
}

/**
 * Truncate string with ellipsis
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - 3) + '...';
}

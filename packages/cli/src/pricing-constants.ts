/**
 * WORKWAY Pricing Constants for CLI
 *
 * IMPORTANT: This file mirrors workway-platform/apps/api/src/lib/pricing-constants.ts
 * When updating pricing, both files should be updated together.
 *
 * All prices are in CENTS.
 */

// ============================================================================
// DEFAULT PRICING TIERS
// ============================================================================

/**
 * Default per-execution rates (in cents)
 */
export const DEFAULT_PRICING = {
	// Public marketplace defaults
	light: 5, // 5¢ - Simple syncs, notifications, single API calls
	heavy: 25, // 25¢ - AI-powered, multi-step, complex processing

	// Trial configuration
	freeTrialRuns: 20,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ComplexityTier = 'light' | 'heavy';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get price per execution for a complexity tier
 *
 * @param tier - 'light' or 'heavy'
 * @returns Price in cents
 */
export function getPriceForTier(tier: ComplexityTier): number {
	return DEFAULT_PRICING[tier];
}

/**
 * Format cents to display string
 *
 * @param cents - Price in cents
 * @returns Formatted string (e.g., "5¢", "$1.00")
 */
export function formatCents(cents: number): string {
	if (cents < 100) {
		return `${cents}¢`;
	}
	return `$${(cents / 100).toFixed(2)}`;
}

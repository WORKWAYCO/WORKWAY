/**
 * WORKWAY Pricing Constants for CLI
 *
 * IMPORTANT: This file mirrors workway-platform/apps/api/src/lib/pricing-constants.ts
 * When updating pricing, both files should be updated together.
 *
 * MODEL: Flat 1¢ per run. No tiers, no complexity levels.
 *
 * All prices are in CENTS.
 */

// ============================================================================
// DEFAULT PRICING
// ============================================================================

/**
 * Default per-execution rate (in cents)
 * Flat 1¢ per run.
 */
export const DEFAULT_PRICING = {
	perRun: 1, // 1¢ per run — flat rate

	// Trial configuration
	freeTrialRuns: 100, // 100 free runs on signup
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get price per execution
 *
 * @returns Price in cents (flat 1¢)
 */
export function getPricePerRun(): number {
	return DEFAULT_PRICING.perRun;
}

/**
 * Format cents to display string
 *
 * @param cents - Price in cents
 * @returns Formatted string (e.g., "1¢", "$1.00")
 */
export function formatCents(cents: number): string {
	if (cents < 100) {
		return `${cents}¢`;
	}
	return `$${(cents / 100).toFixed(2)}`;
}

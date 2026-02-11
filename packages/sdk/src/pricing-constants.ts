/**
 * WORKWAY Pricing Constants
 *
 * Single source of truth for all pricing-related constants across the platform.
 *
 * MODEL: Flat 1¢ per run. No tiers, no complexity levels.
 * WORKWAY sells Cloudflare execution, not LLM inference.
 *
 * Philosophy: Weniger, aber besser (Less, but better)
 * - One price to understand
 * - No scattered magic numbers
 * - Type-safe pricing
 *
 * @example
 * ```typescript
 * import { EXECUTION_PRICING, PRICING_DEFAULTS } from '@workwayco/sdk/pricing-constants';
 *
 * const costPerRun = EXECUTION_PRICING.PER_RUN; // $0.01
 * const freeRuns = PRICING_DEFAULTS.FREE_EXECUTIONS; // 100
 * ```
 */

// =============================================================================
// EXECUTION PRICING
// =============================================================================

/**
 * Per-execution pricing
 *
 * Flat 1¢ per run for all workflow types.
 */
export const EXECUTION_PRICING = {
	/** Standard per-execution price — flat rate for all workflows */
	PER_RUN: 0.01, // $0.01 per execution
} as const;

// =============================================================================
// PRICING DEFAULTS
// =============================================================================

/**
 * Default pricing configuration values
 */
export const PRICING_DEFAULTS = {
	/** Free executions on signup */
	FREE_EXECUTIONS: 100,
} as const;

// =============================================================================
// AI MODEL COSTS (Cloudflare Workers AI)
// =============================================================================

/**
 * Cloudflare Workers AI model costs (per 1M tokens)
 *
 * These are platform costs, not revenue. Used for cost estimation in CLI.
 * Source: https://developers.cloudflare.com/workers-ai/models/
 */
export const AI_MODEL_COSTS = {
	// Text generation (per 1M tokens)
	TEXT: {
		LLAMA_2_7B: 0.005,
		LLAMA_3_8B: 0.01,
		MISTRAL_7B: 0.02,
		PHI_2: 0.005,
		DEEPSEEK_CODER: 0.01,
	},

	// Embeddings (per 1M tokens)
	EMBEDDINGS: {
		BGE_SMALL: 0.001,
		BGE_BASE: 0.002,
		BGE_LARGE: 0.004,
	},

	// Image generation (per image)
	IMAGE: {
		STABLE_DIFFUSION_XL: 0.02,
		DREAMSHAPER: 0.01,
	},

	// Audio (per minute)
	AUDIO: {
		WHISPER: 0.006,
		WHISPER_TINY: 0.002,
	},

	// Translation (per 1M tokens)
	TRANSLATION: {
		M2M100: 0.005,
	},

	// Classification (per 1M requests)
	CLASSIFICATION: {
		DISTILBERT_SST2: 0.001,
		RESNET_50: 0.002,
	},
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Type representing execution pricing
 */
export type ExecutionPrice = (typeof EXECUTION_PRICING)[keyof typeof EXECUTION_PRICING];

/**
 * Helper function to get pricing description
 */
export function getPricingDescription(): string {
	return `1¢ per run — ${PRICING_DEFAULTS.FREE_EXECUTIONS} free runs included`;
}

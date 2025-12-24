/**
 * WORKWAY Pricing Constants
 *
 * Single source of truth for all pricing-related constants across the platform.
 *
 * Philosophy: Weniger, aber besser (Less, but better)
 * - One place to update prices
 * - No scattered magic numbers
 * - Type-safe pricing tiers
 *
 * @example
 * ```typescript
 * import { WORKFLOW_PRICING } from '@workwayco/sdk/pricing-constants';
 *
 * pricing: {
 *   model: 'freemium',
 *   pricePerMonth: WORKFLOW_PRICING.TIER_BASIC,
 *   trialDays: PRICING_DEFAULTS.TRIAL_DAYS,
 * }
 * ```
 */

// =============================================================================
// WORKFLOW PRICING TIERS
// =============================================================================

/**
 * Standard workflow pricing tiers (monthly subscription)
 *
 * These tiers represent market-tested price points for different workflow complexity levels.
 */
export const WORKFLOW_PRICING = {
	/** Free tier - simple, high-volume workflows */
	TIER_FREE: 0,

	/** Basic tier - simple workflows with basic integrations */
	TIER_BASIC: 9,

	/** Standard tier - moderate complexity workflows */
	TIER_STANDARD: 15,

	/** Professional tier - advanced workflows with multiple integrations */
	TIER_PROFESSIONAL: 19,

	/** Premium tier - complex workflows with industry-specific logic */
	TIER_PREMIUM: 29,

	/** Enterprise tier - industry-specific workflows (dental, construction, real estate) */
	TIER_ENTERPRISE_LOW: 39,
	TIER_ENTERPRISE_MID: 49,
	TIER_ENTERPRISE_HIGH: 79,
	TIER_ENTERPRISE_PREMIUM: 99,
} as const;

// =============================================================================
// USAGE-BASED PRICING
// =============================================================================

/**
 * Per-execution pricing for usage-based workflows
 *
 * Used for agentic workflows or AI-heavy executions where per-run costs vary.
 */
export const EXECUTION_PRICING = {
	/** Standard per-execution price for agentic workflows */
	AGENTIC_WORKFLOW: 0.1, // $0.10 per execution

	/** AI-heavy workflow execution */
	AI_WORKFLOW: 0.15, // $0.15 per execution

	/** Simple automation execution */
	SIMPLE_AUTOMATION: 0.05, // $0.05 per execution
} as const;

// =============================================================================
// PRICING DEFAULTS
// =============================================================================

/**
 * Default pricing configuration values
 */
export const PRICING_DEFAULTS = {
	/** Standard trial period (days) */
	TRIAL_DAYS: 14,

	/** Free tier execution limit (per month) */
	FREE_EXECUTIONS: 50,

	/** Freemium execution limit before paid tier kicks in */
	FREEMIUM_EXECUTIONS: 50,
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
 * Type representing a workflow pricing tier
 */
export type WorkflowPricingTier = (typeof WORKFLOW_PRICING)[keyof typeof WORKFLOW_PRICING];

/**
 * Type representing execution pricing
 */
export type ExecutionPrice = (typeof EXECUTION_PRICING)[keyof typeof EXECUTION_PRICING];

/**
 * Helper function to get pricing description
 */
export function getPricingDescription(pricePerMonth: number, trialDays: number = PRICING_DEFAULTS.TRIAL_DAYS): string {
	if (pricePerMonth === WORKFLOW_PRICING.TIER_FREE) {
		return 'Free forever';
	}

	const tier =
		pricePerMonth === WORKFLOW_PRICING.TIER_BASIC
			? 'Basic'
			: pricePerMonth === WORKFLOW_PRICING.TIER_STANDARD
				? 'Standard'
				: pricePerMonth === WORKFLOW_PRICING.TIER_PROFESSIONAL
					? 'Professional'
					: pricePerMonth === WORKFLOW_PRICING.TIER_PREMIUM
						? 'Premium'
						: 'Enterprise';

	return `${tier} tier - $${pricePerMonth}/month after ${trialDays}-day trial`;
}

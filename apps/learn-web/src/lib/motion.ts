/**
 * Motion Constants - Ported from workway-platform's Automotive Framework
 *
 * "Precision parts assembled into motion toward outcomes."
 *
 * GPU-OPTIMIZED: Only animate transform and opacity for 60fps performance.
 * All motion uses GPU-composited properties only.
 *
 * THE COCKPIT PRINCIPLE: Motion should recede into use. The user focuses
 * on the destination, not the vehicle. If you notice the animation,
 * something is wrong.
 *
 * @see workway-platform/apps/web/src/components/motion/constants.ts
 */

// =============================================================================
// PART 1: DURATION (The Timing Belt)
// =============================================================================

/** Duration in milliseconds (source of truth) */
export const DURATION_MS = {
  micro: 150,      // Hover, press, focus - feels instantaneous
  fast: 200,       // Quick transitions - barely perceptible
  standard: 300,   // Content transitions - the sweet spot
  reveal: 400,     // Scroll reveal - smooth entrance
  complex: 500,    // Multi-step - complex but not sluggish
} as const;

/** Duration in seconds (for JS animations) */
export const DURATION = {
  micro: DURATION_MS.micro / 1000,
  fast: DURATION_MS.fast / 1000,
  standard: DURATION_MS.standard / 1000,
  reveal: DURATION_MS.reveal / 1000,
  complex: DURATION_MS.complex / 1000,
} as const;

/** CSS duration strings */
export const DURATION_CSS = {
  micro: `${DURATION_MS.micro}ms`,
  fast: `${DURATION_MS.fast}ms`,
  standard: `${DURATION_MS.standard}ms`,
  reveal: `${DURATION_MS.reveal}ms`,
  complex: `${DURATION_MS.complex}ms`,
} as const;

// =============================================================================
// PART 2: EASING (The Suspension)
// =============================================================================
//
// Like automotive suspension: absorbs motion, settles smoothly.
// All curves end with deceleration - objects come to rest, not stop.

export const EASE = {
  // Standard curve - smooth deceleration (the default)
  // Fast start, gradual slowdown - feels natural
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',

  // Ease out - elements entering view
  // Very fast start, slow finish - draws attention
  out: 'cubic-bezier(0, 0, 0.2, 1)',

  // Ease in - elements leaving view (use sparingly)
  // Slow start, fast finish - accelerates away
  in: 'cubic-bezier(0.4, 0, 1, 1)',

  // Linear - mechanical precision
  // For progress bars, loading states, infrastructure aesthetic
  linear: 'linear',

  // Spring-like - slight overshoot then settle
  // For playful, attention-grabbing elements (use rarely)
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// =============================================================================
// PART 3: SVELTE TRANSITION PARAMS
// =============================================================================
//
// Pre-built parameter objects for Svelte transition directives.
// Usage: <div transition:fly={TRANSITION.reveal}>

export const TRANSITION = {
  /** Micro-interaction: hover, press, focus */
  micro: {
    duration: DURATION_MS.micro,
    easing: EASE.standard,
  },

  /** Fast transition: quick state changes */
  fast: {
    duration: DURATION_MS.fast,
    easing: EASE.standard,
  },

  /** Standard: the default for most animations */
  standard: {
    duration: DURATION_MS.standard,
    easing: EASE.standard,
  },

  /** Reveal: scroll reveal, content appearing */
  reveal: {
    duration: DURATION_MS.reveal,
    easing: EASE.out,
  },

  /** Complex: multi-step or layout changes */
  complex: {
    duration: DURATION_MS.complex,
    easing: EASE.standard,
  },
} as const;

// =============================================================================
// PART 4: STAGGER DELAYS
// =============================================================================
//
// Cascading delays for list items. Use sparingly - max 5-6 items.
// Beyond that, stagger becomes invisible (perception limit).

export const STAGGER = {
  fast: 50,       // 50ms - quick cascade
  standard: 100,  // 100ms - noticeable sequence
  slow: 150,      // 150ms - dramatic reveal (rare)
} as const;

/**
 * Calculate stagger delay for a given index
 * @param index - Item index in the list (0-based)
 * @param speed - Stagger speed ('fast' | 'standard' | 'slow')
 * @returns Delay in milliseconds
 */
export function getStaggerDelay(
  index: number,
  speed: keyof typeof STAGGER = 'standard'
): number {
  return index * STAGGER[speed];
}

// =============================================================================
// PART 5: CSS CUSTOM PROPERTY HELPERS
// =============================================================================
//
// For inline styles and dynamic CSS

export const CSS_VARS = {
  /** Standard transition for most elements */
  transition: `all ${DURATION_CSS.standard} ${EASE.standard}`,

  /** Micro transition for hover states */
  transitionMicro: `all ${DURATION_CSS.micro} ${EASE.standard}`,

  /** Reveal transition for appearing elements */
  transitionReveal: `all ${DURATION_CSS.reveal} ${EASE.out}`,

  /** Transform-only transition (GPU-optimized) */
  transitionTransform: `transform ${DURATION_CSS.standard} ${EASE.standard}`,

  /** Opacity-only transition (GPU-optimized) */
  transitionOpacity: `opacity ${DURATION_CSS.micro} ${EASE.standard}`,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type DurationKey = keyof typeof DURATION_MS;
export type EaseKey = keyof typeof EASE;
export type TransitionPreset = keyof typeof TRANSITION;
export type StaggerSpeed = keyof typeof STAGGER;

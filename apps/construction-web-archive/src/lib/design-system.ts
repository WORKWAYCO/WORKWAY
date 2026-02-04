/**
 * WORKWAY Construction Design System
 * Ported from workway-platform brand-design-system.ts
 * 
 * Monochromatic with emerald accent (restrained usage)
 */

// ============================================================================
// Colors - Pure Black & White with Opacity Modifiers
// ============================================================================

export const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  // Accent - Emerald (use sparingly: primary CTA, step numbers, logo only)
  accent: '#34d399',
  accentMuted: 'rgba(52, 211, 153, 0.15)',
  accentSubtle: 'rgba(52, 211, 153, 0.08)',
} as const;

// Opacity utilities
export const whiteWithOpacity = (opacity: number) => `rgba(255, 255, 255, ${opacity})`;
export const blackWithOpacity = (opacity: number) => `rgba(0, 0, 0, ${opacity})`;

export const OPACITY = {
  primary: 1.0,
  secondary: 0.8,
  tertiary: 0.6,
  quaternary: 0.4,
  muted: 0.2,
} as const;

// ============================================================================
// Glass Design System - Enterprise Subtle
// ============================================================================

export const GLASS = {
  blur: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    precision: '24px',
  },
  saturate: {
    sm: 'saturate(100%)',
    md: 'saturate(105%)',
    lg: 'saturate(110%)',
    xl: 'saturate(115%)',
  },
  background: {
    subtle: 'rgba(0, 0, 0, 0.65)',
    light: 'rgba(0, 0, 0, 0.72)',
    medium: 'rgba(0, 0, 0, 0.78)',
    strong: 'rgba(0, 0, 0, 0.85)',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    light: 'rgba(255, 255, 255, 0.10)',
    medium: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.22)',
  },
  shadow: {
    sm: '0 4px 24px rgba(0, 0, 0, 0.4)',
    md: '0 8px 40px rgba(0, 0, 0, 0.5)',
    lg: '0 16px 64px rgba(0, 0, 0, 0.6)',
  },
} as const;

// ============================================================================
// Liquid Glass - Apple-style Refraction Effect
// ============================================================================

export const LIQUID_GLASS = {
  // SVG displacement scale for refraction
  refraction: {
    subtle: 4,
    medium: 8,
    strong: 14,
  },
  // Light reflection gradients
  highlight: {
    primary: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 30%, transparent 60%)',
    subtle: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 70%)',
    strong: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 25%, transparent 55%)',
  },
  edgeGlow: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
  innerShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
} as const;

// ============================================================================
// Animation - GPU-optimized presets
// ============================================================================

export const DURATION = {
  micro: 150,    // Hover, press, focus
  fast: 200,     // Quick transitions
  standard: 300, // Content transitions
  reveal: 400,   // Scroll reveal
  complex: 500,  // Multi-step
} as const;

export const EASE = {
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// Stagger delays for cascading animations
export const STAGGER = {
  fast: 50,      // 50ms
  standard: 100, // 100ms
  slow: 150,     // 150ms
} as const;

// ============================================================================
// Spacing - Golden Ratio Scale
// ============================================================================

export const SPACING = {
  xs: '0.5rem',   // 8px
  sm: '1rem',     // 16px
  md: '1.618rem', // ~26px (φ¹)
  lg: '2.618rem', // ~42px (φ²)
  xl: '4.236rem', // ~68px (φ³)
  '2xl': '6.854rem', // ~110px (φ⁴)
} as const;

// Section padding for layout
export const SECTION_PADDING = {
  sm: '4rem',  // 64px
  default: '6rem', // 96px
  lg: '8rem', // 128px
} as const;

// ============================================================================
// Border Radius
// ============================================================================

export const RADIUS = {
  none: '0px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// ============================================================================
// Typography
// ============================================================================

export const TYPOGRAPHY = {
  h1: {
    fontSize: 'clamp(3rem, 5vw, 4.5rem)',
    letterSpacing: '-0.025em',
    lineHeight: 1.1,
  },
  h2: {
    fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  h3: {
    fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
  },
  body: {
    fontSize: 'clamp(0.9375rem, 1vw, 1.0625rem)',
    letterSpacing: '-0.01em',
    lineHeight: 1.6,
  },
  small: {
    fontSize: '0.875rem',
    letterSpacing: '-0.005em',
    lineHeight: 1.5,
  },
} as const;

<script lang="ts">
  /**
   * LiquidGlass Component
   * Apple-style "Liquid Glass" effect with refraction/lensing
   * 
   * Unlike standard frosted glass (blur only), Liquid Glass:
   * 1. Refracts/warps background content via SVG displacement filter
   * 2. Adds highlight layers simulating light reflection
   * 3. Creates depth with inner shadows and illumination
   */
  import type { Snippet } from 'svelte';
  import { GLASS, LIQUID_GLASS, RADIUS } from '$lib/design-system';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Refraction intensity */
    intensity?: 'subtle' | 'medium' | 'strong';
    /** Show highlight reflection */
    highlight?: boolean;
    /** Border radius */
    borderRadius?: keyof typeof RADIUS;
    /** Aspect ratio */
    aspectRatio?: 'video' | 'square' | 'auto';
    /** Custom padding */
    padding?: string;
    /** Additional classes */
    class?: string;
    children?: Snippet;
  }

  let {
    intensity = 'medium',
    highlight = true,
    borderRadius = 'lg',
    aspectRatio = 'auto',
    padding = '2rem',
    class: className = '',
    children,
  }: Props = $props();

  // Generate unique ID for SVG filter
  const filterId = `liquid-glass-${Math.random().toString(36).slice(2, 9)}`;
  const scale = LIQUID_GLASS.refraction[intensity];
  const radius = RADIUS[borderRadius];
</script>

<div
  class={cn('relative overflow-hidden', className)}
  style:border-radius={radius}
  style:aspect-ratio={aspectRatio === 'video' ? '16 / 9' : aspectRatio === 'square' ? '1 / 1' : 'auto'}
>
  <!-- SVG Filter Definition -->
  <svg class="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
    <defs>
      <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015"
          numOctaves="2"
          seed="42"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>

  <!-- Background layer with refraction -->
  <div
    class="absolute inset-0"
    style:backdrop-filter="blur({GLASS.blur.lg}) {GLASS.saturate.lg}"
    style:-webkit-backdrop-filter="blur({GLASS.blur.lg}) {GLASS.saturate.lg}"
    style:filter="url(#{filterId})"
    style:background-color={GLASS.background.light}
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Glass border -->
  <div
    class="absolute inset-0 pointer-events-none"
    style:border="1px solid {GLASS.border.medium}"
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Highlight layer (top-left light reflection) -->
  {#if highlight}
    <div
      class="absolute inset-0 pointer-events-none"
      style:background={LIQUID_GLASS.highlight.primary}
      style:border-radius={radius}
      aria-hidden="true"
    />

    <!-- Top edge glow -->
    <div
      class="absolute top-0 left-0 right-0 h-px pointer-events-none"
      style:background={LIQUID_GLASS.edgeGlow}
      style:border-radius="{radius} {radius} 0 0"
      aria-hidden="true"
    />
  {/if}

  <!-- Inner shadow for depth -->
  <div
    class="absolute inset-0 pointer-events-none"
    style:box-shadow={LIQUID_GLASS.innerShadow}
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Content -->
  <div
    class="relative h-full flex items-center justify-center"
    style:padding={padding}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

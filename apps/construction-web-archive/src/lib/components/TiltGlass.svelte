<script lang="ts">
  /**
   * TiltGlass Component
   * 3D tilt effect with mouse-following glare
   * 
   * Card tilts towards pointer, glare follows mouse position.
   * Uses GPU-optimized transform properties only.
   */
  import type { Snippet } from 'svelte';
  import { GLASS, LIQUID_GLASS, RADIUS, DURATION, EASE } from '$lib/design-system';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Maximum tilt angle in degrees */
    maxTilt?: number;
    /** Glare opacity (0-1) */
    glareOpacity?: number;
    /** Scale on hover */
    hoverScale?: number;
    /** Refraction intensity */
    intensity?: 'subtle' | 'medium' | 'strong';
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
    maxTilt = 8,
    glareOpacity = 0.15,
    hoverScale = 1.02,
    intensity = 'medium',
    borderRadius = 'lg',
    aspectRatio = 'auto',
    padding = '2rem',
    class: className = '',
    children,
  }: Props = $props();

  let containerEl: HTMLDivElement;
  let isHovered = $state(false);
  let transform = $state('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  let glareX = $state(50);
  let glareY = $state(50);

  const filterId = `tilt-glass-${Math.random().toString(36).slice(2, 9)}`;
  const scale = LIQUID_GLASS.refraction[intensity];
  const radius = RADIUS[borderRadius];

  function handleMouseMove(e: MouseEvent) {
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation (inverted so card tilts towards pointer)
    const rotateY = ((x - centerX) / centerX) * maxTilt;
    const rotateX = ((centerY - y) / centerY) * maxTilt;

    transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${hoverScale})`;

    // Calculate glare position (percentage)
    glareX = (x / rect.width) * 100;
    glareY = (y / rect.height) * 100;
  }

  function handleMouseEnter() {
    isHovered = true;
  }

  function handleMouseLeave() {
    isHovered = false;
    transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    glareX = 50;
    glareY = 50;
  }
</script>

<div
  bind:this={containerEl}
  class={cn('relative overflow-hidden', className)}
  style:border-radius={radius}
  style:aspect-ratio={aspectRatio === 'video' ? '16 / 9' : aspectRatio === 'square' ? '1 / 1' : 'auto'}
  style:transform={transform}
  style:transition={isHovered ? 'transform 0.1s ease-out' : `transform ${DURATION.standard}ms ${EASE.standard}`}
  style:transform-style="preserve-3d"
  style:will-change="transform"
  onmousemove={handleMouseMove}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="presentation"
>
  <!-- SVG Filter -->
  <svg class="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
    <defs>
      <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="42" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>

  <!-- Background with refraction -->
  <div
    class="absolute inset-0"
    style:backdrop-filter="blur({GLASS.blur.lg}) {GLASS.saturate.lg}"
    style:-webkit-backdrop-filter="blur({GLASS.blur.lg}) {GLASS.saturate.lg}"
    style:filter="url(#{filterId})"
    style:background-color={GLASS.background.light}
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Border -->
  <div
    class="absolute inset-0 pointer-events-none"
    style:border="1px solid {GLASS.border.medium}"
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Static highlight -->
  <div
    class="absolute inset-0 pointer-events-none"
    style:background={LIQUID_GLASS.highlight.subtle}
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Dynamic glare (follows mouse) -->
  <div
    class="absolute inset-0 pointer-events-none"
    style:background="radial-gradient(circle at {glareX}% {glareY}%, rgba(255, 255, 255, {isHovered ? glareOpacity : 0}) 0%, transparent 60%)"
    style:border-radius={radius}
    style:transition={isHovered ? 'none' : `opacity ${DURATION.standard}ms ${EASE.standard}`}
    aria-hidden="true"
  />

  <!-- Top edge highlight -->
  <div
    class="absolute top-0 left-0 right-0 h-px pointer-events-none"
    style:background={LIQUID_GLASS.edgeGlow}
    style:border-radius="{radius} {radius} 0 0"
    aria-hidden="true"
  />

  <!-- Inner shadow -->
  <div
    class="absolute inset-0 pointer-events-none"
    style:box-shadow={LIQUID_GLASS.innerShadow}
    style:border-radius={radius}
    aria-hidden="true"
  />

  <!-- Content -->
  <div class="relative h-full flex items-center justify-center" style:padding={padding}>
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

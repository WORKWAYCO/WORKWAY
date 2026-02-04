<script lang="ts">
  /**
   * OutcomeSection - Standardized section wrapper
   * 
   * Consistent padding, max-width, and optional scroll reveal.
   * "The wrapper recedes; the content remains." - Zuhandenheit
   */
  import type { Snippet } from 'svelte';
  import { OPACITY, SECTION_PADDING } from '$lib/design-system';
  import ScrollReveal from './ScrollReveal.svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Section label (e.g., "The problem", "How it works") */
    label?: string;
    /** Hero section styling */
    isHero?: boolean;
    /** Center content */
    centered?: boolean;
    /** Disable scroll animation */
    noAnimation?: boolean;
    /** Padding size */
    padding?: 'sm' | 'default' | 'lg';
    /** Additional classes */
    class?: string;
    children?: Snippet;
  }

  let {
    label,
    isHero = false,
    centered = false,
    noAnimation = false,
    padding = 'default',
    class: className = '',
    children,
  }: Props = $props();

  const paddingValue = SECTION_PADDING[padding];
</script>

<section
  class={cn(
    'px-6',
    isHero && 'min-h-[70vh] flex items-center',
    className
  )}
  style:padding-top={paddingValue}
  style:padding-bottom={paddingValue}
>
  <div class={cn('max-w-4xl mx-auto w-full', centered && 'text-center')}>
    {#if noAnimation || isHero}
      <!-- No scroll animation for hero sections -->
      {#if label}
        <p class="text-sm font-mono mb-6" style:opacity={OPACITY.tertiary}>
          {label}
        </p>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    {:else}
      <ScrollReveal>
        {#if label}
          <p class="text-sm font-mono mb-6" style:opacity={OPACITY.tertiary}>
            {label}
          </p>
        {/if}
        {#if children}
          {@render children()}
        {/if}
      </ScrollReveal>
    {/if}
  </div>
</section>

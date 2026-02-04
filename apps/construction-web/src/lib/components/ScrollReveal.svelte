<script lang="ts">
  /**
   * ScrollReveal - Lightweight scroll-triggered reveal
   * 
   * Uses IntersectionObserver for simple reveals.
   * GPU-optimized: only animates opacity and transform.
   */
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { DURATION, EASE } from '$lib/design-system';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Delay before animation (ms) */
    delay?: number;
    /** Viewport threshold (0-1) */
    threshold?: number;
    /** Root margin for trigger timing */
    rootMargin?: string;
    /** Disable animation */
    disabled?: boolean;
    /** Animation direction */
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    /** Additional classes */
    class?: string;
    children?: Snippet;
  }

  let {
    delay = 0,
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    disabled = false,
    direction = 'up',
    class: className = '',
    children,
  }: Props = $props();

  let element: HTMLDivElement;
  let isVisible = $state(disabled);

  // Initial transform based on direction
  const transforms = {
    up: 'translateY(16px)',
    down: 'translateY(-16px)',
    left: 'translateX(16px)',
    right: 'translateX(-16px)',
    none: 'none',
  };

  onMount(() => {
    if (disabled) {
      isVisible = true;
      return;
    }

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      isVisible = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => (isVisible = true), delay);
          } else {
            isVisible = true;
          }
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  });
</script>

<div
  bind:this={element}
  class={cn(className)}
  style:opacity={isVisible ? 1 : 0}
  style:transform={isVisible ? 'none' : transforms[direction]}
  style:transition="opacity {DURATION.reveal}ms {EASE.out}, transform {DURATION.reveal}ms {EASE.out}"
  style:will-change={isVisible ? 'auto' : 'opacity, transform'}
>
  {#if children}
    {@render children()}
  {/if}
</div>

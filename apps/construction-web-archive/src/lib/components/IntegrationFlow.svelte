<script lang="ts">
  /**
   * IntegrationFlow - Icon flow with animated connectors
   * 
   * Visualizes the "automation layer" between integrations.
   * Animated particles flow along connector paths.
   */
  import type { Snippet } from 'svelte';
  import LiquidGlass from './LiquidGlass.svelte';
  import { GLASS, RADIUS, DURATION, EASE } from '$lib/design-system';
  import { cn } from '$lib/utils/cn';

  interface Integration {
    label: string;
    icon?: Snippet;
  }

  interface Props {
    /** Array of integrations */
    integrations: Integration[];
    /** Description text */
    description: string;
    /** Show connector lines */
    showConnectors?: boolean;
    /** Animate particles */
    animateFlow?: boolean;
    /** Glass intensity */
    intensity?: 'subtle' | 'medium' | 'strong';
    /** Additional classes */
    class?: string;
  }

  let {
    integrations,
    description,
    showConnectors = false,
    animateFlow = false,
    intensity = 'medium',
    class: className = '',
  }: Props = $props();

  const connectorId = `connector-${Math.random().toString(36).slice(2, 9)}`;
</script>

<LiquidGlass aspectRatio="video" {intensity} class={className}>
  <div class="text-center">
    <!-- Integration icons row -->
    <div class="flex justify-center items-center mb-4" style:gap={showConnectors ? '0.25rem' : '1rem'}>
      {#each integrations as integration, index}
        <div class="flex items-center" style:gap="0.25rem">
          <!-- Icon container (monochrome, not emerald) -->
          <div
            class="w-12 h-12 flex items-center justify-center text-white font-medium text-sm"
            style:background-color="rgba(255, 255, 255, 0.06)"
            style:border="1px solid rgba(255, 255, 255, 0.15)"
            style:border-radius={RADIUS.md}
            style:backdrop-filter="blur(8px)"
            style:box-shadow="0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          >
            {#if integration.icon}
              {@render integration.icon()}
            {:else}
              {integration.label}
            {/if}
          </div>

          <!-- Connector (not after last item) -->
          {#if showConnectors && index < integrations.length - 1}
            <svg width="40" height="24" viewBox="0 0 40 24" class="flex-shrink-0" aria-hidden="true">
              <defs>
                <linearGradient id="{connectorId}-{index}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="rgba(255, 255, 255, 0.1)" />
                  <stop offset="50%" stop-color="rgba(255, 255, 255, 0.5)" />
                  <stop offset="100%" stop-color="rgba(255, 255, 255, 0.1)" />
                </linearGradient>
                <filter id="{connectorId}-glow-{index}" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <!-- Connector line -->
              <path
                d="M 0 12 L 40 12"
                fill="none"
                stroke="url(#{connectorId}-{index})"
                stroke-width="1.5"
                stroke-linecap="round"
                filter="url(#{connectorId}-glow-{index})"
              />
              <!-- Animated particle -->
              {#if animateFlow}
                <circle r="1.5" fill="white" opacity="0.8">
                  <animateMotion dur="{1.5 + index * 0.2}s" repeatCount="indefinite" path="M 0 12 L 40 12" />
                  <animate attributeName="opacity" values="0;0.8;0.8;0" dur="{1.5 + index * 0.2}s" repeatCount="indefinite" />
                </circle>
              {/if}
            </svg>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Description -->
    <p class="m-0 text-sm" style:color="rgba(255, 255, 255, 0.4)">
      {description}
    </p>
  </div>
</LiquidGlass>

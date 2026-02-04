<script lang="ts">
  /**
   * TextReveal - CSS-based text reveal animations
   * 
   * Styles:
   * - decode: Random characters resolve to meaning
   * - typewriter: Character-by-character with cursor
   * - fade: Simple opacity fade with slide
   */
  import { onMount } from 'svelte';
  import { DURATION, EASE } from '$lib/design-system';

  const DECODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

  interface Props {
    /** Text to reveal */
    text: string;
    /** Reveal style */
    style?: 'decode' | 'typewriter' | 'fade';
    /** Duration in ms */
    duration?: number;
    /** Delay before starting in ms */
    delay?: number;
    /** Trigger animation */
    trigger?: boolean;
    /** Use monospace font */
    mono?: boolean;
    /** Additional classes */
    class?: string;
  }

  let {
    text,
    style = 'fade',
    duration = 1000,
    delay = 0,
    trigger = true,
    mono,
    class: className = '',
  }: Props = $props();

  let displayText = $state('');
  let isRevealed = $state(false);
  let cursorVisible = $state(true);

  const useMono = mono ?? (style === 'decode' || style === 'typewriter');

  onMount(() => {
    if (!trigger) return;

    if (style === 'fade') {
      displayText = text;
      setTimeout(() => (isRevealed = true), delay);
      return;
    }

    if (style === 'decode') {
      const chars = text.split('');
      const resolved = new Array(chars.length).fill(false);
      let currentDisplay = chars.map((c) =>
        c === ' ' ? ' ' : DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)]
      );

      setTimeout(() => {
        const totalSteps = chars.length;
        const stepDuration = duration / totalSteps;
        let step = 0;

        const interval = setInterval(() => {
          if (step < totalSteps) {
            resolved[step] = true;
            step++;
          }

          currentDisplay = chars.map((c, i) => {
            if (c === ' ') return ' ';
            if (resolved[i]) return c;
            return DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];
          });

          displayText = currentDisplay.join('');

          if (step >= totalSteps) {
            clearInterval(interval);
            displayText = text;
            isRevealed = true;
          }
        }, stepDuration);
      }, delay);
      return;
    }

    if (style === 'typewriter') {
      let charIndex = 0;

      const cursorInterval = setInterval(() => {
        cursorVisible = !cursorVisible;
      }, 530);

      setTimeout(() => {
        const charDuration = duration / text.length;

        const interval = setInterval(() => {
          charIndex++;
          displayText = text.slice(0, charIndex);

          if (charIndex >= text.length) {
            clearInterval(interval);
            clearInterval(cursorInterval);
            isRevealed = true;
          }
        }, charDuration);
      }, delay);
    }
  });
</script>

{#if style === 'fade'}
  <span
    class="{className} {useMono ? 'font-mono' : ''} inline-block"
    style:opacity={isRevealed ? 1 : 0}
    style:transform={isRevealed ? 'translateY(0)' : 'translateY(8px)'}
    style:transition="opacity {duration}ms {EASE.standard}, transform {duration}ms {EASE.standard}"
  >
    {displayText}
  </span>
{:else if style === 'typewriter'}
  <span class="{className} {useMono ? 'font-mono' : ''}">
    {displayText}
    <span
      class="inline-block w-[2px] h-[1.1em] bg-current ml-[2px] align-middle"
      style:opacity={!isRevealed && cursorVisible ? 1 : 0}
      style:transition="opacity 0.1s"
    />
  </span>
{:else}
  <span class="{className} font-mono tracking-wide">
    {displayText || text.split('').map((c) => (c === ' ' ? ' ' : '█')).join('')}
  </span>
{/if}

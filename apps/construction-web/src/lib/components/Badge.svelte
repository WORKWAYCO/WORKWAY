<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils/cn';

  interface Props {
    variant?: 'default' | 'accent' | 'blue';
    class?: string;
    children?: Snippet;
  }

  let {
    variant = 'default',
    class: className = '',
    children,
    ...restProps
  }: Props = $props();
</script>

<span
  class={cn(
    'inline-block px-3 py-1.5 text-xs font-medium rounded-full',
    {
      'bg-white/5 border border-white/10 text-fg-secondary':
        variant === 'default',
      'bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399]':
        variant === 'accent',
      'bg-[#60a5fa]/10 border border-[#60a5fa]/30 text-[#60a5fa]':
        variant === 'blue',
    },
    className
  )}
  {...restProps}
>
  {#if children}
    {@render children()}
  {/if}
</span>

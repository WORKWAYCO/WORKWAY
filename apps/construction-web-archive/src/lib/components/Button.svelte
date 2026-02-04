<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils/cn';

  interface Props {
    href?: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    icon?: any;
    class?: string;
    children?: Snippet;
  }

  let {
    href,
    variant = 'secondary',
    icon: Icon,
    class: className = '',
    children,
    ...restProps
  }: Props = $props();
</script>

{#if href}
  <a
    href={href}
    class={cn(
      'inline-flex items-center justify-center gap-2 px-6 py-3 font-medium rounded-lg transition-all duration-200 ease-standard text-decoration-none cursor-pointer',
      {
        'bg-[#34d399] text-black border-none hover:opacity-90 hover:-translate-y-0.5':
          variant === 'primary',
        'bg-white/5 text-fg-primary border border-white/10 hover:bg-white/10 hover:border-white/20':
          variant === 'secondary',
        'bg-transparent text-fg-muted border-none hover:text-fg-primary':
          variant === 'ghost',
      },
      className
    )}
    {...restProps}
  >
    {#if Icon}
      <Icon class="w-5 h-5" />
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    class={cn(
      'inline-flex items-center justify-center gap-2 px-6 py-3 font-medium rounded-lg transition-all duration-200 ease-standard cursor-pointer',
      {
        'bg-[#34d399] text-black border-none hover:opacity-90 hover:-translate-y-0.5':
          variant === 'primary',
        'bg-white/5 text-fg-primary border border-white/10 hover:bg-white/10 hover:border-white/20':
          variant === 'secondary',
        'bg-transparent text-fg-muted border-none hover:text-fg-primary':
          variant === 'ghost',
      },
      className
    )}
    {...restProps}
  >
    {#if Icon}
      <Icon class="w-5 h-5" />
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}

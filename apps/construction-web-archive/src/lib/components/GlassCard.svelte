<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils/cn';

  interface Props {
    icon?: any;
    class?: string;
    children?: Snippet;
  }

  let {
    icon: Icon,
    class: className = '',
    children,
    ...restProps
  }: Props = $props();
</script>

<div
  class={cn(
    'group bg-black/60 backdrop-blur-[48px] backdrop-saturate-[130%] border border-white/10 rounded-lg transition-all duration-200 ease-standard hover:-translate-y-0.5 hover:border-white/20 hover:bg-black/72 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]',
    className
  )}
  {...restProps}
>
  {#if Icon}
    <div class="w-10 h-10 flex items-center justify-center rounded-md bg-white/6 border border-white/10 text-fg-tertiary transition-all duration-150 ease-standard group-hover:bg-white/10 group-hover:border-white/20 mb-4">
      <Icon class="w-5 h-5 text-white/60" />
    </div>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>

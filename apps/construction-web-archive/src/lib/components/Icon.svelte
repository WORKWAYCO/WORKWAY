<script lang="ts">
  import type { Component, ComponentProps } from 'svelte';
  import { cn } from '../utils/cn';

  interface Props {
    icon: Component<ComponentProps<Component>>;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let {
    icon: IconComponent,
    size = 'md',
    class: className = '',
    ...restProps
  }: Props = $props();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
</script>

<IconComponent
  class={cn('text-white/60', sizeClasses[size], className)}
  {...restProps}
/>

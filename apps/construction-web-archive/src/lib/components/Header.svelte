<script lang="ts">
  import Button from './Button.svelte';
  import { Github } from 'lucide-svelte';
  import { cn } from '../utils/cn';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();
</script>

<header
  class={cn(
    'sticky top-0 z-50 bg-black/60 backdrop-blur-[48px] backdrop-saturate-[130%] border-b border-white/10',
    className
  )}
>
  <nav class="max-w-[1200px] mx-auto px-4 md:px-6 flex items-center justify-between h-16">
    <!-- Logo -->
    <a href="/" class="flex items-center gap-1 text-xl font-semibold">
      <span class="text-white">WORK</span>
      <span class="text-[#34d399]">WAY</span>
    </a>

    <!-- Navigation Links -->
    <div class="hidden md:flex items-center gap-6">
      <a
        href="/docs"
        class="text-fg-secondary hover:text-fg-primary transition-colors duration-150"
      >
        Docs
      </a>
      <a
        href="/dashboard"
        class="text-fg-secondary hover:text-fg-primary transition-colors duration-150"
      >
        Dashboard
      </a>
      <a
        href="https://github.com/WORKWAYCO/WORKWAY"
        target="_blank"
        rel="noopener noreferrer"
        class="text-fg-secondary hover:text-fg-primary transition-colors duration-150 flex items-center gap-1"
      >
        <Github class="w-4 h-4" />
        GitHub
      </a>
    </div>

    <!-- Primary CTA -->
    <Button variant="primary" href="/docs">
      Get Started
    </Button>
  </nav>
</header>

<script lang="ts">
  import { cn } from '../utils/cn';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();
</script>

<footer
  class={cn(
    'border-t border-white/10 bg-black/40 backdrop-blur-[48px] backdrop-saturate-[130%]',
    className
  )}
>
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
    <!-- Links Row -->
    <div class="flex flex-wrap items-center justify-between gap-6 mb-6">
      <div class="flex flex-wrap gap-6">
        <a
          href="/docs"
          class="text-fg-secondary hover:text-fg-primary transition-colors duration-150 text-sm"
        >
          Documentation
        </a>
        <a
          href="/dashboard"
          class="text-fg-secondary hover:text-fg-primary transition-colors duration-150 text-sm"
        >
          Dashboard
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-fg-secondary hover:text-fg-primary transition-colors duration-150 text-sm"
        >
          GitHub
        </a>
        <a
          href="/privacy"
          class="text-fg-secondary hover:text-fg-primary transition-colors duration-150 text-sm"
        >
          Privacy
        </a>
        <a
          href="/terms"
          class="text-fg-secondary hover:text-fg-primary transition-colors duration-150 text-sm"
        >
          Terms
        </a>
      </div>
    </div>

    <!-- Copyright -->
    <div class="text-fg-tertiary text-sm">
      © {new Date().getFullYear()} WORKWAY. All rights reserved.
    </div>
  </div>
</footer>

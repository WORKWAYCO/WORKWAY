<script lang="ts">
	interface Props {
		showPricing?: boolean;
	}

	let { showPricing = true }: Props = $props();
</script>

<header class="border-b border-[var(--color-border-default)]">
	<nav class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
		<a href="/" class="brand-arrow text-2xl font-semibold">F→N</a>
		<div class="flex items-center gap-6">
			<a href="/docs" class="text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
				Docs
			</a>
			{#if showPricing}
				<a href="/pricing" class="text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
					Pricing
				</a>
			{/if}
			<a href="/auth/login" class="text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
				Sign in
			</a>
			<a
				href="/auth/signup"
				class="bg-[var(--color-fg-primary)] text-[var(--color-bg-pure)] px-4 py-2 rounded-[var(--radius-md)] font-medium hover:opacity-90 transition-opacity"
			>
				Get started
			</a>
		</div>
	</nav>
</header>

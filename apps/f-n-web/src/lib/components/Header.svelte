<script lang="ts">
	interface Props {
		showPricing?: boolean;
	}

	let { showPricing = true }: Props = $props();
</script>

<header class="border-b border-white/10">
	<nav class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
		<a href="/" class="brand-arrow text-2xl font-semibold">F→N</a>
		<div class="flex items-center gap-6">
			{#if showPricing}
				<a href="/pricing" class="text-white/60 hover:text-white transition-colors">
					Pricing
				</a>
			{/if}
			<a href="/auth/login" class="text-white/60 hover:text-white transition-colors">
				Sign in
			</a>
			<a
				href="/auth/signup"
				class="bg-white text-black px-4 py-2 rounded-md font-medium hover:bg-white/90 transition-colors"
			>
				Get started
			</a>
		</div>
	</nav>
</header>

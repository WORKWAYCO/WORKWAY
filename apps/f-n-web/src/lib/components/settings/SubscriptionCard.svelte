<script lang="ts">
	interface Subscription {
		tier: string;
		sync_count: number;
		current_period_end?: string | null;
	}

	interface Props {
		subscription: Subscription | null;
		upgradeUrl?: string;
	}

	let { subscription, upgradeUrl = '/pricing' }: Props = $props();

	const limits: Record<string, number> = {
		free: 5,
		pro: 100,
		unlimited: Infinity
	};

	const tier = $derived(subscription?.tier || 'free');
	const limit = $derived(limits[tier] ?? 5);
	const syncCount = $derived(subscription?.sync_count || 0);
	const showUpgrade = $derived(tier !== 'unlimited');
</script>

<section class="mb-phi-lg">
	<h2 class="text-lg font-semibold mb-phi-sm">Subscription</h2>
	<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-phi-md bg-[var(--brand-surface-elevated)]">
		<div class="flex items-center justify-between mb-4">
			<div>
				<div class="font-medium capitalize">{tier} Plan</div>
				<div class="text-sm text-[var(--brand-text-muted)]">
					{syncCount} / {limit === Infinity ? '∞' : limit} syncs this month
				</div>
			</div>
			{#if showUpgrade}
				<a
					href={upgradeUrl}
					class="text-sm font-medium hover:underline"
				>
					Upgrade
				</a>
			{/if}
		</div>
		{#if subscription?.current_period_end}
			<div class="text-xs text-[var(--brand-text-muted)]">
				Resets {new Date(subscription.current_period_end).toLocaleDateString()}
			</div>
		{/if}
	</div>
</section>

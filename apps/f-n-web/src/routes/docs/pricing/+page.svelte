<script lang="ts">
	import { DollarSign, Check, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Pricing | F→N Docs</title>
	<meta name="description" content="F→N pricing plans: Free, Pro, and Unlimited. Learn about sync limits and features." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Pricing</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<DollarSign size={28} />
			Pricing
		</h1>
	</div>

	<!-- Plans -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Plans</h2>
		<div class="grid gap-4">
			<!-- Free -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-baseline justify-between mb-3">
					<h3 class="text-lg font-semibold">Free</h3>
					<span class="text-2xl font-bold">$0</span>
				</div>
				<p class="text-[var(--brand-text-muted)] mb-4">5 syncs per month</p>
				<ul class="space-y-2 text-sm">
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Connect Fireflies + Notion</span>
					</li>
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>All transcript data</span>
					</li>
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Sync history</span>
					</li>
				</ul>
			</div>

			<!-- Pro -->
			<div class="border-2 border-[var(--brand-primary)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] relative">
				<div class="absolute -top-3 left-4 px-2 py-0.5 bg-[var(--brand-primary)] text-[var(--brand-bg)] text-xs font-medium rounded">
					Most Popular
				</div>
				<div class="flex items-baseline justify-between mb-3">
					<h3 class="text-lg font-semibold">Pro</h3>
					<div>
						<span class="text-2xl font-bold">$5</span>
						<span class="text-[var(--brand-text-muted)] text-sm">/month</span>
					</div>
				</div>
				<p class="text-[var(--brand-text-muted)] mb-4">100 syncs per month</p>
				<ul class="space-y-2 text-sm">
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Everything in Free</span>
					</li>
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>20x more syncs</span>
					</li>
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Email support</span>
					</li>
				</ul>
			</div>

			<!-- Unlimited -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-baseline justify-between mb-3">
					<h3 class="text-lg font-semibold">Unlimited</h3>
					<div>
						<span class="text-2xl font-bold">$15</span>
						<span class="text-[var(--brand-text-muted)] text-sm">/month</span>
					</div>
				</div>
				<p class="text-[var(--brand-text-muted)] mb-4">No sync limits</p>
				<ul class="space-y-2 text-sm">
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Everything in Pro</span>
					</li>
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Unlimited syncs</span>
					</li>
					<li class="flex items-center gap-2">
						<Check size={14} class="text-[var(--brand-success)]" />
						<span>Priority support</span>
					</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- How Syncs Are Counted -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">How Syncs Are Counted</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<ul class="space-y-3 text-sm">
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span><strong>Each transcript</strong> synced counts as one sync</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>Syncing 10 transcripts at once = 10 syncs</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span><strong>Failed syncs don't count</strong> against your limit</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>Counts <strong>reset monthly</strong> on your billing date</span>
				</li>
			</ul>
		</div>
	</section>

	<!-- Upgrading -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Upgrading</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				You can upgrade anytime from your <a href="/dashboard/settings" class="text-[var(--brand-primary)] hover:underline">Settings</a> page.
			</p>
			<ul class="space-y-2 text-sm">
				<li class="flex items-start gap-3">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span>Upgrades take effect immediately</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span>Prorated billing for mid-cycle upgrades</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span>Downgrade anytime (effective next billing cycle)</span>
				</li>
			</ul>
		</div>
	</section>

	<!-- For Admins -->
	<section>
		<h2 class="text-lg font-semibold mb-4">Complimentary Access (Admins)</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				Half Dozen team members can create <strong>complimentary invitations</strong> for white glove clients. These provide Unlimited tier access at no cost.
			</p>
			<a href="/docs/admin" class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1">
				Learn about admin invitations <ArrowRight size={12} />
			</a>
		</div>
	</section>
</div>

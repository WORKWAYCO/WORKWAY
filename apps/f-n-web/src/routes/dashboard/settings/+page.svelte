<script lang="ts">
	import type { PageData } from './$types';
	import { Mic, BookOpen } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	// Fireflies connect state
	let showFirefliesForm = $state(false);
	let firefliesApiKey = $state('');
	let firefliesConnecting = $state(false);
	let firefliesError = $state<string | null>(null);

	async function connectFireflies() {
		if (!firefliesApiKey.trim()) return;

		firefliesConnecting = true;
		firefliesError = null;

		try {
			const res = await fetch('/api/integrations/fireflies/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: firefliesApiKey.trim() })
			});

			const result = await res.json();

			if (!res.ok) {
				firefliesError = result.error || 'Failed to connect';
				return;
			}

			showFirefliesForm = false;
			firefliesApiKey = '';
			await invalidateAll();
		} catch (e) {
			firefliesError = 'Connection failed';
		} finally {
			firefliesConnecting = false;
		}
	}

	// Subscription limits
	const limits: Record<string, number> = {
		free: 5,
		pro: 100,
		unlimited: Infinity
	};
</script>

<svelte:head>
	<title>Settings — F→N</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="text-2xl font-bold mb-8">Settings</h1>

	<!-- Account Section -->
	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-4">Account</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
			<div class="flex items-center justify-between">
				<div>
					<div class="font-medium">{data.user?.email}</div>
					<div class="text-sm text-[var(--brand-text-muted)]">Signed in</div>
				</div>
				<form method="POST" action="/auth/signout">
					<button
						type="submit"
						class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-error)] transition-colors"
					>
						Sign out
					</button>
				</form>
			</div>
		</div>
	</section>

	<!-- Subscription Section -->
	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-4">Subscription</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
			<div class="flex items-center justify-between mb-4">
				<div>
					<div class="font-medium capitalize">{data.subscription?.tier || 'Free'} Plan</div>
					<div class="text-sm text-[var(--brand-text-muted)]">
						{data.subscription?.sync_count || 0} / {limits[data.subscription?.tier || 'free'] === Infinity ? '∞' : limits[data.subscription?.tier || 'free']} syncs this month
					</div>
				</div>
				{#if data.subscription?.tier !== 'unlimited'}
					<a
						href="/pricing"
						class="text-sm font-medium hover:underline"
					>
						Upgrade
					</a>
				{/if}
			</div>
			{#if data.subscription?.current_period_end}
				<div class="text-xs text-[var(--brand-text-muted)]">
					Resets {new Date(data.subscription.current_period_end).toLocaleDateString()}
				</div>
			{/if}
		</div>
	</section>

	<!-- Connections Section -->
	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-4">Connected Accounts</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<!-- Fireflies -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
							<Mic size={20} />
						</div>
						<div>
							<h3 class="font-semibold">Fireflies</h3>
							<p class="text-sm text-[var(--brand-text-muted)]">
								{data.connections.fireflies ? 'Connected' : 'Not connected'}
							</p>
						</div>
					</div>
					{#if data.connections.fireflies}
						<span class="w-2 h-2 bg-green-500 rounded-full"></span>
					{/if}
				</div>
				{#if !data.connections.fireflies}
					{#if showFirefliesForm}
						<div class="space-y-3">
							{#if firefliesError}
								<div class="text-sm text-[var(--brand-error)]">{firefliesError}</div>
							{/if}
							<input
								type="password"
								bind:value={firefliesApiKey}
								placeholder="Paste your Fireflies API key"
								class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
							/>
							<div class="flex gap-2">
								<button
									onclick={connectFireflies}
									disabled={firefliesConnecting || !firefliesApiKey.trim()}
									class="flex-1 bg-[var(--brand-primary)] text-[var(--brand-bg)] py-2 rounded-[var(--brand-radius)] text-sm font-medium disabled:opacity-50"
								>
									{firefliesConnecting ? 'Connecting...' : 'Connect'}
								</button>
								<button
									onclick={() => { showFirefliesForm = false; firefliesError = null; }}
									class="px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm hover:bg-[var(--brand-surface)] transition-colors"
								>
									Cancel
								</button>
							</div>
							<a
								href="https://app.fireflies.ai/integrations/custom/api"
								target="_blank"
								rel="noopener"
								class="block text-xs text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
							>
								Get your API key →
							</a>
						</div>
					{:else}
						<button
							class="w-full border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm font-medium hover:bg-[var(--brand-surface)] transition-colors"
							onclick={() => { showFirefliesForm = true; }}
						>
							Connect Fireflies
						</button>
					{/if}
				{:else}
					<form method="POST" action="/api/integrations/fireflies/disconnect">
						<button
							type="submit"
							class="w-full text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-error)] transition-colors"
						>
							Disconnect
						</button>
					</form>
				{/if}
			</div>

			<!-- Notion -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-neutral-500/10 rounded-full flex items-center justify-center text-neutral-500">
							<BookOpen size={20} />
						</div>
						<div>
							<h3 class="font-semibold">Notion</h3>
							<p class="text-sm text-[var(--brand-text-muted)]">
								{#if data.connections.notion}
									{data.connections.notionWorkspace || 'Connected'}
								{:else}
									Not connected
								{/if}
							</p>
						</div>
					</div>
					{#if data.connections.notion}
						<span class="w-2 h-2 bg-green-500 rounded-full"></span>
					{/if}
				</div>
				{#if !data.connections.notion}
					<a
						href="/api/integrations/notion/connect"
						class="block w-full border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm font-medium text-center hover:bg-[var(--brand-surface)] transition-colors"
					>
						Connect Notion
					</a>
				{:else}
					<form method="POST" action="/api/integrations/notion/disconnect">
						<button
							type="submit"
							class="w-full text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-error)] transition-colors"
						>
							Disconnect
						</button>
					</form>
				{/if}
			</div>
		</div>
	</section>

	<!-- Danger Zone -->
	<section>
		<h2 class="text-lg font-semibold mb-4 text-[var(--brand-error)]">Danger Zone</h2>
		<div class="border border-[var(--brand-error)]/20 rounded-[var(--brand-radius)] p-6 bg-[var(--brand-error)]/5">
			<div class="flex items-center justify-between">
				<div>
					<div class="font-medium">Delete Account</div>
					<div class="text-sm text-[var(--brand-text-muted)]">Permanently delete your account and all data</div>
				</div>
				<button
					class="text-sm text-[var(--brand-error)] hover:underline"
					onclick={() => { /* TODO: Implement account deletion */ }}
				>
					Delete
				</button>
			</div>
		</div>
	</section>
</div>

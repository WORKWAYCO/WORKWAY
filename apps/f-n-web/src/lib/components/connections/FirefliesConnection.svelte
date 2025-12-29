<script lang="ts">
	import { Mic } from '$lib/icons';
	import ConnectionCard from './ConnectionCard.svelte';

	interface Props {
		connected: boolean;
		onConnect: (apiKey: string) => Promise<void>;
		onDisconnect: () => void;
	}

	let { connected, onConnect, onDisconnect }: Props = $props();

	let showForm = $state(false);
	let apiKey = $state('');
	let connecting = $state(false);
	let error = $state<string | null>(null);

	async function handleConnect() {
		if (!apiKey.trim()) return;

		connecting = true;
		error = null;

		try {
			await onConnect(apiKey.trim());
			showForm = false;
			apiKey = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Connection failed';
		} finally {
			connecting = false;
		}
	}

	function handleCancel() {
		showForm = false;
		error = null;
		apiKey = '';
	}
</script>

<ConnectionCard
	name="Fireflies"
	{connected}
	icon={Mic}
	iconColor="bg-purple-500/10 text-purple-500"
>
	{#if !connected}
		{#if showForm}
			<div class="space-y-3">
				{#if error}
					<div class="text-sm text-[var(--brand-error)]">{error}</div>
				{/if}
				<p class="text-xs text-[var(--brand-text-muted)]">
					Find your API key in Fireflies Settings → Developer Settings
				</p>
				<input
					type="password"
					bind:value={apiKey}
					placeholder="Paste your Fireflies API key"
					class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
				/>
				<div class="flex gap-2">
					<button
						onclick={handleConnect}
						disabled={connecting || !apiKey.trim()}
						class="flex-1 bg-[var(--brand-primary)] text-[var(--brand-bg)] py-2 rounded-[var(--brand-radius)] text-sm font-medium disabled:opacity-50"
					>
						{connecting ? 'Connecting...' : 'Connect'}
					</button>
					<button
						onclick={handleCancel}
						class="px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm hover:bg-[var(--brand-surface)] transition-colors"
					>
						Cancel
					</button>
				</div>
				<a
					href="https://app.fireflies.ai/settings#DeveloperSettings"
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
				onclick={() => { showForm = true; }}
			>
				Connect Fireflies
			</button>
		{/if}
	{:else}
		<button
			onclick={onDisconnect}
			class="w-full text-sm text-[var(--brand-text-muted)] hover:text-red-500 transition-colors"
		>
			Disconnect
		</button>
	{/if}
</ConnectionCard>

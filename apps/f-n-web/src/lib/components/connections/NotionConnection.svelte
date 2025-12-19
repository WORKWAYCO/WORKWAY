<script lang="ts">
	import { BookOpen } from '$lib/icons';
	import ConnectionCard from './ConnectionCard.svelte';

	interface Props {
		connected: boolean;
		workspaceName?: string | null;
		connectUrl: string;
		onDisconnect: () => void;
	}

	let { connected, workspaceName, connectUrl, onDisconnect }: Props = $props();
</script>

<ConnectionCard
	name="Notion"
	{connected}
	{workspaceName}
	icon={BookOpen}
	iconColor="bg-neutral-500/10 text-neutral-500"
>
	{#if !connected}
		<a
			href={connectUrl}
			class="block w-full border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm font-medium text-center hover:bg-[var(--brand-surface)] transition-colors"
		>
			Connect Notion
		</a>
	{:else}
		<button
			onclick={onDisconnect}
			class="w-full text-sm text-[var(--brand-text-muted)] hover:text-red-500 transition-colors"
		>
			Disconnect
		</button>
	{/if}
</ConnectionCard>

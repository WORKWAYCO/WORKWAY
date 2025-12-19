<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		name: string;
		connected: boolean;
		workspaceName?: string | null;
		icon: any; // Lucide icons have complex types, use any for simplicity
		iconColor: string;
		children?: Snippet;
	}

	let { name, connected, workspaceName, icon: Icon, iconColor, children }: Props = $props();
</script>

<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-phi-md bg-[var(--brand-surface-elevated)]">
	<div class="flex items-center justify-between mb-phi-sm">
		<div class="flex items-center gap-phi-xs">
			<div class="w-10 h-10 {iconColor} rounded-full flex items-center justify-center">
				<Icon size={20} />
			</div>
			<div>
				<h3 class="font-semibold">{name}</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					{#if connected}
						{workspaceName || 'Connected'}
					{:else}
						Not connected
					{/if}
				</p>
			</div>
		</div>
		{#if connected}
			<span class="w-2 h-2 bg-green-500 rounded-full"></span>
		{/if}
	</div>

	{#if children}
		{@render children()}
	{/if}
</div>

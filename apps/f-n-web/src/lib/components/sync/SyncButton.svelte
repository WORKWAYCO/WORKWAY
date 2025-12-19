<script lang="ts">
	interface Props {
		selectedCount: number;
		syncing: boolean;
		progress: number;
		total: number;
		disabled?: boolean;
		onSync: () => void;
	}

	let { selectedCount, syncing, progress, total, disabled = false, onSync }: Props = $props();

	const isDisabled = $derived(disabled || syncing || selectedCount === 0);
</script>

<div class="flex items-center justify-between">
	<div class="text-sm text-[var(--brand-text-muted)]">
		{selectedCount} transcript{selectedCount === 1 ? '' : 's'} selected
	</div>
	<button
		onclick={onSync}
		disabled={isDisabled}
		class="bg-[var(--brand-primary)] text-[var(--brand-surface)] px-6 py-2 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
	>
		{syncing ? `Syncing ${progress}/${total}...` : 'Start sync'}
	</button>
</div>

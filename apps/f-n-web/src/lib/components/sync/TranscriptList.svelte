<script lang="ts">
	import { Check } from '$lib/icons';

	interface TranscriptItem {
		id: string;
		title: string;
		date: number | string;
		synced: boolean;
	}

	interface Props {
		transcripts: TranscriptItem[];
		selectedIds: string[];
		onToggle: (id: string) => void;
		onSelectAllUnsynced: () => void;
		loading?: boolean;
		disabled?: boolean;
	}

	let { transcripts, selectedIds, onToggle, onSelectAllUnsynced, loading = false, disabled = false }: Props = $props();

	const hasUnsynced = $derived(transcripts.some(t => !t.synced));
</script>

<div>
	<div class="flex items-center justify-between mb-2">
		<span class="text-sm font-medium">Transcripts</span>
		{#if hasUnsynced && !loading}
			<button
				type="button"
				onclick={onSelectAllUnsynced}
				{disabled}
				class="text-xs text-[var(--brand-accent)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Select all unsynced
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="text-sm text-[var(--brand-text-muted)]">Loading transcripts...</div>
	{:else if transcripts.length === 0}
		<div class="text-sm text-[var(--brand-text-muted)]">No transcripts found</div>
	{:else}
		<div class="max-h-64 overflow-y-auto border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
			{#each transcripts as transcript (transcript.id)}
				<label
					class="flex items-center gap-3 p-3 border-b border-[var(--brand-border)] last:border-b-0 cursor-pointer hover:bg-[var(--brand-surface)] transition-colors"
					class:opacity-50={transcript.synced}
				>
					<input
						type="checkbox"
						checked={selectedIds.includes(transcript.id)}
						onchange={() => onToggle(transcript.id)}
						disabled={transcript.synced || disabled}
						class="rounded"
					/>
					<div class="flex-1 min-w-0">
						<div class="font-medium truncate">{transcript.title}</div>
						<div class="text-xs text-[var(--brand-text-muted)] flex items-center gap-1">
							{new Date(transcript.date).toLocaleDateString()}
							{#if transcript.synced}
								<span class="ml-2 text-[var(--brand-success)] flex items-center gap-1">
									<Check size={16} /> Synced
								</span>
							{/if}
						</div>
					</div>
				</label>
			{/each}
		</div>
	{/if}
</div>

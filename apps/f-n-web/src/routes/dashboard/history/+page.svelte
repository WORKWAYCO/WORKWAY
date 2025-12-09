<script lang="ts">
	import type { PageData } from './$types';
	import { Check, X, Loader2 } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Sync History — F→N</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="text-2xl font-bold mb-8">Sync History</h1>

	{#if data.jobs.length === 0}
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-8 text-center bg-[var(--brand-surface-elevated)]">
			<p class="text-[var(--brand-text-muted)]">No syncs yet. Go to Sync to get started.</p>
		</div>
	{:else}
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)] bg-[var(--brand-surface-elevated)]">
			{#each data.jobs as job}
				<div class="p-4 flex items-center justify-between">
					<div>
						<div class="font-medium">{job.database_name || 'Unknown database'}</div>
						<div class="text-sm text-[var(--brand-text-muted)]">
							{new Date(job.created_at).toLocaleString()} · {job.progress}/{job.total_transcripts} transcripts
						</div>
						{#if job.completed_at}
							<div class="text-xs text-[var(--brand-text-muted)] mt-1">
								Completed {new Date(job.completed_at).toLocaleString()}
							</div>
						{/if}
					</div>
					<span
						class="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 {job.status === 'completed' ? 'bg-[var(--brand-success)]/10 text-[var(--brand-success)]' : job.status === 'failed' ? 'bg-[var(--brand-error)]/10 text-[var(--brand-error)]' : job.status === 'running' ? 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]' : 'bg-neutral-500/10 text-neutral-500'}"
					>
						{#if job.status === 'completed'}
							<Check size={12} />
						{:else if job.status === 'running'}
							<Loader2 size={12} class="animate-spin" />
						{:else if job.status === 'failed'}
							<X size={12} />
						{/if}
						{job.status}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

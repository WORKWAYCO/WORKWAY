<script lang="ts">
	import JobCard from './JobCard.svelte';

	interface Job {
		id?: string;
		database_name: string | null;
		created_at: string;
		completed_at?: string | null;
		progress: number;
		total_transcripts: number;
		status: string;
	}

	interface Props {
		jobs: Job[];
		showCompletedAt?: boolean;
		emptyMessage?: string;
	}

	let { jobs, showCompletedAt = false, emptyMessage = 'No syncs yet.' }: Props = $props();
</script>

{#if jobs.length === 0}
	<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-phi-lg text-center bg-[var(--brand-surface-elevated)]">
		<p class="text-[var(--brand-text-muted)]">{emptyMessage}</p>
	</div>
{:else}
	<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)] bg-[var(--brand-surface-elevated)]">
		{#each jobs as job (job.id || job.created_at)}
			<JobCard {job} {showCompletedAt} />
		{/each}
	</div>
{/if}

<script lang="ts">
	import JobStatusBadge from './JobStatusBadge.svelte';

	type JobStatus = 'completed' | 'failed' | 'running' | 'pending';

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
		job: Job;
		showCompletedAt?: boolean;
	}

	let { job, showCompletedAt = false }: Props = $props();

	// Normalize status to valid JobStatus type
	const normalizedStatus = $derived(
		['completed', 'failed', 'running', 'pending'].includes(job.status)
			? job.status as JobStatus
			: 'pending'
	);
</script>

<div class="p-4 flex items-center justify-between">
	<div>
		<div class="font-medium">{job.database_name || 'Unknown database'}</div>
		<div class="text-sm text-[var(--brand-text-muted)]">
			{new Date(job.created_at).toLocaleString()} · {job.progress}/{job.total_transcripts} transcripts
		</div>
		{#if showCompletedAt && job.completed_at}
			<div class="text-xs text-[var(--brand-text-muted)] mt-1">
				Completed {new Date(job.completed_at).toLocaleString()}
			</div>
		{/if}
	</div>
	<JobStatusBadge status={normalizedStatus} />
</div>

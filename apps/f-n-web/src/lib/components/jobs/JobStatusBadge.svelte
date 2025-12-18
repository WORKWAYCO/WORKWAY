<script lang="ts">
	import { Check, X, Loader2 } from '$lib/icons';

	type JobStatus = 'completed' | 'failed' | 'running' | 'pending';

	interface Props {
		status: JobStatus;
	}

	let { status }: Props = $props();

	const statusStyles: Record<JobStatus, string> = {
		completed: 'bg-[var(--brand-success)]/10 text-[var(--brand-success)]',
		failed: 'bg-[var(--brand-error)]/10 text-[var(--brand-error)]',
		running: 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]',
		pending: 'bg-neutral-500/10 text-neutral-500'
	};
</script>

<span
	class="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 {statusStyles[status] || statusStyles.pending}"
>
	{#if status === 'completed'}
		<Check size={16} />
	{:else if status === 'running'}
		<Loader2 size={16} class="animate-spin" />
	{:else if status === 'failed'}
		<X size={16} />
	{/if}
	{status}
</span>

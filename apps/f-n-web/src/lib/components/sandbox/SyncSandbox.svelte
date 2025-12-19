<script lang="ts">
	import { TranscriptList } from '../sync';
	import { DatabaseSelector } from '../sync';
	import { SyncButton } from '../sync';
	import { SyncProgress } from '../sync';
	import { JobList } from '../jobs';
	import {
		sampleDatabases,
		getInitialTranscripts,
		SYNC_DELAY_PER_ITEM,
		type SampleTranscript
	} from './sandbox-data';

	// Local sandbox state (no API calls)
	let transcripts = $state<SampleTranscript[]>(getInitialTranscripts());
	let selectedIds = $state<string[]>([]);
	let selectedDatabase = $state<string | null>(null);

	// Sync state
	let syncing = $state(false);
	let progress = $state(0);
	let total = $state(0);

	// Job history for demo
	interface DemoJob {
		id: string;
		database_name: string | null;
		created_at: string;
		progress: number;
		total_transcripts: number;
		status: 'completed' | 'running' | 'pending';
	}
	let recentJobs = $state<DemoJob[]>([]);

	function toggleTranscript(id: string) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter(t => t !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	function selectAllUnsynced() {
		selectedIds = transcripts.filter(t => !t.synced).map(t => t.id);
	}

	function onDatabaseSelect(id: string | null) {
		selectedDatabase = id;
	}

	async function startSync() {
		if (!selectedDatabase || selectedIds.length === 0) return;

		syncing = true;
		progress = 0;
		total = selectedIds.length;

		const databaseName = sampleDatabases.find(d => d.id === selectedDatabase)?.title || null;
		const jobId = `demo-job-${Date.now()}`;

		// Add running job to history
		const newJob: DemoJob = {
			id: jobId,
			database_name: databaseName,
			created_at: new Date().toISOString(),
			progress: 0,
			total_transcripts: total,
			status: 'running'
		};
		recentJobs = [newJob, ...recentJobs].slice(0, 3);

		// Simulate sync progress
		for (let i = 0; i < selectedIds.length; i++) {
			await new Promise(resolve => setTimeout(resolve, SYNC_DELAY_PER_ITEM));
			progress = i + 1;

			// Update job progress
			recentJobs = recentJobs.map(j =>
				j.id === jobId ? { ...j, progress: i + 1 } : j
			);
		}

		// Mark transcripts as synced
		transcripts = transcripts.map(t =>
			selectedIds.includes(t.id) ? { ...t, synced: true } : t
		);

		// Complete job
		recentJobs = recentJobs.map(j =>
			j.id === jobId ? { ...j, status: 'completed' as const, progress: total } : j
		);

		// Reset selection
		selectedIds = [];
		syncing = false;
	}

	function resetSandbox() {
		transcripts = getInitialTranscripts();
		selectedIds = [];
		selectedDatabase = null;
		recentJobs = [];
		syncing = false;
		progress = 0;
		total = 0;
	}
</script>

<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface-elevated)] overflow-hidden">
	<!-- Header -->
	<div class="px-phi-md py-phi-sm border-b border-[var(--brand-border)] flex items-center justify-between">
		<span class="text-sm font-medium text-[var(--brand-text-muted)]">Try it yourself</span>
		<button
			onclick={resetSandbox}
			class="text-xs text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
		>
			Reset
		</button>
	</div>

	<!-- Sync Interface -->
	<div class="p-phi-md">
		<div class="grid md:grid-cols-2 gap-phi-md mb-phi-md">
			<!-- Transcripts Column -->
			<div>
				<TranscriptList
					{transcripts}
					{selectedIds}
					onToggle={toggleTranscript}
					onSelectAllUnsynced={selectAllUnsynced}
					disabled={syncing}
				/>
			</div>

			<!-- Database Column -->
			<div>
				<DatabaseSelector
					databases={sampleDatabases}
					{selectedDatabase}
					onSelect={onDatabaseSelect}
					disabled={syncing}
				/>
			</div>
		</div>

		<!-- Sync Button -->
		<SyncButton
			selectedCount={selectedIds.length}
			{syncing}
			{progress}
			{total}
			disabled={!selectedDatabase}
			onSync={startSync}
		/>

		<!-- Progress Bar -->
		<SyncProgress {progress} {total} visible={syncing} />
	</div>

	<!-- Recent Jobs -->
	{#if recentJobs.length > 0}
		<div class="border-t border-[var(--brand-border)] p-phi-md">
			<div class="text-sm font-medium mb-phi-xs text-[var(--brand-text-muted)]">Recent syncs</div>
			<JobList jobs={recentJobs} emptyMessage="" />
		</div>
	{/if}
</div>

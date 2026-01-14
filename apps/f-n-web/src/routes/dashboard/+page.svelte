<script lang="ts">
	import type { PageData } from './$types';
	import { Mic, BookOpen, Check, X, ChevronDown, Loader2 } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { PropertyMappingCard } from '$lib/components/sync';

	interface TranscriptItem {
		id: string;
		title: string;
		date: number;
		synced: boolean;
	}

	interface DatabaseProperty {
		id: string;
		name: string;
		type: string;
	}

	interface DatabaseItem {
		id: string;
		title: string;
		properties: DatabaseProperty[];
	}

	interface PropertyMapping {
		duration?: string;
		participants?: string;
		keywords?: string;
		date?: string;
	}

	interface SyncStatus {
		jobId?: string;
		status?: string;
		progress?: number;
	}

	let { data }: { data: PageData } = $props();

	// Tool recedes when fully connected
	const bothConnected = $derived(data.connections.fireflies && data.connections.notion);

	// Fireflies connect state
	let showFirefliesForm = $state(false);
	let firefliesApiKey = $state('');
	let firefliesConnecting = $state(false);
	let firefliesError = $state<string | null>(null);
	let firefliesErrorHint = $state<string | null>(null);

	async function connectFireflies() {
		if (!firefliesApiKey.trim()) return;

		firefliesConnecting = true;
		firefliesError = null;
		firefliesErrorHint = null;

		try {
			const res = await fetch('/api/integrations/fireflies/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: firefliesApiKey.trim() })
			});

			const result = await res.json() as { error?: string; hint?: string; success?: boolean };

			if (!res.ok) {
				firefliesError = result.error || 'Failed to connect';
				firefliesErrorHint = result.hint || null;
				return;
			}

			// Success - refresh page data
			showFirefliesForm = false;
			firefliesApiKey = '';
			await invalidateAll();
		} catch (e) {
			firefliesError = 'Connection failed';
		} finally {
			firefliesConnecting = false;
		}
	}

	// Sync state
	let syncing = $state(false);
	let progress = $state(0);
	let total = $state(0);
	let selectedTranscripts = $state<string[]>([]);
	let selectedDatabase = $state<string | null>(null);
	let forceResync = $state(false);

	// Data from API
	let transcripts = $state<TranscriptItem[]>([]);
	let databases = $state<DatabaseItem[]>([]);
	let loadingTranscripts = $state(false);
	let loadingDatabases = $state(false);
	
	// Persist database selection in localStorage
	const SELECTED_DB_KEY = 'fn-selected-database';
	
	// Pagination state
	let hasMoreTranscripts = $state(true);
	let loadingMoreTranscripts = $state(false);
	const TRANSCRIPTS_PER_PAGE = 500;
	
	// Error state
	let transcriptError = $state<string | null>(null);
	let transcriptErrorHint = $state<string | null>(null);

	// Property mapping state
	let savedMapping = $state<PropertyMapping | null>(null);
	let loadingMapping = $state(false);

	// Get properties for selected database
	const selectedDatabaseProperties = $derived(
		databases.find((db) => db.id === selectedDatabase)?.properties || []
	);

	// Subscription limits
	const limits: Record<string, number> = {
		free: 5,
		pro: 100,
		unlimited: Infinity
	};

	// Load transcripts when Fireflies is connected
	$effect(() => {
		if (data.connections.fireflies && !transcripts.length) {
			loadTranscripts();
		}
	});

	// Load databases when Notion is connected
	$effect(() => {
		if (data.connections.notion && !databases.length) {
			loadDatabases();
		}
	});
	
	// Restore saved database selection after databases load
	$effect(() => {
		if (databases.length > 0 && !selectedDatabase) {
			const saved = typeof localStorage !== 'undefined' 
				? localStorage.getItem(SELECTED_DB_KEY) 
				: null;
			if (saved && databases.some(db => db.id === saved)) {
				selectedDatabase = saved;
			}
		}
	});
	
	// Save database selection when changed
	$effect(() => {
		if (selectedDatabase && typeof localStorage !== 'undefined') {
			localStorage.setItem(SELECTED_DB_KEY, selectedDatabase);
		}
	});

	// Load saved mapping when database changes
	$effect(() => {
		if (selectedDatabase) {
			loadSavedMapping(selectedDatabase);
		} else {
			savedMapping = null;
		}
	});

	async function loadSavedMapping(databaseId: string) {
		loadingMapping = true;
		try {
			const res = await fetch(`/api/property-mappings?databaseId=${databaseId}`);
			const json = await res.json() as { mapping?: PropertyMapping | null };
			savedMapping = json.mapping || null;
		} catch (e) {
			console.error('Failed to load property mapping:', e);
			savedMapping = null;
		}
		loadingMapping = false;
	}

	function handleMappingSave(mapping: PropertyMapping) {
		savedMapping = mapping;
	}

	async function loadTranscripts() {
		loadingTranscripts = true;
		transcriptError = null;
		transcriptErrorHint = null;
		try {
			const res = await fetch(`/api/transcripts?limit=${TRANSCRIPTS_PER_PAGE}&skip=0`);
			const json = await res.json() as { transcripts?: TranscriptItem[]; error?: string; hint?: string; retryAfter?: string };
			
			if (!res.ok || json.error) {
				transcriptError = json.error || 'Failed to load transcripts';
				transcriptErrorHint = json.hint || null;
				transcripts = [];
				return;
			}
			
			if (json.transcripts) {
				transcripts = json.transcripts;
				hasMoreTranscripts = json.transcripts.length >= TRANSCRIPTS_PER_PAGE;
			}
		} catch (e) {
			console.error('Failed to load transcripts:', e);
			transcriptError = 'Connection error. Please try again.';
		}
		loadingTranscripts = false;
	}

	async function loadMoreTranscripts() {
		if (loadingMoreTranscripts || !hasMoreTranscripts) return;
		
		loadingMoreTranscripts = true;
		try {
			const res = await fetch(`/api/transcripts?limit=${TRANSCRIPTS_PER_PAGE}&skip=${transcripts.length}`);
			const json = await res.json() as { transcripts?: TranscriptItem[] };
			if (json.transcripts) {
				transcripts = [...transcripts, ...json.transcripts];
				hasMoreTranscripts = json.transcripts.length >= TRANSCRIPTS_PER_PAGE;
			}
		} catch (e) {
			console.error('Failed to load more transcripts:', e);
		}
		loadingMoreTranscripts = false;
	}

	async function loadDatabases() {
		loadingDatabases = true;
		try {
			const res = await fetch('/api/notion/databases');
			const json = await res.json() as { databases?: DatabaseItem[] };
			if (json.databases) {
				databases = json.databases;
			}
		} catch (e) {
			console.error('Failed to load databases:', e);
		}
		loadingDatabases = false;
	}

	function toggleTranscript(id: string) {
		if (selectedTranscripts.includes(id)) {
			selectedTranscripts = selectedTranscripts.filter((t) => t !== id);
		} else {
			selectedTranscripts = [...selectedTranscripts, id];
		}
	}

	function selectAllUnsynced() {
		selectedTranscripts = transcripts.filter((t) => !t.synced).map((t) => t.id);
	}

	async function startSync() {
		if (!selectedDatabase || !selectedTranscripts.length) return;

		syncing = true;
		progress = 0;
		total = selectedTranscripts.length;

		try {
			const selectedDb = databases.find((db) => db.id === selectedDatabase);
			const res = await fetch('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					databaseId: selectedDatabase,
					databaseName: selectedDb?.title || 'Unknown',
					transcriptIds: selectedTranscripts,
					forceResync
				})
			});

			const { jobId } = await res.json() as SyncStatus;

			// Poll for progress
			const pollInterval = setInterval(async () => {
				const statusRes = await fetch(`/api/sync?jobId=${jobId}`);
				const status = await statusRes.json() as SyncStatus;

				progress = status.progress || 0;

				if (status.status === 'completed' || status.status === 'failed') {
					clearInterval(pollInterval);
					syncing = false;

					if (status.status === 'completed') {
						// Refresh transcripts to update synced status
						await loadTranscripts();
						selectedTranscripts = [];
					}
				}
			}, 1000);

		} catch (e) {
			console.error('Sync failed:', e);
			syncing = false;
		}
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-8">
		<h1 class="text-2xl font-bold">Sync your meetings</h1>
		<div class="text-sm text-[var(--brand-text-muted)]">
			{data.subscription?.sync_count || 0} / {limits[data.subscription?.tier || 'free'] === Infinity ? '∞' : limits[data.subscription?.tier || 'free']} syncs this month
		</div>
	</div>

	<!-- Success Messages -->
	{#if $page.url.searchParams.get('success') === 'notion_connected'}
		<div class="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-[var(--brand-radius)] text-green-400 text-sm flex items-center gap-2">
			<Check size={16} />
			Notion connected successfully
		</div>
	{/if}

	<!-- Connection Status — only show when setup needed (tool recedes when ready) -->
	{#if !bothConnected}
		<!-- Step Indicator -->
		<div class="mb-6 text-sm text-[var(--brand-text-muted)]">
			{#if !data.connections.fireflies && !data.connections.notion}
				<span class="font-medium text-[var(--brand-text)]">Step 1 of 2:</span> Connect your accounts to start syncing
			{:else if data.connections.fireflies && !data.connections.notion}
				<span class="font-medium text-[var(--brand-text)]">Step 2 of 2:</span> Authorize Notion to complete setup
			{:else if !data.connections.fireflies && data.connections.notion}
				<span class="font-medium text-[var(--brand-text)]">Step 2 of 2:</span> Connect Fireflies to complete setup
			{/if}
		</div>

		<div class="grid md:grid-cols-2 gap-4 mb-8">
			<!-- Fireflies Connection -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
							<Mic size={20} />
						</div>
						<div>
							<h3 class="font-semibold">Fireflies</h3>
							<p class="text-sm text-[var(--brand-text-muted)]">
								{data.connections.fireflies ? 'Connected' : 'Not connected'}
							</p>
						</div>
					</div>
					{#if data.connections.fireflies}
						<span class="w-2 h-2 bg-green-500 rounded-full"></span>
					{/if}
				</div>
				{#if !data.connections.fireflies}
					{#if showFirefliesForm}
						<div class="space-y-3">
							{#if firefliesError}
								<div class="text-sm text-[var(--brand-error)]">
									{firefliesError}
									{#if firefliesErrorHint}
										<p class="text-[var(--brand-text-muted)] mt-1 font-normal">{firefliesErrorHint}</p>
									{/if}
								</div>
							{/if}
							<input
								type="password"
								bind:value={firefliesApiKey}
								placeholder="Paste your Fireflies API key"
								class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
							/>
							<div class="flex gap-2">
								<button
									onclick={connectFireflies}
									disabled={firefliesConnecting || !firefliesApiKey.trim()}
									class="flex-1 bg-[var(--brand-primary)] text-[var(--brand-bg)] py-2 rounded-[var(--brand-radius)] text-sm font-medium disabled:opacity-50"
								>
									{firefliesConnecting ? 'Connecting...' : 'Connect'}
								</button>
								<button
									onclick={() => { showFirefliesForm = false; firefliesError = null; }}
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
							onclick={() => { showFirefliesForm = true; }}
						>
							Connect Fireflies
						</button>
					{/if}
				{:else}
					<form method="POST" action="/api/integrations/fireflies/disconnect">
						<button
							type="submit"
							class="w-full text-sm text-[var(--brand-text-muted)] hover:text-red-500 transition-colors"
						>
							Disconnect
						</button>
					</form>
				{/if}
			</div>

			<!-- Notion Connection -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-neutral-500/10 rounded-full flex items-center justify-center text-neutral-500">
							<BookOpen size={20} />
						</div>
						<div>
							<h3 class="font-semibold">Notion</h3>
							<p class="text-sm text-[var(--brand-text-muted)]">
								{#if data.connections.notion}
									{data.connections.notionWorkspace || 'Connected'}
								{:else}
									Not connected
								{/if}
							</p>
						</div>
					</div>
					{#if data.connections.notion}
						<span class="w-2 h-2 bg-green-500 rounded-full"></span>
					{/if}
				</div>
				{#if !data.connections.notion}
					<a
						href="/api/integrations/notion/connect"
						class="block w-full border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm font-medium text-center hover:bg-[var(--brand-surface)] transition-colors"
					>
						Connect Notion
					</a>
				{:else}
					<form method="POST" action="/api/integrations/notion/disconnect">
						<button
							type="submit"
							class="w-full text-sm text-[var(--brand-text-muted)] hover:text-red-500 transition-colors"
						>
							Disconnect
						</button>
					</form>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Sync Interface -->
	{#if data.connections.fireflies && data.connections.notion}
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
			<!-- Database Selection -->
			<div class="mb-6">
				<label for="database" class="block text-sm font-medium mb-2">Notion Database</label>
				{#if loadingDatabases}
					<div class="text-sm text-[var(--brand-text-muted)]">Loading databases...</div>
				{:else}
					<select
						id="database"
						bind:value={selectedDatabase}
						class="w-full px-4 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)]"
					>
						<option value={null}>Select a database</option>
						{#each databases as db}
							<option value={db.id}>{db.title}</option>
						{/each}
					</select>
				{/if}
			</div>

			<!-- Property Mapping (shows when database selected) -->
			{#if selectedDatabase && !loadingMapping}
				<div class="mb-6">
					<PropertyMappingCard
						databaseId={selectedDatabase}
						properties={selectedDatabaseProperties}
						savedMapping={savedMapping}
						onSave={handleMappingSave}
					/>
				</div>
			{/if}

			<!-- Transcript Selection -->
			<div class="mb-6">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Transcripts</span>
					<div class="flex items-center gap-4">
						<label class="flex items-center gap-2 text-xs text-[var(--brand-text-muted)] cursor-pointer">
							<input
								type="checkbox"
								bind:checked={forceResync}
								class="rounded"
							/>
							Force resync
						</label>
						<button
							type="button"
							onclick={selectAllUnsynced}
							class="text-xs text-[var(--brand-accent)] hover:underline"
						>
							Select all unsynced
						</button>
					</div>
				</div>

				{#if loadingTranscripts}
					<div class="text-sm text-[var(--brand-text-muted)]">Loading transcripts...</div>
				{:else if transcriptError}
					<div class="p-4 border border-[var(--brand-error)]/30 rounded-[var(--brand-radius)] bg-[var(--brand-error)]/5">
						<div class="text-sm text-[var(--brand-error)] font-medium">{transcriptError}</div>
						{#if transcriptErrorHint}
							<div class="text-xs text-[var(--brand-text-muted)] mt-1">{transcriptErrorHint}</div>
						{/if}
						<button 
							type="button"
							onclick={loadTranscripts}
							class="mt-3 text-xs text-[var(--brand-accent)] hover:underline"
						>
							Try again
						</button>
					</div>
				{:else if transcripts.length === 0}
					<div class="text-sm text-[var(--brand-text-muted)]">No transcripts found</div>
				{:else}
					<div class="max-h-64 overflow-y-auto border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
						{#each transcripts as transcript}
							<label
								class="flex items-center gap-3 p-3 border-b border-[var(--brand-border)] last:border-b-0 cursor-pointer hover:bg-[var(--brand-surface)] transition-colors"
								class:opacity-50={transcript.synced && !forceResync}
							>
								<input
									type="checkbox"
									checked={selectedTranscripts.includes(transcript.id)}
									onchange={() => toggleTranscript(transcript.id)}
									disabled={transcript.synced && !forceResync}
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
					
					<!-- Load More Button -->
					{#if hasMoreTranscripts}
						<button
							type="button"
							onclick={loadMoreTranscripts}
							disabled={loadingMoreTranscripts}
							class="w-full mt-3 py-2 text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--brand-surface)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
						>
							{#if loadingMoreTranscripts}
								<Loader2 size={14} class="animate-spin" />
								Loading older transcripts...
							{:else}
								<ChevronDown size={14} />
								Load older transcripts ({transcripts.length} loaded)
							{/if}
						</button>
					{:else if transcripts.length > 0}
						<div class="mt-3 text-center text-xs text-[var(--brand-text-muted)]">
							All {transcripts.length} transcripts loaded
						</div>
					{/if}
				{/if}
			</div>

			<!-- Sync button -->
			<div class="flex items-center justify-between">
				<div class="text-sm text-[var(--brand-text-muted)]">
					{selectedTranscripts.length} transcript{selectedTranscripts.length === 1 ? '' : 's'} selected
				</div>
				<button
					onclick={startSync}
					disabled={syncing || !selectedDatabase || selectedTranscripts.length === 0}
					class="bg-[var(--brand-primary)] text-[var(--brand-surface)] px-6 py-2 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{syncing ? `Syncing ${progress}/${total}...` : 'Start sync'}
				</button>
			</div>

			<!-- Progress bar -->
			{#if syncing}
				<div class="mt-4">
					<div class="h-2 bg-[var(--brand-border)] rounded-full overflow-hidden">
						<div
							class="h-full bg-[var(--brand-accent)] transition-all duration-300"
							style="width: {total > 0 ? (progress / total) * 100 : 0}%"
						></div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Not fully connected -->
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-8 text-center bg-[var(--brand-surface-elevated)]">
			<p class="text-[var(--brand-text-muted)]">
				Connect both Fireflies and Notion to start syncing
			</p>
		</div>
	{/if}

	<!-- Recent Jobs -->
	{#if data.recentJobs.length > 0}
		<div class="mt-8">
			<h2 class="text-lg font-semibold mb-4">Recent syncs</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
				{#each data.recentJobs as job}
					<div class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<div class="font-medium">{job.database_name || 'Unknown database'}</div>
								<div class="text-sm text-[var(--brand-text-muted)]">
									{new Date(job.created_at).toLocaleString()} · {job.progress}/{job.total_transcripts} transcripts
								</div>
							</div>
							<span
								class="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 {job.status === 'completed' ? 'bg-[var(--brand-success)]/10 text-[var(--brand-success)]' : job.status === 'failed' ? 'bg-[var(--brand-error)]/10 text-[var(--brand-error)]' : job.status === 'running' ? 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]' : 'bg-neutral-500/10 text-neutral-500'}"
							>
								{#if job.status === 'completed'}
									<Check size={16} />
								{:else if job.status === 'running'}
									<Loader2 size={16} class="animate-spin" />
								{:else if job.status === 'failed'}
									<X size={16} />
								{/if}
								{job.status}
							</span>
						</div>
						{#if job.error_message}
							<details class="mt-1 group">
								<summary class="text-xs text-[var(--brand-text-muted)] cursor-pointer hover:text-[var(--brand-error)] transition-colors">
									View error details
								</summary>
								<p class="mt-1 text-xs text-[var(--brand-text-muted)] break-words pl-2 border-l border-[var(--brand-border)]">
									{job.error_message}
								</p>
							</details>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

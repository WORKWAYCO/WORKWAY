<script lang="ts">
	import { ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-svelte';

	interface DatabaseProperty {
		id: string;
		name: string;
		type: string;
	}

	interface PropertyMapping {
		duration?: string;
		participants?: string;
		participantsType?: 'multi_select' | 'rich_text';
		keywords?: string;
		date?: string;
		url?: string;
	}

	interface Props {
		databaseId: string;
		properties: DatabaseProperty[];
		savedMapping: PropertyMapping | null;
		autoSyncEnabled?: boolean;
		onSave: (mapping: PropertyMapping, autoSync: boolean) => void;
	}

	let { databaseId, properties, savedMapping, autoSyncEnabled = false, onSave }: Props = $props();

	// Local state
	let expanded = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Form state - synced with savedMapping prop
	let duration = $state('');
	let participants = $state('');
	let participantsType = $state<'multi_select' | 'rich_text'>('multi_select');
	let keywords = $state('');
	let date = $state('');
	let url = $state('');
	let autoSync = $state(false);

	// Sync form state when savedMapping changes
	$effect(() => {
		expanded = !savedMapping;
		duration = savedMapping?.duration || '';
		participants = savedMapping?.participants || '';
		participantsType = savedMapping?.participantsType || 'multi_select';
		keywords = savedMapping?.keywords || '';
		date = savedMapping?.date || '';
		url = savedMapping?.url || '';
		autoSync = autoSyncEnabled;
	});
	
	// Update participantsType when a property is selected
	function handleParticipantsChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const selectedValue = select.value;
		participants = selectedValue;
		
		// Determine type from the selected property
		if (selectedValue) {
			const prop = properties.find(p => p.name === selectedValue);
			if (prop) {
				participantsType = prop.type === 'rich_text' ? 'rich_text' : 'multi_select';
			}
		}
	}

	// Filter properties by type
	const numberProperties = $derived(properties.filter((p) => p.type === 'number'));
	const multiSelectProperties = $derived(properties.filter((p) => p.type === 'multi_select'));
	const richTextProperties = $derived(properties.filter((p) => p.type === 'rich_text'));
	const dateProperties = $derived(properties.filter((p) => p.type === 'date'));
	const urlProperties = $derived(properties.filter((p) => p.type === 'url'));
	
	// Participants can use multi_select OR rich_text
	const participantProperties = $derived([
		...multiSelectProperties.map(p => ({ ...p, displayType: 'Tags' })),
		...richTextProperties.map(p => ({ ...p, displayType: 'Text' }))
	]);

	// Count mapped fields
	const mappedCount = $derived(
		[duration, participants, keywords, date, url].filter((v) => v).length
	);

	async function handleSave() {
		saving = true;
		error = null;

		const mapping: PropertyMapping = {};
		if (duration) mapping.duration = duration;
		if (participants) {
			mapping.participants = participants;
			mapping.participantsType = participantsType;
		}
		if (keywords) mapping.keywords = keywords;
		if (date) mapping.date = date;
		if (url) mapping.url = url;

		try {
			const response = await fetch('/api/property-mappings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ databaseId, mapping, autoSyncEnabled: autoSync })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to save mapping');
			}

			onSave(mapping, autoSync);
			expanded = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			saving = false;
		}
	}

	function toggleExpanded() {
		expanded = !expanded;
	}
</script>

<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface-elevated)] overflow-hidden">
	<!-- Header -->
	<button
		type="button"
		onclick={toggleExpanded}
		class="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-hover)] transition-colors"
	>
		<div class="flex items-center gap-2">
			<Settings2 size={16} class="text-[var(--brand-text-muted)]" />
			<span class="font-medium text-sm">Property Mapping</span>
			{#if !expanded && mappedCount > 0}
				<span class="text-xs text-[var(--brand-text-muted)]">
					({mappedCount} field{mappedCount !== 1 ? 's' : ''} mapped)
				</span>
			{/if}
		</div>
		{#if expanded}
			<ChevronUp size={16} class="text-[var(--brand-text-muted)]" />
		{:else}
			<ChevronDown size={16} class="text-[var(--brand-text-muted)]" />
		{/if}
	</button>

	<!-- Content -->
	{#if expanded}
		<div class="px-4 pb-4 border-t border-[var(--brand-border)]">
			<p class="text-xs text-[var(--brand-text-muted)] mt-3 mb-4">
				Map Fireflies data to your Notion database properties
			</p>

			<div class="space-y-4">
				<!-- Duration -->
				<div>
					<label for="map-duration" class="block text-sm font-medium mb-1">Duration (mins)</label>
					<p class="text-xs text-[var(--brand-text-muted)] mb-2">Meeting length in minutes</p>
					{#if numberProperties.length === 0}
						<p class="text-xs text-[var(--brand-text-muted)] italic">
							Add a Number property to your database
						</p>
					{:else}
						<select
							id="map-duration"
							bind:value={duration}
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						>
							<option value="">Don't map</option>
							{#each numberProperties as prop (prop.id)}
								<option value={prop.name}>{prop.name}</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Participants -->
				<div>
					<label for="map-participants" class="block text-sm font-medium mb-1">Participants</label>
					<p class="text-xs text-[var(--brand-text-muted)] mb-2">
						Attendee names — use Text for simpler syncing, or Multi-select for filtering
					</p>
					{#if participantProperties.length === 0}
						<p class="text-xs text-[var(--brand-text-muted)] italic">
							Add a Multi-select or Text property to your database
						</p>
					{:else}
						<select
							id="map-participants"
							value={participants}
							onchange={handleParticipantsChange}
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						>
							<option value="">Don't map</option>
							{#each participantProperties as prop (prop.id)}
								<option value={prop.name}>{prop.name} ({prop.displayType})</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Keywords -->
				<div>
					<label for="map-keywords" class="block text-sm font-medium mb-1">Keywords</label>
					<p class="text-xs text-[var(--brand-text-muted)] mb-2">AI-extracted topics</p>
					{#if multiSelectProperties.length === 0}
						<p class="text-xs text-[var(--brand-text-muted)] italic">
							Add a Multi-select property to your database
						</p>
					{:else}
						<select
							id="map-keywords"
							bind:value={keywords}
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						>
							<option value="">Don't map</option>
							{#each multiSelectProperties as prop (prop.id)}
								<option value={prop.name}>{prop.name}</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Date -->
				<div>
					<label for="map-date" class="block text-sm font-medium mb-1">Meeting Date</label>
					<p class="text-xs text-[var(--brand-text-muted)] mb-2">When the meeting occurred</p>
					{#if dateProperties.length === 0}
						<p class="text-xs text-[var(--brand-text-muted)] italic">
							Add a Date property to your database
						</p>
					{:else}
						<select
							id="map-date"
							bind:value={date}
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						>
							<option value="">Don't map</option>
							{#each dateProperties as prop (prop.id)}
								<option value={prop.name}>{prop.name}</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- URL -->
				<div>
					<label for="map-url" class="block text-sm font-medium mb-1">Fireflies URL</label>
					<p class="text-xs text-[var(--brand-text-muted)] mb-2">Link to the Fireflies transcript</p>
					{#if urlProperties.length === 0}
						<p class="text-xs text-[var(--brand-text-muted)] italic">
							Add a URL property to your database
						</p>
					{:else}
						<select
							id="map-url"
							bind:value={url}
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						>
							<option value="">Don't map</option>
							{#each urlProperties as prop (prop.id)}
								<option value={prop.name}>{prop.name}</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Auto-sync -->
				<div class="pt-4 border-t border-[var(--brand-border)]">
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={autoSync}
							class="w-4 h-4 rounded border-[var(--brand-border)]"
						/>
						<div class="flex items-center gap-2">
							<Zap size={16} class={autoSync ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-text-muted)]'} />
							<span class="text-sm font-medium">Auto-sync new transcripts</span>
						</div>
					</label>
					<p class="text-xs text-[var(--brand-text-muted)] mt-2 ml-7">
						New Fireflies transcripts will automatically sync to Notion (checked hourly)
					</p>
				</div>
			</div>

			{#if error}
				<p class="mt-3 text-sm text-[var(--brand-error)]">{error}</p>
			{/if}

			<div class="mt-4 flex justify-end">
				<button
					type="button"
					onclick={handleSave}
					disabled={saving}
					class="px-4 py-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] rounded-[var(--brand-radius)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Mapping'}
				</button>
			</div>
		</div>
	{/if}
</div>

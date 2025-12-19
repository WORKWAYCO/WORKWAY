<script lang="ts">
	interface DatabaseItem {
		id: string;
		title: string;
	}

	interface Props {
		databases: DatabaseItem[];
		selectedDatabase: string | null;
		onSelect: (id: string | null) => void;
		loading?: boolean;
		disabled?: boolean;
	}

	let { databases, selectedDatabase, onSelect, loading = false, disabled = false }: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onSelect(target.value || null);
	}
</script>

<div>
	<label for="database" class="block text-sm font-medium mb-2">Notion Database</label>
	{#if loading}
		<div class="text-sm text-[var(--brand-text-muted)]">Loading databases...</div>
	{:else}
		<select
			id="database"
			value={selectedDatabase || ''}
			onchange={handleChange}
			{disabled}
			class="w-full px-4 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] disabled:opacity-50"
		>
			<option value="">Select a database</option>
			{#each databases as db (db.id)}
				<option value={db.id}>{db.title}</option>
			{/each}
		</select>
	{/if}
</div>

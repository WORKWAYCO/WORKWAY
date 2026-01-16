<script lang="ts">
	import { Search } from 'lucide-svelte';

	let searchQuery = $state('');

	const integrations = [
		{ name: 'Zoom', slug: 'zoom', category: 'Meetings', scopes: ['read_recordings', 'read_meetings', 'read_webinars'] },
		{ name: 'Calendly', slug: 'calendly', category: 'Meetings', scopes: ['read_events', 'read_invitees'] },
		{ name: 'Notion', slug: 'notion', category: 'Productivity', scopes: ['read_pages', 'write_pages', 'read_databases'] },
		{ name: 'Airtable', slug: 'airtable', category: 'Productivity', scopes: ['read_records', 'write_records'] },
		{ name: 'Todoist', slug: 'todoist', category: 'Productivity', scopes: ['read_tasks', 'write_tasks'] },
		{ name: 'Linear', slug: 'linear', category: 'Productivity', scopes: ['read_issues', 'write_issues'] },
		{ name: 'Slack', slug: 'slack', category: 'Communication', scopes: ['send_messages', 'read_channels'] },
		{ name: 'Discord', slug: 'discord', category: 'Communication', scopes: ['send_messages', 'read_guilds'] },
		{ name: 'Google Sheets', slug: 'google-sheets', category: 'Google', scopes: ['read_spreadsheets', 'write_spreadsheets'] },
		{ name: 'GitHub', slug: 'github', category: 'Developer', scopes: ['read_repos', 'write_issues', 'read_prs'] },
		{ name: 'HubSpot', slug: 'hubspot', category: 'CRM', scopes: ['read_contacts', 'write_contacts', 'read_deals'] },
		{ name: 'Stripe', slug: 'stripe', category: 'Payments', scopes: ['read_payments', 'read_customers', 'read_subscriptions'] },
		{ name: 'Typeform', slug: 'typeform', category: 'Forms', scopes: ['read_forms', 'read_responses'] },
		{ name: 'DocuSign', slug: 'docusign', category: 'Documents', scopes: ['read_envelopes', 'send_envelopes'] },
		{ name: 'QuickBooks', slug: 'quickbooks', category: 'Finance', scopes: ['read_invoices', 'write_invoices'] },
		{ name: 'YouTube', slug: 'youtube', category: 'Media', scopes: ['read_videos', 'read_channels'] },
	];

	function filteredIntegrations() {
		if (!searchQuery) return integrations;
		const q = searchQuery.toLowerCase();
		return integrations.filter(i => 
			i.name.toLowerCase().includes(q) || 
			i.category.toLowerCase().includes(q) ||
			i.scopes.some(s => s.includes(q))
		);
	}
</script>

<svelte:head>
	<title>Integration Catalog | WORKWAY Docs</title>
	<meta name="description" content="Complete catalog of WORKWAY integrations with available scopes." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/integrations" class="hover:text-[var(--brand-text)]">Integrations</a>
			<span>/</span>
			<span>Catalog</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Integration Catalog</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Complete list of available integrations with their scopes.
		</p>
	</div>

	<!-- Search -->
	<section class="mb-8">
		<div class="relative">
			<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--brand-text-muted)]" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search integrations or scopes..."
				class="w-full pl-10 pr-4 py-3 bg-transparent border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm focus:outline-none focus:border-[var(--color-fg-secondary)]/50"
			/>
		</div>
	</section>

	<!-- Catalog -->
	<section>
		<div class="space-y-4">
			{#each filteredIntegrations() as integration}
				<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
					<div class="flex items-start justify-between mb-3">
						<div>
							<h3 class="font-semibold">{integration.name}</h3>
							<span class="text-xs text-[var(--brand-text-muted)]">{integration.category}</span>
						</div>
						<code class="font-mono text-xs text-[var(--brand-text-muted)]">'{integration.slug}'</code>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each integration.scopes as scope}
							<span class="text-xs font-mono bg-[var(--color-hover)] px-2 py-1 rounded text-[var(--color-fg-secondary)]">{scope}</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		{#if filteredIntegrations().length === 0}
			<div class="text-center py-12 text-[var(--brand-text-muted)]">
				No integrations found for "{searchQuery}"
			</div>
		{/if}
	</section>
</div>

<script lang="ts">
	import { Plug, ArrowRight, Search, ExternalLink } from 'lucide-svelte';

	let searchQuery = $state('');

	const integrations = [
		{ name: 'Zoom', slug: 'zoom', category: 'Meetings', description: 'Recordings, meetings, webinars' },
		{ name: 'Calendly', slug: 'calendly', category: 'Meetings', description: 'Scheduled events, invitees' },
		{ name: 'Notion', slug: 'notion', category: 'Productivity', description: 'Pages, databases, blocks' },
		{ name: 'Airtable', slug: 'airtable', category: 'Productivity', description: 'Bases, tables, records' },
		{ name: 'Todoist', slug: 'todoist', category: 'Productivity', description: 'Tasks, projects, labels' },
		{ name: 'Linear', slug: 'linear', category: 'Productivity', description: 'Issues, projects, cycles' },
		{ name: 'Slack', slug: 'slack', category: 'Communication', description: 'Messages, channels, users' },
		{ name: 'Discord', slug: 'discord', category: 'Communication', description: 'Messages, guilds, channels' },
		{ name: 'Google Sheets', slug: 'google-sheets', category: 'Google', description: 'Spreadsheets, cells, ranges' },
		{ name: 'GitHub', slug: 'github', category: 'Developer', description: 'Repos, issues, PRs, webhooks' },
		{ name: 'HubSpot', slug: 'hubspot', category: 'CRM', description: 'Contacts, deals, companies' },
		{ name: 'Stripe', slug: 'stripe', category: 'Payments', description: 'Payments, customers, subscriptions' },
		{ name: 'Typeform', slug: 'typeform', category: 'Forms', description: 'Forms, responses, webhooks' },
		{ name: 'DocuSign', slug: 'docusign', category: 'Documents', description: 'Envelopes, signatures' },
		{ name: 'QuickBooks', slug: 'quickbooks', category: 'Finance', description: 'Invoices, customers, payments' },
		{ name: 'YouTube', slug: 'youtube', category: 'Media', description: 'Videos, channels, playlists' },
		{ name: 'Dribbble', slug: 'dribbble', category: 'Design', description: 'Shots, projects, users' },
		{ name: 'Procore', slug: 'procore', category: 'Construction', description: 'Projects, RFIs, submittals' },
		{ name: 'NexHealth', slug: 'nexhealth', category: 'Healthcare', description: 'Patients, appointments' },
		{ name: 'Follow Up Boss', slug: 'follow-up-boss', category: 'Real Estate', description: 'Leads, contacts, tasks' },
	];

	const categories = [...new Set(integrations.map(i => i.category))].sort();

	$effect(() => {
		// Filter effect
	});

	function filteredIntegrations() {
		if (!searchQuery) return integrations;
		const q = searchQuery.toLowerCase();
		return integrations.filter(i => 
			i.name.toLowerCase().includes(q) || 
			i.category.toLowerCase().includes(q) ||
			i.description.toLowerCase().includes(q)
		);
	}
</script>

<svelte:head>
	<title>Integrations | WORKWAY Docs</title>
	<meta name="description" content="40+ pre-built OAuth integrations for Zoom, Notion, Slack, Stripe, and more. Connect external services to your workflows." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Integrations</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Integrations</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Pre-built OAuth connectors for 40+ services. WORKWAY handles authentication, token refresh, and API clients automatically.
		</p>
	</div>

	<!-- How it works -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">How Integrations Work</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden mb-6">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  <span class="text-[var(--brand-text-muted)]">// 1. Declare integrations you need</span>
  integrations: [
    {'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, scopes: [<span class="text-[var(--color-success)]">'read_recordings'</span>] {'}'},
    {'{'} service: <span class="text-[var(--color-success)]">'notion'</span>, scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>] {'}'}
  ],

  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} integrations {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">// 2. Use typed API clients</span>
    <span class="text-[var(--brand-text-muted)]">const</span> recordings = <span class="text-[var(--brand-text-muted)]">await</span> integrations.zoom.recordings.list()
    
    <span class="text-[var(--brand-text-muted)]">await</span> integrations.notion.pages.<span class="text-[var(--brand-text)]">create</span>({'{'}
      parent: {'{'} database_id: <span class="text-[var(--color-success)]">'...'</span> {'}'},
      properties: {'{'} ... {'}'}
    {'}'})
  {'}'}
{'}'})</code></pre>
		</div>

		<div class="grid md:grid-cols-3 gap-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">1. Declare</div>
				<p class="text-sm text-[var(--brand-text-muted)]">List services and scopes in your workflow config.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">2. Connect</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Users authorize via OAuth when installing.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">3. Use</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Access fully-typed API clients in execute().</p>
			</div>
		</div>
	</section>

	<!-- Search -->
	<section class="mb-8">
		<div class="relative">
			<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--brand-text-muted)]" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search integrations..."
				class="w-full pl-10 pr-4 py-3 bg-transparent border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm focus:outline-none focus:border-[var(--color-fg-secondary)]/50"
			/>
		</div>
	</section>

	<!-- Integration Grid -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-6">Available Integrations</h2>
		<div class="grid md:grid-cols-2 gap-3">
			{#each filteredIntegrations() as integration}
				<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 hover:border-[var(--color-fg-secondary)]/30 transition-colors">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-2 mb-1">
								<h3 class="font-semibold">{integration.name}</h3>
								<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded text-[var(--brand-text-muted)]">{integration.category}</span>
							</div>
							<p class="text-sm text-[var(--brand-text-muted)]">{integration.description}</p>
						</div>
					</div>
					<div class="mt-2 font-mono text-xs text-[var(--brand-text-muted)]">
						service: '{integration.slug}'
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

	<!-- OAuth Setup -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">OAuth Setup</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			For local development, connect OAuth accounts via the CLI:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Connect to a service</span>
$ workway oauth connect zoom
$ workway oauth connect notion

<span class="text-[var(--brand-text-muted)]"># List connected accounts</span>
$ workway oauth list

<span class="text-[var(--brand-text-muted)]"># Disconnect</span>
$ workway oauth disconnect zoom</code></pre>
		</div>
		<p class="text-sm text-[var(--brand-text-muted)] mt-4">
			In production, users connect their own accounts when installing your workflow.
		</p>
	</section>

	<!-- BYOO -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Bring Your Own OAuth (BYOO)</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Use your own OAuth app credentials for custom branding and API quotas:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Add your OAuth app</span>
$ workway developer oauth add zoom

<span class="text-[var(--brand-text-muted)]"># Test credentials</span>
$ workway developer oauth test zoom

<span class="text-[var(--brand-text-muted)]"># Promote to production</span>
$ workway developer oauth promote zoom</code></pre>
		</div>
	</section>

	<!-- Custom Integrations -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Custom API Calls</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Need an API that isn't pre-built? Use <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">fetch()</code> directly:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} config {'}'}) {'{'}
  <span class="text-[var(--brand-text-muted)]">// Direct fetch() works for any API</span>
  <span class="text-[var(--brand-text-muted)]">const</span> response = <span class="text-[var(--brand-text-muted)]">await</span> <span class="text-[var(--brand-text)]">fetch</span>(<span class="text-[var(--color-success)]">'https://api.custom.com/data'</span>, {'{'}
    method: <span class="text-[var(--color-success)]">'GET'</span>,
    headers: {'{'} 
      <span class="text-[var(--color-success)]">'Authorization'</span>: <span class="text-[var(--color-success)]">`Bearer ${'$'}{config.apiKey}`</span> 
    {'}'}
  {'}'})
  
  <span class="text-[var(--brand-text-muted)]">return await</span> response.json()
{'}'}</code></pre>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/integrations/oauth" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">OAuth Setup Guide</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Detailed guide for setting up OAuth connections.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/first-workflow" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Build Your First Workflow</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Step-by-step guide using integrations.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Start building <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

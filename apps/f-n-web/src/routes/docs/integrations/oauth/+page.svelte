<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>OAuth Setup | WORKWAY Docs</title>
	<meta name="description" content="Set up OAuth integrations for WORKWAY workflows. Connect services and manage tokens." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/integrations" class="hover:text-[var(--brand-text)]">Integrations</a>
			<span>/</span>
			<span>OAuth Setup</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">OAuth Setup</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Connect OAuth services for local development and testing.
		</p>
	</div>

	<!-- How OAuth Works -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">How OAuth Works in WORKWAY</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">1. Declare in Workflow</div>
				<p class="text-sm text-[var(--brand-text-muted)]">List required services and scopes in your workflow definition.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">2. Connect for Testing</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Use CLI to connect your accounts for local development.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">3. Users Connect in Production</div>
				<p class="text-sm text-[var(--brand-text-muted)]">When users install your workflow, they connect their own accounts.</p>
			</div>
		</div>
	</section>

	<!-- Connect via CLI -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Connect via CLI</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Interactive selection</span>
$ workway oauth connect

<span class="text-[var(--brand-text-muted)]"># Connect specific service</span>
$ workway oauth connect zoom
$ workway oauth connect notion
$ workway oauth connect slack
$ workway oauth connect github

<span class="text-[var(--brand-text-muted)]"># List connections</span>
$ workway oauth list

<span class="text-[var(--brand-text-muted)]"># Disconnect</span>
$ workway oauth disconnect zoom</code></pre>
		</div>
	</section>

	<!-- Scopes -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Declaring Scopes</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Request only the scopes your workflow needs:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]">integrations: [
  {'{'}
    service: <span class="text-[var(--color-success)]">'zoom'</span>,
    scopes: [<span class="text-[var(--color-success)]">'read_recordings'</span>, <span class="text-[var(--color-success)]">'read_meetings'</span>],
    description: <span class="text-[var(--color-success)]">'Access meeting recordings'</span>
  {'}'},
  {'{'}
    service: <span class="text-[var(--color-success)]">'notion'</span>,
    scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>],
    description: <span class="text-[var(--color-success)]">'Create pages in your database'</span>
  {'}'}
]</code></pre>
		</div>
	</section>

	<!-- Token Refresh -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Token Refresh</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			WORKWAY automatically handles token refresh. You don't need to manage tokens manually.
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--color-hover)]">
			<p class="text-sm text-[var(--color-fg-secondary)]">
				<strong>Automatic refresh:</strong> When a token expires, WORKWAY refreshes it before your workflow executes. Failed refreshes prompt users to reconnect.
			</p>
		</div>
	</section>

	<!-- BYOO -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Bring Your Own OAuth (BYOO)</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Use your own OAuth app for custom branding and higher API limits:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Add your OAuth app credentials</span>
$ workway developer oauth add zoom

<span class="text-[var(--brand-text-muted)]"># Test the connection</span>
$ workway developer oauth test zoom

<span class="text-[var(--brand-text-muted)]"># Promote to production</span>
$ workway developer oauth promote zoom</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/integrations/catalog" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Integration Catalog</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Browse all available integrations.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View catalog <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/first-workflow" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Build Your First Workflow</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Use integrations in a real workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Start building <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

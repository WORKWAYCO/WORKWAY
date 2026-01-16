<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Authentication | WORKWAY Docs</title>
	<meta name="description" content="WORKWAY CLI authentication. Login, OAuth connections, and credentials management." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/cli" class="hover:text-[var(--brand-text)]">CLI</a>
			<span>/</span>
			<span>Authentication</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Authentication</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Authenticate with WORKWAY and manage OAuth connections for testing.
		</p>
	</div>

	<!-- Platform Login -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Platform Login</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Authenticate with your WORKWAY account:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Opens browser for authentication</span>
$ workway login

<span class="text-[var(--brand-text-muted)]"># Check current user</span>
$ workway whoami

<span class="text-[var(--brand-text-muted)]"># Clear credentials</span>
$ workway logout</code></pre>
		</div>
	</section>

	<!-- OAuth Connections -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">OAuth Connections</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Connect OAuth accounts for local testing:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Connect to a service</span>
$ workway oauth connect zoom
$ workway oauth connect notion
$ workway oauth connect slack

<span class="text-[var(--brand-text-muted)]"># List connected accounts</span>
$ workway oauth list

<span class="text-[var(--brand-text-muted)]"># Disconnect</span>
$ workway oauth disconnect zoom</code></pre>
		</div>
		<p class="text-sm text-[var(--brand-text-muted)] mt-4">
			OAuth tokens are stored encrypted in <code class="font-mono bg-[var(--color-hover)] px-1 rounded">~/.workway/oauth/</code>
		</p>
	</section>

	<!-- Credentials Storage -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Credentials Storage</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			All credentials are stored locally and encrypted:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 font-mono text-sm leading-relaxed"><code class="text-[var(--color-fg-secondary)]">~/.workway/
├── config.json        <span class="text-[var(--brand-text-muted)]"># API endpoints, preferences</span>
├── oauth/             <span class="text-[var(--brand-text-muted)]"># OAuth tokens (encrypted)</span>
└── credentials.json   <span class="text-[var(--brand-text-muted)]"># Auth tokens (encrypted)</span></code></pre>
		</div>
	</section>

	<!-- BYOO -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Bring Your Own OAuth (BYOO)</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Use your own OAuth app credentials for custom branding:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Add your OAuth app</span>
$ workway developer oauth add zoom

<span class="text-[var(--brand-text-muted)]"># Test credentials</span>
$ workway developer oauth test zoom

<span class="text-[var(--brand-text-muted)]"># List your apps</span>
$ workway developer oauth list

<span class="text-[var(--brand-text-muted)]"># Promote to production</span>
$ workway developer oauth promote zoom</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/cli/publishing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Publishing</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Publish workflows to the marketplace.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Next <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/integrations" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Integrations</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Available OAuth integrations.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View integrations <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

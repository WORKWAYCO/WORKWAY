<script lang="ts">
	import { Terminal, Copy, Check, ArrowRight, Rocket, Code2, Package, Key, DollarSign } from 'lucide-svelte';

	let copied = $state(false);

	async function copyInstall() {
		await navigator.clipboard.writeText('npm install -g @workway/cli');
		copied = true;
		setTimeout(() => copied = false, 2000);
	}
</script>

<svelte:head>
	<title>CLI Overview | WORKWAY Docs</title>
	<meta name="description" content="WORKWAY CLI for building, testing, and publishing workflows. Command reference and usage guide." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>CLI</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">CLI Overview</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			The WORKWAY CLI provides everything you need to build, test, and publish workflows from the command line.
		</p>
	</div>

	<!-- Install -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Installation</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--color-hover)] overflow-hidden">
			<div class="flex items-center justify-between px-4 py-3 border-b border-[var(--brand-border)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">npm</span>
				<button 
					onclick={copyInstall}
					class="text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
				>
					{#if copied}
						<Check size={14} class="text-[var(--color-success)]" />
					{:else}
						<Copy size={14} />
					{/if}
				</button>
			</div>
			<div class="px-4 py-4 font-mono text-sm">
				<span class="text-[var(--brand-text-muted)]">$</span> npm install -g <span class="text-[var(--brand-text)]">@workway/cli</span>
			</div>
		</div>
	</section>

	<!-- Quick Start -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Quick Start</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Authenticate</span>
$ workway login

<span class="text-[var(--brand-text-muted)]"># Create a workflow</span>
$ workway workflow init my-workflow

<span class="text-[var(--brand-text-muted)]"># Test locally</span>
$ cd my-workflow && workway workflow test --mock

<span class="text-[var(--brand-text-muted)]"># Publish to marketplace</span>
$ workway workflow publish</code></pre>
		</div>
	</section>

	<!-- Command Categories -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-6">Command Categories</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/cli/commands" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Code2 size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Workflow Commands</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">init, dev, test, build, publish, delete, fork</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View commands <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/cli/authentication" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Key size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Authentication</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">login, logout, whoami, oauth connect/disconnect</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View commands <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/cli/publishing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Rocket size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Publishing</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">publish, access-grants, developer profile</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View commands <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<DollarSign size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold">Developer & Earnings</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">developer init, earnings, stripe setup</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--brand-text-muted)]">
					See <a href="/docs/cli/commands" class="underline">commands</a>
				</span>
			</div>
		</div>
	</section>

	<!-- Common Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Common Commands</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="px-4 py-3 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
					<code class="font-mono text-sm">workway workflow init [name]</code>
				</div>
				<div class="px-4 py-3">
					<p class="text-sm text-[var(--brand-text-muted)]">Create a new workflow project with TypeScript configuration.</p>
					<div class="mt-2 font-mono text-xs text-[var(--brand-text-muted)]">
						<span class="text-[var(--color-fg-secondary)]">--ai</span> Create AI-powered workflow template
					</div>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="px-4 py-3 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
					<code class="font-mono text-sm">workway workflow dev</code>
				</div>
				<div class="px-4 py-3">
					<p class="text-sm text-[var(--brand-text-muted)]">Start development server with hot reload.</p>
					<div class="mt-2 font-mono text-xs text-[var(--brand-text-muted)]">
						<span class="text-[var(--color-fg-secondary)]">--port</span> Custom port (default: 3000)<br/>
						<span class="text-[var(--color-fg-secondary)]">--no-mock</span> Use live OAuth connections
					</div>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="px-4 py-3 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
					<code class="font-mono text-sm">workway workflow test</code>
				</div>
				<div class="px-4 py-3">
					<p class="text-sm text-[var(--brand-text-muted)]">Test workflow execution locally.</p>
					<div class="mt-2 font-mono text-xs text-[var(--brand-text-muted)]">
						<span class="text-[var(--color-fg-secondary)]">--mock</span> Use mocked integrations<br/>
						<span class="text-[var(--color-fg-secondary)]">--live</span> Use live OAuth connections<br/>
						<span class="text-[var(--color-fg-secondary)]">--data</span> Custom test data file
					</div>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="px-4 py-3 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
					<code class="font-mono text-sm">workway workflow publish</code>
				</div>
				<div class="px-4 py-3">
					<p class="text-sm text-[var(--brand-text-muted)]">Build and publish workflow to the marketplace.</p>
					<div class="mt-2 font-mono text-xs text-[var(--brand-text-muted)]">
						<span class="text-[var(--color-fg-secondary)]">--draft</span> Publish as draft (not public)
					</div>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="px-4 py-3 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
					<code class="font-mono text-sm">workway create [prompt]</code>
				</div>
				<div class="px-4 py-3">
					<p class="text-sm text-[var(--brand-text-muted)]">Generate a workflow from natural language description.</p>
					<div class="mt-2 font-mono text-xs text-[var(--brand-text-muted)]">
						<span class="text-[var(--color-fg-secondary)]">--output</span> Output file path
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Configuration -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Configuration</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			CLI configuration is stored in <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">~/.workway/</code>:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 font-mono text-sm leading-relaxed"><code class="text-[var(--color-fg-secondary)]">~/.workway/
├── config.json        <span class="text-[var(--brand-text-muted)]"># API endpoints, preferences</span>
├── oauth/             <span class="text-[var(--brand-text-muted)]"># OAuth tokens (encrypted)</span>
└── credentials.json   <span class="text-[var(--brand-text-muted)]"># Auth tokens (encrypted)</span></code></pre>
		</div>
	</section>

	<!-- Project Config -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Project Configuration</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Each workflow project has a <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">workway.config.json</code>:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workway.config.json</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]">{'{'}
  <span class="text-[var(--color-success)]">"dev"</span>: {'{'}
    <span class="text-[var(--color-success)]">"port"</span>: 3000,
    <span class="text-[var(--color-success)]">"hotReload"</span>: <span class="text-[var(--color-success)]">true</span>,
    <span class="text-[var(--color-success)]">"mockMode"</span>: <span class="text-[var(--color-success)]">true</span>
  {'}'},
  <span class="text-[var(--color-success)]">"test"</span>: {'{'}
    <span class="text-[var(--color-success)]">"testDataFile"</span>: <span class="text-[var(--color-success)]">"./test-data.json"</span>,
    <span class="text-[var(--color-success)]">"timeout"</span>: 30000
  {'}'},
  <span class="text-[var(--color-success)]">"build"</span>: {'{'}
    <span class="text-[var(--color-success)]">"outDir"</span>: <span class="text-[var(--color-success)]">"./dist"</span>,
    <span class="text-[var(--color-success)]">"minify"</span>: <span class="text-[var(--color-success)]">false</span>
  {'}'}
{'}'}</code></pre>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/cli/commands" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Full Command Reference</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Complete list of all CLI commands and options.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View commands <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/quickstart" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Quickstart Guide</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Build your first workflow step by step.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Get started <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

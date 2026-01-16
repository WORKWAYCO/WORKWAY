<script lang="ts">
	import { Workflow, Zap, Plug, Database, Clock, Webhook, MousePointer, RefreshCw, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Core Concepts | WORKWAY Docs</title>
	<meta name="description" content="Understand WORKWAY core concepts: workflows, triggers, integrations, and the execution model." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Core Concepts</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Core Concepts</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Understanding the building blocks of WORKWAY automation.
		</p>
	</div>

	<!-- Workflows -->
	<section class="mb-16">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
				<Workflow size={20} class="text-[var(--color-fg-secondary)]" />
			</div>
			<h2 class="text-2xl font-semibold">Workflows</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-6 leading-relaxed">
			A workflow is a TypeScript function that runs in response to a trigger. It can connect to external services, process data, and perform actions. Workflows run on Cloudflare Workers — globally distributed, fast, and scalable.
		</p>
		
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden mb-6">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">Workflow Structure</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  <span class="text-[var(--brand-text-muted)]">// Metadata</span>
  name: <span class="text-[var(--color-success)]">'Workflow Name'</span>,
  description: <span class="text-[var(--color-success)]">'What it does'</span>,
  type: <span class="text-[var(--color-success)]">'integration'</span> | <span class="text-[var(--color-success)]">'ai-enhanced'</span> | <span class="text-[var(--color-success)]">'ai-native'</span>,

  <span class="text-[var(--brand-text-muted)]">// What starts the workflow</span>
  trigger: webhook() | schedule() | manual() | poll(),

  <span class="text-[var(--brand-text-muted)]">// External services needed</span>
  integrations: [{'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, scopes: [...] {'}'}],

  <span class="text-[var(--brand-text-muted)]">// User configuration</span>
  inputs: {'{'} ... {'}'},

  <span class="text-[var(--brand-text-muted)]">// The actual logic</span>
  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>(context) {'{'} ... {'}'}
{'}'})</code></pre>
		</div>

		<h3 class="font-semibold mb-3">Workflow Types</h3>
		<div class="grid md:grid-cols-3 gap-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-mono text-sm text-[var(--color-success)] mb-2">'integration'</div>
				<p class="text-sm text-[var(--brand-text-muted)]">API-to-API workflows. No AI. Cheapest to run (~$0.001/execution).</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-mono text-sm text-[var(--color-success)] mb-2">'ai-enhanced'</div>
				<p class="text-sm text-[var(--brand-text-muted)]">1-2 AI calls for classification or analysis (~$0.01/execution).</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-mono text-sm text-[var(--color-success)] mb-2">'ai-native'</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Multi-step AI pipelines for content generation (~$0.03/execution).</p>
			</div>
		</div>
	</section>

	<!-- Triggers -->
	<section class="mb-16">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
				<Zap size={20} class="text-[var(--color-fg-secondary)]" />
			</div>
			<h2 class="text-2xl font-semibold">Triggers</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-6 leading-relaxed">
			Triggers define when and how a workflow executes. WORKWAY supports four trigger types.
		</p>

		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<Webhook size={18} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Webhook</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">Instant</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Triggered by external events from connected services.</p>
				<code class="font-mono text-sm text-[var(--color-fg-secondary)]">trigger: webhook({'{'} service: 'zoom', event: 'recording.completed' {'}'})</code>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<Clock size={18} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Schedule</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">Cron</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Runs on a schedule using cron expressions.</p>
				<code class="font-mono text-sm text-[var(--color-fg-secondary)]">trigger: schedule('0 8 * * *')  <span class="text-[var(--brand-text-muted)]">// Daily at 8am</span></code>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<MousePointer size={18} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Manual</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">On-demand</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Triggered by user clicking a button in the dashboard.</p>
				<code class="font-mono text-sm text-[var(--color-fg-secondary)]">trigger: manual()</code>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<RefreshCw size={18} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Poll</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">Interval</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Periodically checks for new data from a service.</p>
				<code class="font-mono text-sm text-[var(--color-fg-secondary)]">trigger: poll({'{'} service: 'airtable', interval: '15m' {'}'})</code>
			</div>
		</div>
	</section>

	<!-- Integrations -->
	<section class="mb-16">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
				<Plug size={20} class="text-[var(--color-fg-secondary)]" />
			</div>
			<h2 class="text-2xl font-semibold">Integrations</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-6 leading-relaxed">
			Integrations are pre-built connectors to external services. WORKWAY handles OAuth, token refresh, and API authentication automatically.
		</p>

		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden mb-6">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">Declaring Integrations</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]">integrations: [
  {'{'} 
    service: <span class="text-[var(--color-success)]">'zoom'</span>, 
    scopes: [<span class="text-[var(--color-success)]">'read_recordings'</span>, <span class="text-[var(--color-success)]">'read_meetings'</span>] 
  {'}'},
  {'{'} 
    service: <span class="text-[var(--color-success)]">'notion'</span>, 
    scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>, <span class="text-[var(--color-success)]">'read_databases'</span>] 
  {'}'}
]</code></pre>
		</div>

		<p class="text-[var(--color-fg-secondary)] mb-4">
			Inside <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">execute()</code>, access integrations via the context:
		</p>

		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} integrations {'}'}) {'{'}
  <span class="text-[var(--brand-text-muted)]">// Fully typed API clients</span>
  <span class="text-[var(--brand-text-muted)]">const</span> recordings = <span class="text-[var(--brand-text-muted)]">await</span> integrations.zoom.recordings.list()
  <span class="text-[var(--brand-text-muted)]">await</span> integrations.notion.pages.create({'{'} ... {'}'})
{'}'}
</code></pre>
		</div>
	</section>

	<!-- Execution Context -->
	<section class="mb-16">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
				<Database size={20} class="text-[var(--color-fg-secondary)]" />
			</div>
			<h2 class="text-2xl font-semibold">Execution Context</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-6 leading-relaxed">
			Every workflow receives a context object with everything needed for execution.
		</p>

		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">ExecutionContext</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'}
  <span class="text-[var(--brand-text-muted)]">// User-configured values</span>
  inputs,
  
  <span class="text-[var(--brand-text-muted)]">// Trigger payload</span>
  trigger,
  
  <span class="text-[var(--brand-text-muted)]">// Connected service clients</span>
  integrations,
  
  <span class="text-[var(--brand-text-muted)]">// Persistent key-value storage</span>
  state,
  
  <span class="text-[var(--brand-text-muted)]">// Temporary caching</span>
  cache,
  
  <span class="text-[var(--brand-text-muted)]">// Structured logging</span>
  log,
  
  <span class="text-[var(--brand-text-muted)]">// Cloudflare environment bindings</span>
  env,
  
  <span class="text-[var(--brand-text-muted)]">// Execution metadata</span>
  executionId,
  userId,
  workflowId
{'}'}) {'{'} ... {'}'}
</code></pre>
		</div>
	</section>

	<!-- Runtime -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Runtime Environment</h2>
		<p class="text-[var(--color-fg-secondary)] mb-6 leading-relaxed">
			Workflows run on Cloudflare Workers, a V8 isolate environment. This means:
		</p>

		<div class="grid md:grid-cols-2 gap-4">
			<div class="border border-[var(--color-success-border)] bg-[var(--color-success-background)] rounded-[var(--brand-radius)] p-4">
				<h3 class="font-semibold text-[var(--color-success)] mb-2">✓ Available</h3>
				<ul class="text-sm text-[var(--color-fg-secondary)] space-y-1">
					<li>• Standard JavaScript APIs</li>
					<li>• <code class="font-mono">fetch()</code> for HTTP requests</li>
					<li>• Web Crypto API</li>
					<li>• Workers-compatible npm packages</li>
					<li>• Workers AI (Cloudflare)</li>
				</ul>
			</div>
			<div class="border border-[var(--color-error-border)] bg-[var(--color-error-background)] rounded-[var(--brand-radius)] p-4">
				<h3 class="font-semibold text-[var(--color-error)] mb-2">✗ Not Available</h3>
				<ul class="text-sm text-[var(--color-fg-secondary)] space-y-1">
					<li>• Node.js standard library (fs, path, etc.)</li>
					<li>• Most npm packages (Node.js-specific)</li>
					<li>• Long-running processes</li>
					<li>• File system access</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">SDK Reference</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Explore the full SDK API and all available modules.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View SDK <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/first-workflow" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Build Your First Workflow</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Step-by-step guide to building a real workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Start building <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Testing Workflows | WORKWAY Docs</title>
	<meta name="description" content="Test WORKWAY workflows locally. Mock integrations, test data, and debugging." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/guides" class="hover:text-[var(--brand-text)]">Guides</a>
			<span>/</span>
			<span>Testing</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Testing Workflows</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Test your workflows locally before publishing.
		</p>
	</div>

	<!-- Test Modes -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Test Modes</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-2">
					<code class="font-mono text-[var(--color-success)]">--mock</code>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">Recommended</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Uses mocked integration responses. Fast, no OAuth required.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<code class="font-mono text-[var(--color-success)]">--live</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-2">Uses real OAuth connections. Requires <code class="font-mono bg-[var(--color-hover)] px-1 rounded">workway oauth connect</code>.</p>
			</div>
		</div>
	</section>

	<!-- Running Tests -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Running Tests</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Test with mocks (default)</span>
$ workway workflow test --mock

<span class="text-[var(--brand-text-muted)]"># Test with live connections</span>
$ workway workflow test --live

<span class="text-[var(--brand-text-muted)]"># Use custom test data</span>
$ workway workflow test --data custom-data.json

<span class="text-[var(--brand-text-muted)]"># Verbose output</span>
$ workway workflow test --mock --verbose</code></pre>
		</div>
	</section>

	<!-- Test Data -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Test Data</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Create a <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">test-data.json</code> file:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">test-data.json</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]">{'{'}
  <span class="text-[var(--color-success)]">"inputs"</span>: {'{'}
    <span class="text-[var(--color-success)]">"notionDatabase"</span>: <span class="text-[var(--color-success)]">"abc123"</span>,
    <span class="text-[var(--color-success)]">"slackChannel"</span>: <span class="text-[var(--color-success)]">"#general"</span>
  {'}'},
  <span class="text-[var(--color-success)]">"trigger"</span>: {'{'}
    <span class="text-[var(--color-success)]">"type"</span>: <span class="text-[var(--color-success)]">"webhook"</span>,
    <span class="text-[var(--color-success)]">"data"</span>: {'{'}
      <span class="text-[var(--color-success)]">"event"</span>: <span class="text-[var(--color-success)]">"recording.completed"</span>,
      <span class="text-[var(--color-success)]">"payload"</span>: {'{'}
        <span class="text-[var(--color-success)]">"topic"</span>: <span class="text-[var(--color-success)]">"Team Meeting"</span>,
        <span class="text-[var(--color-success)]">"duration"</span>: 45
      {'}'}
    {'}'}
  {'}'}
{'}'}</code></pre>
		</div>
	</section>

	<!-- Logging -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Logging</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Use the <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">log</code> context for debugging:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} log, trigger {'}'}) {'{'}
  log.info(<span class="text-[var(--color-success)]">'Starting workflow'</span>, {'{'} trigger {'}'})
  
  <span class="text-[var(--brand-text-muted)]">try</span> {'{'}
    <span class="text-[var(--brand-text-muted)]">// ... workflow logic</span>
    log.info(<span class="text-[var(--color-success)]">'Step completed'</span>, {'{'} result {'}'})
  {'}'} <span class="text-[var(--brand-text-muted)]">catch</span> (error) {'{'}
    log.error(<span class="text-[var(--color-success)]">'Step failed'</span>, {'{'} error {'}'})
  {'}'}
{'}'}</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/cli/publishing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Publishing</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Publish your tested workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/pricing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Pricing Guide</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Set pricing for your workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

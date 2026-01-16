<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Storage & Cache | WORKWAY Docs</title>
	<meta name="description" content="Cloudflare KV, R2, and caching utilities for WORKWAY workflows." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/sdk" class="hover:text-[var(--brand-text)]">SDK</a>
			<span>/</span>
			<span>Storage & Cache</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Storage & Cache</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Persistent storage and caching utilities built on Cloudflare KV and R2.
		</p>
	</div>

	<!-- KV Storage -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">KV Storage</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Key-value storage for workflow state and configuration:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} createKVStorage {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">const</span> kv = <span class="text-[var(--brand-text)]">createKVStorage</span>(env.MY_KV)

<span class="text-[var(--brand-text-muted)]">// Set value</span>
<span class="text-[var(--brand-text-muted)]">await</span> kv.<span class="text-[var(--brand-text)]">set</span>(<span class="text-[var(--color-success)]">'config'</span>, {'{'} theme: <span class="text-[var(--color-success)]">'dark'</span> {'}'})

<span class="text-[var(--brand-text-muted)]">// Get value</span>
<span class="text-[var(--brand-text-muted)]">const</span> config = <span class="text-[var(--brand-text-muted)]">await</span> kv.<span class="text-[var(--brand-text)]">get</span>(<span class="text-[var(--color-success)]">'config'</span>)

<span class="text-[var(--brand-text-muted)]">// List keys</span>
<span class="text-[var(--brand-text-muted)]">const</span> keys = <span class="text-[var(--brand-text-muted)]">await</span> kv.<span class="text-[var(--brand-text)]">list</span>({'{'} prefix: <span class="text-[var(--color-success)]">'user:'</span> {'}'})</code></pre>
		</div>
	</section>

	<!-- Cache -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Caching</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Temporary caching with TTL for expensive operations:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} createCache {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">const</span> cache = <span class="text-[var(--brand-text)]">createCache</span>(env.CACHE)

<span class="text-[var(--brand-text-muted)]">// Set with TTL (seconds)</span>
<span class="text-[var(--brand-text-muted)]">await</span> cache.<span class="text-[var(--brand-text)]">set</span>(<span class="text-[var(--color-success)]">'user:123'</span>, userData, {'{'} ttl: 3600 {'}'})

<span class="text-[var(--brand-text-muted)]">// Get or set pattern</span>
<span class="text-[var(--brand-text-muted)]">const</span> data = <span class="text-[var(--brand-text-muted)]">await</span> cache.<span class="text-[var(--brand-text)]">getOrSet</span>(<span class="text-[var(--color-success)]">'key'</span>, <span class="text-[var(--brand-text-muted)]">async</span> () => {'{'}
  <span class="text-[var(--brand-text-muted)]">return await</span> expensiveOperation()
{'}'}, {'{'} ttl: 300 {'}'})</code></pre>
		</div>
	</section>

	<!-- R2 Object Storage -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Object Storage (R2)</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Store files and large objects:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} createObjectStorage {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">const</span> storage = <span class="text-[var(--brand-text)]">createObjectStorage</span>(env.MY_BUCKET)

<span class="text-[var(--brand-text-muted)]">// Upload file</span>
<span class="text-[var(--brand-text-muted)]">await</span> storage.<span class="text-[var(--brand-text)]">uploadFile</span>(<span class="text-[var(--color-success)]">'docs/report.pdf'</span>, pdfBuffer, {'{'}
  contentType: <span class="text-[var(--color-success)]">'application/pdf'</span>
{'}'})

<span class="text-[var(--brand-text-muted)]">// Download file</span>
<span class="text-[var(--brand-text-muted)]">const</span> file = <span class="text-[var(--brand-text-muted)]">await</span> storage.<span class="text-[var(--brand-text)]">downloadFile</span>(<span class="text-[var(--color-success)]">'docs/report.pdf'</span>)

<span class="text-[var(--brand-text-muted)]">// Get metadata</span>
<span class="text-[var(--brand-text-muted)]">const</span> metadata = <span class="text-[var(--brand-text-muted)]">await</span> storage.<span class="text-[var(--brand-text)]">getMetadata</span>(<span class="text-[var(--color-success)]">'docs/report.pdf'</span>)</code></pre>
		</div>
	</section>

	<!-- Execution Context -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Built-in Context Storage</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Every workflow has access to built-in state and cache via the execution context:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} state, cache {'}'}) {'{'}
  <span class="text-[var(--brand-text-muted)]">// Persistent state (per-user, per-workflow)</span>
  <span class="text-[var(--brand-text-muted)]">const</span> runCount = <span class="text-[var(--brand-text-muted)]">await</span> state.<span class="text-[var(--brand-text)]">get</span>(<span class="text-[var(--color-success)]">'runCount'</span>) || 0
  <span class="text-[var(--brand-text-muted)]">await</span> state.<span class="text-[var(--brand-text)]">set</span>(<span class="text-[var(--color-success)]">'runCount'</span>, runCount + 1)

  <span class="text-[var(--brand-text-muted)]">// Temporary cache</span>
  <span class="text-[var(--brand-text-muted)]">const</span> cached = <span class="text-[var(--brand-text-muted)]">await</span> cache.<span class="text-[var(--brand-text)]">get</span>(<span class="text-[var(--color-success)]">'expensive-result'</span>)
{'}'}</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">SDK Overview</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Back to SDK documentation.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View SDK <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/first-workflow" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Build Your First Workflow</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Step-by-step guide.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Start building <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

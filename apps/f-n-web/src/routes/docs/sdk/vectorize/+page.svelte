<script lang="ts">
	import { Database, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Vectorize | WORKWAY Docs</title>
	<meta name="description" content="Cloudflare Vectorize for semantic search, RAG, and knowledge bases in WORKWAY workflows." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/sdk" class="hover:text-[var(--brand-text)]">SDK</a>
			<span>/</span>
			<span>Vectorize</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Vectorize</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Build semantic search, knowledge bases, and RAG systems with Cloudflare Vectorize.
		</p>
	</div>

	<!-- Quick Example -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Quick Example</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} createVectorClient {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk/vectorize'</span>

<span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} env {'}'}) {'{'}
  <span class="text-[var(--brand-text-muted)]">const</span> vectors = <span class="text-[var(--brand-text)]">createVectorClient</span>(env)

  <span class="text-[var(--brand-text-muted)]">// Store text with auto-generated embeddings</span>
  <span class="text-[var(--brand-text-muted)]">await</span> vectors.<span class="text-[var(--brand-text)]">storeText</span>({'{'}
    id: <span class="text-[var(--color-success)]">'doc-1'</span>,
    text: <span class="text-[var(--color-success)]">'Cloudflare Workers run JavaScript at the edge...'</span>,
    metadata: {'{'} source: <span class="text-[var(--color-success)]">'docs'</span> {'}'}
  {'}'})

  <span class="text-[var(--brand-text-muted)]">// Semantic search</span>
  <span class="text-[var(--brand-text-muted)]">const</span> results = <span class="text-[var(--brand-text-muted)]">await</span> vectors.<span class="text-[var(--brand-text)]">searchText</span>({'{'}
    query: <span class="text-[var(--color-success)]">'How do edge functions work?'</span>,
    topK: 5
  {'}'})
{'}'}</code></pre>
		</div>
	</section>

	<!-- RAG -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">RAG (Retrieval Augmented Generation)</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Build knowledge bases and answer questions using your documents:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">// Build knowledge base</span>
<span class="text-[var(--brand-text-muted)]">await</span> vectors.<span class="text-[var(--brand-text)]">buildKnowledgeBase</span>({'{'}
  documents: [
    {'{'} id: <span class="text-[var(--color-success)]">'guide-1'</span>, content: <span class="text-[var(--color-success)]">'...'</span>, metadata: {'{'} type: <span class="text-[var(--color-success)]">'guide'</span> {'}'} {'}'},
    {'{'} id: <span class="text-[var(--color-success)]">'api-ref'</span>, content: <span class="text-[var(--color-success)]">'...'</span>, metadata: {'{'} type: <span class="text-[var(--color-success)]">'reference'</span> {'}'} {'}'}
  ],
  chunkSize: 500,
  overlap: 50
{'}'})

<span class="text-[var(--brand-text-muted)]">// RAG query</span>
<span class="text-[var(--brand-text-muted)]">const</span> answer = <span class="text-[var(--brand-text-muted)]">await</span> vectors.<span class="text-[var(--brand-text)]">rag</span>({'{'}
  query: <span class="text-[var(--color-success)]">'How do I handle OAuth tokens?'</span>,
  topK: 5,
  generationModel: AIModels.LLAMA_3_8B
{'}'})

<span class="text-[var(--brand-text-muted)]">{'// answer.data = {'}</span>
<span class="text-[var(--brand-text-muted)]">{'//   answer: "To handle OAuth tokens...",'}</span>
<span class="text-[var(--brand-text-muted)]">{'//   sources: [{ id, score, text }]'}</span>
<span class="text-[var(--brand-text-muted)]">{'// }'}</span></code></pre>
		</div>
	</section>

	<!-- Methods -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Available Methods</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">storeText()</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Store text with auto-generated embeddings</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">searchText()</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Semantic text search</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">buildKnowledgeBase()</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Chunk and index documents</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">rag()</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Search + generate answer</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">upsert() / query()</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Raw vector operations</p>
			</div>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/storage" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Storage & Cache</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">KV storage and caching utilities.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Next <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/ai-workflows" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">AI Workflow Guide</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Build complete AI-powered workflows.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

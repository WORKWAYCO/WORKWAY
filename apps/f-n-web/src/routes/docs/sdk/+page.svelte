<script lang="ts">
	import { Code2, Package, ArrowRight, Copy, Check, Cpu, Database, Globe, Zap, FileJson, Clock } from 'lucide-svelte';

	let copied = $state(false);

	async function copyInstall() {
		await navigator.clipboard.writeText('npm install @workway/sdk');
		copied = true;
		setTimeout(() => copied = false, 2000);
	}
</script>

<svelte:head>
	<title>SDK Overview | WORKWAY Docs</title>
	<meta name="description" content="WORKWAY SDK for building TypeScript workflows. Full type safety, Workers AI, integrations, and more." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>SDK</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">SDK Overview</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			The official TypeScript SDK for building WORKWAY workflows. Full type safety, IDE autocomplete, and Cloudflare-native.
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
				<span class="text-[var(--brand-text-muted)]">$</span> npm install <span class="text-[var(--brand-text)]">@workway/sdk</span>
			</div>
		</div>
	</section>

	<!-- Quick Example -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Quick Example</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow, webhook {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'Stripe to Notion Invoice Tracker'</span>,
  type: <span class="text-[var(--color-success)]">'integration'</span>,

  integrations: [
    {'{'} service: <span class="text-[var(--color-success)]">'stripe'</span>, scopes: [<span class="text-[var(--color-success)]">'read_payments'</span>] {'}'},
    {'{'} service: <span class="text-[var(--color-success)]">'notion'</span>, scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>] {'}'}
  ],

  inputs: {'{'}
    notionDatabaseId: {'{'} type: <span class="text-[var(--color-success)]">'notion_database_picker'</span>, required: <span class="text-[var(--color-success)]">true</span> {'}'}
  {'}'},

  trigger: <span class="text-[var(--brand-text)]">webhook</span>({'{'} service: <span class="text-[var(--color-success)]">'stripe'</span>, event: <span class="text-[var(--color-success)]">'payment_intent.succeeded'</span> {'}'}),

  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} trigger, inputs, integrations {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">const</span> payment = trigger.data.object

    <span class="text-[var(--brand-text-muted)]">await</span> integrations.notion.pages.<span class="text-[var(--brand-text)]">create</span>({'{'}
      parent: {'{'} database_id: inputs.notionDatabaseId {'}'},
      properties: {'{'}
        <span class="text-[var(--color-success)]">'Amount'</span>: {'{'} number: payment.amount / 100 {'}'},
        <span class="text-[var(--color-success)]">'Customer'</span>: {'{'} email: payment.receipt_email {'}'},
        <span class="text-[var(--color-success)]">'Date'</span>: {'{'} date: {'{'} start: <span class="text-[var(--brand-text-muted)]">new</span> Date().toISOString() {'}'} {'}'}
      {'}'}
    {'}'})

    <span class="text-[var(--brand-text-muted)]">return</span> {'{'} success: <span class="text-[var(--color-success)]">true</span> {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- SDK Modules -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-6">SDK Modules</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/workflows" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Code2 size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Workflows</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Core workflow definition, types, inputs, and pricing configuration.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/sdk/triggers" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Zap size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Triggers</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Webhook, schedule, manual, and poll trigger configuration.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/sdk/workers-ai" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Cpu size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Workers AI</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Text generation, embeddings, images, and audio transcription.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/sdk/vectorize" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Database size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Vectorize</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Semantic search, RAG, and knowledge base building.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/sdk/storage" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<FileJson size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Storage & Cache</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">KV storage, R2 object storage, and caching utilities.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 opacity-60">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Globe size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold">HTTP</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">HTTP client with retry, timeout, and response handling.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--brand-text-muted)]">
					Coming soon
				</span>
			</div>
		</div>
	</section>

	<!-- Core Exports -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Core Exports</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">@workway/sdk</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">// Workflow definition</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">// Triggers</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} webhook, schedule, manual, poll {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">// Workers AI</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} createAIClient, AIModels {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk/workers-ai'</span>

<span class="text-[var(--brand-text-muted)]">// Vectorize</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} createVectorClient {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk/vectorize'</span>

<span class="text-[var(--brand-text-muted)]">// Utilities</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} http, transform, createCache, createKVStorage {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span></code></pre>
		</div>
	</section>

	<!-- Workflow Types -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Workflow Types</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			The SDK automatically optimizes execution based on workflow type:
		</p>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--brand-border)]">
						<th class="text-left py-3 px-4 font-semibold">Type</th>
						<th class="text-left py-3 px-4 font-semibold">Cost</th>
						<th class="text-left py-3 px-4 font-semibold">Best For</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-[var(--brand-border)]">
						<td class="py-3 px-4 font-mono text-[var(--color-success)]">'integration'</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">~$0.001/exec</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">API-to-API, data sync, webhooks</td>
					</tr>
					<tr class="border-b border-[var(--brand-border)]">
						<td class="py-3 px-4 font-mono text-[var(--color-success)]">'ai-enhanced'</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">~$0.01/exec</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">Classification, sentiment, routing</td>
					</tr>
					<tr>
						<td class="py-3 px-4 font-mono text-[var(--color-success)]">'ai-native'</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">~$0.03/exec</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">Content generation, RAG, multi-step AI</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- TypeScript Support -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">TypeScript Support</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			The SDK is written in TypeScript and provides full type safety:
		</p>
		<ul class="space-y-2 text-[var(--color-fg-secondary)]">
			<li class="flex items-start gap-2">
				<span class="text-[var(--color-success)]">✓</span>
				<span>Autocomplete for all SDK functions and options</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-[var(--color-success)]">✓</span>
				<span>Type-safe integration clients with API documentation</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-[var(--color-success)]">✓</span>
				<span>Compile-time validation of workflow configuration</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-[var(--color-success)]">✓</span>
				<span>Inferred types for trigger payloads and inputs</span>
			</li>
		</ul>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/workflows" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Workflow Reference</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Deep dive into workflow configuration options.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View reference <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/sdk/workers-ai" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Workers AI</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Add AI capabilities to your workflows.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Explore AI <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

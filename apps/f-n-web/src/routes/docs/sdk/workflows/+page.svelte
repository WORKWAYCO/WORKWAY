<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Workflows | WORKWAY Docs</title>
	<meta name="description" content="WORKWAY workflow definition reference. Types, inputs, pricing, and configuration options." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/sdk" class="hover:text-[var(--brand-text)]">SDK</a>
			<span>/</span>
			<span>Workflows</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Workflow Reference</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Complete reference for workflow definition, types, inputs, and configuration.
		</p>
	</div>

	<!-- defineWorkflow -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">defineWorkflow()</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			The main function for creating workflows. Returns a workflow object that can be exported.
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  <span class="text-[var(--brand-text-muted)]">// Required</span>
  name: <span class="text-[var(--color-success)]">string</span>,
  type: <span class="text-[var(--color-success)]">'integration'</span> | <span class="text-[var(--color-success)]">'ai-enhanced'</span> | <span class="text-[var(--color-success)]">'ai-native'</span>,
  trigger: Trigger,
  execute: (context: ExecutionContext) => Promise&lt;any&gt;,

  <span class="text-[var(--brand-text-muted)]">// Optional</span>
  description?: <span class="text-[var(--color-success)]">string</span>,
  integrations?: Integration[],
  inputs?: Record&lt;<span class="text-[var(--color-success)]">string</span>, InputDefinition&gt;,
  pricing?: PricingConfig,
{'}'})</code></pre>
		</div>
	</section>

	<!-- Inputs -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Input Types</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">'text'</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Single-line text input</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">'number'</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Numeric input with optional min/max</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">'boolean'</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Checkbox toggle</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">'select'</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Dropdown with predefined options</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">'notion_database_picker'</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Notion database selector (requires Notion integration)</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">'slack_channel_picker'</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Slack channel selector (requires Slack integration)</p>
			</div>
		</div>
	</section>

	<!-- Pricing -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Pricing Configuration</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">// Subscription pricing</span>
pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'subscription'</span>,
  price: 10,        <span class="text-[var(--brand-text-muted)]">// $/month</span>
  executions: 100   <span class="text-[var(--brand-text-muted)]">// per month</span>
{'}'}

<span class="text-[var(--brand-text-muted)]">// Usage-based pricing</span>
pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'usage'</span>,
  pricePerExecution: 0.10,
  minPrice: 5
{'}'}

<span class="text-[var(--brand-text-muted)]">// One-time purchase</span>
pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'one-time'</span>,
  price: 29
{'}'}</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/triggers" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Triggers</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Webhook, schedule, manual, and poll triggers.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Next <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/concepts" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Core Concepts</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Understand the workflow execution model.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

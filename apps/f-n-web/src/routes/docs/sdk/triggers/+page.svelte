<script lang="ts">
	import { ArrowRight, Webhook, Clock, MousePointer, RefreshCw } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Triggers | WORKWAY Docs</title>
	<meta name="description" content="WORKWAY trigger reference. Webhook, schedule, manual, and poll triggers." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/sdk" class="hover:text-[var(--brand-text)]">SDK</a>
			<span>/</span>
			<span>Triggers</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Triggers</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Triggers define when and how your workflow executes.
		</p>
	</div>

	<!-- Webhook -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<Webhook size={24} class="text-[var(--color-fg-secondary)]" />
			<h2 class="text-xl font-semibold">webhook()</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Triggered instantly when an external service sends an event.
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} webhook {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

trigger: <span class="text-[var(--brand-text)]">webhook</span>({'{'}
  service: <span class="text-[var(--color-success)]">'zoom'</span>,
  event: <span class="text-[var(--color-success)]">'recording.completed'</span>
{'}'})</code></pre>
		</div>
		<p class="text-sm text-[var(--brand-text-muted)] mt-4">
			The <code class="font-mono bg-[var(--color-hover)] px-1 rounded">trigger.data</code> in execute() contains the webhook payload.
		</p>
	</section>

	<!-- Schedule -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<Clock size={24} class="text-[var(--color-fg-secondary)]" />
			<h2 class="text-xl font-semibold">schedule()</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Runs on a schedule using cron expressions.
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} schedule {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">// Daily at 8am UTC</span>
trigger: <span class="text-[var(--brand-text)]">schedule</span>(<span class="text-[var(--color-success)]">'0 8 * * *'</span>)

<span class="text-[var(--brand-text-muted)]">// Every hour</span>
trigger: <span class="text-[var(--brand-text)]">schedule</span>(<span class="text-[var(--color-success)]">'0 * * * *'</span>)

<span class="text-[var(--brand-text-muted)]">// Every Monday at 9am</span>
trigger: <span class="text-[var(--brand-text)]">schedule</span>(<span class="text-[var(--color-success)]">'0 9 * * 1'</span>)</code></pre>
		</div>
	</section>

	<!-- Manual -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<MousePointer size={24} class="text-[var(--color-fg-secondary)]" />
			<h2 class="text-xl font-semibold">manual()</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Triggered by user clicking a button in the dashboard.
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} manual {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

trigger: <span class="text-[var(--brand-text)]">manual</span>()</code></pre>
		</div>
	</section>

	<!-- Poll -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<RefreshCw size={24} class="text-[var(--color-fg-secondary)]" />
			<h2 class="text-xl font-semibold">poll()</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Periodically checks for new data from a service.
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} poll {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

trigger: <span class="text-[var(--brand-text)]">poll</span>({'{'}
  service: <span class="text-[var(--color-success)]">'airtable'</span>,
  interval: <span class="text-[var(--color-success)]">'15m'</span>,  <span class="text-[var(--brand-text-muted)]">// 15 minutes</span>
  query: <span class="text-[var(--color-success)]">'filterByFormula=...'</span>
{'}'})</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/workers-ai" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Workers AI</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Add AI capabilities to your workflows.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Next <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/integrations" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Integrations</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Connect to external services.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View integrations <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

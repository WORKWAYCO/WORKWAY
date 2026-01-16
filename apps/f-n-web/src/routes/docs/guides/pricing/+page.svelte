<script lang="ts">
	import { ArrowRight, DollarSign } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Pricing Your Workflow | WORKWAY Docs</title>
	<meta name="description" content="Set pricing for WORKWAY workflows. Subscription, usage-based, and one-time pricing models." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/guides" class="hover:text-[var(--brand-text)]">Guides</a>
			<span>/</span>
			<span>Pricing</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Pricing Your Workflow</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Set the right price for your workflow and maximize earnings.
		</p>
	</div>

	<!-- Pricing Models -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Pricing Models</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<DollarSign size={20} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Subscription</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">Most Common</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Monthly fee with included executions.</p>
				<div class="border border-[var(--brand-border)] rounded overflow-hidden">
					<pre class="p-3 text-sm font-mono"><code class="text-[var(--color-fg-secondary)]">pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'subscription'</span>,
  price: 10,        <span class="text-[var(--brand-text-muted)]">// $/month</span>
  executions: 100   <span class="text-[var(--brand-text-muted)]">// included</span>
{'}'}</code></pre>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<DollarSign size={20} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Usage-Based</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Pay per execution with optional minimum.</p>
				<div class="border border-[var(--brand-border)] rounded overflow-hidden">
					<pre class="p-3 text-sm font-mono"><code class="text-[var(--color-fg-secondary)]">pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'usage'</span>,
  pricePerExecution: 0.10,
  minPrice: 5  <span class="text-[var(--brand-text-muted)]">// optional minimum</span>
{'}'}</code></pre>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<DollarSign size={20} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">One-Time</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Single purchase, unlimited use.</p>
				<div class="border border-[var(--brand-border)] rounded overflow-hidden">
					<pre class="p-3 text-sm font-mono"><code class="text-[var(--color-fg-secondary)]">pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'one-time'</span>,
  price: 29
{'}'}</code></pre>
				</div>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<DollarSign size={20} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">Tiered</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">Multiple subscription tiers.</p>
				<div class="border border-[var(--brand-border)] rounded overflow-hidden">
					<pre class="p-3 text-sm font-mono"><code class="text-[var(--color-fg-secondary)]">pricing: {'{'}
  model: <span class="text-[var(--color-success)]">'subscription'</span>,
  tiers: [
    {'{'} name: <span class="text-[var(--color-success)]">'starter'</span>, price: 10, executions: 50 {'}'},
    {'{'} name: <span class="text-[var(--color-success)]">'pro'</span>, price: 25, executions: 200 {'}'},
    {'{'} name: <span class="text-[var(--color-success)]">'enterprise'</span>, price: 99, executions: 1000 {'}'}
  ]
{'}'}</code></pre>
				</div>
			</div>
		</div>
	</section>

	<!-- Cost Estimation -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Estimating Your Costs</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--brand-border)]">
						<th class="text-left py-3 px-4 font-semibold">Workflow Type</th>
						<th class="text-left py-3 px-4 font-semibold">Cost/Execution</th>
						<th class="text-left py-3 px-4 font-semibold">Suggested Price</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-[var(--brand-border)]">
						<td class="py-3 px-4 font-mono text-[var(--color-success)]">'integration'</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">~$0.001</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">$5-10/mo for 100 exec</td>
					</tr>
					<tr class="border-b border-[var(--brand-border)]">
						<td class="py-3 px-4 font-mono text-[var(--color-success)]">'ai-enhanced'</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">~$0.01</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">$15-25/mo for 100 exec</td>
					</tr>
					<tr>
						<td class="py-3 px-4 font-mono text-[var(--color-success)]">'ai-native'</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">~$0.03</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">$25-50/mo for 50 exec</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Revenue Split -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Revenue Split</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--color-hover)]">
			<div class="grid md:grid-cols-2 gap-6">
				<div>
					<h3 class="font-semibold mb-2">Original Workflows</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">You: 80% • Platform: 20%</p>
				</div>
				<div>
					<h3 class="font-semibold mb-2">Forked Workflows</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">You: 68% • Original: 12% • Platform: 20%</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CLI Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Estimate with CLI</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Estimate AI workflow costs</span>
$ workway ai estimate --executions 1000 --tokens 500

<span class="text-[var(--brand-text-muted)]"># With specific model</span>
$ workway ai estimate --executions 1000 --tokens 500 --model LLAMA_3_8B</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/cli/publishing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Publishing</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Publish your priced workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/first-workflow" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Build Your First Workflow</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Start from scratch.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Start building <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

<script lang="ts">
	import { ArrowRight, CheckCircle2 } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Publishing | WORKWAY Docs</title>
	<meta name="description" content="Publish WORKWAY workflows to the marketplace. Developer profile, pricing, and access control." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/cli" class="hover:text-[var(--brand-text)]">CLI</a>
			<span>/</span>
			<span>Publishing</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Publishing Workflows</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Publish your workflows to the WORKWAY marketplace and start earning.
		</p>
	</div>

	<!-- Prerequisites -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Prerequisites</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--color-hover)]">
			<ul class="space-y-3">
				<li class="flex items-start gap-3">
					<CheckCircle2 size={18} class="text-[var(--color-success)] mt-0.5 shrink-0" />
					<div>
						<span class="font-medium">Developer Profile</span>
						<span class="text-[var(--brand-text-muted)]"> — Create with <code class="font-mono bg-[var(--brand-bg)] px-1 rounded">workway developer init</code></span>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<CheckCircle2 size={18} class="text-[var(--color-success)] mt-0.5 shrink-0" />
					<div>
						<span class="font-medium">Profile Approved</span>
						<span class="text-[var(--brand-text-muted)]"> — Submit for review with <code class="font-mono bg-[var(--brand-bg)] px-1 rounded">workway developer submit</code></span>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<CheckCircle2 size={18} class="text-[var(--color-success)] mt-0.5 shrink-0" />
					<div>
						<span class="font-medium">Stripe Connected</span>
						<span class="text-[var(--brand-text-muted)]"> — Set up with <code class="font-mono bg-[var(--brand-bg)] px-1 rounded">workway developer stripe setup</code></span>
					</div>
				</li>
			</ul>
		</div>
	</section>

	<!-- Developer Setup -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Developer Setup</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Step 1: Create profile</span>
$ workway developer init

<span class="text-[var(--brand-text-muted)]"># Step 2: Submit for review</span>
$ workway developer submit

<span class="text-[var(--brand-text-muted)]"># Step 3: Check status</span>
$ workway developer status

<span class="text-[var(--brand-text-muted)]"># Step 4: Set up Stripe (for payouts)</span>
$ workway developer stripe setup</code></pre>
		</div>
	</section>

	<!-- Publishing -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Publish a Workflow</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Build and publish</span>
$ workway workflow publish

<span class="text-[var(--brand-text-muted)]"># Publish as draft (not public)</span>
$ workway workflow publish --draft</code></pre>
		</div>
	</section>

	<!-- Access Grants -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Private Workflow Access</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Control access to private workflows:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Grant access by email domain</span>
$ workway workflow access-grants create wf_abc123 \
  --grant-type email_domain \
  --grant-value company.com

<span class="text-[var(--brand-text-muted)]"># Grant access to specific user</span>
$ workway workflow access-grants create wf_abc123 \
  --grant-type user \
  --grant-value user@example.com

<span class="text-[var(--brand-text-muted)]"># Create shareable access code</span>
$ workway workflow access-grants create wf_abc123 \
  --grant-type access_code \
  --max-installs 50

<span class="text-[var(--brand-text-muted)]"># List grants</span>
$ workway workflow access-grants list wf_abc123

<span class="text-[var(--brand-text-muted)]"># Revoke grant</span>
$ workway workflow access-grants revoke grant_xyz</code></pre>
		</div>
	</section>

	<!-- Forking -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Workflow Forking</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Fork existing workflows and share revenue:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># Fork a workflow</span>
$ workway workflow fork meeting-intelligence

<span class="text-[var(--brand-text-muted)]"># View lineage</span>
$ workway workflow lineage</code></pre>
		</div>
		<div class="mt-4 border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--color-hover)]">
			<p class="text-sm text-[var(--color-fg-secondary)]">
				<strong>Revenue split for forks:</strong><br/>
				You (fork creator): 68% • Original creator: 12% • Platform: 20%
			</p>
		</div>
	</section>

	<!-- Earnings -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">View Earnings</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]"># View all earnings</span>
$ workway developer earnings

<span class="text-[var(--brand-text-muted)]"># This week</span>
$ workway developer earnings --period week

<span class="text-[var(--brand-text-muted)]"># This month</span>
$ workway developer earnings --period month</code></pre>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/guides/pricing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Pricing Guide</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Set pricing for your workflows.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
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

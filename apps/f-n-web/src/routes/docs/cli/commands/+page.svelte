<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>CLI Commands | WORKWAY Docs</title>
	<meta name="description" content="Complete WORKWAY CLI command reference. All commands, options, and examples." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/cli" class="hover:text-[var(--brand-text)]">CLI</a>
			<span>/</span>
			<span>Commands</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">CLI Commands</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Complete reference for all WORKWAY CLI commands.
		</p>
	</div>

	<!-- Workflow Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Workflow Commands</h2>
		<div class="space-y-3">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow init [name]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Create a new workflow project</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--ai  Create AI-powered template</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow dev</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Start development server with hot reload</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--port, --no-mock</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow test</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Test workflow execution locally</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--mock, --live, --data</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow build</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Build workflow for production</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--minify, --sourcemap, --out-dir</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow publish</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Publish workflow to marketplace</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--draft</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow fork [workflow]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Fork a workflow from the marketplace</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway workflow delete [id]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Delete an inactive workflow</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--force, --keep-data</p>
			</div>
		</div>
	</section>

	<!-- Auth Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Authentication</h2>
		<div class="space-y-3">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway login</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Authenticate with WORKWAY platform</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway logout</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Clear local authentication</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway whoami</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Display current authenticated user</p>
			</div>
		</div>
	</section>

	<!-- OAuth Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">OAuth Management</h2>
		<div class="space-y-3">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway oauth connect [provider]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Connect an OAuth account for testing</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway oauth list</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">List connected OAuth accounts</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway oauth disconnect [provider]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Disconnect an OAuth account</p>
			</div>
		</div>
	</section>

	<!-- Agentic Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Agentic Commands</h2>
		<div class="space-y-3">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway create [prompt]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Generate a workflow from natural language</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--output</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway explain [file]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Get a plain-English explanation of a workflow</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--verbose, --brief, --focus</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway modify [file] [request]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Transform existing workflows with AI</p>
			</div>
		</div>
	</section>

	<!-- Developer Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Developer Profile</h2>
		<div class="space-y-3">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway developer init</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Create your developer profile</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway developer submit</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Submit profile for marketplace review</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway developer earnings</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">View earnings and payouts</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--period week|month</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway developer stripe [action]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Manage Stripe Connect (setup/status/refresh)</p>
			</div>
		</div>
	</section>

	<!-- AI Commands -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">AI Commands</h2>
		<div class="space-y-3">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway ai models</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">List available AI models with costs</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--type text|embeddings|image|audio</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway ai test [prompt]</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Test AI model with a prompt</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--mock, --model</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<code class="font-mono text-[var(--color-success)]">workway ai estimate</code>
				<p class="text-sm text-[var(--brand-text-muted)] mt-1">Estimate AI workflow costs</p>
				<p class="text-xs text-[var(--brand-text-muted)] mt-2 font-mono">--executions, --tokens, --model</p>
			</div>
		</div>
	</section>

	<!-- Next -->
	<section>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/cli/authentication" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Authentication</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Login, OAuth, and credentials management.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/cli/publishing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Publishing</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Publish workflows to the marketplace.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

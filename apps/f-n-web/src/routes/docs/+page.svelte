<script lang="ts">
	import { 
		Code2, 
		Terminal, 
		Plug, 
		Zap, 
		ArrowRight, 
		Copy, 
		Check,
		Cpu,
		Database,
		GitBranch,
		Package,
		Rocket,
		BookOpen
	} from 'lucide-svelte';

	let copied = $state(false);

	async function copyInstall() {
		await navigator.clipboard.writeText('npm install -g @workway/cli');
		copied = true;
		setTimeout(() => copied = false, 2000);
	}
</script>

<svelte:head>
	<title>Developer Documentation | WORKWAY</title>
	<meta name="description" content="Build TypeScript workflows on Cloudflare Workers. SDK, CLI, and 40+ integrations. Ship automation that scales." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Hero -->
	<div class="mb-16">
		<div class="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-hover)] border border-[var(--brand-border)] rounded-full text-xs font-mono mb-6">
			<span class="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse"></span>
			v2.1.0
		</div>
		<h1 class="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
			WORKWAY Developer Docs
		</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl leading-relaxed">
			TypeScript-native workflow automation on Cloudflare Workers. Build, test, and publish workflows with the tools you already use.
		</p>
	</div>

	<!-- Quick Install -->
	<section class="mb-16">
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--color-hover)] overflow-hidden">
			<div class="flex items-center justify-between px-4 py-3 border-b border-[var(--brand-border)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">Install CLI</span>
				<button 
					onclick={copyInstall}
					class="text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
					aria-label="Copy to clipboard"
				>
					{#if copied}
						<Check size={14} class="text-[var(--color-success)]" />
					{:else}
						<Copy size={14} />
					{/if}
				</button>
			</div>
			<div class="px-4 py-4 font-mono text-sm">
				<span class="text-[var(--brand-text-muted)]">$</span> npm install -g <span class="text-[var(--brand-text)]">@workway/cli</span>
			</div>
		</div>
	</section>

	<!-- Core Sections -->
	<section class="mb-16">
		<h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
			<Rocket size={20} class="text-[var(--color-fg-secondary)]" />
			Start Building
		</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/quickstart" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Zap size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Quickstart</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Create and deploy your first workflow in under 5 minutes.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Get started <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>

			<a href="/docs/concepts" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<BookOpen size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Core Concepts</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Understand workflows, triggers, integrations, and the execution model.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>

	<!-- SDK, CLI, Integrations -->
	<section class="mb-16">
		<h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
			<Package size={20} class="text-[var(--color-fg-secondary)]" />
			Reference
		</h2>
		<div class="grid md:grid-cols-3 gap-4">
			<a href="/docs/sdk" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center mb-3">
					<Code2 size={20} class="text-[var(--color-fg-secondary)]" />
				</div>
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">SDK</h3>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">TypeScript SDK for building workflows with full type safety.</p>
				<div class="mt-3 font-mono text-xs text-[var(--brand-text-muted)]">@workway/sdk</div>
			</a>

			<a href="/docs/cli" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center mb-3">
					<Terminal size={20} class="text-[var(--color-fg-secondary)]" />
				</div>
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">CLI</h3>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Command-line tools for development, testing, and publishing.</p>
				<div class="mt-3 font-mono text-xs text-[var(--brand-text-muted)]">@workway/cli</div>
			</a>

			<a href="/docs/integrations" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center mb-3">
					<Plug size={20} class="text-[var(--color-fg-secondary)]" />
				</div>
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Integrations</h3>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">40+ pre-built OAuth integrations for popular services.</p>
				<div class="mt-3 font-mono text-xs text-[var(--brand-text-muted)]">Zoom, Notion, Slack...</div>
			</a>
		</div>
	</section>

	<!-- AI & Infrastructure -->
	<section class="mb-16">
		<h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
			<Cpu size={20} class="text-[var(--color-fg-secondary)]" />
			AI & Infrastructure
		</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/workers-ai" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Cpu size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<div>
						<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Workers AI</h3>
						<span class="text-xs text-[var(--brand-text-muted)]">Cloudflare-native</span>
					</div>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Text generation, embeddings, and more. No API keys required.</p>
			</a>

			<a href="/docs/sdk/vectorize" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-[var(--brand-radius)] bg-[var(--color-hover)] flex items-center justify-center">
						<Database size={20} class="text-[var(--color-fg-secondary)]" />
					</div>
					<div>
						<h3 class="font-semibold group-hover:text-[var(--brand-text)]">Vectorize</h3>
						<span class="text-xs text-[var(--brand-text-muted)]">Semantic search</span>
					</div>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Build RAG systems and knowledge bases with vector search.</p>
			</a>
		</div>
	</section>

	<!-- Code Example -->
	<section class="mb-16">
		<h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
			<GitBranch size={20} class="text-[var(--color-fg-secondary)]" />
			Example Workflow
		</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow, webhook {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'Meeting Notes to Notion'</span>,
  type: <span class="text-[var(--color-success)]">'integration'</span>,

  integrations: [
    {'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, scopes: [<span class="text-[var(--color-success)]">'read_recordings'</span>] {'}'},
    {'{'} service: <span class="text-[var(--color-success)]">'notion'</span>, scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>] {'}'}
  ],

  trigger: <span class="text-[var(--brand-text)]">webhook</span>({'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, event: <span class="text-[var(--color-success)]">'recording.completed'</span> {'}'}),

  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} trigger, integrations {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">const</span> recording = trigger.data
    
    <span class="text-[var(--brand-text-muted)]">await</span> integrations.notion.pages.<span class="text-[var(--brand-text)]">create</span>({'{'}
      properties: {'{'}
        Title: recording.topic,
        Date: recording.start_time
      {'}'}
    {'}'})

    <span class="text-[var(--brand-text-muted)]">return</span> {'{'} success: <span class="text-[var(--color-success)]">true</span> {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Why WORKWAY -->
	<section class="mb-16">
		<h2 class="text-xl font-semibold mb-6">Why WORKWAY?</h2>
		<div class="grid md:grid-cols-2 gap-6">
			<div class="flex gap-4">
				<div class="w-8 h-8 rounded bg-[var(--color-hover)] flex items-center justify-center shrink-0">
					<Code2 size={16} class="text-[var(--color-fg-secondary)]" />
				</div>
				<div>
					<h3 class="font-medium mb-1">TypeScript-Native</h3>
					<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Full type safety, IDE autocomplete, and the npm ecosystem.</p>
				</div>
			</div>
			<div class="flex gap-4">
				<div class="w-8 h-8 rounded bg-[var(--color-hover)] flex items-center justify-center shrink-0">
					<Zap size={16} class="text-[var(--color-fg-secondary)]" />
				</div>
				<div>
					<h3 class="font-medium mb-1">Edge-First</h3>
					<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Runs on Cloudflare Workers. Global, fast, no cold starts.</p>
				</div>
			</div>
			<div class="flex gap-4">
				<div class="w-8 h-8 rounded bg-[var(--color-hover)] flex items-center justify-center shrink-0">
					<GitBranch size={16} class="text-[var(--color-fg-secondary)]" />
				</div>
				<div>
					<h3 class="font-medium mb-1">Git-Native</h3>
					<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Version control, CI/CD, code review. Your existing workflow.</p>
				</div>
			</div>
			<div class="flex gap-4">
				<div class="w-8 h-8 rounded bg-[var(--color-hover)] flex items-center justify-center shrink-0">
					<Cpu size={16} class="text-[var(--color-fg-secondary)]" />
				</div>
				<div>
					<h3 class="font-medium mb-1">AI-Ready</h3>
					<p class="text-sm text-[var(--brand-text-muted)] leading-relaxed">Workers AI built-in. 10-100x cheaper than external providers.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--color-hover)]">
			<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h2 class="text-lg font-semibold mb-1">Ready to build?</h2>
					<p class="text-sm text-[var(--brand-text-muted)]">Create your first workflow in under 5 minutes.</p>
				</div>
				<a
					href="/docs/quickstart"
					class="inline-flex items-center justify-center gap-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] px-5 py-2.5 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity"
				>
					Start Building <ArrowRight size={16} />
				</a>
			</div>
		</div>
	</section>
</div>

<script lang="ts">
	import { Copy, Check, ArrowRight, Terminal, Code2, Rocket, CheckCircle2 } from 'lucide-svelte';

	let copiedIndex = $state<number | null>(null);

	async function copyCode(code: string, index: number) {
		await navigator.clipboard.writeText(code);
		copiedIndex = index;
		setTimeout(() => copiedIndex = null, 2000);
	}

	const steps = [
		{
			title: 'Install the CLI',
			code: 'npm install -g @workway/cli',
			description: 'Install the WORKWAY CLI globally to access all development commands.'
		},
		{
			title: 'Authenticate',
			code: 'workway login',
			description: 'Opens a browser window to authenticate with your WORKWAY account.'
		},
		{
			title: 'Create a workflow',
			code: 'workway workflow init my-first-workflow',
			description: 'Scaffolds a new workflow project with TypeScript configuration.'
		},
		{
			title: 'Test locally',
			code: 'cd my-first-workflow && workway workflow test --mock',
			description: 'Run your workflow locally with mocked integrations.'
		},
		{
			title: 'Publish',
			code: 'workway workflow publish',
			description: 'Deploy your workflow to the WORKWAY platform.'
		}
	];
</script>

<svelte:head>
	<title>Quickstart | WORKWAY Docs</title>
	<meta name="description" content="Get started with WORKWAY in under 5 minutes. Install the CLI, create your first workflow, and deploy." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Quickstart</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Quickstart</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Create and deploy your first WORKWAY workflow in under 5 minutes.
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
						<span class="font-medium">Node.js 18+</span>
						<span class="text-[var(--brand-text-muted)]"> — Required for the CLI and local development</span>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<CheckCircle2 size={18} class="text-[var(--color-success)] mt-0.5 shrink-0" />
					<div>
						<span class="font-medium">WORKWAY Account</span>
						<span class="text-[var(--brand-text-muted)]"> — <a href="/auth/signup" class="text-[var(--brand-text)] hover:underline">Sign up free</a> if you don't have one</span>
					</div>
				</li>
			</ul>
		</div>
	</section>

	<!-- Steps -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-6">Steps</h2>
		<div class="space-y-6">
			{#each steps as step, i}
				<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
					<div class="flex items-center gap-4 px-5 py-4 border-b border-[var(--brand-border)]">
						<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm shrink-0">
							{i + 1}
						</div>
						<div class="flex-1">
							<h3 class="font-semibold">{step.title}</h3>
							<p class="text-sm text-[var(--brand-text-muted)]">{step.description}</p>
						</div>
					</div>
					<div class="flex items-center justify-between px-4 py-3 bg-[var(--color-hover)]">
						<code class="font-mono text-sm">
							<span class="text-[var(--brand-text-muted)]">$</span> {step.code}
						</code>
						<button 
							onclick={() => copyCode(step.code, i)}
							class="text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors p-1"
							aria-label="Copy to clipboard"
						>
							{#if copiedIndex === i}
								<Check size={14} class="text-[var(--color-success)]" />
							{:else}
								<Copy size={14} />
							{/if}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Project Structure -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Project Structure</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			After running <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">workway workflow init</code>, you'll have:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">my-first-workflow/</span>
			</div>
			<pre class="p-4 font-mono text-sm leading-relaxed"><code class="text-[var(--color-fg-secondary)]">├── workflow.ts          <span class="text-[var(--brand-text-muted)]"># Your workflow code</span>
├── workway.config.json  <span class="text-[var(--brand-text-muted)]"># Workflow metadata</span>
├── test-data.json       <span class="text-[var(--brand-text-muted)]"># Test fixtures</span>
├── package.json         <span class="text-[var(--brand-text-muted)]"># Dependencies</span>
└── tsconfig.json        <span class="text-[var(--brand-text-muted)]"># TypeScript config</span></code></pre>
		</div>
	</section>

	<!-- Basic Workflow -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Your First Workflow</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			The generated <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">workflow.ts</code> contains a starter template:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow, manual {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'My First Workflow'</span>,
  description: <span class="text-[var(--color-success)]">'A simple workflow to get started'</span>,
  type: <span class="text-[var(--color-success)]">'integration'</span>,

  <span class="text-[var(--brand-text-muted)]">// Trigger: manual button click</span>
  trigger: <span class="text-[var(--brand-text)]">manual</span>(),

  <span class="text-[var(--brand-text-muted)]">// User-configurable inputs</span>
  inputs: {'{'}
    message: {'{'}
      type: <span class="text-[var(--color-success)]">'text'</span>,
      label: <span class="text-[var(--color-success)]">'Message'</span>,
      default: <span class="text-[var(--color-success)]">'Hello, WORKWAY!'</span>
    {'}'}
  {'}'},

  <span class="text-[var(--brand-text-muted)]">// Workflow logic</span>
  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} inputs, log {'}'}) {'{'}
    log.info(<span class="text-[var(--color-success)]">'Workflow started'</span>, {'{'} message: inputs.message {'}'})
    
    <span class="text-[var(--brand-text-muted)]">// Your logic here</span>
    <span class="text-[var(--brand-text-muted)]">const</span> result = {'{'}
      processed: <span class="text-[var(--color-success)]">true</span>,
      message: inputs.message,
      timestamp: <span class="text-[var(--brand-text-muted)]">new</span> Date().toISOString()
    {'}'}

    log.info(<span class="text-[var(--color-success)]">'Workflow completed'</span>, result)
    <span class="text-[var(--brand-text-muted)]">return</span> result
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/concepts" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Core Concepts</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Understand workflows, triggers, and integrations.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/sdk" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">SDK Reference</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Explore the full SDK API and capabilities.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View SDK <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/integrations" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Integrations</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Connect to Zoom, Notion, Slack, and 40+ services.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Browse integrations <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/ai-workflows" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">AI Workflows</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Add AI capabilities with Cloudflare Workers AI.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Build with AI <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>

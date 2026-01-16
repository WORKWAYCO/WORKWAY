<script lang="ts">
	import { Terminal, Check, ArrowRight, Copy, Zap, FileCode, Play } from 'lucide-svelte';

	let copiedStep = $state<number | null>(null);

	async function copyCommand(command: string, step: number) {
		await navigator.clipboard.writeText(command);
		copiedStep = step;
		setTimeout(() => copiedStep = null, 2000);
	}

	const steps = [
		{
			title: 'Install the CLI',
			description: 'Install the WORKWAY CLI globally to create and manage workflows.',
			command: 'npm install -g @workway/cli',
		},
		{
			title: 'Authenticate',
			description: 'Log in to your WORKWAY account. This opens a browser for authentication.',
			command: 'workway login',
		},
		{
			title: 'Create a workflow',
			description: 'Initialize a new workflow project with the SDK and TypeScript configured.',
			command: 'workway workflow init my-first-workflow',
		},
		{
			title: 'Start development',
			description: 'Run the local development server with hot reload.',
			command: 'cd my-first-workflow && workway workflow dev',
		},
	];
</script>

<svelte:head>
	<title>Quickstart | WORKWAY Docs</title>
	<meta name="description" content="Get started with WORKWAY in 5 minutes. Install the CLI, create a workflow, and deploy." />
</svelte:head>

<article class="docs-page">
	<!-- Breadcrumb -->
	<nav class="breadcrumb">
		<a href="/docs">Docs</a>
		<span class="separator">/</span>
		<span class="current">Quickstart</span>
	</nav>

	<!-- Header -->
	<header class="page-header">
		<div class="header-icon">
			<Zap size={24} />
		</div>
		<h1 class="page-title">Quickstart</h1>
		<p class="page-description">
			Build and deploy your first workflow in under 5 minutes.
		</p>
	</header>

	<!-- Prerequisites -->
	<section class="section">
		<h2 class="section-title">Prerequisites</h2>
		<div class="prereq-list">
			<div class="prereq-item">
				<Check size={16} class="prereq-icon" />
				<span>Node.js 18+ installed</span>
			</div>
			<div class="prereq-item">
				<Check size={16} class="prereq-icon" />
				<span>A WORKWAY account (<a href="/auth/signup">sign up free</a>)</span>
			</div>
		</div>
	</section>

	<!-- Steps -->
	<section class="section">
		<h2 class="section-title">Setup Steps</h2>
		<div class="steps-list">
			{#each steps as step, i}
				<div class="step-card">
					<div class="step-number">{i + 1}</div>
					<div class="step-content">
						<h3 class="step-title">{step.title}</h3>
						<p class="step-description">{step.description}</p>
						<button 
							class="step-command"
							onclick={() => copyCommand(step.command, i)}
						>
							<Terminal size={14} class="command-icon" />
							<code>{step.command}</code>
							{#if copiedStep === i}
								<Check size={14} class="copy-success" />
							{:else}
								<Copy size={14} class="copy-icon" />
							{/if}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Project Structure -->
	<section class="section">
		<h2 class="section-title">Project Structure</h2>
		<p class="section-description">
			After running <code>workway workflow init</code>, you'll have:
		</p>
		<div class="file-tree">
			<div class="tree-item folder">
				<FileCode size={14} />
				<span>my-first-workflow/</span>
			</div>
			<div class="tree-item file indent-1">
				<FileCode size={14} />
				<span>workflow.ts</span>
				<span class="file-desc">— Your workflow code</span>
			</div>
			<div class="tree-item file indent-1">
				<FileCode size={14} />
				<span>test-data.json</span>
				<span class="file-desc">— Sample trigger data</span>
			</div>
			<div class="tree-item file indent-1">
				<FileCode size={14} />
				<span>package.json</span>
				<span class="file-desc">— Dependencies</span>
			</div>
			<div class="tree-item file indent-1">
				<FileCode size={14} />
				<span>workway.config.json</span>
				<span class="file-desc">— Project config</span>
			</div>
		</div>
	</section>

	<!-- Sample Workflow -->
	<section class="section">
		<h2 class="section-title">Your First Workflow</h2>
		<p class="section-description">
			The generated <code>workflow.ts</code> contains a simple example:
		</p>
		<div class="code-block">
			<div class="code-header">
				<span class="code-filename">workflow.ts</span>
			</div>
			<pre class="code-content"><code><span class="code-keyword">import</span> {'{'} defineWorkflow, manual {'}'} <span class="code-keyword">from</span> <span class="code-string">'@workway/sdk'</span>

<span class="code-keyword">export default</span> <span class="code-function">defineWorkflow</span>({'{'}
  <span class="code-property">name</span>: <span class="code-string">'My First Workflow'</span>,
  <span class="code-property">description</span>: <span class="code-string">'A simple workflow to get started'</span>,
  <span class="code-property">type</span>: <span class="code-string">'integration'</span>,

  <span class="code-comment">// Manual trigger — click to run</span>
  <span class="code-property">trigger</span>: <span class="code-function">manual</span>(),

  <span class="code-comment">// User inputs</span>
  <span class="code-property">inputs</span>: {'{'}
    <span class="code-property">message</span>: {'{'}
      <span class="code-property">type</span>: <span class="code-string">'text'</span>,
      <span class="code-property">label</span>: <span class="code-string">'Your message'</span>,
      <span class="code-property">required</span>: <span class="code-keyword">true</span>
    {'}'}
  {'}'},

  <span class="code-comment">// Workflow logic</span>
  <span class="code-keyword">async</span> <span class="code-function">execute</span>({'{'} inputs, log {'}'}) {'{'}
    log.<span class="code-function">info</span>(<span class="code-string">'Workflow started'</span>, {'{'} <span class="code-property">message</span>: inputs.message {'}'})
    
    <span class="code-comment">// Your logic here</span>
    <span class="code-keyword">const</span> result = {'{'}
      <span class="code-property">processed</span>: inputs.message.toUpperCase(),
      <span class="code-property">timestamp</span>: <span class="code-keyword">new</span> <span class="code-function">Date</span>().<span class="code-function">toISOString</span>()
    {'}'}

    <span class="code-keyword">return</span> {'{'} <span class="code-property">success</span>: <span class="code-keyword">true</span>, <span class="code-property">data</span>: result {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Test & Deploy -->
	<section class="section">
		<h2 class="section-title">Test & Deploy</h2>
		<div class="action-cards">
			<div class="action-card">
				<div class="action-icon">
					<Play size={20} />
				</div>
				<h3 class="action-title">Test locally</h3>
				<p class="action-description">Run your workflow with mock data</p>
				<button 
					class="action-command"
					onclick={() => copyCommand('workway workflow test --mock', 10)}
				>
					<code>workway workflow test --mock</code>
					{#if copiedStep === 10}
						<Check size={14} class="copy-success" />
					{:else}
						<Copy size={14} class="copy-icon" />
					{/if}
				</button>
			</div>
			<div class="action-card">
				<div class="action-icon highlight">
					<Zap size={20} />
				</div>
				<h3 class="action-title">Deploy to production</h3>
				<p class="action-description">Publish to the WORKWAY marketplace</p>
				<button 
					class="action-command"
					onclick={() => copyCommand('workway workflow publish', 11)}
				>
					<code>workway workflow publish</code>
					{#if copiedStep === 11}
						<Check size={14} class="copy-success" />
					{:else}
						<Copy size={14} class="copy-icon" />
					{/if}
				</button>
			</div>
		</div>
	</section>

	<!-- Next Steps -->
	<section class="section">
		<h2 class="section-title">Next Steps</h2>
		<div class="next-links">
			<a href="/docs/workflows" class="next-link">
				<div class="next-content">
					<h3>Learn about workflows</h3>
					<p>Understand triggers, integrations, and the execute function</p>
				</div>
				<ArrowRight size={16} class="next-arrow" />
			</a>
			<a href="/docs/sdk/workers-ai" class="next-link">
				<div class="next-content">
					<h3>Add AI capabilities</h3>
					<p>Use Workers AI for text generation, embeddings, and more</p>
				</div>
				<ArrowRight size={16} class="next-arrow" />
			</a>
			<a href="/docs/integrations" class="next-link">
				<div class="next-content">
					<h3>Connect integrations</h3>
					<p>Slack, Notion, GitHub, Zoom, and 20+ more services</p>
				</div>
				<ArrowRight size={16} class="next-arrow" />
			</a>
		</div>
	</section>
</article>

<style>
	.docs-page {
		max-width: 800px;
	}

	/* Breadcrumb */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		margin-bottom: 24px;
	}

	.breadcrumb a {
		color: var(--docs-text-muted);
		text-decoration: none;
	}

	.breadcrumb a:hover {
		color: var(--docs-text);
	}

	.separator {
		color: var(--docs-text-muted);
	}

	.current {
		color: var(--docs-text-secondary);
	}

	/* Header */
	.page-header {
		margin-bottom: 48px;
	}

	.header-icon {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--docs-accent-muted);
		border-radius: 12px;
		color: var(--docs-accent);
		margin-bottom: 16px;
	}

	.page-title {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-bottom: 8px;
	}

	.page-description {
		font-size: 18px;
		color: var(--docs-text-secondary);
	}

	/* Sections */
	.section {
		margin-bottom: 48px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 16px;
	}

	.section-description {
		color: var(--docs-text-secondary);
		margin-bottom: 16px;
	}

	.section-description code {
		padding: 2px 6px;
		background: var(--docs-bg-elevated);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 13px;
	}

	/* Prerequisites */
	.prereq-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.prereq-item {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		color: var(--docs-text-secondary);
	}

	:global(.prereq-icon) {
		color: var(--docs-success);
	}

	.prereq-item a {
		color: var(--docs-accent);
		text-decoration: none;
	}

	.prereq-item a:hover {
		text-decoration: underline;
	}

	/* Steps */
	.steps-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.step-card {
		display: flex;
		gap: 16px;
		padding: 20px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
	}

	.step-number {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--docs-accent);
		color: white;
		font-size: 14px;
		font-weight: 600;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.step-content {
		flex: 1;
	}

	.step-title {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.step-description {
		font-size: 14px;
		color: var(--docs-text-muted);
		margin-bottom: 12px;
	}

	.step-command {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: var(--docs-bg-surface);
		border: 1px solid var(--docs-border);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.step-command:hover {
		border-color: var(--docs-border-emphasis);
	}

	.step-command code {
		font-family: var(--docs-font-mono);
		font-size: 13px;
		color: var(--docs-text);
	}

	:global(.command-icon) {
		color: var(--docs-text-muted);
	}

	:global(.copy-icon) {
		color: var(--docs-text-muted);
	}

	:global(.copy-success) {
		color: var(--docs-success);
	}

	/* File Tree */
	.file-tree {
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		padding: 16px;
		font-family: var(--docs-font-mono);
		font-size: 13px;
	}

	.tree-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		color: var(--docs-text-secondary);
	}

	.tree-item.folder {
		color: var(--docs-accent);
	}

	.tree-item.indent-1 {
		padding-left: 24px;
	}

	.file-desc {
		color: var(--docs-text-muted);
		margin-left: 8px;
	}

	/* Code Block */
	.code-block {
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		overflow: hidden;
	}

	.code-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--docs-border);
	}

	.code-filename {
		font-family: var(--docs-font-mono);
		font-size: 13px;
		color: var(--docs-text-muted);
	}

	.code-content {
		padding: 20px;
		margin: 0;
		overflow-x: auto;
		font-family: var(--docs-font-mono);
		font-size: 13px;
		line-height: 1.7;
	}

	.code-keyword { color: #c678dd; }
	.code-string { color: #98c379; }
	.code-function { color: #61afef; }
	.code-property { color: #e5c07b; }
	.code-comment { color: #5c6370; font-style: italic; }

	/* Action Cards */
	.action-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 16px;
	}

	.action-card {
		padding: 20px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
	}

	.action-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--docs-bg-surface);
		border-radius: 10px;
		color: var(--docs-text-secondary);
		margin-bottom: 12px;
	}

	.action-icon.highlight {
		background: var(--docs-accent-muted);
		color: var(--docs-accent);
	}

	.action-title {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.action-description {
		font-size: 13px;
		color: var(--docs-text-muted);
		margin-bottom: 12px;
	}

	.action-command {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		background: var(--docs-bg-surface);
		border: 1px solid var(--docs-border);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-command:hover {
		border-color: var(--docs-border-emphasis);
	}

	.action-command code {
		flex: 1;
		text-align: left;
		font-family: var(--docs-font-mono);
		font-size: 12px;
		color: var(--docs-text);
	}

	/* Next Links */
	.next-links {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.next-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.next-link:hover {
		border-color: var(--docs-accent);
		background: var(--docs-accent-muted);
	}

	.next-content h3 {
		font-size: 14px;
		font-weight: 600;
		color: var(--docs-text);
		margin-bottom: 2px;
	}

	.next-content p {
		font-size: 13px;
		color: var(--docs-text-muted);
	}

	:global(.next-arrow) {
		color: var(--docs-text-muted);
		transition: transform 0.15s ease;
	}

	.next-link:hover :global(.next-arrow) {
		transform: translateX(4px);
		color: var(--docs-accent);
	}
</style>

<script lang="ts">
	import { ArrowRight, Terminal, Zap, Cpu, Puzzle, Code2, BookOpen, ExternalLink, Copy, Check } from 'lucide-svelte';

	let copied = $state(false);

	async function copyInstall() {
		await navigator.clipboard.writeText('npm install -g @workway/cli');
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	const features = [
		{
			icon: Zap,
			title: 'TypeScript-First',
			description: 'Full type safety and autocomplete. Build workflows with confidence.'
		},
		{
			icon: Cpu,
			title: '50+ AI Models',
			description: 'Cloudflare Workers AI at $0.01/1M tokens. No API keys required.'
		},
		{
			icon: Puzzle,
			title: 'Built-in OAuth',
			description: 'Slack, Notion, GitHub, Zoom, and more. Pre-built integrations.'
		},
		{
			icon: Terminal,
			title: 'Edge Deployment',
			description: '<50ms cold starts globally. Runs on Cloudflare Workers.'
		}
	];

	const quickLinks = [
		{ href: '/docs/quickstart', label: 'Quickstart Guide', description: 'Build your first workflow in 5 minutes' },
		{ href: '/docs/sdk', label: 'SDK Reference', description: 'Complete API documentation' },
		{ href: '/docs/cli', label: 'CLI Reference', description: 'Command-line tools' },
		{ href: '/docs/guides/ai-workflows', label: 'AI Workflows', description: 'Build with Workers AI' },
	];
</script>

<svelte:head>
	<title>WORKWAY Documentation | Build Workflow Automations</title>
	<meta name="description" content="Build powerful workflow automations with TypeScript. Cloudflare-native, AI-ready, developer-first." />

	<!-- Open Graph -->
	<meta property="og:title" content="WORKWAY Documentation" />
	<meta property="og:description" content="Build powerful workflow automations with TypeScript. Cloudflare-native, AI-ready, developer-first." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://docs.workway.co" />

	<!-- JSON-LD -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "TechArticle",
		"headline": "WORKWAY Documentation",
		"description": "Build powerful workflow automations with TypeScript on Cloudflare Workers",
		"publisher": {
			"@type": "Organization",
			"name": "WORKWAY",
			"url": "https://workway.co"
		}
	}
	</script>`}
</svelte:head>

<article class="docs-intro">
	<!-- Hero -->
	<header class="hero">
		<div class="hero-badge">
			<span class="badge-dot"></span>
			<span>v1.0 — Now Generally Available</span>
		</div>
		<h1 class="hero-title">
			Build workflow automations<br />
			<span class="hero-gradient">with TypeScript</span>
		</h1>
		<p class="hero-description">
			WORKWAY is automation infrastructure for AI-native developers. 
			TypeScript workflows on Cloudflare Workers. Built for developers, cheaper at scale.
		</p>

		<!-- Install Command -->
		<div class="install-block">
			<div class="install-label">Get started</div>
			<button class="install-command" onclick={copyInstall}>
				<Terminal size={16} class="install-icon" />
				<code>npm install -g @workway/cli</code>
				{#if copied}
					<Check size={16} class="copy-icon success" />
				{:else}
					<Copy size={16} class="copy-icon" />
				{/if}
			</button>
		</div>

		<!-- Quick Actions -->
		<div class="hero-actions">
			<a href="/docs/quickstart" class="action-primary">
				Quickstart
				<ArrowRight size={16} />
			</a>
			<a href="https://github.com/workwayco/workway" target="_blank" rel="noopener" class="action-secondary">
				View on GitHub
				<ExternalLink size={14} />
			</a>
		</div>
	</header>

	<!-- Features Grid -->
	<section class="features-section">
		<div class="features-grid">
			{#each features as feature}
				{@const Icon = feature.icon}
				<div class="feature-card">
					<div class="feature-icon">
						<Icon size={20} />
					</div>
					<h3 class="feature-title">{feature.title}</h3>
					<p class="feature-description">{feature.description}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Code Example -->
	<section class="code-section">
		<div class="code-header">
			<h2 class="section-title">
				<Code2 size={20} />
				Simple, powerful workflows
			</h2>
			<p class="section-description">
				Define workflows with TypeScript. Full type safety, autocomplete, and error checking.
			</p>
		</div>

		<div class="code-block">
			<div class="code-tabs">
				<button class="code-tab active">workflow.ts</button>
			</div>
			<pre class="code-content"><code><span class="code-keyword">import</span> {'{'} defineWorkflow, webhook {'}'} <span class="code-keyword">from</span> <span class="code-string">'@workway/sdk'</span>

<span class="code-keyword">export default</span> <span class="code-function">defineWorkflow</span>({'{'}
  <span class="code-property">name</span>: <span class="code-string">'Meeting Notes to Notion'</span>,
  <span class="code-property">type</span>: <span class="code-string">'ai-enhanced'</span>,

  <span class="code-property">integrations</span>: [
    {'{'} <span class="code-property">service</span>: <span class="code-string">'zoom'</span>, <span class="code-property">scopes</span>: [<span class="code-string">'read_meetings'</span>] {'}'},
    {'{'} <span class="code-property">service</span>: <span class="code-string">'notion'</span>, <span class="code-property">scopes</span>: [<span class="code-string">'write_pages'</span>] {'}'}
  ],

  <span class="code-property">trigger</span>: <span class="code-function">webhook</span>({'{'} <span class="code-property">service</span>: <span class="code-string">'zoom'</span>, <span class="code-property">event</span>: <span class="code-string">'meeting.ended'</span> {'}'}),

  <span class="code-keyword">async</span> <span class="code-function">execute</span>({'{'} trigger, integrations, ai {'}'}) {'{'}
    <span class="code-keyword">const</span> transcript = <span class="code-keyword">await</span> integrations.zoom.<span class="code-function">getTranscript</span>(trigger.data.meetingId)
    
    <span class="code-comment">// AI summarization with Workers AI — no API keys needed</span>
    <span class="code-keyword">const</span> summary = <span class="code-keyword">await</span> ai.<span class="code-function">generateText</span>({'{'}
      <span class="code-property">model</span>: <span class="code-string">'@cf/meta/llama-3-8b-instruct'</span>,
      <span class="code-property">prompt</span>: <span class="code-string">`Summarize this meeting:\n${'{'}transcript{'}'}`</span>
    {'}'})

    <span class="code-keyword">await</span> integrations.notion.pages.<span class="code-function">create</span>({'{'}
      <span class="code-property">parent</span>: {'{'} <span class="code-property">database_id</span>: <span class="code-string">'meetings-db'</span> {'}'},
      <span class="code-property">properties</span>: {'{'}
        <span class="code-property">'Title'</span>: {'{'} <span class="code-property">title</span>: [{'{'} <span class="code-property">text</span>: {'{'} <span class="code-property">content</span>: trigger.data.topic {'}'} {'}'}] {'}'},
        <span class="code-property">'Summary'</span>: {'{'} <span class="code-property">rich_text</span>: [{'{'} <span class="code-property">text</span>: {'{'} <span class="code-property">content</span>: summary {'}'} {'}'}] {'}'}
      {'}'}
    {'}'})

    <span class="code-keyword">return</span> {'{'} <span class="code-property">success</span>: <span class="code-keyword">true</span> {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Quick Links -->
	<section class="links-section">
		<h2 class="section-title">
			<BookOpen size={20} />
			Explore the docs
		</h2>
		<div class="links-grid">
			{#each quickLinks as link}
				<a href={link.href} class="link-card">
					<h3 class="link-title">
						{link.label}
						<ArrowRight size={14} class="link-arrow" />
					</h3>
					<p class="link-description">{link.description}</p>
				</a>
			{/each}
		</div>
	</section>

	<!-- Cost Comparison -->
	<section class="cost-section">
		<h2 class="section-title">
			<Zap size={20} />
			Built for scale
		</h2>
		<p class="section-description">
			WORKWAY runs on Cloudflare Workers. Edge-native, globally distributed, cost-efficient.
		</p>

		<div class="cost-grid">
			<div class="cost-card">
				<div class="cost-label">Integration Workflow</div>
				<div class="cost-value">$0.001</div>
				<div class="cost-unit">per execution</div>
				<p class="cost-description">API-to-API, data sync, webhooks</p>
			</div>
			<div class="cost-card highlight">
				<div class="cost-label">AI-Enhanced Workflow</div>
				<div class="cost-value">$0.01</div>
				<div class="cost-unit">per execution</div>
				<p class="cost-description">With Workers AI (Llama 3, Mistral)</p>
			</div>
			<div class="cost-card">
				<div class="cost-label">Workers AI</div>
				<div class="cost-value">$0.01</div>
				<div class="cost-unit">per 1M tokens</div>
				<p class="cost-description">10-100x cheaper than OpenAI</p>
			</div>
		</div>
	</section>
</article>

<style>
	.docs-intro {
		max-width: 900px;
	}

	/* Hero */
	.hero {
		margin-bottom: 64px;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: var(--docs-accent-muted);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 20px;
		font-size: 13px;
		color: var(--docs-accent);
		margin-bottom: 24px;
	}

	.badge-dot {
		width: 6px;
		height: 6px;
		background: var(--docs-success);
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.hero-title {
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.03em;
		margin-bottom: 20px;
	}

	.hero-gradient {
		background: linear-gradient(135deg, var(--docs-accent) 0%, #a855f7 50%, #ec4899 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-description {
		font-size: 18px;
		line-height: 1.6;
		color: var(--docs-text-secondary);
		max-width: 600px;
		margin-bottom: 32px;
	}

	/* Install Block */
	.install-block {
		margin-bottom: 24px;
	}

	.install-label {
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--docs-text-muted);
		margin-bottom: 8px;
	}

	.install-command {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.install-command:hover {
		border-color: var(--docs-border-emphasis);
	}

	.install-command code {
		font-family: var(--docs-font-mono);
		font-size: 14px;
		color: var(--docs-text);
	}

	:global(.install-icon) {
		color: var(--docs-text-muted);
	}

	:global(.copy-icon) {
		color: var(--docs-text-muted);
		margin-left: 8px;
	}

	:global(.copy-icon.success) {
		color: var(--docs-success);
	}

	/* Hero Actions */
	.hero-actions {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.action-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: var(--docs-accent);
		color: white;
		text-decoration: none;
		font-weight: 500;
		border-radius: var(--docs-radius);
		transition: all 0.15s ease;
	}

	.action-primary:hover {
		background: var(--docs-accent-hover);
	}

	.action-secondary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		color: var(--docs-text-secondary);
		text-decoration: none;
		font-weight: 500;
		border-radius: var(--docs-radius);
		transition: all 0.15s ease;
	}

	.action-secondary:hover {
		border-color: var(--docs-border-emphasis);
		color: var(--docs-text);
	}

	/* Features */
	.features-section {
		margin-bottom: 64px;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.feature-card {
		padding: 20px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		transition: all 0.15s ease;
	}

	.feature-card:hover {
		border-color: var(--docs-border-emphasis);
	}

	.feature-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--docs-accent-muted);
		border-radius: 8px;
		color: var(--docs-accent);
		margin-bottom: 12px;
	}

	.feature-title {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 6px;
	}

	.feature-description {
		font-size: 13px;
		color: var(--docs-text-muted);
		line-height: 1.5;
	}

	/* Code Section */
	.code-section {
		margin-bottom: 64px;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 20px;
		font-weight: 600;
		margin-bottom: 8px;
		color: var(--docs-text);
	}

	.section-description {
		font-size: 15px;
		color: var(--docs-text-secondary);
		margin-bottom: 24px;
	}

	.code-block {
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		overflow: hidden;
	}

	.code-tabs {
		display: flex;
		border-bottom: 1px solid var(--docs-border);
		padding: 0 16px;
	}

	.code-tab {
		padding: 12px 16px;
		background: none;
		border: none;
		font-family: var(--docs-font-mono);
		font-size: 13px;
		color: var(--docs-text-muted);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.code-tab.active {
		color: var(--docs-accent);
		border-bottom-color: var(--docs-accent);
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

	/* Links Section */
	.links-section {
		margin-bottom: 64px;
	}

	.links-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.link-card {
		padding: 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.link-card:hover {
		border-color: var(--docs-accent);
		background: var(--docs-accent-muted);
	}

	.link-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		color: var(--docs-text);
		margin-bottom: 4px;
	}

	:global(.link-arrow) {
		color: var(--docs-text-muted);
		transition: transform 0.15s ease;
	}

	.link-card:hover :global(.link-arrow) {
		transform: translateX(4px);
		color: var(--docs-accent);
	}

	.link-description {
		font-size: 13px;
		color: var(--docs-text-muted);
	}

	/* Cost Section */
	.cost-section {
		margin-bottom: 64px;
	}

	.cost-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 16px;
	}

	.cost-card {
		padding: 20px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		text-align: center;
	}

	.cost-card.highlight {
		border-color: var(--docs-accent);
		background: var(--docs-accent-muted);
	}

	.cost-label {
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--docs-text-muted);
		margin-bottom: 8px;
	}

	.cost-value {
		font-size: 28px;
		font-weight: 700;
		color: var(--docs-text);
		margin-bottom: 2px;
	}

	.cost-unit {
		font-size: 13px;
		color: var(--docs-text-secondary);
		margin-bottom: 12px;
	}

	.cost-description {
		font-size: 12px;
		color: var(--docs-text-muted);
	}

	@media (max-width: 640px) {
		.hero-title {
			font-size: 1.75rem;
		}

		.hero-description {
			font-size: 16px;
		}

		.install-command {
			width: 100%;
			justify-content: space-between;
		}

		.hero-actions {
			flex-direction: column;
		}

		.action-primary,
		.action-secondary {
			width: 100%;
			justify-content: center;
		}
	}
</style>

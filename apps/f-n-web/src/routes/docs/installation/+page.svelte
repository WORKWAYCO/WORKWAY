<script lang="ts">
	import { Terminal, Check, Copy, AlertCircle, Info } from 'lucide-svelte';

	let copiedCommand = $state<string | null>(null);

	async function copyCommand(command: string) {
		await navigator.clipboard.writeText(command);
		copiedCommand = command;
		setTimeout(() => copiedCommand = null, 2000);
	}
</script>

<svelte:head>
	<title>Installation | WORKWAY Docs</title>
	<meta name="description" content="Install the WORKWAY CLI and SDK. Requirements, package managers, and troubleshooting." />
</svelte:head>

<article class="docs-page">
	<!-- Breadcrumb -->
	<nav class="breadcrumb">
		<a href="/docs">Docs</a>
		<span class="separator">/</span>
		<span class="current">Installation</span>
	</nav>

	<!-- Header -->
	<header class="page-header">
		<div class="header-icon">
			<Terminal size={24} />
		</div>
		<h1 class="page-title">Installation</h1>
		<p class="page-description">
			Install the WORKWAY CLI and SDK to start building workflows.
		</p>
	</header>

	<!-- Requirements -->
	<section class="section">
		<h2 class="section-title">Requirements</h2>
		<div class="requirements-list">
			<div class="requirement">
				<div class="req-header">
					<Check size={16} class="req-check" />
					<span class="req-name">Node.js 18+</span>
				</div>
				<p class="req-description">
					WORKWAY requires Node.js 18 or later. Check your version with <code>node --version</code>.
				</p>
			</div>
			<div class="requirement">
				<div class="req-header">
					<Check size={16} class="req-check" />
					<span class="req-name">npm, pnpm, or yarn</span>
				</div>
				<p class="req-description">
					Any modern package manager works. Examples below use npm.
				</p>
			</div>
		</div>
	</section>

	<!-- CLI Installation -->
	<section class="section">
		<h2 class="section-title">Install the CLI</h2>
		<p class="section-description">
			The WORKWAY CLI is the primary tool for creating, testing, and deploying workflows.
		</p>

		<div class="install-options">
			<div class="install-option">
				<h3 class="option-title">npm</h3>
				<button class="command-block" onclick={() => copyCommand('npm install -g @workway/cli')}>
					<code>npm install -g @workway/cli</code>
					{#if copiedCommand === 'npm install -g @workway/cli'}
						<Check size={14} class="copy-success" />
					{:else}
						<Copy size={14} class="copy-icon" />
					{/if}
				</button>
			</div>

			<div class="install-option">
				<h3 class="option-title">pnpm</h3>
				<button class="command-block" onclick={() => copyCommand('pnpm add -g @workway/cli')}>
					<code>pnpm add -g @workway/cli</code>
					{#if copiedCommand === 'pnpm add -g @workway/cli'}
						<Check size={14} class="copy-success" />
					{:else}
						<Copy size={14} class="copy-icon" />
					{/if}
				</button>
			</div>

			<div class="install-option">
				<h3 class="option-title">yarn</h3>
				<button class="command-block" onclick={() => copyCommand('yarn global add @workway/cli')}>
					<code>yarn global add @workway/cli</code>
					{#if copiedCommand === 'yarn global add @workway/cli'}
						<Check size={14} class="copy-success" />
					{:else}
						<Copy size={14} class="copy-icon" />
					{/if}
				</button>
			</div>
		</div>

		<div class="verify-block">
			<h3 class="verify-title">Verify installation</h3>
			<button class="command-block" onclick={() => copyCommand('workway --version')}>
				<code>workway --version</code>
				{#if copiedCommand === 'workway --version'}
					<Check size={14} class="copy-success" />
				{:else}
					<Copy size={14} class="copy-icon" />
				{/if}
			</button>
			<p class="verify-output">
				Should output something like: <code>@workway/cli 1.0.0</code>
			</p>
		</div>
	</section>

	<!-- SDK Installation -->
	<section class="section">
		<h2 class="section-title">Install the SDK</h2>
		<p class="section-description">
			The SDK is installed automatically when you create a new workflow project. For manual installation:
		</p>

		<button class="command-block" onclick={() => copyCommand('npm install @workway/sdk')}>
			<code>npm install @workway/sdk</code>
			{#if copiedCommand === 'npm install @workway/sdk'}
				<Check size={14} class="copy-success" />
			{:else}
				<Copy size={14} class="copy-icon" />
			{/if}
		</button>

		<div class="info-callout">
			<Info size={16} class="callout-icon" />
			<div class="callout-content">
				<strong>Note:</strong> When you run <code>workway workflow init</code>, the SDK is automatically added to your project's dependencies.
			</div>
		</div>
	</section>

	<!-- Authentication -->
	<section class="section">
		<h2 class="section-title">Authentication</h2>
		<p class="section-description">
			Log in to your WORKWAY account to deploy workflows and access the marketplace.
		</p>

		<button class="command-block" onclick={() => copyCommand('workway login')}>
			<code>workway login</code>
			{#if copiedCommand === 'workway login'}
				<Check size={14} class="copy-success" />
			{:else}
				<Copy size={14} class="copy-icon" />
			{/if}
		</button>

		<p class="section-description">
			This opens a browser window for authentication. After logging in, your credentials are stored locally at <code>~/.workway/config.json</code>.
		</p>

		<div class="auth-commands">
			<div class="auth-command">
				<code>workway whoami</code>
				<span class="auth-desc">Check current logged-in user</span>
			</div>
			<div class="auth-command">
				<code>workway logout</code>
				<span class="auth-desc">Clear local credentials</span>
			</div>
		</div>
	</section>

	<!-- Troubleshooting -->
	<section class="section">
		<h2 class="section-title">Troubleshooting</h2>

		<div class="troubleshoot-list">
			<div class="troubleshoot-item">
				<div class="trouble-header">
					<AlertCircle size={16} class="trouble-icon" />
					<h3>Permission denied (EACCES)</h3>
				</div>
				<p class="trouble-description">
					If you get permission errors when installing globally, try:
				</p>
				<button class="command-block small" onclick={() => copyCommand('npm config set prefix ~/.npm-global')}>
					<code>npm config set prefix ~/.npm-global</code>
					{#if copiedCommand === 'npm config set prefix ~/.npm-global'}
						<Check size={14} class="copy-success" />
					{:else}
						<Copy size={14} class="copy-icon" />
					{/if}
				</button>
				<p class="trouble-note">
					Then add <code>~/.npm-global/bin</code> to your PATH.
				</p>
			</div>

			<div class="troubleshoot-item">
				<div class="trouble-header">
					<AlertCircle size={16} class="trouble-icon" />
					<h3>Command not found</h3>
				</div>
				<p class="trouble-description">
					If <code>workway</code> isn't recognized after installation:
				</p>
				<ul class="trouble-steps">
					<li>Close and reopen your terminal</li>
					<li>Check that npm's global bin is in your PATH</li>
					<li>Try running with npx: <code>npx @workway/cli --version</code></li>
				</ul>
			</div>

			<div class="troubleshoot-item">
				<div class="trouble-header">
					<AlertCircle size={16} class="trouble-icon" />
					<h3>Node.js version too old</h3>
				</div>
				<p class="trouble-description">
					WORKWAY requires Node.js 18+. Update using:
				</p>
				<ul class="trouble-steps">
					<li><a href="https://nodejs.org" target="_blank" rel="noopener">Download from nodejs.org</a></li>
					<li>Or use nvm: <code>nvm install 20 && nvm use 20</code></li>
				</ul>
			</div>
		</div>
	</section>

	<!-- Next Steps -->
	<section class="section">
		<h2 class="section-title">Next Steps</h2>
		<div class="next-links">
			<a href="/docs/quickstart" class="next-link primary">
				<div class="next-content">
					<h3>Quickstart Guide</h3>
					<p>Create and deploy your first workflow</p>
				</div>
				<span class="next-arrow">→</span>
			</a>
			<a href="/docs/cli" class="next-link">
				<div class="next-content">
					<h3>CLI Reference</h3>
					<p>All available commands and options</p>
				</div>
				<span class="next-arrow">→</span>
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
		margin-bottom: 12px;
	}

	.section-description {
		color: var(--docs-text-secondary);
		margin-bottom: 16px;
		line-height: 1.6;
	}

	.section-description code {
		padding: 2px 6px;
		background: var(--docs-bg-elevated);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 13px;
	}

	/* Requirements */
	.requirements-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.requirement {
		padding: 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
	}

	.req-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	:global(.req-check) {
		color: var(--docs-success);
	}

	.req-name {
		font-weight: 600;
		font-size: 14px;
	}

	.req-description {
		font-size: 13px;
		color: var(--docs-text-muted);
	}

	.req-description code {
		padding: 2px 6px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 12px;
	}

	/* Install Options */
	.install-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-bottom: 24px;
	}

	.install-option {
		padding: 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
	}

	.option-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--docs-text-muted);
		margin-bottom: 10px;
	}

	/* Command Block */
	.command-block {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 10px 14px;
		background: var(--docs-bg-surface);
		border: 1px solid var(--docs-border);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.command-block:hover {
		border-color: var(--docs-border-emphasis);
	}

	.command-block.small {
		margin-bottom: 8px;
	}

	.command-block code {
		font-family: var(--docs-font-mono);
		font-size: 13px;
		color: var(--docs-text);
	}

	:global(.copy-icon) {
		color: var(--docs-text-muted);
	}

	:global(.copy-success) {
		color: var(--docs-success);
	}

	/* Verify Block */
	.verify-block {
		padding: 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
	}

	.verify-title {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 12px;
	}

	.verify-output {
		font-size: 13px;
		color: var(--docs-text-muted);
		margin-top: 12px;
	}

	.verify-output code {
		padding: 2px 6px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 12px;
	}

	/* Info Callout */
	.info-callout {
		display: flex;
		gap: 12px;
		padding: 16px;
		background: var(--docs-accent-muted);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: var(--docs-radius);
		margin-top: 16px;
	}

	:global(.callout-icon) {
		color: var(--docs-accent);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.callout-content {
		font-size: 14px;
		color: var(--docs-text-secondary);
		line-height: 1.5;
	}

	.callout-content code {
		padding: 2px 6px;
		background: rgba(99, 102, 241, 0.2);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 12px;
	}

	/* Auth Commands */
	.auth-commands {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 16px;
	}

	.auth-command {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 14px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: 6px;
	}

	.auth-command code {
		font-family: var(--docs-font-mono);
		font-size: 13px;
		color: var(--docs-text);
	}

	.auth-desc {
		font-size: 13px;
		color: var(--docs-text-muted);
	}

	/* Troubleshooting */
	.troubleshoot-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.troubleshoot-item {
		padding: 20px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
	}

	.trouble-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}

	:global(.trouble-icon) {
		color: var(--docs-warning);
	}

	.trouble-header h3 {
		font-size: 15px;
		font-weight: 600;
	}

	.trouble-description {
		font-size: 14px;
		color: var(--docs-text-secondary);
		margin-bottom: 12px;
	}

	.trouble-description code {
		padding: 2px 6px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 12px;
	}

	.trouble-note {
		font-size: 13px;
		color: var(--docs-text-muted);
	}

	.trouble-note code {
		padding: 2px 6px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 12px;
	}

	.trouble-steps {
		margin: 0;
		padding-left: 20px;
		font-size: 14px;
		color: var(--docs-text-secondary);
	}

	.trouble-steps li {
		margin-bottom: 6px;
	}

	.trouble-steps code {
		padding: 2px 6px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-mono);
		font-size: 12px;
	}

	.trouble-steps a {
		color: var(--docs-accent);
		text-decoration: none;
	}

	.trouble-steps a:hover {
		text-decoration: underline;
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
		border-color: var(--docs-border-emphasis);
	}

	.next-link.primary {
		border-color: var(--docs-accent);
		background: var(--docs-accent-muted);
	}

	.next-link.primary:hover {
		background: rgba(99, 102, 241, 0.2);
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

	.next-arrow {
		color: var(--docs-text-muted);
		font-size: 18px;
		transition: transform 0.15s ease;
	}

	.next-link:hover .next-arrow {
		transform: translateX(4px);
		color: var(--docs-accent);
	}
</style>

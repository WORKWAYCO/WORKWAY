<script lang="ts">
	import { page } from '$app/stores';
	import { 
		BookOpen, 
		Rocket, 
		Code2, 
		Terminal, 
		Puzzle, 
		Cpu, 
		FileCode, 
		Settings, 
		Zap,
		ChevronRight,
		Menu,
		X,
		Search,
		ExternalLink,
		Github
	} from 'lucide-svelte';

	let mobileMenuOpen = $state(false);
	let searchQuery = $state('');
	let searchOpen = $state(false);

	interface NavItem {
		href: string;
		label: string;
		icon?: typeof BookOpen;
		exact?: boolean;
		children?: NavItem[];
		badge?: string;
	}

	const navSections: { title: string; items: NavItem[] }[] = [
		{
			title: 'Getting Started',
			items: [
				{ href: '/docs', label: 'Introduction', icon: BookOpen, exact: true },
				{ href: '/docs/quickstart', label: 'Quickstart', icon: Rocket },
				{ href: '/docs/installation', label: 'Installation', icon: Terminal },
			]
		},
		{
			title: 'Core Concepts',
			items: [
				{ href: '/docs/workflows', label: 'Workflows', icon: Zap },
				{ href: '/docs/integrations', label: 'Integrations', icon: Puzzle },
				{ href: '/docs/triggers', label: 'Triggers', icon: Settings },
				{ href: '/docs/runtime', label: 'Workers Runtime', icon: Cpu },
			]
		},
		{
			title: 'SDK Reference',
			items: [
				{ href: '/docs/sdk', label: 'Overview', icon: Code2 },
				{ href: '/docs/sdk/define-workflow', label: 'defineWorkflow()', icon: FileCode },
				{ href: '/docs/sdk/workers-ai', label: 'Workers AI', icon: Cpu, badge: 'New' },
				{ href: '/docs/sdk/vectorize', label: 'Vectorize', icon: Puzzle },
				{ href: '/docs/sdk/http', label: 'HTTP Client', icon: ExternalLink },
				{ href: '/docs/sdk/storage', label: 'Storage', icon: Settings },
			]
		},
		{
			title: 'CLI Reference',
			items: [
				{ href: '/docs/cli', label: 'Overview', icon: Terminal },
				{ href: '/docs/cli/workflow', label: 'workflow commands', icon: FileCode },
				{ href: '/docs/cli/developer', label: 'developer commands', icon: Settings },
				{ href: '/docs/cli/ai', label: 'ai commands', icon: Cpu },
			]
		},
		{
			title: 'Guides',
			items: [
				{ href: '/docs/guides/first-workflow', label: 'Your First Workflow', icon: Rocket },
				{ href: '/docs/guides/ai-workflows', label: 'AI-Powered Workflows', icon: Cpu },
				{ href: '/docs/guides/testing', label: 'Testing Workflows', icon: Settings },
				{ href: '/docs/guides/deployment', label: 'Deployment', icon: Zap },
			]
		}
	];

	function isActive(href: string, exact: boolean = false): boolean {
		if (exact) {
			return $page.url.pathname === href;
		}
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			searchOpen = !searchOpen;
		}
		if (e.key === 'Escape') {
			searchOpen = false;
		}
	}
</script>

<svelte:head>
	<title>WORKWAY Docs | Developer Documentation</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="docs-layout">
	<!-- Header -->
	<header class="docs-header">
		<div class="header-content">
			<div class="header-left">
				<a href="/" class="logo">
					<span class="logo-text">WORKWAY</span>
					<span class="logo-divider">/</span>
					<span class="logo-docs">docs</span>
				</a>
			</div>

			<div class="header-center">
				<button 
					class="search-trigger"
					onclick={() => searchOpen = true}
				>
					<Search size={16} />
					<span>Search docs...</span>
					<kbd>⌘K</kbd>
				</button>
			</div>

			<div class="header-right">
				<nav class="header-nav">
					<a href="https://github.com/workwayco/workway" target="_blank" rel="noopener" class="nav-link">
						<Github size={18} />
					</a>
					<a href="/auth/login" class="nav-link">Sign in</a>
					<a href="/auth/signup" class="nav-cta">Get Started</a>
				</nav>
				<button
					class="mobile-menu-toggle"
					onclick={() => mobileMenuOpen = !mobileMenuOpen}
					aria-label="Toggle menu"
				>
					{#if mobileMenuOpen}
						<X size={24} />
					{:else}
						<Menu size={24} />
					{/if}
				</button>
			</div>
		</div>
	</header>

	<!-- Search Modal -->
	{#if searchOpen}
		<div class="search-overlay" onclick={() => searchOpen = false}>
			<div class="search-modal" onclick={(e) => e.stopPropagation()}>
				<div class="search-input-wrapper">
					<Search size={18} class="search-icon" />
					<input 
						type="text" 
						placeholder="Search documentation..." 
						bind:value={searchQuery}
						class="search-input"
						autofocus
					/>
					<kbd class="search-escape">ESC</kbd>
				</div>
				<div class="search-results">
					<p class="search-hint">Start typing to search...</p>
				</div>
			</div>
		</div>
	{/if}

	<div class="docs-container">
		<!-- Sidebar (Desktop) -->
		<aside class="docs-sidebar">
			<nav class="sidebar-nav">
				{#each navSections as section}
					<div class="nav-section">
						<h3 class="nav-section-title">{section.title}</h3>
						<ul class="nav-list">
							{#each section.items as item}
								{@const Icon = item.icon}
								{@const active = isActive(item.href, item.exact)}
								<li>
									<a
										href={item.href}
										class="nav-item"
										class:active
									>
										{#if Icon}
											<Icon size={16} class="nav-icon" />
										{/if}
										<span>{item.label}</span>
										{#if item.badge}
											<span class="nav-badge">{item.badge}</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</nav>
		</aside>

		<!-- Mobile Sidebar -->
		{#if mobileMenuOpen}
			<div class="mobile-overlay" onclick={() => mobileMenuOpen = false}>
				<aside class="mobile-sidebar" onclick={(e) => e.stopPropagation()}>
					<nav class="sidebar-nav">
						{#each navSections as section}
							<div class="nav-section">
								<h3 class="nav-section-title">{section.title}</h3>
								<ul class="nav-list">
									{#each section.items as item}
										{@const Icon = item.icon}
										{@const active = isActive(item.href, item.exact)}
										<li>
											<a
												href={item.href}
												onclick={() => mobileMenuOpen = false}
												class="nav-item"
												class:active
											>
												{#if Icon}
													<Icon size={16} class="nav-icon" />
												{/if}
												<span>{item.label}</span>
												{#if item.badge}
													<span class="nav-badge">{item.badge}</span>
												{/if}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</nav>
				</aside>
			</div>
		{/if}

		<!-- Main Content -->
		<main class="docs-main">
			<slot />
		</main>
	</div>
</div>

<style>
	/* DX Documentation Design System
	 * Inspired by Stripe, Vercel, and Linear docs
	 * Dark theme with electric accents
	 */

	:global(:root) {
		--docs-bg: #0a0a0b;
		--docs-bg-elevated: #111113;
		--docs-bg-surface: #18181b;
		--docs-border: rgba(255, 255, 255, 0.08);
		--docs-border-emphasis: rgba(255, 255, 255, 0.15);
		--docs-text: #fafafa;
		--docs-text-secondary: rgba(255, 255, 255, 0.7);
		--docs-text-muted: rgba(255, 255, 255, 0.5);
		--docs-accent: #6366f1;
		--docs-accent-hover: #818cf8;
		--docs-accent-muted: rgba(99, 102, 241, 0.15);
		--docs-success: #22c55e;
		--docs-warning: #f59e0b;
		--docs-error: #ef4444;
		--docs-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
		--docs-font-mono: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		--docs-radius: 8px;
		--docs-sidebar-width: 260px;
		--docs-header-height: 64px;
	}

	.docs-layout {
		min-height: 100vh;
		background: var(--docs-bg);
		color: var(--docs-text);
		font-family: var(--docs-font-sans);
	}

	/* Header */
	.docs-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: var(--docs-header-height);
		background: rgba(10, 10, 11, 0.8);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--docs-border);
		z-index: 100;
	}

	.header-content {
		max-width: 1440px;
		margin: 0 auto;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
	}

	.header-left {
		display: flex;
		align-items: center;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
		font-weight: 600;
	}

	.logo-text {
		color: var(--docs-text);
		font-size: 16px;
		letter-spacing: -0.02em;
	}

	.logo-divider {
		color: var(--docs-text-muted);
	}

	.logo-docs {
		color: var(--docs-accent);
		font-family: var(--docs-font-mono);
		font-size: 14px;
	}

	.header-center {
		flex: 1;
		display: flex;
		justify-content: center;
		padding: 0 24px;
	}

	.search-trigger {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: var(--docs-radius);
		color: var(--docs-text-muted);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s ease;
		min-width: 280px;
	}

	.search-trigger:hover {
		border-color: var(--docs-border-emphasis);
		color: var(--docs-text-secondary);
	}

	.search-trigger kbd {
		margin-left: auto;
		padding: 2px 6px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-sans);
		font-size: 11px;
		color: var(--docs-text-muted);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.header-nav {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nav-link {
		padding: 8px 12px;
		color: var(--docs-text-secondary);
		text-decoration: none;
		font-size: 14px;
		border-radius: var(--docs-radius);
		transition: all 0.15s ease;
	}

	.nav-link:hover {
		color: var(--docs-text);
		background: var(--docs-bg-elevated);
	}

	.nav-cta {
		padding: 8px 16px;
		background: var(--docs-accent);
		color: white;
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		border-radius: var(--docs-radius);
		transition: all 0.15s ease;
	}

	.nav-cta:hover {
		background: var(--docs-accent-hover);
	}

	.mobile-menu-toggle {
		display: none;
		padding: 8px;
		background: none;
		border: none;
		color: var(--docs-text-secondary);
		cursor: pointer;
	}

	/* Search Modal */
	.search-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		z-index: 200;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 120px;
	}

	.search-modal {
		width: 100%;
		max-width: 560px;
		background: var(--docs-bg-elevated);
		border: 1px solid var(--docs-border);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
	}

	.search-input-wrapper {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--docs-border);
	}

	:global(.search-icon) {
		color: var(--docs-text-muted);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--docs-text);
		font-size: 16px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--docs-text-muted);
	}

	.search-escape {
		padding: 4px 8px;
		background: var(--docs-bg-surface);
		border-radius: 4px;
		font-family: var(--docs-font-sans);
		font-size: 12px;
		color: var(--docs-text-muted);
	}

	.search-results {
		padding: 24px;
		min-height: 200px;
	}

	.search-hint {
		color: var(--docs-text-muted);
		font-size: 14px;
		text-align: center;
	}

	/* Container */
	.docs-container {
		display: flex;
		max-width: 1440px;
		margin: 0 auto;
		padding-top: var(--docs-header-height);
	}

	/* Sidebar */
	.docs-sidebar {
		position: sticky;
		top: var(--docs-header-height);
		width: var(--docs-sidebar-width);
		height: calc(100vh - var(--docs-header-height));
		overflow-y: auto;
		border-right: 1px solid var(--docs-border);
		padding: 24px 0;
		flex-shrink: 0;
	}

	.sidebar-nav {
		padding: 0 16px;
	}

	.nav-section {
		margin-bottom: 24px;
	}

	.nav-section-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--docs-text-muted);
		padding: 0 12px;
		margin-bottom: 8px;
	}

	.nav-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		color: var(--docs-text-secondary);
		text-decoration: none;
		font-size: 14px;
		border-radius: 6px;
		transition: all 0.15s ease;
	}

	.nav-item:hover {
		color: var(--docs-text);
		background: var(--docs-bg-elevated);
	}

	.nav-item.active {
		color: var(--docs-accent);
		background: var(--docs-accent-muted);
	}

	:global(.nav-icon) {
		color: var(--docs-text-muted);
		flex-shrink: 0;
	}

	.nav-item.active :global(.nav-icon) {
		color: var(--docs-accent);
	}

	.nav-badge {
		margin-left: auto;
		padding: 2px 6px;
		background: var(--docs-accent);
		color: white;
		font-size: 10px;
		font-weight: 600;
		border-radius: 4px;
		text-transform: uppercase;
	}

	/* Mobile Sidebar */
	.mobile-overlay {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 150;
	}

	.mobile-sidebar {
		position: absolute;
		left: 0;
		top: var(--docs-header-height);
		bottom: 0;
		width: 280px;
		background: var(--docs-bg);
		border-right: 1px solid var(--docs-border);
		overflow-y: auto;
		padding: 16px 0;
	}

	/* Main Content */
	.docs-main {
		flex: 1;
		min-width: 0;
		padding: 48px 64px;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.docs-sidebar {
			display: none;
		}

		.mobile-menu-toggle {
			display: block;
		}

		.mobile-overlay {
			display: block;
		}

		.header-nav {
			display: none;
		}

		.search-trigger {
			min-width: auto;
		}

		.search-trigger span {
			display: none;
		}

		.docs-main {
			padding: 32px 24px;
		}
	}

	@media (max-width: 640px) {
		.header-center {
			display: none;
		}
	}
</style>

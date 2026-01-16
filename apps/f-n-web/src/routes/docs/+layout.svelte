<script lang="ts">
	import { page } from '$app/stores';
	import { 
		BookOpen, 
		Code2, 
		Terminal, 
		Plug, 
		Zap, 
		FileCode, 
		Cpu, 
		Database,
		Rocket,
		Menu, 
		X,
		ChevronRight,
		ExternalLink,
		Github
	} from 'lucide-svelte';

	let mobileMenuOpen = $state(false);
	let expandedSections = $state<Record<string, boolean>>({
		'getting-started': true,
		'sdk': false,
		'cli': false,
		'integrations': false,
		'guides': false
	});

	interface NavItem {
		href: string;
		label: string;
		icon?: any;
		exact?: boolean;
		external?: boolean;
	}

	interface NavSection {
		id: string;
		label: string;
		icon: any;
		items: NavItem[];
	}

	const navSections: NavSection[] = [
		{
			id: 'getting-started',
			label: 'Getting Started',
			icon: Rocket,
			items: [
				{ href: '/docs', label: 'Overview', exact: true },
				{ href: '/docs/quickstart', label: 'Quickstart' },
				{ href: '/docs/concepts', label: 'Core Concepts' },
			]
		},
		{
			id: 'sdk',
			label: 'SDK',
			icon: Code2,
			items: [
				{ href: '/docs/sdk', label: 'Overview' },
				{ href: '/docs/sdk/workflows', label: 'Workflows' },
				{ href: '/docs/sdk/triggers', label: 'Triggers' },
				{ href: '/docs/sdk/workers-ai', label: 'Workers AI' },
				{ href: '/docs/sdk/vectorize', label: 'Vectorize' },
				{ href: '/docs/sdk/storage', label: 'Storage & Cache' },
			]
		},
		{
			id: 'cli',
			label: 'CLI',
			icon: Terminal,
			items: [
				{ href: '/docs/cli', label: 'Overview' },
				{ href: '/docs/cli/commands', label: 'Commands' },
				{ href: '/docs/cli/authentication', label: 'Authentication' },
				{ href: '/docs/cli/publishing', label: 'Publishing' },
			]
		},
		{
			id: 'integrations',
			label: 'Integrations',
			icon: Plug,
			items: [
				{ href: '/docs/integrations', label: 'Overview' },
				{ href: '/docs/integrations/oauth', label: 'OAuth Setup' },
				{ href: '/docs/integrations/catalog', label: 'Integration Catalog' },
			]
		},
		{
			id: 'guides',
			label: 'Guides',
			icon: BookOpen,
			items: [
				{ href: '/docs/guides/first-workflow', label: 'Your First Workflow' },
				{ href: '/docs/guides/ai-workflows', label: 'AI-Powered Workflows' },
				{ href: '/docs/guides/testing', label: 'Testing Workflows' },
				{ href: '/docs/guides/pricing', label: 'Pricing Your Workflow' },
			]
		}
	];

	const quickLinks = [
		{ href: 'https://github.com/workwayco/workway', label: 'GitHub', icon: Github, external: true },
	];

	function isActive(href: string, exact: boolean = false): boolean {
		if (exact) {
			return $page.url.pathname === href;
		}
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	function isSectionActive(section: NavSection): boolean {
		return section.items.some(item => isActive(item.href, item.exact));
	}

	function toggleSection(id: string) {
		expandedSections[id] = !expandedSections[id];
	}

	// Auto-expand active section
	$effect(() => {
		for (const section of navSections) {
			if (isSectionActive(section)) {
				expandedSections[section.id] = true;
			}
		}
	});
</script>

<svelte:head>
	<title>Developer Docs | WORKWAY</title>
	<meta name="description" content="WORKWAY developer documentation. Build, test, and publish TypeScript workflows on Cloudflare Workers." />
</svelte:head>

<div class="min-h-screen bg-[var(--brand-bg)]">
	<!-- Header -->
	<header class="border-b border-[var(--brand-border)] sticky top-0 bg-[var(--brand-bg)]/95 backdrop-blur-sm z-50">
		<div class="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<a href="/" class="text-lg font-bold font-mono tracking-tight hover:opacity-80 transition-opacity">WORKWAY</a>
				<span class="text-[var(--brand-text-muted)]">/</span>
				<a href="/docs" class="text-sm font-medium text-[var(--color-fg-secondary)] hover:text-[var(--brand-text)]">docs</a>
			</div>
			<div class="flex items-center gap-4">
				<nav class="hidden md:flex items-center gap-6">
					<a href="https://github.com/workwayco/workway" target="_blank" rel="noopener" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] flex items-center gap-1.5">
						<Github size={16} />
						GitHub
					</a>
					<a href="/pricing" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Pricing</a>
					<a href="/auth/login" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Sign in</a>
					<a href="/auth/signup" class="text-sm bg-[var(--brand-primary)] text-[var(--brand-bg)] px-4 py-1.5 rounded-[var(--brand-radius)] hover:opacity-90 transition-opacity">Get Started</a>
				</nav>
				<button
					class="md:hidden p-2 text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]"
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

	<div class="max-w-[1600px] mx-auto flex">
		<!-- Sidebar (Desktop) -->
		<aside class="hidden md:block w-72 flex-shrink-0 border-r border-[var(--brand-border)] sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
			<nav class="p-4">
				<!-- Search placeholder -->
				<div class="mb-6">
					<div class="flex items-center gap-2 px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm text-[var(--brand-text-muted)]">
						<span class="opacity-50">⌘K</span>
						<span>Search docs...</span>
					</div>
				</div>

				<!-- Nav sections -->
				<div class="space-y-1">
					{#each navSections as section}
						{@const Icon = section.icon}
						{@const isExpanded = expandedSections[section.id]}
						{@const sectionActive = isSectionActive(section)}
						
						<div class="mb-2">
							<button
								onclick={() => toggleSection(section.id)}
								class="w-full flex items-center justify-between px-3 py-2 rounded-[var(--brand-radius)] text-sm font-medium transition-colors {sectionActive ? 'text-[var(--brand-text)]' : 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]'}"
							>
								<span class="flex items-center gap-2">
									<Icon size={16} class="opacity-60" />
									{section.label}
								</span>
								<ChevronRight size={14} class="opacity-40 transition-transform {isExpanded ? 'rotate-90' : ''}" />
							</button>
							
							{#if isExpanded}
								<div class="ml-6 mt-1 space-y-0.5 border-l border-[var(--brand-border)] pl-3">
									{#each section.items as item}
										{@const active = isActive(item.href, item.exact)}
										<a
											href={item.href}
											class="block px-2 py-1.5 rounded text-sm transition-colors {active ? 'text-[var(--brand-text)] bg-[var(--color-hover)]' : 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]'}"
										>
											{item.label}
										</a>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Quick links -->
				<div class="mt-8 pt-4 border-t border-[var(--brand-border)]">
					<p class="px-3 text-xs font-medium text-[var(--brand-text-muted)] uppercase tracking-wider mb-2">Resources</p>
					{#each quickLinks as link}
						{@const Icon = link.icon}
						<a
							href={link.href}
							target={link.external ? '_blank' : undefined}
							rel={link.external ? 'noopener' : undefined}
							class="flex items-center gap-2 px-3 py-2 text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
						>
							<Icon size={14} />
							{link.label}
							{#if link.external}
								<ExternalLink size={12} class="opacity-40" />
							{/if}
						</a>
					{/each}
				</div>
			</nav>
		</aside>

		<!-- Mobile Sidebar -->
		{#if mobileMenuOpen}
			<div class="md:hidden fixed inset-0 z-40 bg-black/50" onclick={() => mobileMenuOpen = false}>
				<aside class="absolute left-0 top-[57px] bottom-0 w-72 bg-[var(--brand-bg)] border-r border-[var(--brand-border)] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
					<nav class="p-4">
						<div class="space-y-1">
							{#each navSections as section}
								{@const Icon = section.icon}
								{@const isExpanded = expandedSections[section.id]}
								
								<div class="mb-2">
									<button
										onclick={() => toggleSection(section.id)}
										class="w-full flex items-center justify-between px-3 py-2 rounded-[var(--brand-radius)] text-sm font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]"
									>
										<span class="flex items-center gap-2">
											<Icon size={16} class="opacity-60" />
											{section.label}
										</span>
										<ChevronRight size={14} class="opacity-40 transition-transform {isExpanded ? 'rotate-90' : ''}" />
									</button>
									
									{#if isExpanded}
										<div class="ml-6 mt-1 space-y-0.5 border-l border-[var(--brand-border)] pl-3">
											{#each section.items as item}
												{@const active = isActive(item.href, item.exact)}
												<a
													href={item.href}
													onclick={() => mobileMenuOpen = false}
													class="block px-2 py-1.5 rounded text-sm transition-colors {active ? 'text-[var(--brand-text)] bg-[var(--color-hover)]' : 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]'}"
												>
													{item.label}
												</a>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>

						<div class="border-t border-[var(--brand-border)] my-4 pt-4">
							<a href="/auth/login" class="block px-3 py-2 text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Sign in</a>
							<a href="/auth/signup" class="block px-3 py-2 text-sm text-[var(--brand-primary)]">Get Started</a>
						</div>
					</nav>
				</aside>
			</div>
		{/if}

		<!-- Main Content -->
		<main class="flex-1 min-w-0">
			<slot />
		</main>
	</div>
</div>

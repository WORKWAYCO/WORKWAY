<script lang="ts">
	import { page } from '$app/stores';
	import { BookOpen, Zap, Key, Database, Link2, DollarSign, Users, HelpCircle, Menu, X, Play } from 'lucide-svelte';

	let mobileMenuOpen = $state(false);

	const navItems = [
		{ href: '/docs', label: 'Overview', icon: BookOpen, exact: true },
		{ href: '/docs/tour', label: 'Interactive Tour', icon: Play, highlight: true },
		{ href: '/docs/getting-started', label: 'Getting Started', icon: Zap },
		{ href: '/docs/fireflies', label: 'Fireflies Setup', icon: Key },
		{ href: '/docs/notion', label: 'Notion Setup', icon: Database },
		{ href: '/docs/syncing', label: 'Syncing', icon: Link2 },
		{ href: '/docs/pricing', label: 'Pricing', icon: DollarSign },
		{ href: '/docs/admin', label: 'Admin Guide', icon: Users },
		{ href: '/docs/faq', label: 'FAQ', icon: HelpCircle },
	];

	function isActive(href: string, exact: boolean = false): boolean {
		if (exact) {
			return $page.url.pathname === href;
		}
		return $page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>Documentation | F→N</title>
</svelte:head>

<div class="min-h-screen bg-[var(--brand-bg)]">
	<!-- Header -->
	<header class="border-b border-[var(--brand-border)] sticky top-0 bg-[var(--brand-bg)] z-50">
		<div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="text-xl font-bold">F→N</a>
				<span class="text-[var(--brand-text-muted)]">/</span>
				<a href="/docs" class="text-sm font-medium">Docs</a>
			</div>
			<div class="flex items-center gap-4">
				<nav class="hidden md:flex items-center gap-6">
					<a href="/pricing" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Pricing</a>
					<a href="/auth/login" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Sign in</a>
					<a href="/auth/signup" class="text-sm bg-[var(--brand-primary)] text-[var(--brand-bg)] px-4 py-2 rounded-[var(--brand-radius)] hover:opacity-90">Get Started</a>
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

	<div class="max-w-7xl mx-auto flex">
		<!-- Sidebar (Desktop) -->
		<aside class="hidden md:block w-64 flex-shrink-0 border-r border-[var(--brand-border)] sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
			<nav class="p-4 space-y-1">
				{#each navItems as item}
					{@const Icon = item.icon}
					{@const active = isActive(item.href, item.exact)}
					<a
						href={item.href}
						class="flex items-center gap-3 px-3 py-2 rounded-[var(--brand-radius)] text-sm transition-colors {active ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-medium' : 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)]'}"
					>
						<Icon size={16} />
						{item.label}
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Mobile Sidebar -->
		{#if mobileMenuOpen}
			<div class="md:hidden fixed inset-0 z-40 bg-black/50" onclick={() => mobileMenuOpen = false}>
				<aside class="absolute left-0 top-[73px] bottom-0 w-64 bg-[var(--brand-bg)] border-r border-[var(--brand-border)] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
					<nav class="p-4 space-y-1">
						{#each navItems as item}
							{@const Icon = item.icon}
							{@const active = isActive(item.href, item.exact)}
							<a
								href={item.href}
								onclick={() => mobileMenuOpen = false}
								class="flex items-center gap-3 px-3 py-2 rounded-[var(--brand-radius)] text-sm transition-colors {active ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-medium' : 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)]'}"
							>
								<Icon size={16} />
								{item.label}
							</a>
						{/each}
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

	<!-- Footer -->
	<footer class="border-t border-[var(--brand-border)] mt-16">
		<div class="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-[var(--brand-text-muted)]">
			<p>F→N by <a href="https://halfdozen.co" target="_blank" rel="noopener" class="hover:text-[var(--brand-text)]">Half Dozen</a></p>
		</div>
	</footer>
</div>

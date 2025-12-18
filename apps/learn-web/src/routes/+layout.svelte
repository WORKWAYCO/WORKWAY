<script lang="ts">
	import '../app.css';
	import { BookOpen, Home, BarChart3, LogOut, User, Menu, X } from 'lucide-svelte';

	let { children, data } = $props();
	let isMenuOpen = $state(false);

	const navItems = [
		{ href: '/', label: 'Home' },
		{ href: '/paths', label: 'Paths' },
		{ href: '/progress', label: 'Progress' }
	];
</script>

<div class="min-h-screen flex flex-col">
	<!-- Header - matches workway-platform pattern -->
	<header class="sticky top-0 z-40 w-full border-b border-[var(--color-border-default)] bg-[var(--color-bg-pure)]">
		<div class="max-w-7xl mx-auto w-full py-sm px-page-x">
			<div class="flex items-center justify-between">
				<!-- Logo -->
				<a href="/" class="text-xl font-bold tracking-tight text-[var(--color-fg-primary)]">
					learn.workway.co
				</a>

				<!-- Desktop Navigation -->
				<div class="hidden md:flex items-center gap-8">
					{#each navItems as item}
						<a
							href={item.href}
							class="text-sm font-medium transition-colors text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
						>
							{item.label}
						</a>
					{/each}

					{#if data.user}
						<div class="flex items-center gap-md ml-md pl-md border-l border-[var(--color-border-default)]">
							<span class="text-sm text-[var(--color-fg-secondary)]">
								{data.user.displayName || data.user.email}
							</span>
							<a
								href="/auth/signout"
								class="text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors"
							>
								<LogOut size={16} />
							</a>
						</div>
					{:else}
						<a
							href="/auth/login"
							class="button-primary text-sm font-semibold"
						>
							Sign Up
						</a>
					{/if}
				</div>

				<!-- Mobile Menu Button -->
				<button
					onclick={() => (isMenuOpen = !isMenuOpen)}
					class="md:hidden w-11 h-11 flex items-center justify-center text-[var(--color-fg-primary)] hover:text-[var(--color-fg-secondary)] transition-colors"
					aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
					aria-expanded={isMenuOpen}
				>
					{#if isMenuOpen}
						<X size={24} />
					{:else}
						<Menu size={24} />
					{/if}
				</button>
			</div>
		</div>
	</header>

	<!-- Mobile Menu -->
	{#if isMenuOpen}
		<div class="md:hidden border-t border-[var(--color-border-default)] bg-[var(--color-bg-pure)]">
			<div class="max-w-7xl mx-auto flex flex-col gap-md pt-sm pb-xs px-page-x">
				{#each navItems as item}
					<a
						href={item.href}
						onclick={() => (isMenuOpen = false)}
						class="text-sm font-medium transition-colors py-2 text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
					>
						{item.label}
					</a>
				{/each}

				{#if data.user}
					<div class="pt-md border-t border-[var(--color-border-default)] flex flex-col gap-md">
						<span class="text-sm text-[var(--color-fg-tertiary)]">
							{data.user.displayName || data.user.email}
						</span>
						<a
							href="/auth/signout"
							onclick={() => (isMenuOpen = false)}
							class="text-sm font-medium transition-colors py-2 text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
						>
							Sign Out
						</a>
					</div>
				{:else}
					<a
						href="/auth/login"
						onclick={() => (isMenuOpen = false)}
						class="button-primary text-sm font-semibold text-center w-full"
					>
						Sign Up
					</a>
				{/if}
			</div>
		</div>
	{/if}

	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-[var(--color-border-default)] py-xl">
		<div class="max-w-7xl mx-auto px-page-x">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-lg">
				<div>
					<h6 class="text-sm font-semibold text-[var(--color-fg-primary)] mb-md">Learn</h6>
					<ul class="space-y-sm">
						<li>
							<a href="/paths" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								All Paths
							</a>
						</li>
						<li>
							<a href="/paths/getting-started" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Getting Started
							</a>
						</li>
						<li>
							<a href="/paths/workflow-foundations" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Foundations
							</a>
						</li>
					</ul>
				</div>

				<div>
					<h6 class="text-sm font-semibold text-[var(--color-fg-primary)] mb-md">WORKWAY</h6>
					<ul class="space-y-sm">
						<li>
							<a href="https://workway.co" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Marketplace
							</a>
						</li>
						<li>
							<a href="https://workway.co/developers" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Developers
							</a>
						</li>
						<li>
							<a href="https://workway.co/pricing" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Pricing
							</a>
						</li>
					</ul>
				</div>

				<div>
					<h6 class="text-sm font-semibold text-[var(--color-fg-primary)] mb-md">Resources</h6>
					<ul class="space-y-sm">
						<li>
							<a href="https://github.com/workway" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								GitHub
							</a>
						</li>
						<li>
							<a href="https://workway.co/docs" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Documentation
							</a>
						</li>
					</ul>
				</div>

				<div>
					<h6 class="text-sm font-semibold text-[var(--color-fg-primary)] mb-md">Company</h6>
					<ul class="space-y-sm">
						<li>
							<a href="https://halfdozen.co" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Half Dozen
							</a>
						</li>
						<li>
							<a href="https://createsomething.space" class="text-sm text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] transition-colors">
								Create Something
							</a>
						</li>
					</ul>
				</div>
			</div>

			<div class="mt-xl pt-lg border-t border-[var(--color-border-default)] text-center">
				<p class="text-sm text-[var(--color-fg-muted)]">
					Learn WORKWAY Workflows with Claude Code
				</p>
			</div>
		</div>
	</footer>
</div>

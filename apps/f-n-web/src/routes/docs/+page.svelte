<script lang="ts">
	import { BookOpen, Zap, Key, Database, Link2, DollarSign, Users, HelpCircle, ArrowRight, Play } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Documentation | F→N</title>
	<meta name="description" content="Learn how to sync your Fireflies transcripts to Notion databases with F→N." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Hero -->
	<div class="mb-12">
		<div class="inline-flex items-center gap-2 px-3 py-1 bg-[var(--brand-surface-elevated)] border border-[var(--brand-border)] rounded-full text-sm mb-6">
			<BookOpen size={14} />
			Documentation
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Sync Fireflies to Notion</h1>
		<p class="text-lg text-[var(--brand-text-muted)] max-w-2xl">
			F→N syncs your Fireflies meeting transcripts to Notion <strong>databases</strong> — not pages.
			Structured data you can filter, sort, and query.
		</p>
	</div>

	<!-- Interactive Tour CTA -->
	<section class="mb-12">
		<a
			href="/docs/tour"
			class="block border-2 border-[var(--brand-primary)]/30 rounded-[var(--brand-radius)] p-6 bg-[var(--brand-primary)]/5 hover:bg-[var(--brand-primary)]/10 hover:border-[var(--brand-primary)]/50 transition-colors group"
		>
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center group-hover:bg-[var(--brand-primary)]/20 transition-colors">
					<Play size={24} class="text-[var(--brand-primary)]" />
				</div>
				<div class="flex-1">
					<h2 class="text-lg font-semibold flex items-center gap-2">
						Try the Interactive Tour
						<ArrowRight size={16} class="text-[var(--brand-primary)] group-hover:translate-x-1 transition-transform" />
					</h2>
					<p class="text-sm text-[var(--brand-text-muted)]">
						Experience F→N firsthand. Click through the actual interface with guided highlights.
					</p>
				</div>
			</div>
		</a>
	</section>

	<!-- Quick Start Cards -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
			<Zap size={20} />
			Quick Start
		</h2>
		<div class="grid md:grid-cols-3 gap-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
				<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm mb-3">1</div>
				<h3 class="font-medium mb-1">Connect Fireflies</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Enter your API key to access transcripts</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
				<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm mb-3">2</div>
				<h3 class="font-medium mb-1">Connect Notion</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Authorize access to your workspace</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
				<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm mb-3">3</div>
				<h3 class="font-medium mb-1">Sync</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Select transcripts and a database</p>
			</div>
		</div>
		<div class="mt-4">
			<a href="/docs/getting-started" class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1">
				Full getting started guide <ArrowRight size={14} />
			</a>
		</div>
	</section>

	<!-- Documentation Sections -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Documentation</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/fireflies" class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors group">
				<div class="flex items-center gap-3 mb-2">
					<Key size={18} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)]" />
					<h3 class="font-medium">Fireflies Setup</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Get your API key and connect your account</p>
			</a>

			<a href="/docs/notion" class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors group">
				<div class="flex items-center gap-3 mb-2">
					<Database size={18} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)]" />
					<h3 class="font-medium">Notion Setup</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Connect Notion and set up your database</p>
			</a>

			<a href="/docs/syncing" class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors group">
				<div class="flex items-center gap-3 mb-2">
					<Link2 size={18} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)]" />
					<h3 class="font-medium">Syncing</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">How syncing works and what gets transferred</p>
			</a>

			<a href="/docs/pricing" class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors group">
				<div class="flex items-center gap-3 mb-2">
					<DollarSign size={18} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)]" />
					<h3 class="font-medium">Pricing</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Plans, limits, and how syncs are counted</p>
			</a>

			<a href="/docs/admin" class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors group">
				<div class="flex items-center gap-3 mb-2">
					<Users size={18} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)]" />
					<h3 class="font-medium">Admin Guide</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Create and manage client invitations</p>
			</a>

			<a href="/docs/faq" class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors group">
				<div class="flex items-center gap-3 mb-2">
					<HelpCircle size={18} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)]" />
					<h3 class="font-medium">FAQ</h3>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Common questions answered</p>
			</a>
		</div>
	</section>

	<!-- CTA -->
	<section>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)] text-center">
			<h2 class="text-xl font-semibold mb-2">Ready to sync?</h2>
			<p class="text-[var(--brand-text-muted)] mb-4">Start with 5 free syncs. No credit card required.</p>
			<a
				href="/auth/signup"
				class="inline-flex items-center gap-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] px-5 py-2 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity"
			>
				Get Started <ArrowRight size={16} />
			</a>
		</div>
	</section>
</div>

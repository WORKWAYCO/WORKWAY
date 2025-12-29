<script lang="ts">
	import { Zap, Check, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Getting Started | F→N Docs</title>
	<meta name="description" content="Get started with F→N in 3 simple steps. Connect Fireflies, connect Notion, and start syncing." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Getting Started</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<Zap size={28} />
			Getting Started
		</h1>
	</div>

	<!-- What F→N Does -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">What F→N Does</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-[var(--brand-text-muted)] mb-4">
				F→N syncs your Fireflies meeting transcripts to Notion <strong>databases</strong>. This means:
			</p>
			<ul class="space-y-2">
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm">Each transcript becomes a <strong>database row</strong>, not a page</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm">Filter and sort by date, attendees, duration</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm">Create views (Table, Calendar, Board) in Notion</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm">Link to other databases (Projects, Clients, etc.)</span>
				</li>
			</ul>
		</div>
	</section>

	<!-- Steps -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Setup Steps</h2>
		<div class="space-y-4">
			<!-- Step 1 -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="p-5 bg-[var(--brand-surface-elevated)]">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">1</div>
						<h3 class="font-medium">Connect Fireflies</h3>
					</div>
					<p class="text-sm text-[var(--brand-text-muted)] mb-3">
						Enter your Fireflies API key to let F→N access your transcripts.
					</p>
					<a href="/docs/fireflies" class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1">
						How to get your API key <ArrowRight size={12} />
					</a>
				</div>
			</div>

			<!-- Step 2 -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="p-5 bg-[var(--brand-surface-elevated)]">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">2</div>
						<h3 class="font-medium">Connect Notion</h3>
					</div>
					<p class="text-sm text-[var(--brand-text-muted)] mb-3">
						Authorize F→N to create entries in your Notion workspace. You'll select which databases to share.
					</p>
					<a href="/docs/notion" class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1">
						Set up your Notion database <ArrowRight size={12} />
					</a>
				</div>
			</div>

			<!-- Step 3 -->
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="p-5 bg-[var(--brand-surface-elevated)]">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">3</div>
						<h3 class="font-medium">Sync Transcripts</h3>
					</div>
					<p class="text-sm text-[var(--brand-text-muted)] mb-3">
						Select which transcripts to sync and which database to send them to. Click sync and you're done.
					</p>
					<a href="/docs/syncing" class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1">
						What gets synced <ArrowRight size={12} />
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- After Setup -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">After Setup</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-[var(--brand-text-muted)] mb-4">
				Once connected, syncing is simple:
			</p>
			<ol class="space-y-2 text-sm">
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">1</span>
					<span>Go to your <a href="/dashboard" class="text-[var(--brand-primary)] hover:underline">Dashboard</a></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">2</span>
					<span>Select a Notion database</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">3</span>
					<span>Select transcripts to sync</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">4</span>
					<span>Click <strong>Sync Selected</strong></span>
				</li>
			</ol>
		</div>
	</section>

	<!-- CTA -->
	<section>
		<div class="border border-[var(--brand-primary)]/30 rounded-[var(--brand-radius)] p-5 bg-[var(--brand-primary)]/5">
			<p class="text-sm mb-3">Ready to get started?</p>
			<a
				href="/auth/signup"
				class="inline-flex items-center gap-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] px-4 py-2 rounded-[var(--brand-radius)] text-sm font-medium hover:opacity-90"
			>
				Create Account <ArrowRight size={14} />
			</a>
		</div>
	</section>
</div>

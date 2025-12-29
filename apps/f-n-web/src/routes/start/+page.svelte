<script lang="ts">
	/**
	 * /start - Shareable onboarding landing page
	 *
	 * Canon: Danny sends fn.workway.co/start to Blondish team.
	 * The page guides them through what they need before signing up.
	 * Zuhandenheit: Clear steps, tool recedes.
	 */
	import { Mic, BookOpen, Key, CheckCircle2 } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Get Started with F→N</title>
	<meta name="description" content="Set up F→N in 3 steps: Create account, connect Fireflies API key, authorize Notion. Sync transcripts to databases in minutes." />
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-12">
	<div class="w-full max-w-lg">
		<!-- Header -->
		<div class="text-center mb-10">
			<div class="flex items-center justify-center gap-3 mb-6">
				<div class="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
					<Mic size={24} />
				</div>
				<div class="text-2xl text-[var(--brand-text-muted)]">→</div>
				<div class="w-12 h-12 bg-neutral-500/10 rounded-full flex items-center justify-center text-neutral-400">
					<BookOpen size={24} />
				</div>
			</div>
			<h1 class="text-3xl font-bold mb-3">Sync Fireflies to Notion</h1>
			<p class="text-[var(--brand-text-muted)] text-lg">
				Transcripts as database entries — queryable, filterable, linked
			</p>
		</div>

		<!-- Before You Start -->
		<div class="mb-8 p-5 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface-elevated)]">
			<h2 class="font-semibold mb-4">Before you start, you'll need:</h2>
			<ul class="space-y-3">
				<li class="flex items-start gap-3">
					<div class="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
						<CheckCircle2 size={14} class="text-purple-400" />
					</div>
					<div>
						<span class="font-medium">A Fireflies account</span>
						<span class="text-[var(--brand-text-muted)]"> with transcripts to sync</span>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<div class="w-5 h-5 rounded-full bg-neutral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
						<CheckCircle2 size={14} class="text-neutral-400" />
					</div>
					<div>
						<span class="font-medium">A Notion workspace</span>
						<span class="text-[var(--brand-text-muted)]"> where you want transcripts</span>
					</div>
				</li>
			</ul>
		</div>

		<!-- Steps -->
		<div class="space-y-4 mb-8">
			<h2 class="font-semibold text-[var(--brand-text-muted)] text-sm uppercase tracking-wider">How it works</h2>

			<div class="flex gap-4 p-4 border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
				<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center flex-shrink-0 text-[var(--brand-primary)] font-bold">
					1
				</div>
				<div>
					<div class="font-medium">Create your F→N account</div>
					<div class="text-sm text-[var(--brand-text-muted)]">Email and password — takes 30 seconds</div>
				</div>
			</div>

			<div class="flex gap-4 p-4 border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
				<div class="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 text-purple-400 font-bold">
					2
				</div>
				<div>
					<div class="font-medium">Connect Fireflies</div>
					<div class="text-sm text-[var(--brand-text-muted)]">
						Get your API key from
						<a
							href="https://app.fireflies.ai/settings#DeveloperSettings"
							target="_blank"
							rel="noopener"
							class="text-purple-400 hover:underline"
						>
							Fireflies Settings → Developer Settings
						</a>
					</div>
				</div>
			</div>

			<div class="flex gap-4 p-4 border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
				<div class="w-8 h-8 rounded-full bg-neutral-500/10 flex items-center justify-center flex-shrink-0 text-neutral-400 font-bold">
					3
				</div>
				<div>
					<div class="font-medium">Authorize Notion</div>
					<div class="text-sm text-[var(--brand-text-muted)]">One-click OAuth — select your workspace</div>
				</div>
			</div>
		</div>

		<!-- CTA -->
		<div class="text-center">
			<a
				href="/auth/signup"
				class="inline-block w-full bg-[var(--brand-primary)] text-[var(--brand-bg)] py-3 px-6 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity text-center"
			>
				Create Account
			</a>
			<p class="mt-4 text-sm text-[var(--brand-text-muted)]">
				Already have an account?
				<a href="/auth/login" class="text-[var(--brand-accent)] hover:underline">Sign in</a>
			</p>
		</div>

		<!-- Pricing Note -->
		<div class="mt-10 text-center text-sm text-[var(--brand-text-muted)]">
			<p>5 syncs free, no card required</p>
			<p class="mt-1">
				<a href="/pricing" class="hover:text-[var(--brand-text)]">See pricing →</a>
			</p>
		</div>
	</div>
</div>

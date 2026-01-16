<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { Mic, BookOpen, Sparkles } from 'lucide-svelte';
	import { Alert } from '$lib/components';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let email = $state(data.restrictedEmail || '');
	let password = $state('');
	let submitting = $state(false);

	const tierLabels: Record<string, string> = {
		free: 'Free Plan (5 syncs/month)',
		pro: 'Pro Plan (100 syncs/month)',
		unlimited: 'Unlimited Plan'
	};
</script>

<div class="min-h-screen flex items-center justify-center px-4 py-12">
	<div class="w-full max-w-md">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="flex items-center justify-center gap-3 mb-4">
				<div class="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
					<Mic size={24} />
				</div>
				<div class="text-2xl text-[var(--brand-text-muted)]">→</div>
				<div class="w-12 h-12 bg-neutral-500/10 rounded-full flex items-center justify-center text-neutral-500">
					<BookOpen size={24} />
				</div>
			</div>
			<h1 class="text-2xl font-bold mb-2">Get Started with F→N</h1>
			<p class="text-[var(--brand-text-muted)]">
				Sync your Fireflies transcripts to Notion databases
			</p>
		</div>

		<!-- Invitation Badge -->
		<div class="mb-6 p-4 bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 rounded-[var(--brand-radius)] text-center">
			<div class="flex items-center justify-center gap-2 text-[var(--brand-accent)]">
				<Sparkles size={18} />
				<span class="font-medium">You've been invited!</span>
			</div>
			<p class="text-sm text-[var(--brand-text-muted)] mt-1">
				{tierLabels[data.tier] || data.tier}
			</p>
		</div>

		<!-- Registration Form -->
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				{#if form?.message}
					<div class="mb-4 p-3 bg-[var(--brand-error)]/10 border border-[var(--brand-error)]/20 rounded-[var(--brand-radius)] text-[var(--brand-error)] text-sm">
						{form.message}
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium mb-1">Email</label>
						<input
							type="email"
							id="email"
							name="email"
							bind:value={email}
							required
							readonly={!!data.restrictedEmail}
							placeholder="you@example.com"
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm disabled:opacity-50"
							class:bg-[var(--brand-surface-elevated)]={!!data.restrictedEmail}
						/>
						{#if data.restrictedEmail}
							<p class="text-xs text-[var(--brand-text-muted)] mt-1">
								This invitation is for this email address
							</p>
						{/if}
					</div>

					<div>
						<label for="password" class="block text-sm font-medium mb-1">Password</label>
						<input
							type="password"
							id="password"
							name="password"
							bind:value={password}
							required
							minlength={8}
							placeholder="At least 8 characters"
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={submitting || !email || password.length < 8}
					class="w-full mt-6 bg-[var(--brand-primary)] text-[var(--brand-bg)] py-3 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{submitting ? 'Creating account...' : 'Create Account & Get Started'}
				</button>
			</form>

			<div class="mt-4 text-center">
				<p class="text-xs text-[var(--brand-text-muted)]">
					Already have an account?
					<a href="/auth/login" class="text-[var(--brand-accent)] hover:underline">
						Sign in
					</a>
				</p>
			</div>
		</div>

		<!-- What you'll get -->
		<div class="mt-8 text-center">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">After signing up, you'll be able to:</p>
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div class="p-3 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface-elevated)]">
					<div class="font-medium mb-1">Connect Fireflies</div>
					<div class="text-[var(--brand-text-muted)] text-xs">Link your API key</div>
				</div>
				<div class="p-3 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface-elevated)]">
					<div class="font-medium mb-1">Connect Notion</div>
					<div class="text-[var(--brand-text-muted)] text-xs">Choose your workspace</div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="mt-8 text-center text-xs text-[var(--brand-text-muted)]">
			<p>
				By creating an account, you agree to our
				<a href="/terms" class="hover:text-[var(--brand-text)]">Terms</a>
				and
				<a href="/privacy" class="hover:text-[var(--brand-text)]">Privacy Policy</a>
			</p>
		</div>
	</div>
</div>

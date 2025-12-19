<script lang="ts">
	import { UserPlus, Mail, User } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	let { form } = $props();

	const returnUrl = $derived($page.url.searchParams.get('returnUrl') || '/paths');
</script>

<svelte:head>
	<title>Sign Up | Learn WORKWAY</title>
	<meta name="description" content="Create your Learn WORKWAY account. Track your learning progress and master the WORKWAY philosophy." />

	<!-- SEO -->
	<link rel="canonical" href="https://learn.workway.co/auth/signup" />

	<!-- Open Graph -->
	<meta property="og:title" content="Sign Up | Learn WORKWAY" />
	<meta property="og:description" content="Create your account to track your learning progress." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co/auth/signup" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Sign Up | Learn WORKWAY" />
	<meta name="twitter:description" content="Create your account to track your learning progress." />

	<!-- Robots: Don't index auth pages -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-page-x">
	<div class="w-full max-w-md">
		<div class="text-center mb-lg">
			<h2>Create your account</h2>
			<p class="text-[var(--color-fg-muted)] mt-xs">
				Track your progress and master WORKWAY patterns.
			</p>
		</div>

		<div class="card">
			{#if form?.error}
				<div class="mb-md p-sm rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="/auth/signup" use:enhance class="space-y-md">
				<input type="hidden" name="returnUrl" value={returnUrl} />

				<div>
					<label for="displayName" class="block text-sm font-medium mb-xs">Name (optional)</label>
					<div class="relative">
						<User
							size={16}
							class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)]"
						/>
						<input
							type="text"
							id="displayName"
							name="displayName"
							class="input input-with-icon"
							placeholder="Your name"
						/>
					</div>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium mb-xs">Email</label>
					<div class="relative">
						<Mail
							size={16}
							class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)]"
						/>
						<input
							type="email"
							id="email"
							name="email"
							required
							class="input input-with-icon"
							placeholder="you@example.com"
						/>
					</div>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium mb-xs">Password</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						minlength="8"
						class="input"
						placeholder="••••••••"
					/>
					<p class="text-xs text-[var(--color-fg-muted)] mt-xs">At least 8 characters</p>
				</div>

				<button type="submit" class="button-primary w-full">
					<UserPlus size={16} />
					Create account
				</button>
			</form>

			<div class="mt-md pt-md border-t border-[var(--color-border-default)] text-center">
				<p class="text-sm text-[var(--color-fg-muted)]">
					Already have an account?
					<a href="/auth/login" class="text-[var(--color-fg-primary)] underline hover:no-underline">Sign in</a>
				</p>
			</div>
		</div>
	</div>
</div>

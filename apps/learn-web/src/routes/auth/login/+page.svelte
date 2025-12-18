<script lang="ts">
	import { LogIn, Mail } from 'lucide-svelte';
	import { page } from '$app/stores';

	const returnUrl = $derived($page.url.searchParams.get('returnUrl') || '/paths');
</script>

<svelte:head>
	<title>Sign In | Learn WORKWAY</title>
	<meta name="description" content="Sign in to Learn WORKWAY. Track your progress and pick up where you left off." />

	<!-- SEO -->
	<link rel="canonical" href="https://learn.workway.co/auth/login" />

	<!-- Open Graph -->
	<meta property="og:title" content="Sign In | Learn WORKWAY" />
	<meta property="og:description" content="Sign in to track your progress and pick up where you left off." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co/auth/login" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Sign In | Learn WORKWAY" />
	<meta name="twitter:description" content="Sign in to track your progress and pick up where you left off." />

	<!-- Robots: Don't index auth pages -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-page-x">
	<div class="w-full max-w-md">
		<div class="text-center mb-lg">
			<h2>Sign in to continue</h2>
			<p class="text-[var(--color-fg-muted)] mt-xs">
				Track your progress and pick up where you left off.
			</p>
		</div>

		<div class="card">
			<form method="POST" action="/auth/login" class="space-y-md">
				<input type="hidden" name="returnUrl" value={returnUrl} />

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
						class="input"
						placeholder="••••••••"
					/>
				</div>

				<button type="submit" class="button-primary w-full">
					<LogIn size={16} />
					Sign in
				</button>
			</form>

			<div class="mt-md pt-md border-t border-[var(--color-border-default)] text-center">
				<p class="text-sm text-[var(--color-fg-muted)]">
					Don't have an account?
					<a href="/auth/signup" class="text-[var(--color-fg-primary)] underline hover:no-underline">Sign up</a>
				</p>
			</div>
		</div>
	</div>
</div>

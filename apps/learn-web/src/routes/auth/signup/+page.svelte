<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
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
	<div class="text-center">
		<Loader2 size={32} class="animate-spin text-[var(--color-fg-muted)] mx-auto mb-md" />
		<p class="text-[var(--color-fg-muted)]">Redirecting to sign up...</p>
	</div>
</div>

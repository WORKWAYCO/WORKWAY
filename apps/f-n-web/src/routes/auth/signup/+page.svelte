<script lang="ts">
	import { enhance } from '$app/forms';

	let loading = $state(false);
	let error = $state<string | null>(null);
</script>

<svelte:head>
	<title>Sign up — F→N</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<a href="/" class="brand-arrow text-3xl font-semibold">F→N</a>
			<p class="text-white/60 mt-2">Create account</p>
		</div>

		{#if error}
			<div class="bg-red-500/10 border border-red-500/20 rounded-md p-4 mb-6 text-red-400 text-sm">
				{error}
			</div>
		{/if}

		<form
			method="POST"
			action="/auth/signup"
			use:enhance={() => {
				loading = true;
				error = null;
				return async ({ result, update }) => {
					loading = false;
					if (result.type === 'failure') {
						error = (result.data?.message as string | undefined) ?? 'Something went wrong';
					} else {
						await update();
					}
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="email" class="block text-sm font-medium mb-2">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					autocomplete="email"
					class="w-full px-4 py-2 border border-white/10 rounded-md bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium mb-2">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					minlength="8"
					autocomplete="new-password"
					class="w-full px-4 py-2 border border-white/10 rounded-md bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
				/>
				<p class="text-xs text-white/40 mt-1">8+ characters</p>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full bg-white text-black py-2 rounded-md font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{loading ? 'Creating...' : 'Create account'}
			</button>
		</form>

		<p class="mt-6 text-xs text-center text-white/40">
			By signing up, you agree to our
			<a href="/terms" class="underline hover:text-white">Terms</a>
			and
			<a href="/privacy" class="underline hover:text-white">Privacy</a>.
		</p>

		<div class="mt-8 pt-6 border-t border-white/10 text-center text-sm text-white/60">
			Have an account?
			<a href="/auth/login" class="text-white hover:underline">Sign in</a>
		</div>
	</div>
</div>

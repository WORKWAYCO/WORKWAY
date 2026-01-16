<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert } from '$lib/components';

	let loading = $state(false);
	let error = $state<string | null>(null);
</script>

<svelte:head>
	<title>Sign in — F→N</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<a href="/" class="brand-arrow text-3xl font-semibold">F→N</a>
			<p class="muted-text mt-2">Sign in</p>
		</div>

		{#if error}
			<Alert type="error" class="mb-6">{error}</Alert>
		{/if}

		<form
			method="POST"
			action="/auth/login"
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
					class="form-input"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium mb-2">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					autocomplete="current-password"
					class="form-input"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="primary-button"
			>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>

		<div class="footer-divider">
			No account?
			<a href="/auth/signup" class="footer-link">Sign up</a>
		</div>
	</div>
</div>

<style>
	.muted-text {
		color: var(--color-fg-tertiary);
	}

	.form-input {
		width: 100%;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border-default);
		border-radius: var(--radius-md);
		background-color: var(--color-hover);
		color: var(--color-fg-primary);
	}

	.form-input:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
		border-color: transparent;
	}

	.primary-button {
		width: 100%;
		background-color: var(--color-fg-primary);
		color: var(--color-bg-pure);
		padding: 0.5rem;
		border-radius: var(--radius-md);
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.primary-button:hover:not(:disabled) {
		background-color: var(--color-fg-secondary);
	}

	.primary-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.footer-divider {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border-default);
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-fg-tertiary);
	}

	.footer-link {
		color: var(--color-fg-primary);
	}

	.footer-link:hover {
		text-decoration: underline;
	}
</style>

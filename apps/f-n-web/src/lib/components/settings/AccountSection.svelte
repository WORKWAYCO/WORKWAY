<script lang="ts">
	interface Props {
		email: string;
		signoutAction?: string;
	}

	let { email, signoutAction = '/auth/signout' }: Props = $props();
</script>

<section class="mb-phi-lg">
	<h2 class="text-lg font-semibold mb-phi-sm">Account</h2>
	<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-phi-md bg-[var(--brand-surface-elevated)]">
		<div class="flex items-center justify-between">
			<div>
				<div class="font-medium">{email}</div>
				<div class="text-sm text-[var(--brand-text-muted)]">Signed in</div>
			</div>
			<form method="POST" action={signoutAction}>
				<button
					type="submit"
					class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-error)] transition-colors"
				>
					Sign out
				</button>
			</form>
		</div>
	</div>
</section>

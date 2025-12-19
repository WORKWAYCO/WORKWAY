<script lang="ts">
	interface Props {
		onDeleteAccount?: () => void;
	}

	let { onDeleteAccount }: Props = $props();
</script>

<section>
	<h2 class="text-lg font-semibold mb-phi-sm text-[var(--brand-error)]">Danger Zone</h2>
	<div class="border border-[var(--brand-error)]/20 rounded-[var(--brand-radius)] p-phi-md bg-[var(--brand-error)]/5">
		<div class="flex items-center justify-between">
			<div>
				<div class="font-medium">Delete Account</div>
				<div class="text-sm text-[var(--brand-text-muted)]">Permanently delete your account and all data</div>
			</div>
			<button
				class="text-sm text-[var(--brand-error)] hover:underline"
				onclick={onDeleteAccount}
			>
				Delete
			</button>
		</div>
	</div>
</section>

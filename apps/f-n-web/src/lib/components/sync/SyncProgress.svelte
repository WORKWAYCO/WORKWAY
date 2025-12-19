<script lang="ts">
	interface Props {
		progress: number;
		total: number;
		visible?: boolean;
	}

	let { progress, total, visible = true }: Props = $props();

	const percentage = $derived(total > 0 ? (progress / total) * 100 : 0);
</script>

{#if visible}
	<div class="mt-4">
		<div class="h-2 bg-[var(--brand-border)] rounded-full overflow-hidden">
			<div
				class="h-full bg-[var(--brand-accent)] transition-all duration-300"
				style="width: {percentage}%"
			></div>
		</div>
	</div>
{/if}

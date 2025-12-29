<script lang="ts">
	import { Users } from 'lucide-svelte';

	let { children, data } = $props();
</script>

<svelte:head>
	<title>Dashboard — F→N</title>
</svelte:head>

<div class="min-h-screen flex flex-col">
	<!-- Dashboard Header -->
	<header class="border-b border-[var(--brand-border)] bg-[var(--brand-surface-elevated)]">
		<nav class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
			<div class="flex items-center gap-8">
				<a href="/dashboard" class="brand-arrow text-xl font-semibold">F→N</a>
				<div class="flex items-center gap-1">
					<a
						href="/dashboard"
						class="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)] transition-colors"
					>
						Sync
					</a>
					<a
						href="/dashboard/history"
						class="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)] transition-colors"
					>
						History
					</a>
					<a
						href="/dashboard/settings"
						class="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)] transition-colors"
					>
						Settings
					</a>
					{#if data.isAdmin}
						<a
							href="/admin"
							class="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/10 transition-colors flex items-center gap-1.5"
						>
							<Users size={14} />
							Admin
						</a>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-sm text-[var(--brand-text-muted)]">{data.user?.email}</span>
				<form method="POST" action="/auth/signout">
					<button
						type="submit"
						class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
					>
						Sign out
					</button>
				</form>
			</div>
		</nav>
	</header>

	<!-- Dashboard Content -->
	<main class="flex-1 bg-[var(--brand-surface)]">
		{@render children()}
	</main>
</div>

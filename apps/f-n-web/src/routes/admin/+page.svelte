<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Copy, Trash2, Check, Clock, Users, ExternalLink, BookOpen } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { Alert } from '$lib/components';

	interface Invitation {
		id: string;
		invite_code: string;
		email: string | null;
		tier: string;
		created_by_email: string;
		expires_at: number;
		redeemed_at: number | null;
		redeemed_by_user_id: string | null;
		created_at: string;
		complimentary?: number;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let email = $state('');
	let tier = $state('free');
	let complimentary = $state(false);
	let copied = $state<string | null>(null);

	function getSetupUrl(inviteCode: string): string {
		return `${data.siteUrl}/setup/${inviteCode}`;
	}

	async function copyToClipboard(text: string, code: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = code;
			setTimeout(() => {
				copied = null;
			}, 2000);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			copied = code;
			setTimeout(() => {
				copied = null;
			}, 2000);
		}
	}

	function isExpired(expiresAt: number): boolean {
		return expiresAt < Date.now();
	}

	function formatDate(timestamp: number | string): string {
		const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function daysRemaining(expiresAt: number): string {
		const diff = expiresAt - Date.now();
		if (diff <= 0) return 'Expired';
		const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
		return `${days} day${days === 1 ? '' : 's'} left`;
	}

	// Categorize invitations
	const activeInvitations = $derived(
		(data.invitations as Invitation[]).filter((i) => !i.redeemed_at && !isExpired(i.expires_at))
	);
	const redeemedInvitations = $derived(
		(data.invitations as Invitation[]).filter((i) => i.redeemed_at)
	);
	const expiredInvitations = $derived(
		(data.invitations as Invitation[]).filter((i) => !i.redeemed_at && isExpired(i.expires_at))
	);
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-2xl font-bold">Client Invitations</h1>
			<p class="text-sm text-[var(--brand-text-muted)] mt-1">
				Generate setup links for white glove clients
			</p>
		</div>
		<div class="flex items-center gap-4">
			<a
				href="/admin/guide"
				class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors flex items-center gap-1"
			>
				<BookOpen size={14} />
				Guide
			</a>
			<a
				href="/dashboard"
				class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
			>
				← Back to dashboard
			</a>
		</div>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-3 gap-4 mb-8">
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--brand-surface-elevated)]">
			<div class="text-2xl font-bold">{activeInvitations.length}</div>
			<div class="text-sm text-[var(--brand-text-muted)]">Active</div>
		</div>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--brand-surface-elevated)]">
			<div class="text-2xl font-bold text-[var(--brand-success)]">{redeemedInvitations.length}</div>
			<div class="text-sm text-[var(--brand-text-muted)]">Redeemed</div>
		</div>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--brand-surface-elevated)]">
			<div class="text-2xl font-bold text-[var(--brand-text-muted)]">{expiredInvitations.length}</div>
			<div class="text-sm text-[var(--brand-text-muted)]">Expired</div>
		</div>
	</div>

	<!-- Create Invitation -->
	<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)] mb-8">
		{#if showCreateForm}
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => {
					await update();
					showCreateForm = false;
					email = '';
					tier = 'free';
					complimentary = false;
				};
			}}>
				<h3 class="font-semibold mb-4">Create Invitation</h3>

				{#if form?.success}
					<div class="mb-4 p-4 bg-[var(--brand-success)]/10 border border-[var(--brand-success)]/20 rounded-[var(--brand-radius)]">
						<p class="text-[var(--brand-success)] text-sm mb-2">{form.message}</p>
						{#if form.inviteCode}
							<div class="flex items-center gap-2">
								<code class="flex-1 bg-[var(--brand-surface)] p-2 rounded text-sm font-mono">
									{getSetupUrl(form.inviteCode)}
								</code>
								<button
									type="button"
									onclick={() => copyToClipboard(getSetupUrl(form.inviteCode), form.inviteCode)}
									class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--brand-surface)] transition-colors"
								>
									{#if copied === form.inviteCode}
										<Check size={16} class="text-[var(--brand-success)]" />
									{:else}
										<Copy size={16} />
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium mb-1">
							Client Email <span class="text-[var(--brand-text-muted)]">(optional)</span>
						</label>
						<input
							type="email"
							id="email"
							name="email"
							bind:value={email}
							placeholder="client@example.com"
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
						/>
						<p class="text-xs text-[var(--brand-text-muted)] mt-1">
							Leave blank for a link anyone can use
						</p>
					</div>

					<div>
						<label for="tier" class="block text-sm font-medium mb-1">Subscription Tier</label>
						<select
							id="tier"
							name="tier"
							bind:value={tier}
							disabled={complimentary}
							class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<option value="free">Free (5 syncs/month)</option>
							<option value="pro">Pro (100 syncs/month)</option>
							<option value="unlimited">Unlimited</option>
						</select>
						{#if complimentary}
							<p class="text-xs text-[var(--brand-text-muted)] mt-1">
								Complimentary access will grant Unlimited tier
							</p>
						{/if}
					</div>

					<div>
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								name="complimentary"
								bind:checked={complimentary}
								onchange={() => {
									if (complimentary) {
										tier = 'unlimited';
									}
								}}
								class="w-4 h-4 border border-[var(--brand-border)] rounded bg-[var(--brand-surface)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)] cursor-pointer"
							/>
							<span class="text-sm font-medium">Complimentary (100% off)</span>
						</label>
						<p class="text-xs text-[var(--brand-text-muted)] mt-1 ml-6">
							Client receives Unlimited access at no cost
						</p>
					</div>
				</div>

				<div class="flex gap-2 mt-6">
					<button
						type="submit"
						class="flex-1 bg-[var(--brand-primary)] text-[var(--brand-bg)] py-2 rounded-[var(--brand-radius)] text-sm font-medium hover:opacity-90 transition-opacity"
					>
						Generate Invitation Link
					</button>
					<button
						type="button"
						onclick={() => { showCreateForm = false; }}
						class="px-4 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm hover:bg-[var(--brand-surface)] transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>
		{:else}
			<button
				onclick={() => { showCreateForm = true; }}
				class="w-full flex items-center justify-center gap-2 border border-dashed border-[var(--brand-border)] py-4 rounded-[var(--brand-radius)] text-sm font-medium hover:bg-[var(--brand-surface)] transition-colors"
			>
				<Users size={18} />
				Create New Invitation
			</button>
		{/if}
	</div>

	<!-- Active Invitations -->
	{#if activeInvitations.length > 0}
		<div class="mb-8">
			<h2 class="text-lg font-semibold mb-4">Active Invitations</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
				{#each activeInvitations as invitation}
					<div class="p-4 bg-[var(--brand-surface-elevated)]">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									{#if invitation.email}
										<span class="font-medium">{invitation.email}</span>
									{:else}
										<span class="text-[var(--brand-text-muted)] italic">Any email</span>
									{/if}
									<span class="px-2 py-0.5 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] rounded text-xs font-medium">
										{invitation.tier}
									</span>
									{#if invitation.complimentary}
										<span class="px-2 py-0.5 bg-[var(--brand-success)]/10 text-[var(--brand-success)] rounded text-xs font-medium">
											Complimentary
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-3 text-xs text-[var(--brand-text-muted)]">
									<span class="flex items-center gap-1">
										<Clock size={12} />
										{daysRemaining(invitation.expires_at)}
									</span>
									<span>Created {formatDate(invitation.created_at)}</span>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<button
									onclick={() => copyToClipboard(getSetupUrl(invitation.invite_code), invitation.invite_code)}
									class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--brand-surface)] transition-colors"
									title="Copy link"
								>
									{#if copied === invitation.invite_code}
										<Check size={16} class="text-[var(--brand-success)]" />
									{:else}
										<Copy size={16} />
									{/if}
								</button>
								<a
									href={getSetupUrl(invitation.invite_code)}
									target="_blank"
									rel="noopener"
									class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--brand-surface)] transition-colors"
									title="Open link"
								>
									<ExternalLink size={16} />
								</a>
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="id" value={invitation.id} />
									<button
										type="submit"
										class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--color-error-muted)] hover:border-[var(--color-error)]/20 hover:text-[var(--color-error)] transition-colors"
										title="Revoke"
									>
										<Trash2 size={16} />
									</button>
								</form>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Redeemed Invitations -->
	{#if redeemedInvitations.length > 0}
		<div class="mb-8">
			<h2 class="text-lg font-semibold mb-4">Redeemed</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
				{#each redeemedInvitations as invitation}
					<div class="p-4 bg-[var(--brand-surface-elevated)] opacity-75">
						<div class="flex items-center justify-between">
							<div>
								<div class="flex items-center gap-2 mb-1">
									{#if invitation.email}
										<span class="font-medium">{invitation.email}</span>
									{:else}
										<span class="text-[var(--brand-text-muted)] italic">Any email</span>
									{/if}
									<span class="px-2 py-0.5 bg-[var(--brand-success)]/10 text-[var(--brand-success)] rounded text-xs font-medium flex items-center gap-1">
										<Check size={12} />
										Redeemed
									</span>
								</div>
								<div class="text-xs text-[var(--brand-text-muted)]">
									Redeemed {formatDate(invitation.redeemed_at!)}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Expired Invitations -->
	{#if expiredInvitations.length > 0}
		<div>
			<h2 class="text-lg font-semibold mb-4 text-[var(--brand-text-muted)]">Expired</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)] opacity-50">
				{#each expiredInvitations as invitation}
					<div class="p-4 bg-[var(--brand-surface-elevated)]">
						<div class="flex items-center justify-between">
							<div>
								<div class="flex items-center gap-2 mb-1">
									{#if invitation.email}
										<span class="font-medium">{invitation.email}</span>
									{:else}
										<span class="text-[var(--brand-text-muted)] italic">Any email</span>
									{/if}
									<span class="px-2 py-0.5 bg-[var(--color-fg-muted)]/10 text-[var(--color-fg-muted)] rounded text-xs font-medium">
										Expired
									</span>
								</div>
								<div class="text-xs text-[var(--brand-text-muted)]">
									Expired {formatDate(invitation.expires_at)}
								</div>
							</div>
							<form method="POST" action="?/revoke" use:enhance>
								<input type="hidden" name="id" value={invitation.id} />
								<button
									type="submit"
									class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--color-error-muted)] hover:border-[var(--color-error)]/20 hover:text-[var(--color-error)] transition-colors"
									title="Delete"
								>
									<Trash2 size={16} />
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Empty state -->
	{#if data.invitations.length === 0}
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-8 text-center bg-[var(--brand-surface-elevated)]">
			<Users size={48} class="mx-auto mb-4 text-[var(--brand-text-muted)]" />
			<p class="text-[var(--brand-text-muted)] mb-4">
				No invitations yet. Create one to get started.
			</p>
			<button
				onclick={() => { showCreateForm = true; }}
				class="bg-[var(--brand-primary)] text-[var(--brand-bg)] px-6 py-2 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity"
			>
				Create First Invitation
			</button>
		</div>
	{/if}
</div>

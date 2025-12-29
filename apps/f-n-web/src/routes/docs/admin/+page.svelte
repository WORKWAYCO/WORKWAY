<script lang="ts">
	import { Users, Copy, ExternalLink, Trash2, Check, Clock, ArrowRight, BookOpen } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Admin Guide | F→N Docs</title>
	<meta name="description" content="Learn how to create and manage client invitations as an F→N admin." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Admin Guide</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<Users size={28} />
			Admin Guide
		</h1>
		<p class="text-[var(--brand-text-muted)] mt-2">
			For Half Dozen team members managing client access.
		</p>
	</div>

	<!-- Quick Start -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Quick Start</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<ol class="space-y-3">
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">1</span>
					<span class="text-sm">Go to <a href="/admin" class="text-[var(--brand-primary)] hover:underline">/admin</a></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">2</span>
					<span class="text-sm">Click <strong>Create New Invitation</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">3</span>
					<span class="text-sm">Enter client email, select tier, check <strong>Complimentary</strong> if needed</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">4</span>
					<span class="text-sm">Click <strong>Generate Invitation Link</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">5</span>
					<span class="text-sm">Copy the link and send it to your client</span>
				</li>
			</ol>
		</div>
	</section>

	<!-- Form Fields -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Invitation Form</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Client Email</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Optional. Leave blank for a link anyone can use, or enter a specific email to restrict access to that person only.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Subscription Tier</h3>
				<div class="text-sm text-[var(--brand-text-muted)] space-y-1 mt-2">
					<p><strong>Free</strong> — 5 syncs per month</p>
					<p><strong>Pro</strong> — 100 syncs per month</p>
					<p><strong>Unlimited</strong> — No sync limits</p>
				</div>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Complimentary (100% off)</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Check this for white glove clients. Automatically grants <strong>Unlimited</strong> tier at no cost. The tier dropdown will be disabled.
				</p>
			</div>
		</div>
	</section>

	<!-- Action Buttons -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Sharing an Invitation</h2>
		<p class="text-sm text-[var(--brand-text-muted)] mb-4">
			After creating an invitation, use these buttons to share or manage it:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<div class="p-4 bg-[var(--brand-surface-elevated)] flex items-center gap-4">
				<div class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
					<Copy size={16} />
				</div>
				<div>
					<h3 class="font-medium">Copy Link</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">Copy the invitation URL to your clipboard</p>
				</div>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)] flex items-center gap-4">
				<div class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
					<ExternalLink size={16} />
				</div>
				<div>
					<h3 class="font-medium">Open Link</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">Preview the setup page in a new tab</p>
				</div>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)] flex items-center gap-4">
				<div class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)]">
					<Trash2 size={16} />
				</div>
				<div>
					<h3 class="font-medium">Delete</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">Revoke the invitation (client can no longer use it)</p>
				</div>
			</div>
		</div>
	</section>

	<!-- What Clients See -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">What Clients See</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				When a client opens the invitation link, they see:
			</p>
			<ul class="space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span><strong>"You've been invited!"</strong> banner with their plan tier</span>
				</li>
				<li class="flex items-start gap-2">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span>Email field (pre-filled if you specified one)</span>
				</li>
				<li class="flex items-start gap-2">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span>Password field to create their account</span>
				</li>
				<li class="flex items-start gap-2">
					<Check size={14} class="text-[var(--brand-success)] mt-0.5" />
					<span><strong>Create Account & Get Started</strong> button</span>
				</li>
			</ul>
			<p class="text-sm text-[var(--brand-text-muted)] mt-4">
				After signup, they're redirected to connect Fireflies and Notion.
			</p>
		</div>
	</section>

	<!-- Invitation Lifecycle -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Invitation Lifecycle</h2>
		<div class="flex items-center gap-2 text-sm mb-4 overflow-x-auto pb-2">
			<span class="px-3 py-1 bg-[var(--brand-surface-elevated)] border border-[var(--brand-border)] rounded-full whitespace-nowrap">Created</span>
			<span class="text-[var(--brand-text-muted)]">→</span>
			<span class="px-3 py-1 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] rounded-full whitespace-nowrap">Active</span>
			<span class="text-[var(--brand-text-muted)]">→</span>
			<span class="px-3 py-1 bg-[var(--brand-success)]/10 border border-[var(--brand-success)]/20 text-[var(--brand-success)] rounded-full whitespace-nowrap flex items-center gap-1">
				<Check size={12} />
				Redeemed
			</span>
		</div>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center gap-2 mb-1">
					<span class="px-2 py-0.5 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded text-xs font-medium">Active</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Link is valid and waiting to be used</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center gap-2 mb-1">
					<span class="px-2 py-0.5 bg-[var(--brand-success)]/10 text-[var(--brand-success)] rounded text-xs font-medium flex items-center gap-1">
						<Check size={10} />
						Redeemed
					</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Client created their account using this invitation</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<div class="flex items-center gap-2 mb-1">
					<span class="px-2 py-0.5 bg-[var(--color-fg-muted)]/10 text-[var(--color-fg-muted)] rounded text-xs font-medium">Expired</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)]">7 days passed without redemption — link no longer works</p>
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">FAQ</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors">
					<span class="font-medium">Can I resend an invitation?</span>
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					No. Create a new invitation and share the new link. You can delete the old one if needed.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors">
					<span class="font-medium">Can multiple people use the same link?</span>
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Only if you left the Client Email field blank. If you specified an email, only that person can use it.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors">
					<span class="font-medium">How do I know when someone redeemed?</span>
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					The "Redeemed" counter updates in the stats cards, and the invitation moves to the Redeemed section with a timestamp.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors">
					<span class="font-medium">What if I need to change a client's tier after signup?</span>
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					This isn't available in the admin panel yet. Contact support for tier changes.
				</div>
			</details>
		</div>
	</section>

	<!-- CTA -->
	<section>
		<div class="border border-[var(--brand-primary)]/30 rounded-[var(--brand-radius)] p-5 bg-[var(--brand-primary)]/5 text-center">
			<a
				href="/admin"
				class="inline-flex items-center gap-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] px-5 py-2 rounded-[var(--brand-radius)] font-medium hover:opacity-90"
			>
				<Users size={16} />
				Go to Admin Panel
			</a>
		</div>
	</section>
</div>

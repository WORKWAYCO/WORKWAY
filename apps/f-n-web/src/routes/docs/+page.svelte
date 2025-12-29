<script lang="ts">
	import { BookOpen, Zap, Database, Key, Link2, Users, Clock, Check, ArrowRight, ExternalLink } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Documentation | F→N</title>
	<meta name="description" content="Learn how to sync your Fireflies transcripts to Notion databases with F→N." />
</svelte:head>

<div class="min-h-screen bg-[var(--brand-bg)]">
	<!-- Header -->
	<header class="border-b border-[var(--brand-border)]">
		<div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
			<a href="/" class="text-xl font-bold">F→N</a>
			<nav class="flex items-center gap-6">
				<a href="/docs" class="text-sm font-medium">Docs</a>
				<a href="/pricing" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Pricing</a>
				<a href="/auth/login" class="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]">Sign in</a>
			</nav>
		</div>
	</header>

	<main class="max-w-4xl mx-auto px-4 py-12">
		<!-- Hero -->
		<div class="text-center mb-16">
			<div class="inline-flex items-center gap-2 px-3 py-1 bg-[var(--brand-surface-elevated)] border border-[var(--brand-border)] rounded-full text-sm mb-6">
				<BookOpen size={14} />
				Documentation
			</div>
			<h1 class="text-4xl font-bold mb-4">Sync Fireflies to Notion</h1>
			<p class="text-lg text-[var(--brand-text-muted)] max-w-2xl mx-auto">
				F→N syncs your Fireflies meeting transcripts to Notion <strong>databases</strong> — not pages.
				Structured data you can filter, sort, and query.
			</p>
		</div>

		<!-- Quick Start -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
				<Zap size={24} />
				Quick Start
			</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
				<div class="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--brand-border)]">
					<div class="p-6 bg-[var(--brand-surface-elevated)]">
						<div class="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold mb-4">1</div>
						<h3 class="font-semibold mb-2">Connect Fireflies</h3>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Enter your Fireflies API key to access your transcripts
						</p>
					</div>
					<div class="p-6 bg-[var(--brand-surface-elevated)]">
						<div class="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold mb-4">2</div>
						<h3 class="font-semibold mb-2">Connect Notion</h3>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Authorize F→N to create entries in your Notion workspace
						</p>
					</div>
					<div class="p-6 bg-[var(--brand-surface-elevated)]">
						<div class="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold mb-4">3</div>
						<h3 class="font-semibold mb-2">Sync</h3>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Select transcripts and a database — we handle the rest
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Getting Your API Key -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
				<Key size={24} />
				Getting Your Fireflies API Key
			</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<ol class="space-y-4">
					<li class="flex items-start gap-3">
						<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs font-bold">1</span>
						<div>
							<p>Go to <a href="https://app.fireflies.ai/integrations/custom/fireflies" target="_blank" rel="noopener" class="text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1">Fireflies Integrations <ExternalLink size={12} /></a></p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs font-bold">2</span>
						<p>Find your API key or generate a new one</p>
					</li>
					<li class="flex items-start gap-3">
						<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs font-bold">3</span>
						<p>Copy the key and paste it into F→N</p>
					</li>
				</ol>
				<div class="mt-4 p-3 bg-[var(--brand-surface)] rounded-[var(--brand-radius)] text-sm text-[var(--brand-text-muted)]">
					<strong>Note:</strong> Your API key is stored securely and only used to fetch your transcripts.
				</div>
			</div>
		</section>

		<!-- Notion Setup -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
				<Database size={24} />
				Setting Up Notion
			</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<p class="text-[var(--brand-text-muted)] mb-4">
					When you connect Notion, you'll authorize F→N to access your workspace. Here's what we need:
				</p>
				<div class="space-y-3 mb-6">
					<div class="flex items-start gap-3">
						<Check size={16} class="text-[var(--brand-success)] mt-0.5" />
						<p class="text-sm">Access to create database entries</p>
					</div>
					<div class="flex items-start gap-3">
						<Check size={16} class="text-[var(--brand-success)] mt-0.5" />
						<p class="text-sm">Read your database list to show you options</p>
					</div>
				</div>
				<h3 class="font-semibold mb-3">Creating a Database for Transcripts</h3>
				<p class="text-sm text-[var(--brand-text-muted)] mb-3">
					We recommend creating a dedicated database with these properties:
				</p>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-[var(--brand-border)]">
								<th class="text-left py-2 pr-4 font-medium">Property</th>
								<th class="text-left py-2 pr-4 font-medium">Type</th>
								<th class="text-left py-2 font-medium">Description</th>
							</tr>
						</thead>
						<tbody class="text-[var(--brand-text-muted)]">
							<tr class="border-b border-[var(--brand-border)]">
								<td class="py-2 pr-4">Title</td>
								<td class="py-2 pr-4">Title</td>
								<td class="py-2">Meeting name</td>
							</tr>
							<tr class="border-b border-[var(--brand-border)]">
								<td class="py-2 pr-4">Date</td>
								<td class="py-2 pr-4">Date</td>
								<td class="py-2">When the meeting occurred</td>
							</tr>
							<tr class="border-b border-[var(--brand-border)]">
								<td class="py-2 pr-4">Attendees</td>
								<td class="py-2 pr-4">Multi-select</td>
								<td class="py-2">Who was on the call</td>
							</tr>
							<tr>
								<td class="py-2 pr-4">Duration</td>
								<td class="py-2 pr-4">Number</td>
								<td class="py-2">Length in minutes</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<!-- Syncing -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
				<Link2 size={24} />
				Syncing Transcripts
			</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
				<div class="p-6 bg-[var(--brand-surface-elevated)]">
					<h3 class="font-semibold mb-2">Select Transcripts</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">
						Choose which Fireflies transcripts to sync. You can select individual meetings or sync all recent ones.
					</p>
				</div>
				<div class="p-6 bg-[var(--brand-surface-elevated)]">
					<h3 class="font-semibold mb-2">Choose Database</h3>
					<p class="text-sm text-[var(--brand-text-muted)]">
						Pick the Notion database where entries will be created. Each transcript becomes a database row.
					</p>
				</div>
				<div class="p-6 bg-[var(--brand-surface-elevated)]">
					<h3 class="font-semibold mb-2">What Gets Synced</h3>
					<ul class="text-sm text-[var(--brand-text-muted)] space-y-1">
						<li>• Meeting title and date</li>
						<li>• Full transcript text</li>
						<li>• Attendee list</li>
						<li>• Duration</li>
						<li>• AI-generated summary (if available)</li>
					</ul>
				</div>
			</div>
		</section>

		<!-- Pricing -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6">Plans</h2>
			<div class="grid md:grid-cols-3 gap-4">
				<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
					<h3 class="font-semibold mb-1">Free</h3>
					<p class="text-2xl font-bold mb-2">$0</p>
					<p class="text-sm text-[var(--brand-text-muted)]">5 syncs per month</p>
				</div>
				<div class="border border-[var(--brand-primary)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
					<h3 class="font-semibold mb-1">Pro</h3>
					<p class="text-2xl font-bold mb-2">$5<span class="text-sm font-normal text-[var(--brand-text-muted)]">/mo</span></p>
					<p class="text-sm text-[var(--brand-text-muted)]">100 syncs per month</p>
				</div>
				<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
					<h3 class="font-semibold mb-1">Unlimited</h3>
					<p class="text-2xl font-bold mb-2">$15<span class="text-sm font-normal text-[var(--brand-text-muted)]">/mo</span></p>
					<p class="text-sm text-[var(--brand-text-muted)]">No limits</p>
				</div>
			</div>
		</section>

		<!-- Admin Section -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
				<Users size={24} />
				For Admins: Client Invitations
			</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]">
				<p class="text-[var(--brand-text-muted)] mb-4">
					Half Dozen team members can create invitation links for white glove clients.
				</p>
				<div class="space-y-4">
					<div>
						<h3 class="font-semibold mb-2">Creating an Invitation</h3>
						<ol class="text-sm text-[var(--brand-text-muted)] space-y-1">
							<li>1. Go to <a href="/admin" class="text-[var(--brand-primary)] hover:underline">/admin</a></li>
							<li>2. Click <strong>Create New Invitation</strong></li>
							<li>3. Enter client email (optional), select tier</li>
							<li>4. Check <strong>Complimentary</strong> for 100% off</li>
							<li>5. Generate and share the link</li>
						</ol>
					</div>
					<div>
						<h3 class="font-semibold mb-2">Invitation Lifecycle</h3>
						<div class="flex items-center gap-2 text-sm">
							<span class="px-2 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded text-xs">Active</span>
							<ArrowRight size={12} class="text-[var(--brand-text-muted)]" />
							<span class="px-2 py-1 bg-[var(--brand-success)]/10 text-[var(--brand-success)] rounded text-xs">Redeemed</span>
							<span class="text-[var(--brand-text-muted)] mx-2">or</span>
							<span class="px-2 py-1 bg-[var(--color-fg-muted)]/10 text-[var(--color-fg-muted)] rounded text-xs">Expired (7 days)</span>
						</div>
					</div>
				</div>
				<div class="mt-4">
					<a
						href="/admin/guide"
						class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
					>
						Full admin guide <ArrowRight size={12} />
					</a>
				</div>
			</div>
		</section>

		<!-- FAQ -->
		<section class="mb-16">
			<h2 class="text-2xl font-bold mb-6">FAQ</h2>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
				<details class="group">
					<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
						Why databases instead of pages?
					</summary>
					<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
						Notion databases let you filter, sort, and create views of your transcripts. Pages are just documents — databases are structured data you can query and organize.
					</div>
				</details>
				<details class="group">
					<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
						Is my data secure?
					</summary>
					<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
						Yes. We use OAuth for Notion (we never see your password) and your Fireflies API key is encrypted at rest. We don't store your transcripts — they flow directly from Fireflies to Notion.
					</div>
				</details>
				<details class="group">
					<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
						Can I sync old transcripts?
					</summary>
					<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
						Yes. When you connect Fireflies, we show all your available transcripts. Select any you want to sync, regardless of when they were recorded.
					</div>
				</details>
				<details class="group">
					<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
						What happens if a sync fails?
					</summary>
					<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
						Failed syncs don't count against your monthly limit. Check your History tab to see what went wrong and retry.
					</div>
				</details>
			</div>
		</section>

		<!-- CTA -->
		<section class="text-center">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-8 bg-[var(--brand-surface-elevated)]">
				<h2 class="text-2xl font-bold mb-2">Ready to sync?</h2>
				<p class="text-[var(--brand-text-muted)] mb-6">Start with 5 free syncs. No credit card required.</p>
				<a
					href="/auth/signup"
					class="inline-flex items-center gap-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] px-6 py-3 rounded-[var(--brand-radius)] font-medium hover:opacity-90 transition-opacity"
				>
					Get Started <ArrowRight size={16} />
				</a>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t border-[var(--brand-border)] mt-16">
		<div class="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-[var(--brand-text-muted)]">
			<p>F→N by <a href="https://halfdozen.co" target="_blank" rel="noopener" class="hover:text-[var(--brand-text)]">Half Dozen</a></p>
		</div>
	</footer>
</div>

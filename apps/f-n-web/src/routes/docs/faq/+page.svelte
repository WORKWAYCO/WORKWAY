<script lang="ts">
	import { HelpCircle } from 'lucide-svelte';
</script>

<svelte:head>
	<title>FAQ | F→N Docs</title>
	<meta name="description" content="Frequently asked questions about F→N - syncing Fireflies to Notion." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>FAQ</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<HelpCircle size={28} />
			Frequently Asked Questions
		</h1>
	</div>

	<!-- General -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">General</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<details class="group" open>
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Why databases instead of pages?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Notion databases let you filter, sort, and create views of your transcripts. Pages are just documents — databases are structured data you can query and organize. You can create calendar views, board views, filter by attendee, sort by date, and much more.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					What makes F→N different from other tools?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Most tools create Notion pages. F→N creates database entries with structured properties (date, attendees, duration) that you can filter, sort, and query. Your transcripts become a proper database, not a folder of documents.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Do you support automatic syncing?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Not yet. Currently you manually select which transcripts to sync. Automatic syncing (sync new meetings automatically) is on our roadmap.
				</div>
			</details>
		</div>
	</section>

	<!-- Security -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Security & Privacy</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Is my data secure?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Yes. We use OAuth for Notion (we never see your password) and your Fireflies API key is encrypted at rest. We don't store your transcripts — they flow directly from Fireflies to Notion during sync.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Can you read my transcripts?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					We fetch transcripts during sync to send them to Notion, but we don't store them. Your transcript content passes through our servers only momentarily during the sync process.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					How do I revoke access?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					For Fireflies: Regenerate your API key in Fireflies settings. For Notion: Go to Settings → Connections in Notion and remove F→N. You can also disconnect both from your F→N Settings page.
				</div>
			</details>
		</div>
	</section>

	<!-- Syncing -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Syncing</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
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
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Will syncing the same transcript create duplicates?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					No. F→N tracks which transcripts you've synced and won't create duplicates. Already-synced transcripts appear grayed out in the list. If you need to re-sync, delete the entry from your History first.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Why don't I see Duration or Participants in my synced entries?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					You need to configure Property Mapping. After selecting your database, expand the Property Mapping card and match Fireflies fields to your Notion properties. Duration requires a Number property, Participants can use Multi-select or Text, Keywords requires a Text property, and Owner requires a Select property.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Can I sync to multiple databases?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Yes. Each sync, you select which database to use. You can sync different transcripts to different databases.
				</div>
			</details>
		</div>
	</section>

	<!-- Billing -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Billing</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					What counts as a sync?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Each transcript synced counts as one sync. Syncing 10 transcripts at once = 10 syncs. Failed syncs don't count.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					What happens when I hit my limit?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					You can't sync more transcripts until your limit resets (monthly) or you upgrade your plan. Your account and data remain accessible.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Can I cancel anytime?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Yes. Downgrade to Free tier from your Settings page. You'll keep access until the end of your current billing period.
				</div>
			</details>
		</div>
	</section>

	<!-- Technical -->
	<section>
		<h2 class="text-lg font-semibold mb-4">Technical</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Why can't I see my database?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Only full-page databases appear in the list. Inline databases (embedded in pages) won't show up. Also make sure you selected the database during the Notion OAuth flow.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Where does the transcript text go?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					The full transcript is added to the page body (content area) of the database entry. Properties like Title, Date, and Attendees go into database columns.
				</div>
			</details>
			<details class="group">
				<summary class="p-4 bg-[var(--brand-surface-elevated)] cursor-pointer hover:bg-[var(--brand-surface)] transition-colors font-medium">
					Do you have an API?
				</summary>
				<div class="p-4 bg-[var(--brand-surface)] text-sm text-[var(--brand-text-muted)]">
					Not currently. F→N is a web-based tool. If you need API access or automation, let us know at support@halfdozen.co.
				</div>
			</details>
		</div>
	</section>
</div>

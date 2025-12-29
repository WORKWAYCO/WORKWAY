<script lang="ts">
	import { Link2, Check, Clock, AlertCircle } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Syncing | F→N Docs</title>
	<meta name="description" content="Learn how F→N syncs your Fireflies transcripts to Notion databases." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Syncing</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<Link2 size={28} />
			Syncing Transcripts
		</h1>
	</div>

	<!-- How It Works -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">How Syncing Works</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<ol class="space-y-4">
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs font-bold">1</span>
					<div>
						<p class="font-medium mb-1">Select a database</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Choose which Notion database to send transcripts to.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs font-bold">2</span>
					<div>
						<p class="font-medium mb-1">Select transcripts</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Check the transcripts you want to sync. You can select one or many.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs font-bold">3</span>
					<div>
						<p class="font-medium mb-1">Click sync</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							We fetch each transcript and create a database entry in Notion.
						</p>
					</div>
				</li>
			</ol>
		</div>
	</section>

	<!-- What Gets Synced -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">What Gets Synced</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				Each transcript becomes a database entry with:
			</p>
			<ul class="space-y-2">
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Title</strong> — Meeting name from Fireflies</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Date</strong> — When the meeting occurred</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Attendees</strong> — List of participants</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Duration</strong> — Length in minutes</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Transcript</strong> — Full text in the page body</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Summary</strong> — AI summary (if available in Fireflies)</span>
				</li>
			</ul>
		</div>
	</section>

	<!-- Sync Counts -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
			<Clock size={18} />
			Sync Counts
		</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				Each transcript synced counts as <strong>one sync</strong> against your monthly limit.
			</p>
			<div class="space-y-3 text-sm">
				<div class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>Syncing 5 transcripts at once = 5 syncs</span>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>Re-syncing the same transcript = counts again</span>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span><strong>Failed syncs don't count</strong> — only successful ones</span>
				</div>
			</div>
		</div>
	</section>

	<!-- History -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Sync History</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				View all your syncs in the <a href="/dashboard/history" class="text-[var(--brand-primary)] hover:underline">History</a> tab.
			</p>
			<p class="text-sm text-[var(--brand-text-muted)]">
				For each sync, you can see:
			</p>
			<ul class="mt-2 space-y-1 text-sm text-[var(--brand-text-muted)]">
				<li>• Which transcript was synced</li>
				<li>• Which database it went to</li>
				<li>• When it was synced</li>
				<li>• Status (success or error)</li>
			</ul>
		</div>
	</section>

	<!-- Troubleshooting -->
	<section>
		<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
			<AlertCircle size={18} />
			Troubleshooting
		</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Sync failed</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Check your History tab for the error message. Common causes: database permissions changed, Notion connection expired.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Properties not mapping correctly</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Make sure your database has properties with the right types: Date for dates, Number for duration, Multi-select for attendees.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Transcript appears empty</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					The transcript is in the page body (not a property). Open the Notion page to see the full text.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Duplicate entries</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					F→N doesn't track which transcripts you've already synced. Syncing the same transcript twice creates two entries.
				</p>
			</div>
		</div>
	</section>
</div>

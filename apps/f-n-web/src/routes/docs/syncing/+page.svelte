<script lang="ts">
	import { Link2, Check, Clock, AlertCircle, Settings2 } from 'lucide-svelte';
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

			<p class="text-xs uppercase tracking-wide text-[var(--brand-text-muted)] mb-2 mt-4">Database Properties</p>
			<ul class="space-y-2 mb-4">
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Title</strong> — Meeting name from Fireflies</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Date</strong> — When the meeting occurred (if mapped)</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Duration</strong> — Meeting length in minutes (if mapped)</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Participants</strong> — Attendee names (if mapped)</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Keywords</strong> — AI-extracted topics (if mapped)</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Owner</strong> — Your login email (if mapped)</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Fireflies URL</strong> — Link back to the original transcript (if mapped)</span>
				</li>
			</ul>

			<p class="text-xs uppercase tracking-wide text-[var(--brand-text-muted)] mb-2">Page Content</p>
			<ul class="space-y-2">
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Summary</strong> — AI-generated overview (if available)</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Key Points</strong> — Bullet list of main takeaways</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Action Items</strong> — To-do checkboxes for follow-ups</span>
				</li>
				<li class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm"><strong>Full Transcript</strong> — Complete text with speaker attribution</span>
				</li>
			</ul>
		</div>
	</section>

	<!-- Property Mapping -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
			<Settings2 size={18} />
			Property Mapping
		</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				Map additional Fireflies data to your Notion database properties:
			</p>

			<div class="overflow-x-auto mb-4">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[var(--brand-border)]">
							<th class="text-left py-2 pr-4 font-medium">Fireflies Field</th>
							<th class="text-left py-2 pr-4 font-medium">Notion Type</th>
							<th class="text-left py-2 font-medium">Description</th>
						</tr>
					</thead>
					<tbody class="text-[var(--brand-text-muted)]">
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Duration</td>
							<td class="py-2 pr-4">Number</td>
							<td class="py-2">Meeting length in minutes</td>
						</tr>
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Participants</td>
							<td class="py-2 pr-4">Multi-select or Text</td>
							<td class="py-2">Attendee names (Multi-select for filtering, Text for simplicity)</td>
						</tr>
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Keywords</td>
							<td class="py-2 pr-4">Text</td>
							<td class="py-2">AI-extracted topics (comma-separated)</td>
						</tr>
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Owner</td>
							<td class="py-2 pr-4">Select</td>
							<td class="py-2">Automatically set to your login email</td>
						</tr>
						<tr>
							<td class="py-2 pr-4">Meeting Date</td>
							<td class="py-2 pr-4">Date</td>
							<td class="py-2">When the meeting occurred</td>
						</tr>
					</tbody>
				</table>
			</div>

			<p class="text-xs uppercase tracking-wide text-[var(--brand-text-muted)] mb-2 mt-4">Setting Up Mappings</p>
			<ol class="space-y-2 text-sm text-[var(--brand-text-muted)]">
				<li class="flex items-start gap-2">
					<span class="text-[var(--brand-text)]">1.</span>
					<span>Select your Notion database</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-[var(--brand-text)]">2.</span>
					<span>Expand the Property Mapping card</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-[var(--brand-text)]">3.</span>
					<span>Match Fireflies fields to your Notion properties</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-[var(--brand-text)]">4.</span>
					<span>Click "Save Mapping"</span>
				</li>
			</ol>

			<p class="text-sm text-[var(--brand-text-muted)] mt-4">
				Mappings save per database — future syncs use them automatically.
			</p>
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
					<span><strong>Failed syncs don't count</strong> — only successful ones</span>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span><strong>Already-synced transcripts are detected</strong> — F→N tracks what you've synced and won't create duplicates</span>
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
				<h3 class="font-medium mb-1">Date not appearing</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Make sure you select a Date property during sync setup. Your Notion database needs at least one Date type property.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Transcript appears empty</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					The transcript is in the page body (not a property). Open the Notion page to see the full text with summary, key points, action items, and full transcript.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Transcript already synced</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					F→N tracks synced transcripts to prevent duplicates. If you need to re-sync, you can delete the entry from your sync History and try again.
				</p>
			</div>
		</div>
	</section>
</div>

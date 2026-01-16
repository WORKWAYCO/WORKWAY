<script lang="ts">
	import { Database, Check, ExternalLink, AlertCircle } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Notion Setup | F→N Docs</title>
	<meta name="description" content="Learn how to connect Notion and set up your database for F→N." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Notion Setup</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<Database size={28} />
			Notion Setup
		</h1>
	</div>

	<!-- Connecting Notion -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Connecting Notion</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-[var(--brand-text-muted)] mb-4">
				F→N uses OAuth to connect to Notion — you never share your password with us.
			</p>
			<ol class="space-y-4">
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">1</span>
					<div>
						<p class="font-medium mb-1">Click "Connect Notion"</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							On your F→N <a href="/dashboard" class="text-[var(--brand-primary)] hover:underline">Dashboard</a>, click the Connect Notion button.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">2</span>
					<div>
						<p class="font-medium mb-1">Select databases to share</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Notion will ask which databases F→N can access. Select the ones you want to sync to.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">3</span>
					<div>
						<p class="font-medium mb-1">Authorize access</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Click "Allow access" to complete the connection.
						</p>
					</div>
				</li>
			</ol>
		</div>
	</section>

	<!-- What We Access -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">What We Can Access</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<div class="space-y-3 mb-4">
				<div class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm">Create entries in your selected databases</span>
				</div>
				<div class="flex items-start gap-3">
					<Check size={16} class="text-[var(--brand-success)] mt-0.5 flex-shrink-0" />
					<span class="text-sm">Read database names and properties (to show you options)</span>
				</div>
			</div>
			<p class="text-sm text-[var(--brand-text-muted)]">
				We cannot access databases you don't explicitly share, and we cannot delete entries.
			</p>
		</div>
	</section>

	<!-- Database Setup -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Setting Up Your Database</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				We recommend creating a dedicated database for meeting transcripts. Here are the properties we can populate:
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
							<td class="py-2 pr-4"><code class="bg-[var(--brand-surface)] px-1 rounded text-xs">Title</code></td>
							<td class="py-2">Meeting name (required)</td>
						</tr>
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Date</td>
							<td class="py-2 pr-4"><code class="bg-[var(--brand-surface)] px-1 rounded text-xs">Date</code></td>
							<td class="py-2">When the meeting occurred</td>
						</tr>
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Attendees</td>
							<td class="py-2 pr-4"><code class="bg-[var(--brand-surface)] px-1 rounded text-xs">Multi-select</code></td>
							<td class="py-2">Who was on the call</td>
						</tr>
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-2 pr-4">Duration</td>
							<td class="py-2 pr-4"><code class="bg-[var(--brand-surface)] px-1 rounded text-xs">Number</code></td>
							<td class="py-2">Length in minutes</td>
						</tr>
						<tr>
							<td class="py-2 pr-4">Transcript</td>
							<td class="py-2 pr-4"><code class="bg-[var(--brand-surface)] px-1 rounded text-xs">Text</code></td>
							<td class="py-2">Full transcript content (in page body)</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<!-- Creating a Database -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Creating a New Database</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				To create a database in Notion:
			</p>
			<ol class="space-y-3 text-sm">
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">1</span>
					<span>Open Notion and create a new page</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">2</span>
					<span>Type <code class="bg-[var(--brand-surface)] px-1 rounded">/database</code> and select "Database - Full page"</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">3</span>
					<span>Name it something like "Meeting Transcripts"</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)] flex items-center justify-center text-xs">4</span>
					<span>Add properties: Date, Attendees (multi-select), Duration (number)</span>
				</li>
			</ol>
			<div class="mt-4">
				<a
					href="https://www.notion.so/help/intro-to-databases"
					target="_blank"
					rel="noopener"
					class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
				>
					Notion's database guide <ExternalLink size={12} />
				</a>
			</div>
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
				<h3 class="font-medium mb-1">"No databases found"</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Make sure you selected at least one database to share during the OAuth flow. You can disconnect and reconnect to select more.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Database not appearing in list</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Only <strong>full-page databases</strong> appear in the list. Inline databases (embedded in pages) won't show up.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">OAuth window won't open</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Check if a popup blocker is preventing the window. Try allowing popups for fn.workway.co.
				</p>
			</div>
		</div>
	</section>
</div>

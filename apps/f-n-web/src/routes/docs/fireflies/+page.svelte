<script lang="ts">
	import { Key, ExternalLink, Shield, AlertCircle } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Fireflies Setup | F→N Docs</title>
	<meta name="description" content="Learn how to get your Fireflies API key and connect it to F→N." />
</svelte:head>

<div class="p-6 md:p-10 max-w-3xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 text-[var(--brand-text-muted)] text-sm mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<span>Fireflies Setup</span>
		</div>
		<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
			<Key size={28} />
			Fireflies Setup
		</h1>
	</div>

	<!-- Getting API Key -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">Getting Your API Key</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<ol class="space-y-4">
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">1</span>
					<div>
						<p class="font-medium mb-1">Go to Fireflies Integrations</p>
						<a
							href="https://app.fireflies.ai/integrations/custom/fireflies"
							target="_blank"
							rel="noopener"
							class="text-sm text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
						>
							Open Fireflies Settings <ExternalLink size={12} />
						</a>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">2</span>
					<div>
						<p class="font-medium mb-1">Find your API key</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Look for "API Key" on the page. If you don't have one, click "Generate" to create it.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">3</span>
					<div>
						<p class="font-medium mb-1">Copy the key</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							Click to copy your API key. It looks something like: <code class="bg-[var(--brand-surface)] px-1 py-0.5 rounded text-xs">ff_xxxxx...</code>
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center text-xs font-bold">4</span>
					<div>
						<p class="font-medium mb-1">Paste into F→N</p>
						<p class="text-sm text-[var(--brand-text-muted)]">
							On your F→N <a href="/dashboard" class="text-[var(--brand-primary)] hover:underline">Dashboard</a>, paste the key into the Fireflies API Key field and click Connect.
						</p>
					</div>
				</li>
			</ol>
		</div>
	</section>

	<!-- Security Note -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
			<Shield size={18} />
			Security
		</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<ul class="space-y-3 text-sm text-[var(--brand-text-muted)]">
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-success)]">✓</span>
					<span>Your API key is <strong>encrypted at rest</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-success)]">✓</span>
					<span>We <strong>only read</strong> your transcripts — we cannot modify or delete them</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-success)]">✓</span>
					<span>You can <strong>disconnect anytime</strong> from Settings</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-success)]">✓</span>
					<span>You can <strong>regenerate</strong> your API key in Fireflies to revoke access</span>
				</li>
			</ul>
		</div>
	</section>

	<!-- What Access Provides -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-4">What This Provides</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)]">
			<p class="text-sm text-[var(--brand-text-muted)] mb-4">
				With your API key, F→N can access:
			</p>
			<ul class="space-y-2 text-sm">
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>List of your transcripts (title, date, duration)</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>Full transcript text for selected meetings</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>Attendee information</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-[var(--brand-text-muted)]">•</span>
					<span>AI-generated summaries (if available)</span>
				</li>
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
				<h3 class="font-medium mb-1">"Invalid API key" error</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Make sure you copied the full key with no extra spaces. Try regenerating a new key in Fireflies.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">"No transcripts found"</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Check that you have transcripts in your Fireflies account. Make sure you're logged into the right Fireflies account.
				</p>
			</div>
			<div class="p-4 bg-[var(--brand-surface-elevated)]">
				<h3 class="font-medium mb-1">Can't find the API key page</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Go to <a href="https://app.fireflies.ai" target="_blank" rel="noopener" class="text-[var(--brand-primary)] hover:underline">app.fireflies.ai</a> → Settings → Integrations → Custom/API.
				</p>
			</div>
		</div>
	</section>
</div>

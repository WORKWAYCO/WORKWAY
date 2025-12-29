<script lang="ts">
	import { Mic, BookOpen, Check, ChevronRight, ChevronLeft, X, Play, ArrowRight, Users, Copy, ExternalLink, Trash2 } from 'lucide-svelte';
	import { fly, fade } from 'svelte/transition';

	// Tour mode
	let tourMode = $state<'user' | 'admin' | null>(null);
	let currentStep = $state(0);
	let tourStarted = $state(false);

	// Typewriter state
	let displayedText = $state('');
	let isTyping = $state(false);
	let typewriterInterval: ReturnType<typeof setInterval> | null = null;

	// Mock UI state (user flow)
	let showFirefliesForm = $state(false);
	let firefliesConnected = $state(false);
	let notionConnected = $state(false);
	let selectedDatabase = $state<string | null>(null);
	let selectedTranscripts = $state<string[]>([]);

	// Mock UI state (admin flow)
	let showInvitationForm = $state(false);
	let invitationEmail = $state('');
	let invitationTier = $state('unlimited');
	let isComplimentary = $state(true);
	let generatedLink = $state('');

	// Mock data
	const mockDatabases = [
		{ id: 'db-1', title: 'Meeting Notes' },
		{ id: 'db-2', title: 'Client Calls' },
		{ id: 'db-3', title: 'Team Standups' },
	];

	const mockTranscripts = [
		{ id: 't-1', title: 'Weekly Team Sync', date: Date.now() - 86400000, synced: false },
		{ id: 't-2', title: 'Client Discovery Call - Acme Corp', date: Date.now() - 172800000, synced: false },
		{ id: 't-3', title: 'Product Review Q4', date: Date.now() - 259200000, synced: true },
		{ id: 't-4', title: 'Sales Pipeline Review', date: Date.now() - 345600000, synced: false },
	];

	// User flow steps
	const userSteps = [
		{
			target: 'fireflies-card',
			narration: "First, connect Fireflies. You'll need your API key from app.fireflies.ai.",
			action: () => { showFirefliesForm = true; },
		},
		{
			target: 'fireflies-input',
			narration: "Paste your API key here. We encrypt it and only use it to read your transcripts.",
			action: null,
		},
		{
			target: 'fireflies-connect-btn',
			narration: "Click Connect. We validate the key and you're in.",
			action: () => { firefliesConnected = true; showFirefliesForm = false; },
		},
		{
			target: 'notion-card',
			narration: "Next, authorize Notion. You'll choose which databases we can access.",
			action: () => { notionConnected = true; },
		},
		{
			target: 'database-select',
			narration: "Pick your target. Each transcript becomes a row with full metadata.",
			action: () => { selectedDatabase = 'db-1'; },
		},
		{
			target: 'transcript-list',
			narration: "Select what to sync. Already-synced items are greyed out.",
			action: () => { selectedTranscripts = ['t-1', 't-2']; },
		},
		{
			target: 'sync-button',
			narration: "Hit sync. Your transcripts flow to Notion. That's it.",
			action: null,
		},
	];

	// Admin flow steps
	const adminSteps = [
		{
			target: 'admin-header',
			narration: "This is the admin panel. You manage client invitations here.",
			action: () => { showInvitationForm = true; },
		},
		{
			target: 'invitation-form',
			narration: "Create an invitation. Email is optional — leave blank for a generic link.",
			action: () => { invitationEmail = 'client@acmecorp.com'; },
		},
		{
			target: 'tier-select',
			narration: "Choose the tier. For white glove clients, check Complimentary.",
			action: () => { isComplimentary = true; invitationTier = 'unlimited'; },
		},
		{
			target: 'generate-btn',
			narration: "Generate the link. It's unique and expires in 7 days.",
			action: () => { generatedLink = 'https://fn.workway.co/setup/abc123xyz'; },
		},
		{
			target: 'invitation-actions',
			narration: "Copy the link. Send it to your client. They create an account and they're in.",
			action: null,
		},
		{
			target: 'invitation-status',
			narration: "Track redemptions here. Active, Redeemed, or Expired. The mechanism recedes.",
			action: null,
		},
	];

	const steps = $derived(tourMode === 'admin' ? adminSteps : userSteps);

	// Typewriter effect
	function typeText(text: string) {
		if (typewriterInterval) {
			clearInterval(typewriterInterval);
		}

		displayedText = '';
		isTyping = true;
		let i = 0;

		typewriterInterval = setInterval(() => {
			if (i < text.length) {
				displayedText += text[i];
				i++;
			} else {
				if (typewriterInterval) clearInterval(typewriterInterval);
				isTyping = false;
			}
		}, 25); // 25ms per character
	}

	// Watch for step changes
	$effect(() => {
		if (tourStarted && steps[currentStep]) {
			typeText(steps[currentStep].narration);
		}
	});

	function nextStep() {
		if (currentStep < steps.length - 1) {
			const step = steps[currentStep];
			if (step.action) step.action();
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	function startTour(mode: 'user' | 'admin') {
		tourMode = mode;
		tourStarted = true;
		currentStep = 0;
		// Reset all mock state
		showFirefliesForm = false;
		firefliesConnected = false;
		notionConnected = false;
		selectedDatabase = null;
		selectedTranscripts = [];
		showInvitationForm = false;
		invitationEmail = '';
		invitationTier = 'unlimited';
		isComplimentary = true;
		generatedLink = '';
	}

	function endTour() {
		tourStarted = false;
		tourMode = null;
		if (typewriterInterval) clearInterval(typewriterInterval);
	}

	const currentTarget = $derived(tourStarted ? steps[currentStep]?.target : null);
	const bothConnected = $derived(firefliesConnected && notionConnected);
</script>

<svelte:head>
	<title>Interactive Tour | F→N Docs</title>
	<meta name="description" content="Experience F→N with an interactive walkthrough. See exactly how syncing works." />
</svelte:head>

<!-- Tour Selection (before starting) -->
{#if !tourStarted}
	<div class="min-h-[80vh] flex items-center justify-center p-6" in:fade>
		<div class="text-center max-w-lg">
			<div class="w-16 h-16 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
				<Play size={32} class="text-[var(--brand-primary)]" />
			</div>
			<h1 class="text-2xl font-bold mb-3">Interactive Tour</h1>
			<p class="text-[var(--brand-text-muted)] mb-8">
				Experience F→N firsthand. Click through the actual interface with guided narration.
			</p>

			<div class="grid gap-4 max-w-sm mx-auto">
				<button
					onclick={() => startTour('user')}
					class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors text-left group"
				>
					<div class="flex items-center gap-3 mb-2">
						<Mic size={20} class="text-purple-500" />
						<span class="font-medium">User Tour</span>
						<ArrowRight size={14} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)] group-hover:translate-x-1 transition-all ml-auto" />
					</div>
					<p class="text-sm text-[var(--brand-text-muted)]">
						Connect Fireflies + Notion, sync transcripts
					</p>
				</button>

				<button
					onclick={() => startTour('admin')}
					class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--brand-surface-elevated)] hover:border-[var(--brand-primary)]/50 transition-colors text-left group"
				>
					<div class="flex items-center gap-3 mb-2">
						<Users size={20} class="text-[var(--brand-primary)]" />
						<span class="font-medium">Admin Tour</span>
						<ArrowRight size={14} class="text-[var(--brand-text-muted)] group-hover:text-[var(--brand-primary)] group-hover:translate-x-1 transition-all ml-auto" />
					</div>
					<p class="text-sm text-[var(--brand-text-muted)]">
						Create invitations for white glove clients
					</p>
				</button>
			</div>
		</div>
	</div>
{:else}
	<!-- Tour Active -->
	<div class="relative">
		<!-- Tour Controls (top bar) -->
		<div class="sticky top-0 z-50 bg-[var(--brand-surface-elevated)] border-b border-[var(--brand-border)] px-4 py-3">
			<div class="max-w-4xl mx-auto flex items-center justify-between">
				<div class="flex items-center gap-4">
					<button
						onclick={endTour}
						class="text-[var(--brand-text-muted)] hover:text-[var(--brand-text)] transition-colors"
						aria-label="Exit tour"
					>
						<X size={20} />
					</button>
					<div class="text-sm">
						<span class="font-medium">{tourMode === 'admin' ? 'Admin' : 'User'} Tour</span>
						<span class="text-[var(--brand-text-muted)]"> — Step {currentStep + 1} of {steps.length}</span>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={prevStep}
						disabled={currentStep === 0}
						class="p-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] hover:bg-[var(--brand-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						aria-label="Previous step"
					>
						<ChevronLeft size={16} />
					</button>
					<button
						onclick={nextStep}
						disabled={currentStep === steps.length - 1}
						class="p-2 bg-[var(--brand-primary)] text-[var(--brand-bg)] rounded-[var(--brand-radius)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
						aria-label="Next step"
					>
						<ChevronRight size={16} />
					</button>
				</div>
			</div>
		</div>

		<!-- Progress bar -->
		<div class="h-1 bg-[var(--brand-border)]">
			<div
				class="h-full bg-[var(--brand-primary)] transition-all duration-300"
				style="width: {((currentStep + 1) / steps.length) * 100}%"
			></div>
		</div>

		<!-- USER TOUR: Mock Dashboard -->
		{#if tourMode === 'user'}
			<div class="max-w-4xl mx-auto px-4 py-8">
				<div class="flex items-center justify-between mb-8">
					<h1 class="text-2xl font-bold">Sync your meetings</h1>
					<div class="text-sm text-[var(--brand-text-muted)]">
						0 / 5 syncs this month
					</div>
				</div>

				{#if !bothConnected}
					<div class="mb-6 text-sm text-[var(--brand-text-muted)]">
						{#if !firefliesConnected && !notionConnected}
							<span class="font-medium text-[var(--brand-text)]">Step 1 of 2:</span> Connect your accounts
						{:else if firefliesConnected && !notionConnected}
							<span class="font-medium text-[var(--brand-text)]">Step 2 of 2:</span> Authorize Notion
						{/if}
					</div>

					<div class="grid md:grid-cols-2 gap-4 mb-8">
						<!-- Fireflies Card -->
						<div
							id="fireflies-card"
							class="border rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)] transition-all duration-300 {currentTarget === 'fireflies-card' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--brand-border)]'}"
						>
							<div class="flex items-center justify-between mb-4">
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
										<Mic size={20} />
									</div>
									<div>
										<h3 class="font-semibold">Fireflies</h3>
										<p class="text-sm text-[var(--brand-text-muted)]">
											{firefliesConnected ? 'Connected' : 'Not connected'}
										</p>
									</div>
								</div>
								{#if firefliesConnected}
									<span class="w-2 h-2 bg-green-500 rounded-full"></span>
								{/if}
							</div>

							{#if !firefliesConnected}
								{#if showFirefliesForm}
									<div class="space-y-3">
										<input
											id="fireflies-input"
											type="password"
											placeholder="Paste your Fireflies API key"
											value="ff_demo_api_key_xxxxx"
											readonly
											class="w-full px-3 py-2 border rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm transition-all duration-300 {currentTarget === 'fireflies-input' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--brand-border)]'}"
										/>
										<div class="flex gap-2">
											<button
												id="fireflies-connect-btn"
												class="flex-1 bg-[var(--brand-primary)] text-[var(--brand-bg)] py-2 rounded-[var(--brand-radius)] text-sm font-medium transition-all duration-300 {currentTarget === 'fireflies-connect-btn' ? 'ring-2 ring-[var(--brand-primary)]/50' : ''}"
											>
												Connect
											</button>
											<button class="px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] text-sm">
												Cancel
											</button>
										</div>
									</div>
								{:else}
									<button class="w-full border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm font-medium">
										Connect Fireflies
									</button>
								{/if}
							{:else}
								<div class="text-sm text-[var(--brand-success)] flex items-center gap-1">
									<Check size={14} /> Connected
								</div>
							{/if}
						</div>

						<!-- Notion Card -->
						<div
							id="notion-card"
							class="border rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)] transition-all duration-300 {currentTarget === 'notion-card' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--brand-border)]'}"
						>
							<div class="flex items-center justify-between mb-4">
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 bg-neutral-500/10 rounded-full flex items-center justify-center text-neutral-500">
										<BookOpen size={20} />
									</div>
									<div>
										<h3 class="font-semibold">Notion</h3>
										<p class="text-sm text-[var(--brand-text-muted)]">
											{notionConnected ? 'My Workspace' : 'Not connected'}
										</p>
									</div>
								</div>
								{#if notionConnected}
									<span class="w-2 h-2 bg-green-500 rounded-full"></span>
								{/if}
							</div>

							{#if !notionConnected}
								<button class="w-full border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm font-medium">
									Connect Notion
								</button>
							{:else}
								<div class="text-sm text-[var(--brand-success)] flex items-center gap-1">
									<Check size={14} /> Connected
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Sync Interface -->
				{#if bothConnected}
					<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)]" in:fly={{ y: 20, duration: 300 }}>
						<div class="mb-6">
							<label for="database" class="block text-sm font-medium mb-2">Notion Database</label>
							<select
								id="database-select"
								bind:value={selectedDatabase}
								class="w-full px-4 py-2 border rounded-[var(--brand-radius)] bg-[var(--brand-surface)] transition-all duration-300 {currentTarget === 'database-select' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--brand-border)]'}"
							>
								<option value={null}>Select a database</option>
								{#each mockDatabases as db}
									<option value={db.id}>{db.title}</option>
								{/each}
							</select>
						</div>

						<div class="mb-6">
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium">Transcripts</span>
								<button class="text-xs text-[var(--brand-primary)] hover:underline">Select all unsynced</button>
							</div>

							<div
								id="transcript-list"
								class="max-h-64 overflow-y-auto border rounded-[var(--brand-radius)] transition-all duration-300 {currentTarget === 'transcript-list' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--brand-border)]'}"
							>
								{#each mockTranscripts as transcript}
									<label
										class="flex items-center gap-3 p-3 border-b border-[var(--brand-border)] last:border-b-0 cursor-pointer hover:bg-[var(--brand-surface)]"
										class:opacity-50={transcript.synced}
									>
										<input
											type="checkbox"
											checked={selectedTranscripts.includes(transcript.id)}
											disabled={transcript.synced}
											class="rounded"
										/>
										<div class="flex-1 min-w-0">
											<div class="font-medium truncate">{transcript.title}</div>
											<div class="text-xs text-[var(--brand-text-muted)] flex items-center gap-1">
												{new Date(transcript.date).toLocaleDateString()}
												{#if transcript.synced}
													<span class="ml-2 text-[var(--brand-success)] flex items-center gap-1">
														<Check size={12} /> Synced
													</span>
												{/if}
											</div>
										</div>
									</label>
								{/each}
							</div>
						</div>

						<div class="flex items-center justify-between">
							<div class="text-sm text-[var(--brand-text-muted)]">
								{selectedTranscripts.length} transcript{selectedTranscripts.length === 1 ? '' : 's'} selected
							</div>
							<button
								id="sync-button"
								disabled={!selectedDatabase || selectedTranscripts.length === 0}
								class="bg-[var(--brand-primary)] text-[var(--brand-bg)] px-6 py-2 rounded-[var(--brand-radius)] font-medium transition-all duration-300 disabled:opacity-50 {currentTarget === 'sync-button' ? 'ring-2 ring-[var(--brand-primary)]/50' : ''}"
							>
								Start sync
							</button>
						</div>
					</div>
				{:else}
					<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-8 text-center bg-[var(--brand-surface-elevated)]">
						<p class="text-[var(--brand-text-muted)]">
							Connect both Fireflies and Notion to start syncing
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ADMIN TOUR: Mock Admin Panel -->
		{#if tourMode === 'admin'}
			<div class="max-w-4xl mx-auto px-4 py-8">
				<div
					id="admin-header"
					class="flex items-center justify-between mb-8 transition-all duration-300 {currentTarget === 'admin-header' ? 'bg-[var(--brand-primary)]/5 -mx-4 px-4 py-4 rounded-[var(--brand-radius)]' : ''}"
				>
					<div class="flex items-center gap-3">
						<Users size={24} class="text-[var(--brand-text-muted)]" />
						<h1 class="text-2xl font-bold">Admin</h1>
					</div>
					<a href="/docs" class="text-sm text-[var(--brand-text-muted)]">Guide</a>
				</div>

				<!-- Stats Cards -->
				<div class="grid grid-cols-3 gap-4 mb-8">
					<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--brand-surface-elevated)]">
						<div class="text-2xl font-bold">3</div>
						<div class="text-sm text-[var(--brand-text-muted)]">Active</div>
					</div>
					<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--brand-surface-elevated)]">
						<div class="text-2xl font-bold text-[var(--brand-success)]">12</div>
						<div class="text-sm text-[var(--brand-text-muted)]">Redeemed</div>
					</div>
					<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4 bg-[var(--brand-surface-elevated)]">
						<div class="text-2xl font-bold text-[var(--brand-text-muted)]">2</div>
						<div class="text-sm text-[var(--brand-text-muted)]">Expired</div>
					</div>
				</div>

				<!-- Create Invitation Form -->
				{#if showInvitationForm}
					<div
						id="invitation-form"
						class="border rounded-[var(--brand-radius)] p-6 bg-[var(--brand-surface-elevated)] mb-6 transition-all duration-300 {currentTarget === 'invitation-form' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--brand-border)]'}"
						in:fly={{ y: 20, duration: 300 }}
					>
						<h2 class="text-lg font-semibold mb-4">Create New Invitation</h2>

						<div class="space-y-4">
							<div>
								<label for="email" class="block text-sm font-medium mb-1">Client Email (optional)</label>
								<input
									id="email"
									type="email"
									bind:value={invitationEmail}
									placeholder="client@example.com"
									class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm"
								/>
							</div>

							<div
								id="tier-select"
								class="transition-all duration-300 {currentTarget === 'tier-select' ? 'bg-[var(--brand-primary)]/5 -mx-2 px-2 py-2 rounded-[var(--brand-radius)]' : ''}"
							>
								<label for="tier" class="block text-sm font-medium mb-1">Subscription Tier</label>
								<select
									id="tier"
									bind:value={invitationTier}
									disabled={isComplimentary}
									class="w-full px-3 py-2 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] text-sm disabled:opacity-50"
								>
									<option value="free">Free — 5 syncs/month</option>
									<option value="pro">Pro — 100 syncs/month</option>
									<option value="unlimited">Unlimited</option>
								</select>

								<label class="flex items-center gap-2 mt-2">
									<input type="checkbox" bind:checked={isComplimentary} class="rounded" />
									<span class="text-sm">Complimentary (100% off)</span>
								</label>
							</div>

							<button
								id="generate-btn"
								class="w-full bg-[var(--brand-primary)] text-[var(--brand-bg)] py-2 rounded-[var(--brand-radius)] font-medium transition-all duration-300 {currentTarget === 'generate-btn' ? 'ring-2 ring-[var(--brand-primary)]/50' : ''}"
							>
								Generate Invitation Link
							</button>
						</div>

						<!-- Generated Link -->
						{#if generatedLink}
							<div
								id="invitation-actions"
								class="mt-4 p-4 border border-[var(--brand-border)] rounded-[var(--brand-radius)] bg-[var(--brand-surface)] transition-all duration-300 {currentTarget === 'invitation-actions' ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : ''}"
								in:fly={{ y: 10, duration: 200 }}
							>
								<div class="text-sm font-mono text-[var(--brand-text-muted)] mb-3 truncate">
									{generatedLink}
								</div>
								<div class="flex gap-2">
									<button class="flex-1 flex items-center justify-center gap-2 border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm hover:bg-[var(--brand-surface-elevated)]">
										<Copy size={14} /> Copy
									</button>
									<button class="flex-1 flex items-center justify-center gap-2 border border-[var(--brand-border)] py-2 rounded-[var(--brand-radius)] text-sm hover:bg-[var(--brand-surface-elevated)]">
										<ExternalLink size={14} /> Open
									</button>
									<button class="flex items-center justify-center gap-2 border border-[var(--brand-border)] px-3 py-2 rounded-[var(--brand-radius)] text-sm hover:bg-[var(--brand-surface-elevated)] text-red-500">
										<Trash2 size={14} />
									</button>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<button
						onclick={() => { showInvitationForm = true; }}
						class="w-full border border-dashed border-[var(--brand-border)] py-4 rounded-[var(--brand-radius)] text-sm text-[var(--brand-text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-text)] transition-colors mb-6"
					>
						+ Create New Invitation
					</button>
				{/if}

				<!-- Invitation List -->
				<div
					id="invitation-status"
					class="transition-all duration-300 {currentTarget === 'invitation-status' ? 'bg-[var(--brand-primary)]/5 -mx-4 px-4 py-4 rounded-[var(--brand-radius)]' : ''}"
				>
					<h2 class="text-lg font-semibold mb-4">Active Invitations</h2>
					<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] divide-y divide-[var(--brand-border)]">
						<div class="p-4 flex items-center justify-between bg-[var(--brand-surface-elevated)]">
							<div>
								<div class="font-medium">client@acmecorp.com</div>
								<div class="text-sm text-[var(--brand-text-muted)]">Unlimited · Complimentary · 5 days left</div>
							</div>
							<span class="px-2 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded text-xs">Active</span>
						</div>
						<div class="p-4 flex items-center justify-between bg-[var(--brand-surface-elevated)]">
							<div>
								<div class="font-medium">Open invitation</div>
								<div class="text-sm text-[var(--brand-text-muted)]">Pro · 3 days left</div>
							</div>
							<span class="px-2 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded text-xs">Active</span>
						</div>
						<div class="p-4 flex items-center justify-between bg-[var(--brand-surface-elevated)]">
							<div>
								<div class="font-medium">partner@agency.co</div>
								<div class="text-sm text-[var(--brand-text-muted)]">Unlimited · Redeemed Dec 20</div>
							</div>
							<span class="px-2 py-1 bg-[var(--brand-success)]/10 text-[var(--brand-success)] rounded text-xs flex items-center gap-1">
								<Check size={10} /> Redeemed
							</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Narration Box (floating, typewriter) -->
		{#if tourStarted}
			<div
				class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
				in:fly={{ y: 20, duration: 200 }}
			>
				<div class="bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 shadow-2xl">
					<!-- Narration text with typewriter effect -->
					<p class="text-sm mb-4 min-h-[40px] font-mono">
						{displayedText}<span class="animate-pulse {isTyping ? '' : 'opacity-0'}">|</span>
					</p>

					<div class="flex items-center justify-between">
						<div class="flex gap-1">
							{#each steps as _, i}
								<div
									class="w-2 h-2 rounded-full transition-colors {i === currentStep ? 'bg-[var(--brand-primary)]' : i < currentStep ? 'bg-[var(--brand-success)]' : 'bg-[var(--brand-border)]'}"
								></div>
							{/each}
						</div>
						{#if currentStep < steps.length - 1}
							<button
								onclick={nextStep}
								class="text-sm text-[var(--brand-primary)] hover:underline flex items-center gap-1"
							>
								Next <ChevronRight size={14} />
							</button>
						{:else}
							<a
								href={tourMode === 'admin' ? '/admin' : '/auth/signup'}
								class="text-sm bg-[var(--brand-primary)] text-[var(--brand-bg)] px-4 py-1.5 rounded-[var(--brand-radius)] hover:opacity-90"
							>
								{tourMode === 'admin' ? 'Go to Admin' : 'Get Started'}
							</a>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

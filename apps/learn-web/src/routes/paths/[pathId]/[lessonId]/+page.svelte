<script lang="ts">
	import { getPath, getLesson, getNextLesson, getPreviousLesson } from '$lib/content/paths';
	import { page } from '$app/stores';
	import { ArrowLeft, ArrowRight, Clock, CheckCircle2, ExternalLink, Check } from 'lucide-svelte';
	import { error } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const pathId = $derived($page.params.pathId ?? '');
	const lessonId = $derived($page.params.lessonId ?? '');

	const path = $derived(getPath(pathId));
	const lesson = $derived(getLesson(pathId, lessonId));
	const nextLesson = $derived(getNextLesson(pathId, lessonId));
	const previousLesson = $derived(getPreviousLesson(pathId, lessonId));
	const lessonIndex = $derived(path?.lessons.findIndex((l) => l.id === lessonId) ?? -1);

	// Use excerpt from loaded content, fallback to description
	const metaDescription = $derived(data.content.excerpt || lesson?.description || '');

	// Auth state - tracking features only available when logged in
	const isAuthenticated = $derived(data.isAuthenticated || false);

	$effect(() => {
		if (!path || !lesson) {
			error(404, 'Lesson not found');
		}
	});

	// Completion state - tracks whether this lesson has been marked complete
	// Initialize from server data if available
	let isCompleted = $state(false);
	let isSubmitting = $state(false);

	// Time tracking - start timer when page loads (only for authenticated users)
	let startTime = $state(Date.now());
	let elapsedSeconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Format elapsed time as mm:ss
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Check if lesson was already completed when loaded
	const wasAlreadyCompleted = $derived(data.lessonsProgress?.[lessonId] || false);

	// Set initial completion state from server data
	$effect(() => {
		isCompleted = data.lessonsProgress?.[lessonId] || false;
	});

	// Running clock - only runs for authenticated users on incomplete lessons
	$effect(() => {
		// Track lessonId to reset on navigation
		const _currentLesson = lessonId;
		const alreadyDone = data.lessonsProgress?.[lessonId] || false;
		const loggedIn = data.isAuthenticated || false;

		// Clear any existing interval
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		// Don't start timer for logged-out users or already-completed lessons
		if (!loggedIn || alreadyDone) {
			elapsedSeconds = 0;
			return;
		}

		// Start fresh timer
		startTime = Date.now();
		elapsedSeconds = 0;

		timerInterval = setInterval(() => {
			elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
		}, 1000);

		// Cleanup on unmount or lesson change
		return () => {
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		};
	});

	// Stop timer when lesson is completed
	$effect(() => {
		if (isCompleted && timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	});

	// Optional reflection for lesson completion
	let reflection = $state('');
	let showReflection = $state(false);

	async function markComplete() {
		if (isSubmitting || isCompleted) return;

		isSubmitting = true;

		// Calculate time spent in seconds
		const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);

		try {
			const response = await fetch('/api/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pathId,
					lessonId,
					status: 'completed',
					timeSpentSeconds
				})
			});

			if (response.ok) {
				// Update local state to reflect completion
				isCompleted = true;
			}
		} catch (error) {
			console.error('Failed to mark lesson complete:', error);
		} finally {
			isSubmitting = false;
		}
	}

	// Calculate progress for sidebar
	const completedCount = $derived(
		path?.lessons.filter((l) => data.lessonsProgress?.[l.id]).length || 0
	);
	const totalCount = $derived(path?.lessons.length || 0);
	const progressPercent = $derived(
		totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
	);
</script>

<svelte:head>
	{#if lesson && path}
		<title>{lesson.title} | {path.title} | Learn WORKWAY</title>
		<meta name="description" content={metaDescription} />

		<!-- SEO -->
		<link rel="canonical" href="https://learn.workway.co/paths/{path.id}/{lesson.id}" />
		{#if previousLesson}
			<link rel="prev" href="https://learn.workway.co/paths/{path.id}/{previousLesson.id}" />
		{/if}
		{#if nextLesson}
			<link rel="next" href="https://learn.workway.co/paths/{path.id}/{nextLesson.id}" />
		{/if}

		<!-- Open Graph -->
		<meta property="og:title" content="{lesson.title} | {path.title}" />
		<meta property="og:description" content={metaDescription} />
		<meta property="og:type" content="article" />
		<meta property="og:url" content="https://learn.workway.co/paths/{path.id}/{lesson.id}" />
		<meta property="og:site_name" content="Learn WORKWAY" />

		<!-- Twitter -->
		<meta name="twitter:card" content="summary" />
		<meta name="twitter:title" content="{lesson.title} | {path.title}" />
		<meta name="twitter:description" content={metaDescription} />

		<!-- Article Schema for lesson content -->
		{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Article",
			"headline": "${lesson.title}",
			"description": "${metaDescription.replace(/"/g, '\\"')}",
			"timeRequired": "PT${lesson.duration.replace(' min', 'M').replace(' hour', 'H').replace('s', '')}",
			"isPartOf": {
				"@type": "Course",
				"name": "${path.title}",
				"url": "https://learn.workway.co/paths/${path.id}",
				"educationalLevel": "${path.difficulty}",
				"timeRequired": "PT${path.estimatedHours}H"
			},
			"publisher": {
				"@type": "Organization",
				"name": "WORKWAY",
				"url": "https://workway.co"
			},
			"mainEntityOfPage": {
				"@type": "WebPage",
				"@id": "https://learn.workway.co/paths/${path.id}/${lesson.id}"
			}
		}
		</script>`}

		<!-- BreadcrumbList Schema -->
		{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			"itemListElement": [
				{
					"@type": "ListItem",
					"position": 1,
					"name": "Learn WORKWAY",
					"item": "https://learn.workway.co"
				},
				{
					"@type": "ListItem",
					"position": 2,
					"name": "Paths",
					"item": "https://learn.workway.co/paths"
				},
				{
					"@type": "ListItem",
					"position": 3,
					"name": "${path.title}",
					"item": "https://learn.workway.co/paths/${path.id}"
				},
				{
					"@type": "ListItem",
					"position": 4,
					"name": "${lesson.title}",
					"item": "https://learn.workway.co/paths/${path.id}/${lesson.id}"
				}
			]
		}
		</script>`}

		<!-- FAQ Schema for AEO (lesson-specific) -->
		{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"mainEntity": [
				{
					"@type": "Question",
					"name": "What does WORKWAY's ${lesson.title} lesson cover?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "WORKWAY's ${lesson.title} lesson teaches: ${lesson.description} This lesson is part of WORKWAY's ${path.title} learning path and takes approximately ${lesson.duration} to complete."
					}
				}${lesson.templateWorkflow ? `,
				{
					"@type": "Question",
					"name": "Is there a hands-on exercise for WORKWAY's ${lesson.title} lesson?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Yes, WORKWAY's ${lesson.title} lesson includes a Praxis exercise using the ${lesson.templateWorkflow.name} workflow template. ${lesson.templateWorkflow.description}"
					}
				}` : ''}${nextLesson ? `,
				{
					"@type": "Question",
					"name": "What comes after WORKWAY's ${lesson.title} lesson?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "After completing WORKWAY's ${lesson.title} lesson, the next lesson in the ${path.title} path is ${nextLesson.title}: ${nextLesson.description}"
					}
				}` : ''}
			]
		}
		</script>`}
	{/if}
</svelte:head>

{#if path && lesson}
	<div class="lesson-layout">
		<!-- Main Content Column -->
		<div>
			<!-- Breadcrumb -->
			<div class="flex items-center gap-xs text-sm text-[var(--color-fg-muted)] mb-lg">
				<a href="/paths" class="hover:text-[var(--color-fg-primary)] transition-colors">Paths</a>
				<span>/</span>
				<a href="/paths/{path.id}" class="hover:text-[var(--color-fg-primary)] transition-colors">
					{path.title}
				</a>
				<span>/</span>
				<span class="text-[var(--color-fg-primary)]">{lesson.title}</span>
			</div>

			<!-- Navigation at top on desktop -->
			<nav class="hidden lg:flex items-center justify-between mb-lg pb-md border-b border-[var(--color-border-default)]" aria-label="Lesson navigation">
				{#if previousLesson}
					<a
						href="/paths/{path.id}/{previousLesson.id}"
						rel="prev"
						class="flex items-center gap-xs text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
					>
						<ArrowLeft size={16} />
						<span>Previous</span>
					</a>
				{:else}
					<div></div>
				{/if}

				{#if nextLesson}
					<a
						href="/paths/{path.id}/{nextLesson.id}"
						rel="next"
						class="flex items-center gap-xs text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
					>
						<span>Next</span>
						<ArrowRight size={16} />
					</a>
				{:else}
					<a
						href="/paths/{path.id}"
						class="flex items-center gap-xs text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
					>
						<span>Back to Path</span>
						<ArrowRight size={16} />
					</a>
				{/if}
			</nav>

			<!-- Lesson header -->
			<header class="mb-xl">
				<div class="flex items-center gap-sm mb-md flex-wrap">
					<span class="text-sm text-[var(--color-fg-subtle)]">
						Lesson {lessonIndex + 1} of {path.lessons.length}
					</span>
					<div class="flex items-center gap-xs text-sm text-[var(--color-fg-subtle)]">
						<Clock size={16} />
						{lesson.duration}
					</div>
					{#if isAuthenticated}
						{#if isCompleted}
							<div class="flex items-center gap-xs text-sm text-[var(--color-success)]" title="Lesson completed">
								<CheckCircle2 size={16} />
								<span>Complete</span>
							</div>
						{:else}
							<div class="flex items-center gap-xs text-sm text-[var(--color-fg-primary)] font-mono" title="Time on this lesson">
								<span class="w-1 h-1 bg-[var(--color-success)] rounded-full animate-pulse"></span>
								{formatTime(elapsedSeconds)}
							</div>
						{/if}
					{/if}
				</div>

				<h1>{lesson.title}</h1>
				<p class="text-[var(--color-fg-muted)] text-lg mt-md">{lesson.description}</p>
			</header>

			<!-- Lesson content -->
			<article class="lesson-content mb-xl">
				{@html data.content.html}
			</article>

			<!-- Praxis section - hands-on challenge to take to Claude Code -->
			{#if lesson.praxis || lesson.templateWorkflow}
				<section class="mb-xl">
					<div class="card-glass-elevated">
						<h2 class="text-lg font-medium mb-md">
							<span class="text-[var(--color-fg-primary)]">Praxis</span>
							<span class="text-[var(--color-fg-muted)]">— Try it with Claude Code</span>
						</h2>

						{#if lesson.praxis}
							<div class="bg-[rgba(255,255,255,0.04)] border-l-2 border-[rgba(255,255,255,0.25)] pl-md py-sm mb-md backdrop-blur-sm">
								<p class="text-[var(--color-fg-primary)] font-mono text-sm">{lesson.praxis}</p>
							</div>
							<p class="text-sm text-[var(--color-fg-muted)]">
								Open your terminal and ask Claude Code. The learning happens in the doing.
							</p>
						{/if}

						{#if lesson.templateWorkflow}
							<a
								href="https://workway.co/workflow/{lesson.templateWorkflow.id}?source=learn&lesson={lesson.id}"
								target="_blank"
								rel="noopener noreferrer"
								class="button-ghost mt-md"
							>
								<ExternalLink size={16} />
								Try: {lesson.templateWorkflow.name}
							</a>
						{/if}
					</div>
				</section>
			{/if}

			<!-- Completion -->
			<section class="mb-xl">
				{#if isAuthenticated}
					{#if !isCompleted}
						<!-- Optional reflection toggle -->
						{#if showReflection}
							<div class="mb-md">
								<label for="reflection" class="block text-sm font-medium mb-sm text-[var(--color-fg-muted)]">
									What did you learn? <span class="text-[var(--color-fg-subtle)]">(optional, for your own reference)</span>
								</label>
								<textarea
									id="reflection"
									bind:value={reflection}
									placeholder="Key insights, questions, or things to remember..."
									rows="3"
									class="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] px-md py-sm text-[var(--color-fg-primary)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-border-emphasis)] resize-y text-sm"
								></textarea>
							</div>
						{:else}
							<button
								onclick={() => showReflection = true}
								class="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] mb-md transition-colors"
							>
								+ Add a reflection (optional)
							</button>
						{/if}
					{/if}
					<button
						onclick={markComplete}
						disabled={isCompleted || isSubmitting}
						class="button-ghost"
						class:active={isCompleted}
						aria-pressed={isCompleted}
					>
						<CheckCircle2 size={16} />
						{#if isSubmitting}
							Saving...
						{:else if isCompleted}
							Completed!
						{:else}
							Mark as Complete
						{/if}
					</button>
				{:else}
					<a href="/auth/signin" class="button-ghost">
						<CheckCircle2 size={16} />
						Sign in to track progress
					</a>
				{/if}
			</section>

			<!-- Navigation at bottom on mobile -->
			<nav class="lg:hidden flex items-center justify-between pt-lg border-t border-[var(--color-border-default)]" aria-label="Lesson navigation">
				{#if previousLesson}
					<a
						href="/paths/{path.id}/{previousLesson.id}"
						rel="prev"
						class="flex items-center gap-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
					>
						<ArrowLeft size={16} />
						<div>
							<div class="text-xs uppercase tracking-wider">Previous</div>
							<div class="font-medium">{previousLesson.title}</div>
						</div>
					</a>
				{:else}
					<div></div>
				{/if}

				{#if nextLesson}
					<a
						href="/paths/{path.id}/{nextLesson.id}"
						rel="next"
						class="flex items-center gap-xs text-right text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
					>
						<div>
							<div class="text-xs uppercase tracking-wider">Next</div>
							<div class="font-medium">{nextLesson.title}</div>
						</div>
						<ArrowRight size={16} />
					</a>
				{:else}
					<a
						href="/paths/{path.id}"
						class="flex items-center gap-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
					>
						Back to Path Overview
						<ArrowRight size={16} />
					</a>
				{/if}
			</nav>
		</div>

		<!-- Sidebar Curriculum (Desktop only) -->
		<aside class="sidebar-sticky">
			<div class="mb-md">
				<h2 class="text-sm font-semibold mb-xs">{path.title}</h2>
				{#if isAuthenticated}
					<div class="progress-bar">
						<div class="progress-bar-fill" style="width: {progressPercent}%"></div>
					</div>
					<div class="text-xs text-[var(--color-fg-muted)]">
						{completedCount} of {totalCount} lessons
					</div>
				{:else}
					<div class="text-xs text-[var(--color-fg-muted)]">
						{totalCount} lessons
					</div>
				{/if}
			</div>

			<nav aria-label="Course curriculum">
				{#each path.lessons as curriculumLesson, idx}
					{@const isCurrent = curriculumLesson.id === lessonId}
					{@const isComplete = isAuthenticated && (data.lessonsProgress?.[curriculumLesson.id] || false)}
					<a
						href="/paths/{path.id}/{curriculumLesson.id}"
						class="curriculum-item"
						class:current={isCurrent}
						class:completed={isComplete}
						aria-current={isCurrent ? 'page' : undefined}
					>
						<div class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
							{#if isComplete}
								<Check size={16} class="text-[var(--color-success)]" />
							{:else}
								<span class="text-xs text-[var(--color-fg-muted)]">{idx + 1}</span>
							{/if}
						</div>
						<span class="text-sm">{curriculumLesson.title}</span>
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Progress Dots (Mobile only) -->
		<div class="lg:hidden progress-dots">
			{#each path.lessons as curriculumLesson}
				{@const isCurrent = curriculumLesson.id === lessonId}
				{@const isComplete = isAuthenticated && (data.lessonsProgress?.[curriculumLesson.id] || false)}
				<div
					class="progress-dot"
					class:current={isCurrent}
					class:completed={isComplete}
					aria-label="{curriculumLesson.title} - {isComplete ? 'completed' : isCurrent ? 'current' : 'not started'}"
				></div>
			{/each}
		</div>
	</div>
{/if}

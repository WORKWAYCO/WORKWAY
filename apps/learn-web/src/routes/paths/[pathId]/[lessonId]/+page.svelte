<script lang="ts">
	import { getPath, getLesson, getNextLesson, getPreviousLesson } from '$lib/content/paths';
	import { page } from '$app/stores';
	import { ArrowLeft, ArrowRight, Clock, CheckCircle2, ExternalLink } from 'lucide-svelte';
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

	$effect(() => {
		if (!path || !lesson) {
			error(404, 'Lesson not found');
		}
	});

	// Completion state - tracks whether this lesson has been marked complete
	let isCompleted = $state(false);
	let isSubmitting = $state(false);

	async function markComplete() {
		if (isSubmitting || isCompleted) return;

		isSubmitting = true;

		try {
			const response = await fetch('/api/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pathId,
					lessonId,
					status: 'completed'
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
	<div class="page-container-narrow">
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

		<!-- Lesson header -->
		<header class="mb-xl">
			<div class="flex items-center gap-sm mb-md">
				<span class="text-sm text-[var(--color-fg-subtle)]">
					Lesson {lessonIndex + 1} of {path.lessons.length}
				</span>
				<div class="flex items-center gap-xs text-sm text-[var(--color-fg-subtle)]">
					<Clock size={16} />
					{lesson.duration}
				</div>
			</div>

			<h1>{lesson.title}</h1>
			<p class="text-[var(--color-fg-muted)] text-lg mt-md">{lesson.description}</p>
		</header>

		<!-- Lesson content -->
		<article class="lesson-content mb-xl">
			{@html data.content.html}
		</article>

		<!-- Praxis section -->
		{#if lesson.praxis || lesson.templateWorkflow}
			<section class="mb-xl">
				<div class="card border-[var(--color-border-emphasis)]">
					<h2 class="text-lg font-medium mb-md flex items-center gap-xs">
						<span class="text-[var(--color-fg-primary)]">Praxis</span>
						<span class="text-[var(--color-fg-muted)]">— Hands-on Exercise</span>
					</h2>

					{#if lesson.praxis}
						<p class="text-[var(--color-fg-muted)] mb-md">{lesson.praxis}</p>
					{/if}

					{#if lesson.templateWorkflow}
						<a
							href="https://workway.co/workflow/{lesson.templateWorkflow.id}?source=learn&lesson={lesson.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="button-ghost"
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
		</section>

		<!-- Navigation -->
		<nav class="flex items-center justify-between pt-lg border-t border-[var(--color-border-default)]" aria-label="Lesson navigation">
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
{/if}

<script lang="ts">
	import { getPath, getLesson, getNextLesson, getPreviousLesson } from '$lib/content/paths';
	import { page } from '$app/stores';
	import { ArrowLeft, ArrowRight, Clock, CheckCircle2, ExternalLink } from 'lucide-svelte';
	import { error } from '@sveltejs/kit';

	const pathId = $derived($page.params.pathId);
	const lessonId = $derived($page.params.lessonId);

	const path = $derived(getPath(pathId));
	const lesson = $derived(getLesson(pathId, lessonId));
	const nextLesson = $derived(getNextLesson(pathId, lessonId));
	const previousLesson = $derived(getPreviousLesson(pathId, lessonId));
	const lessonIndex = $derived(path?.lessons.findIndex((l) => l.id === lessonId) ?? -1);

	$effect(() => {
		if (!path || !lesson) {
			error(404, 'Lesson not found');
		}
	});

	// TODO: Replace with actual completion state from database
	let isCompleted = $state(false);

	async function markComplete() {
		isCompleted = true;
		// TODO: POST to /api/progress to update completion status
	}
</script>

<svelte:head>
	{#if lesson && path}
		<title>{lesson.title} | {path.title} | Learn WORKWAY</title>
		<meta name="description" content={lesson.description} />

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
		<meta property="og:description" content={lesson.description} />
		<meta property="og:type" content="article" />
		<meta property="og:url" content="https://learn.workway.co/paths/{path.id}/{lesson.id}" />
		<meta property="og:site_name" content="Learn WORKWAY" />

		<!-- Twitter -->
		<meta name="twitter:card" content="summary" />
		<meta name="twitter:title" content="{lesson.title} | {path.title}" />
		<meta name="twitter:description" content={lesson.description} />

		<!-- Article Schema for lesson content -->
		{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Article",
			"headline": "${lesson.title}",
			"description": "${lesson.description}",
			"isPartOf": {
				"@type": "Course",
				"name": "${path.title}",
				"url": "https://learn.workway.co/paths/${path.id}"
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
	{/if}
</svelte:head>

{#if path && lesson}
	<div class="max-w-4xl mx-auto px-6 py-12">
		<!-- Breadcrumb -->
		<div class="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] mb-8">
			<a href="/paths" class="hover:text-[var(--color-fg-primary)] transition-colors">Paths</a>
			<span>/</span>
			<a href="/paths/{path.id}" class="hover:text-[var(--color-fg-primary)] transition-colors">
				{path.title}
			</a>
			<span>/</span>
			<span class="text-[var(--color-fg-primary)]">{lesson.title}</span>
		</div>

		<!-- Lesson header -->
		<header class="mb-12">
			<div class="flex items-center gap-3 mb-4">
				<span class="text-sm text-[var(--color-fg-subtle)]">
					Lesson {lessonIndex + 1} of {path.lessons.length}
				</span>
				<div class="flex items-center gap-1 text-sm text-[var(--color-fg-subtle)]">
					<Clock size={14} />
					{lesson.duration}
				</div>
			</div>

			<h1 class="text-4xl font-semibold mb-4">{lesson.title}</h1>
			<p class="text-[var(--color-fg-muted)] text-lg">{lesson.description}</p>
		</header>

		<!-- Lesson content -->
		<article class="prose prose-invert max-w-none mb-12">
			<div class="card">
				<p class="text-[var(--color-fg-muted)]">
					Lesson content will be loaded from markdown files. This is a placeholder for the lesson:
					<strong>{lesson.title}</strong>
				</p>

				<div class="mt-6 p-4 bg-[var(--color-bg-pure)] rounded-[var(--radius-md)] border border-[var(--color-border-default)]">
					<h3 class="text-sm font-medium mb-2">Coming Soon</h3>
					<p class="text-sm text-[var(--color-fg-muted)]">
						Full lesson content with code examples, explanations, and interactive elements.
					</p>
				</div>
			</div>
		</article>

		<!-- Praxis section -->
		{#if lesson.praxis || lesson.templateWorkflow}
			<section class="mb-12">
				<div class="card border-[var(--color-border-emphasis)]">
					<h2 class="text-lg font-medium mb-4 flex items-center gap-2">
						<span class="text-[var(--color-fg-primary)]">Praxis</span>
						<span class="text-[var(--color-fg-muted)]">— Hands-on Exercise</span>
					</h2>

					{#if lesson.praxis}
						<p class="text-[var(--color-fg-muted)] mb-4">{lesson.praxis}</p>
					{/if}

					{#if lesson.templateWorkflow}
						<a
							href="https://workway.co/workflow/{lesson.templateWorkflow.id}?source=learn&lesson={lesson.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border-default)] px-4 py-2 rounded-[var(--radius-md)] text-sm transition-colors"
						>
							<ExternalLink size={16} />
							Try: {lesson.templateWorkflow.name}
						</a>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Completion -->
		<section class="mb-12">
			<button
				onclick={markComplete}
				disabled={isCompleted}
				class="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] transition-colors {isCompleted
					? 'bg-[var(--color-success)] text-[var(--color-bg-pure)]'
					: 'bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]'}"
			>
				<CheckCircle2 size={16} />
				{isCompleted ? 'Completed!' : 'Mark as Complete'}
			</button>
		</section>

		<!-- Navigation -->
		<nav class="flex items-center justify-between pt-8 border-t border-[var(--color-border-default)]">
			{#if previousLesson}
				<a
					href="/paths/{path.id}/{previousLesson.id}"
					class="flex items-center gap-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
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
					class="flex items-center gap-2 text-right text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
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
					class="flex items-center gap-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] transition-colors"
				>
					Back to Path Overview
					<ArrowRight size={16} />
				</a>
			{/if}
		</nav>
	</div>
{/if}

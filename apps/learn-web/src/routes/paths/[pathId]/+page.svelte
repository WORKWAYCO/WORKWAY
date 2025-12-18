<script lang="ts">
	import { getPath, paths } from '$lib/content/paths';
	import { page } from '$app/stores';
	import { Clock, CheckCircle2, Circle, ArrowLeft, ExternalLink } from 'lucide-svelte';
	import { error } from '@sveltejs/kit';

	const pathId = $derived($page.params.pathId ?? '');
	const path = $derived(getPath(pathId));
	const pathIndex = $derived(paths.findIndex((p) => p.id === pathId));
	const prerequisitePath = $derived(pathIndex > 0 ? paths[pathIndex - 1] : null);

	$effect(() => {
		if (!path) {
			error(404, 'Path not found');
		}
	});

	// TODO: Replace with actual progress from database
	const completedLessons: string[] = [];
</script>

<svelte:head>
	{#if path}
		<title>{path.title} | Learn WORKWAY</title>
		<meta name="description" content={path.description} />

		<!-- SEO -->
		<link rel="canonical" href="https://learn.workway.co/paths/{path.id}" />

		<!-- Open Graph -->
		<meta property="og:title" content="{path.title} | Learn WORKWAY" />
		<meta property="og:description" content={path.description} />
		<meta property="og:type" content="website" />
		<meta property="og:url" content="https://learn.workway.co/paths/{path.id}" />
		<meta property="og:site_name" content="Learn WORKWAY" />

		<!-- Twitter -->
		<meta name="twitter:card" content="summary" />
		<meta name="twitter:title" content="{path.title} | Learn WORKWAY" />
		<meta name="twitter:description" content={path.description} />

		<!-- Course Schema -->
		{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Course",
			"name": "${path.title}",
			"description": "${path.description}",
			"provider": {
				"@type": "Organization",
				"name": "WORKWAY",
				"url": "https://workway.co"
			},
			"educationalLevel": "${path.difficulty}",
			"timeRequired": "PT${path.estimatedHours}H",
			"numberOfLessons": ${path.lessons.length}${prerequisitePath ? `,
			"coursePrerequisites": {
				"@type": "Course",
				"name": "${prerequisitePath.title}",
				"url": "https://learn.workway.co/paths/${prerequisitePath.id}"
			}` : ''},
			"hasCourseInstance": {
				"@type": "CourseInstance",
				"courseMode": "online"
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
				}
			]
		}
		</script>`}

		<!-- FAQ Schema for AEO (path-specific) -->
		{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"mainEntity": [
				{
					"@type": "Question",
					"name": "What will I learn in WORKWAY's ${path.title} path?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "WORKWAY's ${path.title} path teaches: ${path.description} This ${path.difficulty}-level WORKWAY course contains ${path.lessons.length} lessons and takes approximately ${path.estimatedHours} hours to complete."
					}
				},
				{
					"@type": "Question",
					"name": "How long is the WORKWAY ${path.title} course?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "WORKWAY's ${path.title} path takes approximately ${path.estimatedHours} hours to complete and includes ${path.lessons.length} lessons. It is designed for ${path.difficulty} level learners in the WORKWAY learning curriculum."
					}
				}${prerequisitePath ? `,
				{
					"@type": "Question",
					"name": "What are the prerequisites for WORKWAY's ${path.title} path?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Before starting WORKWAY's ${path.title} path, complete the ${prerequisitePath.title} path. This ensures you have the foundational knowledge needed for this ${path.difficulty}-level WORKWAY course."
					}
				}` : ''}
			]
		}
		</script>`}
	{/if}
</svelte:head>

{#if path}
	<div class="page-container-narrow">
		<a
			href="/paths"
			class="inline-flex items-center gap-xs text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] mb-lg transition-colors"
		>
			<ArrowLeft size={16} />
			All Paths
		</a>

		<div class="mb-xl">
			<h1>{path.title}</h1>
			<p class="text-[var(--color-fg-muted)] text-lg mt-md mb-md">{path.description}</p>

			<div class="flex items-center gap-md text-sm text-[var(--color-fg-subtle)]">
				<span>{path.lessons.length} lessons</span>
				<span>{path.estimatedHours} hours</span>
				<span class="capitalize">{path.difficulty}</span>
			</div>
		</div>

		<!-- Progress bar -->
		<div class="mb-lg">
			<div class="flex items-center justify-between mb-xs">
				<span class="text-sm text-[var(--color-fg-muted)]">Progress</span>
				<span class="text-sm font-medium">
					{completedLessons.length} / {path.lessons.length}
				</span>
			</div>
			<div class="h-2 bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
				<div
					class="h-full bg-[var(--color-fg-primary)] transition-all duration-500"
					style="width: {(completedLessons.length / path.lessons.length) * 100}%"
				></div>
			</div>
		</div>

		<!-- Lessons list -->
		<div class="space-y-sm">
			{#each path.lessons as lesson, index}
				{@const isCompleted = completedLessons.includes(lesson.id)}
				<a
					href="/paths/{path.id}/{lesson.id}"
					class="flex items-center gap-md p-md card hover:border-[var(--color-border-strong)] transition-colors"
				>
					<div class="flex-shrink-0">
						{#if isCompleted}
							<CheckCircle2 size={20} class="text-[var(--color-success)]" />
						{:else}
							<Circle size={20} class="text-[var(--color-fg-subtle)]" />
						{/if}
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-xs">
							<span class="text-sm text-[var(--color-fg-subtle)]">{index + 1}.</span>
							<h3 class="font-medium">{lesson.title}</h3>
						</div>
						<p class="text-sm text-[var(--color-fg-muted)] mt-xs">{lesson.description}</p>
					</div>

					<div class="flex items-center gap-md flex-shrink-0">
						<div class="flex items-center gap-xs text-sm text-[var(--color-fg-subtle)]">
							<Clock size={16} />
							{lesson.duration}
						</div>

						{#if lesson.templateWorkflow}
							<div
								class="px-xs py-xs text-xs bg-[var(--color-bg-elevated)] rounded-[var(--radius-sm)] flex items-center gap-xs"
								title="Includes template workflow"
							>
								<ExternalLink size={16} />
								Praxis
							</div>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	</div>
{/if}

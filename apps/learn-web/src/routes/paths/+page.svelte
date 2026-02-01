<script lang="ts">
	import { paths } from '$lib/content/paths';
	import { Clock, BookOpen, Terminal, Workflow, Code, Brain } from 'lucide-svelte';

	const iconMap: Record<string, typeof Terminal> = {
		terminal: Terminal,
		workflow: Workflow,
		code: Code,
		brain: Brain
	};

	const difficultyColors = {
		beginner: 'text-[var(--color-success)]',
		intermediate: 'text-[var(--color-warning)]',
		advanced: 'text-[var(--color-error)]'
	};
</script>

<svelte:head>
	<title>Learning Paths | Learn WORKWAY</title>
	<meta name="description" content="Four learning paths from beginner to advanced. Set up tools, learn workflow patterns, build integrations, and ship automations that run themselves." />

	<!-- SEO -->
	<meta name="keywords" content="WORKWAY learning paths, workflow courses, claude code tutorial, workflow automation training" />
	<link rel="canonical" href="https://learn.workway.co/paths" />

	<!-- Open Graph -->
	<meta property="og:title" content="Learning Paths | Learn WORKWAY" />
	<meta property="og:description" content="Four paths from beginner to advanced. Set up tools, learn patterns, build integrations, ship automations that run themselves." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co/paths" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Learning Paths | Learn WORKWAY" />
	<meta name="twitter:description" content="Four paths from beginner to advanced. Set up tools, learn patterns, build integrations, ship automations that run themselves." />

	<!-- ItemList Schema for learning paths -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "ItemList",
		"name": "WORKWAY Learning Paths",
		"description": "Structured learning paths for WORKWAY workflow development",
		"itemListElement": [
			{
				"@type": "ListItem",
				"position": 1,
				"item": {
					"@type": "Course",
					"name": "Getting Started",
					"description": "Set up your local development environment with WezTerm, Claude Code, and essential tools",
					"url": "https://learn.workway.co/paths/getting-started",
					"provider": {
						"@type": "Organization",
						"name": "WORKWAY",
						"url": "https://workway.co"
					},
					"educationalLevel": "beginner",
					"timeRequired": "PT2H"
				}
			},
			{
				"@type": "ListItem",
				"position": 2,
				"item": {
					"@type": "Course",
					"name": "Workflow Foundations",
					"description": "Learn defineWorkflow(), integrations, OAuth, triggers, and configuration schemas",
					"url": "https://learn.workway.co/paths/workflow-foundations",
					"provider": {
						"@type": "Organization",
						"name": "WORKWAY",
						"url": "https://workway.co"
					},
					"educationalLevel": "beginner",
					"timeRequired": "PT3H"
				}
			},
			{
				"@type": "ListItem",
				"position": 3,
				"item": {
					"@type": "Course",
					"name": "Building Workflows",
					"description": "Create real workflows with Gmail, Slack, Zoom, Notion, and Workers AI",
					"url": "https://learn.workway.co/paths/building-workflows",
					"provider": {
						"@type": "Organization",
						"name": "WORKWAY",
						"url": "https://workway.co"
					},
					"educationalLevel": "intermediate",
					"timeRequired": "PT5H"
				}
			},
			{
				"@type": "ListItem",
				"position": 4,
				"item": {
					"@type": "Course",
					"name": "Systems Thinking",
					"description": "Master compound workflows, private patterns, and agency architectures",
					"url": "https://learn.workway.co/paths/systems-thinking",
					"provider": {
						"@type": "Organization",
						"name": "WORKWAY",
						"url": "https://workway.co"
					},
					"educationalLevel": "advanced",
					"timeRequired": "PT4H"
				}
			}
		]
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
			}
		]
	}
	</script>`}

	<!-- FAQ Schema for AEO -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": [
			{
				"@type": "Question",
				"name": "What learning paths are available for WORKWAY?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "WORKWAY offers four learning paths: Getting Started (local setup with WezTerm and Claude Code), Workflow Foundations (core concepts like defineWorkflow and integrations), Building Workflows (hands-on development with Gmail, Slack, Zoom), and Systems Thinking (advanced compound workflows and agency patterns)."
				}
			},
			{
				"@type": "Question",
				"name": "How long does it take to learn WORKWAY?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "The complete WORKWAY learning curriculum takes approximately 14 hours: Getting Started (2 hours), Workflow Foundations (3 hours), Building Workflows (5 hours), and Systems Thinking (4 hours). Each path can be completed independently."
				}
			},
			{
				"@type": "Question",
				"name": "What prerequisites do I need for WORKWAY development?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "WORKWAY's Getting Started path covers all prerequisites: WezTerm terminal installation, Claude Code CLI setup, and WORKWAY CLI installation. Basic familiarity with TypeScript is helpful but not required."
				}
			},
			{
				"@type": "Question",
				"name": "Which WORKWAY learning path should I start with?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Start with WORKWAY's Getting Started path if you need to set up your development environment. If your environment is ready, begin with WORKWAY's Workflow Foundations path to learn the core defineWorkflow() pattern and integration concepts."
				}
			}
		]
	}
	</script>`}
</svelte:head>

<div class="page-container">
	<div class="mb-xl">
		<h1>Learning Paths</h1>
		<p class="text-[var(--color-fg-muted)] text-lg mt-md">
			Progress through structured paths from beginner to advanced. Each path builds on the previous.
		</p>
	</div>

	<div class="space-y-md">
		{#each paths as path}
			{@const Icon = iconMap[path.icon] || BookOpen}
			<a
				href="/paths/{path.id}"
				class="block card-glass"
			>
				<div class="flex items-start gap-md">
					<div
						class="icon-container !w-14 !h-14 flex-shrink-0"
					>
						<Icon size={24} class="text-[var(--color-fg-primary)]" />
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-sm mb-xs">
							<h2 class="text-xl font-medium">{path.title}</h2>
							<span class="text-xs uppercase tracking-wider {difficultyColors[path.difficulty]}">
								{path.difficulty}
							</span>
						</div>

						<p class="text-[var(--color-fg-muted)] mb-md">{path.description}</p>

						<div class="flex items-center gap-md text-sm text-[var(--color-fg-subtle)]">
							<div class="flex items-center gap-xs">
								<BookOpen size={16} />
								{path.lessons.length} lessons
							</div>
							<div class="flex items-center gap-xs">
								<Clock size={16} />
								{path.estimatedHours} hours
							</div>
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>

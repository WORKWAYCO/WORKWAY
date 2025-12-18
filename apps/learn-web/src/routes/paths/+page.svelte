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
	<meta name="description" content="Choose your learning path: from local setup to advanced compound workflows. Structured courses for workflow automation with Claude Code." />

	<!-- SEO -->
	<meta name="keywords" content="WORKWAY learning paths, workflow courses, claude code tutorial, workflow automation training" />
	<link rel="canonical" href="https://learn.workway.co/paths" />

	<!-- Open Graph -->
	<meta property="og:title" content="Learning Paths | Learn WORKWAY" />
	<meta property="og:description" content="Choose your learning path: from local setup to advanced compound workflows." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co/paths" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Learning Paths | Learn WORKWAY" />
	<meta name="twitter:description" content="Choose your learning path: from local setup to advanced compound workflows." />

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
					"name": "Local Setup",
					"description": "Configure WezTerm, Claude Code, Neomutt, and essential developer tools",
					"url": "https://learn.workway.co/paths/local-setup"
				}
			},
			{
				"@type": "ListItem",
				"position": 2,
				"item": {
					"@type": "Course",
					"name": "Workflow Foundations",
					"description": "Learn defineWorkflow(), integrations, OAuth, triggers, and configuration schemas",
					"url": "https://learn.workway.co/paths/workflow-foundations"
				}
			},
			{
				"@type": "ListItem",
				"position": 3,
				"item": {
					"@type": "Course",
					"name": "Building Workflows",
					"description": "Create real workflows with Gmail, Slack, Zoom, Notion, and Workers AI",
					"url": "https://learn.workway.co/paths/building-workflows"
				}
			},
			{
				"@type": "ListItem",
				"position": 4,
				"item": {
					"@type": "Course",
					"name": "Systems Thinking",
					"description": "Master compound workflows, private patterns, and agency architectures",
					"url": "https://learn.workway.co/paths/systems-thinking"
				}
			}
		]
	}
	</script>`}
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-12">
	<div class="mb-12">
		<h1 class="text-4xl font-semibold mb-4">Learning Paths</h1>
		<p class="text-[var(--color-fg-muted)] text-lg">
			Progress through structured paths from beginner to advanced. Each path builds on the previous.
		</p>
	</div>

	<div class="space-y-6">
		{#each paths as path}
			{@const Icon = iconMap[path.icon] || BookOpen}
			<a
				href="/paths/{path.id}"
				class="block card hover:border-[var(--color-border-strong)] transition-colors"
			>
				<div class="flex items-start gap-6">
					<div
						class="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0"
					>
						<Icon size={24} class="text-[var(--color-fg-primary)]" />
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-3 mb-2">
							<h2 class="text-xl font-medium">{path.title}</h2>
							<span class="text-xs uppercase tracking-wider {difficultyColors[path.difficulty]}">
								{path.difficulty}
							</span>
						</div>

						<p class="text-[var(--color-fg-muted)] mb-4">{path.description}</p>

						<div class="flex items-center gap-6 text-sm text-[var(--color-fg-subtle)]">
							<div class="flex items-center gap-2">
								<BookOpen size={14} />
								{path.lessons.length} lessons
							</div>
							<div class="flex items-center gap-2">
								<Clock size={14} />
								{path.estimatedHours} hours
							</div>
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>

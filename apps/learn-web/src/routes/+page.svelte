<script lang="ts">
	import { ArrowRight, Terminal, Workflow, Brain, Zap } from 'lucide-svelte';

	const features = [
		{
			icon: Terminal,
			title: 'Local Setup',
			description: 'Configure WezTerm, Claude Code, Neomutt, and essential developer tools.'
		},
		{
			icon: Workflow,
			title: 'Workflow Foundations',
			description: 'Learn defineWorkflow(), integrations, OAuth, triggers, and configuration schemas.'
		},
		{
			icon: Brain,
			title: 'Building Workflows',
			description: 'Create real workflows with Gmail, Slack, Zoom, Notion, and Workers AI.'
		},
		{
			icon: Zap,
			title: 'Systems Thinking',
			description: 'Master compound workflows, private patterns, and agency architectures.'
		}
	];
</script>

<svelte:head>
	<title>Learn WORKWAY | Build Workflows with Claude Code</title>
	<meta
		name="description"
		content="Master WORKWAY workflow development using Claude Code. From local setup to production-ready compound workflows."
	/>

	<!-- SEO -->
	<meta name="keywords" content="WORKWAY workflows, claude code, workflow automation, typescript workflows, cloudflare workers" />
	<link rel="canonical" href="https://learn.workway.co" />

	<!-- Open Graph -->
	<meta property="og:title" content="Learn WORKWAY | Build Workflows with Claude Code" />
	<meta property="og:description" content="Master WORKWAY workflow development. From local setup to production-ready compound workflows." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Learn WORKWAY | Build Workflows with Claude Code" />
	<meta name="twitter:description" content="Master WORKWAY workflow development. From local setup to production-ready compound workflows." />

	<!-- JSON-LD Structured Data -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "Learn WORKWAY",
		"url": "https://learn.workway.co",
		"description": "Master WORKWAY workflow development using Claude Code",
		"publisher": {
			"@type": "Organization",
			"name": "WORKWAY",
			"url": "https://workway.co"
		}
	}
	</script>`}

	<!-- Course Schema -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "Course",
		"name": "WORKWAY Workflow Development",
		"description": "Learn to build production-ready workflow automations using Claude Code and TypeScript",
		"provider": {
			"@type": "Organization",
			"name": "WORKWAY",
			"url": "https://workway.co"
		},
		"educationalLevel": "Beginner to Advanced",
		"teaches": ["Workflow Automation", "TypeScript", "Cloudflare Workers", "API Integrations"],
		"hasCourseInstance": {
			"@type": "CourseInstance",
			"courseMode": "online",
			"courseWorkload": "PT10H"
		}
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
				"name": "What is WORKWAY?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "WORKWAY is a workflow automation platform that lets you build compound workflows connecting services like Zoom, Notion, Slack, and Gmail using TypeScript and Cloudflare Workers."
				}
			},
			{
				"@type": "Question",
				"name": "How do I learn WORKWAY workflow development?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Learn WORKWAY through structured paths: start with local setup (WezTerm, Claude Code), learn workflow foundations (defineWorkflow, integrations, OAuth), then build real workflows connecting Gmail, Slack, Zoom, and Notion."
				}
			},
			{
				"@type": "Question",
				"name": "Can I use Claude Code to build WORKWAY workflows?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Yes. Learn WORKWAY teaches workflow development using Claude Code as the primary development environment. Claude Code understands WORKWAY patterns and can help write, debug, and deploy workflows."
				}
			}
		]
	}
	</script>`}
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-16">
	<!-- Hero -->
	<section class="text-center mb-24">
		<h1 class="text-5xl md:text-7xl font-semibold tracking-tight mb-6 mx-auto text-center">
			Learn WORKWAY
		</h1>
		<p class="text-xl md:text-2xl text-[var(--color-fg-muted)] max-w-2xl mx-auto mb-8">
			Build powerful workflow automations using Claude Code. From first commit to production-ready
			compound workflows.
		</p>
		<a href="/paths" class="button-primary">
			Start Learning
			<ArrowRight size={20} />
		</a>
	</section>

	<!-- Features -->
	<section class="grid md:grid-cols-2 gap-6 mb-24">
		{#each features as feature}
			<div class="card">
				<div
					class="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] flex items-center justify-center mb-4"
				>
					<feature.icon size={20} class="text-[var(--color-fg-primary)]" />
				</div>
				<h3 class="text-lg font-medium mb-2">{feature.title}</h3>
				<p class="text-[var(--color-fg-muted)]">{feature.description}</p>
			</div>
		{/each}
	</section>

	<!-- Philosophy -->
	<section class="text-center max-w-3xl mx-auto">
		<blockquote class="text-2xl md:text-3xl font-light italic text-[var(--color-fg-muted)] mb-4">
			"The tool should recede; the outcome should remain."
		</blockquote>
		<p class="text-[var(--color-fg-subtle)]">
			Zuhandenheit — Learn to build workflows that disappear into the work.
		</p>
	</section>
</div>

<script lang="ts">
	import { ArrowRight, Terminal, Workflow, Brain, Zap, Flame, Clock, Users, CheckCircle } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

	const journeySteps = [
		{ step: '1', title: 'Learn', description: 'Complete learning paths to understand the philosophy and patterns.' },
		{ step: '2', title: 'Apply', description: 'Join the waitlist. Developers who learn first are prioritized.' },
		{ step: '3', title: 'Build', description: 'Once approved, access the CLI and publish to the marketplace.' }
	];

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'today';
		if (diffDays === 1) return 'yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		return date.toLocaleDateString();
	}
</script>

<svelte:head>
	<title>Learn WORKWAY | Build Workflows with Claude Code</title>
	<meta
		name="description"
		content="Build workflows that disappear into your work. Go from first commit to production-ready automations that handle follow-ups, sync data, and save hours weekly."
	/>

	<!-- SEO -->
	<meta name="keywords" content="WORKWAY workflows, claude code, workflow automation, typescript workflows, cloudflare workers" />
	<link rel="canonical" href="https://learn.workway.co" />

	<!-- Open Graph -->
	<meta property="og:title" content="Learn WORKWAY | Build Workflows with Claude Code" />
	<meta property="og:description" content="Build workflows that disappear into your work. From first commit to production-ready automations that save hours weekly." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Learn WORKWAY | Build Workflows with Claude Code" />
	<meta name="twitter:description" content="Build workflows that disappear into your work. From first commit to production-ready automations that save hours weekly." />

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
			},
			{
				"@type": "Question",
				"name": "What is defineWorkflow()?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "defineWorkflow() is the core function for creating WORKWAY workflows. It takes a configuration object with metadata, integrations, triggers, and an execute function. This pattern ensures type safety and enables the platform to validate, deploy, and run your workflow on Cloudflare Workers."
				}
			},
			{
				"@type": "Question",
				"name": "How do I build a workflow?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Build a WORKWAY workflow by: 1) Define your workflow using defineWorkflow() with metadata, 2) Specify integrations (Zoom, Slack, Notion, etc.) with required OAuth scopes, 3) Set up triggers (webhook, cron, or manual), 4) Implement the execute function with your business logic, 5) Deploy to Cloudflare Workers using the WORKWAY CLI."
				}
			}
		]
	}
	</script>`}
</svelte:head>

<div class="page-container">
	{#if data.user && data.progress}
		<!-- Authenticated User Dashboard -->
		<section class="mb-xl">
			<!-- Welcome Header with Streak -->
			<div class="flex items-center justify-between mb-lg">
				<div>
					<h1 class="text-3xl font-semibold mb-xs">Welcome back, {data.user.displayName || data.user.email.split('@')[0]}</h1>
					<p class="text-[var(--color-fg-muted)]">Continue your learning journey</p>
				</div>
				{#if data.progress.streak && data.progress.streak.currentStreak > 0}
					<div class="flex items-center gap-xs text-[var(--color-fg-primary)]">
						<Flame size={24} class="text-[var(--color-warning)]" />
						<span class="text-2xl font-semibold">{data.progress.streak.currentStreak}</span>
						<span class="text-sm text-[var(--color-fg-muted)]">day streak</span>
					</div>
				{/if}
			</div>

			<!-- Continue Learning Hero -->
			{#if data.progress.nextLesson}
				<a
					href="/paths/{data.progress.nextLesson.pathId}/{data.progress.nextLesson.lessonId}"
					class="card-glass-elevated block mb-lg"
				>
					<div class="flex items-center justify-between">
						<div>
							<div class="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-xs">
								Continue Learning
							</div>
							<h2 class="text-xl font-semibold mb-xs">{data.progress.nextLesson.lessonTitle}</h2>
							<p class="text-[var(--color-fg-muted)]">{data.progress.nextLesson.pathTitle}</p>
						</div>
						<ArrowRight size={24} class="text-[var(--color-fg-muted)]" />
					</div>
				</a>
			{/if}

			<!-- Path Progress Cards -->
			<div class="mb-lg">
				<h2 class="text-lg font-semibold mb-md">Your Paths</h2>
				<div class="grid md:grid-cols-2 gap-md">
					{#each data.progress.pathsWithProgress as path}
						<a href="/paths/{path.id}" class="card-glass block">
							<div class="flex items-center gap-md mb-md">
								<div class="icon-container">
									{#if path.icon === 'terminal'}
										<Terminal size={20} />
									{:else if path.icon === 'workflow'}
										<Workflow size={20} />
									{:else if path.icon === 'code'}
										<Brain size={20} />
									{:else if path.icon === 'brain'}
										<Zap size={20} />
									{/if}
								</div>
								<div class="flex-1">
									<h3 class="font-medium mb-xs">{path.title}</h3>
									<div class="text-xs text-[var(--color-fg-muted)]">
										{path.completedLessons} of {path.totalLessons} lessons
									</div>
								</div>
							</div>
							<div class="progress-bar">
								<div class="progress-bar-fill" style="width: {path.progressPercent}%"></div>
							</div>
							<div class="text-xs text-right text-[var(--color-fg-muted)] mt-xs">
								{path.progressPercent}% complete
							</div>
						</a>
					{/each}
				</div>
			</div>

			<!-- Recent Activity -->
			{#if data.progress.recentActivity && data.progress.recentActivity.length > 0}
				<div>
					<h2 class="text-lg font-semibold mb-md">Recent Activity</h2>
					<div class="card-glass">
						{#each data.progress.recentActivity.slice(0, 5) as activity, i}
							<div
								class="flex items-center justify-between py-sm"
								class:border-t={i > 0}
								class:border-[rgba(255,255,255,0.1)]={i > 0}
							>
								<div class="flex items-center gap-sm">
									<div class="w-6 h-6 flex items-center justify-center text-[var(--color-success)]">
										✓
									</div>
									<a
										href="/paths/{activity.pathId}/{activity.lessonId}"
										class="text-[var(--color-fg-primary)] hover:underline"
									>
										{activity.lessonTitle}
									</a>
								</div>
								<div class="text-xs text-[var(--color-fg-muted)]">
									{formatDate(activity.completedAt)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{:else}
		<!-- Marketing Page for Logged-out Users -->
		<!-- Hero -->
		<section class="text-center mb-section">
			<h1 class="mx-auto text-center">Learn WORKWAY</h1>
			<p class="text-xl md:text-2xl text-[var(--color-fg-muted)] max-w-2xl mx-auto mb-lg">
				Build powerful workflow automations using Claude Code. From first commit to production-ready
				compound workflows.
			</p>
			<a href="/paths" class="button-primary">
				Start Learning
				<ArrowRight size={20} />
			</a>
		</section>

		<!-- Features -->
		<section class="grid md:grid-cols-2 gap-md mb-section">
			{#each features as feature}
				<div class="card-feature">
					<div class="icon-container">
						<feature.icon size={20} class="text-[var(--color-fg-primary)]" />
					</div>
					<h3 class="text-lg font-medium mb-xs">{feature.title}</h3>
					<p class="text-[var(--color-fg-muted)]">{feature.description}</p>
				</div>
			{/each}
		</section>

		<!-- Developer Journey -->
		<section class="mb-section">
			<div class="text-center mb-lg">
				<h2 class="text-2xl md:text-3xl font-semibold mb-sm">Your path to becoming a WORKWAY developer</h2>
				<p class="text-[var(--color-fg-muted)]">Quality over quantity. We accept 10 developers at a time.</p>
			</div>

			<div class="grid md:grid-cols-3 gap-md mb-lg">
				{#each journeySteps as step}
					<div class="card-glass text-center relative">
						<div class="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.15)] backdrop-blur-sm flex items-center justify-center mx-auto mb-md">
							<span class="text-xl font-bold text-[var(--color-fg-primary)]">{step.step}</span>
						</div>
						<h3 class="text-lg font-semibold mb-xs">{step.title}</h3>
						<p class="text-sm text-[var(--color-fg-muted)]">{step.description}</p>
					</div>
				{/each}
			</div>

			<!-- Waitlist CTA -->
			<div class="card-glass-elevated text-center max-w-xl mx-auto">
				<div class="flex items-center justify-center gap-xs mb-md">
					<Users size={20} class="text-[var(--color-fg-secondary)]" />
					<span class="text-sm text-[var(--color-fg-muted)]">10 developers per cohort</span>
				</div>
				<h3 class="text-xl font-semibold mb-sm">Ready to apply?</h3>
				<p class="text-[var(--color-fg-muted)] mb-md">
					Developers who complete learning paths are prioritized. Show us you understand the philosophy.
				</p>
				<div class="flex flex-col sm:flex-row gap-sm justify-center">
					<a href="/paths" class="button-secondary text-sm">
						Learn First
					</a>
					<a href="https://workway.co/waitlist" class="button-primary text-sm">
						Join Waitlist
						<ArrowRight size={16} />
					</a>
				</div>
			</div>
		</section>

		<!-- Philosophy -->
		<section class="text-center max-w-3xl mx-auto">
			<blockquote class="text-2xl md:text-3xl font-light italic text-[var(--color-fg-muted)] mb-md">
				"The tool should recede; the outcome should remain."
			</blockquote>
			<p class="text-[var(--color-fg-subtle)]">
				Zuhandenheit — Learn to build workflows that disappear into the work.
			</p>
		</section>
	{/if}
</div>

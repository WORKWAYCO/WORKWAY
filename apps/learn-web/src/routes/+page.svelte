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

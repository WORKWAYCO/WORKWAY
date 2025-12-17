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
	<meta name="description" content="Choose your learning path: from local setup to advanced compound workflows." />
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

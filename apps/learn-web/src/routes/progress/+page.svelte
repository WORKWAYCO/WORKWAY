<script lang="ts">
	import { paths } from '$lib/content/paths';
	import { Clock, CheckCircle2, Circle, BarChart3, BookOpen, Calendar } from 'lucide-svelte';

	// TODO: Replace with actual data from database
	const stats = {
		totalLessons: paths.reduce((sum, p) => sum + p.lessons.length, 0),
		completedLessons: 0,
		totalTimeMinutes: 0,
		currentStreak: 0
	};

	const progressPercentage = Math.round((stats.completedLessons / stats.totalLessons) * 100);
</script>

<svelte:head>
	<title>Your Progress | Learn WORKWAY</title>
	<meta name="description" content="Track your learning progress across all WORKWAY courses." />
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-12">
	<h1 class="text-4xl font-semibold mb-8">Your Progress</h1>

	<!-- Stats overview -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
		<div class="card">
			<div class="flex items-center gap-3 mb-2">
				<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
					<CheckCircle2 size={16} class="text-[var(--color-success)]" />
				</div>
				<span class="text-sm text-[var(--color-fg-muted)]">Completed</span>
			</div>
			<p class="text-2xl font-semibold">
				{stats.completedLessons}
				<span class="text-sm font-normal text-[var(--color-fg-muted)]">/ {stats.totalLessons}</span>
			</p>
		</div>

		<div class="card">
			<div class="flex items-center gap-3 mb-2">
				<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
					<BarChart3 size={16} class="text-[var(--color-fg-primary)]" />
				</div>
				<span class="text-sm text-[var(--color-fg-muted)]">Progress</span>
			</div>
			<p class="text-2xl font-semibold">{progressPercentage}%</p>
		</div>

		<div class="card">
			<div class="flex items-center gap-3 mb-2">
				<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
					<Clock size={16} class="text-[var(--color-fg-primary)]" />
				</div>
				<span class="text-sm text-[var(--color-fg-muted)]">Time Spent</span>
			</div>
			<p class="text-2xl font-semibold">
				{Math.floor(stats.totalTimeMinutes / 60)}h {stats.totalTimeMinutes % 60}m
			</p>
		</div>

		<div class="card">
			<div class="flex items-center gap-3 mb-2">
				<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
					<Calendar size={16} class="text-[var(--color-fg-primary)]" />
				</div>
				<span class="text-sm text-[var(--color-fg-muted)]">Streak</span>
			</div>
			<p class="text-2xl font-semibold">{stats.currentStreak} days</p>
		</div>
	</div>

	<!-- Path progress -->
	<h2 class="text-2xl font-semibold mb-6">Path Progress</h2>
	<div class="space-y-4">
		{#each paths as path}
			{@const completedInPath = 0}
			{@const pathProgress = Math.round((completedInPath / path.lessons.length) * 100)}

			<div class="card">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<BookOpen size={20} class="text-[var(--color-fg-primary)]" />
						<h3 class="font-medium">{path.title}</h3>
					</div>
					<span class="text-sm text-[var(--color-fg-muted)]">
						{completedInPath} / {path.lessons.length} lessons
					</span>
				</div>

				<!-- Progress bar -->
				<div class="h-2 bg-[var(--color-bg-pure)] rounded-full overflow-hidden">
					<div
						class="h-full bg-[var(--color-fg-primary)] transition-all duration-500"
						style="width: {pathProgress}%"
					></div>
				</div>

				<!-- Lesson dots -->
				<div class="flex items-center gap-1 mt-4">
					{#each path.lessons as lesson, index}
						{@const isComplete = false}
						<div
							class="w-2 h-2 rounded-full {isComplete
								? 'bg-[var(--color-success)]'
								: 'bg-[var(--color-bg-elevated)]'}"
							title="{index + 1}. {lesson.title}"
						></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

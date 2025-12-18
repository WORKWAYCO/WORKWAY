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
	<meta name="description" content="Track your learning progress across all WORKWAY courses. See completed lessons, time spent, and streak." />

	<!-- SEO -->
	<link rel="canonical" href="https://learn.workway.co/progress" />

	<!-- Open Graph -->
	<meta property="og:title" content="Your Progress | Learn WORKWAY" />
	<meta property="og:description" content="Track your learning progress across all WORKWAY courses." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://learn.workway.co/progress" />
	<meta property="og:site_name" content="Learn WORKWAY" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Your Progress | Learn WORKWAY" />
	<meta name="twitter:description" content="Track your learning progress across all WORKWAY courses." />

	<!-- Robots: Don't index user-specific pages -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-container">
	<h1 class="mb-lg">Your Progress</h1>

	<!-- Stats overview -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
		<div class="card">
			<div class="flex items-center gap-sm mb-xs">
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
			<div class="flex items-center gap-sm mb-xs">
				<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
					<BarChart3 size={16} class="text-[var(--color-fg-primary)]" />
				</div>
				<span class="text-sm text-[var(--color-fg-muted)]">Progress</span>
			</div>
			<p class="text-2xl font-semibold">{progressPercentage}%</p>
		</div>

		<div class="card">
			<div class="flex items-center gap-sm mb-xs">
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
			<div class="flex items-center gap-sm mb-xs">
				<div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] flex items-center justify-center">
					<Calendar size={16} class="text-[var(--color-fg-primary)]" />
				</div>
				<span class="text-sm text-[var(--color-fg-muted)]">Streak</span>
			</div>
			<p class="text-2xl font-semibold">{stats.currentStreak} days</p>
		</div>
	</div>

	<!-- Path progress -->
	<h2 class="text-2xl font-semibold mb-md">Path Progress</h2>
	<div class="space-y-md">
		{#each paths as path}
			{@const completedInPath = 0}
			{@const pathProgress = Math.round((completedInPath / path.lessons.length) * 100)}

			<div class="card">
				<div class="flex items-center justify-between mb-md">
					<div class="flex items-center gap-sm">
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
				<div class="flex items-center gap-xs mt-md">
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
